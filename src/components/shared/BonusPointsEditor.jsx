import { BONUS_PRESETS, newBonus } from '../../utils/bonusPoints';

// ============================================================
// BONUS POINTS EDITOR
// Add/edit tap-to-award bonuses (Chip-in, Sandy, Greenie...).
// Used in league/series setup (defaults) and the event form.
//
// Props:
//   bonusPoints — array of { id, name, points }
//   onChange    — called with the updated array
// ============================================================

export default function BonusPointsEditor({ bonusPoints = [], onChange }) {
  const update = (id, changes) => onChange(bonusPoints.map(b => (b.id === id ? { ...b, ...changes } : b)));
  const remove = (id) => onChange(bonusPoints.filter(b => b.id !== id));
  const add = (name, points) => onChange([...bonusPoints, { ...newBonus(name, points), id: `bonus-${Date.now()}` }]);

  const unusedPresets = BONUS_PRESETS.filter(p => !bonusPoints.some(b => b.name.toLowerCase() === p.name.toLowerCase()));

  return (
    <div>
      <div className="space-y-2">
        {bonusPoints.map(bonus => {
          const pts = Number(bonus.points) || 0;
          return (
            <div key={bonus.id} className="flex items-center gap-2 bg-white rounded-lg border-2 border-gray-200 p-2">
              <input
                type="text"
                value={bonus.name}
                onChange={(e) => update(bonus.id, { name: e.target.value })}
                placeholder="Bonus name"
                className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none text-sm"
              />
              <button
                type="button"
                onClick={() => update(bonus.id, { points: -pts })}
                className={`w-8 h-8 flex-shrink-0 rounded-lg text-sm font-bold ${pts < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                title="Switch between adding and subtracting points"
              >
                {pts < 0 ? '−' : '+'}
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={Math.abs(pts)}
                onChange={(e) => {
                  const val = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                  update(bonus.id, { points: pts < 0 ? -val : val });
                }}
                className="w-12 flex-shrink-0 px-2 py-1.5 text-center rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none text-sm"
              />
              <span className="text-xs text-gray-400 flex-shrink-0">pts</span>
              <button
                type="button"
                onClick={() => remove(bonus.id)}
                className="text-red-500 hover:text-red-700 text-xs font-semibold flex-shrink-0 ml-1"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        {unusedPresets.map(p => (
          <button
            key={p.name}
            type="button"
            onClick={() => add(p.name, p.points)}
            className="text-xs font-semibold px-2.5 py-1 rounded-full border-2 border-dashed border-gray-300 text-gray-600 hover:border-[#00285e] hover:text-[#00285e]"
          >
            + {p.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => add('', 1)}
          className="text-xs font-semibold px-2.5 py-1 rounded-full border-2 border-dashed border-gray-300 text-gray-600 hover:border-[#00285e] hover:text-[#00285e]"
        >
          + Custom
        </button>
      </div>
    </div>
  );
}
