import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncOwnerBookingCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => z.object({ id: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: owner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!owner) throw new Error("Owner access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking, error } = await supabaseAdmin
      .from("booking_requests")
      .select(
        "id,status,deposit_paid_at,appointment_date,appointment_time,customer_name,service_id,member_id,quote,contact,phone",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error || !booking) throw new Error("Booking not found");
    if (booking.status !== "confirmed" || !booking.deposit_paid_at)
      return { synced: true, action: "not-confirmed-or-paid" };
    const { updateAppointmentEvent } =
      await import("./google-calendar.server");
    await updateAppointmentEvent({
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
      durationMinutes: Number((booking.quote as { duration?: number } | null)?.duration ?? 60),
    });
    return { synced: true, action: "updated" };
  });
