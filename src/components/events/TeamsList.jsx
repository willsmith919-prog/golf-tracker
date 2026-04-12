import { useState } from 'react';
import { ref, set } from 'firebase/database';
import { database } from '../../firebase';

export default function TeamsList({
  currentEvent,
  currentUser,
  myTeamId,
  teams,
  players,
  usesMulligans
}) {
  const [editingTeamName, setEditingTeamName] = useState(null);
  const [teamNameValue, setTeamNameValue] = useState('');

  const saveTeamName = (teamId, name) => {
    const trimmed = name.trim();
    if (trimmed) {
      set(ref(database, `events/${currentEvent.id}/teams/${teamId}/name`), trimmed);
    }
    setEditingTeamName(null);
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">Teams</h2>
      {Object.entries(teams).length === 0 ? (
        <p className="text-gray-500 text-center py-4">No teams created yet</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(teams)
            .sort(([, a], [, b]) => (a.createdAt || 0) - (b.createdAt || 0))
            .map(([teamId, team]) => (
              <div key={teamId} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  {editingTeamName === teamId ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={teamNameValue}
                        onChange={(e) => setTeamNameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveTeamName(teamId, teamNameValue);
                          if (e.key === 'Escape') setEditingTeamName(null);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border-2 border-[#c8d6e5] focus:border-[#00285e] focus:outline-none text-sm font-semibold"
                        autoFocus
                      />
                      <button
                        onClick={() => saveTeamName(teamId, teamNameValue)}
                        className="px-2 py-1 rounded text-xs font-semibold bg-[#00285e] text-white hover:bg-[#003a7d]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTeamName(null)}
                        className="px-2 py-1 rounded text-xs font-semibold bg-gray-200 text-gray-600 hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-bold text-gray-900">{team.name || 'Unnamed Team'}</h3>
                      {teamId === myTeamId && (
                        <>
                          <span className="text-[10px] bg-[#f0f4ff] text-[#00285e] px-1.5 py-0.5 rounded-full">Your Team</span>
                          <button
                            onClick={() => {
                              setEditingTeamName(teamId);
                              setTeamNameValue(team.name || '');
                            }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            ✏️
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-1">
                  {Object.keys(team.members || {}).map(uid => (
                    <div key={uid} className="flex items-center gap-2 text-sm text-gray-700">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        players.find(p => p.uid === uid)?.role === 'host' ? 'bg-yellow-500' : 'bg-[#00285e]'
                      }`}>
                        {(currentEvent.players?.[uid]?.displayName || '?').charAt(0).toUpperCase()}
                      </div>
                      {currentEvent.players?.[uid]?.displayName || 'Unknown'}
                      {uid === currentUser?.uid && (
                        <span className="text-[10px] bg-[#f0f4ff] text-[#00285e] px-1 py-0.5 rounded-full">You</span>
                      )}
                    </div>
                  ))}
                </div>

                {team.scoredByLog && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    {Object.values(team.scoredByLog).map((entry, i) => (
                      <p key={i} className="text-xs text-orange-600">
                        Holes {entry.holes.join(', ')} entered by {entry.name}
                      </p>
                    ))}
                  </div>
                )}

                {usesMulligans && team.mulligansTotal > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2">
                    <span className="text-xs text-[#00285e] font-semibold">🎟️ Mulligans:</span>
                    <span className="text-sm font-bold text-[#00285e]">
                      {team.mulligansRemaining ?? team.mulligansTotal}
                    </span>
                    <span className="text-xs text-gray-400">of {team.mulligansTotal}</span>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
