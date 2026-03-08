import { ref, update, set, onValue, off } from 'firebase/database';
import { useEffect, useState } from 'react';
import { database } from '../../firebase';
import LiveLeaderboard from '../scoring/LiveLeaderboard';
import TeamManager from './TeamManager';

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

  // Is this a team format? (teamSize > 1)
  const isTeamFormat = teamSize > 1;

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

  // ==================== START EVENT ====================

  const startEvent = async () => {
    if (!isHost) return;

    if (players.length < 2) {
      setFeedback('Need at least 2 players to start');
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    // For team formats, validate teams are set up
    if (isTeamFormat) {
      const teamCount = Object.keys(teams).length;
      if (teamCount === 0) {
        setFeedback('Create teams before starting the event (use the Teams tab)');
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
      if (!allPlayersAssigned()) {
        setFeedback('All players must be assigned to a team before starting');
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
  // Show tabs only when event is active or completed (leaderboard has data to show)
  const showTabs = eventStatus === 'active' || eventStatus === 'completed';

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
              {isHost && eventStatus === 'open' && (
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
                  setFeedback('Event ended!');
                  setTimeout(() => setFeedback(''), 2000);
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
            {isHost && eventStatus === 'open' ? (
              <TeamManager
                currentEvent={currentEvent}
                currentUser={currentUser}
                setFeedback={setFeedback}
              />
            ) : (
              // Non-hosts (or when event is active) see a read-only team list
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
                            <h3 className="font-bold text-gray-900">{team.name || 'Unnamed Team'}</h3>
                            {teamId === myTeamId && (
                              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Your Team</span>
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
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Players ({players.length})
              </h2>
              
              {players.length > 0 ? (
                <div className="space-y-3">
                  {players.map(player => (
                    <div key={player.uid} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Avatar circle — yellow for host, blue for player */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            player.role === 'host' ? 'bg-yellow-500' : 'bg-blue-500'
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

            {/* Host Controls — only shown to the host when event is still open */}
            {isHost && eventStatus === 'open' && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Host Controls</h2>
                <p className="text-sm text-gray-600 mb-4">
                  {isTeamFormat
                    ? players.length < 2
                      ? 'Need at least 2 players to start.'
                      : !allPlayersAssigned()
                      ? 'Assign all players to teams (use the Teams tab), then start.'
                      : 'All players are assigned to teams. Ready to start!'
                    : players.length < 2
                    ? 'Once all players have joined, start the event to begin scoring. (Need at least 2 players)'
                    : 'Once all players have joined, start the event to begin scoring.'
                  }
                </p>
                <button
                  onClick={startEvent}
                  disabled={players.length < 2 || (isTeamFormat && !allPlayersAssigned())}
                  className={`w-full py-4 rounded-xl font-semibold text-lg shadow-lg transition-all ${
                    players.length >= 2 && (!isTeamFormat || allPlayersAssigned())
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Start Event
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('Delete this event? This cannot be undone.')) return;
                    try {
                      const { remove } = await import('firebase/database');
                      // Remove the event itself
                      await remove(ref(database, `events/${currentEvent.id}`));
                      // Remove the event code
                      if (currentEvent.meta?.eventCode) {
                        await remove(ref(database, `codes/${currentEvent.meta.eventCode}`));
                      }
                      // Remove event reference from all players' profiles
                      for (const uid of Object.keys(currentEvent.players || {})) {
                        await remove(ref(database, `users/${uid}/events/${currentEvent.id}`));
                      }
                      setView('home');
                    } catch (error) {
                      console.error('Error deleting event:', error);
                      setFeedback('Error deleting event');
                      setTimeout(() => setFeedback(''), 3000);
                    }
                  }}
                  className="w-full mt-3 bg-red-100 hover:bg-red-200 text-red-700 py-3 rounded-xl font-semibold transition-all"
                >
                  🗑️ Delete Event
                </button>
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
                        setFeedback('Event ended');
                        setTimeout(() => setFeedback(''), 2000);
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
