import { useState } from 'react';

// ============================================================
// EVENT HISTORY VIEW
// Shows all completed events for the current user.
// Tapping an event navigates to the event lobby in read-only mode.
//
// Props:
//   userEvents     — full array of user's events (active + completed)
//   setView        — navigation function
//   setCurrentEvent — sets the event for the lobby view
// ============================================================

export default function EventHistoryView({
  userEvents = [],
  setView,
  setCurrentEvent
}) {
  const completedEvents = userEvents
    .filter(e => e.status === 'completed')
    .sort((a, b) => {
      // Sort by date descending (most recent first)
      const dateA = a.meta?.date || a.date || '';
      const dateB = b.meta?.date || b.date || '';
      return new Date(dateB) - new Date(dateA);
    });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-[#00285e] p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setView('home')}
          className="text-white mb-6 hover:text-[#c8d6e5] flex items-center gap-2"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold text-white mb-6">📂 Event History</h1>

        {completedEvents.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center">
            <div className="text-4xl mb-3">🏌️</div>
            <p className="text-gray-600">No completed events yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedEvents.map(event => {
              const meta = event.meta || {};
              const playerCount = Object.keys(event.players || {}).length;
              const teamCount = Object.keys(event.teams || {}).length;
              const isTeamFormat = (meta.teamSize || 1) > 1 && teamCount > 0;

              return (
                <button
                  key={event.id}
                  onClick={() => {
                    setCurrentEvent(event);
                    setView('event-lobby');
                  }}
                  className="w-full bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {event.eventName || meta.name || 'Unnamed Event'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {meta.courseName || event.courseName || ''}
                        {meta.date ? ` · ${formatDate(meta.date)}` : ''}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {meta.formatName || meta.format || ''}
                        {isTeamFormat
                          ? ` · ${teamCount} team${teamCount !== 1 ? 's' : ''}`
                          : ` · ${playerCount} player${playerCount !== 1 ? 's' : ''}`
                        }
                      </div>
                    </div>
                    <div className="text-gray-400">›</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
