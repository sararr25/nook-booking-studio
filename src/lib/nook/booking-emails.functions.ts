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
    const { recordDemoDepositPayment } = await import("./payment-demo.server");
    return recordDemoDepositPayment(data.id);
  });

export const getDemoDepositStatus = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { readDemoDepositPayment } = await import("./payment-demo.server");
    return readDemoDepositPayment(data.id);
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
