/**
 * Builds the ordered list of hole numbers for a round, handling wrap-around
 * when the starting hole is not hole 1 (e.g. starting on hole 10).
 *
 * Examples:
 *   buildHoleOrder(18, 1)  → [1, 2, 3, ..., 18]
 *   buildHoleOrder(18, 10) → [10, 11, ..., 18, 1, 2, ..., 9]
 *   buildHoleOrder(9, 1)   → [1, 2, ..., 9]
 */
export function buildHoleOrder(numHoles, startingHole) {
  const holes = [];
  for (let i = 0; i < numHoles; i++) {
    holes.push(((startingHole - 1 + i) % 18) + 1);
  }
  return holes;
}
