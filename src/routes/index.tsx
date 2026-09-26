import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/nook/site-header";
import { NookProvider, useNook } from "@/lib/nook/store";
import { otherArchetypes } from "@/lib/nook/config";
import studioImage from "@/assets/studio.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nook — booking that asks the right questions" },
      {
        name: "description",
        content:
          "Nook quotes and schedules jobs where price, duration and the right person depend on the details. Built for studios, groomers, photographers and trades.",
      },
      { property: "og:title", content: "Nook — booking that asks the right questions" },
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
  return <NookProvider><Landing /></NookProvider>;
}

const steps = [
  {
    n: "01",
    title: "A few questions",
    body: "Six at most, and they change as you answer. Size, placement, whether it covers old work.",
  },
  {
    n: "02",
    title: "A real price range",
    body: "Every answer shows its effect on the quote and the length of the sitting. No mystery line items.",
  },
  {
    n: "03",
    title: "Only dates that work",
    body: "The calendar shows the artists qualified for your job, with enough room in the day for it.",
  },
];

function Landing() {
  const { business } = useNook();

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="mx-auto w-full max-w-5xl px-5 pb-16 pt-14 sm:pt-20">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="eyebrow">Booking, for work that varies</p>
              <h1 className="display mt-5 text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-7xl">
                Some jobs can&apos;t be
                <br />
                booked from a
                <br />
                <span className="text-brand italic">drop-down menu.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Nook asks the handful of questions that actually change the price, the length and the
                person doing the work — then shows you the dates that survive all three.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/book"
                  className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand"
                >
                  Book at {business.name}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/owner"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  See the owner side
                </Link>
              </div>
            </div>

            <figure className="relative">
              <img
                src={studioImage}
                alt="A quiet corner of the Ember & Thread studio"
                className="aspect-4/5 w-full rounded-sm object-cover"
              />
              <figcaption className="mt-3 text-xs text-muted-foreground">
                Demo business — {business.name}, {business.location}. A {business.archetype.toLowerCase()}.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="border-y border-border bg-sand/60">
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-14 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n}>
                <span className="display text-3xl text-brand">{step.n}</span>
                <h2 className="mt-3 text-base font-semibold">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 py-16">
          <div className="max-w-xl">
            <p className="eyebrow">Same engine, different trade</p>
            <h2 className="display mt-4 text-3xl sm:text-4xl">
              The questions change. The logic doesn&apos;t.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A studio owner writes their own questions and decides what each answer does to price,
              time, required skills and whether it needs a human look.
            </p>
          </div>

          <ul className="mt-10 divide-y divide-border border-y border-border">
            {otherArchetypes.map((item) => (
              <li key={item.name} className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr_1fr] sm:gap-6">
                <span className="text-sm font-semibold">{item.name}</span>
                <span className="text-sm text-muted-foreground">{item.question}</span>
                <span className="text-sm text-foreground/80">{item.effect}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="border-t border-border">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-5 py-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="display text-base text-foreground">Nook</span>
            <span>Thoughtful booking for work that needs a little context.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
