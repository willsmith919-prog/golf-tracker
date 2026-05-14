import { getPlayerCourseHandicap, getStrokeHoles } from './handicap';

/**
 * Calculates skins results from leaderboard entries.
 *
 * Skins rules:
 * - Lowest score on a hole wins the skin.
 * - If two or more players tie, nobody wins — the skin carries to the next hole (if carryover enabled).
 * - A hole is "pending" until all active entries have posted a score for it.
 *
 * @param {Array}  entries   - Array of { id, scores, holes, strokeHoles, holesPlayed }
 * @param {Array}  holeOrder - Ordered hole numbers for the round (from buildHoleOrder)
 * @param {Array}  coursePars - Par per hole, index 0 = hole 1
 * @param {Object} sideGame  - { variant: 'gross'|'net', pointsPerSkin: number, carryover: boolean }
 * @returns {{ holeResults, pointTotals, skinCounts }}
 *   holeResults: array of { holeNum, status: 'won'|'tied'|'pending', pot, scores, winnerId }
 *   pointTotals: { entryId: totalPointsWon }
 *   skinCounts:  { entryId: totalSkinsWon (counting carryover value, not raw holes) }
 */
export function calculateSkins(entries, holeOrder, coursePars, sideGame) {
  const variant = sideGame.variant || 'gross';
  const pointsPerSkin = Number(sideGame.pointsPerSkin) || 1;
  const carryover = sideGame.carryover !== false;
  const splitTies = sideGame.splitTies === true;

  const activeEntries = entries.filter(e => e.holesPlayed > 0);
  if (activeEntries.length < 2) {
    return { holeResults: [], pointTotals: {}, skinCounts: {} };
  }

  const holeResults = [];
  const pointTotals = {};
  const skinCounts = {};
  let pot = 1; // number of skins currently at stake on this hole

  for (const holeNum of holeOrder) {
    const holeScores = {};

    for (const entry of activeEntries) {
      const grossScore = entry.scores?.[holeNum] || entry.holes?.[holeNum]?.score;
      if (!grossScore || grossScore <= 0) continue;

      if (variant === 'net') {
        const strokes = entry.strokeHoles?.[holeNum] || 0;
        holeScores[entry.id] = grossScore - strokes;
      } else {
        holeScores[entry.id] = grossScore;
      }
    }

    const scoredIds = Object.keys(holeScores);

    // Need at least 2 scores to make a meaningful comparison
    if (scoredIds.length < 2) {
      holeResults.push({ holeNum, status: 'pending', provisional: false, pot, scores: holeScores, winnerId: null });
      pot = 1;
      continue;
    }

    const allScored = scoredIds.length === activeEntries.length;
    const minScore = Math.min(...scoredIds.map(id => holeScores[id]));
    const leaders = scoredIds.filter(id => holeScores[id] === minScore);

    if (leaders.length === 1) {
      // One clear leader among those who have scored — award provisionally
      const winnerId = leaders[0];
      const pointsWon = pot * pointsPerSkin;
      pointTotals[winnerId] = (pointTotals[winnerId] || 0) + pointsWon;
      skinCounts[winnerId] = (skinCounts[winnerId] || 0) + pot;

      if (allScored) {
        holeResults.push({ holeNum, status: 'won', provisional: false, pot, scores: holeScores, winnerId });
      } else {
        // 'leading' = provisional win, still others to play
        holeResults.push({ holeNum, status: 'leading', provisional: true, pot, scores: holeScores, winnerId });
      }
      pot = 1;
    } else {
      // Tied among those who have scored
      if (leaders.length === 2 && splitTies) {
        // Exactly 2 players tied with split enabled — award half the pot to each
        const halfPot = pot / 2;
        const halfPoints = halfPot * pointsPerSkin;
        for (const id of leaders) {
          pointTotals[id] = (pointTotals[id] || 0) + halfPoints;
          skinCounts[id] = (skinCounts[id] || 0) + halfPot;
        }
        holeResults.push({
          holeNum, status: 'split', provisional: !allScored,
          pot, scores: holeScores, winnerId: null, splitWinnerIds: leaders
        });
        pot = 1;
      } else if (allScored) {
        // Final tie (3+ players, or 2-way with split disabled) — commit to carryover decision
        holeResults.push({ holeNum, status: 'tied', provisional: false, pot, scores: holeScores, winnerId: null });
        if (carryover) {
          pot++;
        } else {
          pot = 1;
        }
      } else {
        // Provisional tie — others yet to score, don't carry yet
        holeResults.push({ holeNum, status: 'tied', provisional: true, pot, scores: holeScores, winnerId: null });
        pot = 1;
      }
    }
  }

  return { holeResults, pointTotals, skinCounts };
}

/**
 * Builds skins-ready entries from raw event data, including handicap stroke calculations
 * for net-variant skins. Used by EventLobbyView when ending an event (outside the
 * LiveLeaderboard context that already has these computed).
 *
 * @param {Object} currentEvent - Full event object from Firebase
 * @returns {Array} entries suitable for calculateSkins()
 */
export function buildSkinsEntries(currentEvent) {
  const meta = currentEvent.meta || {};
  const players = currentEvent.players || {};
  const teams = currentEvent.teams || {};
  const isTeam = (meta.teamSize || 1) > 1 && Object.keys(teams).length > 0;
  const handicapEnabled = meta.handicap?.enabled || false;
  const useSlope = meta.handicap?.useSlope ?? true;
  const coursePars = meta.coursePars || [];
  const coursePar = coursePars.reduce((sum, p) => sum + (p || 0), 0);

  const handicapConfig = {
    handicapEnabled,
    courseSlope: useSlope ? (meta.courseSlope || null) : null,
    courseRating: useSlope ? (meta.courseRating || null) : null,
    coursePar,
    handicapAllowance: meta.handicap?.allowance || 100,
    courseStrokeIndexes: meta.courseStrokeIndexes || []
  };

  if (isTeam) {
    const teamMethod = meta.handicap?.teamHandicapMethod || 'average';

    return Object.entries(teams).map(([teamId, team]) => {
      const memberHandicaps = Object.keys(team.members || {})
        .map(uid => players[uid]?.handicap)
        .filter(h => h != null);

      let teamBaseHandicap;
      if (teamMethod === 'usga_scramble' && memberHandicaps.length === 2) {
        const sorted = [...memberHandicaps].sort((a, b) => a - b);
        teamBaseHandicap = (sorted[0] * 0.35) + (sorted[1] * 0.15);
      } else {
        teamBaseHandicap = memberHandicaps.length > 0
          ? memberHandicaps.reduce((sum, h) => sum + h, 0) / memberHandicaps.length
          : null;
      }

      const courseHandicap = getPlayerCourseHandicap(teamBaseHandicap, handicapConfig);
      const strokeHoles = handicapEnabled ? getStrokeHoles(courseHandicap, handicapConfig) : {};

      return {
        id: teamId,
        scores: team.scores || {},
        holes: team.holes || {},
        strokeHoles,
        holesPlayed: team.stats?.holesPlayed || 0
      };
    });
  }

  return Object.entries(players).map(([uid, player]) => {
    const courseHandicap = getPlayerCourseHandicap(player.handicap, handicapConfig);
    const strokeHoles = handicapEnabled ? getStrokeHoles(courseHandicap, handicapConfig) : {};

    return {
      id: uid,
      scores: player.scores || {},
      holes: player.holes || {},
      strokeHoles,
      holesPlayed: player.stats?.holesPlayed || 0
    };
  });
}
