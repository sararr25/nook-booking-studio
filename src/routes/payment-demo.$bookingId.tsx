import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CircleAlert, CircleCheck } from "lucide-react";
import { Wordmark } from "@/components/nook/wordmark";
import { markDemoDepositPaid } from "@/lib/nook/booking-emails.functions";

export const Route = createFileRoute("/payment-demo/$bookingId")({
  loader: ({ params }) => markDemoDepositPaid({ data: { id: params.bookingId } }),
  head: () => ({
    meta: [
      { title: "Deposit payment demo | Nook" },
      {
        name: "description",
        content: "Demo deposit payment for a Nook booking. No real money is taken.",
      },
      { property: "og:title", content: "Deposit payment demo | Nook" },
      {
        property: "og:description",
        content: "Demo deposit payment for a Nook booking. No real money is taken.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentDemoPage,
});

type PaymentState =
  | { kind: "paid"; date: string; time: string }
  | { kind: "failed"; reason: "cancelled" | "unknown" | "error" };

function PaymentDemoPage() {
  const { bookingId } = Route.useParams();
  const shortReference = bookingId.slice(0, 8).toUpperCase();
  const result = Route.useLoaderData();
  const state: PaymentState = result.paid
    ? { kind: "paid", date: result.date, time: result.time }
    : { kind: "failed", reason: result.reason };

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center justify-between border-b border-foreground pb-4">
          <Wordmark />
          <span className="eyebrow text-brand">Payment demo</span>
        </div>

        <section className="nook-ticket mt-8" aria-labelledby="payment-title" aria-live="polite">
          <div className="px-6 py-7 sm:px-8 sm:py-9">
            {state.kind === "paid" && (
              <CircleCheck className="size-7 text-highlight" aria-hidden="true" />
            )}
            {state.kind === "failed" && (
              <CircleAlert className="size-7 text-brand" aria-hidden="true" />
            )}
            <h1 id="payment-title" className="mt-5 text-balance text-4xl font-bold sm:text-5xl">
              {state.kind === "paid" && "Payment complete!"}
              {state.kind === "failed" &&
                (state.reason === "cancelled"
                  ? "This booking was cancelled"
                  : "We couldn't record this payment")}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              {state.kind === "paid" &&
                "Your deposit has been marked as paid and your appointment is confirmed. This is a demo, so no money was taken."}
              {state.kind === "failed" &&
                (state.reason === "cancelled"
                  ? "The studio cancelled this appointment, so no deposit is due. Please contact them to rebook."
                  : "This link doesn't match a booking with a deposit. Please contact the studio.")}
            </p>
          </div>

          <dl className="nook-perforation grid gap-3 px-6 py-6 text-sm sm:px-8">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Booking reference</dt>
              <dd className="font-mono font-medium">{shortReference}</dd>
            </div>
            {state.kind === "paid" && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Appointment</dt>
                <dd className="font-mono font-medium">
                  {state.date} at {state.time}
                </dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Payment status</dt>
              <dd className="font-mono font-medium text-brand">
                {state.kind === "paid" ? "Confirmed · paid (demo)" : "Not paid"}
              </dd>
            </div>
          </dl>
        </section>

        <Link
          to="/"
          className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Return to Nook
        </Link>
      </div>
    </main>
  );
}
