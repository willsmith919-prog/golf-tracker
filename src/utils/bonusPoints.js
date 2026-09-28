import { buildHoleOrder } from './holes';

// ============================================================
// BONUS POINTS
// Tap-to-award extras during a round — chip-ins, sandies, greenies.
//
// Definitions live on the league/series points config and are
// snapshotted onto each event (receipt model):
//   events/{id}/meta/leaguePoints/bonusPoints = [{ id, name, points }]
//
// Awards are stored on the individual player (even in team formats),
// written directly when someone taps a bonus button:
//   events/{id}/players/{uid}/bonuses/{holeNum}/{bonusId} = true
// ============================================================

export const BONUS_PRESETS = [
  { name: 'Chip-in', points: 2 },
  { name: 'Sandy', points: 1 },
  { name: 'Greenie', points: 1 },
  { name: 'Hole-in-one', points: 10 },
  { name: 'Long putt', points: 1 }
];

export function newBonus(name = 'Chip-in', points = 2) {
  return { id: `bonus-${Date.now()}`, name, points };
}

/**
 * Totals bonus awards for one event. Pure function.
 * @returns {{ byPlayer: { uid: { bonusId: pts } }, counts: { uid: { bonusId: count } } }}
 */
export function calculateBonusPoints(currentEvent, bonusDefs = []) {
  const meta = currentEvent?.meta || {};
  const holeOrder = buildHoleOrder(meta.numHoles || 18, meta.startingHole || 1);
  const byPlayer = {};
  const counts = {};
  if (bonusDefs.length === 0) return { byPlayer, counts };

  for (const [uid, player] of Object.entries(currentEvent?.players || {})) {
    if (uid.startsWith('guest-') || !player.bonuses) continue;
    for (const holeNum of holeOrder) {
      const awards = player.bonuses[holeNum];
      if (!awards) continue;
      for (const def of bonusDefs) {
        if (!awards[def.id]) continue;
        if (!counts[uid]) counts[uid] = {};
        if (!byPlayer[uid]) byPlayer[uid] = {};
        counts[uid][def.id] = (counts[uid][def.id] || 0) + 1;
        byPlayer[uid][def.id] = (byPlayer[uid][def.id] || 0) + (Number(def.points) || 0);
      }
    }
  }
  return { byPlayer, counts };
}
