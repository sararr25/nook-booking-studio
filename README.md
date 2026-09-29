# Nook Booking Studio

Build a responsive web app called Nook.

Nook is a smart booking system for service businesses where booking is more complex than simply choosing a service and a free time slot. It should work across different businesses, for example a tattoo studio, photographer, pet groomer, beauty professional, contractor or other appointment-based service.

The customer flow should start with a short adaptive questionnaire tailored to the business. Answers can affect price, estimated duration, extras, whether photos are required, which team members are compatible, and whether the request needs owner review. After the questionnaire, show an estimated quote or price range, then a real month-view calendar with compatible availability. Standard requests can be auto-approved; unusual ones can go to the owner for a quick Approve / Edit review.

The owner side should let a business configure services, pricing rules, durations, questions, team members, availability and booking policies. Keep it lightweight rather than a big CRM.

For the first exploration, feel free to use a fictional business and choose whichever archetype best demonstrates variable pricing, duration and qualification. You can also show hints of how the same system could adapt to other businesses.

Visual direction: clean editorial minimalism, warm but restrained. Strong typography, generous whitespace, warm off-white/neutral backgrounds, charcoal text, subtle accent colour. Avoid generic SaaS styling, blue dashboards, excessive cards, purple AI gradients, glassmorphism or chatbot-first UI. The intelligence should come through the flow, not through “AI” branding.

Make it mobile-friendly and give the product some visual personality. Explore the design rather than treating this as a rigid spec.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/664e83fd-ad41-4b0f-9b00-51c7ba92a361).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Current state

What the app does today, on top of the brief above:

- **Customer flow** (`/book`): service, adaptive questions (each answer shows what it adds, e.g. "+€10, +5 min"), estimate with team match, month calendar with real availability, contact details. A booking ticket on the side keeps the running summary and the terms.
- **Booking rule**: standard requests stay pending until the customer pays the deposit through the demo link; unusual requests are reviewed by the studio first. A booking becomes confirmed only after the deposit is paid. Prices are estimates. The deposit percentage is set per service and the deadline is editable in owner Policies. Booking email delivery is attempted and reported separately from saving the booking. The demo payment flow is not a live payment processor.
- **Studio homepage** (`/`): Stillroom Tattoo has its own editorial identity, artists, flash work and visit details. The hero appointment action opens the Nook customer flow at `/book`; the header owner sign-in opens `/auth`.
- **Owner panel** (`/owner`): overview, searchable bookings with list and calendar views, pricing, availability, questions with a "Customer sees" preview, team, flash book and policies. Each section has its own address (`/owner?tab=bookings`), so refresh and Back work. Setup edits autosave with a visible status and retry action.
- **Booking review**: a request with no matched artist can't be approved until the owner picks one. Editing a booking blocks impossible values (negative prices, past dates, no artist) and warns, without blocking, when the artist is off that day, outside their hours, missing a required skill, past their longest sitting or already booked. Changing a confirmed booking emails the customer a "changed" message, not a new confirmation.
- **Skills**: answers pick required skills from the same list the team uses, and warn when nobody on the team has one.
- **Start over**: restoring the default setup lives at the bottom of Policies, behind a confirmation dialog, with Undo right after. Bookings are never touched.
- **Owner account**: the first account created on `/auth` becomes the owner; later sign-ups are customers. Email and password accounts work locally and on Lovable because both use the same backend. Google sign-in goes through Lovable and only works on the Lovable preview and published domains, not on `localhost`.
- **Availability and booking integrity**: public availability returns only open times. The server checks the saved setup, existing sittings and Google Calendar before submission. A database function locks the artist/date and flash design during insertion to reject concurrent overlaps. Apply the migrations in `supabase/migrations` before serving the new booking flow.
- **Google Calendar**: the owner calendar shows Nook bookings beside Google busy blocks. The app attempts to add a confirmed booking to Google after its demo deposit is marked paid, and to update or remove the event after later changes or cancellation. The server requires `LOVABLE_API_KEY` and `GOOGLE_CALENDAR_API_KEY` for calendar access. When Calendar cannot be checked, public time selection pauses and the owner sees the connection state.

### Import an existing price list

Open **Owner → Pricing → Import an existing price list**. Upload a `.xlsx`, `.csv`, or text based `.pdf` file, or paste a Google Sheet that is shared for viewing. Private Sheets can be downloaded as XLSX and uploaded. Scanned PDFs need OCR before import. The app reads at most 100 rows and shows every detected price for review before applying changes. Imports update the studio setup through the usual autosave.

For a reliable spreadsheet import, use columns `Service`, `Price`, and optionally `Duration` (minutes). To change the flat price or duration of an answer, add `Question` and `Option` columns matching an existing service's question and answer labels. Check any extracted PDF rows and the save status after applying.

Design rules for anyone (or any agent) editing the UI are in `AGENTS.md`.

For the verified release state, setup requirements, and remaining acceptance checks, see [Project status](docs/PROJECT_STATUS.md).

## Development

The project uses [bun](https://bun.sh) (`bun.lock`). `.env` contains the public Supabase project URL and publishable key. Server-only credentials such as `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, and `GOOGLE_CALENDAR_API_KEY` must be set in the runtime environment; do not commit them.

```sh
bun install
bun run dev
```

Without bun, once dependencies are installed you can start the dev server with `npx vite dev`.

Run `bun run build` before shipping. Apply the SQL migrations in `supabase/migrations` to the connected database before testing the latest booking flow. Git sync copies migration files into Lovable but does not execute them.
