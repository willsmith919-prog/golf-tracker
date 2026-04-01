import { useState } from 'react';
import { ref, set, remove } from 'firebase/database';
import { database } from '../../firebase';

export default function PlayersList({
  currentEvent,
  currentUser,
  isHost,
  isTeamFormat,
  eventStatus,
  teams,
  players,
  setFeedback
}) {
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [guestName, setGuestName] = useState('');

  const handleAddGuest = async () => {
    const trimmedName = guestName.trim();
    if (!trimmedName) {
      setFeedback('Please enter a name');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }
    try {
      const guestId = `guest-${Date.now()}`;
      await set(ref(database, `events/${currentEvent.id}/players/${guestId}`), {
        displayName: trimmedName,
        joinedAt: Date.now(),
        role: 'player',
        handicap: null,
        isGuest: true
      });
      setGuestName('');
      setShowAddGuest(false);
      setFeedback(`${trimmedName} added as guest!`);
      setTimeout(() => setFeedback(''), 2000);
    } catch (error) {
      console.error('Error adding guest:', error);
      setFeedback('Error adding guest');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  const handleRemoveGuest = async (player) => {
    if (!confirm(`Remove ${player.displayName} from the event?`)) return;
    try {
      await remove(ref(database, `events/${currentEvent.id}/players/${player.uid}`));
      for (const [teamId, team] of Object.entries(teams)) {
        if (team.members && team.members[player.uid]) {
          await remove(ref(database, `events/${currentEvent.id}/teams/${teamId}/members/${player.uid}`));
        }
      }
      setFeedback(`${player.displayName} removed`);
      setTimeout(() => setFeedback(''), 2000);
    } catch (err) {
      console.error('Error removing guest:', err);
      setFeedback('Error removing guest');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Players ({players.length})</h2>
        {isHost && (eventStatus === 'open' || eventStatus === 'active') && (
          <button
            onClick={() => setShowAddGuest(!showAddGuest)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
          >
            + Add Guest
          </button>
        )}
      </div>

      {showAddGuest && (
        <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <div className="text-sm font-semibold text-gray-700 mb-2">Add a guest player (no account needed)</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddGuest(); }}
              placeholder="Guest name"
              className="flex-1 px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-sm"
              autoFocus
            />
            <button
              onClick={handleAddGuest}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAddGuest(false); setGuestName(''); }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {players.length > 0 ? (
        <div className="space-y-3">
          {players.map(player => (
            <div key={player.uid} className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                    player.role === 'host' ? 'bg-yellow-500' : player.isGuest ? 'bg-gray-400' : 'bg-blue-500'
                  }`}>
                    {(player.displayName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {player.displayName || 'Unknown Player'}
                      {player.role === 'host' && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Host</span>
                      )}
                      {player.uid === currentUser?.uid && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">You</span>
                      )}
                      {player.isGuest && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Guest</span>
                      )}
                    </div>
                    {player.handicap != null && (
                      <div className="text-sm text-gray-500">Handicap: {player.handicap}</div>
                    )}
                  </div>
                </div>

                {/* Team assignment badge */}
                {isTeamFormat && (() => {
                  for (const [teamId, team] of Object.entries(teams)) {
                    if (team.members && team.members[player.uid]) {
                      return (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                          {team.name || 'Unnamed Team'}
                        </span>
                      );
                    }
                  }
                  return (
                    <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-1 rounded-full">
                      Unassigned
                    </span>
                  );
                })()}

                {/* Remove guest button — host only */}
                {isHost && player.isGuest && (eventStatus === 'open' || eventStatus === 'active') && (
                  <button
                    onClick={() => handleRemoveGuest(player)}
                    className="text-red-400 hover:text-red-600 text-xs font-semibold ml-2"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600">No players yet — share the event code!</p>
        </div>
      )}
    </div>
  );
}
