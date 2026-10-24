# Sector cloud development builds

This setup is deliberately manual. It does not connect accounts, create signing
credentials, enable billing, or start a build. The actual Mapbox Navigation
native SDK is not installed by this setup.

## Before running the GitHub workflow

1. Push the repository to a private GitHub repository and enable GitHub Actions.
2. Create or link an Expo project for Sector. Set its project ID in
   `app.json` as `expo.extra.eas.projectId`.
3. Choose unique `expo.ios.bundleIdentifier` and `expo.android.package` values.
4. Add an Expo access token named `EXPO_TOKEN` under the repository's
   **Settings → Secrets and variables → Actions**. Never commit the token or
   send it in chat.
5. In **Actions → Sector cloud development build → Run workflow**, select a
   target. Builds are manual; pushes and pull requests do not trigger builds.
6. Verify the EAS project, app identifiers, account token, and required signing
   credentials are ready before starting a build.
7. Pass the Expo SDK dependency check. It currently reports newer SDK 58 patch
   versions; the workspace's 24-hour minimum release-age rule blocked those
   releases during this setup. The GitHub workflow checks this before it queues
   a build, so no cloud build is submitted until the dependencies are aligned.

EAS commands and configuration live in this app directory, as required for the
Expo app in this pnpm monorepo. The GitHub runner installs dependencies from
the workspace root before submitting a cloud build.

## Targets

- **iOS simulator** creates an iOS simulator development build. It can verify
  that the native project compiles, but it cannot be installed on the iPhone
  or validate real GPS guidance.
- **iOS device** creates a development build for a physical iPhone. Apple
  Developer signing credentials and a paid Apple Developer Program membership
  are required before this target can run.
- **Android** creates an installable development APK. It requires an EAS
  project and Expo token; it does not require Google Cloud billing for the
  current Mapbox route setup.

Expo currently lists 15 free iOS and 15 free Android builds per month. Check
[current pricing](https://expo.dev/pricing) before running builds. Mapbox
usage is billed separately from build minutes. EAS receives the project source
to perform each cloud build.

See the [Expo development build guide](https://docs.expo.dev/develop/development-builds/introduction/),
[EAS build configuration](https://docs.expo.dev/eas/json/), and
[EAS monorepo guide](https://docs.expo.dev/build-reference/build-with-monorepos/).
