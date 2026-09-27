import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Camera, Check, Clock, ExternalLink, ImagePlus, Plus, Star, Trash2, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/nook/site-header";
import { MonthCalendar } from "@/components/nook/month-calendar";
import { NookProvider, useNook } from "@/lib/nook/store";
import {
  buildQuote,
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
import sun from "@/assets/flash-sun.jpg";
import swallow from "@/assets/flash-swallow.jpg";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingPage,
});

function BookingPage() {
  return <NookProvider><BookingFlow /></NookProvider>;
}

const stepNames = ["Style", "Size", "Placement", "Photo", "Date & time"];

function BookingFlow() {
  const { business, requests, addRequest } = useNook();
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(business.services[0]?.id ?? "tattoo");
  const [answers, setAnswers] = useState<Answers>({});
  const [selected, setSelected] = useState<{ date: string; slot: Slot } | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [flashDesignId, setFlashDesignId] = useState<string | undefined>();
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [artistChoice, setArtistChoice] = useState<string>("auto");
  const [done, setDone] = useState<null | { pending: boolean; date: string; time: string; who: string }>(null);

  const service = business.services.find((s) => s.id === serviceId) ?? business.services[0];
  const questions = service ? visibleQuestions(service, answers) : [];
  const quote = service ? buildQuote(business, service, answers) : null;
  if (!service) return <div className="p-8">No services are available.</div>;
  if (!quote) return <div className="p-8">No quote is available.</div>;
  const recommendation = recommendArtist(quote);
  const chosenMember =
    artistChoice === "auto"
      ? recommendation?.member
      : quote.eligibleTeam.find((m) => m.id === artistChoice) ?? recommendation?.member;
  const calendarTeam = chosenMember ? [chosenMember] : quote.eligibleTeam;
  const chooseArtist = (id: string) => {
    setArtistChoice(id);
    setSelected(null);
  };

  const booked = requests
    .filter((r) => r.status !== "declined")
    .map((r) => ({ date: r.date, time: r.time, memberId: r.memberId }));

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
    if (!selected || !name.trim() || !contact.trim()) {
      toast.error("Add your name and a way to reach you.");
      return;
    }
    const pending = quote.requiresReview;
    const requestId = crypto.randomUUID();
    const uploadedPaths: string[] = [];
    for (const file of referenceFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${requestId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from("booking-references").upload(path, file);
      if (error) { toast.error(`Could not upload ${file.name}`); return; }
      uploadedPaths.push(path);
    }
    const request: BookingRequest = {
      id: requestId,
      createdAt: new Date().toISOString(),
      customerName: name.trim(),
      contact: contact.trim(),
      notes: notes.trim(),
      serviceId: service.id,
      answers,
      date: selected.date,
      time: selected.slot.time,
      memberId: selected.slot.memberId,
      ...(flashDesignId ? { flashDesignId } : {}),
      referencePaths: uploadedPaths,
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
    };
    const { error } = await supabase.from("booking_requests").insert({
      id: request.id, customer_name: request.customerName, contact: request.contact, notes: request.notes,
      service_id: request.serviceId, answers: request.answers, quote: request.quote,
      appointment_date: request.date, appointment_time: request.time, flash_design_id: null,
      reference_paths: uploadedPaths, status: request.status,
    });
    if (error) { toast.error(error.message); return; }
    addRequest(request);
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
    (step === 1 && allAnswered && (service.id !== "flash" || Boolean(flashDesignId))) ||
    step === 2 ||
    (step === 3 && Boolean(selected)) ||
    (step === 4 && (!quote.requiresPhotos || referenceFiles.length > 0));

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-7xl border-x border-border bg-card lg:min-h-screen">
        <BookingHeader step={step} onBack={() => setStep((current) => Math.max(0, current - 1))} />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="nook-enter min-w-0 overflow-hidden px-5 pb-10 pt-8 sm:px-10 sm:pt-12 lg:min-h-[38rem] lg:px-12" key={step}>
           <p className="mb-6 flex items-center gap-4 border-b border-border pb-3 text-[11px] font-semibold uppercase text-brand"><span className="font-display text-lg tabular-nums">{String(step + 1).padStart(2, "0")}</span><span>{stepNames[step]}</span></p>
          {step === 0 && (
            <section>
               <h1 className="display nook-title max-w-xl text-4xl sm:text-6xl lg:text-7xl">What would you like to book?</h1>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                {business.tagline}
              </p>
                <div className="nook-stagger mt-9 grid gap-3 sm:grid-cols-3">
                 {business.services.map((s, serviceIndex) => (
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
                       className={cn("nook-choice nook-lift flex h-auto min-h-52 w-full flex-col items-start justify-between whitespace-normal border border-border bg-secondary/60 p-5 text-left hover:border-brand hover:bg-brand-soft/50", serviceId === s.id && "border-brand bg-brand-soft")}
                  >
                     <span className="flex w-full justify-between text-xs font-semibold tabular-nums text-brand"><span>{String(serviceIndex + 1).padStart(2, "0")}</span>{serviceId === s.id && <Check className="size-4" />}</span>
                     <span className="mt-6 flex-1">
                       <span className="block text-base font-bold">{s.name}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{s.blurb}</span>
                    </span>
                     <span className="mt-5 block shrink-0 text-sm">
                      <span className="block font-medium">
                        {s.basePrice === 0 ? "Free" : `from ${formatMoney(s.basePrice, business.policies.currency)}`}
                      </span>
                      <span className="block text-xs text-muted-foreground">
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
               <h1 className="display nook-title max-w-xl text-4xl sm:text-6xl lg:text-7xl">How big is your tattoo?</h1>
               <p className="mt-3 max-w-lg text-sm text-muted-foreground">This helps us estimate time and price.</p>
              {service.id === "flash" && <FlashPicker selected={flashDesignId} onSelect={setFlashDesignId} />}
              {service.id === "tattoo" && (
                <div className="mt-8 max-w-2xl">
                  <h2 className="text-base font-semibold">Reference pictures <span className="font-medium text-muted-foreground">(optional)</span></h2>
                  <p className="mb-4 mt-1 text-sm text-muted-foreground">Sketches, photos or artwork you like — up to 5 images.</p>
                  <ReferenceUpload files={referenceFiles} onChange={setReferenceFiles} />
                </div>
              )}
               <div className="mt-8 space-y-9">
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

          {step === 2 && (
            <>
              <QuoteStep quote={quote} currency={business.policies.currency} service={service} />
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
               <h1 className="display nook-title max-w-xl text-4xl sm:text-6xl lg:text-7xl">Choose a date<br />and time</h1>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                Showing days with a free {formatDuration(quote.duration)} block for{" "}
                {chosenMember ? chosenMember.name : "no one yet"}
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
                    eligibleTeam={calendarTeam}
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
               <h1 className="display text-4xl sm:text-6xl lg:text-7xl">Almost done!</h1>
               <h2 className="mt-4 text-base font-bold">{service.id === "tattoo" ? `Your details${referenceFiles.length ? ` · ${referenceFiles.length} reference ${referenceFiles.length === 1 ? "picture" : "pictures"} attached` : ""}` : "Add a reference photo"}</h2>
               <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                {quote.requiresReview
                  ? business.policies.reviewNote
                  : "This one fits the studio's standard rules, so it confirms straight away."}
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
                      Reference photos are required for this request. Add at least one{service.id === "tattoo" ? " on the size step" : " above"}.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

          <aside className="min-w-0 border-t border-border lg:sticky lg:top-0 lg:self-start lg:border-l lg:border-t-0">
          <SummaryPanel
            quote={quote}
            currency={business.policies.currency}
            serviceName={service.name}
            selected={selected}
            currentStep={step}
             artistName={chosenMember?.name}
          />
        </aside>
          <div className="col-span-full flex min-w-0 items-center justify-between gap-4 border-t border-border px-5 py-5 sm:px-10 lg:px-12">
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
               <Button variant="outline"
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
              disabled={!canContinue}
              onClick={() => (step === 4 ? submit() : setStep((s) => s + 1))}
                className="min-h-11 min-w-32 px-5 sm:min-w-40"
            >
              {step === 4 ? (quote.requiresReview ? "Send request" : "Confirm booking") : "Continue"}
              {step < 4 && <ArrowRight className="size-4" />}
             </Button>
         </div>
       </div>
       </div>
       </main>
      </div>
  );
}

function BookingHeader({ step, onBack }: { step: number; onBack: () => void }) {
  return <header className="grid min-h-20 grid-cols-[1fr_auto] items-center gap-5 border-b border-border/60 px-5 sm:grid-cols-[1fr_auto_1fr] sm:px-10 lg:px-12">
    <div className="flex items-center gap-8"><Link to="/" className="text-2xl font-semibold">Nook</Link>{step > 0 && <button type="button" onClick={onBack} className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"><ArrowLeft className="size-3"/> Back</button>}</div>
    <div className="hidden items-center gap-2 sm:flex"><span className="mr-2 text-[10px] text-muted-foreground">Step {step + 1} of 5</span>{stepNames.map((name, index) => <span key={name} aria-label={name} className="relative h-1 w-10 overflow-hidden rounded-full bg-secondary"><span className={cn("absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500 ease-out", index < step ? "w-full bg-brand" : index === step ? "w-full" : "w-0")}/></span>)}</div>
    <span className="text-right text-[10px] text-muted-foreground sm:hidden">{step + 1} / 5</span>
  </header>;
}

const bookingFlashDesigns = [
  { id: "botanical", title: "Wildflower stem", detail: "Fine line · €160", image: botanical },
  { id: "moth", title: "Night moth", detail: "Fine line · €220", image: moth },
  { id: "sun", title: "Ornamental sun", detail: "Blackwork · €190", image: sun },
  { id: "swallow", title: "Fine-line swallow", detail: "Fine line · €180", image: swallow },
];

function FlashPicker({ selected, onSelect }: { selected: string | undefined; onSelect: (id: string) => void }) {
   return <div className="mt-8"><div className="flex items-center gap-2"><ImagePlus className="size-4 text-brand"/><h2 className="font-semibold">Choose a flash design</h2></div><p className="mt-1 text-sm text-muted-foreground">Each design is tattooed once. Select one to reserve it with your request.</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{bookingFlashDesigns.map((design) => <Button variant="ghost" key={design.id} type="button" aria-pressed={selected === design.id} onClick={() => onSelect(design.id)} className={cn("nook-choice nook-lift h-auto flex-col items-stretch overflow-hidden whitespace-normal border p-0 text-left", selected === design.id ? "border-brand bg-brand-soft" : "border-border bg-secondary/60 hover:border-brand")}><img src={design.image} alt={design.title} loading="lazy" width={912} height={1104} className="aspect-[4/5] w-full object-cover"/><span className="block p-3"><span className="block text-sm font-semibold">{design.title}</span><span className="mt-1 block text-xs text-muted-foreground">{design.detail}</span></span></Button>)}</div></div>;
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
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{question.label}</h2>
          {question.help && <p className="mt-1 text-sm text-muted-foreground">{question.help}</p>}

          <div className="mt-4">
            {question.type === "scale" && (
              <div className="grid max-w-2xl grid-cols-1 gap-2 min-[360px]:grid-cols-3">
                 {[{ label: "Small", hint: "Up to 5 cm", time: "~ 1 hour", value: 5, image: swallow }, { label: "Medium", hint: "5 – 15 cm", time: "~ 2 hours", value: 12, image: botanical }, { label: "Large", hint: "Bigger than 15 cm", time: "~ 3+ hours", value: 24, image: moth }].map((size) => <Button variant="ghost" key={size.label} type="button" aria-pressed={value === size.value} onClick={() => onSet(question.id, size.value)} className={cn("nook-choice nook-lift h-auto flex-col items-stretch overflow-hidden whitespace-normal border p-0 text-left", value === size.value ? "border-brand bg-brand-soft" : "border-border bg-secondary/60 hover:border-brand")}><img src={size.image} alt="" aria-hidden="true" className="aspect-[4/3] w-full object-cover"/><span className="block p-3"><strong className="block text-xs sm:text-sm">{size.label}</strong><span className="mt-1 block text-[10px] text-muted-foreground sm:text-xs">{size.hint}</span><span className="mt-1 block text-[10px] text-muted-foreground sm:text-xs">{size.time}</span></span></Button>)}
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
                      className={cn(
                          "nook-choice h-auto min-h-11 max-w-full flex-col items-start whitespace-normal border px-4 py-2.5 text-left text-sm transition-colors",
                        active
                            ? "border-brand bg-brand-soft text-foreground"
                            : "border-border bg-secondary/60 hover:border-brand hover:bg-brand-soft/50",
                      )}
                    >
                      <span className="block font-medium">{option.label}</span>
                      {option.hint && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
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
                   {artistImage(m.id) ? <img src={artistImage(m.id)} alt="" loading="lazy" width={816} height={816} className="size-8 rounded-full object-cover" /> : <span className="flex size-8 items-center justify-center rounded-full bg-sand text-[11px] font-semibold">{m.initials}</span>}
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
  currentStep,
  artistName,
}: {
  quote: ReturnType<typeof buildQuote>;
  currency: string;
  serviceName: string;
  selected: { date: string; slot: Slot } | null;
  currentStep: number;
  artistName: string | undefined;
}) {
  return (
      <div className="bg-secondary/40 px-5 py-7 sm:px-8 lg:min-h-[38rem]">
        <div className="flex items-center justify-between border-b border-foreground pb-4"><p className="font-display text-lg font-bold">Sitting / spec</p><span className="text-xs font-semibold text-brand">NO. 0{currentStep + 1}</span></div>
        <p className="mt-6 text-[10px] font-bold uppercase text-muted-foreground">01 / Service</p>
        <p className="mt-1 font-display text-xl font-semibold">{serviceName}</p>
        <div className="mt-6 border-t border-border py-4">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">02 / Estimated quote</p>
          <p key={`${quote.low}-${quote.high}`} className="nook-enter mt-1 font-display text-2xl font-bold tabular-nums">{quote.high === 0 ? "Free" : `${formatMoney(quote.low, currency)}–${formatMoney(quote.high, currency)}`}</p>
        </div>
        <div className="grid grid-cols-2 border-y border-border py-4">
          <div><p className="text-[10px] font-bold uppercase text-muted-foreground">03 / Sitting</p><p key={quote.duration} className="nook-enter mt-1 font-display text-lg font-semibold">{formatDuration(quote.duration)}</p></div>
          <div className="border-l border-border pl-4"><p className="text-[10px] font-bold uppercase text-muted-foreground">04 / Artist</p><p key={artistName} className="nook-enter mt-1 font-display text-lg font-semibold">{artistName ?? "To be matched"}</p></div>
        </div>
        {selected && <div className="border-b border-border py-4"><p className="text-[10px] font-bold uppercase text-muted-foreground">05 / Appointment</p><p className="mt-1 text-sm font-semibold">{new Date(`${selected.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} · {selected.slot.time}</p></div>}
        <p className="mt-5 text-xs text-muted-foreground">{quote.requiresReview ? "Pending studio review" : "Ready for confirmation"}{quote.requiresPhotos ? " · Reference pictures required" : ""}</p>
        <div className="mt-8 flex gap-1" aria-label={`Step ${currentStep + 1} of ${stepNames.length}`}>
          {stepNames.map((name, index) => <span key={name} className={cn("h-1 flex-1 bg-border transition-colors duration-300", index <= currentStep && "bg-brand")} />)}
        </div>
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

function ReferenceUpload({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const add = (list: FileList | null) => onChange([...files, ...Array.from(list ?? [])].slice(0, 5));
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
      <label
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          add(event.dataTransfer.files);
        }}
        className="nook-lift group flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-background text-center hover:border-brand"
      >
        <Upload className="size-6 transition-transform duration-300 group-hover:-translate-y-1 group-hover:text-brand" />
        <span className="mt-3 text-xs font-medium">Drag & drop your images here</span>
        <span className="mt-1 text-[11px] text-muted-foreground">or click to upload · JPG, PNG, WebP</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => add(event.target.files)} />
      </label>
      <div className="nook-stagger grid grid-cols-2 content-start gap-2">
        {previews.map(({ file, url }) => (
          <div key={`${file.name}-${file.lastModified}`} className="relative aspect-square overflow-hidden rounded-md border border-border">
            <img src={url} alt={`Reference ${file.name}`} className="size-full object-cover" />
            <button type="button" aria-label={`Remove ${file.name}`} onClick={() => onChange(files.filter((candidate) => candidate !== file))} className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-card">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {files.length < 5 && (
          <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border border-dashed border-border transition-colors hover:border-brand">
            <Plus className="size-5" />
            <span className="sr-only">Add another picture</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => add(event.target.files)} />
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
      <p className="eyebrow">Your artist</p>
      <h2 className="mt-2 text-xl font-bold">We matched you with the best fit</h2>
      <p className="mt-1 max-w-lg text-sm text-muted-foreground">Based on your style, placement and sitting length. Prefer someone else? Pick them instead.</p>
      <div className="nook-stagger mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {team.map((member) => {
          const active = member.id === activeId;
          const best = member.id === recommendedId;
          return (
            <div
              key={member.id}
              className={cn(
                 "nook-choice nook-lift relative flex flex-col border p-4",
                 active ? "border-brand bg-brand-soft" : "border-border bg-secondary/60 hover:border-brand",
              )}
            >
               <Button variant="ghost" type="button" onClick={() => onChoose(best ? "auto" : member.id)} className="flex h-auto w-full items-start justify-start gap-3 whitespace-normal p-0 text-left hover:bg-transparent" aria-pressed={active}>
                 {artistImage(member.id) ? <img src={artistImage(member.id)} alt={`Portrait of ${member.name}`} loading="lazy" width={816} height={816} className="size-12 shrink-0 rounded-full object-cover" /> : <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-bold">{member.initials}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{member.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{member.role}</span>
                </span>
                {active && <Check className="nook-pop size-4 shrink-0" />}
               </Button>
              {best && (
                <p className="mt-3 flex items-start gap-1.5 rounded-sm bg-brand-soft/60 px-2.5 py-2 text-xs">
                  <Star className="mt-0.5 size-3 shrink-0 fill-brand text-brand" />
                  <span><strong className="font-semibold">Best match.</strong> {reason}</span>
                </p>
              )}
              {member.portfolioUrl && (
                <a href={member.portfolioUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium underline-offset-4 hover:text-brand hover:underline">
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
