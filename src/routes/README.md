# Routes

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory
defines a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or
`app/layout.tsx` — those are Next.js / Remix conventions. The only root layout
is `src/routes/__root.tsx`.

## Conventions

| File | URL |
| --- | --- |
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `users/index.tsx` | `/users` |
| `users/$id.tsx` | `/users/:id` (dynamic — bare `$`, no curly braces) |
| `posts/{-$category}.tsx` | `/posts/:category?` (optional segment) |
| `files/$.tsx` | `/files/*` (splat — read via `_splat` param, never `*`) |
| `_layout.tsx` | layout route (renders children via `<Outlet />`) |
| `__root.tsx` | app shell — wraps every page; preserve `<Outlet />` |

`routeTree.gen.ts` is auto-generated. Don't edit it by hand.

## Nook routes

| File | URL | Purpose |
| --- | --- | --- |
| `index.tsx` | `/` | Stillroom Tattoo website |
| `book.tsx` | `/book` | Customer booking flow |
| `auth.tsx` | `/auth` | Sign-in and owner account creation |
| `_authenticated/owner.tsx` | `/owner` | Owner portal; sections use `?tab=<section>` |
| `payment-demo.$bookingId.tsx` | `/payment-demo/:bookingId` | Demo deposit action; no card collection |

`_authenticated/route.tsx` protects the owner route. Keep any new owner sections under that layout.
