<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Product rules
- Nook is business-agnostic; tattoo imagery appears only in demo data, never system decoration.
- Standard requests auto-confirm; review requests need owner approval. Confirmation emails carry a deposit link. Deposits are 20% and due within `policies.depositDueHours`; prices remain estimates.
- Keep option effects synchronized through `describeOptionEffect()`.
- A booking is never confirmed without an assigned artist. The owner edit form never pre-selects an artist.
- Owner booking changes only send a "confirmed" email when the status actually changes; other edits send "changed".
- Owner sections are addressed by `?tab=<section>` on `/owner`. Resetting the whole setup lives only in Policies.
- The first account is owner; later accounts are customers. Owner settings persist through `NookProvider`; defaults come from `defaultBusiness`.

## Design rules
- `/` is the Stillroom Tattoo studio website, with its own scoped tokens in `src/studio.css`; Nook remains the business-agnostic booking and owner interface on `/book` and `/owner`.
- The studio homepage sends customers to `/book` and the top-right owner link to `/auth`.
- Use warm stone `--background`, paper `--card`, near-black `--ink`, rust `--brand`, and green only for positive status. Never pure white or black.
- Use Bricolage Grotesque headings, Manrope body, and IBM Plex Mono for numeric details. Booking/owner titles max `text-5xl`; landing max `text-6xl`; labels are at least 12px.
- Controls and surfaces use 2px radius. Only avatars and tiny badges are round. Use hard print shadows only.
- Selected choices use ink borders and rust offset shadows, not tinted fills.
- Reuse `BookingTicket` for summaries and `Wordmark` for the logo.
- Avoid decorative numbering, repeated eyebrows, em dashes, AI motifs, and identical feature-card rows.
- Keep booking actions sticky on mobile; replace the ticket with its price line there. Open calendars on the first available month.

## Architecture rules
- Keep artist portraits in the stable-ID image lookup shared by booking and owner views.
- Keep `NookProvider` beside each Nook content route to preserve context during hot reload.
- Store studio setup as one JSON document in `studio_settings.config`; bookings stay in `booking_requests`.
- If loading the setup or bookings fails, show the error and block editing. Never fall back to `defaultBusiness`, or autosave would overwrite the real setup.
- `/payment-demo/$bookingId` marks a confirmed deposit paid; never collects card data.
- Keep server credentials out of Git. Apply `supabase/migrations` to the connected database before using code that depends on new SQL; Git sync does not run migrations.
- For release evidence and open end-to-end checks, update `docs/PROJECT_STATUS.md`. Confirm the latest GitHub revision is selected in Lovable's preview before reporting live behavior.
