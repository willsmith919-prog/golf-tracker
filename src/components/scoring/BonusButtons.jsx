// ============================================================
// BONUS BUTTONS
// Tap-to-award bonuses (Chip-in, Sandy...) for the current hole.
// Tap once to award, tap again to undo. Saves immediately —
// independent of Save & Next / Quick Enter.
//
// Individual formats: one button per bonus.
// Team formats: each bonus shows a chip per teammate, since
// bonuses always belong to an individual player.
//
// Props:
//   bonusDefs  — [{ id, name, points }] from meta.leaguePoints.bonusPoints
//   recipients — [{ uid, name }] who can earn a bonus on this card
//   holeNum    — the current hole
//   players    — event players object (reads players[uid].bonuses)
//   onToggle   — (uid, bonusId, awarded) => void
// ============================================================

const pointsText = (pts) => `${pts > 0 ? '+' : ''}${pts}`;

export default function BonusButtons({ bonusDefs, recipients, holeNum, players, onToggle }) {
  if (!bonusDefs?.length || !recipients?.length) return null;

  const isAwarded = (uid, bonusId) => !!players?.[uid]?.bonuses?.[holeNum]?.[bonusId];
  const isSingle = recipients.length === 1;

  const chipClass = (on) =>
    `rounded-xl font-semibold transition-all border-2 ${
      on
        ? 'bg-amber-400 border-amber-500 text-white shadow-md'
        : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50'
    }`;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-4 mb-4">
      <div className="text-sm font-semibold text-gray-700 mb-3">⭐ Bonuses · Hole {holeNum}</div>

      {isSingle ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {bonusDefs.map(def => {
            const uid = recipients[0].uid;
            const on = isAwarded(uid, def.id);
            return (
              <button
                key={def.id}
                onClick={() => onToggle(uid, def.id, !on)}
                className={`${chipClass(on)} px-3 py-3 text-sm`}
              >
                {on && '✓ '}{def.name}
                <span className={`ml-1 text-xs ${on ? 'text-white/90' : 'text-amber-600'}`}>{pointsText(def.points)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {bonusDefs.map(def => (
            <div key={def.id}>
              <div className="text-xs font-semibold text-gray-500 mb-1.5">
                {def.name} <span className="text-amber-600">{pointsText(def.points)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recipients.map(r => {
                  const on = isAwarded(r.uid, def.id);
                  return (
                    <button
                      key={r.uid}
                      onClick={() => onToggle(r.uid, def.id, !on)}
                      className={`${chipClass(on)} px-3 py-2 text-xs`}
                    >
                      {on && '✓ '}{r.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
