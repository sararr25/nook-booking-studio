import type {
  Answers,
  BusinessConfig,
  Option,
  Question,
  Quote,
  Service,
  TeamMember,
} from "./types";

export const formatMoney = (value: number, currency: string) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(value));

export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
};

const percentChange = (factor: number) => {
  const pct = Math.round((factor - 1) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
};

/** Short, customer-facing summary of what picking an option adds, e.g. "+€25, +20 min". */
export const describeOptionEffect = (option: Option, currency: string) => {
  const parts: string[] = [];
  if (option.priceDelta) parts.push(`+${formatMoney(option.priceDelta, currency)}`);
  if (option.priceFactor && option.priceFactor !== 1)
    parts.push(`${percentChange(option.priceFactor)} price`);
  if (option.durationDelta) parts.push(`+${formatDuration(option.durationDelta)}`);
  if (option.durationFactor && option.durationFactor !== 1)
    parts.push(`${percentChange(option.durationFactor)} time`);
  return parts.join(", ");
};

export const isQuestionVisible = (question: Question, answers: Answers) => {
  if (!question.showIf) return true;
  const value = answers[question.showIf.questionId];
  if (Array.isArray(value)) return value.some((v) => question.showIf!.values.includes(v));
  return typeof value === "string" && question.showIf.values.includes(value);
};

export const visibleQuestions = (service: Service, answers: Answers) =>
  service.questions.filter((q) => isQuestionVisible(q, answers));

export const isAnswered = (question: Question, answers: Answers) => {
  const value = answers[question.id];
  if (question.optional) return true;
  if (question.type === "multi") return true;
  if (question.type === "text") return typeof value === "string" && value.trim().length > 2;
  if (question.type === "scale") return typeof value === "number";
  return typeof value === "string" && value.length > 0;
};

const selectedOptions = (question: Question, answers: Answers): Option[] => {
  const value = answers[question.id];
  if (!question.options) return [];
  if (Array.isArray(value)) return question.options.filter((o) => value.includes(o.id));
  if (typeof value === "string") return question.options.filter((o) => o.id === value);
  return [];
};

export const buildQuote = (
  business: BusinessConfig,
  service: Service,
  answers: Answers,
  extraSkills?: string[],
): Quote => {
  let price = service.basePrice;
  let duration = service.baseDuration;
  const lines: { label: string; detail: string }[] = [];
  const reviewReasons: string[] = [];
  const requiredSkills: string[] = [];
  let requiresPhotos = false;

  if (service.basePrice > 0) {
    lines.push({
      label: `${service.name} base`,
      detail: `${formatMoney(service.basePrice, business.policies.currency)} · ${formatDuration(service.baseDuration)}`,
    });
  }

  for (const question of visibleQuestions(service, answers)) {
    if (question.type === "scale") {
      const value =
        typeof answers[question.id] === "number"
          ? (answers[question.id] as number)
          : (question.min ?? 0);
      const over = Math.max(0, value - (question.min ?? 0));
      const addPrice = over * (question.pricePerUnit ?? 0);
      const addDuration = over * (question.durationPerUnit ?? 0);
      price += addPrice;
      duration += addDuration;
      if (addPrice || addDuration) {
        lines.push({
          label:
            `${value}${question.unit ?? ""} ${question.label.toLowerCase().includes("big") ? "piece" : ""}`.trim(),
          detail: `+${formatMoney(addPrice, business.policies.currency)} · +${formatDuration(Math.round(addDuration))}`,
        });
      }
      continue;
    }

    for (const option of selectedOptions(question, answers)) {
      const before = { price, duration };
      if (option.priceDelta) price += option.priceDelta;
      if (option.priceFactor) price *= option.priceFactor;
      if (option.durationDelta) duration += option.durationDelta;
      if (option.durationFactor) duration *= option.durationFactor;
      if (option.requiresSkills) requiredSkills.push(...option.requiresSkills);
      if (option.requiresPhotos) requiresPhotos = true;
      if (option.requiresReview) reviewReasons.push(`${question.label} ${option.label}`);

      const dp = price - before.price;
      const dd = duration - before.duration;
      if (Math.round(dp) !== 0 || Math.round(dd) !== 0) {
        const parts: string[] = [];
        if (Math.round(dp) !== 0)
          parts.push(
            `${dp > 0 ? "+" : "−"}${formatMoney(Math.abs(dp), business.policies.currency)}`,
          );
        if (Math.round(dd) !== 0)
          parts.push(`${dd > 0 ? "+" : "−"}${formatDuration(Math.abs(Math.round(dd)))}`);
        lines.push({ label: option.label, detail: parts.join(" · ") });
      }
    }
  }

  duration = Math.max(service.baseDuration, Math.round(duration / 15) * 15);
  const uniqueSkills = Array.from(new Set([...requiredSkills, ...(extraSkills ?? [])]));
  const eligibleTeam = business.team.filter(
    (m) => uniqueSkills.every((s) => m.skills.includes(s)) && m.maxSession >= duration,
  );

  if (price > business.policies.autoApproveUnder)
    reviewReasons.push("Above the auto-approval price ceiling");
  if (duration > business.policies.autoApproveMaxDuration)
    reviewReasons.push("Longer than a single standard sitting");
  if (eligibleTeam.length === 0) reviewReasons.push("No artist matches this combination yet");

  const spread = price > 0 ? Math.max(20, price * 0.12) : 0;

  return {
    low: Math.round((price - spread) / 5) * 5,
    high: Math.round((price + spread) / 5) * 5,
    duration,
    deposit: Math.round((price * service.depositPercent) / 100),
    requiresReview: reviewReasons.length > 0,
    requiresPhotos,
    reviewReasons: Array.from(new Set(reviewReasons)),
    requiredSkills: uniqueSkills,
    eligibleTeam,
    lines,
  };
};

const toMinutes = (time: string) => {
  const parts = time.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
};

export const toTimeLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export type Slot = { time: string; memberId: string; memberName: string };

export const slotsForDay = (
  business: BusinessConfig,
  eligibleTeam: TeamMember[],
  duration: number,
  date: Date,
  booked: { date: string; time: string; memberId: string; duration: number }[],
  /** Studio-wide busy times (e.g. Google Calendar), minutes after midnight. */
  blocked: { date: string; start: number; end: number }[] = [],
): Slot[] => {
  const key = dateKey(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const earliest = new Date(today);
  earliest.setDate(earliest.getDate() + business.policies.leadTimeDays);
  if (date < earliest) return [];

  const slots: Slot[] = [];
  for (const member of eligibleTeam) {
    if (!member.days.includes(date.getDay())) continue;
    const start = toMinutes(member.start);
    const end = toMinutes(member.end);
    for (let t = start; t + duration <= end; t += 60) {
      const time = toTimeLabel(t);
      const clash = booked.some(
        (b) =>
          b.date === key &&
          b.memberId === member.id &&
          toMinutes(b.time) < t + duration &&
          t < toMinutes(b.time) + b.duration,
      );
      if (clash) continue;
      if (blocked.some((b) => b.date === key && b.start < t + duration && b.end > t)) continue;
      slots.push({ time, memberId: member.id, memberName: member.name });
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 8);
};

/** Picks the strongest fit: covers the required skills, specialises in them, and has room to spare. */
export const recommendArtist = (quote: Quote): { member: TeamMember; reason: string } | null => {
  const scored = quote.eligibleTeam.map((member) => {
    const lead = member.skills
      .slice(0, 2)
      .reduce(
        (sum, skill, index) => sum + (quote.requiredSkills.includes(skill) ? 2 - index : 0),
        0,
      );
    const focus = quote.requiredSkills.length / Math.max(1, member.skills.length);
    const headroom = Math.min(1, (member.maxSession - quote.duration) / 120);
    return { member, lead, score: lead * 3 + focus * 2 + headroom };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  const reason =
    best.lead > 0
      ? `${best.member.role}. Closest match to your style and placement.`
      : `Covers everything this piece needs and has time for a ${formatDuration(quote.duration)} sitting.`;
  return { member: best.member, reason };
};

const skillNames: Record<string, string> = {
  fineline: "fine line",
  blackwork: "blackwork",
  colour: "colour",
  lettering: "lettering",
  coverup: "cover-ups",
  "exposed-placement": "exposed placements",
};

/** Customer-facing fit note based only on configured skills and sitting length. */
export const describeArtistFit = (quote: Quote, member: TeamMember) => {
  const firstName = member.name.split(" ")[0] ?? member.name;
  const matching = quote.requiredSkills.filter((skill) => member.skills.includes(skill));
  if (matching.length === 0) {
    return `${firstName} can take the estimated ${formatDuration(quote.duration)} sitting.`;
  }
  const focus = matching.filter((skill) => member.skills.slice(0, 2).includes(skill));
  const names = (focus.length ? focus : matching).map((skill) => skillNames[skill] ?? skill);
  const specialties = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(
    names,
  );
  return focus.length
    ? `${specialties[0]?.toUpperCase() ?? ""}${specialties.slice(1)} ${names.length > 1 ? "are" : "is"} a focus of ${firstName}'s work.`
    : `${firstName} also takes ${specialties} pieces.`;
};
