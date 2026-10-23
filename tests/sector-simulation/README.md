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

The tests intercept only the route-preview endpoint with explicitly synthetic
fixtures. They drive the real React UI, timers and navigation state, but do not
validate Mapbox availability, real road geometry, real GPS, native navigation,
or iPhone behaviour. GPS access fails the test. Playback uses Playwright's
controlled clock; hidden/focus lifecycle events are dispatched explicitly so
headless tab visibility does not decide the outcome.

Coverage:
- Accelerated completion and matching replay at another speed.
- Pause/resume, restart, completed/partial/not-reached splits.
- Retention of a completed baseline after a partial run.
- Auto-pause on document-hidden and browser-window blur events.
- Clearing comparisons on a new route response or sector configuration.
- Synthetic stop countdown, locked settings, and honest partial-delay summary.
- No extra route request on replay or configuration change.
- Arbitrary forward/backward inspection, exact sector-boundary jumps, keyboard scrubbing and pause-on-seek.
- Inspection-only runs never create a baseline; previous full replays and synthetic-stop timing stay intact.

Reports, traces and screenshots are written beneath the ignored
`generated-artifacts/sector-browser/` directory. Test fixtures are never
imported by the app. There are no production test hooks or timer bypasses.
