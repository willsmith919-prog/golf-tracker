import { ref, set, remove } from 'firebase/database';
import { database } from '../../firebase';

// ============================================================
// NINES GROUP CONFIG
// Shown in the event lobby for the host when the event has a 9's
// side game. 9's is a 3-player game, so a bigger event is split
// into threesomes. With exactly 3 players nothing is needed —
// they're one group automatically.
//
// Groups are stored inside the side game config at:
//   events/{eventId}/meta/sideGames/{index}/groups = [[uid, uid, uid], ...]
// Groups are never saved empty (Firebase drops empty lists) — a new
// threesome starts by picking its first player.
// ============================================================

export default function NinesGroupConfig({ currentEvent, setFeedback }) {
  const eventId = currentEvent?.id;
  const meta = currentEvent?.meta || {};
  const allPlayers = Object.entries(currentEvent?.players || {}).map(([uid, data]) => ({
    uid,
    displayName: data.displayName || 'Unknown'
  }));

  const ninesSideGames = (meta.sideGames || []).filter(sg => sg.sideGameType === 'nines');
  if (ninesSideGames.length === 0) return null;

  const saveGroups = async (sgIndex, groups) => {
    try {
      const cleaned = groups.filter(g => g.length > 0);
      const groupsRef = ref(database, `events/${eventId}/meta/sideGames/${sgIndex}/groups`);
      if (cleaned.length > 0) await set(groupsRef, cleaned);
      else await remove(groupsRef);
    } catch (err) {
      console.error("Error saving 9's groups:", err);
      setFeedback("Error saving 9's threesomes");
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  const getName = (uid) => allPlayers.find(p => p.uid === uid)?.displayName || 'Unknown';

  return (
    <div className="space-y-4">
      {ninesSideGames.map(sg => {
        const sgIndex = (meta.sideGames || []).findIndex(s => s.id === sg.id);
        const groups = (sg.groups || []).map(g => (g || []).filter(uid => allPlayers.some(p => p.uid === uid)));
        const assigned = groups.flat();
        const unassigned = allPlayers.filter(p => !assigned.includes(p.uid));
        const autoGroup = groups.length === 0 && allPlayers.length === 3;

        const addToGroup = (groupIdx, uid) => {
          const updated = groups.map((g, i) => (i === groupIdx ? [...g, uid] : g));
          saveGroups(sgIndex, updated);
        };
        const startGroup = (uid) => saveGroups(sgIndex, [...groups, [uid]]);
        const removeFromGroup = (groupIdx, uid) => {
          const updated = groups.map((g, i) => (i === groupIdx ? g.filter(id => id !== uid) : g));
          saveGroups(sgIndex, updated);
        };
        // Fill threesomes in join order — quick starting point the host can then adjust
        const autoFill = () => {
          const uids = allPlayers.map(p => p.uid);
          const chunks = [];
          for (let i = 0; i < uids.length; i += 3) chunks.push(uids.slice(i, i + 3));
          saveGroups(sgIndex, chunks);
        };

        return (
          <div key={sg.id} className="border-2 border-amber-200 bg-amber-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-800">🎯 {sg.name} — Threesomes</div>
              {allPlayers.length > 3 && (
                <button
                  onClick={autoFill}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900"
                >
                  Auto-fill
                </button>
              )}
            </div>

            {autoGroup ? (
              <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                ✅ Exactly 3 players — {allPlayers.map(p => p.displayName).join(', ')} play as one group.
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-3">
                  {groups.map((group, groupIdx) => (
                    <div key={groupIdx} className="bg-white rounded-xl border border-amber-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-700">Group {groupIdx + 1}</span>
                        <span className={`text-xs font-semibold ${group.length === 3 ? 'text-green-600' : 'text-amber-600'}`}>
                          {group.length === 3 ? '✓ Ready' : `${group.length}/3`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {group.map(uid => (
                          <span key={uid} className="inline-flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg text-xs font-medium text-gray-900">
                            {getName(uid)}
                            <button
                              onClick={() => removeFromGroup(groupIdx, uid)}
                              className="text-red-400 hover:text-red-600 ml-0.5"
                            >✕</button>
                          </span>
                        ))}
                      </div>
                      {group.length < 3 && unassigned.length > 0 && (
                        <select
                          defaultValue=""
                          onChange={(e) => { if (e.target.value) { addToGroup(groupIdx, e.target.value); e.target.value = ''; } }}
                          className="w-full px-2 py-1.5 rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 focus:border-amber-400 focus:outline-none bg-white"
                        >
                          <option value="">+ Add player...</option>
                          {unassigned.map(p => (
                            <option key={p.uid} value={p.uid}>{p.displayName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>

                {unassigned.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) { startGroup(e.target.value); e.target.value = ''; } }}
                    className="w-full px-3 py-2 rounded-xl border-2 border-dashed border-amber-300 text-sm text-amber-800 focus:border-amber-400 focus:outline-none bg-white mb-3"
                  >
                    <option value="">+ Start a new threesome with...</option>
                    {unassigned.map(p => (
                      <option key={p.uid} value={p.uid}>{p.displayName}</option>
                    ))}
                  </select>
                )}

                {unassigned.length > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                    {unassigned.length} player{unassigned.length > 1 ? 's' : ''} not in a threesome — they won't play 9's
                  </div>
                )}
                {groups.some(g => g.length !== 3) && (
                  <div className="text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2 mt-2">
                    Groups need exactly 3 players to count
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
