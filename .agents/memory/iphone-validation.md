---
name: Physical iPhone validation
description: Scope of the user's confirmed physical-iPhone Expo Go check.
---

On 2026-10-23, the user confirmed “It opens and the screens work” in Expo Go on their physical iPhone after the SDK 58 upgrade.

**Why:** This is actual device acceptance, which a browser screenshot or successful bundle cannot establish.

**How to apply:** Treat the SDK mismatch and initial screen-opening check as resolved. This confirmation does not establish live GPS guidance, voice prompts, rerouting, sector timing, or background reliability.

## Native guidance compatibility is not device validation

The published `@rnmapbox/navigation` alpha documentation checked on 2026-10-23 says its Expo plugin is tested with SDK 58, but explicitly lists live, non-simulated device guidance and release builds as untested.

**Why:** Passing the plugin's platform requirements is not evidence that real-road guidance is reliable. The published plugin includes React Native 0.88 Swift framework handling, but no native build of Sector with this bridge has been validated.

**How to apply:** Recheck the upstream [known limitations](https://rnmapbox.github.io/docs/navigation/overview#known-limitations) before proceeding. Establish a supported custom-native build path before installing the bridge; the current Expo Go preview cannot validate it.
