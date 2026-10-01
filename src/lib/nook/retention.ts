/** Cancelled or declined bookings disappear this many days after they were cancelled. */
export const CANCELLED_RETENTION_DAYS = 15;
/** Past bookings disappear this many days after the appointment. Keep in sync with purge_expired_bookings(). */
export const PAST_RETENTION_DAYS = 100;

const DAY_MS = 86_400_000;

/** Whole days left before a cancelled booking is removed (0 means it goes at the next cleanup). */
export const cancelledDaysLeft = (cancelledAt: string | undefined, now = new Date()): number => {
  if (!cancelledAt) return CANCELLED_RETENTION_DAYS;
  const elapsed = Math.floor((now.getTime() - new Date(cancelledAt).getTime()) / DAY_MS);
  return Math.max(0, CANCELLED_RETENTION_DAYS - elapsed);
};

/** Whole days left before a past booking is removed, counted from its appointment date. */
export const pastDaysLeft = (date: string, now = new Date()): number => {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const elapsed = Math.round((midnight - new Date(`${date}T00:00:00`).getTime()) / DAY_MS);
  return Math.max(0, PAST_RETENTION_DAYS - elapsed);
};

export const daysLeftLabel = (days: number) =>
  days === 0
    ? "Removed at next cleanup"
    : days === 1
      ? "Removed in 1 day"
      : `Removed in ${days} days`;
