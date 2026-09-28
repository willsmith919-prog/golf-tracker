import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';
import { calculateEventPoints } from '../../utils/leaguePoints';
import { calculateSkins } from '../../utils/skins';
import { buildNinesEntries, calculateNines, calculateNinesSeriesPoints } from '../../utils/ninesScoring';
import { calculateStatGames, statGameLabel } from '../../utils/statGames';
import { calculateBonusPoints } from '../../utils/bonusPoints';

export default function LeagueStandingsPanel({
  leagueId,
  seasonId,
  leaguePoints,
  leaderboardData,
  teams,
  teamSize,
  players,
  currentEventId,
  currentEvent = null,
  sideGames = [],
  holeOrder = [],
  coursePars = [],
  inline = false   // when true: always expanded, no toggle button (used as a tab)
}) {
  const [showLeagueProjection, setShowLeagueProjection] = useState(inline);
  const [currentStandings, setCurrentStandings] = useState(null);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [expandedUid, setExpandedUid] = useState(null);

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

  // Only true Skins games use skins math (stroke play resolves at event end;
  // Vegas never feeds points; 9's has its own calculation below)
  const skinsSideGames = sideGames.filter(sg => sg.sideGameType === 'skins' || !sg.sideGameType);
  const ninesSideGames = sideGames.filter(sg => sg.sideGameType === 'nines');

  // 9's projection: { uid: { [sgId]: points } }, using each game's series-points setting
  const computeNinesProjection = () => {
    if (!ninesSideGames.length || !currentEvent || !holeOrder.length) return {};
    const entries = buildNinesEntries(currentEvent);
    const result = {};
    for (const sg of ninesSideGames) {
      const pts = calculateNinesSeriesPoints(calculateNines(entries, holeOrder, sg), sg);
      for (const [uid, p] of Object.entries(pts)) {
        if (uid.startsWith('guest-')) continue;
        if (!result[uid]) result[uid] = {};
        result[uid][sg.id] = p;
      }
    }
    return result;
  };

  // Pre-compute skins totals per player for each side game
  const computeSkinsProjection = () => {
    if (!sideGames.length || !holeOrder.length) return {};
    const result = {}; // { uid: { [sgId]: points } }
    for (const sg of skinsSideGames) {
      const { pointTotals } = calculateSkins(leaderboardData, holeOrder, coursePars, sg);
      for (const [uid, pts] of Object.entries(pointTotals)) {
        if (!result[uid]) result[uid] = {};
        result[uid][sg.id] = pts;
      }
    }
    return result;
  };

  const hasExclusionSideGame = sideGames.some(
    sg => sg.sideGameType === 'stroke_play' && sg.competitionMode === 'main_game_exclusion'
  );

  return (
    <div className={inline ? '' : 'mt-6'}>
      {!inline && (
        <button
          onClick={() => setShowLeagueProjection(!showLeagueProjection)}
          className="w-full flex items-center justify-between bg-[#f0f4ff] hover:bg-[#e8eeff] border-2 border-[#dce8f5] rounded-xl px-4 py-3 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="font-semibold text-[#007a78] text-sm">League Standings Impact</span>
          </div>
          <span className="text-[#003a7d] text-sm font-semibold">
            {showLeagueProjection ? 'Hide ▲' : 'Show ▼'}
          </span>
        </button>
      )}

      {showLeagueProjection && (
        <div className={inline ? '' : 'mt-3 bg-[#f0f4ff] border-2 border-[#dce8f5] rounded-xl p-4'}>
          {loadingStandings ? (
            <div className="text-center py-4 text-[#00285e] text-sm">Loading standings...</div>
          ) : currentStandings ? (() => {
            const skinsProjection = computeSkinsProjection();
            const participationPoints = leaguePoints.participationPoints || 0;

            const projectedMainGame = calculateEventPoints(
              leaderboardData,
              leaguePoints,
              teams,
              teamSize,
              players,
              currentStandings.members
            );

            // Add skins points on top
            const projectedPoints = { ...projectedMainGame };
            for (const [uid, byGame] of Object.entries(skinsProjection)) {
              const skinsTotal = Object.values(byGame).reduce((s, v) => s + v, 0);
              if (skinsTotal > 0) {
                projectedPoints[uid] = (projectedPoints[uid] || 0) + skinsTotal;
              }
            }

            // Add stat game points (Most Birdies, etc.) on top — can be negative
            const statGamesProjection = currentEvent
              ? calculateStatGames(currentEvent, leaguePoints.statGames || []).byPlayer
              : {};
            for (const [uid, byGame] of Object.entries(statGamesProjection)) {
              const total = Object.values(byGame).reduce((s, v) => s + v, 0);
              if (total !== 0) {
                projectedPoints[uid] = Math.round(((projectedPoints[uid] || 0) + total) * 10) / 10;
              }
            }

            // Add bonus points (chip-ins, sandies...) on top
            const bonusProjection = currentEvent
              ? calculateBonusPoints(currentEvent, leaguePoints.bonusPoints || [])
              : { byPlayer: {}, counts: {} };
            for (const [uid, byBonus] of Object.entries(bonusProjection.byPlayer)) {
              const total = Object.values(byBonus).reduce((s, v) => s + v, 0);
              if (total !== 0) {
                projectedPoints[uid] = Math.round(((projectedPoints[uid] || 0) + total) * 10) / 10;
              }
            }

            // Add 9's points on top
            const ninesProjection = computeNinesProjection();
            for (const [uid, byGame] of Object.entries(ninesProjection)) {
              const ninesTotal = Object.values(byGame).reduce((s, v) => s + v, 0);
              if (ninesTotal > 0) {
                projectedPoints[uid] = (projectedPoints[uid] || 0) + ninesTotal;
              }
            }

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

              // Build breakdown for display
              const mainGamePoints = projectedMainGame[uid] || 0;
              const positionPoints = mainGamePoints - participationPoints;
              const lbEntry = leaderboardData.find(e => e.id === uid);
              const position = lbEntry?.position;

              const ninesBreakdown = ninesSideGames.map(sg => ({
                id: sg.id,
                name: sg.name,
                points: ninesProjection[uid]?.[sg.id] || 0
              }));

              const statGamesBreakdown = (leaguePoints.statGames || [])
                .map(game => ({ id: game.id, name: statGameLabel(game), points: statGamesProjection[uid]?.[game.id] || 0 }))
                .filter(g => g.points !== 0);

              const bonusBreakdown = (leaguePoints.bonusPoints || [])
                .map(def => {
                  const count = bonusProjection.counts[uid]?.[def.id] || 0;
                  return { id: def.id, name: count > 1 ? `${def.name} ×${count}` : def.name, points: bonusProjection.byPlayer[uid]?.[def.id] || 0 };
                })
                .filter(b => b.points !== 0);

              const skinsBreakdown = skinsSideGames.map(sg => ({
                name: sg.name,
                variant: sg.variant,
                points: skinsProjection[uid]?.[sg.id] || 0,
                skins: (() => {
                  if (!holeOrder.length) return 0;
                  const { skinCounts } = calculateSkins(leaderboardData, holeOrder, coursePars, sg);
                  return skinCounts[uid] || 0;
                })()
              }));

              return {
                uid,
                displayName: player?.displayName || member?.displayName || 'Unknown',
                basePoints,
                projected,
                newTotal,
                isInEvent: !!projectedPoints[uid],
                mainGamePoints,
                positionPoints: Math.max(0, positionPoints),
                participationPoints: mainGamePoints > 0 ? participationPoints : 0,
                position,
                skinsBreakdown,
                ninesBreakdown,
                statGamesBreakdown,
                bonusBreakdown
              };
            });

            projectionRows.sort((a, b) => b.newTotal - a.newTotal);

            const beforeRanking = [...projectionRows]
              .sort((a, b) => b.basePoints - a.basePoints)
              .map(r => r.uid);

            const ordinal = (n) => {
              const s = ['th', 'st', 'nd', 'rd'];
              const v = n % 100;
              return n + (s[(v - 20) % 10] || s[v] || s[0]);
            };

            return (
              <>
                <div className="text-xs text-[#00285e] mb-3 font-medium">
                  If the round ended now, here's how the standings would change:
                </div>
                {hasExclusionSideGame && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 text-xs text-amber-700">
                    Projected points reflect the Main Game only. Net Stroke Play allocation (Best Of) resolves at end of round.
                  </div>
                )}
                <div className="space-y-2">
                  {projectionRows.map((row, index) => {
                    const newRank = index + 1;
                    const oldRank = beforeRanking.indexOf(row.uid) + 1;
                    const movement = oldRank - newRank;
                    const isExpanded = expandedUid === row.uid;

                    return (
                      <div key={row.uid} className={`rounded-lg overflow-hidden ${row.isInEvent ? 'bg-white' : 'bg-[#f0f4ff]/50 opacity-60'}`}>
                        {/* Main row */}
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer"
                          onClick={() => row.isInEvent && setExpandedUid(isExpanded ? null : row.uid)}
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
                                <span className="text-xs text-[#00285e]">+{row.projected} pts this event</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-sm font-bold text-[#00285e]">{row.newTotal} pts</div>
                              {row.basePoints !== row.newTotal && (
                                <div className="text-xs text-gray-400">was {row.basePoints}</div>
                              )}
                            </div>
                            {row.isInEvent && row.projected > 0 && (
                              <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                            )}
                          </div>
                        </div>

                        {/* Expandable breakdown */}
                        {isExpanded && row.projected > 0 && (
                          <div className="px-4 pb-3 border-t border-[#dce8f5]">
                            <div className="pt-2 space-y-1">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Points breakdown</div>

                              {/* Participation */}
                              {row.participationPoints > 0 && (
                                <div className="flex justify-between text-xs text-gray-600">
                                  <span>Participation</span>
                                  <span className="font-semibold text-green-700">+{row.participationPoints}</span>
                                </div>
                              )}

                              {/* Main game position */}
                              {row.positionPoints > 0 && (
                                <div className="flex justify-between text-xs text-gray-600">
                                  <span>
                                    Main game{row.position ? ` (${ordinal(row.position)} place)` : ''}
                                  </span>
                                  <span className="font-semibold text-green-700">+{row.positionPoints}</span>
                                </div>
                              )}

                              {/* Skins per side game */}
                              {row.skinsBreakdown.map(sg => (
                                <div key={sg.name} className="flex justify-between text-xs text-gray-600">
                                  <span>
                                    {sg.name}
                                    {sg.skins > 0 ? ` (${sg.skins} skin${sg.skins !== 1 ? 's' : ''})` : ''}
                                  </span>
                                  <span className={`font-semibold ${sg.points > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                                    {sg.points > 0 ? `+${sg.points}` : '0'}
                                  </span>
                                </div>
                              ))}

                              {/* Stat games + bonuses */}
                              {[...row.statGamesBreakdown, ...row.bonusBreakdown].map(g => (
                                <div key={g.id} className="flex justify-between text-xs text-gray-600">
                                  <span>{g.name}</span>
                                  <span className={`font-semibold ${g.points > 0 ? 'text-green-700' : 'text-red-600'}`}>
                                    {g.points > 0 ? `+${g.points}` : g.points}
                                  </span>
                                </div>
                              ))}

                              {/* 9's per side game */}
                              {row.ninesBreakdown.map(sg => (
                                <div key={sg.id} className="flex justify-between text-xs text-gray-600">
                                  <span>{sg.name}</span>
                                  <span className={`font-semibold ${sg.points > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                                    {sg.points > 0 ? `+${sg.points}` : '0'}
                                  </span>
                                </div>
                              ))}

                              {/* Total */}
                              <div className="flex justify-between text-xs font-bold text-[#00285e] border-t border-[#dce8f5] pt-1 mt-1">
                                <span>Total this event</span>
                                <span>+{row.projected}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Points key */}
                <div className="mt-3 pt-3 border-t border-[#dce8f5]">
                  <div className="text-xs text-[#00285e] font-medium mb-2">Points this event:</div>
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
                          <span key={place} className="text-xs bg-white text-[#00285e] px-2 py-1 rounded-full border border-[#dce8f5]">
                            {ord}: {pts}pts
                          </span>
                        );
                      })}
                    {leaguePoints.participationPoints > 0 && (
                      <span className="text-xs bg-white text-[#00285e] px-2 py-1 rounded-full border border-[#dce8f5]">
                        Participation: {leaguePoints.participationPoints}pts
                      </span>
                    )}
                    {skinsSideGames.map(sg => (
                      <span key={sg.id} className="text-xs bg-amber-50 text-amber-800 px-2 py-1 rounded-full border border-amber-200">
                        {sg.name}: {sg.pointsPerSkin}pt/skin
                      </span>
                    ))}
                  </div>
                </div>
              </>
            );
          })() : (
            <div className="text-center py-4 text-[#00285e] text-sm">Could not load standings</div>
          )}
        </div>
      )}
    </div>
  );
}
