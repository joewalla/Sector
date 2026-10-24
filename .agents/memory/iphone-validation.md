---
name: Physical iPhone validation
description: Scope of the user's confirmed physical-iPhone Expo Go check.
---

On 2026-10-23, the user confirmed “It opens and the screens work” in Expo Go on their physical iPhone after the SDK 58 upgrade.

**Why:** This is actual device acceptance, which a browser screenshot or successful bundle cannot establish.

**How to apply:** Treat the SDK mismatch and initial screen-opening check as resolved. This confirmation does not establish live GPS guidance, voice prompts, rerouting, sector timing, or background reliability.

The user later confirmed in Expo Go on a physical iPhone that the practice-time slider reaches both endpoints, reverses direction during a drag, works within the scrolling search screen, and supports VoiceOver adjustments. Seeks pause playback and mark the run inspection-only; practice settings remain locked while running or paused and unlock when the run ends. The iOS edge-swipe back gesture was disabled on the search screen after it intercepted slider drags, and the user confirmed the slider then worked.

**Why:** These are device-only gesture, accessibility, and navigation results; browser regressions cannot establish them.

**How to apply:** Treat those specific iPhone checks as confirmed, but do not infer Android behavior or live-navigation reliability.

On 2026-10-24, the user confirmed that tapping Search's visible Back button on their iPhone returns to the screen that opened Search.

**Why:** This validates the native navigation action that replaces the disabled edge-swipe gesture.

**How to apply:** Treat the Search Back-button path as confirmed on iPhone; do not infer the same behavior on Android.

## Native guidance compatibility is not device validation

The published `@rnmapbox/navigation` alpha documentation checked on 2026-10-23 says its Expo plugin is tested with SDK 58, but explicitly lists live, non-simulated device guidance and release builds as untested.

**Why:** Passing the plugin's platform requirements is not evidence that real-road guidance is reliable. The published plugin includes React Native 0.88 Swift framework handling, but no native build of Sector with this bridge has been validated.

**How to apply:** Recheck the upstream [known limitations](https://rnmapbox.github.io/docs/navigation/overview#known-limitations) before proceeding. Replit currently does not support EAS builds or custom native binaries, so establish an external native-build path before installing the bridge. Expo Go and the browser preview cannot validate real navigation.

## Cloud build path

The user chose a manual GitHub Actions workflow that submits builds to EAS because no local macOS or Android workstation is available. GitHub and Expo are not connected, and account setup, billing, Apple membership, and builds have not been approved.

**Why:** Cloud builds avoid requiring a local native toolchain, but device signing and provider accounts can introduce costs or irreversible account changes.

**How to apply:** Keep builds manual. Do not connect accounts, create signing credentials, enable billing, or trigger a build without the user's explicit approval. An iOS simulator build can validate compilation without Apple device signing; it does not validate physical-device guidance.
