import { buildHoleOrder } from './holes';

// ============================================================
// STAT GAMES
// Bonus points based on scoring stats, e.g. "Most Birdies" or
// "Fewest Bogeys". Counted automatically from each player's
// gross hole scores — nothing extra to enter during the round.
//
// Config lives on the league/series points config and is
// snapshotted onto each event (receipt model):
//   events/{id}/meta/leaguePoints/statGames = [
//     { id, stat: 'birdies'|'bogeys'|..., mode: 'most'|'fewest'|'per', points }
//   ]
//   most / fewest — the leader earns `points` (ties split them)
//   per           — every occurrence earns `points` (can be negative)
//
// Scored per round, for individual formats only. For most/fewest,
// only players who finished every hole are eligible (so a player
// who left after 9 can't win "Fewest Bogeys").
// ============================================================

export const STAT_TYPES = {
  eagles:  { label: 'Eagles',  detail: 'eagle or better',        test: diff => diff <= -2, defaultMode: 'most' },
  birdies: { label: 'Birdies', detail: 'birdie or better',       test: diff => diff <= -1, defaultMode: 'most' },
  pars:    { label: 'Pars',    detail: 'exactly par',            test: diff => diff === 0, defaultMode: 'most' },
  bogeys:  { label: 'Bogeys',  detail: 'exactly bogey',          test: diff => diff === 1, defaultMode: 'fewest' },
  bogeysPlus: { label: 'Bogeys or Worse', detail: 'bogey, double, or worse', test: diff => diff >= 1, defaultMode: 'fewest' },
  doubles: { label: 'Doubles', detail: 'double bogey or worse',  test: diff => diff >= 2,  defaultMode: 'fewest' }
};

export function newStatGame(stat = 'birdies') {
  return { id: `stat-${Date.now()}`, stat, mode: STAT_TYPES[stat].defaultMode, points: 5 };
}

// "Most Birdies", "Fewest Bogeys", "Birdies (+1 each)"
export function statGameLabel(game) {
  const type = STAT_TYPES[game.stat];
  if (!type) return 'Stat Game';
  if (game.mode === 'per') {
    const pts = Number(game.points) || 0;
    return `${type.label} (${pts > 0 ? '+' : ''}${pts} each)`;
  }
  return `${game.mode === 'fewest' ? 'Fewest' : 'Most'} ${type.label}`;
}

/**
 * Calculates stat game results for one event. Pure function.
 * @returns {{ games: Array<{ game, counts, eligible, leaders, points }>, byPlayer: { uid: { gameId: pts } } }}
 *   counts: { uid: occurrences }   eligible: [uid]   leaders: [uid] (most/fewest only)
 *   points: { uid: pts } for this game
 */
export function calculateStatGames(currentEvent, statGames = []) {
  const meta = currentEvent?.meta || {};
  const players = currentEvent?.players || {};
  const coursePars = meta.coursePars || [];
  const holeOrder = buildHoleOrder(meta.numHoles || 18, meta.startingHole || 1);
  const isIndividual = (meta.teamSize || 1) === 1;

  const byPlayer = {};
  if (!isIndividual || statGames.length === 0) return { games: [], byPlayer };

  // Players who have posted at least one score (guests never earn standings points)
  const participants = Object.entries(players)
    .filter(([uid]) => !uid.startsWith('guest-'))
    .map(([uid, player]) => {
      const holeScores = {};
      for (const h of holeOrder) {
        const s = player.scores?.[h] || player.holes?.[h]?.score;
        if (s) holeScores[h] = s;
      }
      return { uid, holeScores, holesPlayed: Object.keys(holeScores).length };
    })
    .filter(p => p.holesPlayed > 0);

  const finished = participants.filter(p => p.holesPlayed === holeOrder.length);

  const games = statGames.map(game => {
    const type = STAT_TYPES[game.stat];
    const pts = Number(game.points) || 0;
    const counts = {};
    for (const p of participants) {
      counts[p.uid] = type
        ? Object.entries(p.holeScores).filter(([h, s]) => type.test(s - (coursePars[h - 1] || 0))).length
        : 0;
    }

    const points = {};
    let eligible = participants.map(p => p.uid);
    let leaders = [];

    if (game.mode === 'per') {
      for (const uid of eligible) if (counts[uid]) points[uid] = counts[uid] * pts;
    } else {
      eligible = finished.map(p => p.uid);
      if (eligible.length > 0) {
        const values = eligible.map(uid => counts[uid]);
        const target = game.mode === 'fewest' ? Math.min(...values) : Math.max(...values);
        // "Most" needs at least one occurrence — nobody wins Most Eagles with zero eagles
        if (game.mode === 'fewest' || target > 0) {
          leaders = eligible.filter(uid => counts[uid] === target);
          const share = Math.round((pts / leaders.length) * 10) / 10;
          for (const uid of leaders) points[uid] = share;
        }
      }
    }

    for (const [uid, p] of Object.entries(points)) {
      if (!byPlayer[uid]) byPlayer[uid] = {};
      byPlayer[uid][game.id] = p;
    }
    return { game, counts, eligible, leaders, points };
  });

  return { games, byPlayer };
}
