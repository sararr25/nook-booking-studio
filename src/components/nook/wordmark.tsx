import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-start font-display text-2xl font-bold leading-none",
        className,
      )}
    >
      Nook
      {/* The corner bracket is Nook's mark: a small nook beside the name. */}
      <span
        aria-hidden="true"
        className="ml-0.5 mt-[0.05em] size-[0.36em] border-r-[0.11em] border-t-[0.11em] border-brand-ink"
      />
    </span>
  );
}
