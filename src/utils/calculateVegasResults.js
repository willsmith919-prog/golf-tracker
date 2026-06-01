import { getPlayerCourseHandicap, getStrokeHoles } from './handicap';

function buildVegasNumber(scoreA, scoreB) {
  const low = Math.min(scoreA, scoreB);
  const high = Math.max(scoreA, scoreB);
  return low * 10 + high;
}

function getEffectiveScore(grossScore, holeNum, strokeHoles, isNet) {
  if (!grossScore || grossScore <= 0) return null;
  return isNet ? grossScore - (strokeHoles[holeNum] || 0) : grossScore;
}

function getRawScore(entry, holeNum) {
  return entry.scores?.[holeNum] || entry.holes?.[holeNum]?.score || null;
}

/**
 * Calculates Vegas results from player entries.
 *
 * @param {Array}  entries     - Array of { id, scores, holes, strokeHoles, holesPlayed }
 * @param {Array}  holeOrder   - Ordered hole numbers for the round (from buildHoleOrder)
 * @param {Array}  _coursePars - Unused, kept for signature consistency with calculateSkins
 * @param {Object} vegasConfig - Side game config: { type, scoringMode, teams?, players? }
 * @returns {{ subType, scoringMode, holeByHole, finalScore }}
 */
export function calculateVegasResults(entries, holeOrder, _coursePars, vegasConfig) {
  const subType = vegasConfig.type || 'vegas2v2';
  const scoringMode = vegasConfig.scoringMode || 'gross';
  const isNet = scoringMode === 'net';

  const entryMap = {};
  for (const entry of entries) {
    entryMap[entry.id] = entry;
  }

  if (subType === 'vegas2v2') {
    return calcVegas2v2(entryMap, holeOrder, isNet, vegasConfig);
  }
  if (subType === 'vegas1v1') {
    return calcVegas1v1(entryMap, holeOrder, isNet, vegasConfig);
  }

  return { subType, scoringMode, holeByHole: [], finalScore: {} };
}

function calcVegas2v2(entryMap, holeOrder, isNet, vegasConfig) {
  const teamAConfig = vegasConfig.teams?.teamA || {};
  const teamBConfig = vegasConfig.teams?.teamB || {};
  const teamAIds = teamAConfig.playerIds || [];
  const teamBIds = teamBConfig.playerIds || [];

  const holeByHole = [];
  let teamATotal = 0;
  let teamBTotal = 0;

  for (const holeNum of holeOrder) {
    const teamAScores = teamAIds.map(uid => {
      const entry = entryMap[uid];
      if (!entry) return null;
      return getEffectiveScore(getRawScore(entry, holeNum), holeNum, entry.strokeHoles || {}, isNet);
    });

    const teamBScores = teamBIds.map(uid => {
      const entry = entryMap[uid];
      if (!entry) return null;
      return getEffectiveScore(getRawScore(entry, holeNum), holeNum, entry.strokeHoles || {}, isNet);
    });

    const aComplete = teamAScores.length === 2 && teamAScores.every(s => s !== null);
    const bComplete = teamBScores.length === 2 && teamBScores.every(s => s !== null);

    if (!aComplete || !bComplete) {
      holeByHole.push({
        hole: holeNum,
        teamA: { vegasNumber: null, players: teamAIds, scores: teamAScores },
        teamB: { vegasNumber: null, players: teamBIds, scores: teamBScores },
        margin: null,
        runningTotal: teamATotal - teamBTotal,
        status: 'pending'
      });
      continue;
    }

    const vegasA = buildVegasNumber(teamAScores[0], teamAScores[1]);
    const vegasB = buildVegasNumber(teamBScores[0], teamBScores[1]);
    // margin = teamBVegas - teamAVegas: positive means teamA wins (lower is better)
    const margin = vegasB - vegasA;

    if (margin > 0) teamATotal += margin;
    else if (margin < 0) teamBTotal += Math.abs(margin);

    holeByHole.push({
      hole: holeNum,
      teamA: { vegasNumber: vegasA, players: teamAIds, scores: teamAScores },
      teamB: { vegasNumber: vegasB, players: teamBIds, scores: teamBScores },
      margin,
      runningTotal: teamATotal - teamBTotal,
      status: margin > 0 ? 'teamA' : margin < 0 ? 'teamB' : 'halved'
    });
  }

  const net = teamATotal - teamBTotal;
  return {
    subType: 'vegas2v2',
    scoringMode: isNet ? 'net' : 'gross',
    holeByHole,
    finalScore: {
      teamATotal,
      teamBTotal,
      leader: net > 0 ? 'teamA' : net < 0 ? 'teamB' : 'tied',
      margin: Math.abs(net)
    }
  };
}

function calcVegas1v1(entryMap, holeOrder, isNet, vegasConfig) {
  const playerAId = vegasConfig.players?.playerA;
  const playerBId = vegasConfig.players?.playerB;
  const entryA = entryMap[playerAId];
  const entryB = entryMap[playerBId];

  if (!entryA || !entryB) {
    return {
      subType: 'vegas1v1',
      scoringMode: isNet ? 'net' : 'gross',
      holeByHole: [],
      finalScore: { playerATotal: 0, playerBTotal: 0, leader: 'tied', margin: 0 }
    };
  }

  // Group holes into consecutive pairs; lone final hole stands alone
  const superHoles = [];
  for (let i = 0; i < holeOrder.length; i += 2) {
    if (i + 1 < holeOrder.length) {
      superHoles.push([holeOrder[i], holeOrder[i + 1]]);
    } else {
      superHoles.push([holeOrder[i]]);
    }
  }

  const holeByHole = [];
  let playerATotal = 0;
  let playerBTotal = 0;

  for (let si = 0; si < superHoles.length; si++) {
    const holes = superHoles[si];
    const superHoleNum = si + 1;

    if (holes.length === 1) {
      // Lone final hole — compare raw scores, no Vegas number
      const holeNum = holes[0];
      const scoreA = getEffectiveScore(getRawScore(entryA, holeNum), holeNum, entryA.strokeHoles || {}, isNet);
      const scoreB = getEffectiveScore(getRawScore(entryB, holeNum), holeNum, entryB.strokeHoles || {}, isNet);

      if (scoreA === null || scoreB === null) {
        holeByHole.push({
          superHole: superHoleNum, holes,
          playerA: { vegasNumber: null, uid: playerAId, scores: [scoreA] },
          playerB: { vegasNumber: null, uid: playerBId, scores: [scoreB] },
          margin: null, runningTotal: playerATotal - playerBTotal, status: 'pending'
        });
        continue;
      }

      // For a lone hole, the "Vegas number" is just the score itself
      const margin = scoreB - scoreA;
      if (margin > 0) playerATotal += margin;
      else if (margin < 0) playerBTotal += Math.abs(margin);

      holeByHole.push({
        superHole: superHoleNum, holes,
        playerA: { vegasNumber: scoreA, uid: playerAId, scores: [scoreA] },
        playerB: { vegasNumber: scoreB, uid: playerBId, scores: [scoreB] },
        margin,
        runningTotal: playerATotal - playerBTotal,
        status: margin > 0 ? 'playerA' : margin < 0 ? 'playerB' : 'halved'
      });
    } else {
      const [h1, h2] = holes;
      const getScore = (entry, h) =>
        getEffectiveScore(getRawScore(entry, h), h, entry.strokeHoles || {}, isNet);

      const aScore1 = getScore(entryA, h1);
      const aScore2 = getScore(entryA, h2);
      const bScore1 = getScore(entryB, h1);
      const bScore2 = getScore(entryB, h2);

      if (aScore1 === null || aScore2 === null || bScore1 === null || bScore2 === null) {
        holeByHole.push({
          superHole: superHoleNum, holes,
          playerA: { vegasNumber: null, uid: playerAId, scores: [aScore1, aScore2] },
          playerB: { vegasNumber: null, uid: playerBId, scores: [bScore1, bScore2] },
          margin: null, runningTotal: playerATotal - playerBTotal, status: 'pending'
        });
        continue;
      }

      const vegasA = buildVegasNumber(aScore1, aScore2);
      const vegasB = buildVegasNumber(bScore1, bScore2);
      const margin = vegasB - vegasA;

      if (margin > 0) playerATotal += margin;
      else if (margin < 0) playerBTotal += Math.abs(margin);

      holeByHole.push({
        superHole: superHoleNum, holes,
        playerA: { vegasNumber: vegasA, uid: playerAId, scores: [aScore1, aScore2] },
        playerB: { vegasNumber: vegasB, uid: playerBId, scores: [bScore1, bScore2] },
        margin,
        runningTotal: playerATotal - playerBTotal,
        status: margin > 0 ? 'playerA' : margin < 0 ? 'playerB' : 'halved'
      });
    }
  }

  const net = playerATotal - playerBTotal;
  return {
    subType: 'vegas1v1',
    scoringMode: isNet ? 'net' : 'gross',
    holeByHole,
    finalScore: {
      playerATotal,
      playerBTotal,
      leader: net > 0 ? 'playerA' : net < 0 ? 'playerB' : 'tied',
      margin: Math.abs(net)
    }
  };
}

/**
 * Builds player entries for calculateVegasResults() from raw event data.
 * Always builds individual player entries (Vegas teams are defined in the config, not here).
 * Used by EventLobbyView at event finalization.
 *
 * @param {Object} currentEvent - Full event object from Firebase
 * @returns {Array} entries suitable for calculateVegasResults()
 */
export function buildVegasEntries(currentEvent) {
  const meta = currentEvent.meta || {};
  const players = currentEvent.players || {};
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
