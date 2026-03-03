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
│   ├── home/        # Landing/home screen
│   ├── leagues/     # League management
│   ├── scoring/     # Live scoring and leaderboard
│   └── shared/      # Reusable UI components
├── utils/
│   ├── scoring.js   # Stableford + team score calculation (ACTIVE)
│   └── helpers.js   # getDeviceId() only — used in App.jsx (ACTIVE, trimmed)
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

**Expired code behavior:** Rather than showing a dead-end error, the app shows what the thing *was* (name, date, location) and offers a read-only view of the final leaderboard. The leaderboard is a permanent record.

**League code regeneration:** A commissioner can invalidate their current League code and generate a new one at any time (e.g. if a code was shared somewhere it shouldn't have been). The old code immediately stops working. The league and its members are unaffected.

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

> **Note:** All existing Firebase data is test data and was wiped for this redesign (Feb 2026).

```
users/
  {userId}/
    profile/            (name, email, handicap, avatarUrl, createdAt)
    leagueMemberships/  (leagueId → role: commissioner | member)

leagues/
  {leagueId}/
    meta/               (name, description, commissionerId, createdAt)
    settings/           (notification prefs, defaults)
    members/            (userId → { role, joinedAt })
    seasons/
      {seasonId}/
        meta/           (name, startDate, endDate, status)
        pointsConfig/   (finishing spots → points, participation points, side event points)
        eventRefs/      (eventId → true)
        seriesRefs/     (seriesId → true)
        standings/      (userId → totalPoints — recalculated on score change)

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
    meta/               (name, date, status, createdBy)
    leagueId/           (null if standalone)
    seriesId/           (null if standalone)
    seasonId/           (null if standalone)
    course/             (snapshot: courseId, name, pars, yardages, strokeIndexes)
    format/             (snapshot: formatId, name, scoringMethod, handicap settings)
    display/            (leaderboard display config)
    settings/           (numHoles, startingHole, endingHole, teeId, teeName)
    participants/
      {participantId}/
        type/           (user | guest)
        userId/         (null if guest)
        displayName/
        handicap/
        scores/         (hole index → score)
        teamId/         (null if individual format)

games/
  {gameId}/
    meta/               (name, date, status, createdBy)
    course/             (snapshot)
    format/             (snapshot — game-exclusive formats allowed)
    settings/
    participants/       (same structure as events, max 4)

soloRounds/
  {soloRoundId}/
    (existing structure — review for alignment with new participant model)

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
- **Standings are stored, not calculated on the fly.** Recalculated and saved whenever scores change. Keeps leaderboard fast.
- **Everything has nullable parent references.** `leagueId`, `seriesId`, `seasonId` can all be null, enabling standalone use without duplicating logic.
- **Single codes node** handles all join codes across all types. One lookup, smart routing.

---

## 9. User Roles & Permissions

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

## 10. Format Management

- Default/seeded formats managed by Super Admin
- Users can create custom formats stored on their profile
- Some formats are exclusive to Games (not available for Events)
- **Future:** Conversational AI interface for building formats via chat
- **Future:** Format catalog for discovering and publishing formats

---

## 11. Feature Status

| Feature | Status | Notes |
|---|---|---|
| Email/password auth | ✅ Done | |
| Course management (admin) | ✅ Done | Manual entry only |
| Format management (admin) | ✅ Done | Pre-seeded defaults |
| Solo round | ✅ Done | May need alignment with new participant model |
| Event creation | ✅ Done | Needs refactor for new data structure |
| League creation | ✅ Done (basic) | Needs full rebuild per new structure |
| Live leaderboard | ✅ Done | |
| New taxonomy data structure | 🔲 In progress | Designed — see Sections 7 & 8 |
| Unified codes system | 🔲 Not started | Replaces old leagueCodes + eventCodes nodes |
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

## 12. Key Utility Files

### `utils/scoring.js` — ACTIVE
- `calculateStablefordPoints(score, par)` — Returns Stableford points for a single hole
- `calculateTeamStats(team, coursePars, format)` — Returns total, holes completed, to-par or Stableford points for a team

### `utils/helpers.js` — ACTIVE (trimmed)
- `getDeviceId()` — Generates/retrieves a device ID from localStorage. Used in `App.jsx`.
- Previously contained hardcoded format names/descriptions — removed when Format Management UI was built.

---

## 13. Development Workflow

1. Work in **VSCode** locally
2. Run app with `npm run dev` (Vite)
3. Test locally at `localhost:5173` (or similar)
4. Push to **GitHub** via terminal (`git push`)
5. **Vercel** auto-deploys from the GitHub main branch

---

## 14. Important Context for AI Sessions

- The developer does **not** have a CS background — use plain language and give step-by-step instructions, not general task lists.
- Explain any new terms briefly when introduced.
- When showing code changes, be specific about **which file** and **where** in the file the change goes.
- The product philosophy (Section 2) should inform every feature decision — configurability underneath, simplicity on the surface.
- The app is a **React/Vite** app, sometimes referred to as "React/Jive" by the developer — these are the same thing.
- All Firebase data was wiped in Feb 2026 — existing data follows the new structure going forward.
