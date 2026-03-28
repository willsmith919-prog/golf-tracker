import { ref, update, set, get, remove, onValue, off } from 'firebase/database';
import { useEffect, useState } from 'react';
import { database } from '../../firebase';
import LiveLeaderboard from '../scoring/LiveLeaderboard';
import TeamManager from './TeamManager';
import { calculateEventPoints, writeStandingsToFirebase } from '../../utils/leaguePoints';


export default function EventLobbyView({
  currentUser,
  currentEvent,
  setCurrentEvent,
  feedback,
  setFeedback,
  setView,
  setSelectedTeam
}) {
  // ==================== TAB STATE ====================
  // "lobby" = player list + host controls (default when event is "open")
  // "leaderboard" = live scores (default when event is "active" or "completed")
  // "teams" = team assignment (host only, when event is "open")
  const eventStatus = currentEvent.meta?.status || 'open';
  const [activeTab, setActiveTab] = useState(
    eventStatus === 'open' ? 'lobby' : 'leaderboard'
  );
  const [editingTeamName, setEditingTeamName] = useState(null);
  const [teamNameValue, setTeamNameValue] = useState('');

  // Listen for real-time updates to this event (so we see new players join live)
  useEffect(() => {
    if (!currentEvent?.id) return;

    const eventRef = ref(database, `events/${currentEvent.id}`);
    const listener = onValue(eventRef, (snapshot) => {
      const updatedEvent = snapshot.val();
      if (updatedEvent) {
        setCurrentEvent({ id: currentEvent.id, ...updatedEvent });
      }
    });

    // Clean up the listener when we leave this view
    return () => off(eventRef, 'value', listener);
  }, [currentEvent?.id]);

  // When event status changes to active, switch to leaderboard tab automatically
  useEffect(() => {
    if (eventStatus === 'active' && activeTab !== 'leaderboard') {
      setActiveTab('leaderboard');
    }
  }, [eventStatus]);

  // Build the players list from the event data
  const players = Object.entries(currentEvent.players || {}).map(([uid, data]) => ({
    uid,
    ...data
  }));

  const isHost = currentEvent.players?.[currentUser?.uid]?.role === 'host';
  const teams = currentEvent?.teams || {};
  const teamSize = currentEvent?.meta?.teamSize || 2;

  // ==================== TEAM HELPERS ====================

  // Is this a team format? (teamSize > 1) Does the format use Mulligans?
  const isTeamFormat = teamSize > 1;
  const usesMulligans = currentEvent?.meta?.handicap?.enabled && currentEvent?.meta?.handicap?.applicationMethod === 'mulligans';

  // Find the current user's team
  const findMyTeam = () => {
    for (const [teamId, team] of Object.entries(teams)) {
      if (team.members && team.members[currentUser?.uid]) {
        return teamId;
      }
    }
    return null;
  };

  const myTeamId = findMyTeam();

  // Check if all players are assigned to teams
  const allPlayersAssigned = () => {
    if (!isTeamFormat) return true; // Individual format, no teams needed
    
    const assignedPlayerIds = new Set();
    for (const team of Object.values(teams)) {
      for (const uid of Object.keys(team.members || {})) {
        assignedPlayerIds.add(uid);
      }
    }
    return players.every(p => assignedPlayerIds.has(p.uid));
  };

  // ==================== LEADERBOARD SORTING (for league points) ====================
  // Builds a sorted leaderboard from event data — same logic as LiveLeaderboard.
  // Used to determine finishing positions when the host ends a league event.
  const buildSortedLeaderboard = () => {
    const meta = currentEvent.meta || {};
    const evPlayers = currentEvent.players || {};
    const evTeams = currentEvent.teams || {};
    const coursePars = meta.coursePars || [];
    const evTeamSize = meta.teamSize || 1;
    const isTeam = evTeamSize > 1 && Object.keys(evTeams).length > 0;
    const evNumHoles = meta.numHoles || 18;
    const evStartingHole = meta.startingHole || 1;

    // Build hole order
    const holeOrd = [];
    for (let i = 0; i < evNumHoles; i++) {
      holeOrd.push(((evStartingHole - 1 + i) % 18) + 1);
    }

    let entries = [];

    if (isTeam) {
      entries = Object.entries(evTeams).map(([teamId, team]) => {
        const stats = team.stats || {};
        return {
          id: teamId,
          holesPlayed: stats.holesPlayed || 0,
          toPar: stats.toPar || 0,
          totalScore: stats.totalScore || 0,
          stablefordPoints: stats.stablefordPoints || 0,
          netToPar: stats.netToPar || 0
        };
      });
    } else {
      entries = Object.entries(evPlayers).map(([uid, player]) => {
        const stats = player.stats || {};
        return {
          id: uid,
          holesPlayed: stats.holesPlayed || 0,
          toPar: stats.toPar || 0,
          totalScore: stats.totalScore || 0,
          stablefordPoints: stats.stablefordPoints || 0,
          netToPar: stats.netToPar || 0
        };
      });
    }

    // Sort (same logic as LiveLeaderboard)
    const primarySort = meta.display?.primarySort || 'gross';
    const handicapEnabled = meta.handicap?.enabled || false;

    entries.sort((a, b) => {
      if (a.holesPlayed === 0 && b.holesPlayed > 0) return 1;
      if (b.holesPlayed === 0 && a.holesPlayed > 0) return -1;
      if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;

      if (meta.scoringMethod === 'stableford') {
        return b.stablefordPoints - a.stablefordPoints;
      }
      if (primarySort === 'net' && handicapEnabled) {
        if (a.netToPar !== b.netToPar) return a.netToPar - b.netToPar;
        return a.toPar - b.toPar;
      }
      if (a.toPar !== b.toPar) return a.toPar - b.toPar;
      return a.totalScore - b.totalScore;
    });

    // Assign positions (handling ties)
    let pos = 1;
    entries.forEach((entry, index) => {
      if (index === 0 || entry.holesPlayed === 0) {
        entry.position = entry.holesPlayed === 0 ? '-' : pos;
      } else {
        const prev = entries[index - 1];
        const sameScore = primarySort === 'net' && handicapEnabled
          ? entry.netToPar === prev.netToPar
          : meta.scoringMethod === 'stableford'
            ? entry.stablefordPoints === prev.stablefordPoints
            : entry.toPar === prev.toPar;

        if (sameScore && prev.holesPlayed > 0) {
          entry.position = prev.position;
        } else {
          entry.position = index + 1;
        }
      }
      pos = (typeof entry.position === 'number' ? entry.position : pos) + 1;
    });

    return entries;
  };



  // ==================== START EVENT ====================

  const startEvent = async () => {
    if (!isHost) return;

    // For team formats, just need at least one team with members ready to play.
    // Other players can join and be assigned to teams after the event starts.
    if (isTeamFormat) {
      const teamCount = Object.keys(teams).length;
      if (teamCount === 0) {
        setFeedback('Create at least one team before starting (use the Teams tab)');
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
      // Check that at least one team has members assigned
      const teamsWithMembers = Object.values(teams).filter(
        t => t.members && Object.keys(t.members).length > 0
      );
      if (teamsWithMembers.length === 0) {
        setFeedback('Assign players to at least one team before starting');
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
    } else {
      // Individual format: need at least 2 players
      if (players.length < 2) {
        setFeedback('Need at least 2 players to start');
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
    }

    try {
      await update(ref(database, `events/${currentEvent.id}/meta`), {
        status: 'active'
      });
      setFeedback('Event started!');
      setTimeout(() => setFeedback(''), 2000);
    } catch (error) {
      console.error('Error starting event:', error);
      setFeedback('Error starting event. Try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // ==================== ENTER SCORES HANDLER ====================

 const handleEnterScores = async () => {
    if (isTeamFormat) {
      if (!myTeamId) {
        setFeedback("You're not assigned to a team yet");
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
      const myTeam = teams[myTeamId];
      if (myTeam?.scoringLockedBy && myTeam.scoringLockedBy !== currentUser.uid) {
        const lockerName = players.find(p => p.uid === myTeam.scoringLockedBy)?.displayName || 'Another player';
        setFeedback(`${lockerName} is currently entering scores for your team`);
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
      // Set the scoring lock
      await set(ref(database, `events/${currentEvent.id}/teams/${myTeamId}/scoringLockedBy`), currentUser.uid);
      setSelectedTeam(myTeamId);
    } else {
      setSelectedTeam(currentUser.uid);
    }
    setView('scoring');
  };

  // ==================== ADD GUEST ====================
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [guestName, setGuestName] = useState('');

  const handleAddGuest = async () => {
    const trimmedName = guestName.trim();
    if (!trimmedName) {
      setFeedback('Please enter a name');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }

    try {
      const guestId = `guest-${Date.now()}`;
      await set(ref(database, `events/${currentEvent.id}/players/${guestId}`), {
        displayName: trimmedName,
        joinedAt: Date.now(),
        role: 'player',
        handicap: null,
        isGuest: true
      });

      setGuestName('');
      setShowAddGuest(false);
      setFeedback(`${trimmedName} added as guest!`);
      setTimeout(() => setFeedback(''), 2000);
    } catch (error) {
      console.error('Error adding guest:', error);
      setFeedback('Error adding guest');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // Show tabs for all event statuses — leaderboard may have early scores,
  // and the teams/players tabs should always be reachable
  const showTabs = eventStatus === 'open' || eventStatus === 'active' || eventStatus === 'completed';

  // For open events with team format, show a teams tab
  const showTeamsTab = isTeamFormat && (eventStatus === 'open' || eventStatus === 'active' || eventStatus === 'completed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">
          ← Back to Home
        </button>

        {/* Event Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{currentEvent.meta.name}</h1>
            <div className="flex items-center gap-2">
              {isHost && (eventStatus === 'open' || eventStatus === 'active') && (
                <button
                  onClick={() => setView('edit-event')}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
                >
                  ✏️ Edit
                </button>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
              eventStatus === 'open'
                ? 'bg-yellow-100 text-yellow-700'
                : eventStatus === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {eventStatus === 'active' && '🔴 '}{eventStatus}
            </span>
            </div>
          </div>
          <div className="space-y-1 text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Course:</span>
              {currentEvent.meta.courseName}
              {currentEvent.meta.teeName && (
                <span className="text-gray-400">({currentEvent.meta.teeName})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Format:</span>
              {currentEvent.meta.formatName || currentEvent.meta.format}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Date:</span>
              {new Date(currentEvent.meta.date).toLocaleDateString()}
              {currentEvent.meta.time && ` at ${currentEvent.meta.time}`}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Holes:</span>
              {currentEvent.meta.numHoles} holes (starting on {currentEvent.meta.startingHole})
            </div>
          </div>

          {/* Event Code — always visible so host can share */}
          <div className="mt-4 flex items-center gap-3">
            <div className="bg-blue-50 px-4 py-2 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Event Code</div>
              <div className="font-mono font-bold text-blue-600 text-lg">{currentEvent.meta.eventCode}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentEvent.meta.eventCode);
                setFeedback('Code copied!');
                setTimeout(() => setFeedback(''), 2000);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
            >
              Copy Code
            </button>
          </div>
          {feedback && <div className="mt-2 text-sm text-green-600">{feedback}</div>}
        </div>

        {/* Enter Scores button — shown prominently when event is active */}
        {eventStatus === 'active' && (
          <button
            onClick={handleEnterScores}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 rounded-xl font-semibold text-lg shadow-lg transition-all mb-6"
          >
            ⛳ {isTeamFormat ? 'Enter Team Scores' : 'Enter My Scores'}
          </button>
        )}

        {/* Tab Navigation */}
        {(showTabs || showTeamsTab) && (
          <div className="flex bg-white/20 backdrop-blur-sm rounded-xl p-1 mb-6">
            {showTabs && (
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'leaderboard'
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                🏆 Leaderboard
              </button>
            )}
            {showTeamsTab && (
              <button
                onClick={() => setActiveTab('teams')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'teams'
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                👥 Teams ({Object.keys(teams).length})
              </button>
            )}
            <button
              onClick={() => setActiveTab('lobby')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'lobby'
                  ? 'bg-white text-gray-900 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              📋 Players ({players.length})
            </button>
          </div>
        )}

        {/* ==================== LEADERBOARD TAB ==================== */}
        {showTabs && activeTab === 'leaderboard' && (
          <>
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
              <LiveLeaderboard
                currentEvent={currentEvent}
                currentUser={currentUser}
                setSelectedTeam={setSelectedTeam}
                setView={setView}
              />
            </div>

            {/* Host: End Event button right below the leaderboard */}
            {isHost && eventStatus === 'active' && (
              <button
                onClick={async () => {
                  await update(ref(database, `events/${currentEvent.id}/meta`), {
                    status: 'completed'
                  });

                  // Calculate and write league standings if this is a league event with points
                  const lpMeta = currentEvent.meta || {};
                  if (lpMeta.leaguePoints && lpMeta.leagueId && lpMeta.seasonId) {
                    try {
                      const leaderboard = buildSortedLeaderboard();
                      // Load league members to determine who gets points
                      let leagueMembersData = null;
                      try {
                        const membersSnap = await get(ref(database, `leagues/${lpMeta.leagueId}/members`));
                        leagueMembersData = membersSnap.val();
                      } catch (err) {
                        console.error('Error loading league members:', err);
                      }

                      const playerPoints = calculateEventPoints(
                        leaderboard,
                        lpMeta.leaguePoints,
                        currentEvent.teams || {},
                        lpMeta.teamSize || 1,
                        currentEvent.players || {},
                        leagueMembersData
                      );
                      await writeStandingsToFirebase(lpMeta.leagueId, lpMeta.seasonId, currentEvent.id, playerPoints);
                      setFeedback('Event ended! League standings updated.');
                    } catch (err) {
                      console.error('Error updating standings:', err);
                      setFeedback('Event ended! (Error updating league standings)');
                    }
                  } else {
                    setFeedback('Event ended!');
                  }
                  setTimeout(() => setFeedback(''), 3000);
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold transition-all mb-6"
              >
                🏁 End Event
              </button>
            )}
          </>
        )}

        {/* ==================== TEAMS TAB ==================== */}
        {activeTab === 'teams' && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
            {isHost && (eventStatus === 'open' || eventStatus === 'active') ? (
              <TeamManager
                currentEvent={currentEvent}
                currentUser={currentUser}
                setFeedback={setFeedback}
              />
            ) : (
              // Non-hosts (or when event is completed) see a read-only team list
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Teams</h2>
                {Object.entries(teams).length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No teams created yet</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(teams)
                      .sort(([, a], [, b]) => (a.createdAt || 0) - (b.createdAt || 0))
                      .map(([teamId, team]) => (
                        <div key={teamId} className="p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            {editingTeamName === teamId ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={teamNameValue}
                                  onChange={(e) => setTeamNameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const trimmed = teamNameValue.trim();
                                      if (trimmed) {
                                        set(ref(database, `events/${currentEvent.id}/teams/${teamId}/name`), trimmed);
                                      }
                                      setEditingTeamName(null);
                                    }
                                    if (e.key === 'Escape') setEditingTeamName(null);
                                  }}
                                  className="flex-1 px-3 py-1.5 rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:outline-none text-sm font-semibold"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    const trimmed = teamNameValue.trim();
                                    if (trimmed) {
                                      set(ref(database, `events/${currentEvent.id}/teams/${teamId}/name`), trimmed);
                                    }
                                    setEditingTeamName(null);
                                  }}
                                  className="px-2 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingTeamName(null)}
                                  className="px-2 py-1 rounded text-xs font-semibold bg-gray-200 text-gray-600 hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <h3 className="font-bold text-gray-900">{team.name || 'Unnamed Team'}</h3>
                                {teamId === myTeamId && (
                                  <>
                                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Your Team</span>
                                    <button
                                      onClick={() => {
                                        setEditingTeamName(teamId);
                                        setTeamNameValue(team.name || '');
                                      }}
                                      className="text-xs text-gray-400 hover:text-gray-600"
                                    >
                                      ✏️
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                          <div className="space-y-1">
                            {Object.keys(team.members || {}).map(uid => (
                              <div key={uid} className="flex items-center gap-2 text-sm text-gray-700">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                  players.find(p => p.uid === uid)?.role === 'host' ? 'bg-yellow-500' : 'bg-blue-500'
                                }`}>
                                  {(currentEvent.players?.[uid]?.displayName || '?').charAt(0).toUpperCase()}
                                </div>
                                {currentEvent.players?.[uid]?.displayName || 'Unknown'}
                                {uid === currentUser?.uid && (
                                  <span className="text-[10px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full">You</span>
                                )}
                              </div>
                            ))}
                          </div>
                          {/* Mulligans display — shown when format uses mulligans and they've been assigned */}
                          {usesMulligans && team.mulligansTotal > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2">
                              <span className="text-xs text-purple-700 font-semibold">🎟️ Mulligans:</span>
                              <span className="text-sm font-bold text-purple-700">
                                {team.mulligansRemaining ?? team.mulligansTotal}
                              </span>
                              <span className="text-xs text-gray-400">
                                of {team.mulligansTotal}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== LOBBY TAB ==================== */}
        {(activeTab === 'lobby' || (!showTabs && !showTeamsTab)) && (
          <>
            {/* Players List */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Players ({players.length})
                </h2>
                {isHost && (eventStatus === 'open' || eventStatus === 'active') && (
                  <button
                    onClick={() => setShowAddGuest(!showAddGuest)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                  >
                    + Add Guest
                  </button>
                )}
              </div>

              {/* Add Guest form */}
              {showAddGuest && (
                <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Add a guest player (no account needed)</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddGuest(); }}
                      placeholder="Guest name"
                      className="flex-1 px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-sm"
                      autoFocus
                    />
                    <button
                      onClick={handleAddGuest}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setShowAddGuest(false); setGuestName(''); }}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {players.length > 0 ? (
                <div className="space-y-3">
                  {players.map(player => (
                    <div key={player.uid} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Avatar circle — yellow for host, blue for player, gray for guest */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            player.role === 'host' ? 'bg-yellow-500' : player.isGuest ? 'bg-gray-400' : 'bg-blue-500'
                          }`}>
                            {(player.displayName || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              {player.displayName || 'Unknown Player'}
                              {player.role === 'host' && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Host</span>
                              )}
                              {player.uid === currentUser?.uid && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">You</span>
                              )}
                              {player.isGuest && (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Guest</span>
                              )}
                            </div>
                            {player.handicap != null && (
                              <div className="text-sm text-gray-500">
                                Handicap: {player.handicap}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Show which team they're on */}
                        {isTeamFormat && (() => {
                          for (const [teamId, team] of Object.entries(teams)) {
                            if (team.members && team.members[player.uid]) {
                              return (
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                                  {team.name || 'Unnamed Team'}
                                </span>
                              );
                            }
                          }
                          return (
                            <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-1 rounded-full">
                              Unassigned
                            </span>
                          );
                        })()}
                        {/* Remove button for guests — host only */}
                        {isHost && player.isGuest && (eventStatus === 'open' || eventStatus === 'active') && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Remove ${player.displayName} from the event?`)) return;
                              try {
                                await remove(ref(database, `events/${currentEvent.id}/players/${player.uid}`));
                                // Also remove from any team they're on
                                for (const [teamId, team] of Object.entries(teams)) {
                                  if (team.members && team.members[player.uid]) {
                                    await remove(ref(database, `events/${currentEvent.id}/teams/${teamId}/members/${player.uid}`));
                                  }
                                }
                                setFeedback(`${player.displayName} removed`);
                                setTimeout(() => setFeedback(''), 2000);
                              } catch (err) {
                                console.error('Error removing guest:', err);
                                setFeedback('Error removing guest');
                                setTimeout(() => setFeedback(''), 3000);
                              }
                            }}
                            className="text-red-400 hover:text-red-600 text-xs font-semibold ml-2"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No players yet — share the event code!</p>
                </div>
              )}
            </div>

            {/* Host Controls — shown when event is open or active */}
            {isHost && (eventStatus === 'open' || eventStatus === 'active') && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Host Controls</h2>

                {/* Mulligan Assignment — only for mulligan formats */}
                {usesMulligans && (
                  <div className="mb-5 p-4 bg-purple-50 border-2 border-purple-200 rounded-xl">
                    <h3 className="text-sm font-bold text-purple-800 mb-1">🎟️ Assign Mulligans</h3>
                    <p className="text-xs text-purple-600 mb-3">
                      Set how many mulligans each {isTeamFormat ? 'team' : 'player'} gets for this event.
                    </p>
                    <div className="space-y-2">
                      {isTeamFormat ? (
                        // Team format: assign mulligans per team
                        Object.entries(teams)
                          .sort(([, a], [, b]) => (a.createdAt || 0) - (b.createdAt || 0))
                          .map(([teamId, team]) => {
                            const memberNames = Object.keys(team.members || {})
                              .map(uid => currentEvent.players?.[uid]?.displayName || 'Unknown')
                              .join(' & ');
                            return (
                              <div key={teamId} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm text-gray-900 truncate">{team.name || 'Unnamed Team'}</div>
                                  <div className="text-xs text-gray-500 truncate">{memberNames}</div>
                                </div>
                                <div className="flex items-center gap-2 ml-3">
                                  <button
                                    onClick={() => {
                                      const current = team.mulligansTotal || 0;
                                      if (current > 0) {
                                        const newVal = current - 1;
                                        set(ref(database, `events/${currentEvent.id}/teams/${teamId}/mulligansTotal`), newVal);
                                        set(ref(database, `events/${currentEvent.id}/teams/${teamId}/mulligansRemaining`), newVal);
                                      }
                                    }}
                                    className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-lg flex items-center justify-center"
                                  >
                                    −
                                  </button>
                                  <div className="w-10 text-center font-bold text-lg text-purple-700">
                                    {team.mulligansTotal || 0}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const newVal = (team.mulligansTotal || 0) + 1;
                                      set(ref(database, `events/${currentEvent.id}/teams/${teamId}/mulligansTotal`), newVal);
                                      set(ref(database, `events/${currentEvent.id}/teams/${teamId}/mulligansRemaining`), newVal);
                                    }}
                                    className="w-8 h-8 rounded-lg bg-purple-200 hover:bg-purple-300 text-purple-700 font-bold text-lg flex items-center justify-center"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        // Individual format: assign mulligans per player
                        players.map(player => (
                          <div key={player.uid} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm text-gray-900 truncate">
                                {player.displayName || 'Unknown'}
                              </div>
                              {player.handicap != null && (
                                <div className="text-xs text-gray-500">HCP: {player.handicap}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              <button
                                onClick={() => {
                                  const current = currentEvent.players?.[player.uid]?.mulligansTotal || 0;
                                  if (current > 0) {
                                    const newVal = current - 1;
                                    set(ref(database, `events/${currentEvent.id}/players/${player.uid}/mulligansTotal`), newVal);
                                    set(ref(database, `events/${currentEvent.id}/players/${player.uid}/mulligansRemaining`), newVal);
                                  }
                                }}
                                className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-lg flex items-center justify-center"
                              >
                                −
                              </button>
                              <div className="w-10 text-center font-bold text-lg text-purple-700">
                                {currentEvent.players?.[player.uid]?.mulligansTotal || 0}
                              </div>
                              <button
                                onClick={() => {
                                  const newVal = (currentEvent.players?.[player.uid]?.mulligansTotal || 0) + 1;
                                  set(ref(database, `events/${currentEvent.id}/players/${player.uid}/mulligansTotal`), newVal);
                                  set(ref(database, `events/${currentEvent.id}/players/${player.uid}/mulligansRemaining`), newVal);
                                }}
                                className="w-8 h-8 rounded-lg bg-purple-200 hover:bg-purple-300 text-purple-700 font-bold text-lg flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Start Event — only when still open */}
                {eventStatus === 'open' && (() => {
                  // Determine if we're ready to start
                  const teamsWithMembers = Object.values(teams).filter(
                    t => t.members && Object.keys(t.members).length > 0
                  ).length;
                  const canStart = isTeamFormat
                    ? teamsWithMembers > 0
                    : players.length >= 2;

                  return (
                    <>
                      <p className="text-sm text-gray-600 mb-4">
                        {isTeamFormat
                          ? teamsWithMembers === 0
                            ? 'Create a team and assign players to get started (use the Teams tab).'
                            : `${teamsWithMembers} team${teamsWithMembers !== 1 ? 's' : ''} ready. You can start now — more players can join and be assigned to teams later.`
                          : players.length < 2
                          ? 'Need at least 2 players to start.'
                          : 'Ready to start! More players can still join after the event begins.'
                        }
                      </p>
                      <button
                        onClick={startEvent}
                        disabled={!canStart}
                        className={`w-full py-4 rounded-xl font-semibold text-lg shadow-lg transition-all ${
                          canStart
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Start Event
                      </button>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Host Controls when event is active — End or Reopen */}
            {isHost && (eventStatus === 'active' || eventStatus === 'completed') && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Host Controls</h2>
                <div className="space-y-3">
                  {eventStatus === 'active' && (
                    <button
                      onClick={async () => {
                        await update(ref(database, `events/${currentEvent.id}/meta`), {
                          status: 'completed'
                        });

                        const lpMeta = currentEvent.meta || {};
                        if (lpMeta.leaguePoints && lpMeta.leagueId && lpMeta.seasonId) {
                          try {
                            const leaderboard = buildSortedLeaderboard();
                            const playerPoints = calculateEventPoints(
                              leaderboard,
                              lpMeta.leaguePoints,
                              currentEvent.teams || {},
                              lpMeta.teamSize || 1
                            );
                            await writeStandingsToFirebase(lpMeta.leagueId, lpMeta.seasonId, currentEvent.id, playerPoints);
                            setFeedback('Event ended! League standings updated.');
                          } catch (err) {
                            console.error('Error updating standings:', err);
                            setFeedback('Event ended! (Error updating league standings)');
                          }
                        } else {
                          setFeedback('Event ended');
                        }
                        setTimeout(() => setFeedback(''), 3000);
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold transition-all"
                    >
                      End Event
                    </button>
                  )}
                  {eventStatus === 'completed' && (
                    <button
                      onClick={async () => {
                        await update(ref(database, `events/${currentEvent.id}/meta`), {
                          status: 'active'
                        });
                        setFeedback('Event reopened');
                        setTimeout(() => setFeedback(''), 2000);
                      }}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-xl font-semibold transition-all"
                    >
                      Reopen Event
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await update(ref(database, `events/${currentEvent.id}/meta`), {
                        status: 'open'
                      });
                      setFeedback('Event reset to open');
                      setTimeout(() => setFeedback(''), 2000);
                    }}
                    className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition-all"
                  >
                    Reset to Open
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
