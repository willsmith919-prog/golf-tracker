import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';
import { calculateEventPoints } from '../../utils/leaguePoints';

export default function LeagueStandingsPanel({
  leagueId,
  seasonId,
  leaguePoints,
  leaderboardData,
  teams,
  teamSize,
  players,
  currentEventId
}) {
  const [showLeagueProjection, setShowLeagueProjection] = useState(false);
  const [currentStandings, setCurrentStandings] = useState(null);
  const [loadingStandings, setLoadingStandings] = useState(false);

  useEffect(() => {
    if (!showLeagueProjection || currentStandings) return;

    const loadStandings = async () => {
      setLoadingStandings(true);
      try {
        const standingsSnap = await get(ref(database, `leagues/${leagueId}/seasons/${seasonId}/standings`));
        const membersSnap = await get(ref(database, `leagues/${leagueId}/members`));
        setCurrentStandings({
          standings: standingsSnap.val() || {},
          members: membersSnap.val() || {}
        });
      } catch (err) {
        console.error('Error loading league standings:', err);
      }
      setLoadingStandings(false);
    };

    loadStandings();
  }, [showLeagueProjection]);

  return (
    <div className="mt-6">
      <button
        onClick={() => setShowLeagueProjection(!showLeagueProjection)}
        className="w-full flex items-center justify-between bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 rounded-xl px-4 py-3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <span className="font-semibold text-purple-800 text-sm">League Standings Impact</span>
        </div>
        <span className="text-purple-400 text-sm font-semibold">
          {showLeagueProjection ? 'Hide ▲' : 'Show ▼'}
        </span>
      </button>

      {showLeagueProjection && (
        <div className="mt-3 bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
          {loadingStandings ? (
            <div className="text-center py-4 text-purple-600 text-sm">Loading standings...</div>
          ) : currentStandings ? (() => {
            const projectedPoints = calculateEventPoints(
              leaderboardData,
              leaguePoints,
              teams,
              teamSize,
              players,
              currentStandings.members
            );

            const allUids = new Set([
              ...Object.keys(projectedPoints),
              ...Object.keys(currentStandings.standings)
            ]);

            const projectionRows = Array.from(allUids).map(uid => {
              const standing = currentStandings.standings[uid] || { points: 0, events: {} };
              const member = currentStandings.members[uid] || {};
              const player = players[uid];
              const previousPointsForThisEvent = standing.events?.[currentEventId] || 0;
              const basePoints = (standing.points || 0) - previousPointsForThisEvent;
              const projected = projectedPoints[uid] || 0;
              const newTotal = basePoints + projected;

              return {
                uid,
                displayName: player?.displayName || member?.displayName || 'Unknown',
                basePoints,
                projected,
                newTotal,
                isInEvent: !!projectedPoints[uid]
              };
            });

            projectionRows.sort((a, b) => b.newTotal - a.newTotal);

            const beforeRanking = [...projectionRows]
              .sort((a, b) => b.basePoints - a.basePoints)
              .map(r => r.uid);

            return (
              <>
                <div className="text-xs text-purple-600 mb-3 font-medium">
                  If the round ended now, here's how league standings would change:
                </div>
                <div className="space-y-2">
                  {projectionRows.map((row, index) => {
                    const newRank = index + 1;
                    const oldRank = beforeRanking.indexOf(row.uid) + 1;
                    const movement = oldRank - newRank;

                    return (
                      <div
                        key={row.uid}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          row.isInEvent ? 'bg-white' : 'bg-purple-100/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 w-14">
                            <span className="text-sm font-bold text-gray-500">#{newRank}</span>
                            {movement > 0 && (
                              <span className="text-green-500 text-xs font-bold">▲{movement}</span>
                            )}
                            {movement < 0 && (
                              <span className="text-red-500 text-xs font-bold">▼{Math.abs(movement)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-gray-900 truncate block">
                              {row.displayName}
                            </span>
                            {row.isInEvent && row.projected > 0 && (
                              <span className="text-xs text-purple-600">
                                +{row.projected} pts this event
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-purple-700">{row.newTotal} pts</div>
                          {row.basePoints !== row.newTotal && (
                            <div className="text-xs text-gray-400">was {row.basePoints}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Points key */}
                <div className="mt-3 pt-3 border-t border-purple-200">
                  <div className="text-xs text-purple-500 font-medium mb-2">Points this event:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(leaguePoints.positions)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .slice(0, 5)
                      .map(([place, pts]) => {
                        const n = Number(place);
                        const s = ['th', 'st', 'nd', 'rd'];
                        const v = n % 100;
                        const ord = n + (s[(v - 20) % 10] || s[v] || s[0]);
                        return (
                          <span key={place} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                            {ord}: {pts}pts
                          </span>
                        );
                      })}
                    {leaguePoints.participationPoints > 0 && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                        Participation: {leaguePoints.participationPoints}pts
                      </span>
                    )}
                  </div>
                </div>
              </>
            );
          })() : (
            <div className="text-center py-4 text-purple-600 text-sm">Could not load standings</div>
          )}
        </div>
      )}
    </div>
  );
}
