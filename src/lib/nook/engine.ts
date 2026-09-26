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
      const value = typeof answers[question.id] === "number" ? (answers[question.id] as number) : question.min ?? 0;
      const over = Math.max(0, value - (question.min ?? 0));
      const addPrice = over * (question.pricePerUnit ?? 0);
      const addDuration = over * (question.durationPerUnit ?? 0);
      price += addPrice;
      duration += addDuration;
      if (addPrice || addDuration) {
        lines.push({
          label: `${value}${question.unit ?? ""} ${question.label.toLowerCase().includes("big") ? "piece" : ""}`.trim(),
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
      if (option.requiresReview) reviewReasons.push(`${option.label} — ${question.label.toLowerCase()}`);

      const dp = price - before.price;
      const dd = duration - before.duration;
      if (Math.round(dp) !== 0 || Math.round(dd) !== 0) {
        const parts: string[] = [];
        if (Math.round(dp) !== 0)
          parts.push(`${dp > 0 ? "+" : "−"}${formatMoney(Math.abs(dp), business.policies.currency)}`);
        if (Math.round(dd) !== 0)
          parts.push(`${dd > 0 ? "+" : "−"}${formatDuration(Math.abs(Math.round(dd)))}`);
        lines.push({ label: option.label, detail: parts.join(" · ") });
      }
    }
  }

  duration = Math.max(30, Math.round(duration / 15) * 15);
  const uniqueSkills = Array.from(new Set(requiredSkills));
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

/** Deterministic pseudo-random so the demo calendar is stable between renders. */
const seeded = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
};

export type Slot = { time: string; memberId: string; memberName: string };

export const slotsForDay = (
  business: BusinessConfig,
  eligibleTeam: TeamMember[],
  duration: number,
  date: Date,
  booked: { date: string; time: string; memberId: string }[],
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
    if (seeded(`${member.id}-${key}-off`) > 0.78) continue; // day already blocked out
    const start = toMinutes(member.start);
    const end = toMinutes(member.end);
    for (let t = start; t + duration <= end; t += 60) {
      if (seeded(`${member.id}-${key}-${t}`) > 0.55) continue;
      const time = toTimeLabel(t);
      const clash = booked.some(
        (b) => b.date === key && b.memberId === member.id && Math.abs(toMinutes(b.time) - t) < duration,
      );
      if (clash) continue;
      slots.push({ time, memberId: member.id, memberName: member.name });
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 8);
};
