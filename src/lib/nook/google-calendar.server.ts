const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
export const STUDIO_TIME_ZONE = "Europe/Stockholm";

export type BusyBlock = { date: string; start: number; end: number };

function headers() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const calendarKey = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!lovableKey || !calendarKey) throw new Error("Google Calendar is not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": calendarKey,
    "Content-Type": "application/json",
  };
}

async function call(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Calendar request failed [${response.status}]: ${errorBody}`);
  }
  return response.json();
}

/** Splits a UTC instant into the studio's local date and minutes after midnight. */
function toStudioLocal(iso: string): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: STUDIO_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
    minutes: Number(parts["hour"]) * 60 + Number(parts["minute"]),
  };
}

/** Busy times in the studio's primary calendar, split per local day. */
export async function fetchBusyBlocks(timeMin: string, timeMax: string): Promise<BusyBlock[]> {
  const result = (await call("/freeBusy", {
    timeMin,
    timeMax,
    timeZone: STUDIO_TIME_ZONE,
    items: [{ id: "primary" }],
  })) as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } };
  const blocks: BusyBlock[] = [];
  for (const busy of result.calendars?.primary?.busy ?? []) {
    let cursor = new Date(busy.start);
    const end = new Date(busy.end);
    // Walk day by day so multi-day events block every day they cover.
    for (let guard = 0; cursor < end && guard < 60; guard += 1) {
      const from = toStudioLocal(cursor.toISOString());
      const nextDay = new Date(cursor.getTime() + (24 * 60 - from.minutes) * 60_000);
      const until = end < nextDay ? toStudioLocal(end.toISOString()) : null;
      blocks.push({
        date: from.date,
        start: from.minutes,
        end: until && until.date === from.date ? until.minutes : 24 * 60,
      });
      cursor = nextDay;
    }
  }
  return blocks;
}

/** Adds a confirmed appointment to the studio's primary calendar. */
export async function createAppointmentEvent(input: {
  bookingId: string;
  summary: string;
  description: string;
  date: string;
  time: string;
  durationMinutes: number;
}) {
  const [hours = 0, minutes = 0] = input.time.split(":").map(Number);
  const startTotal = hours * 60 + minutes;
  const endTotal = startTotal + Math.max(15, input.durationMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  const endDate = new Date(`${input.date}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + Math.floor(endTotal / 1440));
  const endLabel = `${endDate.toISOString().slice(0, 10)}T${pad(Math.floor((endTotal % 1440) / 60))}:${pad(endTotal % 60)}:00`;
  // A deterministic event id makes repeat calls harmless (Google rejects duplicates).
  const eventId = `nook${input.bookingId.replace(/-/g, "")}`;
  try {
    await call("/calendars/primary/events", {
      id: eventId,
      summary: input.summary,
      description: input.description,
      start: { dateTime: `${input.date}T${pad(hours)}:${pad(minutes)}:00`, timeZone: STUDIO_TIME_ZONE },
      end: { dateTime: endLabel, timeZone: STUDIO_TIME_ZONE },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("[409]")) return;
    throw error;
  }
}
