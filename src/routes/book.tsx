import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Camera, Check, Clock, ImagePlus, Plus, Trash2, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import type { Answers, BookingRequest, Question } from "@/lib/nook/types";
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
  component: BookingFlow,
});

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
  const [done, setDone] = useState<null | { pending: boolean; date: string; time: string; who: string }>(null);

  const service = business.services.find((s) => s.id === serviceId) ?? business.services[0];
  if (!service) return <div className="p-8">No services are available.</div>;
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
    <div className="min-h-screen bg-secondary px-3 py-3 sm:px-5 sm:py-6">
      <main className="mx-auto min-h-[calc(100vh-3rem)] w-full max-w-7xl overflow-hidden rounded-lg border border-border bg-card nook-shadow">
        <BookingHeader step={step} onBack={() => setStep((current) => Math.max(0, current - 1))} />
        <div className="grid gap-8 px-5 pb-7 pt-8 sm:px-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10 lg:px-12 lg:pb-10 lg:pt-12">
        <div className="nook-enter min-w-0" key={step}>
          {step === 0 && (
            <section>
               <h1 className="display max-w-xl text-4xl leading-[1.02] sm:text-6xl">What would you like to book?</h1>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                {business.tagline}
              </p>
               <div className="mt-9 grid gap-3 sm:grid-cols-3">
                {business.services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setServiceId(s.id);
                      setAnswers({});
                      setSelected(null);
                    }}
                     className={cn("nook-panel flex min-h-44 w-full flex-col justify-between p-5 text-left transition-colors hover:border-primary", serviceId === s.id && "border-primary ring-1 ring-primary")}
                  >
                    <span
                      className={cn(
                         "flex size-5 shrink-0 items-center justify-center rounded-full border",
                         serviceId === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {serviceId === s.id && <Check className="size-3" />}
                    </span>
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
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
               <h1 className="display max-w-xl text-4xl leading-[1.02] sm:text-6xl">How big is your tattoo?</h1>
               <p className="mt-3 max-w-lg text-sm text-muted-foreground">This helps us estimate time and price.</p>
              {service.id === "flash" && <FlashPicker selected={flashDesignId} onSelect={setFlashDesignId} />}
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

          {step === 2 && <QuoteStep quote={quote} currency={business.policies.currency} service={service} />}

          {step === 3 && (
            <section>
               <h1 className="display max-w-xl text-4xl leading-[1.02] sm:text-6xl">Choose a date<br />and time</h1>
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
               <h1 className="display text-4xl leading-none sm:text-6xl">Almost done!</h1>
               <h2 className="mt-4 text-base font-bold">Add a reference photo <span className="font-medium text-muted-foreground">(optional)</span></h2>
               <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                {quote.requiresReview
                  ? business.policies.reviewNote
                  : "This one fits the studio's standard rules, so it confirms straight away."}
              </p>

               <div className="mt-7 max-w-xl space-y-5">
                 <Field label="Reference photos" optional={!quote.requiresPhotos}>
                   <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
                     <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-background text-center transition-colors hover:border-primary">
                       <Upload className="size-6" /><span className="mt-3 text-xs font-medium">Drag & drop your image here</span><span className="mt-1 text-[11px] text-muted-foreground">or click to upload</span>
                       <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => setReferenceFiles(Array.from(event.target.files ?? []).slice(0, 5))} />
                     </label>
                     <div className="grid grid-cols-2 gap-2">
                       {referenceFiles.slice(0, 3).map((file) => <div key={`${file.name}-${file.lastModified}`} className="group relative aspect-square overflow-hidden rounded-md border border-border"><img src={URL.createObjectURL(file)} alt="Reference preview" className="size-full object-cover"/><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setReferenceFiles((files) => files.filter((candidate) => candidate !== file))} className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-card"><Trash2 className="size-3.5" /></button></div>)}
                       {referenceFiles.length < 5 && <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border border-dashed border-border"><Plus className="size-5"/><input type="file" accept="image/*" className="sr-only" onChange={(event) => setReferenceFiles((files) => [...files, ...Array.from(event.target.files ?? [])].slice(0, 5))}/></label>}
                     </div>
                   </div>
                 </Field>
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
                      Reference photos are required for this request. Add at least one above.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-6">
          <SummaryPanel
            quote={quote}
            currency={business.policies.currency}
            serviceName={service.name}
            selected={selected}
          />
        </aside>
         <div className="col-span-full flex items-center justify-between gap-4 border-t border-border pt-5 lg:col-span-1 lg:border-0 lg:pt-0">
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
                 className="min-h-11 rounded-md px-4"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Back</span>
               </Button>
            )}
             <Button
              type="button"
              disabled={!canContinue}
              onClick={() => (step === 4 ? submit() : setStep((s) => s + 1))}
               className="min-h-11 min-w-40 rounded-md px-5"
            >
              {step === 4 ? (quote.requiresReview ? "Send request" : "Confirm booking") : "Continue"}
              {step < 4 && <ArrowRight className="size-4" />}
             </Button>
         </div>
       </div>
       </main>
      </div>
    </div>
  );
}

function BookingHeader({ step, onBack }: { step: number; onBack: () => void }) {
  return <header className="grid min-h-20 grid-cols-[1fr_auto] items-center gap-5 px-5 sm:grid-cols-[1fr_auto_1fr] sm:px-10 lg:px-12">
    <div className="flex items-center gap-8"><Link to="/" className="text-2xl font-semibold">Nook</Link>{step > 0 && <button type="button" onClick={onBack} className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"><ArrowLeft className="size-3"/> Back</button>}</div>
    <div className="hidden items-center gap-2 sm:flex"><span className="mr-2 text-[10px] text-muted-foreground">Step {step + 1} of 5</span>{stepNames.map((name, index) => <span key={name} aria-label={name} className={cn("h-1 w-10 rounded-full", index <= step ? "bg-primary" : "bg-secondary")}/>)}</div>
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
  return <div className="mt-8"><div className="flex items-center gap-2"><ImagePlus className="size-4 text-brand"/><h2 className="font-semibold">Choose a flash design</h2></div><p className="mt-1 text-sm text-muted-foreground">Each design is tattooed once. Select one to reserve it with your request.</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{bookingFlashDesigns.map((design) => <button key={design.id} type="button" onClick={() => onSelect(design.id)} className={cn("overflow-hidden rounded-sm border bg-card text-left transition-colors", selected === design.id ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-brand")}><img src={design.image} alt={design.title} loading="lazy" width={912} height={1104} className="aspect-[4/5] w-full object-cover"/><span className="block p-3"><span className="block text-sm font-semibold">{design.title}</span><span className="mt-1 block text-xs text-muted-foreground">{design.detail}</span></span></button>)}</div></div>;
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
              <div className="grid max-w-2xl grid-cols-3 gap-2">
                {[{ label: "Small", hint: "Up to 5 cm", time: "~ 1 hour", value: 5, image: swallow }, { label: "Medium", hint: "5 – 15 cm", time: "~ 2 hours", value: 12, image: botanical }, { label: "Large", hint: "Bigger than 15 cm", time: "~ 3+ hours", value: 24, image: moth }].map((size) => <button key={size.label} type="button" onClick={() => onSet(question.id, size.value)} className={cn("overflow-hidden rounded-md border bg-card text-left transition-colors", value === size.value ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary")}><img src={size.image} alt="" aria-hidden="true" className="aspect-[4/3] w-full object-cover"/><span className="block p-3"><strong className="block text-xs sm:text-sm">{size.label}</strong><span className="mt-1 block text-[10px] text-muted-foreground sm:text-xs">{size.hint}</span><span className="mt-1 block text-[10px] text-muted-foreground sm:text-xs">{size.time}</span></span></button>)}
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
                         "min-h-11 rounded-md border px-4 py-2.5 text-left text-sm transition-colors",
                        active
                           ? "border-primary bg-primary text-primary-foreground"
                           : "border-border bg-card hover:border-primary",
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
     <div className="nook-panel p-4 sm:p-5">
       <p className="text-xs font-bold">Your booking</p>
       <div className="mt-4 flex gap-3"><img src={botanical} alt="Selected floral tattoo design" className="size-16 rounded-md object-cover"/><div className="flex flex-wrap content-start gap-1"><span className="rounded bg-secondary px-2 py-1 text-[9px]">Medium size</span><span className="rounded bg-secondary px-2 py-1 text-[9px]">Fine line · Black & grey</span></div></div>
       <div className="mt-4 grid grid-cols-2 gap-4">
       <div><span className="block text-[10px] text-muted-foreground">Estimated price</span><p className="mt-1 text-sm font-bold">
        {quote.high === 0
          ? "Free"
          : `${formatMoney(quote.low, currency)}–${formatMoney(quote.high, currency)}`}
       </p></div><div><span className="block text-[10px] text-muted-foreground">Estimated time</span><p className="mt-1 text-sm font-bold">~ {formatDuration(quote.duration)}</p></div></div>

       <dl className="mt-5 space-y-3 border-t border-border pt-5 text-xs">
         {stepNames.map((name, index) => <div key={name} className="flex items-center gap-3"><span className={cn("flex size-5 items-center justify-center rounded-full border", index < (selected ? 5 : 3) ? "border-primary bg-primary text-primary-foreground" : "border-border")} >{index < (selected ? 5 : 3) ? <Check className="size-3"/> : <span className="size-1 rounded-full bg-border"/>}</span><span>{name}</span></div>)}
         <div className="hidden">
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
         </div></dl>

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
