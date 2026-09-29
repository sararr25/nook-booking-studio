import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BusinessConfig } from "./types";

const input = z.object({
  id: z.string().uuid(),
  customerName: z.string().trim().min(1).max(120),
  contact: z.string().trim().email().max(240),
  phone: z.string().min(6).max(50),
  notes: z.string().max(3000),
  serviceId: z.string().max(100),
  answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  memberId: z.string().max(100),
  flashDesignId: z.string().uuid().optional(),
  referencePaths: z.array(z.string().max(500)).max(5),
  quotedLow: z.number().nonnegative(),
  quotedHigh: z.number().nonnegative(),
  quotedDuration: z.number().positive(),
});

/** Recompute quote and availability before the atomic DB reservation. */
export const submitBooking = createServerFn({ method: "POST" })
  .inputValidator((value) => input.parse(value))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { defaultBusiness } = await import("./config");
    const { buildQuote, visibleQuestions, isAnswered, slotsForDay, dateKey } =
      await import("./engine");
    const { fetchBusyBlocks } = await import("./google-calendar.server");
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("studio_settings")
      .select("config")
      .eq("id", "main")
      .maybeSingle();
    if (settingsError) throw new Error("Could not load studio settings");
    const business = (settings?.config ?? defaultBusiness) as BusinessConfig;
    const service = business.services.find((item) => item.id === data.serviceId);
    if (!service) throw new Error("Service is no longer available");
    if (
      !visibleQuestions(service, data.answers).every((question) =>
        isAnswered(question, data.answers),
      )
    )
      throw new Error("Complete the booking questions first");
    if (data.referencePaths.some((path) => !path.startsWith(`${data.id}/`)))
      throw new Error("Invalid reference image");
    let pricedService = service;
    if (service.id === "flash") {
      if (!data.flashDesignId) throw new Error("Choose a flash design");
      const { data: flash, error: flashError } = await supabaseAdmin
        .from("flash_designs")
        .select("price,duration_minutes,available")
        .eq("id", data.flashDesignId)
        .maybeSingle();
      if (flashError || !flash?.available) throw new Error("Flash design is no longer available");
      pricedService = { ...service, basePrice: flash.price, baseDuration: flash.duration_minutes };
    }
    const quote = buildQuote(business, pricedService, data.answers);
    if (
      quote.low !== data.quotedLow ||
      quote.high !== data.quotedHigh ||
      quote.duration !== data.quotedDuration
    )
      throw new Error(
        "The price or length changed. Refresh the booking to review the new estimate.",
      );
    if (quote.requiresPhotos && data.referencePaths.length === 0)
      throw new Error("Add a reference photo for this request");
    const day = new Date(`${data.date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const earliest = new Date(today);
    earliest.setDate(earliest.getDate() + business.policies.leadTimeDays);
    const latest = new Date(today);
    latest.setDate(latest.getDate() + business.policies.horizonDays);
    if (Number.isNaN(day.getTime()) || day < earliest || day > latest || dateKey(day) !== data.date)
      throw new Error("Choose a date within the booking window");
    let status: "pending" | "confirmed" = quote.requiresReview ? "pending" : "confirmed";
    if (quote.eligibleTeam.length === 0) {
      if (data.memberId !== "unassigned") throw new Error("Artist is not available");
      status = "pending";
    } else {
      const artist = quote.eligibleTeam.find((member) => member.id === data.memberId);
      if (!artist) throw new Error("Artist is not available");
      const { data: rows, error: rowsError } = await supabaseAdmin
        .from("booking_requests")
        .select("appointment_date,appointment_time,member_id,quote")
        .eq("appointment_date", data.date)
        .neq("status", "declined");
      if (rowsError) throw new Error("Could not check existing appointments");
      const booked = (rows ?? []).map((row) => ({
        date: row.appointment_date,
        time: row.appointment_time.slice(0, 5),
        memberId: row.member_id,
        duration: Number((row.quote as { duration?: number } | null)?.duration ?? 60),
      }));
      let blocked;
      try {
        blocked = await fetchBusyBlocks(
          day.toISOString(),
          new Date(day.getTime() + 24 * 60 * 60_000).toISOString(),
        );
      } catch {
        throw new Error("Google Calendar could not be verified. Please try again.");
      }
      if (
        !slotsForDay(business, [artist], quote.duration, day, booked, blocked).some(
          (slot) => slot.time === data.time && slot.memberId === data.memberId,
        )
      )
        throw new Error("This time is no longer available. Choose another time.");
    }
    const booking = {
      id: data.id,
      customer_name: data.customerName,
      contact: data.contact,
      phone: data.phone,
      notes: data.notes,
      service_id: data.serviceId,
      answers: data.answers,
      quote: {
        low: quote.low,
        high: quote.high,
        duration: quote.duration,
        deposit: quote.deposit,
        requiresReview: quote.requiresReview,
        reviewReasons: quote.reviewReasons,
        lines: quote.lines,
      },
      appointment_date: data.date,
      appointment_time: data.time,
      member_id: data.memberId,
      flash_design_key: data.flashDesignId ?? null,
      reference_paths: data.referencePaths,
      status,
    };
    const { error } = await supabaseAdmin.rpc(
      "create_booking_request" as never,
      { p_booking: booking } as never,
    );
    if (error)
      throw new Error(
        error.message.includes("no longer available")
          ? error.message
          : "Could not save the booking. Please try again.",
      );
    return { id: data.id, status };
  });
