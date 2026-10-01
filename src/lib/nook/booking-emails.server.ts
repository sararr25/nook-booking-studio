import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import type { BookingEmailKind } from "@/lib/email-templates/booking-update";
import { currentStudioName } from "@/lib/nook/studio-brand";
import { getRequest } from "@tanstack/react-start/server";

type QuoteShape = { low?: number; high?: number; deposit?: number; duration?: number };
type ConfigShape = {
  name?: string;
  location?: string;
  services?: { id: string; name: string }[];
  team?: { id: string; name: string }[];
  policies?: { currency?: string; depositDueHours?: number };
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours} hr` : "", rest ? `${rest} min` : ""].filter(Boolean).join(" ");
};

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
  const request = getRequest();
  const demoPaymentBaseUrl = request
    ? new URL(request.url).origin
    : (process.env["PUBLIC_SITE_URL"] ?? "http://localhost:8080");
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
  const pendingDeposit = booking.status === "awaiting_deposit" && !booking.deposit_paid_at;

  try {
    const result = await sendTemplateEmail("booking-update", email, {
      templateData: {
        kind,
        studioName: currentStudioName(config.name ?? settings?.business_name),
        customerName: booking.customer_name,
        date: booking.appointment_date,
        time: booking.appointment_time.slice(0, 5),
        priceRange: high > 0 ? `${money(low, currency)}–${money(high, currency)}` : "Free",
        serviceName: config.services?.find((item) => item.id === booking.service_id)?.name ?? "",
        artistName: config.team?.find((member) => member.id === booking.member_id)?.name ?? "",
        duration: quote.duration ? formatDuration(quote.duration) : "",
        location: config.location ?? "",
        deposit: deposit > 0 ? money(deposit, currency) : "",
        depositDueHours: config.policies?.depositDueHours ?? 24,
        pendingDeposit,
        paymentUrl:
          deposit > 0 && pendingDeposit
            ? `${demoPaymentBaseUrl}/api/public/payment-demo/${bookingId}`
            : "",
        reason: reason ?? "",
        nookLogoUrl: `${demoPaymentBaseUrl}/nook-logo-light.png`,
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
