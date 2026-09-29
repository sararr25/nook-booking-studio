import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import type { BookingEmailKind } from "@/lib/email-templates/booking-update";
import { currentStudioName } from "@/lib/nook/studio-brand";

type QuoteShape = { low?: number; high?: number; deposit?: number };
type ConfigShape = { name?: string; policies?: { currency?: string; depositDueHours?: number } };

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value,
  );

export async function sendBookingEmail(
  bookingId: string,
  kind: BookingEmailKind,
  eventKey: string,
  reason?: string,
) {
  const demoPaymentBaseUrl =
    process.env["PUBLIC_SITE_URL"] ??
    "https://id-preview--664e83fd-ad41-4b0f-9b00-51c7ba92a361.lovable.app";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: booking, error }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("booking_requests").select("*").eq("id", bookingId).maybeSingle(),
    supabaseAdmin
      .from("studio_settings")
      .select("config, currency, business_name")
      .eq("id", "main")
      .maybeSingle(),
  ]);
  if (error || !booking) return { sent: false as const };
  const email = booking.contact.trim();
  if (!email.includes("@")) return { sent: false as const };

  const config = (settings?.config ?? {}) as ConfigShape;
  const currency = config.policies?.currency ?? settings?.currency ?? "EUR";
  const quote = (booking.quote ?? {}) as QuoteShape;
  const low = quote.low ?? 0;
  const high = quote.high ?? 0;
  const deposit = quote.deposit ?? 0;

  try {
    const result = await sendTemplateEmail("booking-update", email, {
      templateData: {
        kind,
        studioName: currentStudioName(config.name ?? settings?.business_name),
        customerName: booking.customer_name,
        date: booking.appointment_date,
        time: booking.appointment_time.slice(0, 5),
        priceRange: high > 0 ? `${money(low, currency)} to ${money(high, currency)}` : "Free",
        deposit: deposit > 0 ? money(deposit, currency) : "",
        depositDueHours: config.policies?.depositDueHours ?? 24,
        paymentUrl:
          deposit > 0 && (kind === "confirmed" || kind === "changed")
            ? `${demoPaymentBaseUrl}/payment-demo/${bookingId}`
            : "",
        reason: reason ?? "",
      },
      idempotencyKey: `booking-${kind}-${bookingId}-${eventKey}`,
    });
    return { sent: result.sent };
  } catch (sendError) {
    console.error(
      "Booking email failed",
      sendError instanceof Error ? sendError.message : sendError,
    );
    return { sent: false as const };
  }
}
