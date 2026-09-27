import { Link } from "@tanstack/react-router";
import { useNook } from "@/lib/nook/store";
import { Wordmark } from "@/components/nook/wordmark";

export function SiteHeader({ variant = "site" }: { variant?: "site" | "owner" }) {
  const { business, requests } = useNook();
  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        <Link to="/" className="flex items-baseline gap-3">
          <Wordmark />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {variant === "owner" ? "studio settings" : business.name}
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/book"
            className="rounded-sm px-3 py-2 text-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "bg-secondary text-foreground" }}
          >
            Book
          </Link>
          <Link
            to="/owner"
            className="relative rounded-sm px-3 py-2 text-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "bg-secondary text-foreground" }}
          >
            Owner
            {pending > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {pending}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
