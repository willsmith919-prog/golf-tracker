import { ref, set } from 'firebase/database';
import { database } from '../../firebase';

// ============================================================
// VEGAS TEAM CONFIG
// Shown in the event lobby for the host when the event has one
// or more Vegas side games. Lets the host assign players to
// Team A / Team B (2v2) or Player A / Player B (1v1).
//
// Player assignments are stored inside the side game config at:
//   events/{eventId}/meta/sideGames/{index}
//
// Props:
//   currentEvent  — the full event object
//   setFeedback   — for showing success/error messages
// ============================================================

export default function VegasTeamConfig({ currentEvent, setFeedback }) {
  const eventId = currentEvent?.id;
  const meta = currentEvent?.meta || {};
  const allPlayers = Object.entries(currentEvent?.players || {}).map(([uid, data]) => ({
    uid,
    displayName: data.displayName || 'Unknown',
    handicap: data.handicap
  }));

  const vegasSideGames = (meta.sideGames || []).filter(sg => sg.sideGameType === 'vegas');
  if (vegasSideGames.length === 0) return null;

  const saveSideGame = async (sgIndex, updatedSg) => {
    try {
      await set(ref(database, `events/${eventId}/meta/sideGames/${sgIndex}`), updatedSg);
    } catch (err) {
      console.error('Error saving Vegas config:', err);
      setFeedback('Error saving Vegas team assignment');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {vegasSideGames.map((sg) => {
        const sgIndex = (meta.sideGames || []).findIndex(s => s.id === sg.id);
        const is2v2 = sg.type !== 'vegas1v1';

        return (
          <div key={sg.id} className="border-2 border-amber-200 bg-amber-50 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-800 mb-3">
              🎯 {sg.name} — Player Assignment
            </div>

            {is2v2 ? (
              <Vegas2v2Panel
                sg={sg}
                sgIndex={sgIndex}
                allPlayers={allPlayers}
                onSave={saveSideGame}
                setFeedback={setFeedback}
              />
            ) : (
              <Vegas1v1Panel
                sg={sg}
                sgIndex={sgIndex}
                allPlayers={allPlayers}
                onSave={saveSideGame}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==================== 2v2 PANEL ====================

function Vegas2v2Panel({ sg, sgIndex, allPlayers, onSave, setFeedback }) {
  const teamA = sg.teams?.teamA || { name: 'Team A', playerIds: [] };
  const teamB = sg.teams?.teamB || { name: 'Team B', playerIds: [] };
  const assignedIds = [...(teamA.playerIds || []), ...(teamB.playerIds || [])];
  const unassigned = allPlayers.filter(p => !assignedIds.includes(p.uid));

  const addPlayer = async (teamKey, uid) => {
    const team = sg.teams?.[teamKey] || { name: teamKey === 'teamA' ? 'Team A' : 'Team B', playerIds: [] };
    if ((team.playerIds || []).length >= 2) {
      setFeedback('Team is full (max 2 players)');
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    const updated = {
      ...sg,
      teams: {
        ...sg.teams,
        [teamKey]: { ...team, playerIds: [...(team.playerIds || []), uid] }
      }
    };
    await onSave(sgIndex, updated);
  };

  const removePlayer = async (teamKey, uid) => {
    const team = sg.teams?.[teamKey] || {};
    const updated = {
      ...sg,
      teams: {
        ...sg.teams,
        [teamKey]: { ...team, playerIds: (team.playerIds || []).filter(id => id !== uid) }
      }
    };
    await onSave(sgIndex, updated);
  };

  const TeamColumn = ({ teamKey, team }) => {
    const members = (team.playerIds || [])
      .map(uid => allPlayers.find(p => p.uid === uid))
      .filter(Boolean);
    const isFull = members.length >= 2;

    return (
      <div className="flex-1 bg-white rounded-xl border border-amber-200 p-3">
        <div className="text-xs font-semibold text-gray-700 mb-2 text-center">{team.name}</div>

        <div className="space-y-1.5 mb-2 min-h-[52px]">
          {members.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-2">No players yet</div>
          ) : (
            members.map(player => (
              <div key={player.uid} className="flex items-center justify-between bg-gray-50 px-2 py-1.5 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#00285e] flex items-center justify-center text-white text-xs font-bold">
                    {player.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-gray-900">{player.displayName}</span>
                  {player.handicap != null && (
                    <span className="text-[10px] text-gray-400">HCP: {player.handicap}</span>
                  )}
                </div>
                <button
                  onClick={() => removePlayer(teamKey, player.uid)}
                  className="text-red-400 hover:text-red-600 text-xs ml-1"
                >✕</button>
              </div>
            ))
          )}
        </div>

        {!isFull && unassigned.length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) { addPlayer(teamKey, e.target.value); e.target.value = ''; } }}
            className="w-full px-2 py-1.5 rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 focus:border-amber-400 focus:outline-none bg-white"
          >
            <option value="">+ Add player...</option>
            {unassigned.map(p => (
              <option key={p.uid} value={p.uid}>
                {p.displayName}{p.handicap != null ? ` (HCP: ${p.handicap})` : ''}
              </option>
            ))}
          </select>
        )}

        {isFull && (
          <div className="text-xs text-green-600 font-semibold text-center">✓ Full</div>
        )}
      </div>
    );
  };

  const allAssigned = (teamA.playerIds || []).length === 2 && (teamB.playerIds || []).length === 2;

  return (
    <div>
      <div className="flex gap-3 mb-3">
        <TeamColumn teamKey="teamA" team={teamA} />
        <TeamColumn teamKey="teamB" team={teamB} />
      </div>

      {unassigned.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
          {unassigned.length} player{unassigned.length > 1 ? 's' : ''} not yet assigned to a Vegas team
        </div>
      )}
      {allAssigned && (
        <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
          ✅ Both teams assigned — ready to play
        </div>
      )}
    </div>
  );
}

// ==================== 1v1 PANEL ====================

function Vegas1v1Panel({ sg, sgIndex, allPlayers, onSave }) {
  const playerAId = sg.players?.playerA || null;
  const playerBId = sg.players?.playerB || null;

  const setPlayer = async (slot, uid) => {
    const updated = {
      ...sg,
      players: { ...sg.players, [slot]: uid || null }
    };
    await onSave(sgIndex, updated);
  };

  const renderSelector = (slot, label, excludeId) => {
    const currentId = sg.players?.[slot] || '';
    const currentPlayer = allPlayers.find(p => p.uid === currentId);
    const available = allPlayers.filter(p => p.uid !== excludeId);

    return (
      <div className="flex-1 bg-white rounded-xl border border-amber-200 p-3">
        <div className="text-xs font-semibold text-gray-700 mb-2 text-center">{label}</div>
        {currentPlayer && (
          <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1.5 rounded-lg mb-2">
            <div className="w-6 h-6 rounded-full bg-[#00285e] flex items-center justify-center text-white text-xs font-bold">
              {currentPlayer.displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-gray-900">{currentPlayer.displayName}</span>
            {currentPlayer.handicap != null && (
              <span className="text-[10px] text-gray-400">HCP: {currentPlayer.handicap}</span>
            )}
          </div>
        )}
        <select
          value={currentId}
          onChange={(e) => setPlayer(slot, e.target.value || null)}
          className="w-full px-2 py-1.5 rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 focus:border-amber-400 focus:outline-none bg-white"
        >
          <option value="">Select player...</option>
          {available.map(p => (
            <option key={p.uid} value={p.uid}>
              {p.displayName}{p.handicap != null ? ` (HCP: ${p.handicap})` : ''}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const bothAssigned = !!playerAId && !!playerBId;

  return (
    <div>
      <div className="flex gap-3 mb-3">
        {renderSelector('playerA', 'Player A', playerBId)}
        {renderSelector('playerB', 'Player B', playerAId)}
      </div>
      {bothAssigned ? (
        <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
          ✅ Both players assigned — ready to play
        </div>
      ) : (
        <div className="text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
          Select both players to set up the Vegas match
        </div>
      )}
    </div>
  );
}
