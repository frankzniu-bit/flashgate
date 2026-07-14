# Contributing

## Setup

```bash
npm install
npm run ios     # or: npm run android
```

This is a development-build project (native modules are required), not Expo Go.

## Building without a paid Apple Developer account

`IOSGuard` requires the Family Controls entitlement, which needs a paid account and an Apple-approved distribution request (§6.6 of the brief). If you don't have one, you can still build and run everything else: `IOSGuard` compiles as a typed stub delegating to `MockGuard` behind a config flag, so the iOS Simulator build works end-to-end for every phase except real screen-time blocking.

## Where the tests live

- `packages/domain` — pure TypeScript (scheduler, toll engine, import parsers), tested with Vitest, zero React Native imports. This is the highest-value test target in the repo; write tests alongside the code, not after.
- App-level flows (gate session, MockGuard-driven E2E) use Maestro/Detox starting in Phase 3.

Run domain tests: `npm run test:domain`. Typecheck: `npm run typecheck` (app) and `npm run typecheck --workspace @flashgate/domain`. Lint: `npm run lint`.

## Scope

Section 9 of the brief is a hard non-goals list for v1 (accounts/sync, web/desktop, cloze/images/audio, AI-generated cards, browser blocking, streaks/XP/leaderboards, IAP, Anki two-way sync). If you're building one of these, it's probably out of scope — open an issue to discuss first.

## Code style

Match the UX direction in Section 7 of the brief: quiet, typographic, matter-of-fact. No gamification, no shame-framed copy, no red/urgent visual language.
