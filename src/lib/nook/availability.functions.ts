import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BusinessConfig } from "./types";

/** Public output contains bookable choices only, never existing customers or appointments. */
export const getAvailableSlots = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        serviceId: z.string().max(100),
        answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
        artistId: z.string().max(100).optional(),
        flashId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { defaultBusiness } = await import("./config");
    const { buildQuote, slotsForDay, dateKey } = await import("./engine");
    const { fetchBusyBlocks } = await import("./google-calendar.server");
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("studio_settings")
      .select("config")
      .eq("id", "main")
      .maybeSingle();
    if (settingsError) throw new Error("Could not load studio availability");
    const business = (settings?.config ?? defaultBusiness) as BusinessConfig;
    const service = business.services.find((item) => item.id === data.serviceId);
    if (!service) throw new Error("Service unavailable");
    let pricedService = service;
    if (service.id === "flash") {
      if (!data.flashId) return { connected: true, days: {}, capacity: {} };
      const { data: flash, error: flashError } = await supabaseAdmin
        .from("flash_designs")
        .select("price,duration_minutes,available,archived_at")
        .eq("id", data.flashId)
        .maybeSingle();
      if (flashError || !flash?.available || flash.archived_at)
        return { connected: true, days: {}, capacity: {} };
      pricedService = { ...service, basePrice: flash.price, baseDuration: flash.duration_minutes };
    }
    const quote = buildQuote(business, pricedService, data.answers);
    const team = data.artistId
      ? quote.eligibleTeam.filter((member) => member.id === data.artistId)
      : quote.eligibleTeam;
    const today = new Date();
    const horizon = Math.min(Math.max(business.policies.horizonDays, 1), 180);
    const until = new Date(today.getTime() + horizon * 24 * 60 * 60_000);
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("booking_requests")
      .select("appointment_date,appointment_time,member_id,quote")
      .neq("status", "declined")
      .gte("appointment_date", dateKey(today))
      .lte("appointment_date", dateKey(until));
    if (rowsError) throw new Error("Could not check existing appointments");
    const booked = (rows ?? []).map((row) => ({
      date: row.appointment_date,
      time: row.appointment_time.slice(0, 5),
      memberId: row.member_id,
      duration: Number((row.quote as { duration?: number } | null)?.duration ?? 60),
    }));
    try {
      const blocked = await fetchBusyBlocks(today.toISOString(), until.toISOString());
      const days: Record<string, { time: string; memberId: string; memberName: string }[]> = {};
      // Open slots on an empty diary: lets the calendar tell "fully booked" from "closed"
      // and show how full a day is, without exposing who booked what.
      const capacity: Record<string, number> = {};
      for (let offset = 0; offset <= horizon; offset += 1) {
        const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
        const slots = slotsForDay(business, team, quote.duration, day, booked, blocked);
        if (slots.length > 0) days[dateKey(day)] = slots;
        const total = slotsForDay(business, team, quote.duration, day, [], []).length;
        if (total > 0) capacity[dateKey(day)] = total;
      }
      return { connected: true, days, capacity };
    } catch (error) {
      console.error("Availability check failed", error instanceof Error ? error.message : error);
      return { connected: false, days: {}, capacity: {} };
    }
  });
