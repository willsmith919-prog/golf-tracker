import { useState } from 'react';
import { buildHoleOrder } from '../../utils/holes';
import { buildNinesEntries, calculateNines } from '../../utils/ninesScoring';

// ============================================================
// NINES LEADERBOARD
// One card per threesome: running 9's point totals, then a
// hole-by-hole grid of the points each player earned.
// ============================================================

const pointsCellClass = (pts) => {
  if (pts == null) return 'text-gray-300';
  if (pts >= 5) return 'bg-green-100 text-green-800 font-bold';
  if (pts === 4) return 'bg-green-50 text-green-700 font-semibold';
  if (pts === 3) return 'text-gray-700';
  return 'bg-red-50 text-red-600';
};

export default function NinesLeaderboard({ sideGame, currentEvent, currentUser }) {
  const [showInfo, setShowInfo] = useState(false);

  const meta = currentEvent?.meta || {};
  const holeOrder = buildHoleOrder(meta.numHoles || 18, meta.startingHole || 1);
  const entries = buildNinesEntries(currentEvent);
  const { groups } = calculateNines(entries, holeOrder, sideGame);
  const getName = (uid) => entries.find(e => e.id === uid)?.displayName || 'Unknown';
  const isNet = sideGame.variant === 'net';
  const isLeagueEvent = !!(meta.leaguePoints && meta.leagueId);
  const groupNoun = meta.leagueType === 'series' ? 'series' : 'league';
  const mode = sideGame.seriesPointsMode || 'raw';

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🎯</div>
        <p className="text-gray-500 text-sm">9's needs players split into threesomes.</p>
        <p className="text-xs text-gray-400 mt-1">The host sets these up in the event lobby.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{sideGame.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isNet ? 'Net' : 'Gross'} · 9 pts per hole
            {isLeagueEvent && (
              mode === 'raw' ? ` · Counts toward ${groupNoun} points`
                : mode === 'position' ? ` · ${groupNoun[0].toUpperCase() + groupNoun.slice(1)} points by finish`
                  : ' · This game only'
            )}
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

      {showInfo && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-900">
          <div className="font-semibold mb-2">How 9's Works</div>
          <ul className="space-y-1 text-xs">
            <li>• Each hole is worth 9 points between the three players.</li>
            <li>• Best score 5, second 3, last 1.</li>
            <li>• Two tie for best: 4 each, last gets 1.</li>
            <li>• Two tie for second: winner 5, the other two get 2 each.</li>
            <li>• All three tie: 3 each.</li>
            <li>• A hole counts once all three have posted a score.</li>
          </ul>
        </div>
      )}

      <div className="space-y-5">
        {groups.map((group, groupIdx) => {
          const standings = [...group.playerIds].sort((a, b) => group.totals[b] - group.totals[a]);
          const scoredHoles = group.holeResults.filter(h => h.status === 'scored');

          return (
            <div key={groupIdx}>
              {groups.length > 1 && (
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Group {groupIdx + 1}
                </div>
              )}

              {/* Standings */}
              <div className="space-y-2 mb-3">
                {standings.map((uid, i) => {
                  const isMe = uid === currentUser?.uid;
                  return (
                    <div
                      key={uid}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl border-2 ${
                        isMe ? 'border-[#00285e] bg-[#f0f4ff]' : 'border-gray-100 bg-white'
                      }`}
                    >
                      <div className="w-6 text-sm font-bold text-gray-400">{group.holesScored > 0 ? i + 1 : '—'}</div>
                      <div className="flex-1 min-w-0 font-semibold text-gray-900 text-sm truncate">
                        {getName(uid)}
                        {isMe && (
                          <span className="ml-1.5 text-xs bg-[#00285e] text-white px-1.5 py-0.5 rounded-full font-medium">You</span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#00285e]">{group.totals[uid]} pts</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-gray-500 text-center mb-3">
                {group.holesScored} hole{group.holesScored !== 1 ? 's' : ''} complete · {group.holesScored * 9} pts awarded
              </div>

              {/* Hole-by-hole points grid */}
              {scoredHoles.length > 0 && (
                <div className="overflow-x-auto -mx-1 px-1 pb-1">
                  <table className="text-xs border-separate" style={{ borderSpacing: '2px' }}>
                    <thead>
                      <tr>
                        <th className="text-left text-gray-400 font-semibold pr-2 sticky left-0 bg-white">Hole</th>
                        {group.holeResults.map(h => (
                          <th key={h.holeNum} className="w-8 text-center text-gray-500 font-bold">{h.holeNum}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.playerIds.map(uid => (
                        <tr key={uid}>
                          <td className="pr-2 font-semibold text-gray-700 whitespace-nowrap sticky left-0 bg-white">
                            {getName(uid).split(' ')[0]}
                          </td>
                          {group.holeResults.map(h => (
                            <td key={h.holeNum} className={`w-8 h-7 text-center rounded ${pointsCellClass(h.points?.[uid])}`}>
                              {h.points ? h.points[uid] : '–'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
