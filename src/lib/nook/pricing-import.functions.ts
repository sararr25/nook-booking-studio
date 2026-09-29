import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reads only a public Google Sheet as CSV; private sheets need a downloaded XLSX file. */
export const readPublicGoogleSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ url: z.string().url().max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: owner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!owner) throw new Error("Owner access required");
    const url = new URL(data.url);
    if (url.hostname !== "docs.google.com") throw new Error("Paste a Google Sheets link");
    const match = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
    if (!match?.[1]) throw new Error("Paste a Google Sheets link");
    const gid = url.searchParams.get("gid") ?? url.hash.match(/gid=([0-9]+)/)?.[1] ?? "0";
    if (!/^\d+$/.test(gid)) throw new Error("Invalid sheet tab");
    const exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
    const response = await fetch(exportUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok)
      throw new Error(
        "This Sheet is not publicly readable. Share it for viewing or upload an XLSX copy.",
      );
    const csv = await response.text();
    if (csv.length > 1_000_000) throw new Error("Sheet is too large. Import up to 1 MB of prices.");
    if (/^\s*<!doctype html/i.test(csv))
      throw new Error("Google returned a sign-in page. Upload an XLSX copy instead.");
    return { csv };
  });
