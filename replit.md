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
- Mobile: Expo SDK 58, React Native, Expo Router
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
- `artifacts/api-server/` — shared Express API for Mapbox destination search and route previews

## Architecture decisions

- Keep native navigation isolated behind an adapter so the provider can change if its React Native bridge is not reliable.
- Keep elapsed-time and route-distance sector calculations separate from screen components; use a monotonic clock for journey timing.
- Keep early mobile persistence local. Accounts, sync, social features, and a backend are out of scope for the first version.
- Stage 1 must not present fabricated routes, GPS positions, ETAs, journey timings, or completed trips as real data.

## Product

- Stage 1 provides branded home, destination-entry, inactive navigation, results, history, personal-best, and location-privacy screens.
- Destination search and route previews use Mapbox through the API; previewing from the user's position requests foreground location once. The fixed London demo requires no location.
- Route simulation offers two to five equal-distance practice sectors and exact estimated split times. Sector configuration is locked during playback (including pauses); changes clear comparisons. Replay comparisons are in-memory only for the same route response and sector configuration, never real journey records or personal bests.
- Up to three optional synthetic stationary stops (10, 30, 60, or 120 simulated seconds each) can be placed in selected practice sectors. Multiple stops in one sector are evenly spaced strictly inside it; a lone stop is halfway through. All holds derive from the unchanged Mapbox timeline. Original time and each consumed addition are shown separately, including partial/unreached stops. Playback pause freezes countdowns; the entire scenario is locked while running/paused, and changing any stop or the sector count clears comparisons. Practice results remain in memory only, separate from real history and personal bests.

## User preferences

- Build in stages and explain technical decisions plainly.
- Do not encourage speeding or competitive driving on public roads.
- Do not claim a capability is complete until it is implemented and appropriately tested.
- Prioritize road safety, transparent location use, and a small reliable product.

## Gotchas

- Browser regression checks run with `pnpm test:sector:browser` against the running Expo web preview. They use explicit synthetic route fixtures and controlled lifecycle events, not live Mapbox or iPhone data. See `tests/sector-simulation/README.md`; generated reports stay in ignored `generated-artifacts/`.

- The app targets Expo SDK 58. The `@rnmapbox/navigation` bridge is still alpha; the SDK upgrade alone does not establish native navigation compatibility. Re-check the bridge before adding it.
- A real navigation build will require a development build and physical iPhone validation; Expo Go alone is not sufficient for custom native navigation modules.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
