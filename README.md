# FlashGate

*Working title — see [`DESIGN_AND_BUILD_BRIEF.md`](./DESIGN_AND_BUILD_BRIEF.md) for the full spec, and Section 13 for decisions still open.*

FlashGate is a screen-time limiter where re-entry costs knowledge. Set a daily time limit on a distracting app; once it's spent, getting back in costs a short, real spaced-repetition review (FSRS) instead of a wall or a nag. Study mode also stands alone as a plain flashcard app.

## Status

Phase 0 (skeleton) — see Section 10 of the brief for the full build order. Nothing here blocks or unblocks a real app yet; there's an empty-state home screen, a domain layer with a placeholder test, and CI.

## Privacy

No accounts, no analytics, no crash reporting, no network calls except imports you explicitly paste or pick a file for. All data lives in a local SQLite database you can export. This is enforced by the app having nothing to call home to — read [`src/`](./src) and [`packages/domain`](./packages/domain) to verify it yourself.

## What FlashGate can't enforce

A determined user can always revoke permissions or uninstall a third-party blocker — FlashGate doesn't fight that, and doesn't pretend otherwise. See Section 2, principle 5 of the brief, and Section 11 for the Android/iOS-specific caveats (foreground-service kills on some OEMs, iOS Screen Time API's opaque app tokens and non-deep-linkable shield).

## Architecture

```
UI (React Native / Expo Router)
Domain (pure TypeScript, zero RN imports) — packages/domain
Storage (SQLite repositories) — src/storage
AppGuard (MockGuard / AndroidGuard / IOSGuard) — src/guard
```

The domain layer — scheduler, toll engine, import parsers — has zero React Native imports and runs under plain Vitest on Node. See [`docs/adr/0001-layering.md`](./docs/adr/0001-layering.md).

## Development

All development targets the iOS Simulator and Android Emulator — there is no physical test device yet, which is why `MockGuard` (an in-app fake blocker) is the default guard for daily development rather than a stub. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for building without a paid Apple Developer account.

```bash
npm install
npm run ios       # or: npm run android
npm run typecheck
npm run lint
npm run test:domain
```

## License

MIT — see [`LICENSE`](./LICENSE).
