# Match the supplied Nook design

## What will change
- Rebuild the booking screens to follow the supplied reference: compact Nook header, step progress bars, oversized sans-serif questions, visual answer tiles, an always-visible booking summary, calendar with adjacent time choices, and the final photo-upload layout.
- Rebuild the owner area as a true desktop workspace with a fixed left navigation, “Good morning” overview, three operational columns, compact appointment rows, and matching mobile navigation.
- Restyle login and all owner editing views within the same off-white, black, fine-border design language while preserving existing authentication, uploads, pricing, team, availability, flash, and booking behavior.
- Keep the uploaded image as visual reference only; it will not appear inside the app.

## Verification
- Check the booking flow, photo upload, owner login redirect, and owner navigation in the browser.
- Review desktop and mobile screenshots against the reference, then run the project’s automated checks and design audit.

## Technical notes
- Reuse the existing React routes, booking engine, authentication, storage, and UI controls.
- Concentrate changes in the customer booking route, owner route, login route, shared header, and global design tokens.
