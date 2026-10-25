---
name: EAS build toolchain pinning
description: Prevent EAS remote builders from using defaults incompatible with the Expo SDK and workspace lockfile.
---

Pin Node.js and pnpm in the EAS build profile, and keep the workspace root's `packageManager` field aligned. Avoid enabling Corepack when EAS is already installing its own pnpm version; Corepack can create a shim that conflicts with EAS's global pnpm install.

**Why:** A remote build used older default Node and pnpm versions despite the workflow's newer toolchain; pnpm rejected the workspace lockfile. Enabling Corepack for the next attempt then caused an `EEXIST` collision and a stale Corepack signature-key error.

**How to apply:** When an EAS monorepo build fails during dependency installation, compare the remote worker versions with the workspace lockfile and the Expo SDK's supported Node version. Pin the EAS profile and root package-manager declaration rather than weakening frozen-lockfile checks or package-age protections.
