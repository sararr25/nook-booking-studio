import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateKey, type Slot } from "@/lib/nook/engine";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  availableDays: Record<string, Slot[]>;
  /** Slots each day would have with an empty diary; absent means the studio is closed. */
  capacity?: Record<string, number>;
  selected: { date: string; slot: Slot } | null;
  onSelect: (value: { date: string; slot: Slot }) => void;
};

/** Few times left: two or fewer, or a quarter of a normal day. */
function isFewLeft(open: number, total: number | undefined) {
  return open > 0 && (open <= 2 || (total ? open / total <= 0.25 : false));
}

const longDate = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export function MonthCalendar({ availableDays, capacity = {}, selected, onSelect }: Props) {
  const sortedDays = useMemo(() => Object.keys(availableDays).sort(), [availableDays]);
  // Open on the first month that actually has a free day, so customers never
  // land on a fully greyed-out calendar (e.g. near the end of a month).
  const [cursor, setCursor] = useState(() => {
    const first = sortedDays[0];
    return first ? new Date(`${first}T00:00:00`) : new Date();
  });
  const [openDay, setOpenDay] = useState<string | null>(selected?.date ?? null);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let i = 1; i <= daysInMonth; i += 1)
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), i));
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const monthKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
  const openSlots = openDay ? (availableDays[openDay] ?? []) : [];
  const manyArtists = new Set(openSlots.map((slot) => slot.memberId)).size > 1;
  const earliest = sortedDays[0];
  const earliestSlot = earliest ? availableDays[earliest]?.[0] : undefined;

  const shift = (delta: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dateKey(today);

  const pickEarliest = () => {
    if (!earliest || !earliestSlot) return;
    setCursor(new Date(`${earliest}T00:00:00`));
    setOpenDay(earliest);
    onSelect({ date: earliest, slot: earliestSlot });
  };

  if (sortedDays.length === 0)
    return (
      <p role="status" className="border-y border-border py-6 text-sm text-muted-foreground">
        No verified times are open within the booking window. Try another artist or contact the
        studio.
      </p>
    );

  return (
    <div className="rounded-sm border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="flex size-8 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:bg-secondary disabled:opacity-30"
            disabled={
              cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth()
            }
          >
            <ChevronLeft className="size-4" />
          </button>
          <h3
            key={monthKey}
            className="nook-enter min-w-[8.5rem] text-center font-display text-base font-bold"
          >
            {monthLabel}
          </h3>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next month"
            className="flex size-8 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:bg-secondary disabled:opacity-30"
            disabled={
              new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) >
              new Date(`${sortedDays.at(-1)}T00:00:00`)
            }
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        {earliest && earliestSlot && (
          <button
            type="button"
            onClick={pickEarliest}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-sm border border-border px-2.5 text-xs font-medium transition-colors hover:border-foreground"
          >
            <Zap className="size-3.5" aria-hidden="true" />
            Earliest available
          </button>
        )}
      </div>

      <div className="px-3 pb-3 sm:px-4">
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdayLabels.map((d) => (
            <div
              key={d}
              className="py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>
        <div key={monthKey} className="nook-enter grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} />;
            const key = dateKey(day);
            const slots = availableDays[key] ?? [];
            const bookable = slots.length > 0;
            const few = isFewLeft(slots.length, capacity[key]);
            const isOpen = openDay === key;
            const isSelected = selected?.date === key;
            return (
              <button
                key={key}
                type="button"
                disabled={!bookable}
                aria-label={`${longDate(key)}, ${bookable ? `${slots.length} ${slots.length === 1 ? "time" : "times"} open${few ? ", few left" : ""}` : "unavailable"}`}
                aria-pressed={isOpen || isSelected}
                onClick={() => setOpenDay(isOpen ? null : key)}
                className={cn(
                  "relative flex h-10 items-center justify-center rounded-sm font-mono text-sm tabular-nums transition-colors",
                  bookable
                    ? "border border-border bg-background font-semibold hover:border-foreground"
                    : "text-muted-foreground/40",
                  bookable && few && "bg-brand-soft",
                  (isOpen || isSelected) && "nook-selected bg-card",
                )}
              >
                {day.getDate()}
                {key === todayKey && (
                  <span
                    className="absolute right-1 top-1 size-1 rounded-full bg-brand-ink"
                    title="Today"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[2px] border border-border bg-background" /> Available
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[2px] border border-border bg-brand-soft" /> Few times
            left
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="font-mono text-muted-foreground/40">12</span> Unavailable
          </li>
        </ul>
      </div>

      <div className="border-t border-border px-3 py-3 sm:px-4">
        {openDay && openSlots.length > 0 ? (
          <div key={openDay} className="nook-enter">
            <p className="text-sm font-semibold">{longDate(openDay)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {openSlots.map((slot) => {
                const active =
                  selected?.date === openDay &&
                  selected.slot.time === slot.time &&
                  selected.slot.memberId === slot.memberId;
                return (
                  <button
                    key={`${slot.memberId}-${slot.time}`}
                    type="button"
                    onClick={() => onSelect({ date: openDay, slot })}
                    aria-pressed={active}
                    className={cn(
                      "nook-choice flex min-h-9 items-baseline gap-1.5 border border-border px-3 text-sm",
                      active && "nook-selected",
                    )}
                  >
                    <span className="font-mono font-semibold tabular-nums">{slot.time}</span>
                    {/* The same time can be open with several artists; name them apart. */}
                    {manyArtists && (
                      <span className="text-xs text-muted-foreground">
                        {slot.memberName.split(" ")[0]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Pick a day to see the times.</p>
        )}
      </div>
    </div>
  );
}
