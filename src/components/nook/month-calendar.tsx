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
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem]">
      <div className="nook-panel p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{monthLabel}</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="flex size-9 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-secondary disabled:opacity-40"
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
            className="flex size-9 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-secondary"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdayLabels.map((d) => (
            <div key={d} className="pb-2 text-[10px] font-medium text-muted-foreground">
             {d.slice(0, 3)}
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
                "relative flex aspect-square min-h-9 flex-col items-center justify-center rounded-full text-xs transition-colors",
                free
                  ? "hover:bg-secondary"
                  : "text-muted-foreground/35",
                isOpen && free && "bg-primary text-primary-foreground",
                isSelected && "bg-primary text-primary-foreground",
              )}
            >
              <span className={cn(isSelected && "font-semibold")}>{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      </div>
      <div className="min-h-52">
      {openDay ? (
        <div>
          {openSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing open on this day.</p>
          ) : (
            <>
              <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
                {new Date(`${openDay}T00:00:00`).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <div className="grid gap-2">
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
                        "min-h-10 rounded-md border px-3 py-2 text-center text-xs transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary",
                      )}
                    >
                      <span className="font-medium">{slot.time}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : <div className="pt-1"><p className="text-xs font-semibold">Available times</p><p className="mt-1 text-[11px] text-muted-foreground">Choose a day</p></div>}
      </div>
    </div>
  );
}
