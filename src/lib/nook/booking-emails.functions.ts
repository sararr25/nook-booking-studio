import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendBookingEmail } from "./booking-emails.server";

// Public: called right after a customer submits. Recipient comes from the saved booking,
// and the idempotency key makes repeat calls harmless.
export const notifyNewBooking = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking } = await supabaseAdmin
      .from("booking_requests")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (!booking || booking.status === "declined") return { sent: false };
    const kind = booking.status === "awaiting_deposit"
      ? "awaiting_deposit"
      : booking.status === "confirmed"
        ? "confirmed"
        : "received";
    return sendBookingEmail(data.id, kind, "new");
  });

// Owner only: sent after an approval, decline or change.
export const notifyBookingChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["awaiting_deposit", "confirmed", "changed", "declined"]),
        reason: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Response("Forbidden", { status: 403 });
    return sendBookingEmail(data.id, data.kind, Date.now().toString(), data.reason);
  });

// Demo only: opening the email's payment link marks the deposit as paid.
// Booking IDs are random UUIDs, so only the emailed customer knows the link.
export const markDemoDepositPaid = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking } = await supabaseAdmin
      .from("booking_requests")
      .select(
        "status, deposit_paid_at, appointment_date, appointment_time, customer_name, phone, contact, service_id, member_id, quote",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!booking || Number((booking.quote as { deposit?: number } | null)?.deposit ?? 0) <= 0)
      return { paid: false as const, reason: "unknown" as const };
    // A cancelled booking can't be paid for; everything else with a deposit can.
    if (booking.status === "declined")
      return { paid: false as const, reason: "cancelled" as const };
    let paidAt = booking.deposit_paid_at;
    if (!paidAt) {
      paidAt = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from("booking_requests")
        .update({ status: "confirmed", deposit_paid_at: paidAt })
        .eq("id", data.id)
        .neq("status", "declined")
        .is("deposit_paid_at", null);
      const { data: latest } = await supabaseAdmin
        .from("booking_requests")
        .select("status,deposit_paid_at")
        .eq("id", data.id)
        .maybeSingle();
      if (error && !latest?.deposit_paid_at) return { paid: false as const, reason: "error" as const };
      if (!latest?.deposit_paid_at || latest.status === "declined")
        return { paid: false as const, reason: "cancelled" as const };
      paidAt = latest.deposit_paid_at;
    } else if (booking.status !== "confirmed") {
      // Already paid earlier: make sure the booking reflects that.
      await supabaseAdmin
        .from("booking_requests")
        .update({ status: "confirmed" })
        .eq("id", data.id)
        .neq("status", "declined");
    }
    // Paid bookings go into the studio's Google Calendar; the event id makes retries harmless.
    let calendarAdded = false;
    try {
      const { createAppointmentEvent } = await import("./google-calendar.server");
      const quote = (booking.quote ?? {}) as { duration?: number };
      await createAppointmentEvent({
        bookingId: data.id,
        summary: `${booking.customer_name} (${booking.service_id})`,
        description: [
          `Artist: ${booking.member_id || "unassigned"}`,
          `Email: ${booking.contact}`,
          `Phone: ${booking.phone}`,
          "Deposit paid",
        ].join("\n"),
        date: booking.appointment_date,
        time: booking.appointment_time.slice(0, 5),
        durationMinutes: quote.duration ?? 60,
      });
      calendarAdded = true;
    } catch (calendarError) {
      console.error(
        "Calendar event failed",
        calendarError instanceof Error ? calendarError.message : calendarError,
      );
    }
    return {
      paid: true as const,
      paidAt,
      calendarAdded,
      date: booking.appointment_date,
      time: booking.appointment_time.slice(0, 5),
    };
  });

// Public: busy times from the studio's Google Calendar, so customers can't book over them.
export const getCalendarBusy = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchBusyBlocks } = await import("./google-calendar.server");
  const now = new Date();
  const until = new Date(now.getTime() + 180 * 24 * 60 * 60_000);
  try {
    return {
      connected: true,
      blocks: await fetchBusyBlocks(now.toISOString(), until.toISOString()),
    };
  } catch (error) {
    console.error("Calendar busy read failed", error instanceof Error ? error.message : error);
    return { connected: false, blocks: [] };
  }
});
