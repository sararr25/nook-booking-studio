import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronRight,
  ListChecks,
  Loader2,
  Home,
  Images,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Settings,
  Upload,
  UsersRound,
  Tag,
  Trash2,
  X,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NookProvider, useNook, type SaveState } from "@/lib/nook/store";
import { buildQuote, describeOptionEffect, formatDuration, formatMoney } from "@/lib/nook/engine";
import type { BookingRequest, BusinessConfig, TeamMember } from "@/lib/nook/types";
import { artistImage, toAvatarDataUrl } from "@/lib/nook/artist-images";
import { supabase } from "@/integrations/supabase/client";
import { loadFlashDesigns, studioFlashArtwork } from "@/lib/nook/flash";
import { getCalendarBusy } from "@/lib/nook/booking-emails.functions";
import { OwnerCalendar } from "@/components/nook/owner-calendar";
import { OwnerAddBooking } from "@/components/nook/owner-add-booking";
import { OwnerArchive } from "@/components/nook/owner-archive";
import { PricingImport } from "@/components/nook/pricing-import";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Wordmark } from "@/components/nook/wordmark";

const tabs = [
  "Overview",
  "Bookings",
  "Availability",
  "Pricing",
  "Questions",
  "Team",
  "Flash",
  "Policies",
] as const;
type Tab = (typeof tabs)[number];

/** Overview has no slug so /owner stays the home of the panel. */
const tabSlug = (tab: Tab) => (tab === "Overview" ? undefined : tab.toLowerCase());
const tabFromSlug = (slug: unknown): Tab =>
  slug === "services"
    ? "Pricing"
    : (tabs.find((tab) => tab !== "Overview" && tab.toLowerCase() === slug) ?? "Overview");

export const Route = createFileRoute("/_authenticated/owner")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => {
    const slug = tabSlug(tabFromSlug(search["tab"]));
    return slug ? { tab: slug } : {};
  },
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
    <NookProvider includeBookings>
      <OwnerPage />
    </NookProvider>
  );
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const tabIntro: Record<Tab, { title: string; lead: string }> = {
  Overview: { title: "", lead: "" },
  Bookings: {
    title: "Bookings",
    lead: "Review requests, track deposits and see confirmed appointments.",
  },
  Availability: {
    title: "Availability",
    lead: "When each person works. Nook only offers slots long enough for the job.",
  },
  Pricing: {
    title: "Pricing",
    lead: "Set each service's starting price, then adjust answer-based rules in Questions.",
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
  const { business, requests, saveState, loaded, loadError } = useNook();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const tab = tabFromSlug(Route.useSearch().tab);
  const openTab = (next: Tab) => {
    const slug = tabSlug(next);
    void navigate({ to: "/owner", search: slug ? { tab: slug } : {} });
  };
  // Each section starts at the top, not wherever the previous one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
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
            <label className="mt-4 block lg:hidden">
              <span className="mb-1 block text-xs font-medium">Owner section</span>
              <select
                value={tab}
                onChange={(event) => openTab(event.target.value as Tab)}
                className="min-h-11 w-full border border-border bg-card px-3 text-sm"
              >
                {tabs.map((item) => (
                  <option key={item} value={item}>
                    {item}
                    {item === "Bookings" && pending ? ` (${pending} to review)` : ""}
                  </option>
                ))}
              </select>
            </label>
            <nav className="mt-8 hidden lg:block lg:space-y-1">
              {tabs.map((item) => {
                const Icon = tabIcons[item];
                const slug = tabSlug(item);
                return (
                  <div key={item}>
                    {(item === "Overview" || item === "Pricing") && (
                      <p className="mb-2 mt-6 px-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        {item === "Overview" ? "Daily work" : "Studio setup"}
                      </p>
                    )}
                    <Link
                      to="/owner"
                      search={slug ? { tab: slug } : {}}
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
                    </Link>
                  </div>
                );
              })}
            </nav>
            <div className="mt-8 hidden border-t border-border pt-5 lg:block">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-full bg-ink font-mono text-xs font-semibold text-primary-foreground"
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
            {tab !== "Overview" && tab !== "Bookings" && <SaveStatus state={saveState} />}
          </div>

          {loadError ? (
            <div role="alert" className="mt-8 max-w-xl rounded-sm border border-destructive/40 p-5">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 text-destructive" /> Could not load your studio
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing is shown or saved until it loads, so your setup stays safe. Check your
                connection and reload.
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">{loadError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={cn(ghostButton, "mt-4")}
              >
                <RotateCcw className="size-4" /> Reload
              </button>
            </div>
          ) : !loaded ? (
            <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading your studio…
            </p>
          ) : (
            <div className="nook-enter py-8" key={tab}>
              {tab === "Overview" && <OverviewTab onOpen={openTab} />}
              {tab === "Bookings" && <RequestsTab />}
              {tab === "Availability" && <AvailabilityTab onOpen={openTab} />}
              {tab === "Pricing" && <ServicesTab />}
              {tab === "Questions" && <QuestionsTab />}
              {tab === "Team" && <TeamTab />}
              {tab === "Flash" && <FlashTab />}
              {tab === "Policies" && <PoliciesTab />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const tabIcons: Record<Tab, typeof Home> = {
  Overview: Home,
  Bookings: CalendarRange,
  Availability: CalendarDays,
  Pricing: Tag,
  Questions: ListChecks,
  Team: UsersRound,
  Flash: Images,
  Policies: Settings,
};

const saveLabels: Record<SaveState, string> = {
  saved: "All changes saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  error: "Not saved. Check your connection",
};

/** Studio setup saves itself; this says where that save is so edits never feel lost. */
function SaveStatus({ state }: { state: SaveState }) {
  const { retrySave } = useNook();
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex min-h-10 items-center gap-2 font-mono text-xs",
        state === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {state === "saving" || state === "unsaved" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : state === "error" ? (
        <AlertTriangle className="size-3.5" />
      ) : (
        <Check className="size-3.5 text-highlight" />
      )}
      {saveLabels[state]}
      {state === "error" && (
        <button type="button" onClick={retrySave} className="ml-2 min-h-10 underline">
          Retry save
        </button>
      )}
    </div>
  );
}

const formatWhen = (date: string, time: string) =>
  `${new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}, ${time}`;

function OverviewTab({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const { business, requests } = useNook();
  const flashQuery = useQuery({
    queryKey: ["owner-flash"],
    queryFn: () => loadFlashDesigns(true),
  });
  const fetchCalendar = useServerFn(getCalendarBusy);
  const calendar = useQuery({
    queryKey: ["owner-google-calendar"],
    queryFn: () => fetchCalendar(),
    staleTime: 60_000,
  });
  const pending = requests.filter((request) => request.status === "pending");
  const awaitingDeposit = requests.filter((request) => request.status === "awaiting_deposit");
  const confirmed = requests.filter((request) => request.status === "confirmed");
  const upcoming = requests
    .filter((request) => request.status !== "declined" && request.date >= todayKey())
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 5);
  const currency = business.policies.currency;
  const tiles: { title: string; count: number; detail: string; tab: Tab; urgent?: boolean }[] = [
    {
      title: "Needs your review",
      count: pending.length,
      detail: pending[0] ? `Next: ${pending[0].customerName}` : "Nothing waiting for review",
      tab: "Bookings",
      urgent: pending.length > 0,
    },
    {
      title: "Awaiting deposit",
      count: awaitingDeposit.length,
      detail: awaitingDeposit[0] ? `Next: ${awaitingDeposit[0].customerName}` : "No deposits due",
      tab: "Bookings",
    },
    {
      title: "Confirmed",
      count: confirmed.length,
      detail: confirmed[0] ? `Latest: ${confirmed[0].customerName}` : "No bookings yet",
      tab: "Bookings",
    },
    {
      title: "Flash designs",
      count:
        flashQuery.data?.filter((design) => design.available && !design.archived_at).length ?? 0,
      detail: "Ready to book",
      tab: "Flash",
    },
  ];

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                tile.urgent && "text-brand-ink",
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
                  <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {!business.team.some((m) => m.id === request.memberId) && <NoArtistPill />}
                    <StatusPill status={request.status} />
                  </span>
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
              <dd className={calendar.data?.connected ? "text-highlight" : "text-destructive"}>
                {calendar.isPending
                  ? "Checking…"
                  : calendar.data?.connected
                    ? "Connected"
                    : "Needs attention"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

function AvailabilityTab({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const { business } = useNook();
  const fetchCalendar = useServerFn(getCalendarBusy);
  const calendar = useQuery({
    queryKey: ["owner-google-calendar"],
    queryFn: () => fetchCalendar(),
    staleTime: 60_000,
  });
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-muted-foreground">
            Each row below is what customers can book into.
          </p>
          <button type="button" onClick={() => onOpen("Team")} className={ghostButton}>
            <Pencil className="size-4" /> Edit days and hours in Team
          </button>
        </div>
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {business.team.map((member) => (
            <li
              key={member.id}
              className="grid items-center gap-3 py-4 sm:grid-cols-[10rem_1fr_auto]"
            >
              <span className="font-medium">{member.name}</span>
              <span className="text-sm">
                {member.days.length === 0 ? (
                  <span className="text-muted-foreground">No working days set</span>
                ) : (
                  [...member.days]
                    .sort()
                    .map((day) => weekdays[day])
                    .join(", ")
                )}
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
          {calendar.isPending
            ? "Checking the studio calendar…"
            : calendar.data?.connected
              ? "Connected to the studio's main calendar. Busy times are checked before booking."
              : "Calendar could not be verified. Customer time selection is paused until it reconnects."}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          When a customer pays the deposit, the appointment is added to the calendar.
        </p>
      </aside>
    </div>
  );
}

function FlashTab() {
  const currency = useNook().business.policies.currency;
  const designs = useQuery({
    queryKey: ["owner-flash"],
    queryFn: () => loadFlashDesigns(true),
  });
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const unpublishedArtwork = studioFlashArtwork.filter(
    (artwork) => !designs.data?.some((design) => design.image_path === artwork.image_path),
  );
  const archiveDesign = async (id: string) => {
    setArchivingId(id);
    const { data, error } = await supabase
      .from("flash_designs")
      .update({ archived_at: new Date().toISOString(), available: false })
      .eq("id", id)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    setArchivingId(null);
    if (error || !data) {
      toast.error(error?.message ?? "This flash could not be deleted. Reload and try again.");
      return;
    }
    await designs.refetch();
    toast.success("Flash deleted from the catalog");
  };
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
      await designs.refetch();
      toast.success(`${file.name} added to the flash book`);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Set a base price for each design. Each published flash can be booked once. New uploads
          start at {formatMoney(150, currency)} and 1 hr 30 min.
        </p>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm bg-ink px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand hover:text-brand-foreground">
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
      {!designs.isLoading && !designs.isError && unpublishedArtwork.length > 0 && (
        <section className="mt-8" aria-labelledby="new-flash-heading">
          <h2 id="new-flash-heading" className="text-xl font-semibold">
            New artwork to price
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These designs stay out of the booking flow until you set a base price and publish them.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {unpublishedArtwork.map((artwork) => (
              <StudioFlashDraft
                key={artwork.image_path}
                artwork={artwork}
                currency={currency}
                onPublished={() => void designs.refetch()}
              />
            ))}
          </div>
        </section>
      )}
      {designs.data && <h2 className="mt-8 text-xl font-semibold">Flash book</h2>}
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {designs.isError && <p role="alert">Could not load flash designs. Reload to try again.</p>}
        {designs.data
          ?.filter((design) => !design.archived_at)
          .map((design) => (
            <article key={design.id} className="nook-choice overflow-hidden border border-border">
              <img
                src={design.imageUrl}
                alt={design.title}
                loading="lazy"
                width={912}
                height={1104}
                className="aspect-[4/5] w-full object-cover"
              />
              <div className="border-t border-border p-3">
                <h3 className="text-sm font-semibold">{design.title}</h3>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {formatMoney(design.price, currency)}, {formatDuration(design.duration_minutes)}
                  {!design.available && " · Reserved"}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs">
                    Base price ({currency})
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={design.price}
                      onBlur={async (event) => {
                        const price = Number(event.target.value);
                        if (!Number.isFinite(price) || price <= 0) {
                          toast.error("Enter a base price above zero");
                          event.target.value = String(design.price);
                          return;
                        }
                        if (price === design.price) return;
                        const { error } = await supabase
                          .from("flash_designs")
                          .update({ price })
                          .eq("id", design.id);
                        if (error) {
                          event.target.value = String(design.price);
                          toast.error(error.message);
                        } else {
                          toast.success("Flash price saved");
                          void designs.refetch();
                        }
                      }}
                      className="mt-1 min-h-10 w-full border border-border bg-card px-2 text-sm"
                    />
                  </label>
                  <label className="text-xs">
                    Minutes
                    <input
                      type="number"
                      min="15"
                      max="720"
                      defaultValue={design.duration_minutes}
                      onBlur={async (event) => {
                        const duration_minutes = Number(event.target.value);
                        if (
                          !Number.isFinite(duration_minutes) ||
                          duration_minutes < 15 ||
                          duration_minutes > 720
                        ) {
                          event.target.value = String(design.duration_minutes);
                          return;
                        }
                        if (duration_minutes === design.duration_minutes) return;
                        const { error } = await supabase
                          .from("flash_designs")
                          .update({ duration_minutes })
                          .eq("id", design.id);
                        if (error) {
                          event.target.value = String(design.duration_minutes);
                          toast.error(error.message);
                        } else {
                          toast.success("Flash time saved");
                          void designs.refetch();
                        }
                      }}
                      className="mt-1 min-h-10 w-full border border-border bg-card px-2 text-sm"
                    />
                  </label>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={archivingId === design.id}
                      className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs text-destructive underline-offset-4 hover:underline disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Delete flash
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {design.title}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the design from the flash book and future bookings. Existing
                        booking records stay intact.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep design</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => void archiveDesign(design.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete flash
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </article>
          ))}
      </div>
    </div>
  );
}

function StudioFlashDraft({
  artwork,
  currency,
  onPublished,
}: {
  artwork: (typeof studioFlashArtwork)[number];
  currency: string;
  onPublished: () => void;
}) {
  const [title, setTitle] = useState<string>(artwork.title);
  const [price, setPrice] = useState("");
  const [minutes, setMinutes] = useState("90");
  const [saving, setSaving] = useState(false);

  const publish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(price);
    const duration = Number(minutes);
    if (!title.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Add a title and a base price above zero");
      return;
    }
    if (!Number.isInteger(duration) || duration < 15 || duration > 720) {
      toast.error("Session length must be between 15 and 720 minutes");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("flash_designs").insert({
      title: title.trim(),
      image_path: artwork.image_path,
      price: amount,
      duration_minutes: duration,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${title.trim()} is now in the flash book`);
    onPublished();
  };

  return (
    <article className="nook-choice overflow-hidden border border-border">
      <img
        src={artwork.imageUrl}
        alt={artwork.title}
        loading="lazy"
        width={1264}
        height={1264}
        className="aspect-[4/5] w-full bg-card object-contain p-3"
      />
      <form
        onSubmit={(event) => void publish(event)}
        className="space-y-3 border-t border-border p-3"
      >
        <label className="block text-xs">
          Design name
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="mt-1 min-h-10 w-full border border-border bg-card px-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Base price ({currency})
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
              className="mt-1 min-h-10 w-full border border-border bg-card px-2 text-sm"
            />
          </label>
          <label className="text-xs">
            Minutes
            <input
              type="number"
              min="15"
              max="720"
              step="1"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              required
              className="mt-1 min-h-10 w-full border border-border bg-card px-2 text-sm"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="min-h-10 w-full rounded-sm bg-ink px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Publishing…" : "Publish flash"}
        </button>
      </form>
    </article>
  );
}

const statusGroups: { status: BookingRequest["status"]; title: string; empty: string }[] = [
  { status: "pending", title: "Needs your review", empty: "Nothing waiting for review." },
  { status: "awaiting_deposit", title: "Pending — awaiting deposit", empty: "No deposits due." },
  { status: "confirmed", title: "Confirmed", empty: "No confirmed bookings yet." },
];

/** Patch where `undefined` removes the key, so optional fields can be cleared. */
type Patch<T> = { [K in keyof T]?: T[K] | undefined };
const applyPatch = <T extends object>(target: T, patch: Patch<T>): T => {
  const next = new Map<string, unknown>(Object.entries(target));
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) next.delete(key);
    else next.set(key, value);
  }
  return Object.fromEntries(next) as T;
};

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

const inputClass =
  "min-h-10 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none focus:border-foreground";

const ghostButton =
  "inline-flex min-h-10 items-center gap-2 rounded-sm border border-border px-3 text-sm transition-colors hover:border-foreground";

const dangerButton =
  "inline-flex min-h-10 items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground transition-colors hover:text-destructive";

function RequestsTab() {
  const { business, requests, setRequestStatus, updateRequest, deleteCancelledNow } = useNook();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "upcoming" | "history">("all");
  const fetchCalendar = useServerFn(getCalendarBusy);
  const calendar = useQuery({
    queryKey: ["owner-google-calendar"],
    queryFn: () => fetchCalendar(),
    enabled: view === "calendar",
    staleTime: 60_000,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ id: string; kind: "decline" | "cancel" } | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const currency = business.policies.currency;
  const today = todayKey();
  const matchesSearch = (r: BookingRequest) =>
    `${r.customerName} ${r.contact} ${r.serviceId} ${r.date} ${r.memberId}`
      .toLowerCase()
      .includes(search.toLowerCase().trim());
  // Finished and cancelled bookings live in folded groups below the live ones.
  const past = requests
    .filter((r) => r.status !== "declined" && r.date < today)
    .filter(matchesSearch);
  const cancelled = requests.filter((r) => r.status === "declined").filter(matchesSearch);

  const visibleGroups = scope === "history" ? [] : statusGroups;

  if (view === "calendar")
    return (
      <div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setView("list")} className={ghostButton}>
            List
          </button>
          <button
            type="button"
            aria-current="page"
            className="nook-selected min-h-11 border px-4 text-sm"
          >
            Calendar
          </button>
        </div>
        <OwnerCalendar
          requests={requests}
          busy={calendar.data?.blocks ?? []}
          connected={calendar.data?.connected === true}
        />
      </div>
    );

  if (requests.length === 0)
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setView("calendar")} className={ghostButton}>
            Calendar view
          </button>
          <OwnerAddBooking />
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          No bookings yet. Try the customer flow and they will show up here.
        </p>
      </div>
    );

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-end gap-2">
        <button
          type="button"
          aria-current="page"
          className="nook-selected min-h-11 border px-4 text-sm"
        >
          List
        </button>
        <button type="button" onClick={() => setView("calendar")} className={ghostButton}>
          <CalendarDays className="size-4" /> Calendar
        </button>
        <OwnerAddBooking />
        <label className="ml-auto text-xs">
          Search bookings
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email, service or date"
            className="mt-1 block min-h-11 w-64 max-w-full border border-border bg-card px-3 text-sm"
          />
        </label>
        <label className="text-xs">
          Show
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as typeof scope)}
            className="mt-1 block min-h-11 border border-border bg-card px-3 text-sm"
          >
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="history">History</option>
          </select>
        </label>
      </div>
      {visibleGroups.map((group) => {
        const items = requests
          .filter((r) => r.status === group.status && r.date >= today)
          .filter(matchesSearch)
          .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
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
                  const isAwaitingDeposit = r.status === "awaiting_deposit";
                  const isConfirmed = r.status === "confirmed";
                  const hasArtist = Boolean(member);
                  return (
                    <article
                      key={r.id}
                      className={cn(
                        "rounded-sm border bg-card p-5",
                        isPending ? "nook-ticket" : "border-border",
                        r.status === "declined" && "opacity-75",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-lg font-semibold">{r.customerName}</h3>
                            <StatusPill status={r.status} />
                            {(isConfirmed || isAwaitingDeposit) && r.quote.deposit > 0 && (
                              <span
                                className={cn(
                                  "border px-2 py-0.5 font-mono text-xs",
                                  r.depositPaidAt
                                    ? "border-highlight/40 text-highlight"
                                    : "border-brand/50 text-brand-ink",
                                )}
                              >
                                {r.depositPaidAt ? "Deposit paid" : "Awaiting deposit"}
                              </span>
                            )}
                            {!hasArtist && r.status !== "declined" && <NoArtistPill />}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {service?.name ?? "Removed service"}
                            {member ? ` with ${member.name}` : ", no artist yet"}
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

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-dashed border-border pt-4">
                        {r.phone ? (
                          <a href={`tel:${r.phone.replace(/\s+/g, "")}`} className={ghostButton}>
                            <Phone className="size-4" />
                            <span className="font-mono">{r.phone}</span>
                          </a>
                        ) : (
                          <span className="inline-flex min-h-10 items-center text-xs text-muted-foreground">
                            No phone given
                          </span>
                        )}
                        {r.contact && (
                          <a
                            href={
                              r.contact.includes("@")
                                ? `mailto:${r.contact}?subject=${encodeURIComponent(`Your booking at ${business.name}`)}`
                                : `tel:${r.contact.replace(/\s+/g, "")}`
                            }
                            className={cn(ghostButton, "min-w-0")}
                          >
                            <Mail className="size-4 shrink-0" />
                            <span className="truncate">{r.contact}</span>
                          </a>
                        )}
                      </div>

                      {!hasArtist && r.status !== "declined" && (
                        <p className="mt-3 flex gap-2 rounded-sm border border-brand/50 bg-background px-3 py-2 text-xs">
                          <AlertTriangle className="size-4 shrink-0 text-brand-ink" />
                          <span>
                            {isConfirmed
                              ? "Confirmed, but nobody is booked to do it. The date and time are only the customer's preference. Pick an artist and a real time with Change booking."
                              : "No artist matched automatically. The date and time are only the customer's preference. Pick an artist and a real time before you approve."}
                          </span>
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

                      {openDetails === r.id && (
                        <div className="mt-4 border-t border-dashed border-border pt-3">
                          <BookingBrief request={r} business={business} />
                          <p className="eyebrow">Quote breakdown</p>
                          {r.quote.lines.length === 0 ? (
                            <p className="mt-2 text-sm text-muted-foreground">No extras.</p>
                          ) : (
                            <dl className="mt-2 space-y-1 text-sm">
                              {r.quote.lines.map((line) => (
                                <div key={line.label} className="flex justify-between gap-4">
                                  <dt>{line.label}</dt>
                                  <dd className="font-mono text-xs text-muted-foreground">
                                    {line.detail}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          )}
                          {r.quote.deposit > 0 && (
                            <p className="mt-2 font-mono text-xs">
                              Deposit {formatMoney(r.quote.deposit, currency)}
                              {r.depositPaidAt ? " · paid" : " · not paid yet"}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        {isPending && (
                          <button
                            type="button"
                            onClick={async () => {
                              // A booking with nobody to do it is not a booking: pick the artist first.
                              if (!hasArtist) {
                                setEditing(r.id);
                                return;
                              }
                              const nextStatus =
                                r.quote.deposit > 0 ? "awaiting_deposit" : "confirmed";
                              if (await setRequestStatus(r.id, nextStatus))
                                toast.success(
                                  nextStatus === "awaiting_deposit"
                                    ? `${r.customerName} approved; awaiting deposit.`
                                    : `${r.customerName} confirmed.`,
                                );
                            }}
                            className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-ink px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand hover:text-brand-foreground"
                          >
                            <Check className="size-4" />
                            {hasArtist ? "Approve" : "Pick artist to approve"}
                          </button>
                        )}
                        {r.status !== "declined" && (
                          <button
                            type="button"
                            onClick={() => setEditing(editing === r.id ? null : r.id)}
                            aria-expanded={editing === r.id}
                            className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-foreground px-5 text-sm transition-colors hover:bg-background"
                          >
                            <Pencil className="size-4" />
                            {isPending ? "Edit quote" : "Change booking"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setOpenDetails(openDetails === r.id ? null : r.id)}
                          aria-expanded={openDetails === r.id}
                          className="min-h-11 rounded-sm px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {openDetails === r.id ? "Hide details" : "Details"}
                        </button>
                        {isPending && (
                          <button
                            type="button"
                            onClick={async () => {
                              setDecision({ id: r.id, kind: "decline" });
                              setDecisionReason("");
                            }}
                            className={cn(dangerButton, "min-h-11")}
                          >
                            <X className="size-4" /> Decline
                          </button>
                        )}
                        {(isConfirmed || isAwaitingDeposit) && (
                          <button
                            type="button"
                            onClick={async () => {
                              setDecision({ id: r.id, kind: "cancel" });
                              setDecisionReason("");
                            }}
                            className={cn(dangerButton, "min-h-11")}
                          >
                            <X className="size-4" /> Cancel booking
                          </button>
                        )}
                        {r.status === "declined" && (
                          <button
                            type="button"
                            onClick={() => void setRequestStatus(r.id, "pending")}
                            className={ghostButton}
                          >
                            <RotateCcw className="size-4" /> Back to review
                          </button>
                        )}
                      </div>

                      {editing === r.id && (
                        <EditBooking
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
      {scope !== "upcoming" && (
        <OwnerArchive
          business={business}
          past={past}
          cancelled={cancelled}
          onBackToReview={(id) => void setRequestStatus(id, "pending")}
          onDeleteCancelled={deleteCancelledNow}
        />
      )}
      <AlertDialog
        open={Boolean(decision)}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision?.kind === "cancel" ? "Cancel this booking?" : "Decline this request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              The booking status will change and Nook will email the customer. You can add a short
              note explaining the decision.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="text-sm font-medium">
            Note to customer
            <textarea
              value={decisionReason}
              onChange={(event) => setDecisionReason(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Optional reason or next step"
              className="mt-2 w-full border border-border bg-card p-3 text-sm"
            />
          </label>
          <p className="border-l-2 border-brand bg-background p-3 text-xs text-muted-foreground">
            Email preview: The studio can’t take this booking.{" "}
            {decisionReason
              ? `Studio note: ${decisionReason}`
              : "The customer can send a new request."}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!decision) return;
                if (await setRequestStatus(decision.id, "declined", decisionReason.trim()))
                  toast(decision.kind === "cancel" ? "Booking cancelled" : "Request declined");
                setDecision(null);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              {decision?.kind === "cancel" ? "Cancel and email" : "Decline and email"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BookingBrief({
  request,
  business,
}: {
  request: BookingRequest;
  business: BusinessConfig;
}) {
  const service = business.services.find((item) => item.id === request.serviceId);
  const references = useQuery({
    queryKey: ["booking-references", request.id, request.referencePaths],
    queryFn: async () =>
      Promise.all(
        (request.referencePaths ?? []).map(async (path) => {
          const { data, error } = await supabase.storage
            .from("booking-references")
            .createSignedUrl(path, 900);
          if (error || !data) throw error ?? new Error("Could not open reference image");
          return { path, url: data.signedUrl };
        }),
      ),
    enabled: (request.referencePaths?.length ?? 0) > 0,
  });
  const answerLabel = (questionId: string, value: string | string[] | number | boolean) => {
    const question = service?.questions.find((item) => item.id === questionId);
    const label = (id: string) =>
      question?.options?.find((option) => option.id === id)?.label ?? id;
    return Array.isArray(value)
      ? value.map(label).join(", ")
      : typeof value === "string"
        ? label(value)
        : String(value);
  };
  return (
    <section className="mb-6">
      <h4 className="text-sm font-semibold">Client brief</h4>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {Object.entries(request.answers).map(([id, value]) => (
          <div key={id}>
            <dt className="text-xs text-muted-foreground">
              {service?.questions.find((q) => q.id === id)?.label ?? id}
            </dt>
            <dd className="mt-0.5 text-sm">{answerLabel(id, value)}</dd>
          </div>
        ))}
      </dl>
      {request.flashDesignId && (
        <p className="mt-3 text-xs">Flash design: {request.flashDesignId}</p>
      )}
      {references.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Could not load reference photos. Try reopening details.
        </p>
      )}
      {references.data && references.data.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {references.data.map(({ path, url }, index) => (
            <a
              key={path}
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open reference photo ${index + 1}`}
            >
              <img
                src={url}
                alt={`Customer reference ${index + 1}`}
                className="aspect-square w-full border border-border object-cover"
              />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

const toMinutes = (time: string) => {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Things the owner may knowingly accept (the artist is booked outside their usual pattern).
 * Hard problems, like a missing artist or a negative price, are checked separately and block saving.
 */
const bookingWarnings = (
  member: TeamMember,
  booking: { id: string; date: string; time: string; duration: number },
  requiredSkills: string[],
  others: BookingRequest[],
): string[] => {
  const warnings: string[] = [];
  const weekday = new Date(`${booking.date}T00:00:00`).getDay();
  const start = toMinutes(booking.time);
  const end = start + booking.duration;
  if (!member.days.includes(weekday))
    warnings.push(
      `${member.name} doesn't work on ${new Date(`${booking.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long" })}s.`,
    );
  if (start < toMinutes(member.start) || end > toMinutes(member.end))
    warnings.push(
      `${member.name} works ${member.start}-${member.end}; this runs outside those hours.`,
    );
  if (booking.duration > member.maxSession)
    warnings.push(
      `${formatDuration(booking.duration)} is longer than ${member.name}'s longest sitting (${formatDuration(member.maxSession)}).`,
    );
  const missing = requiredSkills.filter((skill) => !member.skills.includes(skill));
  if (missing.length > 0)
    warnings.push(
      `${member.name} doesn't have the skill${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    );
  const clash = others.find(
    (o) =>
      o.id !== booking.id &&
      o.status !== "declined" &&
      o.memberId === member.id &&
      o.date === booking.date &&
      toMinutes(o.time) < end &&
      start < toMinutes(o.time) + o.quote.duration,
  );
  if (clash)
    warnings.push(`${member.name} already has ${clash.customerName} at ${clash.time} that day.`);
  return warnings;
};

function EditBooking({
  request,
  onSave,
  onDone,
}: {
  request: BookingRequest;
  onSave: (id: string, patch: Partial<BookingRequest>) => Promise<boolean>;
  onDone: () => void;
}) {
  const { business, requests } = useNook();
  const [low, setLow] = useState(request.quote.low);
  const [high, setHigh] = useState(request.quote.high);
  const [duration, setDuration] = useState(request.quote.duration);
  const [deposit, setDeposit] = useState(request.quote.deposit);
  const [date, setDate] = useState(request.date);
  const [time, setTime] = useState(request.time);
  // Never pre-pick someone: an unassigned request stays unassigned until the owner chooses.
  const [memberId, setMemberId] = useState(
    business.team.some((m) => m.id === request.memberId) ? request.memberId : "",
  );
  const [saving, setSaving] = useState(false);
  const wasConfirmed = request.status === "confirmed";
  const member = business.team.find((m) => m.id === memberId);
  const service = business.services.find((s) => s.id === request.serviceId);
  const requiredSkills = service
    ? buildQuote(business, service, request.answers).requiredSkills
    : [];

  const errors: string[] = [];
  if (!member) errors.push("Choose who will do this booking.");
  if ([low, high, deposit].some((v) => !Number.isFinite(v) || v < 0))
    errors.push("Prices and deposit can't be negative.");
  if (high < low) errors.push("High price can't be below the low price.");
  if (deposit > high) errors.push("The deposit can't be more than the high price.");
  if (!Number.isFinite(duration) || duration <= 0) errors.push("Add how many minutes it takes.");
  if (!date || !time) errors.push("Pick a date and a time.");
  else if (date < todayKey()) errors.push("The date is in the past.");

  const warnings =
    member && date && time
      ? bookingWarnings(member, { id: request.id, date, time, duration }, requiredSkills, requests)
      : [];

  const save = async () => {
    if (errors.length > 0) return;
    setSaving(true);
    const saved = await onSave(request.id, {
      memberId,
      date,
      time,
      // A request still needs its deposit before Nook marks it confirmed.
      ...(wasConfirmed
        ? {}
        : { status: deposit > 0 ? ("awaiting_deposit" as const) : ("confirmed" as const) }),
      quote: { ...request.quote, low, high, duration, deposit },
    });
    setSaving(false);
    if (!saved) return;
    toast.success(
      wasConfirmed
        ? "Booking changed."
        : deposit > 0
          ? `${request.customerName} approved; awaiting deposit with ${member?.name}.`
          : `${request.customerName} confirmed with ${member?.name}.`,
    );
    onDone();
  };

  return (
    <div className="mt-5 grid gap-4 rounded-sm border border-border bg-background p-5 sm:grid-cols-4">
      <NumberField
        label={`Low (${business.policies.currency})`}
        value={low}
        min={0}
        onChange={setLow}
      />
      <NumberField
        label={`High (${business.policies.currency})`}
        value={high}
        min={0}
        onChange={setHigh}
      />
      <NumberField label="Minutes" value={duration} min={15} step={15} onChange={setDuration} />
      <NumberField
        label={`Deposit (${business.policies.currency})`}
        value={deposit}
        min={0}
        step={10}
        onChange={setDeposit}
      />
      <label className="block">
        <span className="eyebrow mb-2 block">Date</span>
        <input
          type="date"
          value={date}
          min={todayKey()}
          onChange={(e) => setDate(e.target.value)}
          className={cn(inputClass, "min-h-11 font-mono")}
        />
      </label>
      <label className="block">
        <span className="eyebrow mb-2 block">Time</span>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={cn(inputClass, "min-h-11 font-mono")}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="eyebrow mb-2 block">Artist</span>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className={cn(inputClass, "min-h-11", !member && "border-brand-ink")}
        >
          <option value="" disabled>
            Choose an artist
          </option>
          {business.team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="space-y-2 sm:col-span-4" aria-live="polite">
          {errors.length > 0 && (
            <ul className="space-y-1 text-sm text-destructive">
              {errors.map((error) => (
                <li key={error} className="flex gap-2">
                  <X className="mt-0.5 size-4 shrink-0" /> {error}
                </li>
              ))}
            </ul>
          )}
          {warnings.length > 0 && (
            <ul className="space-y-1 text-sm text-brand-ink">
              {warnings.map((warning) => (
                <li key={warning} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={errors.length > 0 || saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-ink px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand hover:text-brand-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ink"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {wasConfirmed ? "Save changes" : "Save & confirm"}
          {warnings.length > 0 && errors.length === 0 && " anyway"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 px-3 text-sm text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function NoArtistPill() {
  return (
    <span className="rounded-full border border-brand/50 bg-card px-2.5 py-0.5 font-mono text-xs font-medium text-brand-ink">
      No artist
    </span>
  );
}

function StatusPill({ status }: { status: BookingRequest["status"] }) {
  const map = {
    confirmed: "border-highlight/40 text-highlight",
    awaiting_deposit: "border-brand/50 text-brand-ink",
    pending: "border-brand/50 text-brand-ink",
    declined: "border-border text-muted-foreground",
  } as const;
  const labels = {
    confirmed: "Confirmed",
    awaiting_deposit: "Pending · awaiting deposit",
    pending: "Pending review",
    declined: "Declined",
  } as const;
  return (
    <span
      className={cn(
        "rounded-full border bg-card px-2.5 py-0.5 font-mono text-xs font-medium capitalize",
        map[status],
      )}
    >
      {labels[status]}
    </span>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  suffix,
  compact,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "w-full rounded-sm border border-input bg-card px-3 font-mono text-sm tabular-nums outline-none focus:border-foreground",
            compact ? "min-h-9" : "min-h-11",
          )}
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      {multiline ? (
        <textarea
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, "py-2")}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </label>
  );
}

/** Every skill the studio already uses, so answers and artists share one vocabulary. */
const skillsInUse = (business: BusinessConfig) =>
  Array.from(
    new Set([
      ...business.team.flatMap((m) => m.skills),
      ...business.services.flatMap((s) =>
        s.questions.flatMap((q) => (q.options ?? []).flatMap((o) => o.requiresSkills ?? [])),
      ),
    ]),
  ).sort();

/** Pick skills from the shared list instead of typing them, so a typo can't hide every artist. */
function SkillPicker({
  label,
  value,
  known,
  team,
  onChange,
}: {
  label: string;
  value: string[];
  known: string[];
  team: TeamMember[];
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const uncovered = value.filter((skill) => !team.some((m) => m.skills.includes(skill)));
  const add = () => {
    const skill = draft.trim().toLowerCase();
    if (skill && !value.includes(skill)) onChange([...value, skill]);
    setDraft("");
  };
  return (
    <div>
      <span className="eyebrow mb-2 block">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {known.map((skill) => {
          const on = value.includes(skill);
          return (
            <button
              key={skill}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((s) => s !== skill) : [...value, skill])}
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
        })}
        <span className="flex gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              add();
            }}
            aria-label={`New skill for ${label.toLowerCase()}`}
            placeholder="New skill"
            className={cn(inputClass, "min-h-9 w-32")}
          />
          <button
            type="button"
            onClick={add}
            aria-label="Add skill"
            className={cn(ghostButton, "min-h-9 shrink-0")}
          >
            <Plus className="size-4" />
          </button>
        </span>
      </div>
      {uncovered.length > 0 && (
        <p className="mt-2 flex gap-1.5 text-xs text-brand-ink">
          <AlertTriangle className="size-3.5 shrink-0" />
          Nobody on the team has {uncovered.join(", ")} yet, so this answer can&apos;t be matched to
          an artist. Add it to someone in Team.
        </p>
      )}
    </div>
  );
}

type ServiceItem = BusinessConfig["services"][number];
type QuestionItem = ServiceItem["questions"][number];
type OptionItem = NonNullable<QuestionItem["options"]>[number];

const editServices = (
  business: BusinessConfig,
  serviceId: string,
  patch: Partial<ServiceItem>,
): BusinessConfig => ({
  ...business,
  services: business.services.map((s) => (s.id === serviceId ? { ...s, ...patch } : s)),
});

function ServicesTab() {
  const { business, updateBusiness } = useNook();
  const [selectedId, setSelectedId] = useState(business.services[0]?.id ?? "");

  const addService = () => {
    const id = newId("service");
    updateBusiness((b) => ({
      ...b,
      services: [
        ...b.services,
        {
          id,
          name: "New service",
          blurb: "",
          basePrice: 100,
          baseDuration: 60,
          depositPercent: 20,
          questions: [],
        },
      ],
    }));
    setSelectedId(id);
  };

  return (
    <div className="space-y-8">
      <PricingImport business={business} updateBusiness={updateBusiness} />
      <section>
        <h2 className="font-display text-xl font-semibold">Base price and sitting length</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Start with one service. Answer choices in Questions add a fixed amount or percentage;
          customers see a price estimate before choosing a time.
        </p>
        <div role="tablist" aria-label="Service prices" className="mt-5 flex flex-wrap gap-2">
          {business.services.map((service) => (
            <button
              key={service.id}
              type="button"
              role="tab"
              aria-selected={service.id === selectedId}
              onClick={() => setSelectedId(service.id)}
              className={cn(
                "min-h-11 border px-4 text-sm",
                service.id === selectedId ? "nook-selected font-semibold" : "border-border",
              )}
            >
              {service.name}
            </button>
          ))}
        </div>
      </section>
      {business.services
        .filter((service) => service.id === selectedId)
        .map((s) => (
          <div key={s.id} className="rounded-sm border border-border bg-card p-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <TextField
                label="Name"
                value={s.name}
                onChange={(v) => updateBusiness((b) => editServices(b, s.id, { name: v }))}
              />
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(`Remove ${s.name} and its questions?`)) return;
                  updateBusiness((b) => ({
                    ...b,
                    services: b.services.filter((x) => x.id !== s.id),
                  }));
                }}
                className={cn(dangerButton, "sm:mt-6")}
              >
                <Trash2 className="size-4" /> Remove
              </button>
            </div>
            <div className="mt-4">
              <TextField
                label="Short description"
                multiline
                value={s.blurb}
                onChange={(v) => updateBusiness((b) => editServices(b, s.id, { blurb: v }))}
              />
            </div>
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
                onChange={(v) =>
                  updateBusiness((b) => editServices(b, s.id, { depositPercent: v }))
                }
              />
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-sm font-semibold">Customer estimate starts here</p>
              <p className="mt-1 font-mono text-lg">
                {formatMoney(s.basePrice, business.policies.currency)} ·{" "}
                {formatDuration(s.baseDuration)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The booking questions may add price and time. Deposit: {s.depositPercent}% after
                approval.
              </p>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Answer-based price changes</h3>
                <Link
                  to="/owner"
                  search={{ tab: "questions" }}
                  className="min-h-10 text-sm text-brand-ink underline"
                >
                  Edit question rules
                </Link>
              </div>
              {s.questions.every(
                (question) =>
                  !(question.options ?? []).some((option) =>
                    describeOptionEffect(option, business.policies.currency),
                  ),
              ) && (
                <p className="mt-2 text-sm text-muted-foreground">No answer-based changes yet.</p>
              )}
              <ul className="mt-2 divide-y divide-border">
                {s.questions.flatMap((question) =>
                  (question.options ?? [])
                    .filter((option) => describeOptionEffect(option, business.policies.currency))
                    .map((option) => (
                      <li
                        key={`${question.id}-${option.id}`}
                        className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                      >
                        <span>
                          {question.label} · {option.label}
                        </span>
                        <span className="font-mono text-xs text-brand-ink">
                          {describeOptionEffect(option, business.policies.currency)}
                        </span>
                      </li>
                    )),
                )}
              </ul>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {s.questions.length} question{s.questions.length === 1 ? "" : "s"}. Edit them in
              Questions.
            </p>
          </div>
        ))}
      <button type="button" onClick={addService} className={ghostButton}>
        <Plus className="size-4" /> Add service
      </button>
    </div>
  );
}

/** Factor 1.15 is shown and edited as +15%. */
const factorToPercent = (factor?: number) => (factor ? Math.round((factor - 1) * 100) : 0);
const percentToFactor = (percent: number) => (percent === 0 ? undefined : 1 + percent / 100);

const questionTypeLabels: Record<QuestionItem["type"], string> = {
  single: "Pick one",
  multi: "Pick any",
  boolean: "Yes / no",
  scale: "Slider",
  text: "Free text",
};

function QuestionsTab() {
  const { business, updateBusiness } = useNook();
  const [serviceId, setServiceId] = useState(business.services[0]?.id ?? "");
  const service = business.services.find((s) => s.id === serviceId) ?? business.services[0];

  if (!service)
    return <p className="text-sm text-muted-foreground">Add a service to edit its questions.</p>;

  const currency = business.policies.currency;
  const knownSkills = skillsInUse(business);

  const setQuestions = (fn: (questions: QuestionItem[]) => QuestionItem[]) =>
    updateBusiness((b) => ({
      ...b,
      services: b.services.map((s) =>
        s.id !== service.id ? s : { ...s, questions: fn(s.questions) },
      ),
    }));

  const patchQuestion = (questionId: string, patch: Patch<QuestionItem>) =>
    setQuestions((qs) => qs.map((q) => (q.id === questionId ? applyPatch(q, patch) : q)));

  const setOptions = (questionId: string, fn: (options: OptionItem[]) => OptionItem[]) =>
    setQuestions((qs) =>
      qs.map((q) => (q.id === questionId ? { ...q, options: fn(q.options ?? []) } : q)),
    );

  const patchOption = (questionId: string, optionId: string, patch: Patch<OptionItem>) =>
    setOptions(questionId, (os) => os.map((o) => (o.id === optionId ? applyPatch(o, patch) : o)));

  const moveQuestion = (index: number, delta: number) =>
    setQuestions((qs) => {
      const next = [...qs];
      const target = index + delta;
      if (target < 0 || target >= next.length) return qs;
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(target, 0, moved);
      return next;
    });

  const addQuestion = (type: QuestionItem["type"]) => {
    const base: QuestionItem = { id: newId("q"), label: "New question", type };
    const question: QuestionItem =
      type === "scale"
        ? { ...base, min: 1, max: 10, step: 1, unit: "", pricePerUnit: 10, durationPerUnit: 5 }
        : type === "text"
          ? { ...base, optional: true }
          : type === "boolean"
            ? {
                ...base,
                options: [
                  { id: "yes", label: "Yes" },
                  { id: "no", label: "No" },
                ],
              }
            : { ...base, options: [{ id: newId("o"), label: "First answer" }] };
    setQuestions((qs) => [...qs, question]);
  };

  return (
    <div>
      <div role="tablist" aria-label="Service" className="flex flex-wrap gap-2">
        {business.services.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === service.id}
            onClick={() => setServiceId(s.id)}
            className={cn(
              "min-h-10 rounded-sm border px-4 text-sm transition-colors",
              s.id === service.id
                ? "border-foreground bg-ink text-brand-foreground"
                : "border-border hover:border-foreground",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      <p className="mt-6 max-w-xl text-sm text-muted-foreground">
        Each answer can add a fixed amount or a percentage to price and time, require a skill, ask
        for photos, or send the request to you first. &ldquo;Customer sees&rdquo; is exactly what
        shows on the booking page.
      </p>

      <div className="mt-6 space-y-4">
        {service.questions.length === 0 && (
          <p className="text-sm text-muted-foreground">No questions yet for this service.</p>
        )}
        {service.questions.map((q, index) => (
          <div key={q.id} className="rounded-sm border border-border bg-card p-5">
            <div className="flex flex-wrap items-start gap-3">
              <span className="mt-8 font-mono text-sm text-brand-ink">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <TextField
                  label={`Question · ${questionTypeLabels[q.type]}`}
                  value={q.label}
                  onChange={(v) => patchQuestion(q.id, { label: v })}
                />
              </div>
              <div className="mt-6 flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => moveQuestion(index, -1)}
                  className="flex size-10 items-center justify-center rounded-sm border border-border disabled:opacity-40"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={index === service.questions.length - 1}
                  onClick={() => moveQuestion(index, 1)}
                  className="flex size-10 items-center justify-center rounded-sm border border-border disabled:opacity-40"
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove question ${q.label}`}
                  onClick={() => {
                    if (!window.confirm(`Remove "${q.label}"?`)) return;
                    setQuestions((qs) => qs.filter((x) => x.id !== q.id));
                  }}
                  className="flex size-10 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <TextField
                label="Help text"
                value={q.help ?? ""}
                placeholder="Optional hint under the question"
                onChange={(v) => patchQuestion(q.id, { help: v || undefined })}
              />
              <label className="flex min-h-10 items-center gap-2 text-sm sm:mt-6">
                <input
                  type="checkbox"
                  checked={Boolean(q.optional)}
                  onChange={(e) => patchQuestion(q.id, { optional: e.target.checked })}
                  className="size-4 accent-[var(--brand)]"
                />
                Optional
              </label>
            </div>

            {q.type === "scale" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <NumberField
                  label="Min"
                  value={q.min ?? 0}
                  onChange={(v) => patchQuestion(q.id, { min: v })}
                />
                <NumberField
                  label="Max"
                  value={q.max ?? 10}
                  onChange={(v) => patchQuestion(q.id, { max: v })}
                />
                <NumberField
                  label="Step"
                  value={q.step ?? 1}
                  onChange={(v) => patchQuestion(q.id, { step: v })}
                />
                <TextField
                  label="Unit"
                  value={q.unit ?? ""}
                  onChange={(v) => patchQuestion(q.id, { unit: v })}
                />
                <NumberField
                  label={`${currency} per unit`}
                  value={q.pricePerUnit ?? 0}
                  onChange={(v) => patchQuestion(q.id, { pricePerUnit: v })}
                />
                <NumberField
                  label="Min per unit"
                  value={q.durationPerUnit ?? 0}
                  onChange={(v) => patchQuestion(q.id, { durationPerUnit: v })}
                />
                <p className="text-xs text-muted-foreground sm:col-span-3 lg:col-span-6">
                  Every {q.unit || "unit"} above {q.min ?? 0} adds{" "}
                  {formatMoney(q.pricePerUnit ?? 0, currency)} and {q.durationPerUnit ?? 0} min.
                </p>
              </div>
            ) : q.type === "text" ? (
              <p className="mt-4 text-sm text-muted-foreground">Free text. No effect on price.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {(q.options ?? []).map((o) => (
                  <div key={o.id} className="rounded-sm border border-border bg-background p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[12rem] flex-1">
                        <TextField
                          label="Answer"
                          value={o.label}
                          onChange={(v) => patchOption(q.id, o.id, { label: v })}
                        />
                      </div>
                      <div className="min-w-[12rem] flex-1">
                        <TextField
                          label="Hint"
                          value={o.hint ?? ""}
                          placeholder="Optional"
                          onChange={(v) => patchOption(q.id, o.id, { hint: v || undefined })}
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove answer ${o.label}`}
                        onClick={() => setOptions(q.id, (os) => os.filter((x) => x.id !== o.id))}
                        className="flex size-10 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <NumberField
                        compact
                        label={`+ ${currency}`}
                        value={o.priceDelta ?? 0}
                        step={10}
                        onChange={(v) => patchOption(q.id, o.id, { priceDelta: v || undefined })}
                      />
                      <NumberField
                        compact
                        label="Price %"
                        value={factorToPercent(o.priceFactor)}
                        step={5}
                        onChange={(v) =>
                          patchOption(q.id, o.id, { priceFactor: percentToFactor(v) })
                        }
                      />
                      <NumberField
                        compact
                        label="+ Min"
                        value={o.durationDelta ?? 0}
                        step={5}
                        onChange={(v) => patchOption(q.id, o.id, { durationDelta: v || undefined })}
                      />
                      <NumberField
                        compact
                        label="Time %"
                        value={factorToPercent(o.durationFactor)}
                        step={5}
                        onChange={(v) =>
                          patchOption(q.id, o.id, { durationFactor: percentToFactor(v) })
                        }
                      />
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                      <SkillPicker
                        label="Skills needed"
                        value={o.requiresSkills ?? []}
                        known={knownSkills}
                        team={business.team}
                        onChange={(v) =>
                          patchOption(q.id, o.id, { requiresSkills: v.length ? v : undefined })
                        }
                      />
                      <button
                        type="button"
                        aria-pressed={Boolean(o.requiresPhotos)}
                        onClick={() =>
                          patchOption(q.id, o.id, { requiresPhotos: !o.requiresPhotos })
                        }
                        className={cn(
                          "min-h-9 rounded-sm border px-3 text-xs transition-colors",
                          o.requiresPhotos
                            ? "nook-selected font-medium"
                            : "border-input text-foreground hover:bg-secondary",
                        )}
                      >
                        Photos {o.requiresPhotos ? "required" : "optional"}
                      </button>
                      <button
                        type="button"
                        aria-pressed={Boolean(o.requiresReview)}
                        onClick={() =>
                          patchOption(q.id, o.id, { requiresReview: !o.requiresReview })
                        }
                        className={cn(
                          "min-h-9 rounded-sm border px-3 text-xs transition-colors",
                          o.requiresReview
                            ? "nook-selected font-medium"
                            : "border-input text-foreground hover:bg-secondary",
                        )}
                      >
                        {o.requiresReview ? "You check first" : "Confirms on its own"}
                      </button>
                    </div>
                    <p className="mt-3 font-mono text-xs text-brand-ink">
                      Customer sees:{" "}
                      {describeOptionEffect(o, currency) || (
                        <span className="text-muted-foreground">No change</span>
                      )}
                    </p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setOptions(q.id, (os) => [...os, { id: newId("o"), label: "New answer" }])
                  }
                  className={ghostButton}
                >
                  <Plus className="size-4" /> Add answer
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Add question</span>
        {(Object.keys(questionTypeLabels) as QuestionItem["type"][]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => addQuestion(type)}
            className={ghostButton}
          >
            <Plus className="size-4" /> {questionTypeLabels[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

const initialsFrom = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "?";

function TeamTab() {
  const { business, updateBusiness } = useNook();

  const knownSkills = skillsInUse(business);

  const patchMember = (id: string, patch: Partial<BusinessConfig["team"][number]>) =>
    updateBusiness((b) => ({
      ...b,
      team: b.team.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));

  const addMember = () =>
    updateBusiness((b) => ({
      ...b,
      team: [
        ...b.team,
        {
          id: newId("member"),
          name: "New artist",
          role: "Artist",
          initials: "NA",
          skills: [],
          days: [2, 3, 4, 5],
          start: "10:00",
          end: "18:00",
          maxSession: 240,
        },
      ],
    }));

  return (
    <div className="space-y-4">
      {business.team.map((m) => (
        <div key={m.id} className="rounded-sm border border-border bg-card p-5">
          <div className="flex flex-wrap items-start gap-4">
            <label
              className="group relative size-14 shrink-0 cursor-pointer rounded-full focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foreground"
              title="Upload a photo"
            >
              {artistImage(m) ? (
                <img
                  src={artistImage(m)}
                  alt={`Portrait of ${m.name}`}
                  loading="lazy"
                  width={816}
                  height={816}
                  className="size-14 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-14 items-center justify-center rounded-full bg-sand text-sm font-semibold">
                  {m.initials}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/55 text-card opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Camera className="size-4" aria-hidden="true" />
              </span>
              <span className="sr-only">Upload a photo of {m.name}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    patchMember(m.id, { photo: await toAvatarDataUrl(file) });
                    toast.success(`Photo updated for ${m.name}`);
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "This image could not be read",
                    );
                  }
                }}
              />
            </label>
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
              <TextField
                label="Name"
                value={m.name}
                onChange={(v) => patchMember(m.id, { name: v, initials: initialsFrom(v) })}
              />
              <TextField
                label="Role"
                value={m.role}
                onChange={(v) => patchMember(m.id, { role: v })}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`Remove ${m.name} from the team?`)) return;
                updateBusiness((b) => ({ ...b, team: b.team.filter((x) => x.id !== m.id) }));
              }}
              className={cn(dangerButton, "sm:mt-6")}
            >
              <Trash2 className="size-4" /> Remove
            </button>
          </div>
          <label className="mt-5 block max-w-md">
            <span className="eyebrow mb-2 block">Portfolio link</span>
            <input
              type="url"
              value={m.portfolioUrl ?? ""}
              onChange={(e) => patchMember(m.id, { portfolioUrl: e.target.value })}
              placeholder="https://instagram.com/…"
              className={inputClass}
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
                  aria-pressed={on}
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
                className={cn(inputClass, "min-h-11 font-mono")}
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-2 block">Ends</span>
              <input
                type="time"
                value={m.end}
                onChange={(e) => patchMember(m.id, { end: e.target.value })}
                className={cn(inputClass, "min-h-11 font-mono")}
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
              {knownSkills.map((skill) => {
                const on = m.skills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    aria-pressed={on}
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
              })}
            </div>
            <form
              className="mt-3 flex max-w-sm gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("skill");
                if (!(input instanceof HTMLInputElement)) return;
                const skill = input.value.trim().toLowerCase();
                if (skill && !m.skills.includes(skill))
                  patchMember(m.id, { skills: [...m.skills, skill] });
                input.value = "";
              }}
            >
              <input
                name="skill"
                aria-label={`New skill for ${m.name}`}
                placeholder="New skill, e.g. realism"
                className={cn(inputClass, "min-h-9")}
              />
              <button type="submit" className={cn(ghostButton, "min-h-9 shrink-0")}>
                <Plus className="size-4" /> Add
              </button>
            </form>
          </div>
        </div>
      ))}
      <button type="button" onClick={addMember} className={ghostButton}>
        <Plus className="size-4" /> Add team member
      </button>
    </div>
  );
}

const currencies = ["EUR", "SEK", "DKK", "NOK", "GBP", "USD"];

function PoliciesTab() {
  const { business, updateBusiness, resetAll } = useNook();
  const p = business.policies;

  const patch = (value: Partial<typeof p>) =>
    updateBusiness((b) => ({ ...b, policies: { ...b.policies, ...value } }));

  return (
    <div className="max-w-3xl space-y-4">
      <PolicyGroup title="Studio" lead="What customers see at the top of the booking page.">
        <div>
          <p className="eyebrow mb-2">Studio name</p>
          <p className="border border-border bg-background px-3 py-2.5 text-sm font-medium">
            {business.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The public homepage uses this brand. Update both together when changing the studio
            identity.
          </p>
        </div>
        <TextField
          label="Address"
          value={business.location}
          onChange={(v) => updateBusiness((b) => ({ ...b, location: v }))}
        />
        <TextField
          label="Tagline"
          value={business.tagline}
          onChange={(v) => updateBusiness((b) => ({ ...b, tagline: v }))}
        />
        <label className="block">
          <span className="eyebrow mb-2 block">Currency</span>
          <select
            value={p.currency}
            onChange={(e) => patch({ currency: e.target.value })}
            className={inputClass}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </PolicyGroup>

      <PolicyGroup
        title="Confirms on its own"
        lead="Requests inside both limits are approved automatically; appointments with a deposit stay pending until it is paid. Anything else comes to you first."
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

      <PolicyGroup title="Deposit" lead="The percentage is set per service in Pricing.">
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

      <PolicyGroup title="Scheduling" lead="How soon and how far ahead customers can book.">
        <NumberField
          label="Earliest booking (days ahead)"
          value={p.leadTimeDays}
          onChange={(v) => patch({ leadTimeDays: v })}
        />
        <NumberField
          label="Latest booking (days ahead)"
          value={p.horizonDays}
          step={15}
          onChange={(v) => patch({ horizonDays: v })}
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

      <section className="rounded-sm border border-destructive/40 bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Start over</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Replaces your services, questions, team and policies with Nook&apos;s starting setup.
          Bookings are kept.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-sm border border-destructive/60 px-4 text-sm text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <RotateCcw className="size-4" /> Restore default setup
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restore the default setup?</AlertDialogTitle>
              <AlertDialogDescription>
                Your {business.services.length} services with their questions, your{" "}
                {business.team.length} team members and all policies will be replaced. Bookings are
                not touched. You can undo this right after.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my setup</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  const previous = business;
                  resetAll();
                  toast.success("Default setup restored", {
                    duration: 10000,
                    action: {
                      label: "Undo",
                      onClick: () => updateBusiness(() => previous),
                    },
                  });
                }}
              >
                Restore defaults
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
