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
import { getPlayerCourseHandicap, getStrokeHoles } from '../../utils/handicap';

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
  const [grossNetResult, setGrossNetResult] = useState(null);

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
  const isWolfFormat = currentEvent?.meta?.competition?.structure === 'wolf';
  const wolfPlayerCount = currentEvent?.meta?.competition?.wolf?.playerCount || 4;
  const wolfPlayerOrder = currentEvent?.meta?.wolfPlayerOrder || [];
  const wolfHoleOrder = buildHoleOrder(currentEvent?.meta?.numHoles || 18, currentEvent?.meta?.startingHole || 1);

  const myTeamId = (() => {
    for (const [teamId, team] of Object.entries(teams)) {
      if (team.members && team.members[currentUser?.uid]) return teamId;
    }
    return null;
  })();

  const isLeagueEvent = !!(currentEvent.meta?.leaguePoints && currentEvent.meta?.leagueId && currentEvent.meta?.seasonId);
  const hasGrossNetSideGame = (currentEvent.meta?.sideGames || []).some(
    sg => sg.sideGameType === 'stroke_play' && sg.competitionMode === 'main_game_exclusion'
  );
  const showTabs = eventStatus === 'open' || eventStatus === 'active' || eventStatus === 'completed';
  const showTeamsTab = isTeamFormat && showTabs;

  // ==================== LEADERBOARD BUILDER (for league points on end event) ====================
  const buildSortedLeaderboard = () => {
    const meta = currentEvent.meta || {};
    const evPlayers = currentEvent.players || {};
    const evTeams = currentEvent.teams || {};
    const isTeam = (meta.teamSize || 1) > 1 && Object.keys(evTeams).length > 0;

    const useSlope = meta.handicap?.useSlope ?? true;
    const courseParsLocal = meta.coursePars || [];
    const coursePar = courseParsLocal.reduce((sum, p) => sum + (p || 0), 0);
    const holeOrderLocal = buildHoleOrder(meta.numHoles || 18, meta.startingHole || 1);
    // Always force handicapEnabled:true so net scores compute even for Gross main game
    const hcConfig = {
      handicapEnabled: true,
      courseSlope: useSlope ? (meta.courseSlope || null) : null,
      courseRating: useSlope ? (meta.courseRating || null) : null,
      coursePar,
      handicapAllowance: meta.handicap?.allowance || 100,
      courseStrokeIndexes: meta.courseStrokeIndexes || []
    };
    const computeNetToPar = (handicap, scores, holes) => {
      const ch = getPlayerCourseHandicap(handicap, hcConfig);
      const sh = getStrokeHoles(ch, hcConfig);
      let net = 0, par = 0;
      for (const h of holeOrderLocal) {
        const s = scores?.[h] || holes?.[h]?.score;
        if (s) { net += s - (sh[h] || 0); par += courseParsLocal[h - 1] || 0; }
      }
      return net - par;
    };

    const teamMethod = meta.handicap?.teamHandicapMethod || 'average';
    const entries = isTeam
      ? Object.entries(evTeams).map(([teamId, team]) => {
          const stats = team.stats || {};
          const hcps = Object.keys(team.members || {}).map(uid => evPlayers[uid]?.handicap).filter(h => h != null);
          let teamHcp;
          if (teamMethod === 'usga_scramble' && hcps.length === 2) {
            const sorted = [...hcps].sort((a, b) => a - b);
            teamHcp = sorted[0] * 0.35 + sorted[1] * 0.15;
          } else {
            teamHcp = hcps.length > 0 ? hcps.reduce((s, h) => s + h, 0) / hcps.length : null;
          }
          return { id: teamId, holesPlayed: stats.holesPlayed || 0, toPar: stats.toPar || 0, totalScore: stats.totalScore || 0, stablefordPoints: stats.stablefordPoints || 0, netToPar: computeNetToPar(teamHcp, team.scores, team.holes) };
        })
      : Object.entries(evPlayers).map(([uid, player]) => {
          const stats = player.stats || {};
          return { id: uid, holesPlayed: stats.holesPlayed || 0, toPar: stats.toPar || 0, totalScore: stats.totalScore || 0, stablefordPoints: stats.stablefordPoints || 0, netToPar: computeNetToPar(player.handicap, player.scores, player.holes) };
        });

    const opts = { scoringMethod: meta.scoringMethod, primarySort: meta.display?.primarySort || 'gross', handicapEnabled: meta.handicap?.enabled || false };
    sortLeaderboard(entries, opts);
    assignPositions(entries, opts);
    return entries;
  };

  // ==================== EVENT ACTION HANDLERS ====================
  const handleWolfReorder = async (fromIndex, toIndex) => {
    const currentOrder = currentEvent.meta?.wolfPlayerOrder || players.map(p => p.uid);
    const order = [...currentOrder];
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    await set(ref(database, `events/${currentEvent.id}/meta/wolfPlayerOrder`), order);
  };

  const handleStartEvent = async () => {
    if (!isHost) return;
    const isWolf = currentEvent.meta?.competition?.structure === 'wolf';
    if (isWolf) {
      const wolfPlayerCount = currentEvent.meta?.competition?.wolf?.playerCount || 4;
      const wolfOrder = currentEvent.meta?.wolfPlayerOrder || [];
      if (wolfOrder.length !== wolfPlayerCount) {
        setFeedback(`Set Wolf tee order for all ${wolfPlayerCount} players before starting`);
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
    }
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

  // Shared league points calculation — used by both End Event and Recalculate
  const runLeaguePointsCalc = async () => {
    const lpMeta = currentEvent.meta || {};
    const holeOrder = buildHoleOrder(lpMeta.numHoles || 18, lpMeta.startingHole || 1);
    const coursePars = lpMeta.coursePars || [];
    const sideGames = lpMeta.sideGames || [];
    const leaderboard = buildSortedLeaderboard();

    let leagueMembersData = null;
    try {
      const membersSnap = await get(ref(database, `leagues/${lpMeta.leagueId}/members`));
      leagueMembersData = membersSnap.val();
    } catch (err) {
      console.error('Error loading league members:', err);
    }

    const mainGamePoints = calculateEventPoints(
      leaderboard, lpMeta.leaguePoints,
      currentEvent.teams || {}, lpMeta.teamSize || 1,
      currentEvent.players || {}, leagueMembersData
    );
    const participationPts = lpMeta.leaguePoints.participationPoints || 0;

    const skinsSideGames = sideGames.filter(sg => sg.sideGameType === 'skins' || !sg.sideGameType);
    const strokePlaySideGames = sideGames.filter(sg => sg.sideGameType === 'stroke_play');

    const skinsEntries = skinsSideGames.length > 0 ? buildSkinsEntries(currentEvent) : [];
    const skinsByPlayer = {};
    for (const sg of skinsSideGames) {
      const { pointTotals } = calculateSkins(skinsEntries, holeOrder, coursePars, sg);
      for (const [uid, pts] of Object.entries(pointTotals)) {
        if (!skinsByPlayer[uid]) skinsByPlayer[uid] = {};
        skinsByPlayer[uid][sg.id] = pts;
      }
    }

    const strokePlayByPlayer = {};
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

    const exclusionSideGames = strokePlaySideGames.filter(sg => sg.competitionMode === 'main_game_exclusion');
    const combinedPoints = {};
    const allUids = new Set([
      ...Object.keys(mainGamePoints),
      ...Object.keys(skinsByPlayer),
      ...Object.keys(strokePlayByPlayer)
    ]);

    for (const uid of allUids) {
      // For exclusion games: allocation points (from allocateStrokePlayPoints) include
      // participation and account for the reduced board — use them directly for both
      // gross-assigned and net-assigned players instead of mainGamePoints (full board).
      let exclusionAssigned = false;
      let exclusionTotal = 0;
      for (const sg of exclusionSideGames) {
        const alloc = strokePlayByPlayer[uid]?.[sg.id];
        if (alloc) {
          exclusionAssigned = true;
          exclusionTotal += alloc.points;
        }
      }
      const base = exclusionAssigned ? exclusionTotal : (mainGamePoints[uid] || 0);
      const skinsTotal = Object.values(skinsByPlayer[uid] || {}).reduce((s, v) => s + v, 0);
      const fullFieldTotal = strokePlaySideGames
        .filter(sg => sg.competitionMode !== 'main_game_exclusion')
        .reduce((sum, sg) => sum + (strokePlayByPlayer[uid]?.[sg.id]?.points || 0), 0);
      combinedPoints[uid] = base + skinsTotal + fullFieldTotal;
    }

    const breakdowns = {};
    for (const uid of allUids) {
      const skinsTotal = Object.values(skinsByPlayer[uid] || {}).reduce((s, v) => s + v, 0);
      const strokePlayBreakdown = {};

      // Find this player's exclusion allocation (if any)
      let exclusionAlloc = null;
      let exclusionSg = null;
      for (const sg of exclusionSideGames) {
        const alloc = strokePlayByPlayer[uid]?.[sg.id];
        if (alloc) { exclusionAlloc = alloc; exclusionSg = sg; break; }
      }

      let mainGameDisplay, participationDisplay;
      if (exclusionAlloc) {
        // allocation points include participation; split it out for clean display
        const posPts = exclusionAlloc.points - participationPts;
        if (exclusionAlloc.competition === 'gross') {
          mainGameDisplay = posPts;
          participationDisplay = participationPts;
        } else {
          mainGameDisplay = 0;
          participationDisplay = participationPts;
          strokePlayBreakdown[exclusionSg.id] = { competition: 'net', points: posPts };
        }
      } else {
        const mainTotal = mainGamePoints[uid] || 0;
        // calculateEventPoints bundles participation into the total; strip it out so it
        // doesn't double-count with the separate participation line in the breakdown.
        mainGameDisplay = mainTotal > 0 ? Math.max(0, mainTotal - participationPts) : 0;
        participationDisplay = mainTotal > 0 ? participationPts : 0;
      }

      for (const sg of strokePlaySideGames) {
        if (sg.competitionMode === 'main_game_exclusion') continue;
        const alloc = strokePlayByPlayer[uid]?.[sg.id];
        if (alloc) strokePlayBreakdown[sg.id] = alloc;
      }

      breakdowns[uid] = {
        mainGame: mainGameDisplay,
        participation: participationDisplay,
        skins: skinsByPlayer[uid] || {},
        strokePlay: strokePlayBreakdown,
        total: combinedPoints[uid] || 0
      };
    }

    await writeStandingsToFirebase(lpMeta.leagueId, lpMeta.seasonId, currentEvent.id, combinedPoints, breakdowns);
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
        await runLeaguePointsCalc();
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

  const handleRecalculate = async () => {
    setFeedback('Recalculating league standings...');
    try {
      await runLeaguePointsCalc();
      setFeedback('League standings recalculated!');
    } catch (err) {
      console.error('Error recalculating standings:', err);
      setFeedback('Error recalculating. Try again.');
    }
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleResolveGrossNet = async () => {
    const lpMeta = currentEvent.meta || {};
    const sideGames = lpMeta.sideGames || [];
    const leaderboard = buildSortedLeaderboard();

    let leagueMembersData = null;
    try {
      const membersSnap = await get(ref(database, `leagues/${lpMeta.leagueId}/members`));
      leagueMembersData = membersSnap.val();
    } catch (err) {
      console.error('Error loading league members for Gross/Net resolve:', err);
    }

    const exclusionGames = sideGames.filter(
      sg => sg.sideGameType === 'stroke_play' && sg.competitionMode === 'main_game_exclusion'
    );

    const participationPts = lpMeta.leaguePoints?.participationPoints || 0;
    const results = [];
    for (const sg of exclusionGames) {
      const allocation = allocateStrokePlayPoints(
        leaderboard, lpMeta.leaguePoints, sg,
        currentEvent.players || {}, leagueMembersData
      );
      results.push({ sg, allocation, participationPts });
    }

    setGrossNetResult(results);
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
            {isHost && eventStatus === 'completed' && isLeagueEvent && (
              <button
                onClick={handleRecalculate}
                className="w-full bg-[#00285e] hover:bg-[#003a7a] text-white py-3 rounded-xl font-semibold transition-all mb-4"
              >
                🔄 Recalculate League Points
              </button>
            )}
            {isHost && isLeagueEvent && hasGrossNetSideGame && (
              <button
                onClick={handleResolveGrossNet}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-semibold transition-all mb-4"
              >
                ⚖️ Resolve Gross/Net
              </button>
            )}
            {grossNetResult && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 text-base">Gross/Net Allocation</h3>
                  <button
                    onClick={() => setGrossNetResult(null)}
                    className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                  >
                    ✕ Close
                  </button>
                </div>
                {grossNetResult.map(({ sg, allocation, participationPts: ppts }) => (
                  <div key={sg.id} className="mb-4 last:mb-0">
                    <div className="text-xs font-semibold text-[#00285e] uppercase tracking-wide mb-2">{sg.name}</div>
                    <div className="space-y-2">
                      {Object.entries(allocation)
                        .sort(([, a], [, b]) => b.points - a.points)
                        .map(([uid, { competition, points }]) => {
                          const playerName = players.find(p => p.uid === uid)?.displayName || 'Unknown';
                          const positionPts = Math.round((points - ppts) * 10) / 10;
                          return (
                            <div key={uid} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${competition === 'net' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                                  {competition === 'net' ? 'NET' : 'GROSS'}
                                </span>
                                <span className="text-sm text-gray-900">{playerName}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-bold text-[#00285e]">{positionPts} pts</span>
                                {ppts > 0 && (
                                  <span className="text-xs text-gray-400 ml-1">+{ppts} par</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                  Each player competes on whichever board awards more points. Gross wins ties.
                </div>
              </div>
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

            {/* Wolf Setup Section */}
            {isWolfFormat && isHost && (eventStatus === 'open' || eventStatus === 'active') && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-gray-900">Wolf Tee Order</h3>
                  {wolfPlayerOrder.length === wolfPlayerCount
                    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">Set</span>
                    : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">Required</span>
                  }
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Set the order players tee off. The Wolf rotates each hole based on this order.
                </p>

                {/* Build ordered player list — start from wolfPlayerOrder if set, else use players */}
                {(() => {
                  const orderedUids = wolfPlayerOrder.length === wolfPlayerCount
                    ? wolfPlayerOrder
                    : players.map(p => p.uid);
                  const playerMap = Object.fromEntries(players.map(p => [p.uid, p]));
                  return (
                    <div className="space-y-2 mb-4">
                      {orderedUids.map((uid, idx) => {
                        const player = playerMap[uid];
                        if (!player) return null;
                        return (
                          <div key={uid} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                            <span className="text-sm font-bold text-gray-400 w-5">{idx + 1}</span>
                            <div className="w-8 h-8 rounded-full bg-[#00285e] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                              {(player.displayName || '?').charAt(0).toUpperCase()}
                            </div>
                            <span className="flex-1 text-sm font-medium text-gray-900">{player.displayName}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => idx > 0 && handleWolfReorder(idx, idx - 1)}
                                disabled={idx === 0}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-20 transition-colors"
                              >▲</button>
                              <button
                                onClick={() => idx < orderedUids.length - 1 && handleWolfReorder(idx, idx + 1)}
                                disabled={idx === orderedUids.length - 1}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-20 transition-colors"
                              >▼</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Initialize order button if not yet set */}
                {wolfPlayerOrder.length !== wolfPlayerCount && players.length === wolfPlayerCount && (
                  <button
                    onClick={async () => {
                      const order = players.map(p => p.uid);
                      await set(ref(database, `events/${currentEvent.id}/meta/wolfPlayerOrder`), order);
                    }}
                    className="w-full mb-4 py-2 rounded-xl bg-[#f0f4ff] text-[#00285e] text-sm font-semibold hover:bg-[#e8eef8] transition-all"
                  >
                    Use Current Player Order
                  </button>
                )}
                {players.length !== wolfPlayerCount && (
                  <p className="text-xs text-amber-600 mb-4">
                    Need exactly {wolfPlayerCount} players for this Wolf format ({players.length} currently joined)
                  </p>
                )}

                {/* Hole rotation preview */}
                {wolfPlayerOrder.length === wolfPlayerCount && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Wolf Rotation Preview</p>
                    <div className="flex flex-wrap gap-2">
                      {wolfHoleOrder.slice(0, 9).map(holeNum => {
                        const wolfUid = wolfPlayerOrder[(holeNum - 1) % wolfPlayerCount];
                        const wolfName = players.find(p => p.uid === wolfUid)?.displayName || '?';
                        return (
                          <div key={holeNum} className="bg-gray-50 rounded-lg px-3 py-1.5 text-xs">
                            <span className="text-gray-400 font-medium">H{holeNum} </span>
                            <span className="text-gray-900 font-semibold">{wolfName.split(' ')[0]}</span>
                          </div>
                        );
                      })}
                      {wolfHoleOrder.length > 9 && (
                        <div className="text-xs text-gray-400 self-center">+ {wolfHoleOrder.length - 9} more...</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Wolf Setup — read-only view for non-hosts */}
            {isWolfFormat && !isHost && wolfPlayerOrder.length === wolfPlayerCount && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Wolf Tee Order</h3>
                <div className="flex flex-wrap gap-2">
                  {wolfPlayerOrder.map((uid, idx) => {
                    const name = players.find(p => p.uid === uid)?.displayName || '?';
                    return (
                      <div key={uid} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-1.5 text-xs">
                        <span className="text-gray-400 font-medium">{idx + 1}.</span>
                        <span className="text-gray-900 font-semibold">{name}</span>
                      </div>
                    );
                  })}
                </div>
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
