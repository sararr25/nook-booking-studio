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
    const kind = booking.status === "confirmed" ? "confirmed" : "received";
    return sendBookingEmail(data.id, kind, "new");
  });

// Owner only: sent after an approval, decline or change.
export const notifyBookingChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ id: z.string().uuid(), kind: z.enum(["confirmed", "changed", "declined"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Response("Forbidden", { status: 403 });
    return sendBookingEmail(data.id, data.kind, Date.now().toString());
  });

// Demo only: opening the email's payment link marks the deposit as paid.
// Booking IDs are random UUIDs, so only the emailed customer knows the link.
export const markDemoDepositPaid = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking } = await supabaseAdmin
      .from("booking_requests")
      .select("status, deposit_paid_at, appointment_date, appointment_time")
      .eq("id", data.id)
      .maybeSingle();
    if (!booking || booking.status !== "confirmed") return { paid: false as const };
    let paidAt = booking.deposit_paid_at;
    if (!paidAt) {
      paidAt = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from("booking_requests")
        .update({ deposit_paid_at: paidAt })
        .eq("id", data.id);
      if (error) return { paid: false as const };
    }
    return {
      paid: true as const,
      paidAt,
      date: booking.appointment_date,
      time: booking.appointment_time.slice(0, 5),
    };
  });
