# Repair deployed Google OAuth callback

## Goal
Make the actual `id-preview` callback consume the Google OAuth result, persist the owner session through Lovable's preview storage, clean the address, and enter `/owner` without weakening the owner-role gate.

## Changes
- Replace the hand-built token/session script with a dedicated `/auth/callback` route that uses the generated auth client and its brokered preview storage.
- Send Google sign-in to the explicit same-origin callback URL instead of `/`.
- Keep a compatibility fallback for existing callbacks that return to `/`, forwarding the fragment immediately to `/auth/callback` without reading or logging token values.
- Wait for `setSession` and a verified persisted session before navigating to `/owner`; surface failures at `/auth`.
- Remove competing callback handlers so one path owns session persistence.
- Preserve booking fallback and demo deposit behavior unchanged.

## Validation
- Confirm callback code exists in the built root/route assets and compare deployed asset references with the current build.
- Exercise callback cleanup and persistence in the built preview runtime without exposing credentials.
- If a real owner session can be safely minted, verify `/owner` and refresh; otherwise report that real Google OAuth remains unconfirmed.
- Report the exact resulting revision/build and any provider configuration still required.

## Technical notes
- The owner route will continue calling `getUser()` and checking the `owner` role server-side through the existing protected route.
- Session writes will go through the generated auth client, ensuring `brokeredPreviewStorage` mirrors preview sessions correctly instead of manually constructing local storage data.
