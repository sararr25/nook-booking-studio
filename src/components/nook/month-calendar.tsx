import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dateKey, type Slot } from "@/lib/nook/engine";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  availableDays: Record<string, Slot[]>;
  selected: { date: string; slot: Slot } | null;
  onSelect: (value: { date: string; slot: Slot }) => void;
};

export function MonthCalendar({ availableDays, selected, onSelect }: Props) {
  // Open on the first month that actually has a free day, so customers never
  // land on a fully greyed-out calendar (e.g. near the end of a month).
  const [cursor, setCursor] = useState(() => {
    const first = Object.keys(availableDays).sort()[0];
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

  const availability = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const day of days) {
      if (!day) continue;
      map.set(dateKey(day), availableDays[dateKey(day)] ?? []);
    }
    return map;
  }, [days, availableDays]);

  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const openSlots = openDay ? (availability.get(openDay) ?? []) : [];

  const shift = (delta: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      {Object.keys(availableDays).length === 0 && (
        <p role="status" className="border-y border-border py-6 text-sm text-muted-foreground">
          No verified times are open within the booking window. Try another artist or contact the
          studio.
        </p>
      )}
      <div className="grid border-y border-border md:grid-cols-[minmax(0,1fr)_9rem]">
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{monthLabel}</h3>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => shift(-1)}
                aria-label="Previous month"
                className="flex size-11 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:bg-secondary disabled:opacity-40"
                disabled={
                  cursor.getFullYear() === today.getFullYear() &&
                  cursor.getMonth() === today.getMonth()
                }
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => shift(1)}
                aria-label="Next month"
                className="flex size-11 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:bg-secondary"
                disabled={
                  new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) >
                  new Date(Object.keys(availableDays).sort().at(-1) ?? Date.now())
                }
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayLabels.map((d) => (
              <div key={d} className="pb-2 text-xs font-medium text-muted-foreground">
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
                <Button
                  variant="ghost"
                  key={key}
                  type="button"
                  disabled={!free}
                  onClick={() => setOpenDay(isOpen ? null : key)}
                  className={cn(
                    "relative flex aspect-square h-auto min-h-11 w-full flex-col items-center justify-center rounded-sm text-xs transition-colors",
                    free
                      ? "border border-border bg-card font-semibold text-foreground hover:border-foreground"
                      : "font-normal text-muted-foreground/60",
                    isOpen && free && "border-foreground bg-primary text-primary-foreground",
                    isSelected && "border-foreground bg-primary text-primary-foreground",
                  )}
                >
                  <span className="tabular-nums">{day.getDate()}</span>
                </Button>
              );
            })}
          </div>
        </div>
        <div className="min-h-52 border-t border-border p-4 md:border-l md:border-t-0">
          {openDay ? (
            <div>
              {openSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing open on this day.</p>
              ) : (
                <>
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
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
                        <Button
                          variant="outline"
                          key={`${slot.memberId}-${slot.time}`}
                          type="button"
                          onClick={() => onSelect({ date: openDay, slot })}
                          className={cn(
                            "nook-choice min-h-11 w-full border border-border px-3 py-2 text-center text-sm",
                            active && "nook-selected",
                          )}
                        >
                          <span className="font-mono font-medium tabular-nums">{slot.time}</span>
                        </Button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="pt-1">
              <p className="text-xs font-semibold">Available times</p>
              <p className="mt-1 text-xs text-muted-foreground">Choose a highlighted day</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
