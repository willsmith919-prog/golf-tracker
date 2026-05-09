import { useState } from 'react';
import { calculateSkins } from '../../utils/skins';
import { buildHoleOrder } from '../../utils/holes';

export default function SideGameLeaderboard({
  sideGame,
  leaderboardEntries,
  currentEvent,
  currentUser,
  players
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [showHoleGrid, setShowHoleGrid] = useState(true);
  const [expandedHole, setExpandedHole] = useState(null);

  const meta = currentEvent?.meta || {};
  const coursePars = meta.coursePars || [];
  const numHoles = meta.numHoles || 18;
  const startingHole = meta.startingHole || 1;
  const holeOrder = buildHoleOrder(numHoles, startingHole);
  const isTeamFormat = (meta.teamSize || 1) > 1;
  const isNet = sideGame.variant === 'net';

  const { holeResults, pointTotals, skinCounts } = calculateSkins(
    leaderboardEntries,
    holeOrder,
    coursePars,
    sideGame
  );

  const getDisplayName = (id) => {
    const entry = leaderboardEntries.find(e => e.id === id);
    return entry?.displayName || 'Unknown';
  };

  const isMyEntry = (id) => {
    if (isTeamFormat) {
      const entry = leaderboardEntries.find(e => e.id === id);
      return !!entry?.isMyEntry;
    }
    return id === currentUser?.uid;
  };

  const activeEntries = leaderboardEntries.filter(e => e.holesPlayed > 0);
  const standings = activeEntries
    .map(entry => ({
      id: entry.id,
      displayName: entry.displayName,
      subtitle: entry.subtitle,
      isMyEntry: entry.isMyEntry,
      points: pointTotals[entry.id] || 0,
      skins: skinCounts[entry.id] || 0
    }))
    .sort((a, b) => b.points - a.points || b.skins - a.skins);

  // Color per hole status
  const holeBg = (hole) => {
    if (hole.status === 'won') return 'bg-green-100 border-green-300';
    if (hole.status === 'tied') {
      return sideGame.carryover
        ? 'bg-amber-50 border-amber-300'
        : 'bg-gray-100 border-gray-300';
    }
    return 'bg-gray-50 border-gray-200';
  };

  const totalSkinsAvailable = holeResults.filter(h => h.status !== 'pending').length;
  const totalSkinPoints = holeResults
    .filter(h => h.status === 'won')
    .reduce((sum, h) => sum + h.pot * sideGame.pointsPerSkin, 0);

  // Build drill-down rows for the selected hole
  const expandedResult = expandedHole != null
    ? holeResults.find(h => h.holeNum === expandedHole)
    : null;

  const drillDownRows = (() => {
    if (!expandedResult) return [];
    const scores = expandedResult.scores || {};
    const minScore = Object.keys(scores).length > 0
      ? Math.min(...Object.values(scores))
      : null;

    return activeEntries.map(entry => {
      const computedScore = scores[entry.id]; // net or gross depending on variant
      // For net variant, derive the gross score from raw entry data
      const holeNum = expandedResult.holeNum;
      const grossScore = entry.scores?.[holeNum] || entry.holes?.[holeNum]?.score || null;
      const strokes = isNet ? (entry.strokeHoles?.[holeNum] || 0) : 0;
      const hasScore = computedScore != null;
      const isWinner = expandedResult.winnerId === entry.id;
      const isTied = expandedResult.status === 'tied' && hasScore && computedScore === minScore;

      return {
        id: entry.id,
        displayName: entry.displayName,
        isMyEntry: isMyEntry(entry.id),
        computedScore,
        grossScore,
        strokes,
        hasScore,
        isWinner,
        isTied
      };
    }).sort((a, b) => {
      // Scored entries first, sorted low to high; unscored at end
      if (!a.hasScore && !b.hasScore) return 0;
      if (!a.hasScore) return 1;
      if (!b.hasScore) return -1;
      return a.computedScore - b.computedScore;
    });
  })();

  // Split holeResults into rows of 9 to avoid horizontal scrolling on mobile
  const holeChunks = [];
  for (let i = 0; i < holeResults.length; i += 9) {
    holeChunks.push(holeResults.slice(i, i + 9));
  }

  if (activeEntries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🎯</div>
        <p className="text-gray-500 text-sm">No scores entered yet.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{sideGame.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isNet ? 'Net' : 'Gross'} · {sideGame.pointsPerSkin} pt{sideGame.pointsPerSkin !== 1 ? 's' : ''}/skin
            {sideGame.carryover ? ' · Carries over' : ' · No carryover'}
          </p>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="w-7 h-7 flex items-center justify-center rounded-full border-2 border-gray-200 text-gray-400 hover:border-[#00285e] hover:text-[#00285e] transition-colors text-xs font-bold"
          title="Rules"
        >
          i
        </button>
      </div>

      {/* Info / Rules panel */}
      {showInfo && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-900">
          <div className="font-semibold mb-2">How Skins Work</div>
          <ul className="space-y-1 text-xs">
            <li>• The player with the lowest {isNet ? 'net' : 'gross'} score on each hole wins the skin.</li>
            <li>• If two or more players tie, {sideGame.carryover ? 'the skin carries to the next hole' : 'nobody wins that hole'}.</li>
            <li>• Each skin is worth {sideGame.pointsPerSkin} point{sideGame.pointsPerSkin !== 1 ? 's' : ''}.</li>
            {sideGame.carryover && <li>• Carried skins stack — a 3-hole carry is worth {3 * sideGame.pointsPerSkin} points.</li>}
          </ul>
        </div>
      )}

      {/* Standings table */}
      <div className="mb-5">
        <div className="grid grid-cols-[1fr_60px_60px] items-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div>{isTeamFormat ? 'Team' : 'Player'}</div>
          <div className="text-center">Skins</div>
          <div className="text-center">Pts</div>
        </div>

        <div className="space-y-2">
          {standings.map((row, i) => (
            <div
              key={row.id}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl border-2 ${
                row.isMyEntry
                  ? 'border-[#00285e] bg-[#f0f4ff]'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <div className="w-6 text-sm font-bold text-gray-400 flex-shrink-0">
                {row.points > 0 ? i + 1 : '—'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm truncate">
                  {row.displayName}
                  {row.isMyEntry && (
                    <span className="ml-1.5 text-xs bg-[#00285e] text-white px-1.5 py-0.5 rounded-full font-medium">You</span>
                  )}
                </div>
                {row.subtitle && (
                  <div className="text-xs text-gray-400 truncate">{row.subtitle}</div>
                )}
              </div>
              <div className="text-center w-12 flex-shrink-0">
                <span className={`text-sm font-bold ${row.skins > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                  {row.skins > 0 ? row.skins : '—'}
                </span>
              </div>
              <div className="text-center w-12 flex-shrink-0">
                <span className={`text-sm font-bold ${row.points > 0 ? 'text-[#00285e]' : 'text-gray-300'}`}>
                  {row.points > 0 ? row.points : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-3 text-xs text-gray-500 justify-center">
          <span>{totalSkinsAvailable} hole{totalSkinsAvailable !== 1 ? 's' : ''} decided</span>
          <span>·</span>
          <span>{totalSkinPoints} pts awarded</span>
          {holeResults.some(h => h.status === 'pending') && (
            <>
              <span>·</span>
              <span className="text-amber-600">{holeResults.filter(h => h.status === 'pending').length} pending</span>
            </>
          )}
        </div>
      </div>

      {/* Hole-by-hole grid toggle */}
      <button
        onClick={() => { setShowHoleGrid(!showHoleGrid); setExpandedHole(null); }}
        className="w-full text-xs text-[#00285e] font-semibold mb-3 flex items-center justify-center gap-1"
      >
        {showHoleGrid ? '▲ Hide' : '▼ Show'} hole-by-hole results
      </button>

      {showHoleGrid && (
        <>
          {/* Hole grid — split into rows of 9 to fit mobile without side-scrolling */}
          <div className="space-y-1.5 mb-2">
            {holeChunks.map((chunk, chunkIndex) => (
              <div
                key={chunkIndex}
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${chunk.length}, 1fr)` }}
              >
                {chunk.map((hole) => {
                  const par = coursePars[hole.holeNum - 1];
                  const winnerName = hole.winnerId ? getDisplayName(hole.winnerId) : null;
                  const isExpanded = expandedHole === hole.holeNum;
                  const isCancelledTie = hole.status === 'tied' && !sideGame.carryover;
                  const isCarryTie = hole.status === 'tied' && sideGame.carryover;

                  return (
                    <button
                      key={hole.holeNum}
                      onClick={() => setExpandedHole(isExpanded ? null : hole.holeNum)}
                      className={`flex flex-col items-center rounded-lg border-2 py-1.5 px-0.5 w-full transition-all ${holeBg(hole)} ${
                        isExpanded ? 'ring-2 ring-[#00285e] ring-offset-1' : 'hover:opacity-80'
                      }`}
                    >
                      <div className="text-xs font-bold text-gray-500">{hole.holeNum}</div>
                      {par && <div className="text-xs text-gray-400">P{par}</div>}

                      {hole.pot > 1 && hole.status !== 'won' && (
                        <div className="text-xs font-bold text-amber-600">×{hole.pot}</div>
                      )}

                      <div className="mt-0.5 text-center">
                        {hole.status === 'won' && (
                          <>
                            <div className="text-green-600 font-bold text-xs">✓</div>
                            <div className="text-xs font-semibold text-gray-700 leading-tight truncate w-full px-0.5">
                              {winnerName?.split(' ')[0]}
                            </div>
                            <div className="text-xs text-green-700 font-bold">
                              +{hole.pot * sideGame.pointsPerSkin}
                            </div>
                          </>
                        )}
                        {isCarryTie && <div className="text-amber-600 font-bold text-sm leading-none">→</div>}
                        {isCancelledTie && <div className="text-gray-400 font-bold text-xs leading-none">✕</div>}
                        {hole.status === 'pending' && <div className="text-gray-300 text-xs">–</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Hole drill-down panel */}
          {expandedResult && (
            <div className="mt-3 bg-white border-2 border-[#00285e]/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-bold text-gray-900 text-sm">
                    Hole {expandedResult.holeNum}
                  </span>
                  {coursePars[expandedResult.holeNum - 1] && (
                    <span className="text-xs text-gray-500 ml-2">
                      Par {coursePars[expandedResult.holeNum - 1]}
                    </span>
                  )}
                  {expandedResult.pot > 1 && (
                    <span className="ml-2 text-xs font-semibold text-amber-600">
                      ×{expandedResult.pot} skins at stake
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {expandedResult.status === 'won' && (
                    <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      Skin won · +{expandedResult.pot * sideGame.pointsPerSkin} pts
                    </span>
                  )}
                  {expandedResult.status === 'tied' && sideGame.carryover && (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Tied → carries over
                    </span>
                  )}
                  {expandedResult.status === 'tied' && !sideGame.carryover && (
                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                      Tied · cancelled
                    </span>
                  )}
                  {expandedResult.status === 'pending' && (
                    <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      In progress
                    </span>
                  )}
                  <button
                    onClick={() => setExpandedHole(null)}
                    className="text-gray-400 hover:text-gray-600 text-sm font-bold ml-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {drillDownRows.map(row => (
                  <div
                    key={row.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      row.isWinner
                        ? 'bg-green-50 border border-green-200'
                        : row.isTied
                          ? 'bg-amber-50 border border-amber-200'
                          : row.hasScore
                            ? 'bg-gray-50 border border-gray-100'
                            : 'bg-gray-50/50 border border-gray-100 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Outcome icon */}
                      <span className="flex-shrink-0 text-xs w-4">
                        {row.isWinner ? '✓' : row.isTied ? '=' : row.hasScore ? '' : '–'}
                      </span>
                      <span className={`font-semibold truncate ${row.isWinner ? 'text-green-800' : row.isTied ? 'text-amber-800' : 'text-gray-700'}`}>
                        {row.displayName}
                        {row.isMyEntry && (
                          <span className="ml-1.5 text-xs bg-[#00285e] text-white px-1.5 py-0.5 rounded-full font-medium">You</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 text-right">
                      {row.hasScore ? (
                        isNet && row.strokes > 0 ? (
                          <span className="text-xs text-gray-500">
                            {row.grossScore} gross → <span className="font-bold text-gray-900">{row.computedScore} net</span>
                            <span className="text-green-600 ml-1">(-{row.strokes})</span>
                          </span>
                        ) : (
                          <span className={`font-bold text-sm ${row.isWinner ? 'text-green-800' : row.isTied ? 'text-amber-800' : 'text-gray-700'}`}>
                            {row.computedScore}
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-gray-400">no score</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400 justify-center">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-300"></span> Skin won
            </span>
            {sideGame.carryover ? (
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-amber-50 border border-amber-300"></span>
                Tied → carries
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-300"></span>
                Tied · cancelled
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-gray-50 border border-gray-200"></span> Pending
            </span>
          </div>
        </>
      )}
    </div>
  );
}
