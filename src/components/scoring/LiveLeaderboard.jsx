import { useState } from 'react';

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

  const meta = currentEvent?.meta || {};
  const players = currentEvent?.players || {};
  const teams = currentEvent?.teams || {};
  const coursePars = meta.coursePars || [];
  const display = meta.display || {};
  const numHoles = meta.numHoles || 18;
  const startingHole = meta.startingHole || 1;
  const teamSize = meta.teamSize || 1;

  // Is this a team format? Is format using Mulligans?
  const isTeamFormat = teamSize > 1 && Object.keys(teams).length > 0;
  const usesMulligans = meta.handicap?.enabled && meta.handicap?.applicationMethod === 'mulligans';

  // ==================== HOLE ORDER ====================
  const buildHoleOrder = () => {
    const holes = [];
    for (let i = 0; i < numHoles; i++) {
      holes.push(((startingHole - 1 + i) % 18) + 1);
    }
    return holes;
  };

  const holeOrder = buildHoleOrder();
  const first9 = numHoles === 18 ? holeOrder.slice(0, 9) : holeOrder;
  const second9 = numHoles === 18 ? holeOrder.slice(9, 18) : [];

  // ==================== HANDICAP CALCULATIONS ====================
  const handicapEnabled = meta.handicap?.enabled || false;
  const handicapAllowance = meta.handicap?.allowance || 100;
  const courseStrokeIndexes = meta.courseStrokeIndexes || [];

  const getPlayerCourseHandicap = (playerHandicap) => {
    if (!handicapEnabled || playerHandicap == null) return 0;
    return Math.round(playerHandicap * (handicapAllowance / 100));
  };

  const getStrokeHoles = (courseHandicap) => {
    if (!handicapEnabled || courseHandicap <= 0 || courseStrokeIndexes.length === 0) return {};
    const strokes = {};
    for (let s = 1; s <= courseHandicap; s++) {
      const targetSI = ((s - 1) % 18) + 1;
      const holeIndex = courseStrokeIndexes.indexOf(targetSI);
      if (holeIndex !== -1) {
        const holeNum = holeIndex + 1;
        strokes[holeNum] = (strokes[holeNum] || 0) + 1;
      }
    }
    return strokes;
  };

  const getNetScore = (grossScore, holeNum, strokeHoles) => {
    if (!handicapEnabled || !grossScore) return grossScore;
    const strokesOnHole = strokeHoles[holeNum] || 0;
    return grossScore - strokesOnHole;
  };

  // ==================== BUILD LEADERBOARD DATA ====================
  // Builds a unified array of "entries" — each entry is either a team or an individual player.

  let leaderboardData = [];

  if (isTeamFormat) {
    // ---- TEAM FORMAT ----
    leaderboardData = Object.entries(teams).map(([teamId, team]) => {
      const stats = team.stats || {};
      const holesPlayed = stats.holesPlayed || 0;
      const totalScore = stats.totalScore || 0;
      const toPar = stats.toPar || 0;

      // Resolve member names from the players node
      const memberNames = Object.keys(team.members || {}).map(uid =>
        players[uid]?.displayName || 'Unknown'
      );

      // Check if the current user is on this team
      const isMyTeam = team.members && team.members[currentUser?.uid];

      // For handicap: use average of team members' handicaps (common in scramble)
      const memberHandicaps = Object.keys(team.members || {})
        .map(uid => players[uid]?.handicap)
        .filter(h => h != null);
      const avgHandicap = memberHandicaps.length > 0
        ? memberHandicaps.reduce((sum, h) => sum + h, 0) / memberHandicaps.length
        : null;

      const courseHandicap = getPlayerCourseHandicap(avgHandicap);
      const strokeHoles = getStrokeHoles(courseHandicap);

      let netTotal = 0;
      let netToPar = 0;
      let parForPlayed = 0;

      if (handicapEnabled && holesPlayed > 0) {
        for (const holeNum of holeOrder) {
          const holeScore = team.scores?.[holeNum] || team.holes?.[holeNum]?.score;
          if (holeScore) {
            netTotal += getNetScore(holeScore, holeNum, strokeHoles);
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
    // ---- INDIVIDUAL FORMAT ----
    leaderboardData = Object.entries(players).map(([uid, player]) => {
      const stats = player.stats || {};
      const holesPlayed = stats.holesPlayed || 0;
      const totalScore = stats.totalScore || 0;
      const toPar = stats.toPar || 0;

      const courseHandicap = getPlayerCourseHandicap(player.handicap);
      const strokeHoles = getStrokeHoles(courseHandicap);

      let netTotal = 0;
      let netToPar = 0;
      let parForPlayed = 0;

      if (handicapEnabled && holesPlayed > 0) {
        for (const holeNum of holeOrder) {
          const holeScore = player.scores?.[holeNum] || player.holes?.[holeNum]?.score;
          if (holeScore) {
            netTotal += getNetScore(holeScore, holeNum, strokeHoles);
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

  // ==================== SORTING ====================
  const primarySort = display.primarySort || 'gross';

  leaderboardData.sort((a, b) => {
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
  let position = 1;
  leaderboardData.forEach((entry, index) => {
    if (index === 0 || entry.holesPlayed === 0) {
      entry.position = entry.holesPlayed === 0 ? '-' : position;
    } else {
      const prev = leaderboardData[index - 1];
      const sameScore = primarySort === 'net' && handicapEnabled
        ? entry.netToPar === prev.netToPar
        : entry.toPar === prev.toPar;

      if (sameScore && prev.holesPlayed > 0) {
        entry.position = prev.position;
      } else {
        entry.position = index + 1;
      }
    }
    position = (typeof entry.position === 'number' ? entry.position : position) + 1;
  });

  // ==================== DISPLAY HELPERS ====================

  const formatToPar = (toPar) => {
    if (toPar === 0) return 'E';
    return toPar > 0 ? `+${toPar}` : `${toPar}`;
  };

  const getToParColor = (toPar) => {
    if (toPar < 0) return 'text-green-600';
    if (toPar === 0) return 'text-gray-900';
    return 'text-red-600';
  };

  const getScoreColor = (score, par) => {
    if (!score) return '';
    if (score < par) return 'bg-green-100 text-green-700 font-bold';
    if (score === par) return 'text-gray-900';
    if (score === par + 1) return 'bg-red-50 text-red-600 font-bold';
    return 'bg-red-100 text-red-700 font-bold';
  };

  const getProgressPercent = (holesPlayed) => {
    return Math.round((holesPlayed / numHoles) * 100);
  };

  // ==================== EXPANDED DETAIL ====================

  const renderEntryDetail = (entry) => {
    const renderHoleRow = (holes, label) => (
      <div className="mb-3">
        <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-1 w-12">Hole</th>
                {holes.map(h => (
                  <th key={h} className="text-center p-1 min-w-[28px]">{h}</th>
                ))}
                <th className="text-center p-1 min-w-[32px] font-bold">Tot</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="p-1 text-gray-500">Par</td>
                {holes.map(h => (
                  <td key={h} className="text-center p-1 text-gray-500">{coursePars[h - 1]}</td>
                ))}
                <td className="text-center p-1 text-gray-600 font-semibold">
                  {holes.reduce((sum, h) => sum + (coursePars[h - 1] || 0), 0)}
                </td>
              </tr>
              <tr>
                <td className="p-1 text-gray-500">Score</td>
                {holes.map(h => {
                  const score = entry.scores[h] || entry.holes[h]?.score;
                  const par = coursePars[h - 1];
                  return (
                    <td key={h} className={`text-center p-1 rounded ${getScoreColor(score, par)}`}>
                      {score || '-'}
                      {usesMulligans && (entry.mulliganLog[h] || 0) > 0 && (
                        <span className="text-purple-500 text-[8px]">{'🎟️'.repeat(entry.mulliganLog[h])}</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-center p-1 font-bold text-gray-900">
                  {holes.reduce((sum, h) => {
                    const s = entry.scores[h] || entry.holes[h]?.score || 0;
                    return sum + s;
                  }, 0) || '-'}
                </td>
              </tr>
              {handicapEnabled && display.showNet !== false && (
                <tr className="border-t border-gray-100">
                  <td className="p-1 text-gray-500">Net</td>
                  {holes.map(h => {
                    const score = entry.scores[h] || entry.holes[h]?.score;
                    const par = coursePars[h - 1];
                    const net = score ? getNetScore(score, h, entry.strokeHoles) : null;
                    const hasStroke = entry.strokeHoles[h] > 0;
                    return (
                      <td key={h} className={`text-center p-1 rounded ${net ? getScoreColor(net, par) : ''}`}>
                        {net || '-'}
                        {hasStroke && display.showStrokeHoles !== false && (
                          <span className="text-blue-500 text-[8px] align-super">•</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center p-1 font-bold text-gray-900">
                    {holes.reduce((sum, h) => {
                      const s = entry.scores[h] || entry.holes[h]?.score;
                      return sum + (s ? getNetScore(s, h, entry.strokeHoles) : 0);
                    }, 0) || '-'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );

    return (
      <div className="mt-3 pt-3 border-t border-gray-200">
        {display.showHoleByHole !== false && (
          <>
            {renderHoleRow(first9, numHoles === 18 ? 'OUT' : (startingHole === 1 ? 'Front 9' : 'Back 9'))}
            {second9.length > 0 && renderHoleRow(second9, 'IN')}
          </>
        )}

        {/* Stats summary */}
        <div className="flex gap-4 text-xs text-gray-500 mt-2">
          {display.showGross !== false && (
            <span>Gross: {entry.totalScore}</span>
          )}
          {handicapEnabled && display.showNet !== false && (
            <span>Net: {entry.netTotal}</span>
          )}
          {entry.handicap != null && handicapEnabled && (
            <span>HCP: {entry.courseHandicap}</span>
          )}
          {meta.scoringMethod === 'stableford' && (
            <span>Points: {entry.stablefordPoints}</span>
          )}
          {usesMulligans && entry.mulligansTotal > 0 && (
            <span>Mulligans: {entry.mulligansRemaining}/{entry.mulligansTotal}</span>
          )}
        </div>
      </div>
    );
  };

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
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
              {primarySort === 'net' ? 'Net' : 'Gross'}
            </span>
          )}
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {meta.formatName || meta.format}
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[32px_1fr_60px_60px_48px] items-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <div>#</div>
        <div>{isTeamFormat ? 'Team' : 'Player'}</div>
        {display.showRelativeToPar !== false ? (
          <div className="text-center">
            {primarySort === 'net' && handicapEnabled ? 'Net' : 'To Par'}
          </div>
        ) : (
          <div className="text-center">Score</div>
        )}
        {handicapEnabled && display.showNet !== false && display.showGross !== false && (
          <div className="text-center text-gray-400">
            {primarySort === 'net' ? 'Gross' : 'Net'}
          </div>
        )}
        <div className="text-center">Thru</div>
      </div>

      {/* Leaderboard rows */}
      <div className="space-y-2">
        {leaderboardData.map((entry) => {
          const isExpanded = expandedEntry === entry.id;

          return (
            <div
              key={entry.id}
              className={`rounded-xl transition-all ${
                entry.isMyEntry ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50 border border-gray-100'
              }`}
            >
              {/* Main row — tappable */}
              <button
                onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                className="w-full grid grid-cols-[32px_1fr_60px_60px_48px] items-center px-3 py-3 text-left"
              >
                {/* Position */}
                <div className={`text-lg font-bold ${
                  entry.position === 1 ? 'text-yellow-500' :
                  entry.position === 2 ? 'text-gray-400' :
                  entry.position === 3 ? 'text-amber-600' :
                  'text-gray-500'
                }`}>
                  {entry.position}
                </div>

                {/* Name + subtitle + progress */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-900 truncate">
                      {entry.displayName}
                    </span>
                    {entry.isMyEntry && (
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full shrink-0">
                        {isTeamFormat ? 'Your Team' : 'You'}
                      </span>
                    )}
                    {!isTeamFormat && entry.role === 'host' && (
                      <span className="text-[10px] bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded-full shrink-0">
                        Host
                      </span>
                    )}
                  </div>
                  {/* Subtitle: team member names for team format */}
                  {isTeamFormat && entry.subtitle && (
                    <div className="text-xs text-gray-500 truncate">{entry.subtitle}</div>
                  )}
                  {/* Mulligans remaining badge */}
                  {usesMulligans && entry.mulligansTotal > 0 && (
                    <div className="text-[10px] text-purple-600 font-semibold">
                      🎟️ {entry.mulligansRemaining}/{entry.mulligansTotal} mulligans
                    </div>
                  )}
                  {/* Progress bar */}
                  <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden w-full max-w-[120px]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        entry.holesPlayed === numHoles ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${getProgressPercent(entry.holesPlayed)}%` }}
                    />
                  </div>
                </div>

                {/* Primary score */}
                <div className="text-center">
                  {entry.holesPlayed > 0 ? (
                    <span className={`text-lg font-bold ${
                      display.showRelativeToPar !== false
                        ? getToParColor(primarySort === 'net' && handicapEnabled ? entry.netToPar : entry.toPar)
                        : 'text-gray-900'
                    }`}>
                      {display.showRelativeToPar !== false
                        ? formatToPar(primarySort === 'net' && handicapEnabled ? entry.netToPar : entry.toPar)
                        : (primarySort === 'net' && handicapEnabled ? entry.netTotal : entry.totalScore)
                      }
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>

                {/* Secondary score (only if handicap shows both) */}
                {handicapEnabled && display.showNet !== false && display.showGross !== false && (
                  <div className="text-center">
                    {entry.holesPlayed > 0 ? (
                      <span className={`text-sm ${
                        getToParColor(primarySort === 'net' ? entry.toPar : entry.netToPar)
                      } opacity-70`}>
                        {display.showRelativeToPar !== false
                          ? formatToPar(primarySort === 'net' ? entry.toPar : entry.netToPar)
                          : (primarySort === 'net' ? entry.totalScore : entry.netTotal)
                        }
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                )}

                {/* Thru */}
                <div className="text-center text-sm text-gray-600">
                  {entry.holesPlayed === 0
                    ? '-'
                    : entry.holesPlayed === numHoles
                    ? 'F'
                    : entry.holesPlayed
                  }
                </div>
              </button>

              {/* Expanded detail — hole-by-hole scorecard */}
              {isExpanded && renderEntryDetail(entry)}
            </div>
          );
        })}
      </div>

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
            <span className="text-blue-500">•</span> Stroke hole
          </span>
        )}
        <span>F = Finished</span>
        {usesMulligans && (
          <span className="flex items-center gap-1">
            <span className="text-purple-500">🎟️</span> Mulligan
          </span>
        )}
      </div>
    </div>
  );
}
