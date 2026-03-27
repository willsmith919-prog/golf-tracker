// ============================================================
// LEAGUE POINTS UTILITY
// Calculates league points based on finishing position and
// writes updated standings to the league's active season.
//
// Used by:
//   - EventLobbyView (when host clicks "End Event")
//   - LiveLeaderboard (for projecting "if round ended now")
//
// Key concepts:
//   - "leaguePoints" config lives on each event's meta
//   - "standings" live at leagues/{leagueId}/seasons/{seasonId}/standings
//   - Each standing entry: { points: total, events: { eventId: pointsEarned } }
// ============================================================

import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';

/**
 * Given the sorted leaderboard data and the event's leaguePoints config,
 * returns a map of { odlayerId/teamId → pointsEarned }.
 *
 * This is a PURE function — no Firebase reads/writes. Used by both
 * the "write standings" flow and the "project standings" display.
 *
 * @param {Array} leaderboardData - sorted array of entries, each with:
 *   { id, position, holesPlayed, displayName }
 *   For team format, id = teamId. For individual, id = odlayerId.
 * @param {Object} leaguePoints - the event's meta.leaguePoints config:
 *   { positions: { 1: 25, 2: 20, ... }, participationPoints: 5, teamPointDistribution: 'full'|'split' }
 * @param {Object} teams - the event's teams object (only needed for team formats)
 * @param {number} teamSize - the event's meta.teamSize
 * @returns {Object} map of odlayerId → points earned (always keyed by individual player UIDs)
 */
export function calculateEventPoints(leaderboardData, leaguePoints, teams = {}, teamSize = 1) {
  if (!leaguePoints || !leaguePoints.positions) return {};

  const positions = leaguePoints.positions;
  const participationPoints = leaguePoints.participationPoints || 0;
  const isTeamFormat = teamSize > 1;
  const distribution = leaguePoints.teamPointDistribution || 'full';

  const playerPoints = {};

  for (const entry of leaderboardData) {
    // Only award points to entries that have actually played at least one hole
    if (entry.holesPlayed === 0) continue;

    // Look up position points — positions are stored as string keys ("1", "2", etc.)
    const positionKey = String(entry.position);
    const posPoints = positions[positionKey] || 0;
    const totalPointsForPosition = posPoints + participationPoints;

    if (isTeamFormat) {
      // Get the member UIDs from the team
      const team = teams[entry.id];
      const memberUids = team?.members ? Object.keys(team.members) : [];

      for (const uid of memberUids) {
        if (distribution === 'split' && memberUids.length > 0) {
          playerPoints[uid] = Math.round((totalPointsForPosition / memberUids.length) * 10) / 10;
        } else {
          // 'full' — each member gets the full points
          playerPoints[uid] = totalPointsForPosition;
        }
      }
    } else {
      // Individual format — id IS the player's UID
      playerPoints[entry.id] = totalPointsForPosition;
    }
  }

  return playerPoints;
}

/**
 * Writes league points to the season standings in Firebase.
 * Called when the host ends an event that has leaguePoints configured.
 *
 * This overwrites any previous points for this event (safe to call
 * multiple times, e.g. if the host reopens and re-ends the event).
 *
 * @param {string} leagueId - the league's ID
 * @param {string} seasonId - the active season's ID
 * @param {string} eventId - the event's ID
 * @param {Object} playerPoints - map of { uid → pointsEarned } from calculateEventPoints
 */
export async function writeStandingsToFirebase(leagueId, seasonId, eventId, playerPoints) {
  if (!leagueId || !seasonId || !eventId) {
    console.error('writeStandingsToFirebase: missing leagueId, seasonId, or eventId');
    return;
  }

  const standingsRef = ref(database, `leagues/${leagueId}/seasons/${seasonId}/standings`);

  try {
    // Read current standings
    const snapshot = await get(standingsRef);
    const currentStandings = snapshot.val() || {};

    // Update standings for each player
    for (const [uid, pointsEarned] of Object.entries(playerPoints)) {
      const playerStanding = currentStandings[uid] || { points: 0, events: {} };

      // Subtract any previous points from THIS event (in case of re-finalization)
      const previousPointsForEvent = playerStanding.events?.[eventId] || 0;
      const basePoints = (playerStanding.points || 0) - previousPointsForEvent;

      // Add the new points
      playerStanding.points = basePoints + pointsEarned;
      playerStanding.events = playerStanding.events || {};
      playerStanding.events[eventId] = pointsEarned;

      currentStandings[uid] = playerStanding;
    }

    // Write back the full standings object
    await set(standingsRef, currentStandings);
    console.log('League standings updated successfully');
  } catch (error) {
    console.error('Error writing league standings:', error);
    throw error;
  }
}

/**
 * Convenience function: given a full event object, calculates points
 * and writes standings in one call. Used by "End Event" flow.
 *
 * @param {Object} currentEvent - the full event object (with .id, .meta, .players, .teams)
 * @param {Array} leaderboardData - the sorted leaderboard array (from LiveLeaderboard's sorting logic)
 */
export async function finalizeEventStandings(currentEvent, leaderboardData) {
  const meta = currentEvent.meta || {};
  const leaguePoints = meta.leaguePoints;
  const leagueId = meta.leagueId;
  const seasonId = meta.seasonId;

  if (!leaguePoints || !leagueId || !seasonId) {
    // Not a league event or no points config — nothing to do
    return;
  }

  const playerPoints = calculateEventPoints(
    leaderboardData,
    leaguePoints,
    currentEvent.teams || {},
    meta.teamSize || 1
  );

  await writeStandingsToFirebase(leagueId, seasonId, currentEvent.id, playerPoints);
}
