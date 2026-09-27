import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronRight,
  ListChecks,
  Home,
  Images,
  LogOut,
  RotateCcw,
  Settings,
  Unplug,
  Upload,
  UsersRound,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NookProvider, useNook } from "@/lib/nook/store";
import { describeOptionEffect, formatDuration, formatMoney } from "@/lib/nook/engine";
import type { BookingRequest, BusinessConfig } from "@/lib/nook/types";
import { artistImage } from "@/lib/nook/artist-images";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/nook/wordmark";
import botanical from "@/assets/flash-botanical.jpg";
import moth from "@/assets/flash-moth.jpg";
import sun from "@/assets/flash-sun.jpg";
import swallow from "@/assets/flash-swallow.jpg";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Studio settings | Nook" },
      {
        name: "description",
        content:
          "Review unusual requests and tune services, pricing rules, questions, team skills and booking policies.",
      },
      { property: "og:title", content: "Studio settings | Nook" },
      {
        property: "og:description",
        content: "Approve or edit requests, and decide what each answer does to price and time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerRoute,
});

function OwnerRoute() {
  return (
    <NookProvider>
      <OwnerPage />
    </NookProvider>
  );
}

const tabs = [
  "Overview",
  "Bookings",
  "Availability",
  "Services",
  "Questions",
  "Team",
  "Flash",
  "Policies",
] as const;
type Tab = (typeof tabs)[number];

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const tabIntro: Record<Tab, { title: string; lead: string }> = {
  Overview: { title: "", lead: "" },
  Bookings: {
    title: "Bookings",
    lead: "Approve, adjust or decline requests. Standard ones confirm on their own.",
  },
  Availability: {
    title: "Availability",
    lead: "When each person works. Nook only offers slots long enough for the job.",
  },
  Services: {
    title: "Services",
    lead: "The starting price and time for each service. Answers move them from there.",
  },
  Questions: {
    title: "Questions",
    lead: "What customers are asked, and what each answer changes.",
  },
  Team: {
    title: "Team",
    lead: "Skills decide who can take a job. Days and hours decide when.",
  },
  Flash: {
    title: "Flash book",
    lead: "Ready-made designs customers can pick while booking.",
  },
  Policies: {
    title: "Policies",
    lead: "What confirms on its own, and what customers agree to when they book.",
  },
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

function OwnerPage() {
  const { business, requests, resetAll } = useNook();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("Overview");
  const pending = requests.filter((r) => r.status === "pending").length;
  const metaName: unknown = user.user_metadata?.["display_name"];
  const displayName =
    (typeof metaName === "string" && metaName.trim()) || user.email?.split("@")[0] || "there";
  const initials = displayName
    .split(/\s+/)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
  const signOut = async () => {
    await supabase.auth.signOut();
    await navigate({ to: "/auth", search: { notice: undefined }, replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-7xl border-x border-border bg-card lg:grid-cols-[14rem_1fr]">
        <aside className="border-b border-border bg-background p-4 lg:border-b-0 lg:border-r lg:p-5">
          <div className="lg:sticky lg:top-5">
            <div className="flex items-center justify-between lg:block">
              <div>
                <Wordmark />
                <p className="mt-1 hidden text-xs text-muted-foreground lg:block">
                  {business.name}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={signOut}>
                <LogOut />
                <span className="sr-only">Sign out</span>
              </Button>
            </div>
            <nav className="mt-4 flex gap-1 overflow-x-auto [scrollbar-width:none] lg:mt-8 lg:block lg:space-y-1">
              {tabs.map((item) => {
                const Icon = tabIcons[item];
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    aria-current={tab === item ? "page" : undefined}
                    className={cn(
                      "flex h-10 shrink-0 items-center gap-2.5 rounded-sm border px-3 text-sm transition-colors lg:w-full",
                      tab === item
                        ? "nook-selected font-semibold text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {item}
                    {item === "Bookings" && pending > 0 && (
                      <span className="ml-auto rounded-full bg-brand px-1.5 font-mono text-xs text-brand-foreground">
                        {pending}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="mt-8 hidden border-t border-border pt-5 lg:block">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-full bg-ink font-mono text-xs font-semibold text-brand-foreground"
                >
                  {initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">Owner</span>
                </span>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-foreground pb-6">
            <div className="max-w-xl">
              {tab === "Overview" ? (
                <>
                  <h1 className="display text-balance text-3xl sm:text-4xl">
                    {greeting()}, {displayName}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {pending > 0
                      ? `${pending} request${pending > 1 ? "s" : ""} waiting on you.`
                      : "Nothing waiting for review."}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="display text-3xl sm:text-4xl">{tabIntro[tab].title}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">{tabIntro[tab].lead}</p>
                </>
              )}
            </div>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                resetAll();
                toast.success("Demo data reset");
              }}
              className="min-h-10"
            >
              <RotateCcw className="size-3.5" /> Reset demo
            </Button>
          </div>

          <div className="nook-enter py-8" key={tab}>
            {tab === "Overview" && <OverviewTab onOpen={setTab} />}
            {tab === "Bookings" && <RequestsTab />}
            {tab === "Availability" && <AvailabilityTab />}
            {tab === "Services" && <ServicesTab />}
            {tab === "Questions" && <QuestionsTab />}
            {tab === "Team" && <TeamTab />}
            {tab === "Flash" && <FlashTab />}
            {tab === "Policies" && <PoliciesTab />}
          </div>
        </main>
      </div>
    </div>
  );
}

const tabIcons: Record<Tab, typeof Home> = {
  Overview: Home,
  Bookings: CalendarRange,
  Availability: CalendarDays,
  Services: Tag,
  Questions: ListChecks,
  Team: UsersRound,
  Flash: Images,
  Policies: Settings,
};

const formatWhen = (date: string, time: string) =>
  `${new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}, ${time}`;

function OverviewTab({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const { business, requests } = useNook();
  const pending = requests.filter((request) => request.status === "pending");
  const confirmed = requests.filter((request) => request.status === "confirmed");
  const upcoming = requests
    .filter((request) => request.status !== "declined")
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 5);
  const currency = business.policies.currency;
  const tiles: { title: string; count: number; detail: string; tab: Tab; urgent?: boolean }[] = [
    {
      title: "Needs your review",
      count: pending.length,
      detail: pending[0] ? `Next: ${pending[0].customerName}` : "Nothing waiting",
      tab: "Bookings",
      urgent: pending.length > 0,
    },
    {
      title: "Confirmed",
      count: confirmed.length,
      detail: confirmed[0] ? `Latest: ${confirmed[0].customerName}` : "No bookings yet",
      tab: "Bookings",
    },
    {
      title: "Flash designs",
      count: flashDesigns.length,
      detail: "Ready to book",
      tab: "Flash",
    },
  ];

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-3">
        {tiles.map((tile) => (
          <button
            key={tile.title}
            type="button"
            onClick={() => onOpen(tile.tab)}
            className={cn(
              "nook-choice nook-lift flex min-h-44 flex-col justify-between border border-border p-5 text-left",
              tile.urgent && "nook-selected",
            )}
          >
            <span className="flex w-full items-center justify-between text-sm font-semibold">
              {tile.title}
              <ChevronRight className="size-4 text-muted-foreground" />
            </span>
            <span
              className={cn(
                "font-mono text-5xl font-semibold tabular-nums",
                tile.urgent && "text-brand",
              )}
            >
              {tile.count}
            </span>
            <span className="text-xs text-muted-foreground">{tile.detail}</span>
          </button>
        ))}
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="font-display text-xl font-semibold">Coming up</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No bookings yet. They appear here as soon as customers book.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {upcoming.map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-4 py-3.5">
                  <span className="min-w-0">
                    <span className="block font-mono text-xs text-muted-foreground">
                      {formatWhen(request.date, request.time)}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold">
                      {request.customerName}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        {business.services.find((service) => service.id === request.serviceId)
                          ?.name ?? ""}
                      </span>
                    </span>
                  </span>
                  <StatusPill status={request.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Booking rules</h2>
            <button
              type="button"
              onClick={() => onOpen("Policies")}
              className="text-xs font-medium underline-offset-4 hover:underline"
            >
              Edit
            </button>
          </div>
          <dl className="nook-ticket mt-4 space-y-3 p-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Confirms on its own under</dt>
              <dd className="font-mono tabular-nums">
                {formatMoney(business.policies.autoApproveUnder, currency)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">and up to</dt>
              <dd className="font-mono tabular-nums">
                {formatDuration(business.policies.autoApproveMaxDuration)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Deposit due within</dt>
              <dd className="font-mono tabular-nums">{business.policies.depositDueHours} hr</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Team</dt>
              <dd className="font-mono tabular-nums">{business.team.length} people</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Calendar sync</dt>
              <dd className="text-brand">Not connected</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

function AvailabilityTab() {
  const { business } = useNook();
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <section>
        <p className="max-w-xl text-sm text-muted-foreground">
          Change days and hours in Team. Each row below is what customers can book into.
        </p>
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {business.team.map((member) => (
            <li
              key={member.id}
              className="grid items-center gap-3 py-4 sm:grid-cols-[10rem_1fr_auto]"
            >
              <span className="font-medium">{member.name}</span>
              <span className="flex flex-wrap gap-1">
                {weekdays.map((day, index) => (
                  <span
                    key={day}
                    className={cn(
                      "inline-flex h-7 min-w-9 items-center justify-center rounded-sm border px-1.5 text-xs",
                      member.days.includes(index)
                        ? "border-foreground font-medium"
                        : "border-transparent text-muted-foreground/60",
                    )}
                  >
                    {day}
                  </span>
                ))}
              </span>
              <span className="font-mono text-sm tabular-nums">
                {member.start}-{member.end}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <aside className="h-fit rounded-sm border border-border bg-background p-5">
        <CalendarDays className="size-5" />
        <h2 className="mt-4 font-semibold">Google Calendar</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Connect the studio calendar to remove busy times from customer availability.
        </p>
        <Button className="mt-5 w-full" variant="outline" disabled>
          <Unplug /> Not connected
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Calendar access was not approved during setup.
        </p>
      </aside>
    </div>
  );
}

const flashDesigns = [
  { id: "botanical", title: "Wildflower stem", price: 160, duration: 75, image: botanical },
  { id: "moth", title: "Night moth", price: 220, duration: 120, image: moth },
  { id: "sun", title: "Ornamental sun", price: 190, duration: 90, image: sun },
  { id: "swallow", title: "Fine-line swallow", price: 180, duration: 90, image: swallow },
];

function FlashTab() {
  const currency = useNook().business.policies.currency;
  const [uploads, setUploads] = useState<{ name: string; url: string }[]>([]);
  const upload = async (files: File[]) => {
    for (const file of files) {
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: storageError } = await supabase.storage
        .from("flash-gallery")
        .upload(path, file);
      if (storageError) {
        toast.error(storageError.message);
        continue;
      }
      const { error: rowError } = await supabase.from("flash_designs").insert({
        title: file.name.replace(/\.[^.]+$/, ""),
        image_path: path,
        price: 150,
        duration_minutes: 90,
      });
      if (rowError) {
        toast.error(rowError.message);
        continue;
      }
      const { data } = await supabase.storage.from("flash-gallery").createSignedUrl(path, 3600);
      if (data?.signedUrl)
        setUploads((current) => [...current, { name: file.name, url: data.signedUrl }]);
      toast.success(`${file.name} added to the flash book`);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Each design can be booked once. New uploads start at {formatMoney(150, currency)} and 1 hr
          30 min.
        </p>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm bg-ink px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand">
          <Upload className="size-4" />
          Upload design
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => void upload(Array.from(event.target.files ?? []))}
          />
        </label>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {flashDesigns.map((design) => (
          <article key={design.id} className="nook-choice overflow-hidden border border-border">
            <img
              src={design.image}
              alt={design.title}
              loading="lazy"
              width={912}
              height={1104}
              className="aspect-[4/5] w-full object-cover"
            />
            <div className="border-t border-border p-3">
              <h3 className="text-sm font-semibold">{design.title}</h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {formatMoney(design.price, currency)}, {formatDuration(design.duration)}
              </p>
            </div>
          </article>
        ))}
        {uploads.map((item) => (
          <article key={item.url} className="nook-choice nook-selected overflow-hidden border">
            <img src={item.url} alt={item.name} className="aspect-[4/5] w-full object-cover" />
            <p className="truncate border-t border-border p-3 text-xs">
              <span className="font-semibold">New</span> {item.name}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

const statusGroups: { status: BookingRequest["status"]; title: string; empty: string }[] = [
  { status: "pending", title: "Needs your review", empty: "Nothing waiting for review." },
  { status: "confirmed", title: "Confirmed", empty: "No confirmed bookings yet." },
  { status: "declined", title: "Declined", empty: "" },
];

function RequestsTab() {
  const { business, requests, setRequestStatus, updateRequest } = useNook();
  const [editing, setEditing] = useState<string | null>(null);
  const currency = business.policies.currency;

  if (requests.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No bookings yet. Try the customer flow and they will show up here.
      </p>
    );

  return (
    <div className="space-y-12">
      {statusGroups.map((group) => {
        const items = requests
          .filter((r) => r.status === group.status)
          .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
        if (items.length === 0 && !group.empty) return null;
        return (
          <section key={group.status}>
            <h2 className="flex items-baseline gap-2 font-display text-xl font-semibold">
              {group.title}
              <span className="font-mono text-sm font-normal text-muted-foreground">
                {items.length}
              </span>
            </h2>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{group.empty}</p>
            ) : (
              <div className="mt-4 space-y-3">
                {items.map((r) => {
                  const member = business.team.find((m) => m.id === r.memberId);
                  const service = business.services.find((s) => s.id === r.serviceId);
                  const isPending = r.status === "pending";
                  return (
                    <article
                      key={r.id}
                      className={cn(
                        "rounded-sm border bg-card p-5",
                        isPending ? "nook-ticket" : "border-border",
                        r.status === "declined" && "opacity-70",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-lg font-semibold">{r.customerName}</h3>
                            <StatusPill status={r.status} />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {service?.name} with {member?.name ?? "no one yet"}
                          </p>
                          <p className="mt-1 font-mono text-sm">{formatWhen(r.date, r.time)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-lg font-semibold tabular-nums">
                            {r.quote.high === 0
                              ? "Free"
                              : `${formatMoney(r.quote.low, currency)}-${formatMoney(r.quote.high, currency)}`}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {formatDuration(r.quote.duration)}
                          </p>
                        </div>
                      </div>

                      {r.memberId === "unassigned" && (
                        <p className="mt-3 rounded-sm border border-brand/50 bg-background px-3 py-2 text-xs">
                          No artist matched automatically. The date and time are the customer&apos;s
                          preference, not a held slot. Pick an artist and a real time with Edit
                          quote.
                        </p>
                      )}
                      {r.notes && (
                        <p className="mt-3 max-w-lg text-sm text-foreground/80">
                          &ldquo;{r.notes}&rdquo;
                        </p>
                      )}

                      {isPending && r.quote.reviewReasons.length > 0 && (
                        <div className="mt-4 border-t border-dashed border-border pt-3">
                          <p className="eyebrow">Why it needs you</p>
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                            {r.quote.reviewReasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {isPending && (
                        <div className="mt-5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRequestStatus(r.id, "confirmed");
                              toast.success(
                                `${r.customerName} confirmed. The deposit link goes out by email.`,
                              );
                            }}
                            className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-ink px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand"
                          >
                            <Check className="size-4" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(editing === r.id ? null : r.id)}
                            aria-expanded={editing === r.id}
                            className="min-h-11 rounded-sm border border-foreground px-5 text-sm transition-colors hover:bg-background"
                          >
                            Edit quote
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRequestStatus(r.id, "declined");
                              toast("Request declined");
                            }}
                            className="inline-flex min-h-11 items-center gap-2 rounded-sm px-4 text-sm text-muted-foreground transition-colors hover:text-destructive"
                          >
                            <X className="size-4" /> Decline
                          </button>
                          {r.quote.deposit > 0 && (
                            <p className="w-full pt-1 text-xs text-muted-foreground">
                              Approving emails {r.customerName} a link to pay the{" "}
                              {formatMoney(r.quote.deposit, currency)} deposit within{" "}
                              {business.policies.depositDueHours} hours.
                            </p>
                          )}
                        </div>
                      )}

                      {editing === r.id && (
                        <EditQuote
                          request={r}
                          onSave={updateRequest}
                          onDone={() => setEditing(null)}
                        />
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
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
  const [memberId, setMemberId] = useState(
    business.team.some((m) => m.id === request.memberId)
      ? request.memberId
      : (business.team[0]?.id ?? request.memberId),
  );

  return (
    <div className="mt-5 grid gap-4 rounded-sm border border-border bg-background p-5 sm:grid-cols-4">
      <NumberField label="Low" value={low} onChange={setLow} />
      <NumberField label="High" value={high} onChange={setHigh} />
      <NumberField label="Minutes" value={duration} step={15} onChange={setDuration} />
      <label className="block">
        <span className="eyebrow mb-2 block">Artist</span>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="min-h-11 w-full rounded-sm border border-input bg-card px-2 text-sm outline-none focus:border-foreground"
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
            toast.success("Quote updated and confirmed. The deposit link goes out by email.");
            onDone();
          }}
          className="min-h-11 rounded-sm bg-ink px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand"
        >
          Save & confirm
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: BookingRequest["status"] }) {
  const map = {
    confirmed: "border-highlight/40 text-highlight",
    pending: "border-brand/50 text-brand",
    declined: "border-border text-muted-foreground",
  } as const;
  return (
    <span
      className={cn(
        "rounded-full border bg-card px-2.5 py-0.5 font-mono text-xs font-medium capitalize",
        map[status],
      )}
    >
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
          className="min-h-11 w-full rounded-sm border border-input bg-card px-3 font-mono text-sm tabular-nums outline-none focus:border-foreground"
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
    <div className="space-y-4">
      {business.services.map((s) => (
        <div key={s.id} className="rounded-sm border border-border bg-card p-5">
          <h2 className="font-display text-xl font-semibold">{s.name}</h2>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">{s.blurb}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
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
  const [serviceId, setServiceId] = useState(business.services[0]?.id ?? "tattoo");
  const service = business.services.find((s) => s.id === serviceId) ?? business.services[0];

  if (!service)
    return <p className="text-sm text-muted-foreground">Add a service to edit its questions.</p>;

  const patchOption = (
    questionId: string,
    optionId: string,
    patch: Partial<NonNullable<(typeof service.questions)[number]["options"]>[number]>,
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
                      ...(q.options
                        ? {
                            options: q.options.map((o) =>
                              o.id === optionId ? { ...o, ...patch } : o,
                            ),
                          }
                        : {}),
                    },
              ),
            },
      ),
    }));

  return (
    <div>
      <div role="tablist" aria-label="Service" className="flex flex-wrap gap-2">
        {business.services.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === serviceId}
            onClick={() => setServiceId(s.id)}
            className={cn(
              "min-h-10 rounded-sm border px-4 text-sm transition-colors",
              s.id === serviceId
                ? "border-foreground bg-ink text-brand-foreground"
                : "border-border hover:border-foreground",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      <p className="mt-6 max-w-xl text-sm text-muted-foreground">
        Each answer can change the price, the time, who can do the job, and whether you check the
        request first. &ldquo;Customer sees&rdquo; is exactly what shows on the booking page.
      </p>

      <div className="mt-6 space-y-4">
        {service.questions.map((q, index) => (
          <div key={q.id} className="rounded-sm border border-border bg-card p-5">
            <h3 className="flex gap-3 text-base font-semibold">
              <span className="font-mono text-sm text-brand">
                {String(index + 1).padStart(2, "0")}
              </span>
              {q.label}
            </h3>
            {q.type === "scale" ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Slider {q.min}-{q.max}
                {q.unit}. {formatMoney(q.pricePerUnit ?? 0, business.policies.currency)} and{" "}
                {q.durationPerUnit ?? 0} min per {q.unit} above {q.min}
                {q.unit}.
              </p>
            ) : q.type === "text" ? (
              <p className="mt-2 text-sm text-muted-foreground">Free text. No effect on price.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="eyebrow pb-2">Answer</th>
                      <th className="eyebrow pb-2">+ Price</th>
                      <th className="eyebrow pb-2">+ Min</th>
                      <th className="eyebrow pb-2">Customer sees</th>
                      <th className="eyebrow pb-2">Skills</th>
                      <th className="eyebrow pb-2">Check first</th>
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
                            className="min-h-9 w-20 rounded-sm border border-input bg-card px-2 font-mono tabular-nums outline-none focus:border-foreground"
                          />
                          {o.priceFactor && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ×{o.priceFactor}
                            </span>
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
                            className="min-h-9 w-20 rounded-sm border border-input bg-card px-2 font-mono tabular-nums outline-none focus:border-foreground"
                          />
                          {o.durationFactor && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ×{o.durationFactor}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs text-brand">
                          {describeOptionEffect(o, business.policies.currency) || (
                            <span className="text-muted-foreground">No change</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {o.requiresSkills?.join(", ") ?? "None"}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() =>
                              patchOption(q.id, o.id, { requiresReview: !o.requiresReview })
                            }
                            className={cn(
                              "min-h-9 rounded-sm border px-3 text-xs transition-colors",
                              o.requiresReview
                                ? "nook-selected font-medium"
                                : "border-border text-muted-foreground hover:bg-secondary",
                            )}
                          >
                            {o.requiresReview ? "Yes" : "No"}
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
    <div className="space-y-4">
      {business.team.map((m) => (
        <div key={m.id} className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            {artistImage(m.id) ? (
              <img
                src={artistImage(m.id)}
                alt={`Portrait of ${m.name}`}
                loading="lazy"
                width={816}
                height={816}
                className="size-12 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-12 items-center justify-center rounded-full bg-sand text-sm font-semibold">
                {m.initials}
              </span>
            )}
            <div>
              <h2 className="font-display text-lg font-semibold">{m.name}</h2>
              <p className="text-sm text-muted-foreground">{m.role}</p>
            </div>
          </div>
          <label className="mt-5 block max-w-md">
            <span className="eyebrow mb-2 block">Portfolio link</span>
            <input
              type="url"
              value={m.portfolioUrl ?? ""}
              onChange={(e) => patchMember(m.id, { portfolioUrl: e.target.value })}
              placeholder="https://instagram.com/…"
              className="min-h-10 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none focus:border-foreground"
            />
          </label>

          <p className="eyebrow mt-5">Working days</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
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
                    on
                      ? "nook-selected font-medium"
                      : "border-border text-muted-foreground hover:bg-secondary",
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
                className="min-h-11 w-full rounded-sm border border-input bg-card px-3 font-mono text-sm outline-none focus:border-foreground"
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-2 block">Ends</span>
              <input
                type="time"
                value={m.end}
                onChange={(e) => patchMember(m.id, { end: e.target.value })}
                className="min-h-11 w-full rounded-sm border border-input bg-card px-3 font-mono text-sm outline-none focus:border-foreground"
              />
            </label>
            <NumberField
              label="Longest sitting (min)"
              value={m.maxSession}
              step={30}
              onChange={(v) => patchMember(m.id, { maxSession: v })}
            />
          </div>

          <div className="mt-5">
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
                        "min-h-9 rounded-sm border px-3 text-xs transition-colors",
                        on
                          ? "nook-selected font-medium"
                          : "border-border text-muted-foreground hover:bg-secondary",
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
    <div className="max-w-3xl space-y-4">
      <PolicyGroup
        title="Confirms on its own"
        lead="Requests inside both limits get a confirmation email straight away. Anything else comes to you first."
      >
        <NumberField
          label="Price under"
          value={p.autoApproveUnder}
          step={50}
          suffix={p.currency}
          onChange={(v) => patch({ autoApproveUnder: v })}
        />
        <NumberField
          label="Length up to (min)"
          value={p.autoApproveMaxDuration}
          step={30}
          onChange={(v) => patch({ autoApproveMaxDuration: v })}
        />
      </PolicyGroup>

      <PolicyGroup
        title="Deposit"
        lead="The confirmation email carries a payment link. The percentage is set per service in Services."
      >
        <NumberField
          label="Due within (hours)"
          value={p.depositDueHours}
          step={12}
          onChange={(v) => patch({ depositDueHours: v })}
        />
        <NumberField
          label="Free cancellation (hours)"
          value={p.cancellationHours}
          step={12}
          onChange={(v) => patch({ cancellationHours: v })}
        />
      </PolicyGroup>

      <PolicyGroup title="Scheduling" lead="How far ahead customers can book.">
        <NumberField
          label="Earliest booking (days ahead)"
          value={p.leadTimeDays}
          onChange={(v) => patch({ leadTimeDays: v })}
        />
      </PolicyGroup>

      <section className="rounded-sm border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Message about review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shown to customers whose request comes to you first.
        </p>
        <textarea
          rows={3}
          value={p.reviewNote}
          onChange={(e) => patch({ reviewNote: e.target.value })}
          aria-label="Message about review"
          className="mt-4 w-full rounded-sm border border-input bg-background p-3 text-sm outline-none focus:border-foreground"
        />
      </section>
    </div>
  );
}

function PolicyGroup({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">{lead}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
