import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BusinessConfig } from "./types";

const input = z.object({
  id: z.string().uuid(),
  customerName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(240).or(z.literal("")),
  phone: z.string().trim().min(6).max(50),
  notes: z.string().max(3000),
  serviceId: z.string().max(100),
  memberId: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(15).max(720),
  price: z.number().nonnegative().max(100_000),
  status: z.enum(["confirmed", "awaiting_deposit"]),
  notifyCustomer: z.boolean(),
});

/**
 * Owner only: add a booking taken by phone, DM or in person.
 * The owner sets price and length directly; the same database function as customer
 * bookings rejects overlaps for the chosen artist.
 */
export const createOwnerBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => input.parse(value))
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("studio_settings")
      .select("config")
      .eq("id", "main")
      .maybeSingle();
    if (settingsError || !settings?.config) throw new Error("Could not load studio settings");
    const business = settings.config as unknown as BusinessConfig;
    const service = business.services.find((item) => item.id === data.serviceId);
    if (!service) throw new Error("Choose a service");
    if (!business.team.some((member) => member.id === data.memberId))
      throw new Error("Choose an artist");
    if (data.serviceId === "flash")
      throw new Error("Add flash bookings through the customer flow so the design is reserved");
    if (data.status === "awaiting_deposit" && !data.email)
      throw new Error("Add the customer's email so they can receive the deposit link");

    const deposit = Math.round((data.price * service.depositPercent) / 100);
    const { error } = await supabaseAdmin.rpc(
      "create_booking_request" as never,
      {
        p_booking: {
          id: data.id,
          customer_name: data.customerName,
          // The table keeps one contact field; fall back to the phone for walk-ins.
          contact: data.email || data.phone,
          phone: data.phone,
          notes: data.notes ? `Added by owner. ${data.notes}` : "Added by owner.",
          service_id: data.serviceId,
          answers: {},
          quote: {
            low: data.price,
            high: data.price,
            duration: data.durationMinutes,
            deposit: data.status === "awaiting_deposit" ? deposit : 0,
            requiresReview: false,
            reviewReasons: [],
            lines: [{ label: "Set by owner", detail: `${data.durationMinutes} min` }],
          },
          appointment_date: data.date,
          appointment_time: data.time,
          member_id: data.memberId,
          flash_design_key: null,
          reference_paths: [],
          status: data.status,
        },
      } as never,
    );
    if (error)
      throw new Error(
        error.message.includes("no longer available")
          ? "That artist already has a booking at this time."
          : error.message.includes("Invalid booking slot")
            ? "Check the date (today or later), name and phone number."
            : "Could not save the booking. Please try again.",
      );

    let calendarAdded = false;
    if (data.status === "confirmed") {
      try {
        const { createAppointmentEvent } = await import("./google-calendar.server");
        await createAppointmentEvent({
          bookingId: data.id,
          summary: `${data.customerName} (${service.name})`,
          description: [
            `Artist: ${data.memberId}`,
            `Phone: ${data.phone}`,
            data.email ? `Email: ${data.email}` : "",
            "Added by owner",
          ]
            .filter(Boolean)
            .join("\n"),
          date: data.date,
          time: data.time,
          durationMinutes: data.durationMinutes,
        });
        calendarAdded = true;
      } catch (calendarError) {
        console.error(
          "Calendar event failed for owner booking",
          calendarError instanceof Error ? calendarError.message : calendarError,
        );
      }
    }

    let emailSent = false;
    if (data.notifyCustomer && data.email) {
      const { sendBookingEmail } = await import("./booking-emails.server");
      const result = await sendBookingEmail(data.id, data.status, "owner-created");
      emailSent = result.sent;
    }

    return { id: data.id, deposit, calendarAdded, emailSent };
  });
