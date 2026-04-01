import { ref, update, set, get, onValue, off } from 'firebase/database';
import { useEffect, useState } from 'react';
import { database } from '../../firebase';
import LiveLeaderboard from '../scoring/LiveLeaderboard';
import TeamManager from './TeamManager';
import EventHeader from './EventHeader';
import PlayersList from './PlayersList';
import TeamsList from './TeamsList';
import HostControls from './HostControls';
import { calculateEventPoints, writeStandingsToFirebase } from '../../utils/leaguePoints';
import { sortLeaderboard, assignPositions } from '../../utils/leaderboard';

export default function EventLobbyView({
  currentUser,
  currentEvent,
  setCurrentEvent,
  feedback,
  setFeedback,
  setView,
  setSelectedTeam
}) {
  const eventStatus = currentEvent.meta?.status || 'open';
  const [activeTab, setActiveTab] = useState(
    eventStatus === 'open' ? 'lobby' : 'leaderboard'
  );

  // Real-time listener — updates whenever any player scores or joins
  useEffect(() => {
    if (!currentEvent?.id) return;
    const eventRef = ref(database, `events/${currentEvent.id}`);
    const listener = onValue(eventRef, (snapshot) => {
      const updatedEvent = snapshot.val();
      if (updatedEvent) {
        setCurrentEvent({ id: currentEvent.id, ...updatedEvent });
      }
    });
    return () => off(eventRef, 'value', listener);
  }, [currentEvent?.id]);

  // Auto-switch to leaderboard when event goes active
  useEffect(() => {
    if (eventStatus === 'active' && activeTab !== 'leaderboard') {
      setActiveTab('leaderboard');
    }
  }, [eventStatus]);

  // ==================== COMPUTED VALUES ====================
  const players = Object.entries(currentEvent.players || {}).map(([uid, data]) => ({ uid, ...data }));
  const isHost = currentEvent.players?.[currentUser?.uid]?.role === 'host';
  const teams = currentEvent?.teams || {};
  const teamSize = currentEvent?.meta?.teamSize || 2;
  const isTeamFormat = teamSize > 1;
  const usesMulligans = currentEvent?.meta?.handicap?.enabled && currentEvent?.meta?.handicap?.applicationMethod === 'mulligans';

  const myTeamId = (() => {
    for (const [teamId, team] of Object.entries(teams)) {
      if (team.members && team.members[currentUser?.uid]) return teamId;
    }
    return null;
  })();

  const showTabs = eventStatus === 'open' || eventStatus === 'active' || eventStatus === 'completed';
  const showTeamsTab = isTeamFormat && showTabs;

  // ==================== LEADERBOARD BUILDER (for league points on end event) ====================
  const buildSortedLeaderboard = () => {
    const meta = currentEvent.meta || {};
    const evPlayers = currentEvent.players || {};
    const evTeams = currentEvent.teams || {};
    const isTeam = (meta.teamSize || 1) > 1 && Object.keys(evTeams).length > 0;

    const entries = isTeam
      ? Object.entries(evTeams).map(([teamId, team]) => {
          const stats = team.stats || {};
          return { id: teamId, holesPlayed: stats.holesPlayed || 0, toPar: stats.toPar || 0, totalScore: stats.totalScore || 0, stablefordPoints: stats.stablefordPoints || 0, netToPar: stats.netToPar || 0 };
        })
      : Object.entries(evPlayers).map(([uid, player]) => {
          const stats = player.stats || {};
          return { id: uid, holesPlayed: stats.holesPlayed || 0, toPar: stats.toPar || 0, totalScore: stats.totalScore || 0, stablefordPoints: stats.stablefordPoints || 0, netToPar: stats.netToPar || 0 };
        });

    const opts = { scoringMethod: meta.scoringMethod, primarySort: meta.display?.primarySort || 'gross', handicapEnabled: meta.handicap?.enabled || false };
    sortLeaderboard(entries, opts);
    assignPositions(entries, opts);
    return entries;
  };

  // ==================== EVENT ACTION HANDLERS ====================
  const handleStartEvent = async () => {
    if (!isHost) return;
    if (isTeamFormat) {
      const teamCount = Object.keys(teams).length;
      if (teamCount === 0) { setFeedback('Create at least one team before starting (use the Teams tab)'); setTimeout(() => setFeedback(''), 3000); return; }
      const teamsWithMembers = Object.values(teams).filter(t => t.members && Object.keys(t.members).length > 0);
      if (teamsWithMembers.length === 0) { setFeedback('Assign players to at least one team before starting'); setTimeout(() => setFeedback(''), 3000); return; }
    } else {
      if (players.length < 2) { setFeedback('Need at least 2 players to start'); setTimeout(() => setFeedback(''), 3000); return; }
    }
    try {
      await update(ref(database, `events/${currentEvent.id}/meta`), { status: 'active' });
      setFeedback('Event started!');
      setTimeout(() => setFeedback(''), 2000);
    } catch (error) {
      console.error('Error starting event:', error);
      setFeedback('Error starting event. Try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  const handleEndEvent = async () => {
    await update(ref(database, `events/${currentEvent.id}/meta`), { status: 'completed' });
    const lpMeta = currentEvent.meta || {};
    if (lpMeta.leaguePoints && lpMeta.leagueId && lpMeta.seasonId) {
      try {
        const leaderboard = buildSortedLeaderboard();
        let leagueMembersData = null;
        try {
          const membersSnap = await get(ref(database, `leagues/${lpMeta.leagueId}/members`));
          leagueMembersData = membersSnap.val();
        } catch (err) {
          console.error('Error loading league members:', err);
        }
        const playerPoints = calculateEventPoints(leaderboard, lpMeta.leaguePoints, currentEvent.teams || {}, lpMeta.teamSize || 1, currentEvent.players || {}, leagueMembersData);
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
  };

  const handleReopenEvent = async () => {
    await update(ref(database, `events/${currentEvent.id}/meta`), { status: 'active' });
    setFeedback('Event reopened');
    setTimeout(() => setFeedback(''), 2000);
  };

  const handleResetEvent = async () => {
    await update(ref(database, `events/${currentEvent.id}/meta`), { status: 'open' });
    setFeedback('Event reset to open');
    setTimeout(() => setFeedback(''), 2000);
  };

  const handleEnterScores = async () => {
    if (isTeamFormat) {
      if (!myTeamId) { setFeedback("You're not assigned to a team yet"); setTimeout(() => setFeedback(''), 3000); return; }
      const myTeam = teams[myTeamId];
      if (myTeam?.scoringLockedBy && myTeam.scoringLockedBy !== currentUser.uid) {
        const lockerName = players.find(p => p.uid === myTeam.scoringLockedBy)?.displayName || 'Another player';
        setFeedback(`${lockerName} is currently entering scores for your team`);
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
      await set(ref(database, `events/${currentEvent.id}/teams/${myTeamId}/scoringLockedBy`), currentUser.uid);
      setSelectedTeam(myTeamId);
    } else {
      setSelectedTeam(currentUser.uid);
    }
    setView('scoring');
  };

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">
          ← Back to Home
        </button>

        <EventHeader
          currentEvent={currentEvent}
          isHost={isHost}
          eventStatus={eventStatus}
          feedback={feedback}
          setView={setView}
          setFeedback={setFeedback}
        />

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
                  activeTab === 'leaderboard' ? 'bg-white text-gray-900 shadow-md' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                🏆 Leaderboard
              </button>
            )}
            {showTeamsTab && (
              <button
                onClick={() => setActiveTab('teams')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'teams' ? 'bg-white text-gray-900 shadow-md' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                👥 Teams ({Object.keys(teams).length})
              </button>
            )}
            <button
              onClick={() => setActiveTab('lobby')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'lobby' ? 'bg-white text-gray-900 shadow-md' : 'text-white/80 hover:text-white hover:bg-white/10'
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
            {isHost && eventStatus === 'active' && (
              <button
                onClick={handleEndEvent}
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
              <TeamsList
                currentEvent={currentEvent}
                currentUser={currentUser}
                myTeamId={myTeamId}
                teams={teams}
                players={players}
                usesMulligans={usesMulligans}
              />
            )}
          </div>
        )}

        {/* ==================== LOBBY TAB ==================== */}
        {(activeTab === 'lobby' || (!showTabs && !showTeamsTab)) && (
          <>
            <PlayersList
              currentEvent={currentEvent}
              currentUser={currentUser}
              isHost={isHost}
              isTeamFormat={isTeamFormat}
              eventStatus={eventStatus}
              teams={teams}
              players={players}
              setFeedback={setFeedback}
            />
            {isHost && (
              <HostControls
                currentEvent={currentEvent}
                eventStatus={eventStatus}
                isTeamFormat={isTeamFormat}
                players={players}
                teams={teams}
                usesMulligans={usesMulligans}
                setFeedback={setFeedback}
                onStartEvent={handleStartEvent}
                onEndEvent={handleEndEvent}
                onReopenEvent={handleReopenEvent}
                onResetEvent={handleResetEvent}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
