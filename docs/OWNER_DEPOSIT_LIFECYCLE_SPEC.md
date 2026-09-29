# Owner sign-in and deposit-gated booking lifecycle

## Problem Statement

The owner cannot reliably reach the workspace through Google sign-in in the web preview. Customers are also told that a booking is confirmed before paying its required deposit. The demo deposit link does not make the booking transition to confirmed or reliably add it to the owner's calendar.

## Solution

Return Google OAuth to the owner sign-in route so successful authentication opens the owner workspace. Keep deposit bookings pending until the customer opens the demo payment link. Show a distinct awaiting-deposit state in the owner account and customer email. When the link is opened, mark the deposit paid, confirm the appointment, show an English success screen, and add the confirmed appointment to the owner's calendar. Zero-deposit appointments can confirm immediately; requests requiring owner review remain pending for review first.

## User Stories

1. As a studio owner, I want Google sign-in to return to the owner sign-in route, so that the preview opens my workspace after authentication.
2. As a studio owner, I want successful Google sign-in to land on the owner dashboard, so that I can immediately manage the studio.
3. As a studio owner, I want sign-in errors to remain visible, so that a failed OAuth attempt does not look successful.
4. As a customer, I want the booking flow to say my appointment is pending while a deposit is due, so that I am not told it is confirmed too early.
5. As a customer, I want a standard booking email to say the booking is pending until payment, so that the email matches the saved booking state.
6. As a customer, I want the email to show the deposit amount and deadline, so that I know what I owe and when.
7. As a customer, I want a clear Pay deposit link in the email, so that I can complete the demo payment step.
8. As a customer, I want the demo to work without card details, so that I can try the booking lifecycle without a real payment.
9. As a customer, I want the payment page to say “Payment complete!” and “Your appointment is confirmed.” after the demo action, so that I know it succeeded.
10. As a customer, I want invalid, review-pending, or declined links to show a clear failure state, so that the app does not falsely claim payment.
11. As a customer, I want a zero-deposit booking to confirm immediately, so that free appointments do not wait for a payment.
12. As a customer whose request needs review, I want it to remain pending until the studio acts, so that owner approval happens before payment.
13. As a studio owner, I want an approved booking with a deposit to move to awaiting-deposit, so that approval is not confused with payment.
14. As a studio owner, I want the bookings area to separate review requests, bookings awaiting deposit, and confirmed appointments, so that I can see who has the next action.
15. As a studio owner, I want a booking to become confirmed only after its deposit is recorded, so that its status reflects the customer's commitment.
16. As a studio owner, I want paid appointments to appear in the owner calendar and Google Calendar, so that my schedule reflects confirmed work.
17. As a studio owner, I want repeated opens of the same payment link to be safe, so that one booking does not create duplicate calendar events.
18. As a studio owner, I want unpaid deposit bookings to keep reserving their selected time, so that another customer cannot take it during payment.
19. As a studio owner, I want edits and cancellations of paid appointments to keep syncing to the calendar, so that later changes do not leave stale events.
20. As a project maintainer, I want existing confirmed bookings with an unpaid deposit to move to awaiting-deposit, so that saved data follows the corrected rule.

## Implementation Decisions

- Use the existing Google OAuth broker and return to the owner sign-in route; let the authenticated owner guard open the dashboard.
- Keep lifecycle states separate: pending for owner review, awaiting-deposit for approved bookings with an unpaid deposit, confirmed after payment, and declined for rejected or cancelled bookings.
- Allow zero-deposit bookings to confirm immediately.
- Include the Pay deposit link only while a positive deposit is outstanding. Keep payment copy demo-only and collect no card data.
- Make the deposit transition conditional and idempotent. Accept awaiting-deposit bookings and already-paid confirmed bookings; reject review-pending or declined bookings.
- Attempt Google Calendar creation only after confirmation and deposit payment. Use a stable booking identifier so retries do not create duplicate events.
- Add a database migration for the new booking state, existing unpaid confirmed bookings, and the booking insertion function's accepted states.
- Preserve the existing Nook layout, visual tokens, and editorial style while showing the awaiting-deposit status on owner booking surfaces.

## Testing Decisions

- Tests should assert behavior across customer, email, payment, owner, and calendar surfaces rather than component internals or helper names.
- Use one high-level lifecycle seam: submit a standard deposit booking, inspect its email and owner status, open the email link, then verify the success screen, confirmed owner status, and one calendar event.
- Cover the review-first and zero-deposit paths at the same flow boundary.
- Open the payment link more than once and confirm the booking remains confirmed with one calendar event.
- Use the preview sign-in flow to verify that Google OAuth returns to `/auth` and then opens `/owner`.
- The repository has no first-party automated booking-flow tests. A production build was run; email delivery, OAuth, database migration, and calendar behavior still need preview acceptance checks.

## Out of Scope

- Connecting a real payment processor or collecting card details.
- Changing qualification, pricing, availability, or cancellation policies beyond the deposit lifecycle.
- Publishing the public site.

## Further Notes

- Apply the database migration to the connected Lovable Cloud database before testing booking submissions against the new state.
- GitHub sync alone does not apply SQL migrations. Confirm the latest pushed revision is selected in Lovable's preview before reporting live behavior.
