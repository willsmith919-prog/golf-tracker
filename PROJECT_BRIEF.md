# LiveLinks — Project Brief
> Paste this at the start of any new AI chat session to restore full project context.

---

## 1. App Overview

**LiveLinks** is a golf scoring web app. Its primary purpose is providing a **live leaderboard** for golf events. A key secondary feature allows organizers to run a **league**, which tracks participants across multiple events and assigns points based on finishing position.

---

## 2. Product Philosophy

This is the most important section for understanding how to build LiveLinks correctly.

**The Workday Principle:** LiveLinks is built like an enterprise-grade configurable platform underneath, but feels effortless on the surface. The complexity exists for power users (league commissioners, series organizers) but casual golfers never have to wrestle with it.

**The AI Bridge:** An AI layer sits between the complex engine and the casual user. The conversational format builder is an early example of this. The Game creation flow is the most important use case — "4 guys, $5 nassau, Davis Park, Blue tees, go" should be all the input needed.

**The Growth Engine:** Guest participants (non-users added by name) lower the barrier to entry. Someone joins as a guest, has a great live scoring experience, and creates an account themselves. Organic adoption through great UX.

**One Engine, Multiple Entry Points:** League, Series, Event, Game, and Solo Round all use the same underlying scoring and leaderboard logic. What differs is the creation flow, exposed config options, and what happens to results afterward.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (JSX), Vite (`npm run dev`) |
| Database | Firebase Realtime Database |
| Auth | Firebase Auth — Email/Password only |
| Hosting | Vercel |
| Version Control | GitHub (pushed via terminal in VSCode) |

---

## 4. Folder Structure

```
PROJECT_BRIEF.md     ← this file, lives at project root
src/
├── assets/
│   └── react.svg
├── components/
│   ├── admin/       # Global admin tools (courses, formats)
│   ├── auth/        # Login, signup, auth guards
│   ├── backups/     # Backup-related components
│   ├── events/      # Event creation and management
│   │   ├── JoinEventConfirm.jsx  # Unified code join flow for events
│   │   └── TeamManager.jsx       # Host assigns players into teams (team formats only)
│   ├── home/        # Landing/home screen
│   ├── leagues/     # League management
│   │   └── JoinLeagueConfirm.jsx # Unified code join flow for leagues
│   ├── scoring/     # Live scoring and leaderboard
│   └── shared/      # Reusable UI components
│       ├── EventForm.jsx         # Shared form for Create/Edit Event (includes league points config)
│       └── ExpiredCodeView.jsx   # Expired code screen (league + event)
├── utils/
│   ├── codes.js         # Unified code generation and lookup (ACTIVE)
│   ├── leaguePoints.js  # League points calculation + standings writer (ACTIVE)
│   ├── scoring.js       # Stableford + team score calculation (ACTIVE)
│   └── helpers.js       # getDeviceId() only — used in App.jsx (ACTIVE, trimmed)
├── App.css          # Note: padding on #root was removed (was Vite boilerplate causing mobile layout issues)
├── App.jsx
├── firebase.js      # Firebase init and config
├── index.css
└── main.jsx
```

---

## 5. Taxonomy

Everything shares the same core scoring engine. What differs is the creation flow, config options, and what happens to results.

| Type | Description | Multi-Foursome | Points | Seasons | AI-First |
|---|---|---|---|---|---|
| **League** | Season-long, persistent membership. Think: Country Club. Members get updates on events/series within it. History tracked across seasons. | Yes | Yes | Yes | No |
| **Series** | Trip or tournament-based. Think: Golf Trip. Defined end, group disbands when over. Can live inside a League or be standalone. | Yes | Yes | No | No |
| **Event** | One day, one course, multiple foursomes. Can be standalone, inside a League season, or inside a Series. | Yes | Optional | No | No |
| **Game** | One day, one course, one foursome or less. Spontaneous — set up at the first tee. Same engine as Event, lighter creation flow. Exclusive formats available. | No | Optional | No | **Yes** |
| **Solo Round** | One day, one course, one golfer. | No | No | No | No |

### Hierarchy
```
League
  └── Season
        └── Events (standalone)
        └── Series
              └── Events

Series (standalone)
  └── Events

Event (standalone or nested)

Game (standalone only)

Solo Round
```

---

## 6. Participant Model

All activity types support two participant types:

| Type | Description |
|---|---|
| **Registered User** | Has a LiveLinks account. Linked by `userId`. Scores and history tracked across sessions. |
| **Guest** | Added by name only — no account required. Designed to lower barrier to entry and drive organic signups. |

Guest participants are a deliberate growth mechanic — a great live scoring experience as a guest should make people want to create an account.

---

## 7. Codes System

✅ **FULLY BUILT** — March 2026

A single unified code system handles joining everything. One "Enter a Code" input on the home screen routes the user to the right place automatically — no need to navigate to Join League, Join Series, Join Event, or Join Game separately.

### Code Format
Prefix identifies the type, suffix is randomly generated. Four characters each.

| Type | Prefix | Example |
|---|---|---|
| League | `LG` | `LG-4X9K` |
| Series | `SR` | `SR-7MQP` |
| Event | `EV` | `EV-2BNF` |
| Game | `GM` | `GM-5RTJ` |

### Code Lifecycle

| Type | Expires? |
|---|---|
| League | Never (unless commissioner regenerates it) |
| Series | When series is completed or cancelled |
| Event | When event is completed or cancelled |
| Game | When game is completed or cancelled |

**Expired code behavior:** Rather than showing a dead-end error, the app shows what the thing *was* (name, date, location) and offers a read-only view of the final leaderboard. For events, a "Create Similar Event" button pre-fills the creation form with the same course, tee, and format. For leagues, an explanation is shown with a "Create New League" button.

**League code regeneration:** A commissioner can invalidate their current League code and generate a new one at any time (e.g. if a code was shared somewhere it shouldn't have been). The old code immediately stops working. The league and its members are unaffected.

### Key Files
- `src/utils/codes.js` — `generateCode()`, `createCode()`, `lookupCode()`
- `src/components/leagues/JoinLeagueConfirm.jsx` — league join confirmation screen
- `src/components/events/JoinEventConfirm.jsx` — event join confirmation screen
- `src/components/shared/ExpiredCodeView.jsx` — expired code screen for leagues and events

### Firebase Structure
```
codes/
  {code}/                  e.g. "LG-4X9K"
    type/                  (league | series | event | game)
    targetId/              (the leagueId, seriesId, eventId, or gameId)
    status/                (active | expired)
    createdAt/
    expiresAt/             (null for leagues)
```

---

## 8. Firebase Realtime Database — Full Structure

> **Note:** Firebase data was wiped March 2026. All data follows the new structure going forward.

```
users/
  {userId}/
    profile/            (name, email, handicap, avatarUrl, createdAt)
    leagueMemberships/  (leagueId → { role: commissioner | member, joinedAt })
    events/             (eventId → { role: host | player, joinedAt })

leagues/
  {leagueId}/
    meta/               (name, description, commissionerId, code, createdAt)
    members/            (userId → { displayName, role, handicap, joinedAt })
    seasons/
      {seasonId}/
        name/
        status/         (active | completed)
        defaultPointsConfig/  (default leaguePoints config for new events)
        events/         (array of eventIds)
        standings/      (userId → { points: totalPoints, events: { eventId: pointsEarned } })

series/
  {seriesId}/
    meta/               (name, description, createdBy, createdAt, startDate, endDate)
    leagueId/           (null if standalone)
    seasonId/           (null if standalone)
    pointsConfig/       (own config + flowToLeague: true/false + percentage)
    eventRefs/          (eventId → true)
    standings/          (participantId → totalPoints)

events/
  {eventId}/
    meta/               (name, date, status, createdBy, courseId, courseName,
                         coursePars, courseYardages, courseStrokeIndexes,
                         teeId, teeName, format, formatId, formatName,
                         scoringMethod, teamSize, handicap, stablefordPoints,
                         competition, display, numHoles, startingHole,
                         endingHole, leagueId, seasonId, eventCode, createdAt,
                         leaguePoints)
    players/
      {userId}/         (displayName, joinedAt, role: host | player, handicap)
    teams/              # Only used for team formats (teamSize > 1)
      {teamId}/
        name/           ("Team 1", or custom name like "Team Tiger")
        members/        (userId → true)
        scores/         ({ 1: 4, 2: 5, ... } — hole-by-hole scores)
        holes/          ({ 1: { score: 4, putts: 2, gir: false, notes: '' }, ... })
        stats/          ({ totalScore, toPar, holesPlayed, stablefordPoints, ... })
        currentHole/    (the hole the team is currently on)
        scoringLockedBy/ (userId of whichever teammate is actively scoring, or null)
        createdAt/

games/
  {gameId}/
    meta/               (name, date, status, createdBy)
    course/             (snapshot)
    format/             (snapshot — game-exclusive formats allowed)
    settings/
    participants/       (same structure as events, max 4)

soloRounds/
  {soloRoundId}/
    (existing structure — may need alignment with new participant model)

codes/
  {code}/               (e.g. "LG-4X9K")
    type/               (league | series | event | game)
    targetId/           (leagueId, seriesId, eventId, or gameId)
    status/             (active | expired)
    createdAt/
    expiresAt/          (null for leagues)

courses/
  (existing structure — unchanged)

formats/
  (existing structure — unchanged)
```

### Key Data Design Decisions
- **Course and format data is snapshotted** onto each event/game at creation time. Changing a course or format later won't alter historical records. Like a receipt.
- **Standings are stored, not calculated on the fly.** Written to Firebase when an event is ended. Re-ending an event recalculates (doesn't double-count).
- **Everything has nullable parent references.** `leagueId`, `seriesId`, `seasonId` can all be null, enabling standalone use without duplicating logic.
- **Single codes node** handles all join codes across all types. One lookup, smart routing.
- **User memberships** stored under `users/{userId}/leagueMemberships/` and `users/{userId}/events/` — not under a generic `leagues` node.
- **Teams are separate from players.** Players join an event individually (stored in `players/`). For team formats, the host groups them into teams (stored in `teams/`). Scores are written to the team node, not the player node. Individual formats ignore the `teams/` node entirely.
- **User profile data is nested** under `users/{userId}/profile/` (displayName, email, handicap). Code accessing profile data must use `userProfile.profile.displayName`, not `userProfile.displayName`.
- **Firebase rejects null/undefined values** inside objects. When building objects to write (like hole data), strip out any null keys before calling `set()`. This was a past bug source — see Section 18 for details.

---

## 9. Firebase Security Rules (Current)

```json
{
  "rules": {
    "codes": {
      ".read": true,
      ".write": "auth !== null"
    },
    "courses": {
      ".read": true,
      ".write": false
    },
    "formats": {
      ".read": true,
      ".write": false
    },
    "leagues": {
      ".read": "auth !== null",
      ".write": "auth !== null"
    },
    "events": {
      ".read": "auth !== null",
      ".write": "auth !== null"
    },
    "users": {
      ".read": "auth !== null",
      ".write": "auth !== null"
    }
  }
}
```

---

## 10. User Roles & Permissions

| Role | Who | Capabilities |
|---|---|---|
| **Super Admin** | App owner only (one account) | Manages global courses, seeds default formats, full access |
| **League Commissioner** | Any user who creates a league | Manages their league, seasons, points config, membership, can regenerate league code |
| **Series Organizer** | Any user who creates a series | Manages their series and its events |
| **Event Host** | Any user who creates an event or game | Manages scoring for that activity |
| **Member/Participant** | Any signed-in user | Joins leagues, participates in events, views leaderboards |
| **Guest** | No account required | Participates in games/events when added by name |

> **Future state:** Format catalog where users publish custom formats for others to discover.

---

## 11. Format Management

- Default/seeded formats managed by Super Admin
- Users can create custom formats stored on their profile
- Some formats are exclusive to Games (not available for Events)
- **Future:** Conversational AI interface for building formats via chat
- **Future:** Format catalog for discovering and publishing formats

---

## 12. Feature Status

| Feature | Status | Notes |
|---|---|---|
| Email/password auth | ✅ Done | |
| Course management (admin) | ✅ Done | Manual entry only |
| Format management (admin) | ✅ Done | Pre-seeded defaults |
| Solo round | ✅ Done | May need alignment with new participant model |
| Event creation | ✅ Done | Uses new codes system |
| League creation | ✅ Done (basic) | Uses new codes system |
| Live leaderboard | ✅ Done | Supports team and individual formats, league standings projection |
| Unified codes system | ✅ Done | Replaces old leagueCodes + eventCodes nodes |
| New taxonomy data structure | ✅ Done | Implemented — see Sections 7 & 8 |
| Team scoring (events) | ✅ Done | See Section 16 |
| Event deletion | ✅ Done | Host can delete open events from lobby |
| League points & standings | ✅ Done | See Section 17 |
| Round finalization prompt | ✅ Done | See Section 18 |
| League dashboard | ✅ Done | Events (live/upcoming/completed), members, standings display |
| Guest participants | 🔲 Not started | |
| Series concept | 🔲 Not started | |
| Game concept | 🔲 Not started | |
| Robust format management | 🔲 Not started | |
| Conversational format builder | 🔲 Not started | |
| Course integration (external) | 🔲 Not started | Eliminate manual entry |
| GPS / distance feature | 🔲 Not started | |
| Mobile app (iOS/Android) | 🔲 Not started | Capacitor is the planned approach |
| Format catalog | 🔲 Future state | |

---

## 13. Key Utility Files

### `utils/codes.js` — ACTIVE
- `generateCode(type)` — Generates a unique code for a given type (league, series, event, game)
- `createCode(type, targetId, expiresAt)` — Generates a code and saves it to Firebase `codes/` node
- `lookupCode(code)` — Looks up a code in Firebase and returns its data, or null if not found

### `utils/leaguePoints.js` — ACTIVE
- `calculateEventPoints(leaderboardData, leaguePoints, teams, teamSize)` — Pure function. Takes sorted leaderboard and point config, returns `{ playerId → pointsEarned }`. Handles both team and individual formats, including team point distribution (full vs split).
- `writeStandingsToFirebase(leagueId, seasonId, eventId, playerPoints)` — Reads current standings, subtracts any previous points for the same event (safe for re-finalization), adds new points, writes back. Standings structure: `{ points: total, events: { eventId: pointsEarned } }`.

### `utils/scoring.js` — ACTIVE
- `calculateStablefordPoints(score, par)` — Returns Stableford points for a single hole
- `calculateTeamStats(team, coursePars, format)` — Returns total, holes completed, to-par or Stableford points for a team

### `utils/helpers.js` — ACTIVE (trimmed)
- `getDeviceId()` — Generates/retrieves a device ID from localStorage. Used in `App.jsx`.

---

## 14. Development Workflow

1. Work in **VSCode** locally
2. Run app with `npm run dev` (Vite)
3. Test locally at `localhost:5173` (or similar)
4. Push to **GitHub** via terminal (`git push`)
5. **Vercel** auto-deploys from the GitHub main branch

---

## 15. Important Context for AI Sessions

- The developer does **not** have a CS background — use plain language and give step-by-step instructions, not general task lists.
- Explain any new terms briefly when introduced.
- When showing code changes, be specific about **which file** and **where** in the file the change goes.
- The product philosophy (Section 2) should inform every feature decision — configurability underneath, simplicity on the surface.
- The app is a **React/Vite** app, sometimes referred to as "React/Jive" by the developer — these are the same thing.
- Firebase data was wiped in March 2026 — all data follows the new structure going forward.
- Super Admin email is `willsmith919@gmail.com` — checked in `isAdmin()` function in App.jsx.

---

## 16. Team Scoring System

✅ **FULLY BUILT** — March 2026

Team scoring is driven entirely by the format's `teamSize` field. When `teamSize > 1`, the event uses team scoring. When `teamSize === 1`, it's individual scoring and the team system is invisible.

### How It Works

1. **Event creation** — The selected format's `teamSize` is saved to `meta.teamSize`. This drives all team behavior.
2. **Players join individually** — Players join via event code as normal and appear in the `players/` node.
3. **Host assigns teams** — A "Teams" tab appears in the lobby (team formats only). The host can manually create teams and assign players, or use "Auto-Assign" to randomly shuffle players into teams. Each player can only be on one team. Teams can be renamed.
4. **Start validation** — The event cannot start until all players are assigned to a team.
5. **Scoring** — When a player taps "Enter Team Scores", the app finds their team and writes scores to `events/{id}/teams/{teamId}/`. Both team members can score, but only one at a time (controlled by `scoringLockedBy`).
6. **Leaderboard** — Shows team names with member names underneath. Reads from `teams/` node. Sorting, positioning, and expanded hole-by-hole detail all work identically to individual mode.

### Scoring Lock

Prevents two teammates from entering scores simultaneously. It's a manual lock (not a listener) to avoid performance issues:
- **Set** when the user clicks "Enter Team Scores" in the lobby (one Firebase write)
- **Cleared** when the user clicks "Back to Lobby" from the scoring view (one Firebase write)
- If a teammate tries to enter scores while locked, they see a message like "Will is currently entering scores for your team"

### Key Files
- `src/components/events/TeamManager.jsx` — host UI for creating/assigning/renaming teams
- `src/components/events/EventLobbyView.jsx` — Teams tab, scoring lock set, start validation
- `src/components/scoring/ScoringView.jsx` — reads/writes to teams/ or players/ based on format, clears lock on exit
- `src/components/scoring/LiveLeaderboard.jsx` — shows teams or players based on format

### Important: userProfile Path
User profile data is nested in Firebase: `users/{userId}/profile/displayName`, not `users/{userId}/displayName`. All code that reads from `userProfile` must use `userProfile.profile.displayName` and `userProfile.profile.handicap`. This was a bug source — if new code reads user data, double-check the path.

---

## 17. League Points & Standings System

✅ **FULLY BUILT** — March 2026

League events can award points to players based on their finishing position. Points accumulate across events into season standings.

### How It Works

1. **Season config** — The league's active season has a `defaultPointsConfig` that pre-fills when creating league events. This is the default point structure the commissioner sets up.
2. **Event-level config** — Each league event carries its own `meta.leaguePoints` config (snapshotted at creation, editable per event). This follows the receipt pattern — changing the season defaults won't retroactively alter past events.
3. **Event creation** — When creating an event from the league dashboard, the league's `defaultPointsConfig` pre-fills the event's `leaguePoints`. The commissioner can adjust for this specific event.
4. **Ending an event** — When the host clicks "End Event", the app builds a sorted leaderboard, maps each position to points, and writes to `leagues/{leagueId}/seasons/{seasonId}/standings/`.
5. **Re-finalization** — If the host reopens and re-ends an event, standings are recalculated correctly (previous points for that event are subtracted before adding new ones). No double-counting.
6. **Live projection** — The Live Leaderboard shows a collapsible "League Standings Impact" panel for league events. It projects what standings would look like if the round ended now, with movement arrows showing who would move up/down.

### leaguePoints Config Structure
```
meta.leaguePoints: {
  enabled: true,
  positions: { "1": 25, "2": 20, "3": 16, "4": 13, ... },
  participationPoints: 5,
  teamPointDistribution: "full" | "split"
}
```

- `positions` — Points awarded by finishing position (string keys)
- `participationPoints` — Flat points every player earns just for participating
- `teamPointDistribution` — For team formats: "full" gives each member the full position points, "split" divides evenly among members

### Standings Firebase Structure
```
leagues/{leagueId}/seasons/{seasonId}/standings/
  {userId}/
    points/            (total points across all events)
    events/
      {eventId}/       (points earned in that specific event)
```

### Key Files
- `src/utils/leaguePoints.js` — `calculateEventPoints()` (pure) and `writeStandingsToFirebase()`
- `src/components/events/EventLobbyView.jsx` — calls standings calculation when "End Event" is clicked; contains `buildSortedLeaderboard()` helper
- `src/components/scoring/LiveLeaderboard.jsx` — "League Standings Impact" projection panel
- `src/components/shared/EventForm.jsx` — league points configuration UI (position points, participation points, team distribution)
- `src/components/events/CreateEventView.jsx` — pulls `defaultPointsConfig` from season and passes to EventForm
- `src/components/events/EditEventView.jsx` — passes existing `leaguePoints` to EventForm for editing
- `src/components/leagues/LeagueDashboardView.jsx` — displays season standings

---

## 18. Round Finalization & Scoring Details

✅ **FULLY BUILT** — March 2026

### Round Complete Prompt
When a player saves their score on the **last hole** of an event, a modal appears:
- **"Back to Lobby"** — clears the scoring lock (if team format) and returns to the event lobby
- **"Review Scorecard"** — dismisses the modal so the player can review/edit their scores

Solo rounds already had a similar flow (confirm dialog after last hole → navigate to scorecard). The event mode now matches this behavior with a proper modal overlay.

### Firebase null/undefined Safety
Firebase Realtime Database rejects `null` or `undefined` values inside objects passed to `set()`. The `saveHoleData` function in `ScoringView.jsx` strips out any null keys from the hole entry before writing. This is especially relevant for **par 3 holes** where `fairway` is null (fairway tracking doesn't apply to par 3s), and for the **non-stat-tracking flow** where `putts` and `fairway` are both null.

### Number Inputs on Mobile
League points inputs in `EventForm.jsx` use `type="text"` with `inputMode="numeric"` instead of `type="number"`. This shows a number keyboard on mobile without the spinner arrows that `type="number"` adds (which are unhelpful on mobile and interfere with manual entry). Non-numeric characters are stripped via `onChange`.

### Key Files
- `src/components/scoring/ScoringView.jsx` — `showRoundComplete` modal, `saveHoleData` null-stripping
- `src/components/shared/EventForm.jsx` — mobile-friendly number inputs

---

## 19. Known Patterns & Past Bug Sources

These patterns have caused bugs before. If new code touches these areas, double-check:

- **userProfile path:** Data is at `userProfile.profile.displayName`, NOT `userProfile.displayName`. Always nest through `.profile.`.
- **Firebase null values:** Never include `null` or `undefined` in objects written via `set()`. Strip them first. Use `delete obj[key]` for null keys.
- **Firebase update loops:** `useEffect`-based Firebase listeners + `set()` calls can cause rapid loops. The `onValue` listener in EventLobbyView is the canonical pattern — one listener, read-only in the component, manual writes only when needed.
- **State timing:** Passing callbacks rather than setting state and navigating simultaneously avoids race conditions. Example: `onCreateSimilar` callback pattern in ExpiredCodeView.
- **Scoring lock:** Manual lock via `scoringLockedBy` field, not a Firebase listener. Set on "Enter Scores", cleared on "Back to Lobby" or the round complete modal.
