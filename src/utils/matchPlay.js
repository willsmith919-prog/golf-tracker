/**
 * Calculates hole-by-hole match play results for a 2-player match.
 * When entries have strokeHoles computed (handicap match), net scores are used
 * for hole comparisons and stroke allocations are stored per hole for display.
 *
 * @param {Array}  entries   - Exactly 2 leaderboard entries with { id, scores, holes, strokeHoles }
 * @param {Array}  holeOrder - Ordered hole numbers for the round
 * @returns {Object|null}
 *   holeResults: [{ holeNum, status, winnerId, balance, grossScores, netScores, strokes }]
 *   balance, holesUp, leaderId, trailerId, holesPlayed, holesRemaining, matchOutcome
 */
export function calculateMatchPlay(entries, holeOrder) {
  if (entries.length !== 2) return null;

  const [p1, p2] = entries;
  const holeResults = [];
  let balance = 0;

  // Determine if either player has handicap strokes — if so, compare net scores
  const hasHandicap = !!(p1.strokeHoles && Object.keys(p1.strokeHoles).length > 0)
                   || !!(p2.strokeHoles && Object.keys(p2.strokeHoles).length > 0);

  for (const holeNum of holeOrder) {
    const g1 = p1.scores?.[holeNum] || p1.holes?.[holeNum]?.score || null;
    const g2 = p2.scores?.[holeNum] || p2.holes?.[holeNum]?.score || null;
    const str1 = p1.strokeHoles?.[holeNum] || 0;
    const str2 = p2.strokeHoles?.[holeNum] || 0;

    const grossScores = { [p1.id]: g1, [p2.id]: g2 };
    const strokes     = { [p1.id]: str1, [p2.id]: str2 };

    if (!g1 || g1 <= 0 || !g2 || g2 <= 0) {
      holeResults.push({ holeNum, status: 'pending', winnerId: null, balance, grossScores, netScores: { [p1.id]: null, [p2.id]: null }, strokes });
      continue;
    }

    const n1 = g1 - str1;
    const n2 = g2 - str2;
    const netScores = { [p1.id]: n1, [p2.id]: n2 };

    // Compare net scores when handicap is in play, gross otherwise
    const cmp1 = hasHandicap ? n1 : g1;
    const cmp2 = hasHandicap ? n2 : g2;

    if (cmp1 < cmp2) {
      balance++;
      holeResults.push({ holeNum, status: 'won', winnerId: p1.id, balance, grossScores, netScores, strokes });
    } else if (cmp2 < cmp1) {
      balance--;
      holeResults.push({ holeNum, status: 'won', winnerId: p2.id, balance, grossScores, netScores, strokes });
    } else {
      holeResults.push({ holeNum, status: 'halved', winnerId: null, balance, grossScores, netScores, strokes });
    }
  }

  const totalHoles = holeOrder.length;
  const holesPlayed = holeResults.filter(h => h.status !== 'pending').length;
  const holesRemaining = totalHoles - holesPlayed;
  const holesUp = Math.abs(balance);
  const leaderId  = balance > 0 ? p1.id : balance < 0 ? p2.id : null;
  const trailerId = balance > 0 ? p2.id : balance < 0 ? p1.id : null;

  let matchOutcome;
  if (holesPlayed === 0) {
    matchOutcome = 'not_started';
  } else if (holesUp > holesRemaining) {
    matchOutcome = 'won';
  } else if (holesRemaining === 0) {
    matchOutcome = holesUp === 0 ? 'halved' : 'won';
  } else if (holesUp > 0 && holesUp === holesRemaining) {
    matchOutcome = 'dormie';
  } else if (holesUp === 0) {
    matchOutcome = 'all_square';
  } else {
    matchOutcome = 'leading';
  }

  return { holeResults, balance, holesUp, leaderId, trailerId, holesPlayed, holesRemaining, matchOutcome, hasHandicap };
}
