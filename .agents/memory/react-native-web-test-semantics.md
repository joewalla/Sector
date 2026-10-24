---
name: React Native Web test semantics
description: Runtime accessibility quirks observed when testing Sector's web build.
---

Use observed browser accessibility output rather than assuming native accessibility props map directly to HTML attributes.

**Why:** In browser regression checks, decorative Feather glyphs appeared in implicit button names, breaking exact text-name selectors. React Native Web did not expose `accessibilityState.selected` as `aria-selected` on a button.

**How to apply:** Prefer explicit accessibility labels or test IDs where available. For implicit icon-bearing names, match the meaningful text without requiring the entire name. Confirm selection through its visible functional consequence rather than an attribute the browser does not expose. Keep these accommodations in tests; do not change product behavior to satisfy an assumed DOM mapping.
