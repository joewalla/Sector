---
name: Expo workspace dependency alignment
description: Avoid stale React peer links after an Expo upgrade in this pnpm workspace.
---

After changing the mobile app's React version, run `pnpm install` at the workspace root before diagnosing duplicate React reports.

**Why:** A filtered app install updated the lockfile's shared React Query peer binding but left the shared API client's installed link pointing at the previous React version. A root install corrected the links without overrides or restructuring the library.

**How to apply:** If Expo Doctor reports duplicate React through a shared workspace library, compare the installed dependency links with the lockfile. Complete the root install before introducing injected dependencies, forced version overrides, or peer-dependency changes.
