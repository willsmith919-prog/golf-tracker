import { STAT_TYPES, newStatGame, statGameLabel } from '../../utils/statGames';

// ============================================================
// STAT GAMES EDITOR
// Add/edit bonus-point stat games ("Most Birdies", "Fewest Bogeys").
// Used in league/series setup (defaults) and in the event form
// (per-event copy). Parent owns the array; this just edits it.
//
// Props:
//   statGames — array of { id, stat, mode, points }
//   onChange  — called with the updated array
// ============================================================

export default function StatGamesEditor({ statGames = [], onChange }) {
  const update = (id, changes) => {
    onChange(statGames.map(g => (g.id === id ? { ...g, ...changes } : g)));
  };

  const remove = (id) => onChange(statGames.filter(g => g.id !== id));

  const add = () => {
    // Suggest a stat that isn't used yet
    const used = statGames.map(g => g.stat);
    const next = ['birdies', 'bogeys', 'doubles', 'pars', 'eagles'].find(s => !used.includes(s)) || 'birdies';
    onChange([...statGames, { ...newStatGame(next), id: `stat-${Date.now()}` }]);
  };

  return (
    <div>
      <div className="space-y-2">
        {statGames.map(game => {
          const pts = Number(game.points) || 0;
          const isPer = game.mode === 'per';
          return (
            <div key={game.id} className="bg-white rounded-lg border-2 border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">{statGameLabel(game)}</span>
                <button
                  type="button"
                  onClick={() => remove(game.id)}
                  className="text-red-500 hover:text-red-700 text-xs font-semibold"
                >
                  Remove
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={game.stat}
                  onChange={(e) => update(game.id, { stat: e.target.value, mode: STAT_TYPES[e.target.value].defaultMode })}
                  className="px-2 py-1.5 rounded-lg border-2 border-gray-200 text-sm bg-white focus:border-[#00285e] focus:outline-none"
                >
                  {Object.entries(STAT_TYPES).map(([key, t]) => (
                    <option key={key} value={key}>{t.label} ({t.detail})</option>
                  ))}
                </select>
                <select
                  value={game.mode}
                  onChange={(e) => update(game.id, { mode: e.target.value, points: Math.abs(pts) || 1 })}
                  className="px-2 py-1.5 rounded-lg border-2 border-gray-200 text-sm bg-white focus:border-[#00285e] focus:outline-none"
                >
                  <option value="most">Most wins</option>
                  <option value="fewest">Fewest wins</option>
                  <option value="per">Points each</option>
                </select>
                <div className="flex items-center gap-1">
                  {isPer && (
                    <button
                      type="button"
                      onClick={() => update(game.id, { points: -pts })}
                      className={`w-8 h-8 rounded-lg text-sm font-bold ${pts < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                      title="Switch between adding and subtracting points"
                    >
                      {pts < 0 ? '−' : '+'}
                    </button>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={Math.abs(pts)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                      update(game.id, { points: pts < 0 ? -val : val });
                    }}
                    className="w-14 px-2 py-1.5 text-center rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none text-sm"
                  />
                  <span className="text-xs text-gray-400">pts{isPer ? ' each' : ''}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 text-[#00285e] hover:text-[#003a7d] text-sm font-semibold"
      >
        + Add stat game
      </button>
    </div>
  );
}
