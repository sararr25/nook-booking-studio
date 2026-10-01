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

type Level = "plenty" | "filling" | "few" | "full" | "closed";

const levelInfo: Record<Level, { label: string; bars: number }> = {
  plenty: { label: "Plenty of times", bars: 3 },
  filling: { label: "Filling up", bars: 2 },
  few: { label: "Last few", bars: 1 },
  full: { label: "Fully booked", bars: 0 },
  closed: { label: "Closed", bars: 0 },
};

function levelFor(open: number, total: number | undefined): Level {
  if (!total && open === 0) return "closed";
  if (open === 0) return "full";
  const ratio = total ? open / total : 1;
  if (open <= 2 || ratio <= 0.25) return "few";
  if (ratio <= 0.55) return "filling";
  return "plenty";
}

/** Three small bars: how much room is left on a day. Shape, not just colour, carries the meaning. */
function Meter({ level, className }: { level: Level; className?: string }) {
  const { bars } = levelInfo[level];
  return (
    <span aria-hidden="true" className={cn("inline-flex items-end gap-[2px]", className)}>
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn(
            "w-[3px] rounded-[1px]",
            bar === 1 ? "h-[5px]" : bar === 2 ? "h-[8px]" : "h-[11px]",
            bar <= bars ? (level === "few" ? "bg-brand-ink" : "bg-foreground") : "bg-foreground/15",
          )}
        />
      ))}
    </span>
  );
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
  const openLevel = openDay ? levelFor(openSlots.length, capacity[openDay]) : null;
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
    <div className="rounded-sm border border-foreground bg-card shadow-[4px_4px_0_color-mix(in_oklab,var(--foreground)_14%,transparent)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="flex size-9 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:bg-secondary disabled:opacity-30"
            disabled={
              cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth()
            }
          >
            <ChevronLeft className="size-4" />
          </button>
          <h3
            key={monthKey}
            className="nook-enter min-w-[9.5rem] text-center font-display text-lg font-bold"
          >
            {monthLabel}
          </h3>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next month"
            className="flex size-9 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:bg-secondary disabled:opacity-30"
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
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-dashed border-input px-3 text-xs font-medium transition-colors hover:border-foreground hover:bg-brand-soft"
          >
            <Zap className="size-3.5" aria-hidden="true" />
            Earliest:{" "}
            <span className="font-mono">
              {new Date(`${earliest}T00:00:00`).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
              , {earliestSlot.time}
            </span>
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_12.5rem]">
        <div className="px-3 pb-3 pt-2 sm:px-4">
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayLabels.map((d) => (
              <div
                key={d}
                className="py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <div key={monthKey} className="nook-stagger-days grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />;
              const key = dateKey(day);
              const slots = availableDays[key] ?? [];
              const level = levelFor(slots.length, capacity[key]);
              const bookable = slots.length > 0;
              const isOpen = openDay === key;
              const isSelected = selected?.date === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!bookable}
                  aria-label={`${longDate(key)}, ${bookable ? `${levelInfo[level].label.toLowerCase()}, ${slots.length} ${slots.length === 1 ? "time" : "times"} open` : levelInfo[level].label.toLowerCase()}`}
                  aria-pressed={isOpen || isSelected}
                  onClick={() => setOpenDay(isOpen ? null : key)}
                  style={{ animationDelay: `${Math.min(i, 34) * 12}ms` }}
                  className={cn(
                    "relative flex h-12 flex-col justify-between rounded-sm px-1.5 py-1 text-left transition-[transform,background-color,border-color] duration-150 sm:h-14 sm:px-2",
                    bookable &&
                      "border border-border bg-background hover:-translate-y-px hover:border-foreground",
                    level === "few" && "bg-brand-soft/60",
                    level === "full" && "nook-hatch border border-dashed border-border",
                    level === "closed" && "text-muted-foreground/45",
                    (isOpen || isSelected) && "nook-selected bg-card",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={cn(
                        "font-mono text-xs font-semibold tabular-nums sm:text-sm",
                        level === "full" && "font-normal text-muted-foreground line-through",
                        level === "closed" && "font-normal",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {key === todayKey && (
                      <span
                        className="size-1.5 rounded-full bg-brand-ink"
                        title="Today"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  {bookable ? (
                    <Meter level={level} />
                  ) : level === "full" ? (
                    <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                      Full
                    </span>
                  ) : (
                    <span />
                  )}
                </button>
              );
            })}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            {(["plenty", "filling", "few"] as const).map((level) => (
              <li key={level} className="inline-flex items-center gap-1.5">
                <Meter level={level} /> {levelInfo[level].label}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5">
              <span className="font-mono line-through">12</span> Fully booked
            </li>
          </ul>
        </div>

        <div className="border-t border-border p-4 md:border-l md:border-t-0">
          {openDay && openSlots.length > 0 && openLevel ? (
            <div key={openDay} className="nook-enter">
              <p className="font-display text-base font-bold leading-tight">{longDate(openDay)}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Meter level={openLevel} /> {levelInfo[openLevel].label} · {openSlots.length}{" "}
                {openSlots.length === 1 ? "time" : "times"}
              </p>
              <div className="nook-stagger mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-1">
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
                        "nook-choice flex min-h-10 items-center justify-between gap-2 border border-border px-3 text-sm",
                        active && "nook-selected",
                      )}
                    >
                      <span className="font-mono font-semibold tabular-nums">{slot.time}</span>
                      {/* Same time can be open with several artists; name them apart. */}
                      <span className="truncate text-xs text-muted-foreground">
                        {slot.memberName.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center gap-1 py-4 text-center md:text-left">
              <p className="text-sm font-semibold">Pick a day</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Bars show how much room is left. Times appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
