export type DemoPaymentResult =
  | { paid: true; paidAt: string; calendarAdded: boolean; date: string; time: string }
  | { paid: false; reason: "cancelled" | "unknown" | "error" | "awaiting_approval" };

type QuoteShape = { deposit?: number; duration?: number };

async function addPaidBookingToCalendar(
  bookingId: string,
  booking: {
    appointment_date: string;
    appointment_time: string;
    customer_name: string;
    phone: string;
    contact: string;
    service_id: string;
    member_id: string;
    quote: unknown;
  },
): Promise<boolean> {
  try {
    const { createAppointmentEvent } = await import("./google-calendar.server");
    const quote = (booking.quote ?? {}) as QuoteShape;
    await createAppointmentEvent({
      bookingId,
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
    return true;
  } catch (calendarError) {
    console.error(
      "Calendar event failed after demo payment",
      calendarError instanceof Error ? calendarError.message : calendarError,
    );
    return false;
  }
}

/** Records the no-charge demo deposit and verifies the persisted row before reporting success. */
export async function recordDemoDepositPayment(bookingId: string): Promise<DemoPaymentResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const selection =
    "status, deposit_paid_at, appointment_date, appointment_time, customer_name, phone, contact, service_id, member_id, quote";
  const { data: booking, error: readError } = await supabaseAdmin
    .from("booking_requests")
    .select(selection)
    .eq("id", bookingId)
    .maybeSingle();

  if (readError) {
    console.error("Demo payment booking read failed", readError.message);
    return { paid: false, reason: "error" };
  }
  const deposit = Number((booking?.quote as QuoteShape | null)?.deposit ?? 0);
  if (!booking || deposit <= 0) return { paid: false, reason: "unknown" };
  if (booking.status === "declined") return { paid: false, reason: "cancelled" };
  if (booking.status === "pending") return { paid: false, reason: "awaiting_approval" };

  if (!booking.deposit_paid_at && booking.status === "awaiting_deposit") {
    const requestedPaidAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("booking_requests")
      .update({ status: "confirmed", deposit_paid_at: requestedPaidAt })
      .eq("id", bookingId)
      .eq("status", "awaiting_deposit")
      .is("deposit_paid_at", null);
    if (updateError) console.error("Demo payment update failed", updateError.message);
  }

  // Re-read after every attempt. The receipt must reflect persisted state, including concurrent clicks.
  const { data: saved, error: verifyError } = await supabaseAdmin
    .from("booking_requests")
    .select(selection)
    .eq("id", bookingId)
    .maybeSingle();
  if (verifyError) {
    console.error("Demo payment verification failed", verifyError.message);
    return { paid: false, reason: "error" };
  }
  if (!saved) return { paid: false, reason: "unknown" };
  if (saved.status === "declined") return { paid: false, reason: "cancelled" };
  if (saved.status === "pending") return { paid: false, reason: "awaiting_approval" };
  if (saved.status !== "confirmed" || !saved.deposit_paid_at) {
    return { paid: false, reason: "error" };
  }

  const calendarAdded = await addPaidBookingToCalendar(bookingId, saved);
  return {
    paid: true,
    paidAt: saved.deposit_paid_at,
    calendarAdded,
    date: saved.appointment_date,
    time: saved.appointment_time.slice(0, 5),
  };
}

/** Read-only receipt state for refreshes and direct visits after payment. */
export async function readDemoDepositPayment(bookingId: string): Promise<DemoPaymentResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: booking, error } = await supabaseAdmin
    .from("booking_requests")
    .select("status, deposit_paid_at, appointment_date, appointment_time, quote")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) return { paid: false, reason: "error" };
  const deposit = Number((booking?.quote as QuoteShape | null)?.deposit ?? 0);
  if (!booking || deposit <= 0) return { paid: false, reason: "unknown" };
  if (booking.status === "declined") return { paid: false, reason: "cancelled" };
  if (booking.status === "pending") return { paid: false, reason: "awaiting_approval" };
  if (booking.status !== "confirmed" || !booking.deposit_paid_at) {
    return { paid: false, reason: "error" };
  }
  return {
    paid: true,
    paidAt: booking.deposit_paid_at,
    calendarAdded: false,
    date: booking.appointment_date,
    time: booking.appointment_time.slice(0, 5),
  };
}