export const OAUTH_TOKENS_KEY = "nook.oauthTokens";
export const OAUTH_CALLBACK_PATH = "/auth/callback";

/**
 * Inline, dependency-free script that runs in <head> before any app bundle.
 * The OAuth broker returns full-page sign-ins with the result in the URL
 * fragment. This only moves that result out of the address bar into a
 * short-lived sessionStorage entry and continues to the callback page, where
 * the auth client stores the session through its own (preview-aware) storage.
 * It never builds or writes the session itself, and never logs anything.
 */
export function buildOAuthReturnScript(): string {
  return `(function(){try{
var raw=location.hash.replace(/^#\\/?\\??/,"");if(!raw)return;
var p=new URLSearchParams(raw);var at=p.get("access_token"),rt=p.get("refresh_token");
var err=p.get("error_description")||p.get("error");
if(!at&&!err)return;
history.replaceState(history.state,"",location.pathname+location.search);
try{sessionStorage.setItem(${JSON.stringify(OAUTH_TOKENS_KEY)},JSON.stringify(at&&rt?{at:at,rt:rt}:{error:err||"Sign in failed"}))}catch(e){}
if(location.pathname!==${JSON.stringify(OAUTH_CALLBACK_PATH)})location.replace(${JSON.stringify(OAUTH_CALLBACK_PATH)});
}catch(e){}})();`;
}
