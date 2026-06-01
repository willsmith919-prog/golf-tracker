import { ref, update, set, get, onValue, off } from 'firebase/database';
import { useEffect, useState } from 'react';
import { database } from '../../firebase';
import LiveLeaderboard from '../scoring/LiveLeaderboard';
import TeamManager from './TeamManager';
import EventHeader from './EventHeader';
import PlayersList from './PlayersList';
import TeamsList from './TeamsList';
import HostControls from './HostControls';
import VegasTeamConfig from './VegasTeamConfig';
import { calculateEventPoints, writeStandingsToFirebase, allocateStrokePlayPoints } from '../../utils/leaguePoints';
import { sortLeaderboard, assignPositions } from '../../utils/leaderboard';
import { calculateSkins, buildSkinsEntries } from '../../utils/skins';
import { calculateVegasResults, buildVegasEntries } from '../../utils/calculateVegasResults';
import { buildHoleOrder } from '../../utils/holes';

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

  // Sync current user's profile handicap into the event — only while the event is open (lobby).
  // Once scoring starts (active/completed) the handicap is locked; only a host/admin can change it manually.
  useEffect(() => {
    if (!currentUser?.uid || !currentEvent?.id) return;
    if (eventStatus !== 'open') return;
    const profileHandicapRef = ref(database, `users/${currentUser.uid}/profile/handicap`);
    const unsub = onValue(profileHandicapRef, (snap) => {
      const profileHandicap = snap.val() ?? null;
      const eventHandicap = currentEvent?.players?.[currentUser.uid]?.handicap ?? null;
      if (profileHandicap !== eventHandicap) {
        set(ref(database, `events/${currentEvent.id}/players/${currentUser.uid}/handicap`), profileHandicap);
      }
    });
    return unsub;
  }, [currentUser?.uid, currentEvent?.id, eventStatus]);

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
    const holeOrder = buildHoleOrder(lpMeta.numHoles || 18, lpMeta.startingHole || 1);
    const coursePars = lpMeta.coursePars || [];
    const sideGames = lpMeta.sideGames || [];

    // Vegas results — saved for all events, not just league events
    const vegasSideGames = sideGames.filter(sg => sg.sideGameType === 'vegas');
    if (vegasSideGames.length > 0) {
      try {
        const vegasEntries = buildVegasEntries(currentEvent);
        for (const sg of vegasSideGames) {
          const vegasResults = calculateVegasResults(vegasEntries, holeOrder, coursePars, sg);
          await set(ref(database, `events/${currentEvent.id}/sideGameResults/vegas/${sg.id}`), vegasResults);
        }
      } catch (err) {
        console.error('Error saving Vegas results:', err);
      }
    }

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

        // Main game points (includes participation)
        const mainGamePoints = calculateEventPoints(
          leaderboard, lpMeta.leaguePoints,
          currentEvent.teams || {}, lpMeta.teamSize || 1,
          currentEvent.players || {}, leagueMembersData
        );
        const participationPts = lpMeta.leaguePoints.participationPoints || 0;

        // Side game points
        const skinsSideGames = sideGames.filter(sg => sg.sideGameType === 'skins' || !sg.sideGameType);
        const strokePlaySideGames = sideGames.filter(sg => sg.sideGameType === 'stroke_play');

        // Skins
        const skinsEntries = skinsSideGames.length > 0 ? buildSkinsEntries(currentEvent) : [];

        const skinsByPlayer = {}; // { uid: { [sgId]: points } }
        for (const sg of skinsSideGames) {
          const { pointTotals } = calculateSkins(skinsEntries, holeOrder, coursePars, sg);
          for (const [uid, pts] of Object.entries(pointTotals)) {
            if (!skinsByPlayer[uid]) skinsByPlayer[uid] = {};
            skinsByPlayer[uid][sg.id] = pts;
          }
        }

        // Stroke Play side games — Full Field (independent, additive)
        // and Main Game Exclusion (allocation replaces main game points for some players)
        const strokePlayByPlayer = {}; // { uid: { [sgId]: { competition, points } } }
        for (const sg of strokePlaySideGames) {
          if (sg.competitionMode === 'main_game_exclusion') {
            const allocation = allocateStrokePlayPoints(
              leaderboard, lpMeta.leaguePoints, sg,
              currentEvent.players || {}, leagueMembersData
            );
            for (const [uid, alloc] of Object.entries(allocation)) {
              if (!strokePlayByPlayer[uid]) strokePlayByPlayer[uid] = {};
              strokePlayByPlayer[uid][sg.id] = alloc;
            }
          } else {
            // Full Field: compute net stroke play points and add them independently
            const sorted = [...leaderboard.filter(e => e.holesPlayed > 0)].sort((a, b) => {
              return sg.variant === 'net' ? a.netToPar - b.netToPar : a.toPar - b.toPar;
            });
            for (let i = 0; i < sorted.length; i++) {
              if (i === 0) sorted[i]._sgPos = 1;
              else {
                const prev = sg.variant === 'net' ? sorted[i - 1].netToPar : sorted[i - 1].toPar;
                const curr = sg.variant === 'net' ? sorted[i].netToPar : sorted[i].toPar;
                sorted[i]._sgPos = curr === prev ? sorted[i - 1]._sgPos : i + 1;
              }
            }
            for (const e of sorted) {
              const pts = (sg.positions || {})[String(e._sgPos)] || 0;
              if (!strokePlayByPlayer[e.id]) strokePlayByPlayer[e.id] = {};
              strokePlayByPlayer[e.id][sg.id] = { competition: 'net', points: pts };
            }
          }
        }

        // Build combined points
        // For exclusion side games: the allocation result replaces the player's gross points.
        // For everyone else, main game points stand and skins/full-field stroke play add on top.
        const exclusionSideGames = strokePlaySideGames.filter(sg => sg.competitionMode === 'main_game_exclusion');
        const combinedPoints = {};

        // Collect all UIDs across all point sources
        const allUids = new Set([
          ...Object.keys(mainGamePoints),
          ...Object.keys(skinsByPlayer),
          ...Object.keys(strokePlayByPlayer)
        ]);

        for (const uid of allUids) {
          // Check if this player was allocated away from the main game by any exclusion side game
          let removedFromMainGame = false;
          let exclusionPoints = 0;
          for (const sg of exclusionSideGames) {
            const alloc = strokePlayByPlayer[uid]?.[sg.id];
            if (alloc?.competition === 'net') {
              removedFromMainGame = true;
              exclusionPoints += alloc.points;
            }
          }

          const base = removedFromMainGame ? 0 : (mainGamePoints[uid] || 0);
          const skinsTotal = Object.values(skinsByPlayer[uid] || {}).reduce((s, v) => s + v, 0);
          const fullFieldTotal = strokePlaySideGames
            .filter(sg => sg.competitionMode !== 'main_game_exclusion')
            .reduce((sum, sg) => sum + (strokePlayByPlayer[uid]?.[sg.id]?.points || 0), 0);

          combinedPoints[uid] = base + skinsTotal + exclusionPoints + fullFieldTotal;
        }

        // Build breakdowns for storage
        const breakdowns = {};
        for (const uid of allUids) {
          const mainTotal = mainGamePoints[uid] || 0;
          const skinsTotal = Object.values(skinsByPlayer[uid] || {}).reduce((s, v) => s + v, 0);
          const participation = mainTotal > 0 ? participationPts : 0;

          const strokePlayBreakdown = {};
          for (const sg of strokePlaySideGames) {
            const alloc = strokePlayByPlayer[uid]?.[sg.id];
            if (alloc) strokePlayBreakdown[sg.id] = alloc;
          }

          breakdowns[uid] = {
            mainGame: mainTotal,
            participation,
            skins: skinsByPlayer[uid] || {},
            strokePlay: strokePlayBreakdown,
            total: combinedPoints[uid] || 0
          };
        }

        await writeStandingsToFirebase(lpMeta.leagueId, lpMeta.seasonId, currentEvent.id, combinedPoints, breakdowns);
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
    <div className="min-h-screen bg-[#00285e] p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-[#c8d6e5]">
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
            className="w-full bg-[#e63946] hover:bg-[#c5303c] text-white py-4 rounded-xl font-semibold text-lg shadow-lg transition-all mb-6"
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
            {isHost && (currentEvent.meta?.sideGames || []).some(sg => sg.sideGameType === 'vegas' && sg.type !== 'vegas1v1') && (eventStatus === 'open' || eventStatus === 'active') && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
                <VegasTeamConfig
                  currentEvent={currentEvent}
                  setFeedback={setFeedback}
                />
              </div>
            )}

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
