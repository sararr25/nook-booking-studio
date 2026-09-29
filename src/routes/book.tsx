import { notifyNewBooking } from "@/lib/nook/booking-emails.functions";
import { getAvailableSlots } from "@/lib/nook/availability.functions";
import { submitBooking } from "@/lib/nook/submit-booking.functions";
import { loadFlashDesigns, type FlashDesign } from "@/lib/nook/flash";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Clock,
  ExternalLink,
  ImagePlus,
  Plus,
  Star,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/nook/site-header";
import { MonthCalendar } from "@/components/nook/month-calendar";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookingTicket } from "@/components/nook/booking-ticket";
import { Wordmark } from "@/components/nook/wordmark";
import { NookProvider, useNook } from "@/lib/nook/store";
import {
  buildQuote,
  describeOptionEffect,
  formatDuration,
  formatMoney,
  isAnswered,
  recommendArtist,
  visibleQuestions,
} from "@/lib/nook/engine";
import type { Slot } from "@/lib/nook/engine";
import type { Answers, BookingRequest, Question, TeamMember } from "@/lib/nook/types";
import { artistImage } from "@/lib/nook/artist-images";
import { supabase } from "@/integrations/supabase/client";
import botanical from "@/assets/flash-botanical.jpg";
import moth from "@/assets/flash-moth.jpg";
import swallow from "@/assets/flash-swallow.jpg";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book a sitting | Stillroom Tattoo on Nook" },
      {
        name: "description",
        content:
          "Answer a few questions about your piece, see a price range and sitting length, then pick from dates that fit.",
      },
      { property: "og:title", content: "Book a sitting | Stillroom Tattoo" },
      {
        property: "og:description",
        content: "A short questionnaire, an honest quote, then real availability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingPage,
});

function BookingPage() {
  return (
    <NookProvider>
      <BookingFlow />
    </NookProvider>
  );
}

const stepNames = ["Service", "Details", "Quote", "Date & time", "Your details"];

function BookingFlow() {
  const { business, addRequest } = useNook();
  const fetchAvailable = useServerFn(getAvailableSlots);
  const submitOnServer = useServerFn(submitBooking);
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(business.services[0]?.id ?? "tattoo");
  const [answers, setAnswers] = useState<Answers>({});
  const [selected, setSelected] = useState<{ date: string; slot: Slot } | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flashDesignId, setFlashDesignId] = useState<string | undefined>();
  const flashQuery = useQuery({
    queryKey: ["booking-flash"],
    queryFn: loadFlashDesigns,
    enabled: serviceId === "flash",
  });
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [artistChoice, setArtistChoice] = useState<string>("auto");
  const [done, setDone] = useState<null | {
    reviewPending: boolean;
    awaitingDeposit: boolean;
    terms: string[];
    date: string;
    time: string;
    who: string;
    id: string;
    emailSent: boolean;
  }>(null);

  const service = business.services.find((s) => s.id === serviceId) ?? business.services[0];
  const questions = service ? visibleQuestions(service, answers) : [];
  const flashDesign = flashQuery.data?.find((d) => d.id === flashDesignId && d.available);
  const pricedService =
    service && flashDesign
      ? { ...service, basePrice: flashDesign.price, baseDuration: flashDesign.duration_minutes }
      : service;
  const quote = pricedService ? buildQuote(business, pricedService, answers) : null;
  const needsReview = Boolean(quote?.requiresReview || quote?.eligibleTeam.length === 0);
  const slotsQuery = useQuery({
    queryKey: ["available-slots", serviceId, answers, artistChoice, flashDesignId],
    queryFn: () =>
      fetchAvailable({
        data: {
          serviceId,
          answers,
          ...(artistChoice !== "auto" ? { artistId: artistChoice } : {}),
          ...(flashDesignId ? { flashId: flashDesignId } : {}),
        },
      }),
    enabled: step >= 3 && (quote?.eligibleTeam.length ?? 0) > 0,
    staleTime: 30_000,
  });
  if (!service) return <div className="p-8">No services are available.</div>;
  if (!quote) return <div className="p-8">No quote is available.</div>;
  const recommendation = recommendArtist(quote);
  const chosenMember =
    artistChoice === "auto"
      ? recommendation?.member
      : (quote.eligibleTeam.find((m) => m.id === artistChoice) ?? recommendation?.member);
  const chooseArtist = (id: string) => {
    setArtistChoice(id);
    setSelected(null);
  };

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

  const submit = async () => {
    if (submitting) return;
    setAttempted(true);
    if (!selected || !name.trim() || !/^\S+@\S+\.\S+$/.test(contact.trim())) {
      return;
    }
    if (phone.replace(/[^0-9]/g, "").length < 6) {
      return;
    }
    setSubmitting(true);
    try {
      const pending = needsReview;
      const requestId = crypto.randomUUID();
      const uploadedPaths: string[] = [];
      for (const file of referenceFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${requestId}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from("booking-references").upload(path, file);
        if (error) {
          toast.error(`Could not upload ${file.name}`);
          return;
        }
        uploadedPaths.push(path);
      }
      const request: BookingRequest = {
        id: requestId,
        createdAt: new Date().toISOString(),
        customerName: name.trim(),
        contact: contact.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        serviceId: service.id,
        answers,
        date: selected.date,
        time: selected.slot.time,
        memberId: selected.slot.memberId,
        ...(flashDesignId ? { flashDesignId } : {}),
        referencePaths: uploadedPaths,
        status: pending ? "pending" : quote.deposit > 0 ? "awaiting_deposit" : "confirmed",
        quote: {
          low: quote.low,
          high: quote.high,
          duration: quote.duration,
          deposit: quote.deposit,
          requiresReview: quote.requiresReview,
          reviewReasons: quote.reviewReasons,
          lines: quote.lines,
        },
      };
      let saved;
      try {
        saved = await submitOnServer({
          data: {
            id: request.id,
            customerName: request.customerName,
            contact: request.contact,
            phone: request.phone ?? "",
            notes: request.notes,
            serviceId: request.serviceId,
            answers: request.answers,
            date: request.date,
            time: request.time,
            memberId: request.memberId,
            ...(request.flashDesignId ? { flashDesignId: request.flashDesignId } : {}),
            referencePaths: uploadedPaths,
            quotedLow: request.quote.low,
            quotedHigh: request.quote.high,
            quotedDuration: request.quote.duration,
          },
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save your booking");
        void slotsQuery.refetch();
        return;
      }
      addRequest({ ...request, status: saved.status });
      let emailSent = false;
      try {
        emailSent = (await notifyNewBooking({ data: { id: request.id } })).sent;
      } catch {
        emailSent = false;
      }
      setDone({
        id: request.id,
        emailSent,
        reviewPending: saved.status === "pending",
        awaitingDeposit: saved.status === "awaiting_deposit",
        terms: bookingTerms({
          free: quote.high === 0,
          review: saved.status === "pending",
          deposit: formatMoney(quote.deposit, business.policies.currency),
          depositPercent: service.depositPercent,
          depositDueHours: business.policies.depositDueHours,
        }),
        date: selected.date,
        time: selected.slot.time,
        who: selected.slot.memberName,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return <Confirmation done={done} />;

  const needsFlashPick = service.id === "flash" && !flashDesign;
  const canContinue =
    (step === 0 && Boolean(service)) ||
    (step === 1 && allAnswered && !needsFlashPick) ||
    step === 2 ||
    (step === 3 &&
      Boolean(selected) &&
      (quote.eligibleTeam.length === 0 || slotsQuery.data?.connected === true)) ||
    (step === 4 && (!quote.requiresPhotos || referenceFiles.length > 0));

  const blockedReason = canContinue
    ? null
    : step === 1
      ? needsFlashPick
        ? "Pick a flash design to continue."
        : "Answer the question above to continue."
      : step === 3
        ? "Pick a date and time to continue."
        : step === 4 && quote.requiresPhotos && referenceFiles.length === 0
          ? "Add at least one reference photo to continue."
          : null;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col border-x border-border bg-card">
        <BookingHeader step={step} onBack={() => setStep((current) => Math.max(0, current - 1))} />
        {/* Content row stretches so the action bar sits at the bottom even on short steps. */}
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[1fr_auto] lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div
            className={cn(
              "nook-enter min-w-0 overflow-hidden px-5 pb-10 pt-8 sm:px-10 sm:pt-12 lg:min-h-[38rem] lg:px-12",
              service.id === "flash" && "max-[359px]:px-4 max-[359px]:pt-6",
            )}
            key={step}
          >
            {step === 0 && (
              <section>
                <h1 className="display nook-title max-w-xl text-balance text-3xl sm:text-4xl lg:text-5xl">
                  What would you like to book?
                </h1>
                <p className="mt-3 max-w-lg text-sm text-muted-foreground">{business.tagline}</p>
                <div className="nook-stagger mt-9 grid gap-3 sm:grid-cols-3">
                  {business.services.map((s) => (
                    <Button
                      variant="ghost"
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setServiceId(s.id);
                        setAnswers({});
                        setSelected(null);
                        setArtistChoice("auto");
                      }}
                      className={cn(
                        "nook-choice nook-lift flex h-auto min-h-52 w-full flex-col items-start justify-between whitespace-normal border border-border p-5 text-left",
                        serviceId === s.id && "nook-selected",
                      )}
                      aria-pressed={serviceId === s.id}
                    >
                      <span className="flex w-full items-start justify-between gap-3">
                        <span className="block font-display text-xl font-semibold">{s.name}</span>
                        {serviceId === s.id && (
                          <Check className="nook-pop size-4 shrink-0 text-brand" />
                        )}
                      </span>
                      <span className="mt-2 flex-1">
                        <span className="mt-1 block text-sm text-muted-foreground">{s.blurb}</span>
                      </span>
                      <span className="mt-5 block shrink-0 text-sm">
                        <span className="block font-mono font-medium tabular-nums">
                          {s.basePrice === 0
                            ? "Free"
                            : `from ${formatMoney(s.basePrice, business.policies.currency)}`}
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {formatDuration(s.baseDuration)}+
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
              </section>
            )}

            {step === 1 && (
              <section>
                <h1 className="display nook-title max-w-xl text-balance text-3xl sm:text-4xl lg:text-5xl">
                  {service.id === "flash"
                    ? "Choose your flash and details"
                    : service.id === "consultation"
                      ? "Tell us what you have in mind"
                      : "Tell us about your piece"}
                </h1>
                <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                  This helps us estimate time and price.
                </p>
                {service.id === "flash" && (
                  <FlashPicker
                    designs={flashQuery.data ?? []}
                    currency={business.policies.currency}
                    selected={flashDesignId}
                    onSelect={setFlashDesignId}
                  />
                )}
                {service.id === "tattoo" && (
                  <div className="mt-8 max-w-2xl">
                    <h2 className="text-base font-semibold">
                      Reference pictures{" "}
                      <span className="font-medium text-muted-foreground">(optional)</span>
                    </h2>
                    <p className="mb-4 mt-1 text-sm text-muted-foreground">
                      Sketches, photos or artwork you like. Up to 5 images.
                    </p>
                    <ReferenceUpload files={referenceFiles} onChange={setReferenceFiles} />
                  </div>
                )}
                <div
                  className={cn(
                    "mt-8 space-y-9",
                    service.id === "flash" && "mt-7 space-y-7 sm:mt-8 sm:space-y-9",
                  )}
                >
                  {questions.map((q, i) => (
                    <QuestionBlock
                      key={q.id}
                      index={i + 1}
                      question={q}
                      currency={business.policies.currency}
                      answers={answers}
                      onSet={setAnswer}
                      onToggle={toggleMulti}
                    />
                  ))}
                </div>
              </section>
            )}

            {step === 2 && (
              <>
                <QuoteStep
                  quote={quote}
                  currency={business.policies.currency}
                  service={service}
                  depositDueHours={business.policies.depositDueHours}
                />
                <ArtistPicker
                  team={quote.eligibleTeam}
                  recommendedId={recommendation?.member.id}
                  reason={recommendation?.reason}
                  choice={artistChoice}
                  onChoose={chooseArtist}
                />
              </>
            )}

            {step === 3 && (
              <section>
                <h1 className="display nook-title max-w-xl text-balance text-3xl sm:text-4xl lg:text-5xl">
                  Choose a date and time
                </h1>
                <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                  {quote.eligibleTeam.length === 0
                    ? `No one on the team is matched yet, so tell us when you'd like to come in. Earliest is ${business.policies.leadTimeDays} days out.`
                    : `Showing verified times for a ${formatDuration(quote.duration)} sitting. Earliest is ${business.policies.leadTimeDays} days out.`}
                </p>
                <div className="mt-8">
                  {quote.eligibleTeam.length === 0 ? (
                    <NoMatchPicker business={business} selected={selected} onSelect={setSelected} />
                  ) : slotsQuery.isPending ? (
                    <p role="status" className="text-sm text-muted-foreground">
                      Checking studio and Google Calendar availability…
                    </p>
                  ) : slotsQuery.isError || !slotsQuery.data?.connected ? (
                    <div role="alert" className="border border-destructive/40 p-5 text-sm">
                      We can’t verify the calendar right now. Please try again before choosing a
                      time.
                      <button
                        type="button"
                        onClick={() => void slotsQuery.refetch()}
                        className="ml-2 underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <MonthCalendar
                      key={`${artistChoice}:${serviceId}:${flashDesignId ?? ""}:${quote.duration}`}
                      availableDays={slotsQuery.data.days}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  )}
                </div>
              </section>
            )}

            {step === 4 && (
              <section>
                <h1 className="display text-3xl sm:text-4xl lg:text-5xl">Almost done!</h1>
                <div className="mt-6 lg:hidden">
                  <SummaryPanel
                    quote={quote}
                    currency={business.policies.currency}
                    depositPercent={service.depositPercent}
                    depositDueHours={business.policies.depositDueHours}
                    serviceName={service.name}
                    selected={selected}
                    artistName={selected?.slot.memberName}
                  />
                  <div className="mt-3 flex gap-5">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="min-h-11 text-sm text-brand underline"
                    >
                      Edit artist
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="min-h-11 text-sm text-brand underline"
                    >
                      Edit date
                    </button>
                  </div>
                </div>
                <h2 className="mt-4 text-base font-bold">
                  {service.id === "tattoo"
                    ? `Your details${referenceFiles.length ? ` · ${referenceFiles.length} reference ${referenceFiles.length === 1 ? "picture" : "pictures"} attached` : ""}`
                    : "Add a reference photo"}
                </h2>
                <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                  {needsReview
                    ? business.policies.reviewNote
                    : "This request confirms automatically. Your slot is secured after the deposit is paid."}
                </p>

                <div className="mt-7 max-w-xl space-y-5">
                  {service.id !== "tattoo" && (
                    <Field label="Reference photos" optional={!quote.requiresPhotos}>
                      <ReferenceUpload files={referenceFiles} onChange={setReferenceFiles} />
                    </Field>
                  )}
                  <Field label="Your name">
                    <input
                      value={name}
                      aria-invalid={attempted && !name.trim()}
                      autoComplete="name"
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nadia Berg"
                      className="min-h-11 w-full rounded-sm border border-border bg-card px-3 text-sm outline-none focus:border-brand"
                    />
                  </Field>
                  {attempted && !name.trim() && (
                    <p role="alert" className="text-xs text-destructive">
                      Enter your name.
                    </p>
                  )}
                  <Field label="Email">
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={contact}
                      aria-invalid={attempted && !/^\S+@\S+\.\S+$/.test(contact.trim())}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="you@email.com"
                      className="min-h-11 w-full rounded-sm border border-border bg-card px-3 text-sm outline-none focus:border-brand"
                    />
                  </Field>
                  {attempted && !/^\S+@\S+\.\S+$/.test(contact.trim()) && (
                    <p role="alert" className="text-xs text-destructive">
                      Enter a valid email address.
                    </p>
                  )}
                  <Field label="Phone">
                    <input
                      type="tel"
                      autoComplete="tel"
                      required
                      value={phone}
                      aria-invalid={attempted && phone.replace(/[^0-9]/g, "").length < 6}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+46 70 123 45 67"
                      className="min-h-11 w-full rounded-sm border border-border bg-card px-3 text-sm outline-none focus:border-brand"
                    />
                  </Field>
                  {attempted && phone.replace(/[^0-9]/g, "").length < 6 && (
                    <p role="alert" className="text-xs text-destructive">
                      Enter a phone number so the studio can reach you.
                    </p>
                  )}
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
                        Reference photos are required for this request. Add at least one
                        {service.id === "tattoo" ? " on the size step" : " above"}.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Desktop: ticket column. On mobile the sticky bar below carries the summary. */}
          <aside className="hidden min-w-0 border-l border-border bg-background lg:block">
            <div className="sticky top-0 p-6">
              <SummaryPanel
                quote={quote}
                currency={business.policies.currency}
                depositPercent={service.depositPercent}
                depositDueHours={business.policies.depositDueHours}
                serviceName={service.name}
                selected={selected}
                artistName={selected?.slot.memberName ?? chosenMember?.name}
              />
            </div>
          </aside>
          <div className="sticky bottom-0 z-20 col-span-full flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-foreground bg-card px-5 py-4 sm:px-10 lg:px-12">
            <div className="min-w-0">
              {/* The price is already the headline on the quote step and in the desktop ticket. */}
              <div className={cn("lg:hidden", step === 2 && "hidden")}>
                <p className="truncate font-mono text-sm font-semibold tabular-nums">
                  {service.basePrice === 0
                    ? "Free consultation"
                    : `${formatMoney(quote.low, business.policies.currency)}-${formatMoney(quote.high, business.policies.currency)}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDuration(quote.duration)}
                  {needsReview ? ", needs a quick review" : ", confirms instantly"}
                </p>
              </div>
              {blockedReason && (
                <p className="mt-1 truncate text-xs font-medium text-destructive">
                  {blockedReason}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {step > 0 && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="min-h-11 px-4"
                >
                  <ArrowLeft className="size-4" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              )}
              <Button
                type="button"
                disabled={!canContinue || submitting}
                onClick={() => (step === 4 ? submit() : setStep((s) => s + 1))}
                className="min-h-11 min-w-32 px-5 disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100 sm:min-w-40"
              >
                {submitting
                  ? "Saving booking…"
                  : step === 4
                    ? needsReview
                      ? "Send request"
                      : "Confirm booking"
                    : "Continue"}
                {step < 4 && <ArrowRight className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const timeOfDayOptions = [
  { id: "morning", label: "Morning", time: "10:00" },
  { id: "afternoon", label: "Afternoon", time: "14:00" },
  { id: "evening", label: "Evening", time: "17:00" },
];

function NoMatchPicker({
  business,
  selected,
  onSelect,
}: {
  business: { policies: { leadTimeDays: number } };
  selected: { date: string; slot: Slot } | null;
  onSelect: (value: { date: string; slot: Slot }) => void;
}) {
  const earliest = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + business.policies.leadTimeDays);
    return d;
  }, [business.policies.leadTimeDays]);
  const minDate = earliest.toISOString().slice(0, 10);
  const [date, setDate] = useState(selected?.date ?? "");
  const [timeOfDay, setTimeOfDay] = useState(
    timeOfDayOptions.find((t) => t.time === selected?.slot.time)?.id ?? "",
  );

  const commit = (nextDate: string, nextTimeOfDay: string) => {
    const option = timeOfDayOptions.find((t) => t.id === nextTimeOfDay);
    if (!nextDate || !option) return;
    onSelect({
      date: nextDate,
      slot: { time: option.time, memberId: "unassigned", memberName: "To be matched" },
    });
  };

  return (
    <div className="rounded-sm border border-border bg-secondary p-5">
      <p className="text-sm">
        Nobody on the team matches this combination yet. Tell us a date and time you'd prefer and
        The studio will follow up to confirm or offer alternatives. Your request still goes in.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Preferred date">
          <input
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              commit(e.target.value, timeOfDay);
            }}
            className="min-h-11 w-full rounded-sm border border-border bg-card px-3 text-sm outline-none focus:border-brand"
          />
        </Field>
        <Field label="Preferred time">
          <div className="flex flex-wrap gap-2">
            {timeOfDayOptions.map((option) => (
              <Button
                variant="outline"
                key={option.id}
                type="button"
                aria-pressed={timeOfDay === option.id}
                onClick={() => {
                  setTimeOfDay(option.id);
                  commit(date, option.id);
                }}
                className={cn(
                  "nook-choice min-h-11 border border-border px-4 text-sm",
                  timeOfDay === option.id && "nook-selected",
                )}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </Field>
      </div>
      {!date && (
        <p className="mt-4 text-xs text-muted-foreground">
          Earliest available from{" "}
          {earliest.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.
        </p>
      )}
    </div>
  );
}

function BookingHeader({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <header className="grid min-h-20 grid-cols-[1fr_auto] items-center gap-5 border-b border-border/60 px-5 sm:grid-cols-[1fr_auto_1fr] sm:px-10 lg:px-12">
      <div className="flex items-center gap-8">
        <Link to="/">
          <Wordmark />
        </Link>
        {step > 0 && (
          <button
            type="button"
            onClick={onBack}
            className="hidden items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:flex"
          >
            <ArrowLeft className="size-3" /> Back
          </button>
        )}
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <span className="mr-2 text-xs text-muted-foreground">
          Step {step + 1} of 5:{" "}
          <span className="font-semibold text-foreground">{stepNames[step]}</span>
        </span>
        {stepNames.map((name, index) => (
          <span
            key={name}
            aria-label={name}
            className="relative h-1 w-8 overflow-hidden bg-secondary"
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 bg-primary transition-[width] duration-500 ease-out",
                index < step ? "w-full bg-brand" : index === step ? "w-full" : "w-0",
              )}
            />
          </span>
        ))}
      </div>
      <span className="text-right text-xs text-muted-foreground sm:hidden">
        {step + 1}/5 <span className="font-semibold text-foreground">{stepNames[step]}</span>
      </span>
    </header>
  );
}

function FlashPicker({
  designs,
  currency,
  selected,
  onSelect,
}: {
  designs: FlashDesign[];
  currency: string;
  selected: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2">
        <ImagePlus className="size-4 text-brand" />
        <h2 className="font-semibold">Choose a flash design</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Each design is tattooed once. Select one to reserve it with your request.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {designs
          .filter((design) => design.available)
          .map((design) => (
            <Button
              variant="ghost"
              key={design.id}
              type="button"
              aria-pressed={selected === design.id}
              onClick={() => onSelect(design.id)}
              className={cn(
                "nook-choice nook-lift h-auto flex-col items-stretch overflow-hidden whitespace-normal border border-border p-0 text-left",
                selected === design.id && "nook-selected",
              )}
            >
              <img
                src={design.imageUrl}
                alt={design.title}
                loading="lazy"
                width={912}
                height={1104}
                className="aspect-[4/5] w-full object-cover"
              />
              <span className="block min-w-0 px-2.5 py-3 sm:p-3">
                <span className="block text-[13px] font-semibold leading-snug sm:text-sm">
                  {design.title}
                </span>
                <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                  {formatMoney(design.price, currency)} · {formatDuration(design.duration_minutes)}
                </span>
              </span>
            </Button>
          ))}
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
  currency,
  answers,
  onSet,
  onToggle,
}: {
  index: number;
  question: Question;
  currency: string;
  answers: Answers;
  onSet: (id: string, value: Answers[string]) => void;
  onToggle: (id: string, optionId: string) => void;
}) {
  const value = answers[question.id];
  const answered = isAnswered(question, answers);
  const textValue = typeof value === "string" ? value : "";
  const showTextHint = question.type === "text" && !question.optional;

  return (
    <div>
      <div className="flex gap-3">
        <span className="display mt-0.5 text-sm text-brand">{String(index).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">
            {question.label}
            {!question.optional && <span className="ml-1 text-brand">*</span>}
          </h2>
          {question.help && <p className="mt-1 text-sm text-muted-foreground">{question.help}</p>}

          <div className="mt-4">
            {question.type === "scale" && (
              <div className="grid max-w-2xl grid-cols-1 gap-2 min-[360px]:grid-cols-3">
                {[
                  {
                    label: "Small",
                    hint: "Up to 5 cm",
                    time: "~ 1 hour",
                    value: 5,
                    image: swallow,
                  },
                  {
                    label: "Medium",
                    hint: "5-15 cm",
                    time: "~ 2 hours",
                    value: 12,
                    image: botanical,
                  },
                  {
                    label: "Large",
                    hint: "Bigger than 15 cm",
                    time: "~ 3+ hours",
                    value: 24,
                    image: moth,
                  },
                ].map((size) => (
                  <Button
                    variant="ghost"
                    key={size.label}
                    type="button"
                    aria-pressed={value === size.value}
                    onClick={() => onSet(question.id, size.value)}
                    className={cn(
                      "nook-choice nook-lift h-auto flex-col items-stretch overflow-hidden whitespace-normal border border-border p-0 text-left",
                      value === size.value && "nook-selected",
                    )}
                  >
                    <img
                      src={size.image}
                      alt=""
                      aria-hidden="true"
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <span className="block p-3">
                      <strong className="block text-xs sm:text-sm">{size.label}</strong>
                      <span className="mt-1 block text-xs text-muted-foreground">{size.hint}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{size.time}</span>
                    </span>
                  </Button>
                ))}
              </div>
            )}

            {question.type === "text" && (
              <div className="max-w-lg">
                <textarea
                  rows={3}
                  value={textValue}
                  onChange={(e) => onSet(question.id, e.target.value)}
                  placeholder="A few words is plenty"
                  aria-required={!question.optional}
                  aria-invalid={showTextHint && !answered}
                  className={cn(
                    "w-full rounded-sm border bg-card p-3 text-sm outline-none focus:border-brand",
                    showTextHint && !answered && textValue.length > 0
                      ? "border-destructive/60"
                      : "border-border",
                  )}
                />
                {showTextHint && (
                  <p
                    className={cn(
                      "mt-1.5 text-xs",
                      answered
                        ? "text-muted-foreground"
                        : textValue.length > 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    {answered
                      ? "Looks good."
                      : "A few words needed here before you can continue (at least 3 characters)."}
                  </p>
                )}
              </div>
            )}

            {(question.type === "single" ||
              question.type === "boolean" ||
              question.type === "multi") && (
              <div className="flex min-w-0 flex-wrap gap-2">
                {question.options?.map((option) => {
                  const active =
                    question.type === "multi"
                      ? Array.isArray(value) && value.includes(option.id)
                      : value === option.id;
                  return (
                    <Button
                      variant="outline"
                      key={option.id}
                      type="button"
                      onClick={() =>
                        question.type === "multi"
                          ? onToggle(question.id, option.id)
                          : onSet(question.id, option.id)
                      }
                      aria-pressed={active}
                      className={cn(
                        "nook-choice h-auto min-h-11 max-w-full flex-col items-start whitespace-normal border border-border px-4 py-2.5 text-left text-sm",
                        active && "nook-selected",
                      )}
                    >
                      <span className="block font-medium">{option.label}</span>
                      {option.hint && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      )}
                      {describeOptionEffect(option, currency) && (
                        <span className="mt-1 block font-mono text-xs font-medium text-brand">
                          {describeOptionEffect(option, currency)}
                        </span>
                      )}
                    </Button>
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
  depositDueHours,
}: {
  quote: ReturnType<typeof buildQuote>;
  currency: string;
  service: { name: string; depositPercent: number };
  depositDueHours: number;
}) {
  return (
    <section>
      <p className="eyebrow">Estimate</p>
      <h1 className="mt-3 font-mono text-3xl font-semibold leading-tight tabular-nums sm:text-4xl">
        {quote.high === 0 ? (
          "No charge"
        ) : (
          <>
            {formatMoney(quote.low, currency)}
            <span className="text-muted-foreground"> - </span>
            {formatMoney(quote.high, currency)}
          </>
        )}
      </h1>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" /> {formatDuration(quote.duration)} session
        </span>
        {quote.deposit > 0 && (
          <span>
            {formatMoney(quote.deposit, currency)} deposit ({service.depositPercent}%), due within{" "}
            {depositDueHours}h to confirm your appointment
          </span>
        )}
      </p>

      <div className="mt-8 border-y border-border">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {quote.lines.map((line, i) => (
              <tr key={`${line.label}-${i}`}>
                <td className="py-3 pr-4">{line.label}</td>
                <td className="py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {line.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-border bg-card p-5">
          <p className="eyebrow">Who can take it</p>
          {quote.eligibleTeam.length === 0 ? (
            <p className="mt-2 text-sm">No one yet. Ines will find someone for you.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {quote.eligibleTeam.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  {artistImage(m.id) ? (
                    <img
                      src={artistImage(m.id)}
                      alt=""
                      loading="lazy"
                      width={816}
                      height={816}
                      className="size-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full bg-sand text-xs font-semibold">
                      {m.initials}
                    </span>
                  )}
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
            quote.requiresReview || quote.eligibleTeam.length === 0
              ? "border-brand bg-card"
              : "border-border bg-card",
          )}
        >
          <p className="eyebrow">Approval</p>
          {quote.requiresReview || quote.eligibleTeam.length === 0 ? (
            <>
              <p className="mt-2 text-sm font-medium">Goes to the studio for a quick look</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-foreground/75">
                {(quote.eligibleTeam.length === 0
                  ? [
                      "The studio will match an artist before confirming your time.",
                      ...quote.reviewReasons,
                    ]
                  : quote.reviewReasons
                ).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm">
              Standard request. Your appointment stays pending until the deposit is paid.
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        The final price is set at the studio once we see the design. The range above is what{" "}
        {service.name.toLowerCase()}s like yours normally come to.
      </p>
    </section>
  );
}

function SummaryPanel({
  quote,
  currency,
  depositPercent,
  depositDueHours,
  serviceName,
  selected,
  artistName,
}: {
  quote: ReturnType<typeof buildQuote>;
  currency: string;
  depositPercent: number;
  depositDueHours: number;
  serviceName: string;
  selected: { date: string; slot: Slot } | null;
  artistName: string | undefined;
}) {
  const rows = [
    { label: "Length", value: formatDuration(quote.duration) },
    { label: "With", value: artistName ?? "To be matched" },
    {
      label: "When",
      value: selected
        ? `${new Date(`${selected.date}T00:00:00`).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}, ${selected.slot.time}`
        : "Not chosen yet",
    },
  ];
  return (
    <BookingTicket
      title={serviceName}
      price={
        quote.high === 0
          ? "Free"
          : `${formatMoney(quote.low, currency)}-${formatMoney(quote.high, currency)}`
      }
      rows={rows}
      review={quote.requiresReview || quote.eligibleTeam.length === 0}
      note={quote.requiresPhotos ? "Reference pictures required." : undefined}
      terms={bookingTerms({
        free: quote.high === 0,
        review: quote.requiresReview || quote.eligibleTeam.length === 0,
        deposit: formatMoney(quote.deposit, currency),
        depositPercent,
        depositDueHours,
      })}
    />
  );
}

/** What the customer agrees to: shown in the ticket and on the confirmation page. */
function bookingTerms({
  free,
  review,
  deposit,
  depositPercent,
  depositDueHours,
}: {
  free: boolean;
  review: boolean;
  deposit: string;
  depositPercent: number;
  depositDueHours: number;
}) {
  if (free)
    return [
      review
        ? "The studio confirms your request first, then you get an email."
        : "Your appointment is confirmed as soon as you book. Nothing to pay.",
    ];
  return [
    "The price is an estimate. The final price is agreed at the studio.",
    review
      ? `The studio confirms your request first. Then you get an email with a link to pay the ${depositPercent}% deposit (${deposit}) within ${depositDueHours} hours.`
      : `Your booking stays pending until you pay the ${depositPercent}% deposit (${deposit}) within ${depositDueHours} hours. The email includes a payment link.`,
    "Your slot is secured once the deposit is paid.",
  ];
}

function Confirmation({
  done,
}: {
  done: {
    reviewPending: boolean;
    awaitingDeposit: boolean;
    terms: string[];
    date: string;
    time: string;
    who: string;
    id: string;
    emailSent: boolean;
  };
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
        <p className="eyebrow">
          {done.reviewPending ? "Request sent" : done.awaitingDeposit ? "Pending deposit" : "Appointment confirmed"}
        </p>
        <h1 className="display mt-4 text-3xl sm:text-4xl">
          {done.reviewPending
            ? "The studio will review your request."
            : done.awaitingDeposit
              ? "Your appointment is pending until the deposit is paid."
              : "Your appointment is confirmed."}
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          {done.reviewPending
            ? "We've held this slot while your request is reviewed, usually within a day. You'll get an email either way."
            : done.awaitingDeposit
              ? "Use the Pay deposit link in your email to confirm your appointment. This demo does not take a real payment."
              : "The final price is agreed at the studio."}
        </p>
        <p className="mt-3 font-mono text-xs text-muted-foreground">Reference: {done.id}</p>
        <p role="status" className="mt-3 text-sm">
          {done.emailSent
            ? "We sent the next steps to your email."
            : "The booking was saved, but the email could not be sent. Keep your reference and contact the studio for the deposit link."}
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

        <ul className="mt-6 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-muted-foreground">
          {done.terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-sm bg-ink px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand"
          >
            Back home
          </Link>
        </div>
      </main>
    </div>
  );
}

function ReferenceUpload({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );
  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);
  const add = (list: FileList | null) => {
    const incoming = Array.from(list ?? []);
    const accepted = incoming.filter(
      (file) =>
        ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 10_000_000,
    );
    if (accepted.length !== incoming.length)
      toast.error("Use JPG, PNG or WebP images under 10 MB.");
    onChange([...files, ...accepted].slice(0, 5));
  };
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
      <label
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          add(event.dataTransfer.files);
        }}
        className="nook-lift group flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed border-input bg-background text-center hover:border-foreground"
      >
        <Upload className="size-6 transition-transform duration-300 group-hover:-translate-y-1 group-hover:text-brand" />
        <span className="mt-3 text-xs font-medium">Drag & drop your images here</span>
        <span className="mt-1 text-xs text-muted-foreground">
          or click to upload · JPG, PNG, WebP
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => add(event.target.files)}
        />
      </label>
      <div className="nook-stagger grid grid-cols-2 content-start gap-2">
        {previews.map(({ file, url }) => (
          <div
            key={`${file.name}-${file.lastModified}`}
            className="relative aspect-square overflow-hidden rounded-sm border border-border"
          >
            <img src={url} alt={`Reference ${file.name}`} className="size-full object-cover" />
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              onClick={() => onChange(files.filter((candidate) => candidate !== file))}
              className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-sm bg-card"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {files.length < 5 && (
          <label className="flex aspect-square cursor-pointer items-center justify-center rounded-sm border border-dashed border-input transition-colors hover:border-foreground">
            <Plus className="size-5" />
            <span className="sr-only">Add another picture</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => add(event.target.files)}
            />
          </label>
        )}
      </div>
    </div>
  );
}

function ArtistPicker({
  team,
  recommendedId,
  reason,
  choice,
  onChoose,
}: {
  team: TeamMember[];
  recommendedId: string | undefined;
  reason: string | undefined;
  choice: string;
  onChoose: (id: string) => void;
}) {
  if (team.length === 0) return null;
  const activeId = choice === "auto" ? recommendedId : choice;
  return (
    <div className="mt-10">
      <h2 className="font-display text-lg font-semibold leading-snug sm:text-xl">
        We matched you with the best fit
      </h2>
      <p className="mt-1 max-w-lg text-sm text-muted-foreground">
        Based on your style, placement and sitting length. Prefer someone else? Pick them instead.
      </p>
      <div className="nook-stagger mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {team.map((member) => {
          const active = member.id === activeId;
          const best = member.id === recommendedId;
          return (
            <div
              key={member.id}
              className={cn(
                "nook-choice nook-lift relative flex flex-col border border-border p-4",
                active && "nook-selected",
              )}
            >
              <Button
                variant="ghost"
                type="button"
                onClick={() => onChoose(best ? "auto" : member.id)}
                className="flex h-auto w-full items-start justify-start gap-3 whitespace-normal p-0 text-left hover:bg-transparent"
                aria-pressed={active}
              >
                {artistImage(member.id) ? (
                  <img
                    src={artistImage(member.id)}
                    alt={`Portrait of ${member.name}`}
                    loading="lazy"
                    width={816}
                    height={816}
                    className="size-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-bold">
                    {member.initials}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{member.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{member.role}</span>
                </span>
                {active && <Check className="nook-pop size-4 shrink-0 text-brand" />}
              </Button>
              {best && (
                <p className="mt-3 flex items-start gap-1.5 rounded-sm bg-secondary px-2.5 py-2 text-xs">
                  <Star className="mt-0.5 size-3 shrink-0 fill-brand text-brand" />
                  <span>
                    <strong className="font-semibold">Best match.</strong> {reason}
                  </span>
                </p>
              )}
              {member.portfolioUrl && (
                <a
                  href={member.portfolioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium underline-offset-4 hover:text-brand hover:underline"
                >
                  See their work <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
