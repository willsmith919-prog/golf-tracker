import { ref, update, onValue, off } from 'firebase/database';
import { useEffect } from 'react';
import { database } from '../../firebase';

export default function EventLobbyView({
  currentUser,
  currentEvent,
  setCurrentEvent,
  feedback,
  setFeedback,
  setView,
  setSelectedTeam
}) {
  // Listen for real-time updates to this event (so we see new players join live)
  useEffect(() => {
    if (!currentEvent?.id) return;

    const eventRef = ref(database, `events/${currentEvent.id}`);
    const listener = onValue(eventRef, (snapshot) => {
      const updatedEvent = snapshot.val();
      if (updatedEvent) {
        setCurrentEvent({ id: currentEvent.id, ...updatedEvent });
      }
    });

    // Clean up the listener when we leave this view
    return () => off(eventRef, 'value', listener);
  }, [currentEvent?.id]);

  // Build the players list from the event data
  const players = Object.entries(currentEvent.players || {}).map(([uid, data]) => ({
    uid,
    ...data
  }));

  const isHost = currentEvent.players?.[currentUser?.uid]?.role === 'host';
  const eventStatus = currentEvent.meta?.status || 'open';

  const startEvent = async () => {
    if (!isHost) return;

    if (players.length < 2) {
      setFeedback('Need at least 2 players to start');
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    try {
      await update(ref(database, `events/${currentEvent.id}/meta`), {
        status: 'active'
      });
      setFeedback('Event started!');
      setTimeout(() => setFeedback(''), 2000);
    } catch (error) {
      console.error('Error starting event:', error);
      setFeedback('Error starting event. Try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">
          ← Back to Home
        </button>

        {/* Event Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{currentEvent.meta.name}</h1>
            <div className="flex items-center gap-2">
              {isHost && eventStatus === 'open' && (
                <button
                  onClick={() => setView('edit-event')}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
                >
                  ✏️ Edit
                </button>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
              eventStatus === 'open'
                ? 'bg-yellow-100 text-yellow-700'
                : eventStatus === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {eventStatus}
            </span>
            </div>
          </div>
          <div className="space-y-1 text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Course:</span>
              {currentEvent.meta.courseName}
              {currentEvent.meta.teeName && (
                <span className="text-gray-400">({currentEvent.meta.teeName})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Format:</span>
              {currentEvent.meta.formatName || currentEvent.meta.format}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Date:</span>
              {new Date(currentEvent.meta.date).toLocaleDateString()}
              {currentEvent.meta.time && ` at ${currentEvent.meta.time}`}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Holes:</span>
              {currentEvent.meta.numHoles} holes (starting on {currentEvent.meta.startingHole})
            </div>
          </div>

          {/* Event Code — always visible so host can share */}
          <div className="mt-4 flex items-center gap-3">
            <div className="bg-blue-50 px-4 py-2 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Event Code</div>
              <div className="font-mono font-bold text-blue-600 text-lg">{currentEvent.meta.eventCode}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentEvent.meta.eventCode);
                setFeedback('Code copied!');
                setTimeout(() => setFeedback(''), 2000);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
            >
              Copy Code
            </button>
          </div>
          {feedback && <div className="mt-2 text-sm text-green-600">{feedback}</div>}
        </div>

        {/* Players List */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Players ({players.length})
          </h2>
          
          {players.length > 0 ? (
            <div className="space-y-3">
              {players.map(player => (
                <div key={player.uid} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar circle — yellow for host, blue for player */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        player.role === 'host' ? 'bg-yellow-500' : 'bg-blue-500'
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
                        </div>
                        {player.handicap != null && (
                          <div className="text-sm text-gray-500">
                            Handicap: {player.handicap}
                          </div>
                        )}
                      </div>
                    </div>
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

        {/* Host Controls — only shown to the host when event is still open */}
        {isHost && eventStatus === 'open' && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Host Controls</h2>
            <p className="text-sm text-gray-600 mb-4">
              Once all players have joined, start the event to begin scoring.
              {players.length < 2 && ' (Need at least 2 players)'}
            </p>
            <button
              onClick={startEvent}
              disabled={players.length < 2}
              className={`w-full py-4 rounded-xl font-semibold text-lg shadow-lg transition-all ${
                players.length >= 2
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Start Event
            </button>
          </div>
        )}

        {/* Active Event — Enter Scoring */}
        {eventStatus === 'active' && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Event is Live! 🏌️</h2>
            <p className="text-sm text-gray-600 mb-4">
              The event has started. Enter your scores below.
            </p>
            <button
              onClick={() => {
                setSelectedTeam(currentUser.uid);
                setView('scoring');
              }}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 rounded-xl font-semibold text-lg shadow-lg transition-all"
            >
              Enter My Scores
            </button>
          </div>
        )}

        {/* Host Controls when event is active — End or Reopen */}
        {isHost && (eventStatus === 'active' || eventStatus === 'completed') && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Host Controls</h2>
            <div className="space-y-3">
              {eventStatus === 'active' && (
                <button
                  onClick={async () => {
                    await update(ref(database, `events/${currentEvent.id}/meta`), {
                      status: 'completed'
                    });
                    setFeedback('Event ended');
                    setTimeout(() => setFeedback(''), 2000);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold transition-all"
                >
                  End Event
                </button>
              )}
              {eventStatus === 'completed' && (
                <button
                  onClick={async () => {
                    await update(ref(database, `events/${currentEvent.id}/meta`), {
                      status: 'active'
                    });
                    setFeedback('Event reopened');
                    setTimeout(() => setFeedback(''), 2000);
                  }}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-xl font-semibold transition-all"
                >
                  Reopen Event
                </button>
              )}
              <button
                onClick={async () => {
                  await update(ref(database, `events/${currentEvent.id}/meta`), {
                    status: 'open'
                  });
                  setFeedback('Event reset to open');
                  setTimeout(() => setFeedback(''), 2000);
                }}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition-all"
              >
                Reset to Open
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
