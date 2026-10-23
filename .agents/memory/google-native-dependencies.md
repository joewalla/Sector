---
name: Google native dependency checks
description: Source of truth when assessing the Google React Native navigation bridge.
---

Use the published Google navigation package's podspec to establish its actual iOS SDK version and dependency mechanism.

**Why:** The inspected wrapper used an exact Swift Package Manager dependency through React Native's `spm_dependency` helper. General README compatibility statements and older release summaries did not establish the current native dependency version. Meeting the React Native peer range alone cannot prove an iOS build will compile.

**How to apply:** Before choosing or upgrading this bridge, inspect its published podspec, confirm the consumer React Native installation provides the required helper, and validate a signed native build. Do not infer compatibility with Expo Go or invent CocoaPods version overrides from older setup instructions.
