---
name: Native map test fixtures
description: Scope rules for exercising Sector's native route map with synthetic geometry.
---

Native route-map recovery checks must use explicitly labeled synthetic fixtures, never live GPS, and must not present fixture geometry as a real route.

**Why:** The user explicitly set this boundary for native-map validation; fixture data must not be mistaken for journey or location data.

**How to apply:** Keep device-test screens and route labels visibly synthetic, and do not request location or call real routing services to induce malformed geometry.
