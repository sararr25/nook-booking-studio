# Add a demo payment link to booking emails

## Scope
- Add a styled “Pay deposit” call-to-action to confirmed and changed booking emails.
- Label the destination as a payment demo so customers are not misled.
- Pass a booking-specific demo URL from the existing email sender.
- Keep received and declined emails unchanged.

## Verification
- Confirm the email template renders with the deposit amount and demo link.
- Check the project build status after the change.

## Technical details
- Extend the booking email template data with an optional payment URL.
- Use the existing React Email button component and current brand styling.
- Link to a lightweight public demo payment page keyed by booking ID; it will not collect money.
