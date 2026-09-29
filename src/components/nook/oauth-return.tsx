import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export const POST_AUTH_KEY = "nook.postAuthPath";

function safePath(value: string | null): "/owner" {
  // Only same-origin owner destination is supported after OAuth.
  return value === "/owner" ? "/owner" : "/owner";
}

/**
 * Full-page OAuth returns to a public page with tokens in the URL fragment.
 * Pages like the studio homepage never load the auth client, so the fragment
 * was dropped on the next navigation. Persist the session here, strip the
 * fragment, and continue to the intended destination.
 */
export function OAuthReturnHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const oauthError = params.get("error_description") ?? params.get("error");
    if (!accessToken && !oauthError) return;

    // Remove tokens from the address bar and history immediately.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    if (oauthError || !accessToken || !refreshToken) {
      sessionStorage.removeItem(POST_AUTH_KEY);
      toast.error(oauthError ?? "Sign in failed");
      void navigate({ to: "/auth", search: { notice: undefined } });
      return;
    }

    void (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      const destination = safePath(sessionStorage.getItem(POST_AUTH_KEY));
      sessionStorage.removeItem(POST_AUTH_KEY);
      if (error) {
        toast.error("Sign in failed. Please try again.");
        void navigate({ to: "/auth", search: { notice: undefined } });
        return;
      }
      void navigate({ to: destination });
    })();
  }, [navigate]);

  return null;
}
