import { useState } from 'react';
import { ref, set, remove } from 'firebase/database';
import { database } from '../../firebase';

// ============================================================
// TEAM MANAGER COMPONENT
// Shown to the event host in the lobby when the event is "open".
// Lets the host assign registered players into teams.
//
// Props:
//   currentEvent  — the full event object
//   currentUser   — the logged-in user
//   setFeedback   — for showing success/error messages
// ============================================================

export default function TeamManager({ currentEvent, currentUser, setFeedback }) {
  const [teamNameEditing, setTeamNameEditing] = useState(null);
  const [teamNameValue, setTeamNameValue] = useState('');

  const eventId = currentEvent?.id;
  const players = currentEvent?.players || {};
  const teams = currentEvent?.teams || {};
  const meta = currentEvent?.meta || {};
  const teamSize = meta.teamSize || 2;

  // ==================== HELPER: FIND WHICH TEAM A PLAYER IS ON ====================
  // Returns the teamId if the player is already assigned, or null if unassigned.

  const getPlayerTeamId = (playerId) => {
    for (const [teamId, team] of Object.entries(teams)) {
      if (team.members && team.members[playerId]) {
        return teamId;
      }
    }
    return null;
  };

  // ==================== BUILD LISTS ====================

  // All players in the event
  const allPlayers = Object.entries(players).map(([uid, data]) => ({
    uid,
    ...data
  }));

  // Players NOT yet assigned to any team
  const unassignedPlayers = allPlayers.filter(p => !getPlayerTeamId(p.uid));

  // Teams as an array, sorted by creation order
  const teamsArray = Object.entries(teams).map(([teamId, data]) => ({
    teamId,
    ...data,
    // Resolve member details from the players node
    memberDetails: Object.keys(data.members || {}).map(uid => ({
      uid,
      displayName: players[uid]?.displayName || 'Unknown',
      handicap: players[uid]?.handicap
    }))
  })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  // ==================== CREATE A NEW TEAM ====================

  const createTeam = async () => {
    const teamNumber = teamsArray.length + 1;
    const teamId = `team-${Date.now()}`;

    try {
      await set(ref(database, `events/${eventId}/teams/${teamId}`), {
        name: `Team ${teamNumber}`,
        members: {},
        createdAt: Date.now()
      });
    } catch (error) {
      console.error('Error creating team:', error);
      setFeedback('Error creating team');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // ==================== ADD PLAYER TO TEAM ====================

  const addPlayerToTeam = async (playerId, teamId) => {
    const team = teams[teamId];
    const currentMembers = Object.keys(team?.members || {});

    if (currentMembers.length >= teamSize) {
      setFeedback(`Team is full (max ${teamSize} players)`);
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    // Make sure the player isn't already on another team
    const existingTeam = getPlayerTeamId(playerId);
    if (existingTeam) {
      setFeedback('Player is already on a team');
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    try {
      await set(ref(database, `events/${eventId}/teams/${teamId}/members/${playerId}`), true);
    } catch (error) {
      console.error('Error adding player to team:', error);
      setFeedback('Error adding player');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // ==================== REMOVE PLAYER FROM TEAM ====================

  const removePlayerFromTeam = async (playerId, teamId) => {
    try {
      await remove(ref(database, `events/${eventId}/teams/${teamId}/members/${playerId}`));
    } catch (error) {
      console.error('Error removing player:', error);
      setFeedback('Error removing player');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // ==================== DELETE A TEAM ====================

  const deleteTeam = async (teamId) => {
    if (!confirm('Delete this team? Players will be moved back to unassigned.')) return;

    try {
      await remove(ref(database, `events/${eventId}/teams/${teamId}`));
    } catch (error) {
      console.error('Error deleting team:', error);
      setFeedback('Error deleting team');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // ==================== RENAME A TEAM ====================

  const startRenaming = (teamId, currentName) => {
    setTeamNameEditing(teamId);
    setTeamNameValue(currentName);
  };

  const saveTeamName = async (teamId) => {
    const trimmed = teamNameValue.trim();
    if (!trimmed) return;

    try {
      await set(ref(database, `events/${eventId}/teams/${teamId}/name`), trimmed);
      setTeamNameEditing(null);
      setTeamNameValue('');
    } catch (error) {
      console.error('Error renaming team:', error);
      setFeedback('Error renaming team');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // ==================== AUTO-CREATE TEAMS ====================
  // Convenience button: creates enough teams and randomly assigns all players.

  const autoAssignTeams = async () => {
    if (allPlayers.length < 2) {
      setFeedback('Need at least 2 players to auto-assign');
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    if (Object.keys(teams).length > 0) {
      if (!confirm('This will replace all existing teams. Continue?')) return;
    }

    // Shuffle players randomly
    const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);

    // Create teams of teamSize
    const newTeams = {};
    let teamNum = 1;

    for (let i = 0; i < shuffled.length; i += teamSize) {
      const teamId = `team-${Date.now()}-${teamNum}`;
      const members = {};
      for (let j = i; j < i + teamSize && j < shuffled.length; j++) {
        members[shuffled[j].uid] = true;
      }
      newTeams[teamId] = {
        name: `Team ${teamNum}`,
        members,
        createdAt: Date.now() + teamNum // ensure unique timestamps for sorting
      };
      teamNum++;
    }

    try {
      // Replace all teams at once
      await set(ref(database, `events/${eventId}/teams`), newTeams);
      setFeedback('Teams auto-assigned!');
      setTimeout(() => setFeedback(''), 2000);
    } catch (error) {
      console.error('Error auto-assigning:', error);
      setFeedback('Error auto-assigning teams');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // ==================== RENDER ====================

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          Teams ({teamsArray.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={autoAssignTeams}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#f0f4ff] text-[#00285e] hover:bg-[#e8eef8] transition-all"
          >
            🎲 Auto-Assign
          </button>
          <button
            onClick={createTeam}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-all"
          >
            + New Team
          </button>
        </div>
      </div>

      {/* Unassigned Players */}
      {unassignedPlayers.length > 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
          <div className="text-sm font-semibold text-yellow-800 mb-2">
            Unassigned Players ({unassignedPlayers.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {unassignedPlayers.map(player => (
              <div
                key={player.uid}
                className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-yellow-300 shadow-sm"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                  player.role === 'host' ? 'bg-yellow-500' : 'bg-[#00285e]'
                }`}>
                  {(player.displayName || '?').charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {player.displayName}
                </span>
                {player.uid === currentUser?.uid && (
                  <span className="text-[10px] bg-[#f0f4ff] text-[#00285e] px-1.5 py-0.5 rounded-full">You</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams */}
      {teamsArray.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg mb-2">No teams created yet</p>
          <p className="text-sm">Click "+ New Team" or "Auto-Assign" to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {teamsArray.map((team) => (
            <div key={team.teamId} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              {/* Team Header */}
              <div className="flex items-center justify-between mb-3">
                {teamNameEditing === team.teamId ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <input
                      type="text"
                      value={teamNameValue}
                      onChange={(e) => setTeamNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTeamName(team.teamId);
                        if (e.key === 'Escape') setTeamNameEditing(null);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border-2 border-[#c8d6e5] focus:border-[#00285e] focus:outline-none text-sm font-semibold"
                      autoFocus
                    />
                    <button
                      onClick={() => saveTeamName(team.teamId)}
                      className="px-2 py-1 rounded text-xs font-semibold bg-[#00285e] text-white hover:bg-[#003a7d]"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setTeamNameEditing(null)}
                      className="px-2 py-1 rounded text-xs font-semibold bg-gray-200 text-gray-600 hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{team.name || 'Unnamed Team'}</h3>
                    <button
                      onClick={() => startRenaming(team.teamId, team.name || '')}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      ✏️
                    </button>
                    <span className="text-xs text-gray-500">
                      ({team.memberDetails.length}/{teamSize})
                    </span>
                  </div>
                )}

                <button
                  onClick={() => deleteTeam(team.teamId)}
                  className="text-xs text-red-400 hover:text-red-600 font-semibold"
                >
                  Delete
                </button>
              </div>

              {/* Team Members */}
              {team.memberDetails.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {team.memberDetails.map(member => (
                    <div key={member.uid} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          players[member.uid]?.role === 'host' ? 'bg-yellow-500' : 'bg-[#00285e]'
                        }`}>
                          {(member.displayName || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{member.displayName}</span>
                        {member.uid === currentUser?.uid && (
                          <span className="text-[10px] bg-[#f0f4ff] text-[#00285e] px-1.5 py-0.5 rounded-full">You</span>
                        )}
                        {member.handicap != null && (
                          <span className="text-xs text-gray-400">HCP: {member.handicap}</span>
                        )}
                      </div>
                      <button
                        onClick={() => removePlayerFromTeam(member.uid, team.teamId)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400 mb-3 text-center py-2">
                  No players assigned
                </div>
              )}

              {/* Add Player Dropdown — only show if team isn't full and there are unassigned players */}
              {team.memberDetails.length < teamSize && unassignedPlayers.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addPlayerToTeam(e.target.value, team.teamId);
                      e.target.value = ''; // reset dropdown
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 focus:border-[#00285e] focus:outline-none bg-white"
                >
                  <option value="">+ Add a player...</option>
                  {unassignedPlayers.map(player => (
                    <option key={player.uid} value={player.uid}>
                      {player.displayName}
                      {player.handicap != null ? ` (HCP: ${player.handicap})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {/* Full indicator */}
              {team.memberDetails.length >= teamSize && (
                <div className="text-xs text-green-600 font-semibold text-center">
                  ✓ Team full
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Validation Summary */}
      {teamsArray.length > 0 && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${
          unassignedPlayers.length > 0
            ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            : 'bg-green-50 border border-green-200 text-green-800'
        }`}>
          {unassignedPlayers.length > 0
            ? `⚠️ ${unassignedPlayers.length} player${unassignedPlayers.length > 1 ? 's' : ''} still need${unassignedPlayers.length === 1 ? 's' : ''} a team assignment`
            : '✅ All players assigned to teams!'
          }
        </div>
      )}
    </div>
  );
}
