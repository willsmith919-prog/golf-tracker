import { getPlayerCourseHandicap, getStrokeHoles } from './handicap';

// ============================================================
// NINES ("9's") SCORING
// A 3-player game. Every hole is worth 9 points, split by finish:
//   Clear 1st / 2nd / 3rd      → 5 / 3 / 1
//   Two tie for 1st            → 4 / 4 / 1
//   Two tie for 2nd            → 5 / 2 / 2
//   All three tie              → 3 / 3 / 3
//
// Larger events are split into threesomes ("groups"). With exactly
// 3 players in the event, they're one group automatically.
//
// Side game config (events/{id}/meta/sideGames/{i}):
//   { sideGameType: 'nines', variant: 'gross'|'net',
//     groups: [[uid, uid, uid], ...]   // optional — set in the lobby
//     seriesPointsMode: 'raw'|'position'|'none',
//     positions: { 1: 5, 2: 3, 3: 1 } } // used by 'position' mode
// ============================================================

export const DEFAULT_NINES_POSITIONS = { 1: 5, 2: 3, 3: 1 };

/**
 * Splits 9 points for one hole. Pure function.
 * @param {Object} holeScores - { uid: score } for exactly 3 players (lower is better)
 * @returns {Object|null} { uid: points }, or null if there aren't exactly 3 scores
 */
export function scoreNinesHole(holeScores) {
  const ids = Object.keys(holeScores);
  if (ids.length !== 3) return null;

  const [first, second, third] = [...ids].sort((a, b) => holeScores[a] - holeScores[b]);
  const s1 = holeScores[first];
  const s2 = holeScores[second];
  const s3 = holeScores[third];

  if (s1 === s2 && s2 === s3) return { [first]: 3, [second]: 3, [third]: 3 };
  if (s1 === s2) return { [first]: 4, [second]: 4, [third]: 1 };
  if (s2 === s3) return { [first]: 5, [second]: 2, [third]: 2 };
  return { [first]: 5, [second]: 3, [third]: 1 };
}

/**
 * Returns the threesomes for a Nines side game.
 * Uses the groups the host set in the lobby; falls back to "everyone"
 * when the event has exactly 3 players. Incomplete groups are ignored.
 */
export function getNinesGroups(sideGame, playerIds) {
  const configured = (sideGame.groups || [])
    .map(g => (g || []).filter(uid => playerIds.includes(uid)))
    .filter(g => g.length === 3);
  if (configured.length > 0) return configured;
  if (playerIds.length === 3) return [playerIds];
  return [];
}

/**
 * Builds per-player entries (scores + handicap stroke holes) from raw event data.
 * Nines is always scored player-by-player, even if the main game uses teams.
 */
export function buildNinesEntries(currentEvent) {
  const meta = currentEvent?.meta || {};
  const players = currentEvent?.players || {};
  const useSlope = meta.handicap?.useSlope ?? true;
  const coursePars = meta.coursePars || [];
  const handicapConfig = {
    handicapEnabled: true, // always compute strokes so Net 9's works on a Gross event
    courseSlope: useSlope ? (meta.courseSlope || null) : null,
    courseRating: useSlope ? (meta.courseRating || null) : null,
    coursePar: coursePars.reduce((sum, p) => sum + (p || 0), 0),
    handicapAllowance: meta.handicap?.allowance || 100,
    courseStrokeIndexes: meta.courseStrokeIndexes || []
  };

  return Object.entries(players).map(([uid, player]) => {
    const courseHandicap = getPlayerCourseHandicap(player.handicap, handicapConfig);
    return {
      id: uid,
      displayName: player.displayName || 'Unknown',
      scores: player.scores || {},
      holes: player.holes || {},
      strokeHoles: getStrokeHoles(courseHandicap, handicapConfig)
    };
  });
}

/**
 * Calculates Nines results for every group.
 * A hole only counts once all 3 players in the group have a score for it.
 *
 * @returns {{ groups: Array<{ playerIds, holeResults, totals, holesScored }>, totals: Object }}
 *   holeResults: [{ holeNum, status: 'scored'|'pending', scores: {uid: score}, points: {uid: pts}|null }]
 *   totals: { uid: points } across all groups
 */
export function calculateNines(entries, holeOrder, sideGame) {
  const isNet = sideGame.variant === 'net';
  const entryById = Object.fromEntries(entries.map(e => [e.id, e]));
  const groups = getNinesGroups(sideGame, entries.map(e => e.id));

  const allTotals = {};
  const groupResults = groups.map(playerIds => {
    const totals = Object.fromEntries(playerIds.map(uid => [uid, 0]));
    let holesScored = 0;

    const holeResults = holeOrder.map(holeNum => {
      const scores = {};
      for (const uid of playerIds) {
        const entry = entryById[uid];
        const gross = entry?.scores?.[holeNum] || entry?.holes?.[holeNum]?.score;
        if (!gross || gross <= 0) continue;
        scores[uid] = isNet ? gross - (entry.strokeHoles?.[holeNum] || 0) : gross;
      }

      const points = scoreNinesHole(scores);
      if (!points) return { holeNum, status: 'pending', scores, points: null };

      holesScored++;
      for (const [uid, pts] of Object.entries(points)) totals[uid] += pts;
      return { holeNum, status: 'scored', scores, points };
    });

    Object.assign(allTotals, totals);
    return { playerIds, holeResults, totals, holesScored };
  });

  return { groups: groupResults, totals: allTotals };
}

/**
 * Converts Nines results into league/series points, per the side game's setting:
 *   'raw'      — each 9's point is one series point (default)
 *   'position' — finish within the threesome earns positions[1/2/3]; ties split
 *   'none'     — this game only, nothing carries over
 * @returns {Object} { uid: seriesPoints }
 */
export function calculateNinesSeriesPoints(ninesResult, sideGame) {
  const mode = sideGame.seriesPointsMode || 'raw';
  if (mode === 'none') return {};

  const points = {};
  for (const group of ninesResult.groups) {
    if (group.holesScored === 0) continue;

    if (mode === 'raw') {
      Object.assign(points, group.totals);
      continue;
    }

    // 'position': rank by total (high wins); tied players share the average of their places
    const positions = sideGame.positions || DEFAULT_NINES_POSITIONS;
    const ranked = [...group.playerIds].sort((a, b) => group.totals[b] - group.totals[a]);
    let i = 0;
    while (i < ranked.length) {
      let j = i;
      while (j + 1 < ranked.length && group.totals[ranked[j + 1]] === group.totals[ranked[i]]) j++;
      let sum = 0;
      for (let place = i + 1; place <= j + 1; place++) sum += Number(positions[place]) || 0;
      const share = Math.round((sum / (j - i + 1)) * 10) / 10;
      for (let k = i; k <= j; k++) points[ranked[k]] = share;
      i = j + 1;
    }
  }
  return points;
}
