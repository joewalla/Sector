---
name: EAS build toolchain pinning
description: Prevent EAS remote builders from using defaults incompatible with the Expo SDK and workspace lockfile.
---

Pin the Node.js and pnpm versions in the EAS build profile and enable Corepack when needed. A GitHub Actions runner's toolchain setup does not necessarily carry over to the separate EAS remote build worker.

**Why:** A remote build used older default Node and pnpm versions despite the workflow's newer toolchain; pnpm rejected the workspace lockfile before native compilation.

**How to apply:** When an EAS monorepo build fails during dependency installation, compare the remote worker versions with the workspace lockfile and the Expo SDK's supported Node version. Pin the EAS build profile rather than weakening frozen-lockfile checks or package-age protections.
