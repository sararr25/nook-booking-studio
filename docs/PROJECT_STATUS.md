# Nook Booking Studio — project status

Last verified: 30 September 2026. The connected GitHub repository is `sararr25/nook-booking-studio`, branch `main`.

## New Stillroom flash artwork (30 September 2026)

All ten supplied designs in `assets/tatto1.png` through `tatto10.png` are available in the owner's Flash tab as unpublished artwork. The owner chooses each design's name, base price, and sitting length before publishing it to the existing `flash_designs` catalog. Published prices can also be edited later, including on reserved designs. Customer selection and quotes continue to read the saved catalog price. No SQL migration is needed for this change.

PR #2 was merged into `main`, and commit `854575d` added the last three artwork files. Lovable reports `main` in sync and its revision-specific preview for commit `b454e0e` served the updated `/book` conversation and the authenticated `/owner?tab=flash` panel with all ten unpriced designs and price inputs on the existing four designs. No catalog rows were added or prices changed during this check. The editor still labels GitHub revisions **Build unsuccessful** and its embedded preview out of date, so this discrepancy remains to investigate. The site has not been published. Local TypeScript, targeted lint, and production build pass.

Lovable's quick security scan flagged public read access to every object in `flash-gallery`. Migration `20260930133000_restrict_flash_gallery_reads.sql` limits anonymous reads to designs with an available catalog entry and gives owners access to all flash files. The policy was applied through Lovable Cloud SQL editor and verified in `pg_policies`. The new scan still flags the narrower public rule because every visitor can read the public artwork it matches; that is intentional for bookable flash, but the finding has not been dismissed. The separate warning on public `studio_settings` reads remains to be reviewed. Automatic approval review rejected the external Publish action while the critical finding and failed-build labels remain unresolved.

## Booking conversation change (30 September 2026)

The current PR adds short typed question reveals and a secondary guided conversation on `/book`. Conversation answers populate the existing quote and booking form; submitting still requires the customer's date, contact details, and explicit confirmation. The receipt now labels deposit bookings as awaiting deposit. See [BOOKING_EXPERIENCE.md](./BOOKING_EXPERIENCE.md) for the visual proposals and the guided assistant's supported scope. Local compilation and browser flow checks do not verify the Lovable preview or any booking, email, or calendar mutation.

The follow-up on the same PR adds customer-facing fit notes to the artist choices, derived from configured skills and the quoted sitting length. Additional layout proposals are documented but remain unimplemented while the new flash artwork is being prepared.

## Current change rollout

The current revision gates deposit bookings behind an `awaiting_deposit` state. The email targets a dedicated server endpoint that records and verifies the demo deposit before redirecting to a read-only receipt. Migration `20260929145901` has been applied to Lovable Cloud; the database constraint and booking RPC accept `awaiting_deposit`.

Previously sent direct receipt links are upgraded in the browser to the same dedicated payment endpoint, so they remain usable after this change.

## What is implemented

- `/` is the Stillroom Tattoo website. Its hero opens `/book`, while the header owner link opens `/auth`.
- `/book` has adaptive service details, dynamic one-off flash selection, quote and artist matching, server-checked availability, and customer details. Public booking insertion uses a database function that rejects overlapping sittings and duplicate flash reservations.
- `/owner` has booking list and calendar views, pricing controls, reviewed price-list imports from XLSX, CSV, text-based PDF, or a public Google Sheet, plus availability, questions, team, flash, and policies.
- The owner calendar displays Nook bookings alongside Google Calendar busy blocks. The public calendar withholds times when Google Calendar cannot be verified. A booking with a deposit stays pending while it awaits payment; opening its demo deposit link marks it paid, confirms the appointment and attempts to add its event to Google Calendar. Paid booking changes and cancellations attempt to update or remove that event.

## Verified

- Lovable's project history selected the GitHub-pushed revision `4b14a48`; its owner overview showed the new “Awaiting deposit” tile.
- Applying migration `20260929145901_deposit_confirmation_lifecycle.sql` reclassified three existing bookings with unpaid deposits to `awaiting_deposit`. A rollback-only call to `create_booking_request` accepted a sample awaiting-deposit payload, and the verification row was not persisted.
- The owner Google sign-in page opens in the preview and its button launches Google's account chooser. The successful return to `/auth` and `/owner` remains unverified after this change.
- Google Calendar integration code is present, but the preview owner overview currently reports “Needs attention”. Runtime connection and event creation remain unverified; check the Lovable project's server-side Google Calendar connector configuration.
- The external Lovable preview displayed the flash catalog with three available designs, prices, and durations from the connected database.
- A flash booking was followed through quote and date selection without submission. The server returned available days and times for a 75-minute sitting after checking studio and Google Calendar availability.
- The SQL migrations for booking integrity and the flash seed were applied to Lovable Cloud and verified by a read-only query. Local TypeScript, build, targeted lint, and a SQL smoke test passed for commit `346a353`.
- The former page-loader payment path was observed returning HTTP 200 while leaving a real awaiting-deposit booking unchanged. The email link now uses a dedicated server endpoint, and the receipt reports success only after a database re-read confirms both the paid timestamp and confirmed status.

## Still to verify before public use

1. Complete a controlled booking with a test customer address. Check that a deposit booking starts as awaiting deposit, that its email never says confirmed, and that the Pay deposit link is delivered. Do not rely on a visible time slot alone or the rollback-only database check as proof that the full submission and email flow works.
2. Open the demo deposit link and verify the page says the payment completed and the appointment is confirmed, the owner status changes to confirmed, and exactly one Google Calendar event appears. Change and cancel that booking in the owner portal and verify the event follows those changes.
3. Add a busy event directly in Google Calendar and confirm that the overlapping time disappears from the customer booking calendar.
4. Sign in with the owner Google account in the Lovable preview. Confirm OAuth returns to `/auth` and opens `/owner`, then test booking review, pricing import, autosave, and the list/calendar switch using real project data. Google sign-in does not work on localhost.
5. Publish the Lovable site when the end-to-end checks are complete. GitHub sync and the preview do not publish the website automatically. At the last check, the project was not published.

## Environment and deployment

- Keep `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, and `GOOGLE_CALENDAR_API_KEY` server-side. The Google connector must be linked to this Lovable project. The public Supabase URL and publishable key are in `.env`.
- Apply new SQL migrations to the connected Lovable Cloud database before using code that depends on them. Git sync only transfers the SQL files. Migration `20260929145901` was applied to the Nook cloud database on 29 September 2026.
- After pushing code to `main`, confirm Lovable's **Settings → Git → GitHub** reports the branch in sync. If the preview still shows an older version, select the latest **Pushed from GitHub** item in the project history and use its **Preview** action, then check the external preview.
- A local build confirms compilation. The external Lovable preview confirms served code and read paths. Neither proves booking submission, email delivery, Google event creation, or a published domain.
