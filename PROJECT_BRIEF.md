# LiveLinks — Project Brief
> Paste this at the start of any new AI chat session to restore full project context.

---

## 1. App Overview

**LiveLinks** is a golf scoring web app. Its primary purpose is providing a **live leaderboard** for golf events. A key secondary feature allows organizers to run a **league**, which tracks participants across multiple events and assigns points based on finishing position.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (JSX), Vite (`npm run dev`) |
| Database | Firebase Realtime Database |
| Auth | Firebase Auth — Email/Password only |
| Hosting | Vercel |
| Version Control | GitHub (pushed via terminal in VSCode) |

---

## 3. Folder Structure

```
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
│   └── helpers.js   # Device ID helper + legacy hardcoded format names/descriptions (CANDIDATE FOR DELETION — formats now managed via Format Management UI)
├── App.css
├── App.jsx
├── firebase.js      # Firebase init and config
├── index.css
└── main.jsx
```

---

## 4. Firebase Realtime Database — Top-Level Nodes

| Node | Purpose |
|---|---|
| `courses` | Golf course data (holes, pars, etc.) |
| `eventCodes` | Join codes for events |
| `events` | Individual event records |
| `formats` | Scoring format definitions |
| `leagueCodes` | Join codes for leagues |
| `leagues` | League records |
| `soloRounds` | Solo round records |
| `users` | User profiles and settings |

---

## 5. User Roles & Permissions

| Role | Who | Capabilities |
|---|---|---|
| **Super Admin** | App owner only (one account) | Manages global courses, seeds default formats, full access |
| **Regular User** | Any signed-in user | Can create/manage their own leagues, events, solo rounds. Can create custom formats (stored on their profile). Cannot manage other users' data. |

> **Future state:** A "format catalog" where users can publish their custom formats for others to discover.

> **Not yet built:** Game and Series concepts (see Section 7).

---

## 6. Taxonomy (Planned — Partially Built)

| Type | Description | Status |
|---|---|---|
| **League** | Season-long, recurring events. Assigns points by finishing position. | ✅ Built |
| **Series** | Links multiple events together without full league structure. | 🔲 Not started |
| **Event** | One round, multiple foursomes. | ✅ Built |
| **Game** | One round, one foursome or less. | 🔲 Not started |
| **Solo Round** | One round, one golfer. | ✅ Built |

---

## 7. Feature Status

| Feature | Status | Notes |
|---|---|---|
| Email/password auth | ✅ Done | |
| Course management (admin) | ✅ Done | Manual entry only |
| Format management (admin) | ✅ Done | Pre-seeded defaults + user-created formats planned |
| Solo round | ✅ Done | |
| Event creation | ✅ Done | |
| League creation | ✅ Done | |
| Live leaderboard | ✅ Done | |
| Series concept | 🔲 Not started | Link events without full league structure |
| Game concept | 🔲 Not started | Single foursome or less |
| Conversational format builder | 🔲 Not started | Chat-based UI to build a format |
| Robust format management | 🔲 In progress | Expanding what formats can define |
| Course integration (external) | 🔲 Not started | Eliminate manual course entry |
| GPS / distance feature | 🔲 Not started | |
| Mobile app (iOS/Android) | 🔲 Not started | Currently web-only |
| Format catalog | 🔲 Future state | Users publish formats for others |

---

## 8. Key Utility Files

### `utils/scoring.js` — ACTIVE
- `calculateStablefordPoints(score, par)` — Returns points for a single hole
- `calculateTeamStats(team, coursePars, format)` — Returns total, holes completed, to-par (or Stableford points) for a team

### `utils/helpers.js` — LEGACY / CANDIDATE FOR DELETION
- `getDeviceId()` — Generates/retrieves a device ID from localStorage
- `formatNames` / `formatDescriptions` — Hardcoded format labels from before Format Management UI existed. Check if still imported anywhere before deleting.

---

## 9. Development Workflow

1. Work in **VSCode** locally
2. Run app with `npm run dev` (Vite)
3. Test locally at `localhost:5173` (or similar)
4. Push to **GitHub** via terminal (`git push`)
5. **Vercel** auto-deploys from the GitHub main branch

---

## 10. Important Context for AI Sessions

- The developer does **not** have a CS background — use plain language and give step-by-step instructions, not general task lists.
- Explain any new terms briefly when introduced.
- When showing code changes, be specific about **which file** and **where** in the file the change goes.
- There are no established data-fetching patterns yet — feel free to suggest one if relevant to the task.
- The app is a **React/Vite** app, sometimes referred to as a "React/Jive app" by the developer — these are the same thing.
