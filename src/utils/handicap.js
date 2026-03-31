/**
 * Calculates a player's Course Handicap using the USGA formula:
 *   Course Handicap = (Handicap Index × Slope / 113) + (Course Rating − Par)
 *
 * Falls back to the raw handicap index if slope/rating are not available
 * (older events that were created before those fields were added).
 *
 * @param {number|null} playerHandicap  - The player's handicap index
 * @param {object} options
 * @param {boolean} options.handicapEnabled
 * @param {number|null} options.courseSlope
 * @param {number|null} options.courseRating
 * @param {number} options.coursePar       - Total par for the course
 * @param {number} options.handicapAllowance - Percentage to apply (e.g. 80 = 80%), defaults to 100
 * @returns {number} Rounded course handicap (0 if disabled or no handicap)
 */
export function getPlayerCourseHandicap(playerHandicap, {
  handicapEnabled,
  courseSlope,
  courseRating,
  coursePar,
  handicapAllowance = 100
}) {
  if (!handicapEnabled || playerHandicap == null) return 0;

  let courseHandicap;
  if (courseSlope && courseRating) {
    courseHandicap = (playerHandicap * courseSlope / 113) + (courseRating - coursePar);
  } else {
    courseHandicap = playerHandicap;
  }

  return Math.round(courseHandicap * (handicapAllowance / 100));
}

/**
 * Returns a map of { holeNumber: strokesReceived } for a given course handicap.
 * Strokes are allocated by stroke index order (lowest SI = gets strokes first).
 *
 * @param {number} courseHandicap       - From getPlayerCourseHandicap()
 * @param {object} options
 * @param {boolean} options.handicapEnabled
 * @param {number[]} options.courseStrokeIndexes - Array of stroke indexes, one per hole (index 0 = hole 1)
 * @returns {object} e.g. { 3: 1, 12: 1 } means holes 3 and 12 each give 1 stroke
 */
export function getStrokeHoles(courseHandicap, { handicapEnabled, courseStrokeIndexes }) {
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

/**
 * Subtracts handicap strokes from a gross score on a given hole.
 *
 * @param {number} grossScore
 * @param {number} holeNum
 * @param {object} strokeHoles - From getStrokeHoles()
 * @param {boolean} handicapEnabled
 * @returns {number} Net score for the hole
 */
export function getNetScore(grossScore, holeNum, strokeHoles, handicapEnabled) {
  if (!handicapEnabled || !grossScore) return grossScore;
  return grossScore - (strokeHoles[holeNum] || 0);
}
