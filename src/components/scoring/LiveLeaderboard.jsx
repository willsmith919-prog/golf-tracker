import { useState } from 'react';
import { calculateStablefordPoints } from '../../utils/scoring';
import { buildHoleOrder } from '../../utils/holes';
import { getPlayerCourseHandicap, getStrokeHoles, getNetScore } from '../../utils/handicap';
import { sortLeaderboard, assignPositions } from '../../utils/leaderboard';
import ThroughHoleFilter from './ThroughHoleFilter';
import LeaderboardRow from './LeaderboardRow';
import LeagueStandingsPanel from './LeagueStandingsPanel';
import SideGameLeaderboard from './SideGameLeaderboard';
import VegasLeaderboard from './VegasLeaderboard';
import MatchPlayLeaderboard from './MatchPlayLeaderboard';
import TeamMatchPlayLeaderboard from './TeamMatchPlayLeaderboard';
import { calcWolfTotals } from '../../utils/wolfScoring';

// ============================================================
// LIVE LEADERBOARD COMPONENT
// Shows real-time scores for all players/teams in an active event.
//
// This component does NOT set up its own Firebase listener —
// it receives the already-live `currentEvent` from EventLobbyView,
// which already has an onValue listener that updates whenever
// any scores change.
//
// Supports both team formats (reads from currentEvent.teams)
// and individual formats (reads from currentEvent.players).
//
// Props:
//   currentEvent  — the full event object (meta + players + teams)
//   currentUser   — the logged-in user (for highlighting "you")
//   setSelectedTeam / setView — for navigating to scoring
// ============================================================

export default function LiveLeaderboard({
  currentEvent,
  currentUser,
  setSelectedTeam,
  setView
}) {
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [throughHole, setThroughHole] = useState(null);
  const [showAllHoles, setShowAllHoles] = useState(false);
  const [activeGameTab, setActiveGameTab] = useState('main');
  const [sortOverride, setSortOverride] = useState(null);

  const meta = currentEvent?.meta || {};
  const players = currentEvent?.players || {};
  const teams = currentEvent?.teams || {};
  const coursePars = meta.coursePars || [];
  const display = meta.display || {};
  const numHoles = meta.numHoles || 18;
  const startingHole = meta.startingHole || 1;
  const teamSize = meta.teamSize || 1;

  const sideGames = meta.sideGames || [];
  const hasSideGames = sideGames.length > 0;

  const isTeamFormat = teamSize > 1 && Object.keys(teams).length > 0;
  const applicationMethod = meta.handicap?.applicationMethod || 'strokes';
  const isStartingScore = applicationMethod === 'starting_score';
  const teamMethod = meta.handicap?.teamHandicapMethod || 'average';
  const usesMulligans = meta.handicap?.enabled && applicationMethod === 'mulligans';

  // ==================== LEAGUE EVENT DETECTION ====================
  const leaguePoints = meta.leaguePoints || null;
  const leagueId = meta.leagueId || null;
  const seasonId = meta.seasonId || null;
  const isLeagueEvent = !!(leaguePoints && leagueId && seasonId);
  const isWolfFormat = meta.competition?.structure === 'wolf';
  const isMatchPlayTeams = meta.scoringMethod === 'match_play' && (meta.teamSize || 1) !== 1;
  const hasTabs = hasSideGames || isLeagueEvent || isWolfFormat;

  // ==================== MATCH PLAY DETECTION ====================
  const isMatchPlay1v1 = meta.scoringMethod === 'match_play' && (meta.teamSize || 1) === 1;

  // ==================== HOLE ORDER ====================
  const holeOrder = buildHoleOrder(numHoles, startingHole);
  const first9 = numHoles === 18 ? holeOrder.slice(0, 9) : holeOrder;
  const second9 = numHoles === 18 ? holeOrder.slice(9, 18) : [];

  // ==================== HANDICAP CALCULATIONS ====================
  const handicapEnabled = meta.handicap?.enabled || false;
  const coursePar = coursePars.reduce((sum, p) => sum + (p || 0), 0);
  const useSlope = meta.handicap?.useSlope ?? true;

  const handicapConfig = {
    handicapEnabled,
    courseSlope: useSlope ? (meta.courseSlope || null) : null,
    courseRating: useSlope ? (meta.courseRating || null) : null,
    coursePar,
    handicapAllowance: meta.handicap?.allowance || 100,
    courseStrokeIndexes: meta.courseStrokeIndexes || []
  };

  // Net side game support: compute stroke holes even when main game is gross
  const hasNetSideGame = sideGames.some(sg => sg.variant === 'net');
  const netHandicapConfig = hasNetSideGame
    ? { ...handicapConfig, handicapEnabled: true }
    : handicapConfig;

  // ==================== BUILD LEADERBOARD DATA ====================

  let leaderboardData = [];

  if (isTeamFormat) {
    leaderboardData = Object.entries(teams).map(([teamId, team]) => {
      const stats = team.stats || {};
      const holesPlayed = stats.holesPlayed || 0;
      const totalScore = stats.totalScore || 0;
      const toPar = stats.toPar || 0;

      const memberNames = Object.keys(team.members || {}).map(uid =>
        players[uid]?.displayName || 'Unknown'
      );

      const isMyTeam = team.members && team.members[currentUser?.uid];

      const memberHandicaps = Object.keys(team.members || {})
        .map(uid => players[uid]?.handicap)
        .filter(h => h != null);

      let teamBaseHandicap;
      let effectiveAllowance;
      if (teamMethod === 'usga_scramble' && memberHandicaps.length === 2) {
        const sorted = [...memberHandicaps].sort((a, b) => a - b);
        teamBaseHandicap = (sorted[0] * 0.35) + (sorted[1] * 0.15);
        effectiveAllowance = 100;
      } else {
        teamBaseHandicap = memberHandicaps.length > 0
          ? memberHandicaps.reduce((sum, h) => sum + h, 0) / memberHandicaps.length
          : null;
        effectiveAllowance = meta.handicap?.allowance || 100;
      }

      const courseHandicap = getPlayerCourseHandicap(teamBaseHandicap, {
        ...handicapConfig,
        handicapAllowance: effectiveAllowance
      });
      const netTeamConfig = { ...netHandicapConfig, handicapAllowance: effectiveAllowance };
      const netCourseHandicap = hasNetSideGame
        ? getPlayerCourseHandicap(teamBaseHandicap, netTeamConfig)
        : courseHandicap;
      const strokeHoles = isStartingScore ? {} : getStrokeHoles(netCourseHandicap, netTeamConfig);

      let netTotal = 0;
      let netToPar = 0;
      let parForPlayed = 0;

      if (handicapEnabled || hasNetSideGame) {
        if (isStartingScore) {
          netToPar = toPar - courseHandicap;
        } else if (holesPlayed > 0) {
          for (const holeNum of holeOrder) {
            const holeScore = team.scores?.[holeNum] || team.holes?.[holeNum]?.score;
            if (holeScore) {
              netTotal += getNetScore(holeScore, holeNum, strokeHoles, true);
              parForPlayed += coursePars[holeNum - 1] || 0;
            }
          }
          netToPar = netTotal - parForPlayed;
        }
      }

      return {
        id: teamId,
        displayName: team.name || 'Unnamed Team',
        subtitle: memberNames.join(' & '),
        isMyEntry: isMyTeam,
        role: null,
        handicap: teamBaseHandicap,
        courseHandicap,
        strokeHoles,
        currentHole: team.currentHole || startingHole,
        holesPlayed,
        totalScore,
        toPar,
        netTotal,
        netToPar,
        scores: team.scores || {},
        holes: team.holes || {},
        stablefordPoints: stats.stablefordPoints || 0,
        mulligansTotal: team.mulligansTotal || 0,
        mulligansRemaining: team.mulligansRemaining ?? (team.mulligansTotal || 0),
        mulliganLog: team.mulliganLog || {}
      };
    });
  } else {
    leaderboardData = Object.entries(players).map(([uid, player]) => {
      const stats = player.stats || {};
      const holesPlayed = stats.holesPlayed || 0;
      const totalScore = stats.totalScore || 0;
      const toPar = stats.toPar || 0;

      const courseHandicap = getPlayerCourseHandicap(player.handicap, handicapConfig);
      const netCourseHandicap = hasNetSideGame
        ? getPlayerCourseHandicap(player.handicap, netHandicapConfig)
        : courseHandicap;
      const strokeHoles = isStartingScore ? {} : getStrokeHoles(netCourseHandicap, netHandicapConfig);

      let netTotal = 0;
      let netToPar = 0;
      let parForPlayed = 0;

      if (handicapEnabled || hasNetSideGame) {
        if (isStartingScore) {
          netToPar = toPar - courseHandicap;
        } else if (holesPlayed > 0) {
          for (const holeNum of holeOrder) {
            const holeScore = player.scores?.[holeNum] || player.holes?.[holeNum]?.score;
            if (holeScore) {
              netTotal += getNetScore(holeScore, holeNum, strokeHoles, true);
              parForPlayed += coursePars[holeNum - 1] || 0;
            }
          }
          netToPar = netTotal - parForPlayed;
        }
      }

      return {
        id: uid,
        displayName: player.displayName || 'Unknown',
        subtitle: null,
        isMyEntry: uid === currentUser?.uid,
        role: player.role,
        handicap: player.handicap,
        courseHandicap,
        strokeHoles,
        currentHole: player.currentHole || startingHole,
        holesPlayed,
        totalScore,
        toPar,
        netTotal,
        netToPar,
        scores: player.scores || {},
        holes: player.holes || {},
        stablefordPoints: stats.stablefordPoints || 0,
        mulligansTotal: player.mulligansTotal || 0,
        mulligansRemaining: player.mulligansRemaining ?? (player.mulligansTotal || 0),
        mulliganLog: player.mulliganLog || {}
      };
    });
  }

  // ==================== DETECT CURRENT USER'S PROGRESS ====================
  const myEntry = leaderboardData.find(e => e.isMyEntry);
  const myHolesPlayed = myEntry?.holesPlayed || 0;
  const myThroughHole = myHolesPlayed > 0 && myHolesPlayed <= holeOrder.length
    ? holeOrder[myHolesPlayed - 1]
    : null;

  // ==================== "THROUGH HOLE X" FILTER ====================
  if (throughHole !== null) {
    const throughIndex = holeOrder.indexOf(throughHole);
    const includedHoles = throughIndex >= 0 ? holeOrder.slice(0, throughIndex + 1) : holeOrder;

    leaderboardData = leaderboardData.map(entry => {
      let filteredScore = 0;
      let filteredPar = 0;
      let filteredHolesPlayed = 0;
      let filteredNetTotal = 0;
      let filteredStableford = 0;

      for (const holeNum of includedHoles) {
        const holeScore = entry.scores[holeNum] || entry.holes[holeNum]?.score;
        if (holeScore) {
          filteredHolesPlayed++;
          filteredScore += holeScore;
          const par = coursePars[holeNum - 1] || 0;
          filteredPar += par;

          if ((handicapEnabled || hasNetSideGame) && !isStartingScore) {
            filteredNetTotal += getNetScore(holeScore, holeNum, entry.strokeHoles, true);
          }

          if (meta.scoringMethod === 'stableford') {
            filteredStableford += calculateStablefordPoints(holeScore, par + (entry.strokeHoles[holeNum] || 0));
          }
        }
      }

      return {
        ...entry,
        totalScore: filteredScore,
        toPar: filteredScore - filteredPar,
        holesPlayed: filteredHolesPlayed,
        netTotal: isStartingScore ? filteredScore : filteredNetTotal,
        netToPar: isStartingScore
          ? (filteredScore - filteredPar) - entry.courseHandicap
          : filteredNetTotal - filteredPar,
        stablefordPoints: filteredStableford
      };
    });
  }

  // ==================== SORTING ====================
  const metaPrimarySort = display.primarySort || 'gross';
  const primarySort = sortOverride ?? metaPrimarySort;
  const sortOpts = { scoringMethod: meta.scoringMethod, primarySort, handicapEnabled };
  const isStableford = meta.scoringMethod === 'stableford';
  if (!isMatchPlay1v1 && !isMatchPlayTeams) {
    sortLeaderboard(leaderboardData, sortOpts);
    assignPositions(leaderboardData, sortOpts);
  }

  // ==================== RENDER ====================

  // Match play 1v1 — render dedicated view (no normal leaderboard needed)
  if (isMatchPlay1v1) {
    return (
      <div>
        {hasTabs && (
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto gap-1">
            <button
              onClick={() => setActiveGameTab('main')}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeGameTab === 'main' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              ⚔️ Match Play
            </button>
            {sideGames.map((sg) => {
              const shortName = sg.name.replace(/\s*\([^)]*\)/g, '').trim() || sg.name;
              return (
                <button key={sg.id} onClick={() => setActiveGameTab(sg.id)}
                  title={sg.name}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    activeGameTab === sg.id ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                  }`}
                >
                  🎯 {shortName}
                </button>
              );
            })}
          </div>
        )}

        {activeGameTab === 'main' && (
          <MatchPlayLeaderboard
            leaderboardData={leaderboardData}
            currentEvent={currentEvent}
            currentUser={currentUser}
          />
        )}

        {hasSideGames && activeGameTab !== 'main' && (() => {
          const sg = sideGames.find(s => s.id === activeGameTab);
          if (!sg) return null;
          if (sg.sideGameType === 'vegas') {
            return (
              <VegasLeaderboard
                sideGame={sg}
                currentEvent={currentEvent}
                currentUser={currentUser}
              />
            );
          }
          return (
            <SideGameLeaderboard
              sideGame={sg}
              leaderboardEntries={leaderboardData}
              currentEvent={currentEvent}
              currentUser={currentUser}
              players={players}
            />
          );
        })()}
      </div>
    );
  }

  // Team match play — render dedicated team match view
  if (isMatchPlayTeams) {
    return (
      <div>
        {hasSideGames && (
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto gap-1">
            <button
              onClick={() => setActiveGameTab('main')}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeGameTab === 'main' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              ⚔️ Match Play
            </button>
            {sideGames.map((sg) => {
              const shortName = sg.name.replace(/\s*\([^)]*\)/g, '').trim() || sg.name;
              return (
                <button key={sg.id} onClick={() => setActiveGameTab(sg.id)}
                  title={sg.name}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    activeGameTab === sg.id ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                  }`}
                >
                  🎯 {shortName}
                </button>
              );
            })}
          </div>
        )}

        {activeGameTab === 'main' && (
          <TeamMatchPlayLeaderboard
            leaderboardData={leaderboardData}
            currentEvent={currentEvent}
            currentUser={currentUser}
          />
        )}

        {hasSideGames && activeGameTab !== 'main' && (() => {
          const sg = sideGames.find(s => s.id === activeGameTab);
          if (!sg) return null;
          if (sg.sideGameType === 'vegas') {
            return (
              <VegasLeaderboard
                sideGame={sg}
                currentEvent={currentEvent}
                currentUser={currentUser}
              />
            );
          }
          return (
            <SideGameLeaderboard
              sideGame={sg}
              leaderboardEntries={leaderboardData}
              currentEvent={currentEvent}
              currentUser={currentUser}
              players={players}
            />
          );
        })()}
      </div>
    );
  }

  if (leaderboardData.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🏌️</div>
        <p className="text-gray-600">
          {isTeamFormat ? 'No teams in this event yet.' : 'No players in this event yet.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Game tab bar — shown when side games or league standings exist */}
      {hasTabs && (
        <div className="flex bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto gap-1">
          <button
            onClick={() => setActiveGameTab('main')}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeGameTab === 'main'
                ? 'bg-white text-gray-900 shadow-md'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            🏌️ Main Game
          </button>
          {sideGames.map((sg) => {
            const shortName = sg.name.replace(/\s*\([^)]*\)/g, '').trim() || sg.name;
            return (
              <button
                key={sg.id}
                onClick={() => setActiveGameTab(sg.id)}
                title={sg.name}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeGameTab === sg.id
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
              >
                🎯 {shortName}
              </button>
            );
          })}
          {isLeagueEvent && (
            <button
              onClick={() => setActiveGameTab('standings')}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeGameTab === 'standings'
                  ? 'bg-white text-gray-900 shadow-md'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              🏆 League
            </button>
          )}
          {isWolfFormat && (
            <button
              onClick={() => setActiveGameTab('wolf')}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeGameTab === 'wolf'
                  ? 'bg-white text-gray-900 shadow-md'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              🐺 Wolf
            </button>
          )}
        </div>
      )}

      {/* League standings tab content */}
      {isLeagueEvent && activeGameTab === 'standings' && (
        <LeagueStandingsPanel
          leagueId={leagueId}
          seasonId={seasonId}
          leaguePoints={leaguePoints}
          leaderboardData={leaderboardData}
          teams={teams}
          teamSize={teamSize}
          players={players}
          currentEventId={currentEvent?.id}
          sideGames={sideGames}
          holeOrder={holeOrder}
          coursePars={coursePars}
          inline={true}
        />
      )}

      {/* Side game tab content */}
      {hasSideGames && activeGameTab !== 'main' && activeGameTab !== 'standings' && (() => {
        const sg = sideGames.find(s => s.id === activeGameTab);
        if (!sg) return null;
        if (sg.sideGameType === 'vegas') {
          return (
            <VegasLeaderboard
              sideGame={sg}
              currentEvent={currentEvent}
              currentUser={currentUser}
            />
          );
        }
        return (
          <SideGameLeaderboard
            sideGame={sg}
            leaderboardEntries={leaderboardData}
            currentEvent={currentEvent}
            currentUser={currentUser}
            players={players}
          />
        );
      })()}

      {/* Main game content — hidden when on a side game or standings tab */}
      {activeGameTab === 'main' && <>

      {/* Leaderboard Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Live Leaderboard</h2>
        <div className="flex items-center gap-2">
          {handicapEnabled && (
            sortOverride === 'gross' ? (
              <button
                onClick={() => setSortOverride(null)}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full hover:bg-gray-200 transition-colors font-medium"
              >
                ← Net Scores
              </button>
            ) : (
              <button
                onClick={() => setSortOverride('gross')}
                className="text-xs bg-[#f0f4ff] text-[#00285e] px-2 py-1 rounded-full hover:bg-[#00285e] hover:text-white transition-colors font-medium"
              >
                View Gross Scores
              </button>
            )
          )}
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {meta.formatName || meta.format}
          </span>
        </div>
      </div>

      {sortOverride === 'gross' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700 text-center">
          Reference only · gross scores don't affect standings or league points
        </div>
      )}

      <ThroughHoleFilter
        throughHole={throughHole}
        setThroughHole={setThroughHole}
        showAllHoles={showAllHoles}
        setShowAllHoles={setShowAllHoles}
        holeOrder={holeOrder}
        numHoles={numHoles}
        myThroughHole={myThroughHole}
        myHolesPlayed={myHolesPlayed}
      />

      {/* Column headers */}
      <div className="grid grid-cols-[32px_1fr_60px_60px_48px] items-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <div>{sortOverride !== 'gross' && '#'}</div>
        <div>{isTeamFormat ? 'Team' : 'Player'}</div>
        <div className="text-center">
          {isStableford && primarySort !== 'gross' ? 'Pts' : display.showRelativeToPar !== false ? (primarySort === 'net' && handicapEnabled ? 'Net' : 'To Par') : 'Score'}
        </div>
        {sortOverride === 'gross' && isStableford ? (
          <div className="text-center text-gray-400">Strokes</div>
        ) : (!isStableford && handicapEnabled && display.showNet !== false && display.showGross !== false) ? (
          <div className="text-center text-gray-400">
            {primarySort === 'net' ? 'Gross' : 'Net'}
          </div>
        ) : null}
        <div className="text-center">Thru</div>
      </div>

      {/* Leaderboard rows */}
      <div className="space-y-2">
        {leaderboardData.map((entry) => (
          <LeaderboardRow
            key={entry.id}
            entry={entry}
            isExpanded={expandedEntry === entry.id}
            onToggleExpand={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
            isTeamFormat={isTeamFormat}
            handicapEnabled={handicapEnabled}
            display={display}
            primarySort={primarySort}
            isStableford={isStableford}
            hideRank={sortOverride === 'gross'}
            numHoles={numHoles}
            throughHole={throughHole}
            holeOrder={holeOrder}
            usesMulligans={usesMulligans}
            players={players}
            first9={first9}
            second9={second9}
            startingHole={startingHole}
            coursePars={coursePars}
            scoringMethod={meta.scoringMethod}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-400 justify-center">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-green-100"></span> Under par
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-100"></span> Over par
        </span>
        {handicapEnabled && !isStartingScore && display.showStrokeHoles !== false && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00285e]"></span> = 1 stroke
            <span className="ml-1 inline-flex gap-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00285e]"></span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00285e]"></span>
            </span> = 2 strokes
          </span>
        )}
        {isStartingScore && handicapEnabled && (
          <span>Starting score = handicap strokes under par</span>
        )}
        <span>F = Finished</span>
        {usesMulligans && (
          <span className="flex items-center gap-1">
            <span className="text-[#00285e]">🎟️</span> Mulligan
          </span>
        )}
      </div>

      </>}
    </div>
  );
}
