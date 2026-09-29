import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { syncOwnerBookingCalendar } from "@/lib/nook/owner-calendar.functions";
import type { BookingRequest } from "@/lib/nook/types";
import type { BusyBlock } from "@/lib/nook/google-calendar.server";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");
const keyFor = (day: Date) =>
  `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

export function OwnerCalendar({
  requests,
  busy,
  connected,
}: {
  requests: BookingRequest[];
  busy: BusyBlock[];
  connected: boolean;
}) {
  const syncBooking = useServerFn(syncOwnerBookingCalendar);
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDay, setSelectedDay] = useState(() => keyFor(new Date()));
  const changeMonth = (offset: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    setCursor(next);
    setSelectedDay(keyFor(next));
  };
  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const leading = (first.getDay() + 6) % 7;
    const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from(
        { length: count },
        (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1),
      ),
    ];
  }, [cursor]);
  const active = requests.filter((request) => request.status !== "declined");
  const selected = requests
    .filter((request) => request.date === selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));
  const busySelected = busy.filter((block) => block.date === selectedDay);
  const time = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </h2>
          <p
            role="status"
            className={`mt-1 text-xs ${connected ? "text-highlight" : "text-destructive"}`}
          >
            {connected
              ? "Google Calendar checked · busy times shown below"
              : "Google Calendar unavailable · times are not verified"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
            className="flex size-11 items-center justify-center border border-border"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
            className="flex size-11 items-center justify-center border border-border"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-7 border-l border-t border-border">
        {weekdays.map((day) => (
          <div
            key={day}
            className="border-b border-r border-border bg-background p-2 text-center text-xs font-semibold"
          >
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          if (!day)
            return (
              <div
                key={`empty-${index}`}
                className="min-h-24 border-b border-r border-border bg-background/50"
              />
            );
          const key = keyFor(day);
          const bookings = active.filter((request) => request.date === key);
          const busyCount = busy.filter((block) => block.date === key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDay(key)}
              aria-pressed={selectedDay === key}
              className={`min-h-24 border-b border-r border-border p-2 text-left align-top hover:bg-secondary ${selectedDay === key ? "bg-brand-soft/40 outline outline-1 outline-inset outline-foreground" : ""}`}
            >
              <span className="font-mono text-xs">{day.getDate()}</span>
              <span className="mt-1 block text-xs font-medium">
                {bookings.length
                  ? `${bookings.length} booking${bookings.length === 1 ? "" : "s"}`
                  : ""}
              </span>
              {connected && busyCount > 0 && (
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {busyCount} Google busy
                </span>
              )}
            </button>
          );
        })}
      </div>
      <section className="mt-6 border-t border-border pt-4">
        <h3 className="font-display text-lg font-semibold">
          {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h3>
        {selected.length === 0 && busySelected.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">No appointments on this day.</p>
        )}
        <ul className="mt-3 divide-y divide-border">
          {selected.map((request) => (
            <li key={request.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span>
                <span className="font-mono">{request.time}</span> · {request.customerName} ·{" "}
                {request.status}
              </span>
              <span className="flex items-center gap-3 text-muted-foreground">
                {request.memberId}
                {request.depositPaidAt && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await syncBooking({ data: { id: request.id } });
                        await queryClient.invalidateQueries({
                          queryKey: ["owner-google-calendar"],
                        });
                        toast.success("Google Calendar updated");
                      } catch {
                        toast.error("Google Calendar did not sync");
                      }
                    }}
                    className="min-h-10 text-brand underline"
                  >
                    Retry sync
                  </button>
                )}
              </span>
            </li>
          ))}
          {connected &&
            busySelected.map((block, index) => (
              <li key={`${block.start}-${index}`} className="py-3 text-sm text-muted-foreground">
                <span className="font-mono">
                  {time(block.start)}–{time(block.end)}
                </span>{" "}
                · Busy in Google Calendar
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
