# Sector

Sector is a native navigation and journey-performance app that records real trips and distance-based sector splits.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/sector run dev` — run the Expo mobile app
- `pnpm --filter @workspace/sector run typecheck` — typecheck the mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript
- Mobile: Expo SDK 57, React Native, Expo Router
- Local mobile persistence: AsyncStorage for the first-stage search history
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/sector/app/` — mobile screens and navigation
- `artifacts/sector/constants/colors.ts` — Sector visual tokens
- `artifacts/sector/recent-searches.ts` — on-device recent search storage
- `artifacts/api-server/` — shared Express API (not needed by the Stage 1 mobile app)

## Architecture decisions

- Keep native navigation isolated behind an adapter so the provider can change if its React Native bridge is not reliable.
- Keep elapsed-time and route-distance sector calculations separate from screen components; use a monotonic clock for journey timing.
- Keep early mobile persistence local. Accounts, sync, social features, and a backend are out of scope for the first version.
- Stage 1 must not present fabricated routes, GPS positions, ETAs, journey timings, or completed trips as real data.

## Product

- Stage 1 provides branded home, destination-entry, inactive navigation, results, history, personal-best, and location-privacy screens.
- Stage 1 saves only destination text the user explicitly saves; it does not geocode, route, request location, or create trips.

## User preferences

- Build in stages and explain technical decisions plainly.
- Do not encourage speeding or competitive driving on public roads.
- Do not claim a capability is complete until it is implemented and appropriately tested.
- Prioritize road safety, transparent location use, and a small reliable product.

## Gotchas

- The current Expo scaffold is SDK 57. The `@rnmapbox/navigation` bridge is still alpha, and its docs report the Expo config plugin tested only with SDK 58; re-check compatibility before installing native navigation dependencies.
- A real navigation build will require a development build and physical iPhone validation; Expo Go alone is not sufficient for custom native navigation modules.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
