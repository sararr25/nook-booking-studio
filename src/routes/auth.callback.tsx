import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { OAUTH_TOKENS_KEY } from "@/lib/nook/oauth-return-script";

type StoredReturn = { at: string; rt: string } | { error: string };

function isStoredReturn(value: unknown): value is StoredReturn {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (typeof record["at"] === "string" && typeof record["rt"] === "string") ||
    typeof record["error"] === "string"
  );
}

/** Reads and immediately removes the one-time sign-in result left by the head script. */
function takeStoredReturn(): StoredReturn | null {
  const raw = sessionStorage.getItem(OAUTH_TOKENS_KEY);
  sessionStorage.removeItem(OAUTH_TOKENS_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredReturn(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in | Nook" },
      { name: "description", content: "Finishing your sign-in to the studio dashboard." },
      { property: "og:title", content: "Signing you in | Nook" },
      { property: "og:description", content: "Finishing your sign-in to the studio dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = takeStoredReturn();
      const { supabase } = await import("@/integrations/supabase/client");
      if (result && "error" in result) {
        if (!cancelled) setFailed(result.error);
        return;
      }
      if (result) {
        const { error } = await supabase.auth.setSession({
          access_token: result.at,
          refresh_token: result.rt,
        });
        if (error) {
          if (!cancelled) setFailed("Sign in failed. Please try again.");
          return;
        }
      }
      // Only continue once the auth client confirms a stored, valid session.
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setFailed("We couldn't finish signing you in. Please try again.");
        return;
      }
      await navigate({ to: "/owner", replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      {failed ? (
        <div className="max-w-sm text-center">
          <h1 className="text-2xl">Sign in didn't finish</h1>
          <p className="mt-3 text-sm text-muted-foreground">{failed}</p>
          <Link
            to="/auth"
            search={{ notice: undefined }}
            className="mt-6 inline-flex h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> Signing you in
        </p>
      )}
    </main>
  );
}
