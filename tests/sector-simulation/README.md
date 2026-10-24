# Sector browser regression checks

Run against a running Expo **web** preview:

```sh
SECTOR_BROWSER_BASE_URL=https://your-expo-preview-host pnpm test:sector:browser
```

In this workspace `REPLIT_EXPO_DEV_DOMAIN` supplies the default host. This does
not start or replace any managed workflow. Chromium must be available to
Playwright. The workspace's preinstalled Chromium is detected automatically.
For another preinstalled binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to
its executable path; elsewhere, the normal Playwright-managed browser is used.

The tests intercept the route-preview and place-search endpoints with explicitly synthetic
fixtures. They drive the real React UI, timers and navigation state, but do not
validate Mapbox availability, real road geometry, real GPS, native navigation,
or iPhone behaviour. Unexpected GPS access fails the recovery tests; the selected-route
retry test supplies a fixed synthetic location instead of accessing GPS. Playback uses Playwright's
controlled clock; hidden/focus lifecycle events are dispatched explicitly so
headless tab visibility does not decide the outcome.

Coverage:
- Saved practice settings: explicit opt-in, whitelisted automatic updates and
  browser-reload restoration, forget/reset comparison clearing (including unchanged
  defaults), running/paused locks, a held asynchronous initial read blocking
  playback, corrupt/unsupported/invalid saved data, read/write/removal failures,
  unsaved fallback defaults, preserved older bytes, and explicit retries.
  Run only these checks with `pnpm test:sector:browser --grep 'saved practice settings'`.
  The key-scoped browser storage harness lives only in the tests. Its delayed-read
  thenable is assimilated by AsyncStorage's real web Promise; it does not block
  the JS thread, inject production hooks, or wait for arbitrary timeouts.
- Responsive layouts at 320px and 375px phone widths and a 1440px desktop:
  five-sector/three-stop radio controls, full long current/upcoming instructions,
  keyboard Tab focus indicators and activation, pause/resume/restart/end actions,
  and completed/partial comparisons with horizontal-overflow checks at each state.
  Run only this focused suite with `pnpm test:sector:browser responsive.spec.ts`.
- Accelerated completion and matching replay at another speed.
- Pause/resume, restart, completed/partial/not-reached splits.
- Retention of a completed baseline after a partial run.
- Auto-pause on document-hidden and browser-window blur events.
- Clearing comparisons on a new route response or sector configuration.
- Synthetic stop countdown, locked settings, and honest partial-delay summary.
- Three-stop list limits, add/remove/sector edits clearing completed comparisons, cumulative same-sector delays, frozen controls and countdowns, rate-independent replay, and per-stop partial/unreached summary.
- No extra route request on replay or configuration change.
- Arbitrary forward/backward inspection, exact sector-boundary jumps, keyboard scrubbing and pause-on-seek.
- Inspection-only runs never create a baseline; previous full replays and synthetic-stop timing stay intact.
- Route recovery: service/provider/network failures, loading/error reset, retry success,
  malformed/empty/degenerate geometry and unusable distance, late demo success/failure
  after search/selection or clear, newer-before-older demo completion, failed place
  search resubmission, and selected-route failure/retry with a synthetic position.
- API failures preserve exact device-stored search strings saved through the UI;
  failed or unusable responses never expose playback controls or a completed run.
- Incomplete successful route responses (missing/null/empty steps, steps without
  movement, blank instructions, missing metrics, malformed
  instruction entries, wrong envelope types, HTML, invalid JSON and empty bodies)
  are rejected before metrics, maps or instructions render. Both demo and selected
  destination flows replace an existing preview with a recoverable error, preserve
  destination text and saved-search bytes, then recover on a valid retry with the
  fixture's actual metrics, instructions and playable timeline. Selected routes
  use only a fixed synthetic position, never real GPS.

Run just the failure/recovery flows:

```sh
pnpm test:sector:browser --grep 'route failure recovery'
```

Reports, traces and screenshots are written beneath the ignored
`generated-artifacts/sector-browser/` directory. Test fixtures are never
imported by the app. There are no production test hooks or timer bypasses.
