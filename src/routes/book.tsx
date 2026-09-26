import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Camera, Check, Clock, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/nook/site-header";
import { MonthCalendar } from "@/components/nook/month-calendar";
import { useNook } from "@/lib/nook/store";
import {
  buildQuote,
  formatDuration,
  formatMoney,
  isAnswered,
  visibleQuestions,
} from "@/lib/nook/engine";
import type { Slot } from "@/lib/nook/engine";
import type { Answers, Question } from "@/lib/nook/types";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book a sitting — Ember & Thread on Nook" },
      {
        name: "description",
        content:
          "Answer a few questions about your piece, see a price range and sitting length, then pick from dates that fit.",
      },
      { property: "og:title", content: "Book a sitting — Ember & Thread" },
      {
        property: "og:description",
        content: "A short questionnaire, an honest quote, then real availability.",
      },
    ],
  }),
  component: BookingFlow,
});

const stepNames = ["Service", "Details", "Quote", "Time", "You"];

function BookingFlow() {
  const { business, requests, addRequest } = useNook();
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(business.services[0].id);
  const [answers, setAnswers] = useState<Answers>({});
  const [selected, setSelected] = useState<{ date: string; slot: Slot } | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState<null | { pending: boolean; date: string; time: string; who: string }>(null);

  const service = business.services.find((s) => s.id === serviceId) ?? business.services[0];
  const questions = useMemo(() => visibleQuestions(service, answers), [service, answers]);
  const quote = useMemo(() => buildQuote(business, service, answers), [business, service, answers]);

  const booked = useMemo(
    () =>
      requests
        .filter((r) => r.status !== "declined")
        .map((r) => ({ date: r.date, time: r.time, memberId: r.memberId })),
    [requests],
  );

  const allAnswered = questions.every((q) => isAnswered(q, answers));

  const setAnswer = (id: string, value: Answers[string]) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const toggleMulti = (id: string, optionId: string) =>
    setAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      return {
        ...prev,
        [id]: current.includes(optionId)
          ? current.filter((v) => v !== optionId)
          : [...current, optionId],
      };
    });

  const submit = () => {
    if (!selected || !name.trim() || !contact.trim()) {
      toast.error("Add your name and a way to reach you.");
      return;
    }
    const pending = quote.requiresReview;
    addRequest({
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customerName: name.trim(),
      contact: contact.trim(),
      notes: notes.trim(),
      serviceId: service.id,
      answers,
      date: selected.date,
      time: selected.slot.time,
      memberId: selected.slot.memberId,
      status: pending ? "pending" : "confirmed",
      quote: {
        low: quote.low,
        high: quote.high,
        duration: quote.duration,
        deposit: quote.deposit,
        requiresReview: quote.requiresReview,
        reviewReasons: quote.reviewReasons,
        lines: quote.lines,
      },
    });
    setDone({
      pending,
      date: selected.date,
      time: selected.slot.time,
      who: selected.slot.memberName,
    });
  };

  if (done) return <Confirmation done={done} />;

  const canContinue =
    (step === 0 && Boolean(service)) ||
    (step === 1 && allAnswered) ||
    step === 2 ||
    (step === 3 && Boolean(selected)) ||
    step === 4;

  return (
    <div className="min-h-screen pb-28">
      <SiteHeader />

      <div className="mx-auto w-full max-w-5xl px-5 pt-8">
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {stepNames.map((label, i) => (
            <li key={label} className="flex items-center gap-3">
              <span
                className={cn(
                  "transition-colors",
                  i === step ? "font-semibold text-brand" : i < step ? "text-foreground/70" : "text-muted-foreground/60",
                )}
              >
                {String(i + 1).padStart(2, "0")} {label}
              </span>
              {i < stepNames.length - 1 && <span className="text-muted-foreground/40">—</span>}
            </li>
          ))}
        </ol>
      </div>

      <main className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div>
          {step === 0 && (
            <section>
              <h1 className="display text-3xl sm:text-4xl">What are you booking?</h1>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                {business.tagline}
              </p>
              <div className="mt-8 divide-y divide-border border-y border-border">
                {business.services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setServiceId(s.id);
                      setAnswers({});
                      setSelected(null);
                    }}
                    className={cn(
                      "flex w-full items-start gap-4 py-5 text-left transition-colors hover:bg-sand/50",
                      serviceId === s.id && "bg-sand/60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border",
                        serviceId === s.id ? "border-brand bg-brand text-brand-foreground" : "border-border",
                      )}
                    >
                      {serviceId === s.id && <Check className="size-3" />}
                    </span>
                    <span className="flex-1">
                      <span className="display block text-lg">{s.name}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{s.blurb}</span>
                    </span>
                    <span className="hidden shrink-0 text-right text-sm sm:block">
                      <span className="block font-medium">
                        {s.basePrice === 0 ? "Free" : `from ${formatMoney(s.basePrice, business.policies.currency)}`}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDuration(s.baseDuration)}+
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h1 className="display text-3xl sm:text-4xl">Tell us about the piece</h1>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                Each answer updates the estimate on the right. Nothing here is binding.
              </p>
              <div className="mt-8 space-y-10">
                {questions.map((q, i) => (
                  <QuestionBlock
                    key={q.id}
                    index={i + 1}
                    question={q}
                    answers={answers}
                    onSet={setAnswer}
                    onToggle={toggleMulti}
                  />
                ))}
              </div>
            </section>
          )}

          {step === 2 && <QuoteStep quote={quote} currency={business.policies.currency} service={service} />}

          {step === 3 && (
            <section>
              <h1 className="display text-3xl sm:text-4xl">Pick a date</h1>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                Showing days with a free {formatDuration(quote.duration)} block for{" "}
                {quote.eligibleTeam.length === business.team.length
                  ? "the studio"
                  : quote.eligibleTeam.map((m) => m.name.split(" ")[0]).join(" or ") || "no one yet"}
                . Earliest is {business.policies.leadTimeDays} days out.
              </p>
              <div className="mt-8">
                {quote.eligibleTeam.length === 0 ? (
                  <p className="rounded-sm border border-border bg-sand/60 p-5 text-sm">
                    Nobody in the studio matches this combination right now. Continue anyway and Ines
                    will come back to you with options.
                  </p>
                ) : (
                  <MonthCalendar
                    business={business}
                    eligibleTeam={quote.eligibleTeam}
                    duration={quote.duration}
                    booked={booked}
                    selected={selected}
                    onSelect={setSelected}
                  />
                )}
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <h1 className="display text-3xl sm:text-4xl">Almost there</h1>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                {quote.requiresReview
                  ? business.policies.reviewNote
                  : "This one fits the studio's standard rules, so it confirms straight away."}
              </p>

              <div className="mt-8 max-w-md space-y-5">
                <Field label="Your name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nadia Berg"
                    className="min-h-11 w-full rounded-sm border border-border bg-card px-3 text-sm outline-none focus:border-brand"
                  />
                </Field>
                <Field label="Email or phone">
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="you@email.com"
                    className="min-h-11 w-full rounded-sm border border-border bg-card px-3 text-sm outline-none focus:border-brand"
                  />
                </Field>
                <Field label="Anything else" optional>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Allergies, timing, questions…"
                    className="w-full rounded-sm border border-border bg-card p-3 text-sm outline-none focus:border-brand"
                  />
                </Field>

                {quote.requiresPhotos && (
                  <div className="flex items-start gap-3 rounded-sm border border-brand/40 bg-brand-soft/40 p-4 text-sm">
                    <Camera className="mt-0.5 size-4 shrink-0 text-brand" />
                    <p>
                      Reference photos are required for this one. We&apos;ll email you a link to upload
                      them right after booking.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-24">
          <SummaryPanel
            quote={quote}
            currency={business.policies.currency}
            serviceName={service.name}
            selected={selected}
          />
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {service.basePrice === 0
                ? "Free consultation"
                : `${formatMoney(quote.low, business.policies.currency)}–${formatMoney(quote.high, business.policies.currency)}`}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {formatDuration(quote.duration)}
              {quote.requiresReview ? " · needs a quick review" : " · confirms instantly"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm transition-colors hover:bg-secondary"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => (step === 4 ? submit() : setStep((s) => s + 1))}
              className="flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand disabled:cursor-not-allowed disabled:opacity-40"
            >
              {step === 4 ? (quote.requiresReview ? "Send request" : "Confirm booking") : "Continue"}
              {step < 4 && <ArrowRight className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">
        {label}
        {optional && <span className="ml-2 normal-case tracking-normal">optional</span>}
      </span>
      {children}
    </label>
  );
}

function QuestionBlock({
  index,
  question,
  answers,
  onSet,
  onToggle,
}: {
  index: number;
  question: Question;
  answers: Answers;
  onSet: (id: string, value: Answers[string]) => void;
  onToggle: (id: string, optionId: string) => void;
}) {
  const value = answers[question.id];

  return (
    <div>
      <div className="flex gap-3">
        <span className="display mt-0.5 text-sm text-brand">{String(index).padStart(2, "0")}</span>
        <div className="flex-1">
          <h2 className="text-base font-semibold">{question.label}</h2>
          {question.help && <p className="mt-1 text-sm text-muted-foreground">{question.help}</p>}

          <div className="mt-4">
            {question.type === "scale" && (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="display text-4xl">
                    {typeof value === "number" ? value : (question.min ?? 0)}
                  </span>
                  <span className="text-sm text-muted-foreground">{question.unit}</span>
                </div>
                <input
                  type="range"
                  min={question.min}
                  max={question.max}
                  step={question.step}
                  value={typeof value === "number" ? value : (question.min ?? 0)}
                  onChange={(e) => onSet(question.id, Number(e.target.value))}
                  className="mt-3 h-11 w-full max-w-sm accent-[var(--brand)]"
                  aria-label={question.label}
                />
              </div>
            )}

            {question.type === "text" && (
              <textarea
                rows={3}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onSet(question.id, e.target.value)}
                placeholder="A few words is plenty"
                className="w-full max-w-lg rounded-sm border border-border bg-card p-3 text-sm outline-none focus:border-brand"
              />
            )}

            {(question.type === "single" || question.type === "boolean" || question.type === "multi") && (
              <div className="flex flex-wrap gap-2">
                {question.options?.map((option) => {
                  const active =
                    question.type === "multi"
                      ? Array.isArray(value) && value.includes(option.id)
                      : value === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        question.type === "multi"
                          ? onToggle(question.id, option.id)
                          : onSet(question.id, option.id)
                      }
                      className={cn(
                        "min-h-11 rounded-sm border px-4 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "border-brand bg-brand-soft/60"
                          : "border-border bg-card hover:border-foreground/30",
                      )}
                    >
                      <span className="block font-medium">{option.label}</span>
                      {option.hint && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuoteStep({
  quote,
  currency,
  service,
}: {
  quote: ReturnType<typeof buildQuote>;
  currency: string;
  service: { name: string; depositPercent: number };
}) {
  return (
    <section>
      <p className="eyebrow">Estimate</p>
      <h1 className="display mt-3 text-4xl sm:text-5xl">
        {quote.high === 0 ? (
          "No charge"
        ) : (
          <>
            {formatMoney(quote.low, currency)}
            <span className="text-muted-foreground"> – </span>
            {formatMoney(quote.high, currency)}
          </>
        )}
      </h1>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" /> {formatDuration(quote.duration)} in the chair
        </span>
        {quote.deposit > 0 && (
          <span>
            {formatMoney(quote.deposit, currency)} deposit ({service.depositPercent}%)
          </span>
        )}
      </p>

      <div className="mt-8 border-y border-border">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {quote.lines.map((line, i) => (
              <tr key={`${line.label}-${i}`}>
                <td className="py-3 pr-4">{line.label}</td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">{line.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-border bg-card p-5">
          <p className="eyebrow">Who can take it</p>
          {quote.eligibleTeam.length === 0 ? (
            <p className="mt-2 text-sm">No one yet — Ines will find a way.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {quote.eligibleTeam.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  <span className="flex size-7 items-center justify-center rounded-full bg-sand text-[11px] font-semibold">
                    {m.initials}
                  </span>
                  <span>
                    <span className="font-medium">{m.name}</span>
                    <span className="block text-xs text-muted-foreground">{m.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className={cn(
            "rounded-sm border p-5",
            quote.requiresReview ? "border-brand/50 bg-brand-soft/40" : "border-border bg-card",
          )}
        >
          <p className="eyebrow">Approval</p>
          {quote.requiresReview ? (
            <>
              <p className="mt-2 text-sm font-medium">Goes to Ines for a quick look</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground/75">
                {quote.reviewReasons.map((r) => (
                  <li key={r}>— {r}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm">
              Standard request. Pick a time and it confirms on the spot.
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        The final price is set at the studio once we see the design. The range above is what {service.name.toLowerCase()}s
        like yours normally come to.
      </p>
    </section>
  );
}

function SummaryPanel({
  quote,
  currency,
  serviceName,
  selected,
}: {
  quote: ReturnType<typeof buildQuote>;
  currency: string;
  serviceName: string;
  selected: { date: string; slot: Slot } | null;
}) {
  return (
    <div className="rounded-sm border border-border bg-card p-5">
      <p className="eyebrow">Running estimate</p>
      <p className="display mt-2 text-2xl">
        {quote.high === 0
          ? "Free"
          : `${formatMoney(quote.low, currency)}–${formatMoney(quote.high, currency)}`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {serviceName} · {formatDuration(quote.duration)}
      </p>

      <dl className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">Artists</dt>
          <dd className="text-right">
            {quote.eligibleTeam.length === 0
              ? "—"
              : quote.eligibleTeam.map((m) => m.name.split(" ")[0]).join(", ")}
          </dd>
        </div>
        {quote.deposit > 0 && (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">Deposit</dt>
            <dd>{formatMoney(quote.deposit, currency)}</dd>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">Approval</dt>
          <dd className="text-right">{quote.requiresReview ? "Owner review" : "Instant"}</dd>
        </div>
        {selected && (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">Slot</dt>
            <dd className="text-right">
              {new Date(`${selected.date}T00:00:00`).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}{" "}
              · {selected.slot.time}
            </dd>
          </div>
        )}
      </dl>

      {quote.requiresPhotos && (
        <p className="mt-5 flex items-start gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
          <Camera className="mt-0.5 size-3.5 shrink-0" /> Reference photos required
        </p>
      )}
    </div>
  );
}

function Confirmation({
  done,
}: {
  done: { pending: boolean; date: string; time: string; who: string };
}) {
  const pretty = new Date(`${done.date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-20">
        <p className="eyebrow">{done.pending ? "Request sent" : "Booked"}</p>
        <h1 className="display mt-4 text-4xl sm:text-5xl">
          {done.pending ? "Ines will come back to you." : "You're in the book."}
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          {done.pending
            ? "We've held this slot while your request is reviewed — usually within a day. You'll get an email either way."
            : "A confirmation is on its way, along with aftercare notes and how to find the studio."}
        </p>

        <dl className="mt-10 divide-y divide-border border-y border-border text-sm">
          <div className="flex justify-between gap-4 py-4">
            <dt className="text-muted-foreground">When</dt>
            <dd className="text-right font-medium">
              {pretty} at {done.time}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-4">
            <dt className="text-muted-foreground">With</dt>
            <dd className="flex items-center gap-2 text-right font-medium">
              <UserRound className="size-4 text-muted-foreground" />
              {done.who}
            </dd>
          </div>
        </dl>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/owner"
            className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand"
          >
            See it on the owner side
          </Link>
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm transition-colors hover:bg-secondary"
          >
            Back home
          </Link>
        </div>
      </main>
    </div>
  );
}
