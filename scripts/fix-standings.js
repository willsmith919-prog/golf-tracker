/**
 * fix-standings.js
 *
 * Recomputes and corrects league standings for a specific event.
 * Useful when the "End Event" flow wrote wrong points (e.g. everyone got 1st-place pts).
 *
 * Usage (run from the project root):
 *   node scripts/fix-standings.js <eventId>            — preview only (safe, no writes)
 *   node scripts/fix-standings.js <eventId> --commit   — write corrected standings to Firebase
 *
 * Get the eventId from the Firebase console, or from the app URL when viewing the event.
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set } from 'firebase/database';

// ── Firebase config ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyB8u4N8yPT9VJejYCgfT_v_FSGohCghr1M",
  authDomain: "livelinks-cf018.firebaseapp.com",
  databaseURL: "https://livelinks-cf018-default-rtdb.firebaseio.com",
  projectId: "livelinks-cf018",
  storageBucket: "livelinks-cf018.firebasestorage.app",
  messagingSenderId: "658641708649",
  appId: "1:658641708649:web:620bd1327d75c3678424f8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ── Helpers (mirrors src/utils/*) ─────────────────────────────────────────────

function buildHoleOrder(numHoles, startingHole = 1) {
  const holes = [];
  for (let i = 0; i < numHoles; i++) {
    holes.push(((startingHole - 1 + i) % numHoles) + 1);
  }
  return holes;
}

function getPlayerCourseHandicap(playerHandicap, { handicapEnabled, courseSlope, courseRating, coursePar, handicapAllowance = 100 }) {
  if (!handicapEnabled || playerHandicap == null) return 0;
  const raw = (courseSlope && courseRating)
    ? (playerHandicap * courseSlope / 113) + (courseRating - coursePar)
    : playerHandicap;
  return Math.round(raw * (handicapAllowance / 100));
}

function getStrokeHoles(courseHandicap, { handicapEnabled, courseStrokeIndexes }) {
  if (!handicapEnabled || courseHandicap <= 0 || !courseStrokeIndexes?.length) return {};
  const strokes = {};
  for (let s = 1; s <= courseHandicap; s++) {
    const targetSI = ((s - 1) % 18) + 1;
    const holeIndex = courseStrokeIndexes.indexOf(targetSI);
    if (holeIndex !== -1) {
      const holeNum = holeIndex + 1;
      strokes[holeNum] = (strokes[holeNum] || 0) + 1;
    }
  }
  return strokes;
}

function calculateStablefordPoints(score, par) {
  const diff = score - par;
  if (diff >= 2) return 0;
  if (diff === 1) return 1;
  if (diff === 0) return 2;
  if (diff === -1) return 3;
  if (diff === -2) return 4;
  return 5;
}

function sortLeaderboard(entries, { scoringMethod, primarySort, handicapEnabled }) {
  entries.sort((a, b) => {
    if (a.holesPlayed === 0 && b.holesPlayed > 0) return 1;
    if (b.holesPlayed === 0 && a.holesPlayed > 0) return -1;
    if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
    if (scoringMethod === 'stableford') return b.stablefordPoints - a.stablefordPoints;
    if (primarySort === 'net' && handicapEnabled) {
      if (a.netToPar !== b.netToPar) return a.netToPar - b.netToPar;
      return a.toPar - b.toPar;
    }
    if (a.toPar !== b.toPar) return a.toPar - b.toPar;
    return a.totalScore - b.totalScore;
  });
}

function assignPositions(entries, { primarySort, handicapEnabled, scoringMethod }) {
  let pos = 1;
  entries.forEach((entry, i) => {
    if (i === 0 || entry.holesPlayed === 0) {
      entry.position = entry.holesPlayed === 0 ? '-' : pos;
    } else {
      const prev = entries[i - 1];
      const tied = primarySort === 'net' && handicapEnabled
        ? entry.netToPar === prev.netToPar
        : scoringMethod === 'stableford'
          ? entry.stablefordPoints === prev.stablefordPoints
          : entry.toPar === prev.toPar;
      entry.position = (tied && prev.holesPlayed > 0) ? prev.position : i + 1;
    }
    pos = (typeof entry.position === 'number' ? entry.position : pos) + 1;
  });
}

function calculateEventPoints(leaderboardData, leaguePoints, teams, teamSize, players, leagueMembers) {
  if (!leaguePoints?.positions) return {};
  const { positions, participationPoints = 0, teamPointDistribution: dist = 'full', nonLeagueHandling = 'skip' } = leaguePoints;
  const isTeam = teamSize > 1;
  const isMember = uid => !uid?.startsWith('guest-') && (leagueMembers ? !!leagueMembers[uid] : true);
  const pts = {};

  if (!isTeam && nonLeagueHandling === 'award_around') {
    let leaguePos = 1;
    for (const e of leaderboardData) {
      if (e.holesPlayed === 0 || !isMember(e.id)) continue;
      pts[e.id] = (positions[String(leaguePos)] || 0) + participationPoints;
      leaguePos++;
    }
  } else if (!isTeam) {
    for (const e of leaderboardData) {
      if (e.holesPlayed === 0 || !isMember(e.id)) continue;
      pts[e.id] = (positions[String(e.position)] || 0) + participationPoints;
    }
  } else {
    let leaguePos = 1;
    for (const e of leaderboardData) {
      if (e.holesPlayed === 0) continue;
      const team = teams[e.id];
      const members = Object.keys(team?.members || {}).filter(isMember);
      if (!members.length) continue;
      const posKey = nonLeagueHandling === 'award_around' ? String(leaguePos) : String(e.position);
      const total = (positions[posKey] || 0) + participationPoints;
      for (const uid of members) {
        pts[uid] = dist === 'split' ? Math.round((total / members.length) * 10) / 10 : total;
      }
      if (nonLeagueHandling === 'award_around') leaguePos++;
    }
  }
  return pts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function fixStandings(eventId, commit) {
  const mode = commit ? '' : '[DRY RUN] ';
  console.log(`\n${mode}Fixing standings for event: ${eventId}\n`);

  // Read event
  const eventSnap = await get(ref(db, `events/${eventId}`));
  const event = eventSnap.val();
  if (!event) {
    console.error(`Event "${eventId}" not found.`);
    process.exit(1);
  }

  const meta = event.meta || {};
  const { leaguePoints, leagueId, seasonId } = meta;
  if (!leaguePoints || !leagueId || !seasonId) {
    console.log('This event has no league points config. Nothing to fix.');
    process.exit(0);
  }

  console.log(`League: ${leagueId}  |  Season: ${seasonId}`);
  console.log(`Scoring: ${meta.scoringMethod || 'stroke'}  |  Sort: ${meta.display?.primarySort || 'gross'}  |  Handicap: ${meta.handicap?.enabled ? 'yes' : 'no'}\n`);

  // Read league members + current standings in parallel
  const [membersSnap, standingsSnap] = await Promise.all([
    get(ref(db, `leagues/${leagueId}/members`)),
    get(ref(db, `leagues/${leagueId}/seasons/${seasonId}/standings`))
  ]);
  const leagueMembers = membersSnap.val() || {};
  const currentStandings = standingsSnap.val() || {};

  // Build leaderboard from raw hole scores
  const coursePars = meta.coursePars || [];
  const courseStrokeIndexes = meta.courseStrokeIndexes || [];
  const holeOrder = buildHoleOrder(meta.numHoles || 18, meta.startingHole || 1);
  const handicapEnabled = !!meta.handicap?.enabled;
  const scoringMethod = meta.scoringMethod || 'stroke';
  const primarySort = meta.display?.primarySort || 'gross';
  const teamSize = meta.teamSize || 1;
  const isTeamFormat = teamSize > 1;

  const hcpConfig = {
    handicapEnabled,
    courseSlope: (meta.handicap?.useSlope !== false && meta.courseSlope) ? meta.courseSlope : null,
    courseRating: (meta.handicap?.useSlope !== false && meta.courseRating) ? meta.courseRating : null,
    coursePar: coursePars.reduce((s, p) => s + (p || 0), 0),
    handicapAllowance: meta.handicap?.allowance || 100
  };

  // Build one entry per player/team with correctly computed scores
  const computeEntry = (id, unit, playerHandicap) => {
    const courseHandicap = getPlayerCourseHandicap(playerHandicap, hcpConfig);
    const strokeHoles = getStrokeHoles(courseHandicap, { handicapEnabled, courseStrokeIndexes });
    let totalScore = 0, netTotal = 0, stablefordPoints = 0, holesPlayed = 0;

    for (const holeNum of holeOrder) {
      const score = unit.scores?.[holeNum] || unit.holes?.[holeNum]?.score;
      if (!score || score <= 0) continue;
      holesPlayed++;
      totalScore += score;
      const par = coursePars[holeNum - 1] || 0;
      const strokes = strokeHoles[holeNum] || 0;
      if (handicapEnabled) netTotal += score - strokes;
      if (scoringMethod === 'stableford') stablefordPoints += calculateStablefordPoints(score, par + strokes);
    }

    const playedPar = holeOrder.slice(0, holesPlayed).reduce((s, h) => s + (coursePars[h - 1] || 0), 0);
    const toPar = totalScore - playedPar;
    const netToPar = handicapEnabled ? netTotal - playedPar : toPar;
    return { id, holesPlayed, totalScore, toPar, netToPar, stablefordPoints };
  };

  let entries;
  if (isTeamFormat) {
    entries = Object.entries(event.teams || {}).map(([teamId, team]) => {
      const handicaps = Object.keys(team.members || {})
        .map(uid => event.players?.[uid]?.handicap)
        .filter(h => h != null);
      const avg = handicaps.length ? handicaps.reduce((s, h) => s + h, 0) / handicaps.length : null;
      return computeEntry(teamId, team, avg);
    });
  } else {
    entries = Object.entries(event.players || {}).map(([uid, player]) =>
      computeEntry(uid, player, player.handicap)
    );
  }

  const sortOpts = { scoringMethod, primarySort, handicapEnabled };
  sortLeaderboard(entries, sortOpts);
  assignPositions(entries, sortOpts);

  // Calculate correct points
  const correctPoints = calculateEventPoints(
    entries, leaguePoints, event.teams || {}, teamSize, event.players || {}, leagueMembers
  );

  // Show comparison
  console.log('── Corrected points per player ──────────────────────────────────');
  const affectedUids = new Set([
    ...Object.keys(correctPoints),
    ...Object.keys(currentStandings).filter(uid => currentStandings[uid]?.events?.[eventId])
  ]);

  let anyChange = false;
  for (const uid of affectedUids) {
    const name = (event.players?.[uid]?.displayName || leagueMembers[uid]?.displayName || uid).padEnd(22);
    const was = currentStandings[uid]?.events?.[eventId] ?? 0;
    const now = correctPoints[uid] ?? 0;
    const changed = was !== now;
    if (changed) anyChange = true;
    const marker = changed ? '⚠ ' : '  ';
    const suffix = changed ? '  ← CHANGED' : '';
    console.log(`  ${marker}${name} was ${String(was).padStart(3)} pts → now ${String(now).padStart(3)} pts${suffix}`);
  }

  if (!anyChange) {
    console.log('\n  All standings are already correct. Nothing to fix.\n');
    process.exit(0);
  }

  if (!commit) {
    console.log('\nRun with --commit to apply these changes to Firebase.\n');
    process.exit(0);
  }

  // Apply corrections to the standings object
  const updated = JSON.parse(JSON.stringify(currentStandings));
  for (const uid of affectedUids) {
    if (!updated[uid]) updated[uid] = { points: 0, events: {} };
    const prev = updated[uid].events?.[eventId] ?? 0;
    const newPts = correctPoints[uid] ?? 0;
    updated[uid].points = Math.max(0, (updated[uid].points || 0) - prev + newPts);
    updated[uid].events = updated[uid].events || {};
    if (newPts > 0) {
      updated[uid].events[eventId] = newPts;
    } else {
      delete updated[uid].events[eventId];
    }
  }

  await set(ref(db, `leagues/${leagueId}/seasons/${seasonId}/standings`), updated);
  console.log('\n✓ Standings updated in Firebase.\n');
  process.exit(0);
}

// ── CLI entry point ────────────────────────────────────────────────────────────
const [eventId, ...flags] = process.argv.slice(2);

if (!eventId) {
  console.error('Usage: node scripts/fix-standings.js <eventId> [--commit]');
  console.error('\n  Without --commit it only previews changes (safe to run).');
  process.exit(1);
}

fixStandings(eventId, flags.includes('--commit'));
