---
name: React Native Web test semantics
description: Runtime accessibility quirks observed when testing Sector's web build.
---

Use observed browser accessibility output rather than assuming native accessibility props map directly to HTML attributes.

**Why:** In browser regression checks, decorative Feather glyphs appeared in implicit button names, breaking exact text-name selectors. React Native Web did not expose `accessibilityState.selected` as `aria-selected` on a button.

**How to apply:** Prefer explicit accessibility labels or test IDs where available. For implicit icon-bearing names, match the meaningful text without requiring the entire name. Confirm selection through its visible functional consequence rather than an attribute the browser does not expose. Keep these accommodations in tests; do not change product behavior to satisfy an assumed DOM mapping.

For custom radio controls on React Native Web, set `aria-checked` explicitly; `accessibilityState.selected` is not a substitute for the radio's checked state. Use roving `tabIndex` and arrow-key selection only on web, leaving native Pressable behavior unchanged.

**Why:** A radio must expose its checked state to assistive technology, and the default focusability of every Pressable does not provide standard radio-group keyboard behavior.

**How to apply:** Verify the rendered `aria-checked` and `tabIndex` attributes in browser tests, and test arrow navigation without relying on React Native props that map to a different ARIA attribute.

For cross-platform custom radios, expose checked state in both places: explicit `aria-checked` for React Native Web and `accessibilityState.checked` for native VoiceOver/TalkBack semantics. Include `accessibilityState.disabled` when choices lock.

**Why:** React Native Web's tested ARIA behavior does not establish what native assistive technologies receive; their state comes from React Native accessibility props.

**How to apply:** Assert web role, name, checked, and disabled semantics in browser tests, and keep native checked/disabled props on every custom radio. Device screen-reader speech still needs device validation.

When styling locked radios on the web, include `[aria-disabled="true"]` selectors; React Native Web may expose their disabled state through ARIA rather than a native `:disabled` attribute.

**Why:** The forced-colors browser check confirmed that `:disabled` alone did not match the locked radio controls.

**How to apply:** For web-only disabled styles, support both native `:disabled` and `[aria-disabled="true"]` where custom React Native controls are involved.
