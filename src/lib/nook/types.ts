export type QuestionType = "single" | "multi" | "scale" | "boolean" | "text";

export type Option = {
  id: string;
  label: string;
  hint?: string;
  /** Flat amount added to the base price. */
  priceDelta?: number;
  /** Multiplier applied to the running price. */
  priceFactor?: number;
  /** Minutes added to the base duration. */
  durationDelta?: number;
  /** Multiplier applied to the running duration. */
  durationFactor?: number;
  /** Skills a team member must have to take this on. */
  requiresSkills?: string[];
  /** Sends the request to the owner instead of auto-confirming. */
  requiresReview?: boolean;
  /** Customer must attach reference photos. */
  requiresPhotos?: boolean;
};

export type Question = {
  id: string;
  label: string;
  help?: string;
  type: QuestionType;
  options?: Option[];
  /** For scale questions. */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Price/duration per unit above min, for scale questions. */
  pricePerUnit?: number;
  durationPerUnit?: number;
  optional?: boolean;
  /** Only show when another question has one of these answers. */
  showIf?: { questionId: string; values: string[] };
};

export type Service = {
  id: string;
  name: string;
  blurb: string;
  basePrice: number;
  baseDuration: number; // minutes
  depositPercent: number;
  questions: Question[];
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  initials: string;
  skills: string[];
  /** Weekday indices (0 = Sunday) this member works. */
  days: number[];
  start: string; // "10:00"
  end: string; // "18:00"
  /** Longest single sitting they take, in minutes. */
  maxSession: number;
  /** Public link to the artist's portfolio. */
  portfolioUrl?: string;
};

export type Policies = {
  currency: string;
  leadTimeDays: number;
  horizonDays: number;
  autoApproveUnder: number; // price ceiling for auto-approval
  autoApproveMaxDuration: number; // minutes
  reviewNote: string;
  cancellationHours: number;
  /** Hours the customer has to pay the deposit before the booking is confirmed. */
  depositDueHours: number;
};

export type BusinessConfig = {
  id: string;
  name: string;
  archetype: string;
  tagline: string;
  location: string;
  services: Service[];
  team: TeamMember[];
  policies: Policies;
};

export type Answers = Record<string, string | string[] | number | boolean>;

export type Quote = {
  low: number;
  high: number;
  duration: number; // minutes
  deposit: number;
  requiresReview: boolean;
  requiresPhotos: boolean;
  reviewReasons: string[];
  requiredSkills: string[];
  eligibleTeam: TeamMember[];
  lines: { label: string; detail: string }[];
};

export type BookingRequest = {
  id: string;
  createdAt: string;
  customerName: string;
  /** Customer email. */
  contact: string;
  phone?: string;
  notes: string;
  serviceId: string;
  answers: Answers;
  quote: Pick<
    Quote,
    "low" | "high" | "duration" | "deposit" | "requiresReview" | "reviewReasons"
  > & {
    lines: { label: string; detail: string }[];
  };
  date: string; // yyyy-mm-dd
  time: string; // "13:00"
  memberId: string;
  flashDesignId?: string;
  referencePaths?: string[];
  status: "confirmed" | "awaiting_deposit" | "pending" | "declined";
  depositPaidAt?: string;
};
