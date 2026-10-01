import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { syncOwnerBookingCalendar } from "@/lib/nook/owner-calendar.functions";
import type { BookingRequest } from "@/lib/nook/types";
import type { BusyBlock } from "@/lib/nook/google-calendar.server";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const statusLabel: Record<BookingRequest["status"], string> = {
  confirmed: "Confirmed",
  awaiting_deposit: "Awaiting deposit",
  pending: "Needs review",
  declined: "Cancelled",
};
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
  const todayKey = keyFor(new Date());
  return (
    <div className="mt-6 rounded-sm border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
            className="flex size-8 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:bg-secondary"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h2 className="min-w-[8.5rem] text-center font-display text-base font-bold">
            {cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
            className="flex size-8 items-center justify-center rounded-sm text-foreground/70 transition-colors hover:bg-secondary"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <p
          role="status"
          className={cn("text-xs", connected ? "text-highlight" : "text-destructive")}
        >
          {connected
            ? "Google Calendar checked"
            : "Google Calendar unavailable · times are not verified"}
        </p>
      </div>

      <div className="px-3 pb-3 sm:px-4">
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdays.map((day) => (
            <div
              key={day}
              className="py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} />;
            const key = keyFor(day);
            const count = active.filter((request) => request.date === key).length;
            const busyCount = connected ? busy.filter((block) => block.date === key).length : 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(key)}
                aria-pressed={selectedDay === key}
                aria-label={`${day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, ${count} ${count === 1 ? "booking" : "bookings"}${busyCount ? `, ${busyCount} busy in Google Calendar` : ""}`}
                className={cn(
                  "relative flex h-12 flex-col justify-between rounded-sm border border-border bg-background px-1.5 py-1 text-left transition-colors hover:border-foreground",
                  count > 0 && "bg-brand-soft",
                  selectedDay === key && "nook-selected bg-card",
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold tabular-nums sm:text-sm">
                    {day.getDate()}
                  </span>
                  {key === todayKey && (
                    <span className="size-1.5 rounded-full bg-brand-ink" title="Today" />
                  )}
                </span>
                <span className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold text-foreground">
                    {count > 0 ? count : ""}
                  </span>
                  {busyCount > 0 && (
                    <span
                      className="size-1.5 rounded-full bg-foreground/40"
                      title="Busy in Google Calendar"
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[2px] border border-border bg-brand-soft" /> Has
            bookings (number shown)
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-foreground/40" /> Busy in Google Calendar
          </li>
        </ul>
      </div>

      <section className="border-t border-border px-3 py-3 sm:px-4">
        <h3 className="text-sm font-semibold">
          {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h3>
        {selected.length === 0 && busySelected.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">No appointments on this day.</p>
        )}
        <ul className="mt-2 divide-y divide-border">
          {selected.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
            >
              <span className="min-w-0">
                <span className="font-mono font-semibold">{request.time}</span>
                <span className="ml-2">{request.customerName}</span>
                <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {statusLabel[request.status]}
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
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
                    className="min-h-9 text-brand-ink underline"
                  >
                    Retry sync
                  </button>
                )}
              </span>
            </li>
          ))}
          {connected &&
            busySelected.map((block, index) => (
              <li key={`${block.start}-${index}`} className="py-2.5 text-sm text-muted-foreground">
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
