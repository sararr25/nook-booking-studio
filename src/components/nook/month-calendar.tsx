import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateKey, slotsForDay, type Slot } from "@/lib/nook/engine";
import type { BusinessConfig, TeamMember } from "@/lib/nook/types";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  business: BusinessConfig;
  eligibleTeam: TeamMember[];
  duration: number;
  booked: { date: string; time: string; memberId: string }[];
  selected: { date: string; slot: Slot } | null;
  onSelect: (value: { date: string; slot: Slot }) => void;
};

export function MonthCalendar({
  business,
  eligibleTeam,
  duration,
  booked,
  selected,
  onSelect,
}: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
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

  const availability = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const day of days) {
      if (!day) continue;
      map.set(dateKey(day), slotsForDay(business, eligibleTeam, duration, day, booked));
    }
    return map;
  }, [days, business, eligibleTeam, duration, booked]);

  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const openSlots = openDay ? (availability.get(openDay) ?? []) : [];

  const shift = (delta: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="display text-xl">{monthLabel}</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="flex size-11 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:bg-secondary disabled:opacity-40"
            disabled={
              cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth()
            }
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next month"
            className="flex size-11 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:bg-secondary"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdayLabels.map((d) => (
          <div key={d} className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {d.slice(0, 2)}
          </div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />;
          const key = dateKey(day);
          const slots = availability.get(key) ?? [];
          const free = slots.length > 0;
          const isSelected = selected?.date === key;
          const isOpen = openDay === key;
          return (
            <button
              key={key}
              type="button"
              disabled={!free}
              onClick={() => setOpenDay(isOpen ? null : key)}
              className={cn(
                "relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-md border text-sm transition-colors",
                free
                  ? "border-border bg-card hover:border-brand hover:bg-brand-soft/50"
                  : "border-transparent text-muted-foreground/40",
                isOpen && free && "border-brand bg-brand-soft/60",
                isSelected && "border-brand bg-brand text-brand-foreground hover:bg-brand",
              )}
            >
              <span className={cn(isSelected && "font-semibold")}>{day.getDate()}</span>
              {free && !isSelected && (
                <span className="mt-0.5 text-[10px] text-brand">{slots.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {openDay && (
        <div className="mt-5 border-t border-border pt-5">
          {openSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing open on this day.</p>
          ) : (
            <>
              <p className="eyebrow mb-3">
                {new Date(`${openDay}T00:00:00`).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <div className="flex flex-wrap gap-2">
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
                      className={cn(
                        "min-h-11 rounded-full border px-4 py-2 text-left text-sm transition-colors",
                        active
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-border bg-card hover:border-brand hover:bg-brand-soft/40",
                      )}
                    >
                      <span className="font-medium">{slot.time}</span>
                      <span className={cn("ml-2 text-xs", active ? "opacity-80" : "text-muted-foreground")}>
                        {slot.memberName.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
