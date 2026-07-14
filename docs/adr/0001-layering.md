# 0001 — Domain/storage/guard layering

## Status

Accepted (Phase 0).

## Context

FlashGate's correctness-critical logic — the FSRS scheduler wrapper, the toll engine (session composition, escalation, grants, the edge cases in §3.5 of the brief), and the import parsers — needs to be testable without a simulator or emulator, since the project has no physical device and native-module builds are slow to iterate on. The brief (§6.2) calls this out as "the load-bearing decision."

## Decision

Four layers, each only depending on the one below it:

1. **UI** (`app/`) — React Native / Expo Router. May import domain, storage, and guard.
2. **Domain** (`packages/domain`) — pure TypeScript, zero React Native imports. Scheduler, toll engine, import parsers.
3. **Storage** (`src/storage`) — SQLite repositories (`expo-sqlite`).
4. **Guard** (`src/guard`) — the `AppGuard` interface with three implementations (`MockGuard`, `AndroidGuard`, `IOSGuard`).

The domain layer is enforced as a separate **npm workspace package** (`@flashgate/domain`), not just a directory convention. It has its own `package.json`, its own `tsconfig.json` (no RN types, `"types": []`), and its own Vitest config, and is tested with `vitest run` directly against Node — no Jest/RN preset, no Metro, no simulator. This makes "zero React Native imports" a structural property (a stray `import { View } from 'react-native'` in `packages/domain` fails to resolve, since the domain package has no dependency on `react-native`) rather than something enforced only by code review or a lint rule.

Storage and guard stay as plain directories under `src/` rather than separate packages: they're still RN-adjacent (guard implementations wrap native modules; storage wraps `expo-sqlite`, an RN package) and don't need the same hard boundary — the value of a workspace package is specifically to make the domain layer's RN-independence unbreakable.

## Consequences

- Domain-layer tests run in milliseconds under plain Node, in CI and locally, with no emulator/simulator in the loop — this is deliberate, since it's the primary test target per the brief's Phase 3 note ("the toll engine has exhaustive unit tests — this is the highest-value test target in the repo").
- The app's own `tsconfig.json` explicitly excludes `packages/*`, so the two type-checking configs (RN-flavored vs. pure-TS) never collide; CI type-checks them as two separate steps.
- Any future contributor adding an RN import to the domain layer gets a hard build failure, not a review comment.
