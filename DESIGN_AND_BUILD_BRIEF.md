# FlashGate — Design Philosophy & Build Brief

*Working title: **FlashGate** (alternatives: Tollcard, Regate, Earn It). Rename before publishing.*

This document is the complete handoff for building FlashGate. It is written to be pasted (or committed to the repo root) as the first input to Claude Sonnet, which will act as the implementing engineer. Section 12 contains the verbatim kickoff prompt; everything before it is the specification that prompt refers to.

**Fixed decisions** (made by the project owner, do not relitigate): cross-platform React Native with Expo; open source on GitHub; local-first with no accounts or backend; spaced repetition via FSRS. **Development constraint:** the owner currently has no physical test device — iOS Simulator and Android Emulator only. This constraint drives the entire build order (Section 10).

---

## 1. Vision

FlashGate is a screen-time limiter where re-entry costs knowledge. You set a daily limit on a distracting app. When the limit runs out and you try to go back anyway, you don't get a wall — you get a toll booth: review a short set of flashcards, correctly, and you earn a timed window back in. The cards are scheduled by a real spaced-repetition algorithm, so every unlock is a genuine study session, not busywork.

The core insight: spaced repetition works best when reviews are distributed across the day, and the impulse to open TikTok is *also* distributed across the day. FlashGate pairs the two. The moments you most want to waste become the moments you study. The blocker feeds the learning system; the learning system justifies the blocker.

Two audiences, one app:

- **The self-limiter** who wants their doomscroll impulse redirected into something useful (a student cramming SAT vocab, a med student on Anki-style decks, a language learner).
- **The open-source community**, who get a trustworthy, auditable, no-telemetry alternative to paid blockers like Opal and one sec.

## 2. Design principles

These are the tiebreakers. When an implementation choice is ambiguous, resolve it against this list, in order.

1. **The gate is a toll, not a wall.** Every gate is completable in bounded time (default: five cards, roughly two minutes). The user is never locked out indefinitely by the app's own logic. Punitive design creates uninstalls, not habits.
2. **Reviews must be real learning.** Cards are chosen by the FSRS scheduler, answers are checked as objectively as the card format allows, and every gate review updates the card's schedule. If a gate session ever feels like a CAPTCHA, we've failed.
3. **Never shame.** No red screens, no "you failed", no guilt streaks, no stats framed as judgment. Copy is neutral and matter-of-fact: "5 cards between you and 10 more minutes."
4. **Local-first, private by default.** No accounts, no analytics, no network calls except user-initiated imports. All data in a local SQLite database the user can export. This is non-negotiable for an open-source trust story.
5. **Cheating is permitted but inconvenient.** The OS ultimately lets a determined user bypass any third-party blocker (revoke permissions, uninstall). We don't fight that war; we make the honest path lazier than the dishonest one. Be truthful in the README about what the app can and cannot enforce.
6. **The flashcard app must stand alone.** Study mode (reviewing due cards without any blocking involved) should be good enough that someone would use FlashGate as a plain SRS app. The gate is a feature of the flashcard app, not vice versa.
7. **Sane defaults, deep settings.** A new user makes exactly three choices: which app to limit, how much time per day, which deck pays the toll. Everything else (toll size, escalation, grant length) has defaults and lives in settings.

## 3. The core loop, specified

### 3.1 Setup

1. User creates or imports a deck (Section 5).
2. User picks one or more apps to guard, sets a daily time limit per app (or per group), and attaches a deck (or "all decks") as the toll source.
3. App requests the platform permissions it needs (Section 6) with a plain-language explanation screen *before* each OS prompt.

### 3.2 Under the limit

Nothing happens. No nags, no countdown overlays. Optionally (settings, off by default) a notification at 80% of the limit.

### 3.3 Limit reached → the gate

When the guarded app's usage crosses the limit and the user opens (or is in) that app:

1. The platform blocking layer shields the app (full-screen takeover on Android; Screen Time shield on iOS — mechanics in Section 6).
2. The shield offers one primary action: **"Review to unlock"** (plus a quiet "Not now" that just closes the guarded app).
3. Tapping it lands in the **Gate Session**: a fixed-length review session, default 5 cards, drawn by the scheduler (Section 4.3).
4. Completing the session grants a **re-entry window**, default 10 minutes, for that app. The shield lifts; a silent timer runs; when the window expires the shield returns and the loop repeats.

### 3.4 Toll economics

- Default toll: **5 cards correct = 10 minutes**. Both configurable per guarded app.
- **Escalation (on by default, removable in settings):** each subsequent unlock of the same app in the same day increases the toll by 2 cards (5, 7, 9, …, capped at 15). Re-entry keeps getting more expensive, gently. Resets at the daily rollover time (default 4:00 AM local, configurable — not midnight, because midnight punishes night owls mid-session).
- A card only counts toward the toll when answered **correctly** under the gate's objective check (Section 4.4). Incorrect cards don't count and are re-queued into the same session, so a gate session is "5 correct", not "5 attempts" — but it always terminates because the re-queued card comes back until answered.

### 3.5 Edge cases (implement all of these; they're where the design lives)

- **No cards due:** pull from (in order) learning cards, then new cards (respecting the deck's daily new-card cap), then the lowest-stability review cards ahead of schedule. The gate never says "no cards available, come on in."
- **Deck has fewer cards than the toll:** toll shrinks to deck size, with a gentle prompt afterward to add cards.
- **Deck deleted / empty while attached to a guard:** the guard falls back to "all decks"; if there are no cards anywhere, the guard pauses itself and notifies the user plainly ("FlashGate has no cards to show, so App X is unguarded until you add some").
- **User quits mid-gate:** no penalty, no partial credit; progress within the session is discarded (but each *completed card's* FSRS update is kept — learning happened, it just didn't pay the toll).
- **Clock tampering:** store timestamps in UTC and compute windows from elapsed monotonic time where the platform allows; if a backwards clock jump larger than the grant window is detected, expire all grants. Don't over-engineer beyond that (Principle 5).
- **Two guarded apps blocked at once:** each has its own grant; a gate session pays for exactly the app the user came from.

## 4. Spaced repetition

### 4.1 Algorithm: FSRS

Use **FSRS** (Free Spaced Repetition Scheduler) via the maintained open-source **`ts-fsrs`** npm package — do not hand-roll SM-2. FSRS is what modern Anki uses, it's MIT-licensed, pure TypeScript, and it models each card as (difficulty, stability, retrievability) with a target retention (default 0.9, exposed in advanced settings). Verify the package's current API at build time rather than trusting this document.

### 4.2 Card model and states

Standard FSRS states: **New → Learning → Review ⇄ Relearning**. Ratings are the standard four: **Again / Hard / Good / Easy**. Every review — gate or free-study — writes a `review_log` row and updates the card's FSRS state. One scheduler, two entry points.

### 4.3 Card selection for a gate session

In priority order, take cards until the toll size is reached:

1. Due Learning/Relearning cards (intraday steps) — oldest due first.
2. Due Review cards — ordered by retrievability ascending (most-forgotten first).
3. New cards, if the deck's daily new-card cap (default 10) isn't exhausted.
4. Ahead-of-schedule Review cards, lowest stability first.

Free-study sessions use the same ordering without the fixed length (review until the due queue is empty).

### 4.4 Grading: the anti-gaming design

Self-graded flashcards (flip, then tap Good) are trivially cheatable when the reward is screen time. So gate sessions and free-study sessions grade differently:

- **Free study:** classic flip-and-self-rate with all four FSRS ratings. The user has no incentive to lie to themselves here.
- **Gate sessions:** each card is presented as an **objective check**:
  - **Multiple choice (default):** the correct answer plus 3 distractors sampled from other cards' answers in the same deck (fall back to all decks if the deck is small; minimum 4 cards in the pool or fall back to typed input).
  - **Typed answer:** for short answers (≤ ~40 chars), settings can require typing; match case-insensitively with trimmed whitespace and a small Levenshtein tolerance (1 edit per 8 characters).
  - A minimum display time of 2 seconds per card before answers are tappable, to blunt reflex-tapping.
- Mapping objective results to FSRS ratings in gate mode: correct on first try → **Good**; correct after one miss (re-queued) → **Again** at the miss, then **Hard** on the successful retry. Never award **Easy** from a gate session — Easy is reserved for deliberate self-rating in free study.

## 5. Getting cards in

All parsing is local and offline. Priority order:

1. **Manual editor:** create/edit decks and cards in-app. Front/back text, v1. (Cloze and images are explicit non-goals for v1 — Section 11.)
2. **CSV/TSV import:** the universal fallback. Let the user pick delimiter (auto-detect first), map columns to front/back, preview before committing.
3. **Quizlet:** Quizlet shut its public API years ago, so integration means the **export flow**: the user opens their own set on quizlet.com → Export → copies the text (custom delimiters: between term/definition and between rows) → pastes into FlashGate, which parses it. Build the paste-parser to accept Quizlet's default "tab / newline" and custom delimiter combos. Do **not** scrape Quizlet pages server-side or in-app — it's a ToS problem an open-source project doesn't need.
4. **Knowt:** Knowt supports exporting sets (CSV/Quizlet-compatible text at time of writing — verify the current export format when building) which flows through the same paste/CSV parser. Ship a short in-app "How to export from Knowt/Quizlet" help sheet with screenshots.
5. **Anki `.apkg`** (phase 2+, nice-to-have): a zip containing a SQLite DB; strip HTML to text, skip media, warn about what was dropped.

The paste-parser is a pure TypeScript function → fully unit-testable with fixture files. Write those fixtures from real Quizlet/Knowt exports.

## 6. Architecture

### 6.1 Stack

- **Expo (latest SDK), TypeScript strict, React Native.** Native modules are required, so this is a **development-build project** (`expo prebuild` / EAS dev builds), *not* Expo Go. Structure everything so the pure-JS surface still runs with the blocking layer mocked (see 6.4) — that's the daily dev loop given the simulator-only constraint.
- **Storage:** `expo-sqlite` with a thin typed data layer (Drizzle ORM is acceptable if it earns its keep; no heavier sync-oriented DBs — there's nothing to sync).
- **State:** keep it boring — Zustand or React context over the data layer. No Redux.
- **Navigation:** Expo Router.

### 6.2 Layering (the load-bearing decision)

```
┌──────────────────────────────────────────────┐
│ UI (React Native / Expo Router)              │
├──────────────────────────────────────────────┤
│ Domain (pure TypeScript, zero RN imports)    │
│  • scheduler (wraps ts-fsrs)                 │
│  • toll engine (session composition, escala- │
│    tion, grants, edge cases of §3.5)         │
│  • import parsers (CSV/Quizlet/Knowt)        │
├──────────────────────────────────────────────┤
│ Storage (SQLite repositories)                │
├──────────────────────────────────────────────┤
│ AppGuard (TS interface, 3 implementations)   │
│  • MockGuard   — dev & simulator             │
│  • AndroidGuard — usage stats + overlay      │
│  • IOSGuard     — Screen Time API            │
└──────────────────────────────────────────────┘
```

The **domain layer must have zero React Native imports** so it runs under plain Vitest/Jest on Node. The toll engine and scheduler are where correctness matters most, and they must be testable without any device.

### 6.3 The `AppGuard` interface

One TypeScript interface, three implementations:

```ts
interface AppGuard {
  requestPermissions(): Promise<PermissionState>;
  listInstalledApps(): Promise<GuardableApp[]>;      // platform-dependent granularity
  setGuards(guards: GuardConfig[]): Promise<void>;   // apps + daily limits
  grantWindow(appId: string, minutes: number): Promise<void>;
  revokeAllGrants(): Promise<void>;
  onGateRequested(cb: (appId: string) => void): Unsubscribe; // user hit the shield
  getTodayUsage(appId: string): Promise<Minutes>;
}
```

### 6.4 MockGuard (build this first)

An in-app fake: a debug screen listing pretend apps ("MockTok", "Instagrief") with buttons to simulate "limit reached, user opened app". It drives the full gate flow — shield screen, gate session, grant, expiry — entirely inside the RN app. This is what makes the whole product buildable and demo-able on a simulator, and it doubles as the E2E test harness (Maestro or Detox flows run against MockGuard).

### 6.5 AndroidGuard

- **Permissions:** `PACKAGE_USAGE_STATS` (special access, user grants in system settings) for usage tracking and foreground-app detection via `UsageEvents`; `SYSTEM_ALERT_WINDOW` **or** (preferred) a full-screen trampoline Activity launched when a guarded app comes to foreground past its limit; `POST_NOTIFICATIONS` for the foreground service notification.
- **Mechanism:** a foreground service polls `UsageEvents` (~1s cadence while screen is on, event-driven where possible); when a guarded app is foregrounded over-limit, launch the FlashGate blocking Activity over it. Grants are honored by the same service.
- **Do NOT use AccessibilityService** for detection — Play Store policy treats it as high-risk and it will complicate publishing an app whose accessibility use is not accessibility.
- **Testability: this works in the Android Emulator**, including granting usage access and overlay permission. This is why AndroidGuard ships before IOSGuard.
- Write it in Kotlin as an Expo Modules API native module inside the repo (no separate package until it stabilizes).

### 6.6 IOSGuard (last, and honest about the constraints)

- **Mechanism:** the Screen Time API triad — `FamilyControls` (authorization + `FamilyActivityPicker` for choosing apps), `DeviceActivity` (usage thresholds), `ManagedSettings` (applying the shield). A `ShieldConfiguration` extension customizes the block screen.
- **Known iOS limitations to design around, not against:**
  - App selection returns **opaque tokens** — FlashGate cannot see which apps were picked. UI copy must not pretend otherwise.
  - The shield's action button **cannot deep-link into FlashGate.** The established workaround (used by one sec and peers): the shield button posts a Darwin notification / shared-container flag and instructs the user to open FlashGate, which reads the flag and lands directly in the gate session. Slightly clunky; acceptable; document it.
  - Requires the **Family Controls entitlement**: development flavor needs a paid Apple Developer account; distribution flavor requires a request to Apple (routinely granted for legitimate screen-time apps, but takes time — file the request early). Contributors without a paid account build with `IOSGuard` stubbed to `MockGuard`; the build must support this via an env/config flag.
  - **None of it works in the iOS Simulator.** All iOS blocking work is deferred until a physical device is available (Section 10, Phase 5).

### 6.7 Data model (SQLite, sketch)

- `decks(id, name, created_at, new_cards_per_day, source)`
- `cards(id, deck_id, front, back, fsrs_state, difficulty, stability, due_at, last_review_at, suspended)`
- `review_logs(id, card_id, rating, mode /*gate|study*/, elapsed_ms, reviewed_at, fsrs_snapshot)`
- `guards(id, app_ref, platform, daily_limit_min, deck_id /*nullable = all*/, toll_cards, grant_minutes, escalation_on)`
- `grants(id, guard_id, granted_at, expires_at)`
- `unlocks_today(guard_id, date, count)` (or derive from grants)
- `settings(key, value)`

## 7. UX and visual direction

**One sentence to hold every screen against:** *a quiet library toll booth — calm, typographic, matter-of-fact — never a casino and never a drill sergeant.*

- **Typography carries the design.** One display face for card fronts and big numbers, one body face; a real type scale; hierarchy from size and weight, not boxes and shadows. Card text is the hero — large, centered, generous line-height.
- **One accent color** (used for the primary action and earned-time moments), working neutrals for everything else. Whitespace over dividers. Dark mode designed separately (desaturated accent, no pure black), not inverted.
- **The gate screen is the product.** It must load in under a second straight into the first card — every extra tap between impulse and first card is where users rage-quit. Show quiet progress ("2 of 5") and the stake ("earns 10 minutes") in small text. No timers ticking at the user, no red.
- **Feedback:** correct answers get a subtle 150–250 ms ease-out acknowledgment, not confetti. Wrong answers show the correct answer plainly and move on — the card returns later in the session; that's the consequence, no scolding needed.
- **States are designed, not defaulted:** empty deck, first-run, permission-explainer, expired-grant, and paused-guard screens all get real copy and layout. Tabular numbers in any stats view.
- **Microcopy register:** "5 cards between you and 10 more minutes." / "Time's up. Want back in?" / "That's 10 minutes — the shield returns after." Never "You've been scrolling too long 😔."
- **Banned:** purple-blue gradients, glassmorphism, emoji-as-icons, streak-guilt, gamified XP/levels, mascots.

## 8. Open source posture

- **License: MIT.** Maximum contributor and fork friendliness; a local-only app has nothing that needs copyleft protection. (Owner may override; flag before first release.)
- **Privacy stance in the README, verifiable by reading the code:** no analytics, no crash reporting by default, no network calls except user-initiated imports. This is a headline feature.
- **Repo hygiene from day one:** MIT `LICENSE`, `README` (what it is, honest limitations, screenshots), `CONTRIBUTING.md` (including "building without an Apple developer account" via the MockGuard flag), `.gitignore` covering `.env*`, `node_modules/`, native build output, and any signing material; GitHub Actions CI running typecheck + lint + domain-layer unit tests on every PR. No secrets ever committed; signing/EAS credentials stay out of the repo.
- **Trademark care:** don't use Quizlet/Knowt logos; refer to them nominatively in import instructions only.

## 9. Non-goals for v1

Accounts and sync; web or desktop versions; cloze deletions, images, audio on cards; AI-generated cards; website/browser blocking; "strict mode" uninstall protection; social features, leaderboards, streak mechanics; in-app purchases (it's free and open source); Anki two-way sync. Any of these appearing in a plan or PR is scope creep — list them as future suggestions instead of implementing.

## 10. Build phases

Each phase ends with its acceptance criteria demonstrably met (tests passing and/or a simulator screen recording) before the next begins. Given the no-device constraint, Phases 0–4 must be fully verifiable in simulator/emulator; Phase 5 is explicitly deferred.

**Phase 0 — Skeleton.** Expo TS-strict project, Expo Router, SQLite layer, CI (typecheck, lint, unit tests), MockGuard stub, layering of §6.2 in place with an ADR note.
*Accept:* CI green; app boots in both simulators to an empty-state home screen; domain package has a passing placeholder test run under Node.

**Phase 1 — A real flashcard app.** Deck/card CRUD, manual editor, `ts-fsrs` integration, free-study mode with flip-and-rate, due counts on the home screen.
*Accept:* unit tests cover scheduler wrapper (state transitions for all four ratings, due-date math with fake clocks); a deck can be created, studied, and re-studied with sensible intervals in the simulator.

**Phase 2 — Imports.** CSV/TSV with delimiter detection + column mapping + preview; Quizlet/Knowt paste-parser with fixture-based tests; help sheets.
*Accept:* fixture suite (≥ 10 real-world-shaped exports, including malformed ones) passes; a pasted Quizlet export becomes a studyable deck end-to-end in the simulator.

**Phase 3 — The gate, against MockGuard.** Toll engine in the domain layer (session composition §4.3, objective grading §4.4, escalation and rollover §3.4, all edge cases §3.5), gate session UI, grant lifecycle, the full loop driven from the MockGuard debug screen.
*Accept:* toll engine has exhaustive unit tests (this is the highest-value test target in the repo — include the clock-jump and empty-deck cases); a Maestro/Detox flow runs blocked → gate → 5 correct → grant → expiry → re-block on MockGuard; screen recording of that flow.

**Phase 4 — AndroidGuard.** Kotlin Expo module per §6.5; permission-explainer screens; foreground service; trampoline blocking activity wired to the same gate session.
*Accept:* in the Android Emulator with a real third-party app (e.g. a news app) guarded at a 1-minute limit: the block appears on foregrounding past the limit, the gate unlocks it for the grant window, and the shield returns on expiry — screen recording required. Service survives app-swipe (documented restart behavior).

**Phase 5 — IOSGuard (deferred).** Blocked on: a physical iPhone, a paid Apple Developer account, and the Family Controls entitlement (file the distribution request as soon as the account exists). Until then: `IOSGuard` compiles as a typed stub delegating to MockGuard behind a config flag; §6.6's design is the spec when work begins.
*Accept (eventually):* same demo as Phase 4 on a physical iPhone, including the shield→Darwin-notification→open-app handoff.

## 11. Risks and honest caveats

- **iOS is the long pole:** entitlement approval timing and shield-deep-link clunkiness are Apple-imposed and not solvable in code. Set expectations in the README.
- **Android OEM battery managers** (Samsung, Xiaomi) kill foreground services; ship known-workaround docs (battery-optimization exemption prompt) and treat missed blocks as a known failure mode, not a bug to "fix" with hacks.
- **Quizlet/Knowt export formats can change** without notice; the paste-parser's fixture suite is the early-warning system, and CSV is the permanent fallback.
- **Play Store review** will question the overlay/usage-stats permissions; prepare the permissions-declaration copy early and keep AccessibilityService out of the app entirely.

## 12. Kickoff prompt for Sonnet (paste verbatim, with this file in the repo)

> You are the implementing engineer for FlashGate, an open-source React Native (Expo) app specified completely in `DESIGN_AND_BUILD_BRIEF.md` at the repo root. Read that document fully before writing any code. It is the source of truth; where it is silent, resolve ambiguity using its Section 2 design principles, and if an ambiguity is genuinely load-bearing, stop and ask rather than guessing.
>
> Rules of engagement:
> 1. Work strictly in the phase order of Section 10. Do not start a phase until the previous phase's acceptance criteria are demonstrably met — show the passing test output or simulator recording, don't assert it.
> 2. The domain layer (scheduler, toll engine, import parsers) is pure TypeScript with zero React Native imports, and it is your primary test target. Write its tests alongside the code, not after.
> 3. All development targets the iOS Simulator and Android Emulator only — there is no physical device. The MockGuard (§6.4) is the default guard implementation for daily development; never make it a second-class citizen.
> 4. Section 9 is a hard non-goals list. If you notice an attractive feature outside scope, list it as a suggestion in your summary instead of building it.
> 5. Keep the repo publishable at all times: MIT license, honest README, no secrets, CI green on every commit.
> 6. Match the UX direction in Section 7 exactly — when in doubt, quieter and more typographic, never gamified.
>
> Begin with Phase 0. Before writing code, post a short plan for the phase: the file tree you intend to create, the completion criteria restated in your own words, and any decision you had to make that the brief left open.

## 13. Decisions still open for the project owner

1. **Name** — FlashGate is a placeholder; check trademark/App Store collisions before release.
2. **License** — MIT recommended in §8; confirm.
3. **Toll defaults** — 5 cards / 10 minutes / escalation-on are educated guesses; revisit after self-testing.
4. **iOS timeline** — decide when to acquire a device + developer account; the entitlement request should be filed the same week.
