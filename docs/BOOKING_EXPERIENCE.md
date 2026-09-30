# Booking experience proposal

The guided five-step booking flow remains the primary route. The conversation is a secondary, inline entry point for customers who want to describe a specific request or ask about booking terms. It fills the existing booking answers and hands the customer to the quote, artist, availability, and final review screens. It never creates a request on its own.

## Visual direction

1. **Questions in progress (implemented):** reveal each question as it enters view, as if the studio were asking it at that moment. Keep the reveal brief, announce the complete text to assistive technology, and show it immediately for reduced motion.
2. **Receipt as a working summary (proposed):** make the existing `BookingTicket` update visibly when a choice changes. Emphasize only the changed line and price for a moment, using the current paper, ink, and rust palette. The deposit status must always agree with the real booking state.
3. **Artist annotations (proposed):** add a short, specific reason beside each recommended artist, using the existing portrait and portfolio. Avoid decorative badges or a new visual language.

## Conversation boundary

This version is a guided assistant based on the studio's configured services, questions, prices, and policies. It can answer supported booking questions and collect a free-text idea, but it is not a general AI chat. Unmatched answers ask the customer to choose a configured option. The assistant does not promise a live time, final price, confirmation, or payment. A broader natural-language assistant would need a server-side AI integration, usage controls, and a validation layer that maps generated data only to configured service and question IDs.

## Acceptance checks

- Complete a custom tattoo conversation and confirm the same answers appear in the booking quote and details.
- Ask about price, deposit, availability, and cancellation; check the replies against the current studio configuration.
- Complete a flash conversation and verify the customer still selects an available flash design before proceeding.
- Check keyboard navigation, screen-reader question text, reduced motion, and narrow mobile widths.
- Submit a controlled request only in the deployed preview, then verify the saved state, email, and calendar separately.
