import { useState } from 'react';
import { calculateMatchPlay } from '../../utils/matchPlay';
import { buildHoleOrder } from '../../utils/holes';

const METHOD_LABELS = {
  scramble: 'Scramble',
  bestball: 'Best Ball',
  individual: 'Individual',
};

export default function TeamMatchPlayLeaderboard({ leaderboardData, currentEvent, currentUser }) {
  const [expandedHole, setExpandedHole] = useState(null);

  const meta = currentEvent?.meta || {};
  const teams = currentEvent?.teams || {};
  const coursePars = meta.coursePars || [];
  const numHoles = meta.numHoles || 18;
  const startingHole = meta.startingHole || 1;
  const variableTeams = meta.variableTeams === true;
  const holeOrder = buildHoleOrder(numHoles, startingHole);

  if (leaderboardData.length < 2) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🤝</div>
        <p className="text-gray-600 font-semibold">Waiting for teams to be set up</p>
        <p className="text-sm text-gray-400 mt-1">Both teams need members before the match can begin</p>
      </div>
    );
  }

  const [t1, t2] = leaderboardData;
  const result = calculateMatchPlay([t1, t2], holeOrder);
  if (!result) return null;

  const { holeResults, holesUp, leaderId, trailerId, holesPlayed, holesRemaining, matchOutcome } = result;

  const leaderEntry = leaderId ? leaderboardData.find(e => e.id === leaderId) : null;

  const statusText = () => {
    const n = leaderEntry?.displayName || null;
    switch (matchOutcome) {
      case 'not_started': return 'Match ready — no scores yet';
      case 'all_square':  return `All Square · thru ${holesPlayed}`;
      case 'leading':     return `${n} ${holesUp} UP · thru ${holesPlayed}`;
      case 'dormie':      return `${n} Dormie ${holesUp}`;
      case 'halved':      return 'Match Halved';
      case 'won':
        return holesRemaining === 0 ? `${n} wins ${holesUp} UP` : `${n} wins ${holesUp}&${holesRemaining}`;
      default: return '';
    }
  };

  const bannerClass = () => {
    if (matchOutcome === 'won') return 'bg-green-50 border-green-300 text-green-900';
    if (matchOutcome === 'halved') return 'bg-gray-100 border-gray-300 text-gray-700';
    if (matchOutcome === 'not_started') return 'bg-gray-50 border-gray-200 text-gray-500';
    return 'bg-[#f0f4ff] border-[#dce8f5] text-[#00285e]';
  };

  const teamStatus = (entry) => {
    if (!leaderId) return { label: 'AS', cls: 'text-gray-500' };
    if (leaderId === entry.id) return { label: `${holesUp} UP`, cls: 'text-green-700 font-bold' };
    if (trailerId === entry.id) return { label: `${holesUp} DN`, cls: 'text-red-500 font-bold' };
    return { label: 'AS', cls: 'text-gray-500' };
  };

  const holeCellClass = (hole, teamId, isExpanded) => {
    const ring = isExpanded ? 'ring-2 ring-[#00285e] ring-offset-1' : 'hover:opacity-80';
    if (hole.status === 'pending') return `bg-gray-50 border-gray-200 ${ring}`;
    if (hole.status === 'halved') return `bg-gray-100 border-gray-300 ${ring}`;
    if (hole.winnerId === teamId) return `bg-green-100 border-green-300 ${ring}`;
    return `bg-red-50 border-red-200 ${ring}`;
  };

  const holeCellIcon = (hole, teamId) => {
    if (hole.status === 'pending') return <span className="text-gray-300 text-xs">–</span>;
    if (hole.status === 'halved') return <span className="text-gray-500 text-xs font-bold">=</span>;
    if (hole.winnerId === teamId) return <span className="text-green-600 font-bold text-xs">✓</span>;
    return <span className="text-red-400 font-bold text-xs">✕</span>;
  };

  const holeChunks = [];
  for (let i = 0; i < holeResults.length; i += 9) {
    holeChunks.push(holeResults.slice(i, i + 9));
  }

  const expandedResult = expandedHole != null ? holeResults.find(h => h.holeNum === expandedHole) : null;
  const isMyTeam = (entry) => !!(teams[entry.id]?.members?.[currentUser?.uid]);

  return (
    <div>
      {/* Match status banner */}
      <div className={`rounded-xl p-4 mb-5 text-center border-2 ${bannerClass()}`}>
        <div className="text-lg font-bold">{statusText()}</div>
        {matchOutcome === 'not_started' && (
          <div className="text-xs mt-1 opacity-70">Scores will appear as holes are played</div>
        )}
        {matchOutcome === 'won' && (
          <div className="text-sm mt-1 opacity-70">Match complete</div>
        )}
      </div>

      {/* Team cards */}
      {[t1, t2].map(entry => {
        const isMe = isMyTeam(entry);
        const status = teamStatus(entry);
        const method = variableTeams ? teams[entry.id]?.combinationMethod : null;
        const methodText = method ? METHOD_LABELS[method] : null;

        return (
          <div
            key={entry.id}
            className={`rounded-xl border-2 p-4 mb-3 ${isMe ? 'border-[#00285e] bg-[#f0f4ff]' : 'border-gray-200 bg-white'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-900">{entry.displayName}</span>
                {isMe && (
                  <span className="text-xs bg-[#00285e] text-white px-1.5 py-0.5 rounded-full">Your Team</span>
                )}
                {methodText && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{methodText}</span>
                )}
              </div>
              <span className={`text-sm flex-shrink-0 ${status.cls}`}>{status.label}</span>
            </div>
            {entry.subtitle && (
              <div className="text-xs text-gray-500 mb-3">{entry.subtitle}</div>
            )}

            <div className="space-y-1.5">
              {holeChunks.map((chunk, ci) => (
                <div key={ci} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${chunk.length}, 1fr)` }}>
                  {chunk.map(hole => {
                    const par = coursePars[hole.holeNum - 1];
                    const isExpanded = expandedHole === hole.holeNum;
                    return (
                      <button
                        key={hole.holeNum}
                        onClick={() => setExpandedHole(isExpanded ? null : hole.holeNum)}
                        className={`flex flex-col items-center rounded-lg border-2 py-1.5 px-0.5 w-full transition-all ${holeCellClass(hole, entry.id, isExpanded)}`}
                      >
                        <div className="text-xs font-bold text-gray-500">{hole.holeNum}</div>
                        {par && <div className="text-xs text-gray-400">P{par}</div>}
                        <div className="mt-0.5">{holeCellIcon(hole, entry.id)}</div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Drill-down panel */}
      {expandedResult && (
        <div className="mt-1 mb-4 bg-white border-2 border-[#00285e]/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">Hole {expandedResult.holeNum}</span>
              {coursePars[expandedResult.holeNum - 1] && (
                <span className="text-xs text-gray-500">Par {coursePars[expandedResult.holeNum - 1]}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {expandedResult.status === 'won' && (
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  {leaderboardData.find(e => e.id === expandedResult.winnerId)?.displayName} wins hole
                </span>
              )}
              {expandedResult.status === 'halved' && (
                <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">Halved</span>
              )}
              {expandedResult.status === 'pending' && (
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not yet played</span>
              )}
              <button
                onClick={() => setExpandedHole(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold ml-1"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {[t1, t2].map(entry => {
              const gross = expandedResult.grossScores?.[entry.id];
              const isWinner = expandedResult.winnerId === entry.id;
              const isHalved = expandedResult.status === 'halved' && gross != null;
              const isMe = isMyTeam(entry);
              const method = variableTeams ? teams[entry.id]?.combinationMethod : null;
              const methodText = method ? METHOD_LABELS[method] : null;

              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                    isWinner  ? 'bg-green-50 border border-green-200'
                    : isHalved ? 'bg-gray-50 border border-gray-200'
                    : gross != null ? 'bg-red-50 border border-red-100'
                    : 'bg-gray-50/50 border border-gray-100 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="flex-shrink-0 text-xs w-4">
                      {isWinner ? '✓' : isHalved ? '=' : gross != null ? '✕' : '–'}
                    </span>
                    <span className={`font-semibold truncate ${isWinner ? 'text-green-800' : isHalved ? 'text-gray-700' : gross != null ? 'text-red-700' : 'text-gray-400'}`}>
                      {entry.displayName}
                      {isMe && (
                        <span className="ml-1.5 text-xs bg-[#00285e] text-white px-1.5 py-0.5 rounded-full font-medium">Your Team</span>
                      )}
                    </span>
                    {methodText && (
                      <span className="text-xs text-gray-400 flex-shrink-0">({methodText})</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-right flex-shrink-0">
                    {gross != null ? (
                      <span className={`font-bold text-base ${isWinner ? 'text-green-800' : isHalved ? 'text-gray-700' : 'text-red-700'}`}>
                        {gross}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">no score</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {expandedResult.status !== 'pending' && (
            <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-center text-gray-500">
              {expandedResult.balance === 0
                ? 'All Square after this hole'
                : (() => {
                    const leadingEntry = expandedResult.balance > 0 ? t1 : t2;
                    return `${leadingEntry.displayName} ${Math.abs(expandedResult.balance)} UP after hole ${expandedResult.holeNum}`;
                  })()
              }
            </div>
          )}
        </div>
      )}

      {/* Holes played summary */}
      <div className="mt-2 flex gap-3 text-xs text-gray-500 justify-center">
        <span>{holesPlayed} hole{holesPlayed !== 1 ? 's' : ''} played</span>
        {holesRemaining > 0 && matchOutcome !== 'won' && (
          <>
            <span>·</span>
            <span>{holesRemaining} remaining</span>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400 justify-center">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-300"></span> Hole won
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-300"></span> Halved
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200"></span> Lost
        </span>
      </div>
    </div>
  );
}
