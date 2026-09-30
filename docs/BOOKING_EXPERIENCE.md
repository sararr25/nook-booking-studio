# Booking experience proposal

The guided five-step booking flow remains the primary route. The conversation is a secondary, inline entry point for customers who want to describe a specific request or ask about booking terms. It fills the existing booking answers and hands the customer to the quote, artist, availability, and final review screens. It never creates a request on its own.

## Visual direction

1. **Questions in progress (implemented):** reveal each question as it enters view, as if the studio were asking it at that moment. Keep the reveal brief, announce the complete text to assistive technology, and show it immediately for reduced motion.
2. **Receipt as a working summary (proposed):** make the existing `BookingTicket` update visibly when a choice changes. Emphasize only the changed line and price for a moment, using the current paper, ink, and rust palette. The deposit status must always agree with the real booking state.
3. **Artist annotations (implemented):** explain each eligible artist using only their configured skills and the estimated sitting length. The closest match remains identified, while the customer can still choose another artist and inspect the existing portfolio link.

## Less template-like: next design changes

These are proposals, not implemented in this PR. They keep Nook's neutral booking UI separate from the Stillroom Tattoo studio site and retain the current warm paper, ink, rust, and type tokens. The generic pink palette and replacement fonts returned by the UI search do not match this project's established identity.

| Priority | Current screen | Change | Why |
| --- | --- | --- | --- |
| 1 | Studio flash gallery | When the new designs are ready, replace the three identical image cards with a curated wall of varied image sizes. Show every design on mobile instead of hiding the last item. Link each published design to its real flash booking record. | The work itself becomes the visual signature, and no available flash disappears on a small screen. |
| 2 | Booking service selection | Give the selected service an editorial detail area with its duration, starting price, and next question. Let the other services remain compact rows. | The current three equal cards read as a standard pricing template and take substantial vertical space. |
| 3 | Artist selection | Give the recommended artist more image space and keep alternatives in a quieter list, preserving a visible way to change the selection. Keep the new fit annotation and portfolio link for every artist. | The choice feels personal without pretending that a match is final or hiding alternatives. |
| 4 | Booking conversation | Move the secondary chat entry beside the service introduction or below the service choices on narrow screens; keep the panel inline when opened. | It currently occupies a full-width strip before the primary booking decision. |
| 5 | Studio homepage | Replace the speciality ticker with a small, sourced view of the studio's actual flash and artists once those assets are approved. Keep the hero booking action and owner sign-in positions. | Repeating generic service words adds little information; real work distinguishes the studio. |

Before implementing the larger layout changes, compare desktop and 375px mobile views, keyboard focus, reduced motion, text scaling, and the sticky booking action. Do not infer production quality from the local build.

## Conversation boundary

This version is a guided assistant based on the studio's configured services, questions, prices, and policies. It can answer supported booking questions and collect a free-text idea, but it is not a general AI chat. Unmatched answers ask the customer to choose a configured option. The assistant does not promise a live time, final price, confirmation, or payment. A broader natural-language assistant would need a server-side AI integration, usage controls, and a validation layer that maps generated data only to configured service and question IDs.

## Acceptance checks

- Complete a custom tattoo conversation and confirm the same answers appear in the booking quote and details.
- Ask about price, deposit, availability, and cancellation; check the replies against the current studio configuration.
- Complete a flash conversation and verify the customer still selects an available flash design before proceeding.
- Check keyboard navigation, screen-reader question text, reduced motion, and narrow mobile widths.
- Submit a controlled request only in the deployed preview, then verify the saved state, email, and calendar separately.
