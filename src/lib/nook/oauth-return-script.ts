/**
 * Inline, dependency-free script that runs in <head> before any app bundle.
 * The Lovable OAuth broker returns full-page sign-ins to the site root with the
 * session in the URL fragment. Handling it here means the session is stored and
 * the tokens leave the address bar even if the app bundle or hydration fails.
 * It writes the same localStorage entry the auth client reads (top-level pages
 * always use localStorage), then continues to /owner. Tokens are never logged.
 */
export function buildOAuthReturnScript(supabaseUrl: string | undefined): string {
  if (!supabaseUrl) return "";
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0] ?? "";
  const storageKey = `sb-${projectRef}-auth-token`;
  return `(function(){try{
var raw=location.hash.replace(/^#\\/?\\??/,"");if(!raw)return;
var p=new URLSearchParams(raw);var at=p.get("access_token"),rt=p.get("refresh_token");
var err=p.get("error_description")||p.get("error");
if(!at&&!err)return;
history.replaceState(history.state,"",location.pathname+location.search);
try{sessionStorage.removeItem("nook.postAuthPath")}catch(e){}
if(!at||!rt){location.replace("/auth");return;}
var seg=at.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");while(seg.length%4)seg+="=";
var c=JSON.parse(decodeURIComponent(escape(atob(seg))));
var now=Math.floor(Date.now()/1000);var exp=Number(p.get("expires_at"))||c.exp||now+3600;
var session={access_token:at,refresh_token:rt,token_type:p.get("token_type")||"bearer",expires_in:Math.max(0,exp-now),expires_at:exp,
user:{id:c.sub,aud:c.aud,role:c.role,email:c.email,phone:c.phone||"",app_metadata:c.app_metadata||{},user_metadata:c.user_metadata||{},created_at:""}};
localStorage.setItem(${JSON.stringify(storageKey)},JSON.stringify(session));
location.replace("/owner");
}catch(e){location.replace("/auth")}})();`;
}
