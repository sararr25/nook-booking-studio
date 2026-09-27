import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/nook/site-header";
import { NookProvider, useNook } from "@/lib/nook/store";
import { tradeDemos } from "@/lib/nook/config";
import { BookingTicket } from "@/components/nook/booking-ticket";
import { Wordmark } from "@/components/nook/wordmark";
import { cn } from "@/lib/utils";
import studioImage from "@/assets/studio.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nook: booking that asks the right questions" },
      {
        name: "description",
        content:
          "Nook quotes and schedules jobs where price, duration and the right person depend on the details. Built for studios, groomers, photographers and trades.",
      },
      { property: "og:title", content: "Nook: booking that asks the right questions" },
      {
        property: "og:description",
        content:
          "A short adaptive questionnaire, a real quote, then only the dates that actually work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <NookProvider>
      <Landing />
    </NookProvider>
  );
}

function Landing() {
  const { business } = useNook();

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-12 sm:pt-16 lg:pb-20">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="eyebrow">Booking, for work that varies</p>
              <h1 className="display mt-5 max-w-[14ch] text-balance text-[2.75rem] sm:text-6xl lg:text-7xl">
                Some jobs can&apos;t be booked from a{" "}
                <span className="text-brand">
                  <span className="whitespace-nowrap">drop-down</span> menu.
                </span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Nook asks the few questions that change the price, the length and who does the job,
                then shows only the dates that fit.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/book"
                  className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-ink px-6 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand"
                >
                  Try the demo booking
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/owner"
                  className="inline-flex min-h-12 items-center justify-center rounded-sm border border-foreground px-6 text-sm font-medium transition-colors hover:bg-card"
                >
                  See the owner side
                </Link>
              </div>
            </div>

            <figure>
              <img
                src={studioImage}
                alt={`A quiet corner of the ${business.name} studio`}
                className="aspect-4/5 w-full rounded-sm border border-foreground object-cover"
              />
              <figcaption className="mt-3 text-xs text-muted-foreground">
                The demo runs on {business.name}, a {business.archetype.toLowerCase()} at{" "}
                {business.location}.
              </figcaption>
            </figure>
          </div>
        </section>

        <TradeDemoSection />

        <footer className="border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <Wordmark className="text-lg text-foreground" />
            <span>Booking for work that needs a little context.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function TradeDemoSection() {
  const [tradeId, setTradeId] = useState(tradeDemos[0]?.id ?? "");
  const [optionIndex, setOptionIndex] = useState(0);
  const trade = tradeDemos.find((t) => t.id === tradeId) ?? tradeDemos[0];
  if (!trade) return null;
  const option = trade.options[optionIndex] ?? trade.options[0];
  if (!option) return null;

  return (
    <section className="bg-ink text-brand-foreground">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:py-20 lg:grid-cols-[1fr_22rem] lg:gap-16">
        <div className="min-w-0">
          <h2 className="display text-3xl sm:text-5xl">One engine, any trade.</h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-brand-foreground/70 sm:text-base">
            Pick a business and an answer. Each owner decides what their answers do to the price,
            the time and who takes the job.
          </p>

          <div
            role="tablist"
            aria-label="Example businesses"
            className="mt-10 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
          >
            {tradeDemos.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === trade.id}
                onClick={() => {
                  setTradeId(t.id);
                  setOptionIndex(0);
                }}
                className={cn(
                  "min-h-10 shrink-0 rounded-sm border px-4 text-sm transition-colors",
                  t.id === trade.id
                    ? "border-brand-foreground bg-brand-foreground text-ink"
                    : "border-brand-foreground/25 text-brand-foreground/75 hover:border-brand-foreground hover:text-brand-foreground",
                )}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="mt-10 border-t border-brand-foreground/20 pt-8" role="tabpanel">
            <p className="font-display text-xl font-semibold sm:text-2xl">{trade.question}</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {trade.options.map((o, i) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={i === optionIndex}
                  onClick={() => setOptionIndex(i)}
                  className={cn(
                    "min-h-14 rounded-sm border px-4 py-3 text-left text-sm transition-[border-color,box-shadow]",
                    i === optionIndex
                      ? "border-brand-foreground shadow-[3px_3px_0_var(--brand)]"
                      : "border-brand-foreground/25 hover:border-brand-foreground/70",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-brand-foreground/70">
              Answers <ArrowRight className="size-3.5" /> price, length and person{" "}
              <ArrowRight className="size-3.5" /> only the dates that fit
            </p>
          </div>
        </div>

        {/* The notch cut-outs of the ticket take the band colour. */}
        <div className="text-foreground [--background:var(--ink)]">
          <BookingTicket
            key={`${trade.id}-${optionIndex}`}
            heading={`Example: ${trade.name.toLowerCase()}`}
            title={option.label}
            price={option.price}
            rows={[
              { label: "Length", value: option.length },
              { label: "With", value: option.who },
            ]}
            review={option.review}
            note={option.note}
          />
          <p className="mt-4 text-xs text-brand-foreground/60">
            Example rules. Every business sets its own.
          </p>
        </div>
      </div>
    </section>
  );
}
