import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CreditCard, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/nook/wordmark";

export const Route = createFileRoute("/payment-demo/$bookingId")({
  head: () => ({
    meta: [
      { title: "Deposit payment demo | Nook" },
      {
        name: "description",
        content: "A non-functional preview of the Nook booking deposit payment experience.",
      },
      { property: "og:title", content: "Deposit payment demo | Nook" },
      {
        property: "og:description",
        content: "Preview the deposit payment step. No payment details are collected.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentDemoPage,
});

function PaymentDemoPage() {
  const { bookingId } = Route.useParams();
  const shortReference = bookingId.slice(0, 8).toUpperCase();

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center justify-between border-b border-foreground pb-4">
          <Wordmark />
          <span className="eyebrow text-brand">Payment demo</span>
        </div>

        <section className="nook-ticket mt-8" aria-labelledby="payment-title">
          <div className="px-6 py-7 sm:px-8 sm:py-9">
            <CreditCard className="size-7 text-brand" aria-hidden="true" />
            <h1 id="payment-title" className="mt-5 text-balance text-4xl font-bold sm:text-5xl">
              Secure your booking
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              This is a preview of the deposit checkout. It does not collect card details or take
              payment.
            </p>
          </div>

          <dl className="nook-perforation grid gap-3 px-6 py-6 text-sm sm:px-8">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Booking reference</dt>
              <dd className="font-mono font-medium">{shortReference}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Payment status</dt>
              <dd className="font-mono font-medium text-brand">Demo only</dd>
            </div>
          </dl>

          <div className="nook-perforation px-6 py-6 sm:px-8">
            <Button className="h-12 w-full" disabled>
              <LockKeyhole aria-hidden="true" />
              Payment unavailable in demo
            </Button>
            <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
              No payment information is requested or stored.
            </p>
          </div>
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
