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
//   - Guests (isGuest: true) and non-league members never receive points
//   - nonLeagueHandling: "skip" = position points vanish; "award_around" = next league member gets them
// ============================================================

import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';

/**
 * Given the sorted leaderboard data and the event's leaguePoints config,
 * returns a map of { playerId → pointsEarned }.
 *
 * This is a PURE function — no Firebase reads/writes. Used by both
 * the "write standings" flow and the "project standings" display.
 *
 * @param {Array} leaderboardData - sorted array of entries, each with:
 *   { id, position, holesPlayed }
 *   For team format, id = teamId. For individual, id = playerId.
 * @param {Object} leaguePoints - the event's meta.leaguePoints config:
 *   { positions, participationPoints, teamPointDistribution, nonLeagueHandling }
 * @param {Object} teams - the event's teams object (only needed for team formats)
 * @param {number} teamSize - the event's meta.teamSize
 * @param {Object} players - the event's players object (to check isGuest flag)
 * @param {Object} leagueMembers - the league's members object (to check membership).
 *   If null/undefined, all non-guest players are treated as league members.
 * @returns {Object} map of playerId → points earned (only league members get points)
 */
export function calculateEventPoints(leaderboardData, leaguePoints, teams = {}, teamSize = 1, players = {}, leagueMembers = null) {
  if (!leaguePoints || !leaguePoints.positions) return {};

  const positions = leaguePoints.positions;
  const participationPoints = leaguePoints.participationPoints || 0;
  const isTeamFormat = teamSize > 1;
  const distribution = leaguePoints.teamPointDistribution || 'full';
  const nonLeagueHandling = leaguePoints.nonLeagueHandling || 'skip';

  // Helper: is this player UID a league member?
  // Guests (uid starts with "guest-") are never league members.
  // If leagueMembers is provided, check membership. Otherwise, treat all non-guests as members.
  const isLeagueMember = (uid) => {
    if (!uid || uid.startsWith('guest-')) return false;
    if (!leagueMembers) return true; // No members list = assume all are members
    return !!leagueMembers[uid];
  };

  const playerPoints = {};

  if (!isTeamFormat && nonLeagueHandling === 'award_around') {
    // INDIVIDUAL + AWARD AROUND:
    // Walk through the sorted leaderboard. For each league-eligible entry,
    // assign the next available position's points.
    let leaguePosition = 1;

    for (const entry of leaderboardData) {
      if (entry.holesPlayed === 0) continue;
      if (!isLeagueMember(entry.id)) continue;

      const positionKey = String(leaguePosition);
      const posPoints = positions[positionKey] || 0;
      playerPoints[entry.id] = posPoints + participationPoints;
      leaguePosition++;
    }
  } else if (!isTeamFormat && nonLeagueHandling === 'skip') {
    // INDIVIDUAL + SKIP:
    // Use the original positions. If a non-league player holds a position,
    // those points are not awarded.
    for (const entry of leaderboardData) {
      if (entry.holesPlayed === 0) continue;
      if (!isLeagueMember(entry.id)) continue;

      const positionKey = String(entry.position);
      const posPoints = positions[positionKey] || 0;
      playerPoints[entry.id] = posPoints + participationPoints;
    }
  } else if (isTeamFormat) {
    // TEAM FORMAT:
    // Points go to the team's position. Only league members on the team receive points.
    // Non-league members / guests on the team are simply excluded from receiving points.
    //
    // For nonLeagueHandling in team formats:
    //   - If the entire team is non-league, they don't get points (either mode).
    //   - If the team has a mix, only league members get points.
    //   - "award_around" applies to fully non-league teams: the next position
    //     bumps up for fully-league teams.

    if (nonLeagueHandling === 'award_around') {
      let leaguePosition = 1;

      for (const entry of leaderboardData) {
        if (entry.holesPlayed === 0) continue;

        const team = teams[entry.id];
        const memberUids = team?.members ? Object.keys(team.members) : [];
        const leagueMembersOnTeam = memberUids.filter(uid => isLeagueMember(uid));

        if (leagueMembersOnTeam.length === 0) continue;

        const positionKey = String(leaguePosition);
        const posPoints = positions[positionKey] || 0;
        const totalPointsForPosition = posPoints + participationPoints;

        for (const uid of leagueMembersOnTeam) {
          if (distribution === 'split') {
            playerPoints[uid] = Math.round((totalPointsForPosition / leagueMembersOnTeam.length) * 10) / 10;
          } else {
            playerPoints[uid] = totalPointsForPosition;
          }
        }

        leaguePosition++;
      }
    } else {
      // SKIP mode for teams — use original positions
      for (const entry of leaderboardData) {
        if (entry.holesPlayed === 0) continue;

        const team = teams[entry.id];
        const memberUids = team?.members ? Object.keys(team.members) : [];
        const leagueMembersOnTeam = memberUids.filter(uid => isLeagueMember(uid));

        if (leagueMembersOnTeam.length === 0) continue;

        const positionKey = String(entry.position);
        const posPoints = positions[positionKey] || 0;
        const totalPointsForPosition = posPoints + participationPoints;

        for (const uid of leagueMembersOnTeam) {
          if (distribution === 'split') {
            playerPoints[uid] = Math.round((totalPointsForPosition / leagueMembersOnTeam.length) * 10) / 10;
          } else {
            playerPoints[uid] = totalPointsForPosition;
          }
        }
      }
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
 * @param {Object} leagueMembers - the league's members object
 */
export async function finalizeEventStandings(currentEvent, leaderboardData, leagueMembers = null) {
  const meta = currentEvent.meta || {};
  const leaguePoints = meta.leaguePoints;
  const leagueId = meta.leagueId;
  const seasonId = meta.seasonId;

  if (!leaguePoints || !leagueId || !seasonId) {
    return;
  }

  const playerPoints = calculateEventPoints(
    leaderboardData,
    leaguePoints,
    currentEvent.teams || {},
    meta.teamSize || 1,
    currentEvent.players || {},
    leagueMembers
  );

  await writeStandingsToFirebase(leagueId, seasonId, currentEvent.id, playerPoints);
}
