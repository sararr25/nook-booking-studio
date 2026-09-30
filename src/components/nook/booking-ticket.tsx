import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TicketRow = { label: string; value: ReactNode };

/**
 * Business-agnostic booking summary, styled as a receipt. Used by the live
 * booking flow and by the landing-page demo, so any trade reads the same way.
 */
export function BookingTicket({
  heading = "Booking summary",
  title,
  price,
  rows,
  review,
  pendingDeposit = false,
  note,
  terms,
  className,
}: {
  heading?: string;
  title: string;
  price: ReactNode;
  rows: TicketRow[];
  review: boolean;
  pendingDeposit?: boolean;
  note?: string | undefined;
  /** Small-print conditions, e.g. estimate and deposit rules. */
  terms?: string[];
  className?: string;
}) {
  return (
    <div className={cn("nook-ticket", className)}>
      <div className="px-5 pb-5 pt-4">
        <p className="eyebrow">{heading}</p>
        <p className="mt-3 font-display text-xl font-semibold leading-tight">{title}</p>
        <p className="nook-enter mt-2 font-mono text-2xl font-semibold tabular-nums">{price}</p>
      </div>
      <dl className="nook-perforation grid gap-3 px-5 py-5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="nook-enter text-right font-mono font-medium tabular-nums">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="nook-perforation px-5 py-4">
        <span
          className={cn("nook-stamp", review || pendingDeposit ? "text-brand" : "text-highlight")}
        >
          {review
            ? "To be confirmed by the studio"
            : pendingDeposit
              ? "Instant confirmation after deposit"
              : "Instant confirmation"}
        </span>
        {note && <p className="mt-3 text-xs text-muted-foreground">{note}</p>}
      </div>
      {terms && terms.length > 0 && (
        <ul className="nook-perforation list-disc space-y-1.5 py-4 pl-9 pr-5 text-xs leading-relaxed text-muted-foreground">
          {terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
