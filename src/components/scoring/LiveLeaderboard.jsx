import { useState } from 'react';
import { calculateStablefordPoints } from '../../utils/scoring';
import { buildHoleOrder } from '../../utils/holes';
import { getPlayerCourseHandicap, getStrokeHoles, getNetScore } from '../../utils/handicap';
import { sortLeaderboard, assignPositions } from '../../utils/leaderboard';
import ThroughHoleFilter from './ThroughHoleFilter';
import LeaderboardRow from './LeaderboardRow';
import LeagueStandingsPanel from './LeagueStandingsPanel';

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

  const meta = currentEvent?.meta || {};
  const players = currentEvent?.players || {};
  const teams = currentEvent?.teams || {};
  const coursePars = meta.coursePars || [];
  const display = meta.display || {};
  const numHoles = meta.numHoles || 18;
  const startingHole = meta.startingHole || 1;
  const teamSize = meta.teamSize || 1;

  const isTeamFormat = teamSize > 1 && Object.keys(teams).length > 0;
  const usesMulligans = meta.handicap?.enabled && meta.handicap?.applicationMethod === 'mulligans';

  // ==================== LEAGUE EVENT DETECTION ====================
  const leaguePoints = meta.leaguePoints || null;
  const leagueId = meta.leagueId || null;
  const seasonId = meta.seasonId || null;
  const isLeagueEvent = !!(leaguePoints && leagueId && seasonId);

  // ==================== HOLE ORDER ====================
  const holeOrder = buildHoleOrder(numHoles, startingHole);
  const first9 = numHoles === 18 ? holeOrder.slice(0, 9) : holeOrder;
  const second9 = numHoles === 18 ? holeOrder.slice(9, 18) : [];

  // ==================== HANDICAP CALCULATIONS ====================
  const handicapEnabled = meta.handicap?.enabled || false;
  const coursePar = coursePars.reduce((sum, p) => sum + (p || 0), 0);

  const handicapConfig = {
    handicapEnabled,
    courseSlope: meta.courseSlope || null,
    courseRating: meta.courseRating || null,
    coursePar,
    handicapAllowance: meta.handicap?.allowance || 100,
    courseStrokeIndexes: meta.courseStrokeIndexes || []
  };

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
      const avgHandicap = memberHandicaps.length > 0
        ? memberHandicaps.reduce((sum, h) => sum + h, 0) / memberHandicaps.length
        : null;

      const courseHandicap = getPlayerCourseHandicap(avgHandicap, handicapConfig);
      const strokeHoles = getStrokeHoles(courseHandicap, handicapConfig);

      let netTotal = 0;
      let netToPar = 0;
      let parForPlayed = 0;

      if (handicapEnabled && holesPlayed > 0) {
        for (const holeNum of holeOrder) {
          const holeScore = team.scores?.[holeNum] || team.holes?.[holeNum]?.score;
          if (holeScore) {
            netTotal += getNetScore(holeScore, holeNum, strokeHoles, handicapEnabled);
            parForPlayed += coursePars[holeNum - 1] || 0;
          }
        }
        netToPar = netTotal - parForPlayed;
      }

      return {
        id: teamId,
        displayName: team.name || 'Unnamed Team',
        subtitle: memberNames.join(' & '),
        isMyEntry: isMyTeam,
        role: null,
        handicap: avgHandicap,
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
      const strokeHoles = getStrokeHoles(courseHandicap, handicapConfig);

      let netTotal = 0;
      let netToPar = 0;
      let parForPlayed = 0;

      if (handicapEnabled && holesPlayed > 0) {
        for (const holeNum of holeOrder) {
          const holeScore = player.scores?.[holeNum] || player.holes?.[holeNum]?.score;
          if (holeScore) {
            netTotal += getNetScore(holeScore, holeNum, strokeHoles, handicapEnabled);
            parForPlayed += coursePars[holeNum - 1] || 0;
          }
        }
        netToPar = netTotal - parForPlayed;
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

          if (handicapEnabled) {
            filteredNetTotal += getNetScore(holeScore, holeNum, entry.strokeHoles, handicapEnabled);
          }

          if (meta.scoringMethod === 'stableford') {
            filteredStableford += calculateStablefordPoints(holeScore, par);
          }
        }
      }

      return {
        ...entry,
        totalScore: filteredScore,
        toPar: filteredScore - filteredPar,
        holesPlayed: filteredHolesPlayed,
        netTotal: filteredNetTotal,
        netToPar: filteredNetTotal - filteredPar,
        stablefordPoints: filteredStableford
      };
    });
  }

  // ==================== SORTING ====================
  const primarySort = display.primarySort || 'gross';
  const sortOpts = { scoringMethod: meta.scoringMethod, primarySort, handicapEnabled };
  const isStableford = meta.scoringMethod === 'stableford';
  sortLeaderboard(leaderboardData, sortOpts);
  assignPositions(leaderboardData, sortOpts);

  // ==================== RENDER ====================

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
      {/* Leaderboard Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Live Leaderboard</h2>
        <div className="flex items-center gap-2">
          {handicapEnabled && (
            <span className="text-xs bg-[#f0f4ff] text-[#00285e] px-2 py-1 rounded-full">
              {primarySort === 'net' ? 'Net' : 'Gross'}
            </span>
          )}
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {meta.formatName || meta.format}
          </span>
        </div>
      </div>

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
        <div>#</div>
        <div>{isTeamFormat ? 'Team' : 'Player'}</div>
        <div className="text-center">
          {isStableford ? 'Pts' : display.showRelativeToPar !== false ? (primarySort === 'net' && handicapEnabled ? 'Net' : 'To Par') : 'Score'}
        </div>
        {!isStableford && handicapEnabled && display.showNet !== false && display.showGross !== false && (
          <div className="text-center text-gray-400">
            {primarySort === 'net' ? 'Gross' : 'Net'}
          </div>
        )}
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

      {isLeagueEvent && (
        <LeagueStandingsPanel
          leagueId={leagueId}
          seasonId={seasonId}
          leaguePoints={leaguePoints}
          leaderboardData={leaderboardData}
          teams={teams}
          teamSize={teamSize}
          players={players}
          currentEventId={currentEvent?.id}
        />
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-400 justify-center">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-green-100"></span> Under par
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-100"></span> Over par
        </span>
        {handicapEnabled && display.showStrokeHoles !== false && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00285e]"></span> = 1 stroke
            <span className="ml-1 inline-flex gap-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00285e]"></span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00285e]"></span>
            </span> = 2 strokes
          </span>
        )}
        <span>F = Finished</span>
        {usesMulligans && (
          <span className="flex items-center gap-1">
            <span className="text-[#00285e]">🎟️</span> Mulligan
          </span>
        )}
      </div>
    </div>
  );
}
