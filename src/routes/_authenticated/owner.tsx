import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/nook/site-header";
import { useNook } from "@/lib/nook/store";
import { formatDuration, formatMoney } from "@/lib/nook/engine";
import type { BookingRequest, BusinessConfig } from "@/lib/nook/types";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Studio settings — Nook" },
      {
        name: "description",
        content:
          "Review unusual requests and tune services, pricing rules, questions, team skills and booking policies.",
      },
      { property: "og:title", content: "Studio settings — Nook" },
      {
        property: "og:description",
        content: "Approve or edit requests, and decide what each answer does to price and time.",
      },
    ],
  }),
  component: OwnerPage,
});

const tabs = ["Requests", "Services", "Questions", "Team", "Policies"] as const;
type Tab = (typeof tabs)[number];

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function OwnerPage() {
  const { business, requests, resetAll } = useNook();
  const [tab, setTab] = useState<Tab>("Requests");
  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="min-h-screen">
      <SiteHeader variant="owner" />

      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{business.archetype}</p>
            <h1 className="display mt-2 text-3xl sm:text-4xl">{business.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {pending > 0
                ? `${pending} request${pending > 1 ? "s" : ""} waiting on you.`
                : "Nothing waiting. The book runs itself today."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetAll();
              toast.success("Demo data reset");
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm transition-colors hover:bg-secondary"
          >
            <RotateCcw className="size-3.5" /> Reset demo
          </button>
        </div>

        <div className="mt-8 flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px min-h-11 whitespace-nowrap border-b-2 px-3 text-sm transition-colors",
                tab === t
                  ? "border-brand font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
              {t === "Requests" && pending > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
                  {pending}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="py-8">
          {tab === "Requests" && <RequestsTab />}
          {tab === "Services" && <ServicesTab />}
          {tab === "Questions" && <QuestionsTab />}
          {tab === "Team" && <TeamTab />}
          {tab === "Policies" && <PoliciesTab />}
        </div>
      </main>
    </div>
  );
}

function RequestsTab() {
  const { business, requests, setRequestStatus, updateRequest } = useNook();
  const [editing, setEditing] = useState<string | null>(null);
  const currency = business.policies.currency;

  if (requests.length === 0)
    return <p className="text-sm text-muted-foreground">No bookings yet. Try the customer flow.</p>;

  return (
    <div className="divide-y divide-border border-y border-border">
      {requests.map((r) => {
        const member = business.team.find((m) => m.id === r.memberId);
        const service = business.services.find((s) => s.id === r.serviceId);
        return (
          <article key={r.id} className="py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="display text-lg">{r.customerName}</h2>
                  <StatusPill status={r.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {service?.name} ·{" "}
                  {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  at {r.time} · {member?.name ?? "unassigned"}
                </p>
                {r.notes && <p className="mt-2 max-w-lg text-sm text-foreground/80">“{r.notes}”</p>}
              </div>
              <div className="text-right">
                <p className="font-medium tabular-nums">
                  {formatMoney(r.quote.low, currency)}–{formatMoney(r.quote.high, currency)}
                </p>
                <p className="text-xs text-muted-foreground">{formatDuration(r.quote.duration)}</p>
              </div>
            </div>

            {r.quote.reviewReasons.length > 0 && r.status === "pending" && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {r.quote.reviewReasons.map((reason) => (
                  <li
                    key={reason}
                    className="rounded-full border border-brand/40 bg-brand-soft/40 px-3 py-1 text-xs"
                  >
                    {reason}
                  </li>
                ))}
              </ul>
            )}

            {r.status === "pending" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRequestStatus(r.id, "confirmed");
                    toast.success(`${r.customerName} confirmed`);
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand"
                >
                  <Check className="size-4" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(editing === r.id ? null : r.id)}
                  className="min-h-11 rounded-full border border-border px-5 text-sm transition-colors hover:bg-secondary"
                >
                  Edit quote
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRequestStatus(r.id, "declined");
                    toast("Request declined");
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="size-4" /> Decline
                </button>
              </div>
            )}

            {editing === r.id && <EditQuote request={r} onSave={updateRequest} onDone={() => setEditing(null)} />}
          </article>
        );
      })}
    </div>
  );
}

function EditQuote({
  request,
  onSave,
  onDone,
}: {
  request: BookingRequest;
  onSave: (id: string, patch: Partial<BookingRequest>) => void;
  onDone: () => void;
}) {
  const { business } = useNook();
  const [low, setLow] = useState(request.quote.low);
  const [high, setHigh] = useState(request.quote.high);
  const [duration, setDuration] = useState(request.quote.duration);
  const [memberId, setMemberId] = useState(request.memberId);

  return (
    <div className="mt-4 grid gap-4 rounded-sm border border-border bg-sand/50 p-5 sm:grid-cols-4">
      <NumberField label="Low" value={low} onChange={setLow} />
      <NumberField label="High" value={high} onChange={setHigh} />
      <NumberField label="Minutes" value={duration} step={15} onChange={setDuration} />
      <label className="block">
        <span className="eyebrow mb-2 block">Artist</span>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="min-h-11 w-full rounded-sm border border-border bg-card px-2 text-sm"
        >
          {business.team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-4">
        <button
          type="button"
          onClick={() => {
            onSave(request.id, {
              memberId,
              status: "confirmed",
              quote: { ...request.quote, low, high, duration },
            });
            toast.success("Quote updated and confirmed");
            onDone();
          }}
          className="min-h-11 rounded-full bg-ink px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand"
        >
          Save & confirm
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: BookingRequest["status"] }) {
  const map = {
    confirmed: "border-border bg-secondary text-foreground",
    pending: "border-brand/50 bg-brand-soft/60 text-foreground",
    declined: "border-border bg-transparent text-muted-foreground line-through",
  } as const;
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] capitalize", map[status])}>
      {status}
    </span>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="min-h-11 w-full rounded-sm border border-border bg-card px-3 text-sm tabular-nums outline-none focus:border-brand"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

const editServices = (
  business: BusinessConfig,
  serviceId: string,
  patch: Partial<BusinessConfig["services"][number]>,
): BusinessConfig => ({
  ...business,
  services: business.services.map((s) => (s.id === serviceId ? { ...s, ...patch } : s)),
});

function ServicesTab() {
  const { business, updateBusiness } = useNook();

  return (
    <div className="space-y-8">
      <p className="max-w-lg text-sm text-muted-foreground">
        The base is the floor. Answers in the questionnaire move it from there.
      </p>
      {business.services.map((s) => (
        <div key={s.id} className="border-t border-border pt-6">
          <h2 className="display text-xl">{s.name}</h2>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">{s.blurb}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <NumberField
              label={`Base price (${business.policies.currency})`}
              value={s.basePrice}
              step={10}
              onChange={(v) => updateBusiness((b) => editServices(b, s.id, { basePrice: v }))}
            />
            <NumberField
              label="Base duration (min)"
              value={s.baseDuration}
              step={15}
              onChange={(v) => updateBusiness((b) => editServices(b, s.id, { baseDuration: v }))}
            />
            <NumberField
              label="Deposit (%)"
              value={s.depositPercent}
              step={5}
              onChange={(v) => updateBusiness((b) => editServices(b, s.id, { depositPercent: v }))}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function QuestionsTab() {
  const { business, updateBusiness } = useNook();
  const [serviceId, setServiceId] = useState(business.services[0].id);
  const service = business.services.find((s) => s.id === serviceId) ?? business.services[0];

  const patchOption = (
    questionId: string,
    optionId: string,
    patch: Partial<NonNullable<typeof service.questions[number]["options"]>[number]>,
  ) =>
    updateBusiness((b) => ({
      ...b,
      services: b.services.map((s) =>
        s.id !== serviceId
          ? s
          : {
              ...s,
              questions: s.questions.map((q) =>
                q.id !== questionId
                  ? q
                  : {
                      ...q,
                      options: q.options?.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
                    },
              ),
            },
      ),
    }));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {business.services.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setServiceId(s.id)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm transition-colors",
              s.id === serviceId ? "border-brand bg-brand-soft/60" : "border-border hover:bg-secondary",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      <p className="mt-6 max-w-lg text-sm text-muted-foreground">
        Every answer can move the price, the time, the skills required, and whether you see the
        request before it lands in the book.
      </p>

      <div className="mt-6 space-y-8">
        {service.questions.map((q) => (
          <div key={q.id} className="border-t border-border pt-5">
            <h3 className="text-base font-semibold">{q.label}</h3>
            {q.type === "scale" ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Slider {q.min}–{q.max}
                {q.unit}. {formatMoney(q.pricePerUnit ?? 0, business.policies.currency)} and{" "}
                {q.durationPerUnit ?? 0} min per {q.unit} above {q.min}
                {q.unit}.
              </p>
            ) : q.type === "text" ? (
              <p className="mt-2 text-sm text-muted-foreground">Free text. No effect on price.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 font-medium">Answer</th>
                      <th className="pb-2 font-medium">+ Price</th>
                      <th className="pb-2 font-medium">+ Min</th>
                      <th className="pb-2 font-medium">Skills</th>
                      <th className="pb-2 font-medium">Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {q.options?.map((o) => (
                      <tr key={o.id}>
                        <td className="py-2 pr-4">{o.label}</td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            value={o.priceDelta ?? 0}
                            step={10}
                            onChange={(e) =>
                              patchOption(q.id, o.id, { priceDelta: Number(e.target.value) })
                            }
                            className="min-h-9 w-20 rounded-sm border border-border bg-card px-2 tabular-nums outline-none focus:border-brand"
                          />
                          {o.priceFactor && (
                            <span className="ml-2 text-xs text-muted-foreground">×{o.priceFactor}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            value={o.durationDelta ?? 0}
                            step={5}
                            onChange={(e) =>
                              patchOption(q.id, o.id, { durationDelta: Number(e.target.value) })
                            }
                            className="min-h-9 w-20 rounded-sm border border-border bg-card px-2 tabular-nums outline-none focus:border-brand"
                          />
                          {o.durationFactor && (
                            <span className="ml-2 text-xs text-muted-foreground">×{o.durationFactor}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {o.requiresSkills?.join(", ") ?? "—"}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => patchOption(q.id, o.id, { requiresReview: !o.requiresReview })}
                            className={cn(
                              "min-h-9 rounded-full border px-3 text-xs transition-colors",
                              o.requiresReview
                                ? "border-brand bg-brand-soft/60"
                                : "border-border text-muted-foreground hover:bg-secondary",
                            )}
                          >
                            {o.requiresReview ? "Review" : "Auto"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamTab() {
  const { business, updateBusiness } = useNook();

  const patchMember = (id: string, patch: Partial<BusinessConfig["team"][number]>) =>
    updateBusiness((b) => ({
      ...b,
      team: b.team.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));

  return (
    <div className="space-y-8">
      <p className="max-w-lg text-sm text-muted-foreground">
        Skills decide who can be offered for a job. Hours and days decide when.
      </p>
      {business.team.map((m) => (
        <div key={m.id} className="border-t border-border pt-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-sand text-sm font-semibold">
              {m.initials}
            </span>
            <div>
              <h2 className="display text-lg">{m.name}</h2>
              <p className="text-sm text-muted-foreground">{m.role}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {weekdays.map((label, index) => {
              const on = m.days.includes(index);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    patchMember(m.id, {
                      days: on ? m.days.filter((d) => d !== index) : [...m.days, index].sort(),
                    })
                  }
                  className={cn(
                    "min-h-11 min-w-11 rounded-sm border px-2 text-xs transition-colors",
                    on ? "border-brand bg-brand-soft/60" : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="eyebrow mb-2 block">Starts</span>
              <input
                type="time"
                value={m.start}
                onChange={(e) => patchMember(m.id, { start: e.target.value })}
                className="min-h-11 w-full rounded-sm border border-border bg-card px-3 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-2 block">Ends</span>
              <input
                type="time"
                value={m.end}
                onChange={(e) => patchMember(m.id, { end: e.target.value })}
                className="min-h-11 w-full rounded-sm border border-border bg-card px-3 text-sm outline-none focus:border-brand"
              />
            </label>
            <NumberField
              label="Longest sitting (min)"
              value={m.maxSession}
              step={30}
              onChange={(v) => patchMember(m.id, { maxSession: v })}
            />
          </div>

          <div className="mt-4">
            <span className="eyebrow">Skills</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["fineline", "blackwork", "colour", "lettering", "coverup", "exposed-placement"].map(
                (skill) => {
                  const on = m.skills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() =>
                        patchMember(m.id, {
                          skills: on ? m.skills.filter((s) => s !== skill) : [...m.skills, skill],
                        })
                      }
                      className={cn(
                        "min-h-9 rounded-full border px-3 text-xs transition-colors",
                        on ? "border-brand bg-brand-soft/60" : "border-border text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {skill}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PoliciesTab() {
  const { business, updateBusiness } = useNook();
  const p = business.policies;

  const patch = (value: Partial<typeof p>) =>
    updateBusiness((b) => ({ ...b, policies: { ...b.policies, ...value } }));

  return (
    <div className="max-w-2xl space-y-8">
      <p className="text-sm text-muted-foreground">
        Anything outside these limits comes to you before it is confirmed.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Auto-approve under"
          value={p.autoApproveUnder}
          step={50}
          suffix={p.currency}
          onChange={(v) => patch({ autoApproveUnder: v })}
        />
        <NumberField
          label="Auto-approve up to (min)"
          value={p.autoApproveMaxDuration}
          step={30}
          onChange={(v) => patch({ autoApproveMaxDuration: v })}
        />
        <NumberField
          label="Lead time (days)"
          value={p.leadTimeDays}
          onChange={(v) => patch({ leadTimeDays: v })}
        />
        <NumberField
          label="Free cancellation (hours)"
          value={p.cancellationHours}
          step={12}
          onChange={(v) => patch({ cancellationHours: v })}
        />
      </div>

      <label className="block">
        <span className="eyebrow mb-2 block">What customers are told about review</span>
        <textarea
          rows={3}
          value={p.reviewNote}
          onChange={(e) => patch({ reviewNote: e.target.value })}
          className="w-full rounded-sm border border-border bg-card p-3 text-sm outline-none focus:border-brand"
        />
      </label>
    </div>
  );
}
