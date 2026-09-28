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
