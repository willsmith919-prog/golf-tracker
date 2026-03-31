/**
 * Sorts leaderboard entries in place according to the event's scoring method.
 *
 * Sort priority:
 *   - Entries with no holes played always go last
 *   - Stableford: highest points first
 *   - Net (handicap enabled + primarySort='net'): lowest netToPar first, toPar as tiebreaker
 *   - Gross (default): lowest toPar first, totalScore as tiebreaker
 *
 * @param {object[]} entries          - Array of leaderboard entry objects
 * @param {object} options
 * @param {string} options.scoringMethod   - e.g. 'stableford', 'stroke'
 * @param {string} options.primarySort     - 'net' or 'gross'
 * @param {boolean} options.handicapEnabled
 * @returns {object[]} The same array, sorted in place
 */
export function sortLeaderboard(entries, { scoringMethod, primarySort, handicapEnabled }) {
  entries.sort((a, b) => {
    if (a.holesPlayed === 0 && b.holesPlayed > 0) return 1;
    if (b.holesPlayed === 0 && a.holesPlayed > 0) return -1;
    if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;

    if (scoringMethod === 'stableford') {
      return b.stablefordPoints - a.stablefordPoints;
    }

    if (primarySort === 'net' && handicapEnabled) {
      if (a.netToPar !== b.netToPar) return a.netToPar - b.netToPar;
      return a.toPar - b.toPar;
    }

    if (a.toPar !== b.toPar) return a.toPar - b.toPar;
    return a.totalScore - b.totalScore;
  });
  return entries;
}

/**
 * Assigns position numbers to a sorted leaderboard, handling ties correctly.
 * Mutates entries in place, adding a `position` field to each.
 * Entries with no holes played receive position '-'.
 *
 * Must be called AFTER sortLeaderboard().
 *
 * @param {object[]} entries          - Sorted array of leaderboard entry objects
 * @param {object} options
 * @param {string} options.scoringMethod   - e.g. 'stableford', 'stroke'
 * @param {string} options.primarySort     - 'net' or 'gross'
 * @param {boolean} options.handicapEnabled
 * @returns {object[]} The same array with position fields added
 */
export function assignPositions(entries, { primarySort, handicapEnabled, scoringMethod }) {
  let position = 1;
  entries.forEach((entry, index) => {
    if (index === 0 || entry.holesPlayed === 0) {
      entry.position = entry.holesPlayed === 0 ? '-' : position;
    } else {
      const prev = entries[index - 1];
      const sameScore = primarySort === 'net' && handicapEnabled
        ? entry.netToPar === prev.netToPar
        : scoringMethod === 'stableford'
          ? entry.stablefordPoints === prev.stablefordPoints
          : entry.toPar === prev.toPar;

      entry.position = (sameScore && prev.holesPlayed > 0) ? prev.position : index + 1;
    }
    position = (typeof entry.position === 'number' ? entry.position : position) + 1;
  });
  return entries;
}
