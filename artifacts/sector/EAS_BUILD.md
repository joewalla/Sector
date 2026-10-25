# Sector cloud development builds

This setup is deliberately manual. It does not connect accounts, create signing
credentials, enable billing, or start a build. Sector includes
`@rnmapbox/navigation` 0.1.0-alpha.1 and `@rnmapbox/maps` 10.3.11, configured
for Mapbox Navigation SDK 3.23.1 / Maps SDK 11.23.1.

The navigation package is early alpha. A successful iOS simulator build checks
native compilation only; it does not verify live GPS guidance on a real phone.

## Before running the GitHub workflow

1. Use the GitHub repository containing Sector and enable GitHub Actions.
2. Create or link an Expo project for Sector. Make sure `expo.slug` matches the
   Expo project slug, and set its project ID in `app.json` as
   `expo.extra.eas.projectId`.
3. Choose unique `expo.ios.bundleIdentifier` and `expo.android.package` values.
4. Add an Expo access token named `EXPO_TOKEN` under the repository's
   **Settings → Secrets and variables → Actions**. Never commit the token or
   send it in chat.
5. In **Actions → Sector cloud development build → Run workflow**, select a
   target. Builds are manual; pushes and pull requests do not trigger builds.
6. Verify the EAS project, app identifiers, and account token before starting a
   build. The iOS simulator target does not need Apple device-signing
   credentials or a paid Apple Developer Program membership.
7. Pass the Expo SDK dependency check. If it reports a newer SDK 58 patch,
   update only after the version has passed the workspace's 24-hour minimum
   release-age rule. Do not weaken that rule or add an exception. The GitHub
   workflow checks dependency alignment before it queues a build.

EAS commands and configuration live in this app directory, as required for the
Expo app in this pnpm monorepo. The workspace root declares pnpm 10.26.1 and
the EAS profile pins the same package-manager version for remote builds. The
simulator profile uses a documented Xcode 27.0 image to satisfy the native
React Native toolchain requirement. The GitHub runner installs dependencies
from the workspace root before submitting a cloud build.

## Targets

- **iOS simulator** creates an iOS simulator development build. It can verify
  that the native project compiles, but it cannot be installed on the iPhone
  or validate real GPS guidance. Upstream also lists live, non-simulated
  guidance and release builds as untested.
- **iOS device** creates a development build for a physical iPhone. Apple
  Developer signing credentials and a paid Apple Developer Program membership
  are required before this target can run.
- **Android** creates an installable development APK. It requires an EAS
  project and Expo token; it does not require Google Cloud billing for the
  current Mapbox route setup.

Expo currently lists 15 free iOS and 15 free Android builds per month. Check
[current pricing](https://expo.dev/pricing) before running builds. Mapbox
Navigation usage is billed per trip or MAU in addition to Maps usage. EAS
receives the project source to perform each cloud build. Do not start a build
until the user has linked the required accounts, added `EXPO_TOKEN` in GitHub,
and explicitly approved the selected target.

See the [Expo development build guide](https://docs.expo.dev/develop/development-builds/introduction/),
[EAS build configuration](https://docs.expo.dev/eas/json/), and
[EAS monorepo guide](https://docs.expo.dev/build-reference/build-with-monorepos/).
Mapbox's [Navigation installation guide](https://rnmapbox.github.io/docs/navigation/install)
documents the Expo plugins and SDK version pairing used here; its
[known limitations](https://rnmapbox.github.io/docs/navigation/overview#known-limitations)
include untested live device guidance.
