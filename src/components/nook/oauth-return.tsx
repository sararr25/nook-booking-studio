export const POST_AUTH_KEY = "nook.postAuthPath";

type OAuthReturn =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string };

type NavigateTo = (to: "/owner" | "/auth") => void;

/** Reads OAuth results from the fragment or query, tolerating "#/?..." style fragments. */
function readOAuthReturn(): OAuthReturn | null {
  const rawHash = window.location.hash.replace(/^#\/?\??/, "");
  const sources = [new URLSearchParams(rawHash), new URLSearchParams(window.location.search)];
  for (const params of sources) {
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const errorMessage = params.get("error_description") ?? params.get("error");
    if (accessToken && refreshToken) return { kind: "tokens", accessToken, refreshToken };
    if (accessToken || errorMessage) {
      return { kind: "error", message: errorMessage ?? "Sign in failed" };
    }
  }
  return null;
}

function stripOAuthParams() {
  const url = new URL(window.location.href);
  for (const key of [
    "access_token",
    "refresh_token",
    "expires_at",
    "expires_in",
    "token_type",
    "provider_token",
    "provider_refresh_token",
    "type",
    "state",
    "error",
    "error_code",
    "error_description",
  ]) {
    url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
}

/**
 * Runs once at client start-up, before React hydrates, so the callback is handled
 * on any public page (the broker returns to the site root) without relying on
 * a component effect. Tokens are removed from the address bar immediately and
 * never logged.
 */
export function handleOAuthReturn(navigateTo: NavigateTo) {
  if (typeof window === "undefined") return;
  const result = readOAuthReturn();
  if (!result) return;
  stripOAuthParams();
  sessionStorage.removeItem(POST_AUTH_KEY);

  void (async () => {
    const { toast } = await import("sonner");
    if (result.kind === "error") {
      toast.error(result.message);
      navigateTo("/auth");
      return;
    }
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.auth.setSession({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
    if (error) {
      toast.error("Sign in failed. Please try again.");
      navigateTo("/auth");
      return;
    }
    // Google sign-in is only offered on the owner login.
    navigateTo("/owner");
  })();
}
