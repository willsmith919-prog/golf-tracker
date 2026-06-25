// Wolf scoring utility
// Handles best-ball and scramble wolf point calculation.

/**
 * Returns the UID of the Wolf on a given hole.
 * Rotation is 0-indexed: hole 1 → playerOrder[0], hole 2 → playerOrder[1], etc.
 */
export function getWolfOnHole(holeNum, playerOrder) {
  if (!playerOrder || playerOrder.length === 0) return null;
  return playerOrder[(holeNum - 1) % playerOrder.length];
}

/**
 * Returns the wolf side and opposing side for a given hole.
 * wolfHolesData[holeNum].partnerIds = array of partner UIDs (empty = lone wolf).
 */
export function getWolfSides(holeNum, playerOrder, wolfHolesData) {
  const wolfId = getWolfOnHole(holeNum, playerOrder);
  if (!wolfId) return { wolfSide: [], oppSide: [] };

  const holeKey = String(holeNum);
  const partnerIds = wolfHolesData?.[holeKey]?.partnerIds ?? wolfHolesData?.[holeNum]?.partnerIds ?? [];
  const wolfSide = [wolfId, ...partnerIds];
  const oppSide = playerOrder.filter(uid => !wolfSide.includes(uid));
  return { wolfSide, oppSide };
}

/**
 * Calculates the result for a single hole.
 *
 * variant: 'bestball' | 'scramble'
 * - bestball: compares min(wolfSide scores) vs min(oppSide scores) from playerScores
 * - scramble: compares wolfHolesData[holeNum].wolfSideScore vs oppSideScore
 *
 * Returns: { wolfWon: bool, tied: bool, wolfScore: number|null, oppScore: number|null }
 */
export function calcWolfHoleResult(wolfSide, oppSide, playerScores, wolfHolesData, holeNum, variant) {
  let wolfScore = null;
  let oppScore = null;

  // Firebase stores keys as strings; accept both number and string holeNum
  const holeKey = String(holeNum);

  if (variant === 'scramble') {
    wolfScore = wolfHolesData?.[holeKey]?.wolfSideScore ?? wolfHolesData?.[holeNum]?.wolfSideScore ?? null;
    oppScore = wolfHolesData?.[holeKey]?.oppSideScore ?? wolfHolesData?.[holeNum]?.oppSideScore ?? null;
  } else {
    // bestball: best (lowest) score among each side's players
    const wolfScores = wolfSide
      .map(uid => playerScores?.[uid]?.[holeKey] ?? playerScores?.[uid]?.[holeNum])
      .filter(s => s != null && s > 0);
    const oppScores = oppSide
      .map(uid => playerScores?.[uid]?.[holeKey] ?? playerScores?.[uid]?.[holeNum])
      .filter(s => s != null && s > 0);

    if (wolfScores.length > 0) wolfScore = Math.min(...wolfScores);
    if (oppScores.length > 0) oppScore = Math.min(...oppScores);
  }

  if (wolfScore == null || oppScore == null) {
    return { wolfWon: null, tied: null, wolfScore, oppScore };
  }

  const wolfWon = wolfScore < oppScore;
  const tied = wolfScore === oppScore;
  return { wolfWon, tied, wolfScore, oppScore };
}

/**
 * Calculates wolf points totals for all players across all holes.
 *
 * wolfConfig: { pointsPerHoleWon, pointsPerHoleLost, loneWolfBonus, blindWolfBonus }
 * playerScores: { uid: { holeNum: score } } — used for bestball variant
 * wolfHolesData: { holeNum: { partnerIds, isBlindWolf, wolfSideScore, oppSideScore } }
 *
 * Returns: { uid: { points, holesAsWolf, holesWon, holesLost } }
 */
export function calcWolfTotals(holeOrder, playerOrder, playerScores, wolfHolesData, wolfConfig, variant) {
  if (!playerOrder || playerOrder.length === 0) return {};

  const {
    pointsPerHoleWon = 1,
    pointsPerHoleLost = 1,
    loneWolfBonus = 1,
    blindWolfBonus = 2
  } = wolfConfig || {};

  const totals = {};
  for (const uid of playerOrder) {
    totals[uid] = { points: 0, holesAsWolf: 0, holesWon: 0, holesLost: 0 };
  }

  for (const holeNum of holeOrder) {
    const { wolfSide, oppSide } = getWolfSides(holeNum, playerOrder, wolfHolesData);
    if (wolfSide.length === 0) continue;

    const wolfId = wolfSide[0];
    const hKey = String(holeNum);
    const isBlindWolf = wolfHolesData?.[hKey]?.isBlindWolf === true || wolfHolesData?.[holeNum]?.isBlindWolf === true;
    const isLoneWolf = wolfSide.length === 1;

    const { wolfWon, tied } = calcWolfHoleResult(wolfSide, oppSide, playerScores, wolfHolesData, holeNum, variant);
    if (wolfWon == null) continue; // scores not yet entered

    if (totals[wolfId]) totals[wolfId].holesAsWolf++;

    if (tied) continue; // no points change on a tie

    // Determine multiplier
    let multiplier = 1;
    if (isLoneWolf) multiplier = loneWolfBonus;
    if (isBlindWolf) multiplier = isLoneWolf ? blindWolfBonus + loneWolfBonus : blindWolfBonus;

    const winPts = pointsPerHoleWon * multiplier;
    const losePts = pointsPerHoleLost * multiplier;

    if (wolfWon) {
      for (const uid of wolfSide) {
        if (totals[uid]) { totals[uid].points += winPts; totals[uid].holesWon++; }
      }
      for (const uid of oppSide) {
        if (totals[uid]) { totals[uid].points -= losePts; totals[uid].holesLost++; }
      }
    } else {
      for (const uid of wolfSide) {
        if (totals[uid]) { totals[uid].points -= losePts; totals[uid].holesLost++; }
      }
      for (const uid of oppSide) {
        if (totals[uid]) { totals[uid].points += winPts; totals[uid].holesWon++; }
      }
    }
  }

  return totals;
}
