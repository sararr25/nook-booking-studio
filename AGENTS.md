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

## Product

- Nook is a business-agnostic booking product. The tattoo studio (Ember & Thread) is only demo content: never give the system UI a tattoo look (no flash illustrations or tattoo motifs as decoration). Flash images belong only to demo data such as the Flash picker and Flash tab.
- Booking rule: standard requests (inside the owner's auto-confirm price and length limits) get a confirmation email straight away with a link to pay the deposit. Requests that need review are confirmed by the studio first, then the same email goes out. The deposit is due within `policies.depositDueHours` (default 24) and is 20% for every paid service. Price is always shown as an estimate. The terms live in `bookingTerms()` in `src/routes/book.tsx` and are shown in the booking ticket and on the confirmation page.
- Every answer shows its effect on the option itself via `describeOptionEffect()` in `src/lib/nook/engine.ts`; the owner Questions tab shows the same text in its "Customer sees" column. Keep both in sync by always using that helper.
- Owner access: the first account that signs up gets the `owner` role (database trigger `handle_new_user`); later accounts become `customer`. Owner panel data (services, questions, team, policies, requests) lives in localStorage via `NookProvider`; "Reset demo" restores `defaultBusiness`. Saved configs are merged with default policies on load, so new policy fields need a default in `config.ts`.

## Design system

- Surfaces: warm page (`--background`) plus lighter paper (`--card`); near-black `--ink` is used as a real contrast band (landing demo section). One accent, rust `--brand`, only for interactive/selected state and emphasis; green `--highlight` only for positive status. No pure white or black.
- Type: Bricolage Grotesque for headings (bold, tight line-height ~1.02), Manrope for body, IBM Plex Mono for prices, times, durations and counts. Keep headings restrained: booking/owner page titles max `text-5xl`, landing hero max `text-6xl`; use `text-balance` so no single word sits alone on a line. Labels (`eyebrow`) are 12px, never smaller.
- Shape: 2px radius (`rounded-sm`) on every control and surface. Full round only for avatars and small status/count badges.
- Elevation: the only shadow is the hard offset "print" shadow (`.nook-choice`, `.nook-ticket`). No soft blur shadows.
- Selected state: `.nook-selected` = ink border + rust offset shadow, never a filled tint. Hover = ink border.
- Booking summary is the `BookingTicket` component (receipt with perforations and a status stamp); reuse it instead of new summary cards. Use the `Wordmark` component for the "Nook." logo.
- Avoid template tells: no decorative numbering (only questionnaire question numbers), at most one eyebrow per few sections, no em-dashes in visible copy, no sparkle/wand "AI" icons, no three identical feature cards.
- Booking flow layout: the action bar is sticky at the bottom (thumb zone on mobile); on mobile the ticket is replaced by the price line in that bar. The calendar opens on the first month with free days.

## Code notes

- Keep the three fictional artist portraits in a dedicated image lookup keyed by stable artist ID; this makes the booking and owner views share the same portraits without persisting generated image paths in customer-editable data.
- Keep NookProvider alongside each Nook content route rather than in the root layout, so a hot-reloaded route and its store consumer share the same context instance.
- Studio setup (services, questions, team, policies) is stored as one JSON document in studio_settings.config (row 'main'); bookings live in booking_requests. Why: owner edits must persist across devices, and one document keeps the booking engine's shape intact.
