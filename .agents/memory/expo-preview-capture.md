---
name: Cold Expo browser capture
description: A first screenshot after restarting Expo can precede initial screen rendering.
---

A white first browser screenshot after an Expo workflow restart is not, by itself, evidence of a screen regression.

**Why:** On multiple otherwise successful Sector builds, the first cold capture showed white with no error in the browser log, while the next warmed capture rendered the screen correctly without any code change.

**How to apply:** Corroborate a cold blank capture with workflow/browser errors and one warmed capture before changing dependencies or layouts. A repeatedly blank or erroring page still requires investigation.
