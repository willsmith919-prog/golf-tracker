# LiveLinks — Golf Scoring App

## What This Is

LiveLinks is a live leaderboard golf scoring web app. Players join events via codes, enter scores hole-by-hole on mobile, and see real-time leaderboard updates. It also supports league seasons with cumulative points/standings.

**Product philosophy ("The Workday Principle"):** Enterprise-grade configurability underneath, effortless on the surface. Casual golfers never wrestle with complexity — power users (commissioners) get full control.

## Tech Stack

- **Frontend:** React (JSX) + Vite + Tailwind CSS
- **Database:** Firebase Realtime Database (`livelinks-cf018-default-rtdb`)
- **Auth:** Firebase Auth — email/password only
- **Hosting:** Vercel (auto-deploys from GitHub `main` branch)
- **Admin email:** `willsmith919@gmail.com` (checked in `isAdmin()` in App.jsx)

## Commands

```bash
npm run dev        # Start local dev server (Vite, usually localhost:5173)
npm run build      # Production build
git push           # Triggers Vercel auto-deploy from main
```

## Project Structure

```
src/
├── components/
│   ├── admin/       # Global admin (courses, formats)
│   ├── auth/        # Login, signup, auth guards
│   ├── backups/     # Backup-related
│   ├── events/      # Event creation, lobby, team management
│   ├── home/        # Home screen
│   ├── leagues/     # League dashboard, join flow
│   ├── scoring/     # ScoringView, LiveLeaderboard
│   └── shared/      # EventForm, ExpiredCodeView, reusable UI
├── utils/
│   ├── codes.js         # Unified code generation/lookup
│   ├── leaguePoints.js  # Points calculation + standings writer
│   ├── scoring.js       # Stableford + team score calculation
│   └── helpers.js       # getDeviceId() only
├── App.jsx
├── firebase.js
└── main.jsx
```

## Firebase Data Patterns — CRITICAL

These have caused bugs before. Double-check any new code touching these areas:

- **User profile path is NESTED:** `users/{userId}/profile/displayName`, NOT `users/{userId}/displayName`. Always access via `userProfile.profile.displayName` and `userProfile.profile.handicap`.
- **Never write null/undefined to Firebase:** `set()` rejects objects containing null or undefined values. Strip null keys with `delete obj[key]` before writing. Especially relevant on par 3 holes (fairway is null) and non-stat-tracking rounds.
- **Firebase listener loops:** `useEffect` + `onValue` listener + `set()` calls can cause rapid update loops. Use one read-only listener per component, and only write manually on user actions — never inside a listener callback.
- **Scoring lock is manual:** `scoringLockedBy` is a direct Firebase write (set on "Enter Scores", cleared on "Back to Lobby"). It is NOT a listener-based effect.
- **Receipt model for event data:** Course, format, and points config are snapshotted onto events at creation time. Events are self-contained records, not live references.
- **Standings are stored, not computed on the fly.** Written when "End Event" is clicked. Re-ending recalculates correctly (subtracts previous, adds new).

## Firebase Structure (Key Paths)

```
users/{userId}/profile/          → displayName, email, handicap
users/{userId}/leagueMemberships/ → leagueId → { role, joinedAt }
users/{userId}/events/           → eventId → { role, joinedAt }
leagues/{leagueId}/meta/         → name, code, commissionerId
leagues/{leagueId}/seasons/{seasonId}/standings/ → userId → { points, events }
events/{eventId}/meta/           → all event config (course, format, leaguePoints, etc.)
events/{eventId}/players/{userId}/ → displayName, role, handicap
events/{eventId}/teams/{teamId}/  → name, members, scores, holes, stats, scoringLockedBy
codes/{code}/                    → type, targetId, status, createdAt
```

## Key Utilities

- `utils/codes.js` — `generateCode(type)`, `createCode(type, targetId, expiresAt)`, `lookupCode(code)`
- `utils/leaguePoints.js` — `calculateEventPoints()` (pure), `writeStandingsToFirebase()` (reads/subtracts/adds)
- `utils/scoring.js` — `calculateStablefordPoints(score, par)`, `calculateTeamStats(team, coursePars, format)`

## Code Conventions

- Code prefixes identify type: `LG-` (league), `SR-` (series), `EV-` (event), `GM-` (game)
- Team scoring activates when `meta.teamSize > 1`; individual when `teamSize === 1`
- Mobile number inputs use `type="text"` with `inputMode="numeric"` (no spinner arrows)
- Guest players use `guest-{timestamp}` IDs and are excluded from league standings

## Developer Context

The developer does NOT have a CS background:
- Use plain language. Briefly explain new terms when introduced.
- Be specific: name the exact file, show where in the file the change goes.
- Prefer complete file replacements over diffs or partial edits when changes are substantial.
- One feature at a time — build, test in live environment, then move on.

## Known Large Components (Refactor Backlog)

These files have grown large and are flagged for splitting into sub-components:
- `EventLobbyView.jsx`
- `ScoringView.jsx`
- `LiveLeaderboard.jsx`
- `EventForm.jsx`

## Dev vs Production

Some bugs only appear in the Vite dev server (HMR/stale state). Always verify on the live Vercel deployment before assuming a code issue. Fix for dev server weirdness: restart with `npm run dev`.

## What's Not Built Yet

- Guest participant system (growth mechanic — non-users added by name)
- Series concept (multi-event trip/tournament)
- Game concept (spontaneous single-foursome, AI-first creation)
- Conversational format builder (AI layer)
- Round history / event history linking
- Mobile app (Capacitor planned)
