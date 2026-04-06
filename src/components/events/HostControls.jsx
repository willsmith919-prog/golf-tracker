import { ref, set } from 'firebase/database';
import { database } from '../../firebase';

export default function HostControls({
  currentEvent,
  eventStatus,
  isTeamFormat,
  players,
  teams,
  usesMulligans,
  setFeedback,
  onStartEvent,
  onEndEvent,
  onReopenEvent,
  onResetEvent
}) {
  const handleMulliganChange = (path, currentVal, delta) => {
    const newVal = Math.max(0, currentVal + delta);
    set(ref(database, `${path}/mulligansTotal`), newVal);
    set(ref(database, `${path}/mulligansRemaining`), newVal);
  };

  const teamsWithMembers = Object.values(teams).filter(
    t => t.members && Object.keys(t.members).length > 0
  ).length;
  const canStart = isTeamFormat ? teamsWithMembers > 0 : players.length >= 2;

  // Section 1 shows when open or active (mulligan assignment + start button)
  const showSection1 = eventStatus === 'open' || eventStatus === 'active';
  // Section 2 shows when active or completed (end/reopen/reset)
  const showSection2 = eventStatus === 'active' || eventStatus === 'completed';

  return (
    <>
      {/* ---- SECTION 1: Mulligan assignment + Start Event ---- */}
      {showSection1 && (usesMulligans || eventStatus === 'open') && (
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Host Controls</h2>

          {usesMulligans && (
            <div className="mb-5 p-4 bg-[#f0f4ff] border-2 border-[#dce8f5] rounded-xl">
              <h3 className="text-sm font-bold text-[#007a78] mb-1">🎟️ Assign Mulligans</h3>
              <p className="text-xs text-[#00285e] mb-3">
                Set how many mulligans each {isTeamFormat ? 'team' : 'player'} gets for this event.
              </p>
              <div className="space-y-2">
                {isTeamFormat ? (
                  Object.entries(teams)
                    .sort(([, a], [, b]) => (a.createdAt || 0) - (b.createdAt || 0))
                    .map(([teamId, team]) => {
                      const memberNames = Object.keys(team.members || {})
                        .map(uid => currentEvent.players?.[uid]?.displayName || 'Unknown')
                        .join(' & ');
                      const path = `events/${currentEvent.id}/teams/${teamId}`;
                      return (
                        <div key={teamId} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm text-gray-900 truncate">{team.name || 'Unnamed Team'}</div>
                            <div className="text-xs text-gray-500 truncate">{memberNames}</div>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <button
                              onClick={() => handleMulliganChange(path, team.mulligansTotal || 0, -1)}
                              className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-lg flex items-center justify-center"
                            >−</button>
                            <div className="w-10 text-center font-bold text-lg text-[#00285e]">
                              {team.mulligansTotal || 0}
                            </div>
                            <button
                              onClick={() => handleMulliganChange(path, team.mulligansTotal || 0, 1)}
                              className="w-8 h-8 rounded-lg bg-[#e8eef8] hover:bg-[#d0dcf0] text-[#00285e] font-bold text-lg flex items-center justify-center"
                            >+</button>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  players.map(player => {
                    const path = `events/${currentEvent.id}/players/${player.uid}`;
                    const current = currentEvent.players?.[player.uid]?.mulligansTotal || 0;
                    return (
                      <div key={player.uid} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-gray-900 truncate">
                            {player.displayName || 'Unknown'}
                          </div>
                          {player.handicap != null && (
                            <div className="text-xs text-gray-500">HCP: {player.handicap}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={() => handleMulliganChange(path, current, -1)}
                            className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-lg flex items-center justify-center"
                          >−</button>
                          <div className="w-10 text-center font-bold text-lg text-[#00285e]">{current}</div>
                          <button
                            onClick={() => handleMulliganChange(path, current, 1)}
                            className="w-8 h-8 rounded-lg bg-[#e8eef8] hover:bg-[#d0dcf0] text-[#00285e] font-bold text-lg flex items-center justify-center"
                          >+</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {eventStatus === 'open' && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                {isTeamFormat
                  ? teamsWithMembers === 0
                    ? 'Create a team and assign players to get started (use the Teams tab).'
                    : `${teamsWithMembers} team${teamsWithMembers !== 1 ? 's' : ''} ready. You can start now — more players can join and be assigned to teams later.`
                  : players.length < 2
                  ? 'Need at least 2 players to start.'
                  : 'Ready to start! More players can still join after the event begins.'
                }
              </p>
              <button
                onClick={onStartEvent}
                disabled={!canStart}
                className={`w-full py-4 rounded-xl font-semibold text-lg shadow-lg transition-all ${
                  canStart
                    ? 'bg-[#e17055] text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Start Event
              </button>
            </>
          )}
        </div>
      )}

      {/* ---- SECTION 2: End / Reopen / Reset ---- */}
      {showSection2 && (
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Host Controls</h2>
          <div className="space-y-3">
            {eventStatus === 'active' && (
              <button
                onClick={onEndEvent}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold transition-all"
              >
                End Event
              </button>
            )}
            {eventStatus === 'completed' && (
              <button
                onClick={onReopenEvent}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-xl font-semibold transition-all"
              >
                Reopen Event
              </button>
            )}
            <button
              onClick={onResetEvent}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition-all"
            >
              Reset to Open
            </button>
          </div>
        </div>
      )}
    </>
  );
}
