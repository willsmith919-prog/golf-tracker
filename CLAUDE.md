# LiveLinks — Golf Scoring App

## What This Is

LiveLinks is a live leaderboard golf scoring web app. Players join events via codes, enter scores hole-by-hole on mobile, and see real-time leaderboard updates. It also supports league seasons and series (golf trips) with cumulative points/standings, plus side games (skins, stroke play, Vegas, 9's), stat games, and tap-to-award bonus points.

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
│   ├── leagues/     # League + Series dashboard, create/edit, join flow
│   ├── scoring/     # ScoringView, HoleCard, LiveLeaderboard, side-game leaderboards
│   └── shared/      # EventForm, StatGamesEditor, BonusPointsEditor, reusable UI
├── utils/
│   ├── codes.js         # Unified code generation/lookup
│   ├── groupLabels.js   # League vs Series wording (isSeriesGroup, getGroupLabels)
│   ├── leaguePoints.js  # Points calculation + standings writer
│   ├── leaderboard.js   # sortLeaderboard, assignPositions
│   ├── handicap.js      # Course handicap + stroke holes
│   ├── holes.js         # buildHoleOrder (wrap-around starts)
│   ├── scoring.js       # Stableford + team score calculation
│   ├── skins.js         # Skins side game
│   ├── calculateVegasResults.js # Vegas side game
│   ├── ninesScoring.js  # 9's side game (3-player, 5/3/1 per hole)
│   ├── statGames.js     # Most Birdies / Fewest Bogeys style bonus points
│   ├── bonusPoints.js   # Tap-to-award bonuses (chip-ins, sandies)
│   ├── wolfScoring.js   # Wolf format
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
- **All point sources combine in one place:** `runLeaguePointsCalc()` in `EventLobbyView.jsx` adds main game + skins + stroke play + 9's + stat games + bonuses, and writes a per-player `breakdowns/{eventId}` object. A new point source must be added there, in `LeagueStandingsPanel.jsx` (live projection), and in the breakdown display in `LeagueDashboardView.jsx`.
- **A Series IS a League.** Stored at `leagues/{id}` with `meta.type: 'series'` and a single auto-created season. All league code (standings, End Event, dashboard) is reused; only wording changes via `utils/groupLabels.js`. Series events carry `meta.leagueType: 'series'`. Joining a series event via `EV-` code also auto-joins the series (leagues do NOT do this).
- **Bonuses belong to individual players**, even in team formats: `events/{id}/players/{uid}/bonuses/{hole}/{bonusId}`. Written directly on tap in ScoringView.
- **Stat games and 9's are individual-format only** (they need per-player scores). Stat game Most/Fewest winners must have finished every hole.

## Firebase Structure (Key Paths)

```
users/{userId}/profile/          → displayName, email, handicap, scoreEntryMode ('quick' | 'confirm')
users/{userId}/leagueMemberships/ → leagueId → { role, joinedAt }   (series included)
users/{userId}/events/           → eventId → { role, joinedAt }
leagues/{leagueId}/meta/         → name, code, commissionerId, type ('league' | 'series')
leagues/{leagueId}/seasons/{seasonId}/defaultPointsConfig/ → positions, participationPoints, statGames[], bonusPoints[]
leagues/{leagueId}/seasons/{seasonId}/standings/ → userId → { points, events, breakdowns }
events/{eventId}/meta/           → all event config (course, format, leagueType, sideGames, etc.)
events/{eventId}/meta/leaguePoints/ → positions, participationPoints, statGames[], bonusPoints[] (snapshot)
events/{eventId}/meta/sideGames[i]/groups → 9's threesomes [[uid, uid, uid], ...]
events/{eventId}/players/{userId}/ → displayName, role, handicap, scores, holes, stats, bonuses/{hole}/{bonusId}
events/{eventId}/teams/{teamId}/  → name, members, scores, holes, stats, scoringLockedBy
codes/{code}/                    → type, targetId, status, createdAt
```

## Key Utilities

- `utils/codes.js` — `generateCode(type)`, `createCode(type, targetId, expiresAt)`, `lookupCode(code)`
- `utils/leaguePoints.js` — `calculateEventPoints()` (pure), `writeStandingsToFirebase()` (reads/subtracts/adds)
- `utils/scoring.js` — `calculateStablefordPoints(score, par)`, `calculateTeamStats(team, coursePars, format)`
- `utils/ninesScoring.js` — `scoreNinesHole()`, `calculateNines()`, `calculateNinesSeriesPoints()` (modes: `raw` default, `position`, `none`)
- `utils/statGames.js` — `calculateStatGames(currentEvent, statGames)`, `statGameLabel()`
- `utils/bonusPoints.js` — `calculateBonusPoints(currentEvent, bonusDefs)`, `BONUS_PRESETS`

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
- Trip-long stat games (stat games are currently scored per round only)
- Game concept (spontaneous single-foursome, AI-first creation)
- Conversational format builder (AI layer)
- Round history / event history linking
- Mobile app (Capacitor planned)
