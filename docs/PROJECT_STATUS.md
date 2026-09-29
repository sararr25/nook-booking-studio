# Nook Booking Studio — project status

Last verified: 29 September 2026. The connected GitHub repository is `sararr25/nook-booking-studio`, branch `main`.

## Current change rollout

The current revision gates deposit bookings behind an `awaiting_deposit` state and records a demo payment in the payment page's server-side loader before rendering the result. The build passes. Migration `20260929145901` has been applied to Lovable Cloud; the database constraint and booking RPC accept `awaiting_deposit`.

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
- The payment-demo route now invokes the payment operation during server-side page loading instead of relying on a browser effect. A safe nonexistent-reference check returned the expected unpaid page with HTTP 200 and no browser errors; no customer booking was changed for this check.

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
