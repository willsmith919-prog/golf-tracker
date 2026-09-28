import { calculateStatGames, statGameLabel } from '../../utils/statGames';
import { calculateBonusPoints } from '../../utils/bonusPoints';

// ============================================================
// STAT GAMES LEADERBOARD
// Live counts for each stat game (Most Birdies, Fewest Bogeys...).
// Mid-round, "leading" is shown among everyone who has scored;
// the points themselves only go to players who finish every hole.
// ============================================================

export default function StatGamesLeaderboard({ currentEvent, currentUser }) {
  const meta = currentEvent?.meta || {};
  const players = currentEvent?.players || {};
  const statGames = meta.leaguePoints?.statGames || [];
  const { games } = calculateStatGames(currentEvent, statGames);
  const bonusDefs = meta.leaguePoints?.bonusPoints || [];
  const { byPlayer: bonusByPlayer } = calculateBonusPoints(currentEvent, bonusDefs);
  const getName = (uid) => players[uid]?.displayName || 'Unknown';

  // Which holes each player earned each bonus on: { bonusId: [{ uid, holes: [..] }] }
  const bonusAwards = bonusDefs.map(def => ({
    def,
    earners: Object.entries(players)
      .map(([uid, p]) => ({
        uid,
        holes: Object.entries(p.bonuses || {}).filter(([, awards]) => awards?.[def.id]).map(([h]) => h),
        points: bonusByPlayer[uid]?.[def.id] || 0
      }))
      .filter(e => e.holes.length > 0)
      .sort((a, b) => b.holes.length - a.holes.length)
  }));

  const bonusSection = bonusDefs.length > 0 && (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-2">⭐ Bonuses</h3>
      <div className="space-y-2">
        {bonusAwards.map(({ def, earners }) => (
          <div key={def.id} className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-gray-800">{def.name}</span>
              <span className="text-xs text-amber-700 font-semibold">{def.points > 0 ? '+' : ''}{def.points} each</span>
            </div>
            {earners.length === 0 ? (
              <div className="text-xs text-gray-400 mt-0.5">None yet</div>
            ) : (
              earners.map(e => (
                <div key={e.uid} className="flex justify-between text-xs text-gray-600 mt-0.5">
                  <span>{getName(e.uid)} <span className="text-gray-400">· hole{e.holes.length > 1 ? 's' : ''} {e.holes.join(', ')}</span></span>
                  <span className="font-semibold">{e.points > 0 ? '+' : ''}{e.points}</span>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );

  if (games.length === 0 && bonusSection) {
    return <div className="space-y-5">{bonusSection}</div>;
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-gray-500 text-sm">
          {(meta.teamSize || 1) === 1 ? 'No scores entered yet.' : 'Stat games are only scored for individual formats.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {games.map(({ game, counts, points }) => {
        const uids = Object.keys(counts);
        const isPer = game.mode === 'per';
        const isFewest = game.mode === 'fewest';
        const sorted = [...uids].sort((a, b) => (isFewest ? counts[a] - counts[b] : counts[b] - counts[a]));
        // Provisional leader among everyone who has scored (for "most", need at least 1)
        const bestValue = sorted.length ? counts[sorted[0]] : null;
        const hasLeader = !isPer && sorted.length > 0 && (isFewest || bestValue > 0);

        return (
          <div key={game.id}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-gray-900">{statGameLabel(game)}</h3>
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
                {isPer ? `${game.points > 0 ? '+' : ''}${game.points} pts each` : `${game.points} pts`}
              </span>
            </div>
            <div className="space-y-1.5">
              {sorted.map(uid => {
                const isLeader = hasLeader && counts[uid] === bestValue;
                const isMe = uid === currentUser?.uid;
                const pts = points[uid];
                return (
                  <div
                    key={uid}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border-2 ${
                      isMe ? 'border-[#00285e] bg-[#f0f4ff]' : isLeader ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {getName(uid)}
                      {isLeader && <span className="ml-1.5 text-xs text-green-700">★ leading</span>}
                    </span>
                    <span className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-bold text-gray-700">{counts[uid]}</span>
                      {pts ? (
                        <span className={`text-xs font-semibold ${pts > 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {pts > 0 ? '+' : ''}{pts} pts
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-400 text-center">
        Most / Fewest points go to players who finish every hole. Ties split the points.
      </p>
      {bonusSection}
    </div>
  );
}
