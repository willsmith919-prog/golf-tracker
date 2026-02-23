import { signOut } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { useEffect } from 'react';
import { auth, database } from '../../firebase';

export default function HomeView({
  currentUser,
  userProfile,
  userLeagues,
  userEvents = [],
  setUserEvents,
  loadUserEvents,
  isAdmin,
  joinCode,
  setJoinCode,
  feedback,
  setFeedback,
  setView,
  setCurrentLeague,
  setCurrentEvent
}) {
  // Refresh events every time HomeView is shown
  useEffect(() => {
    if (currentUser?.uid && loadUserEvents) {
      loadUserEvents(currentUser.uid).then(events => {
        setUserEvents(events);
      });
    }
  }, [currentUser?.uid]);

  // Split events into active vs completed
  const activeEvents = userEvents
    .filter(e => e.status !== 'completed')
    // Sort: active events first, then open, alphabetical within each group
    .sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return (a.eventName || '').localeCompare(b.eventName || '');
    });
  const hasEventHistory = userEvents.some(e => e.status === 'completed');

  const joinEvent = async () => {
    if (!joinCode) {
      setFeedback('Please enter an event code');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }

    try {
      const codeSnapshot = await get(ref(database, `eventCodes/${joinCode}`));
      if (!codeSnapshot.exists()) {
        setFeedback('Event not found. Check your code.');
        setTimeout(() => setFeedback(''), 3000);
        return;
      }

      const eventId = codeSnapshot.val();
      const eventSnapshot = await get(ref(database, `events/${eventId}`));
      
      if (!eventSnapshot.exists()) {
        setFeedback('Event not found.');
        setTimeout(() => setFeedback(''), 3000);
        return;
      }

      const event = eventSnapshot.val();

      // Check if the user is already in this event
      const alreadyJoined = event.players && event.players[currentUser.uid];

      if (!alreadyJoined) {
        // Add user to the event's players node
        await set(ref(database, `events/${eventId}/players/${currentUser.uid}`), {
          displayName: userProfile?.displayName || currentUser.displayName || 'Unknown',
          joinedAt: Date.now(),
          role: 'player',
          handicap: userProfile?.handicap || null
        });

        // Add event reference to user's profile
        await set(ref(database, `users/${currentUser.uid}/events/${eventId}`), {
          role: 'player',
          joinedAt: Date.now()
        });
      }

      setCurrentEvent({ id: eventId, ...event });
      setJoinCode('');
      setView('event-lobby');
      setFeedback('');
    } catch (error) {
      console.error('Error joining event:', error);
      setFeedback('Error joining event. Please try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>LiveLinks</h1>
            {userProfile && (
              <p className="text-white/80">Welcome, {userProfile.displayName}</p>
            )}
          </div>
          <button
            onClick={async () => {
              await signOut(auth);
              setView('login');
            }}
            className="text-white/80 hover:text-white text-sm font-medium"
          >
            Logout
          </button>
        </div>

        {/* ADMIN SECTION */}
        {isAdmin() && (
          <div className="mb-6">
            <h2 className="text-white text-lg font-semibold mb-3">⚙️ ADMIN</h2>
            <button
              onClick={() => setView('manage-courses')}
              className="w-full bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold text-gray-900">Manage Courses</div>
                  <div className="text-sm text-gray-600">Add and edit golf courses</div>
                </div>
                <div className="text-gray-400">›</div>
              </div>
            </button>
            <button
              onClick={() => setView('manage-formats')}
              className="w-full mt-3 bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold text-gray-900">Manage Formats</div>
                  <div className="text-sm text-gray-600">Add or Edit Formats for Events</div>
                </div>
                <div className="text-gray-400">›</div>
              </div>
            </button>
          </div>
        )}

        {/* MY LEAGUES */}
        {userLeagues.length > 0 && (
          <div className="mb-6">
            <h2 className="text-white text-lg font-semibold mb-3">MY LEAGUES</h2>
            <div className="space-y-3">
              {userLeagues.map(league => (
                <button
                  key={league.id}
                  onClick={() => {
                    setCurrentLeague(league);
                    setView('league-dashboard');
                  }}
                  className="w-full bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        {league.meta.name}
                        {league.userRole === 'commissioner' && (
                          <span className="text-yellow-500">⭐</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {league.userRole === 'commissioner' ? 'Commissioner' : 'Player'} · {Object.keys(league.seasons || {}).length} season{Object.keys(league.seasons || {}).length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-gray-400">›</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CREATE / JOIN LEAGUE */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setView('create-league')}
              className="bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">🏆</div>
                <div className="font-bold text-gray-900">Create League</div>
              </div>
            </button>
            <button
              onClick={() => setView('join-league')}
              className="bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">🤝</div>
                <div className="font-bold text-gray-900">Join League</div>
              </div>
            </button>
          </div>
        </div>

        {/* ============================================ */}
        {/* MY EVENTS — mirrors the My Leagues pattern   */}
        {/* ============================================ */}
        {activeEvents.length > 0 && (
          <div className="mb-6">
            <h2 className="text-white text-lg font-semibold mb-3">MY EVENTS</h2>
            <div className="space-y-3">
              {activeEvents.map(event => {
                const isActive = event.status === 'active';
                return (
                  <button
                    key={event.id}
                    onClick={() => {
                      setCurrentEvent(event);
                      setView('event-lobby');
                    }}
                    className={`w-full p-5 rounded-2xl shadow-xl transition-all text-left ${
                      isActive
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 hover:border-green-400'
                        : 'bg-white/95 backdrop-blur-sm hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          {/* Icon distinguishes created vs joined */}
                          {event.role === 'host' ? (
                            <span title="You created this event">📋</span>
                          ) : (
                            <span title="You joined this event">🏌️</span>
                          )}
                          {event.eventName || event.name || 'Unnamed Event'}
                          {isActive && (
                            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">LIVE</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {event.role === 'host' ? 'Host' : 'Player'}
                          {event.courseName ? ` · ${event.courseName}` : ''}
                          {!isActive && event.status ? ` · ${event.status.charAt(0).toUpperCase() + event.status.slice(1)}` : ''}
                        </div>
                      </div>
                      <div className={isActive ? 'text-green-500' : 'text-gray-400'}>›</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CREATE / JOIN EVENT — same 2-column layout as leagues */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setView('create-event')}
              className="bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">📋</div>
                <div className="font-bold text-gray-900">Create Event</div>
              </div>
            </button>
            <button
              onClick={() => {
                /* Show a small join-event modal/inline, or navigate to a join view */
                setView('join-event');
              }}
              className="bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">🏌️</div>
                <div className="font-bold text-gray-900">Join Event</div>
              </div>
            </button>
          </div>
        </div>

        {/* EVENT HISTORY */}
        {hasEventHistory && (
          <div className="mb-6">
            <button
              onClick={() => setView('event-history')}
              className="w-full bg-white/10 backdrop-blur-sm p-5 rounded-2xl hover:bg-white/20 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-white">📂 Event History</div>
                  <div className="text-sm text-white/70">View completed events</div>
                </div>
                <div className="text-white/50">›</div>
              </div>
            </button>
          </div>
        )}

        {/* PLAY SOLO */}
        <div className="mb-6">
          <h2 className="text-white text-lg font-semibold mb-3">SOLO</h2>
          <button
            onClick={() => setView('solo-setup')}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white p-6 rounded-2xl text-left shadow-lg transition-all"
          >
            <div className="font-bold text-lg mb-1">Play Solo</div>
            <div className="text-sm text-green-100">Track your personal round</div>
          </button>
        </div>

        {/* ROUND HISTORY */}
        <div className="mb-6">
          <h2 className="text-white text-lg font-semibold mb-3">ROUND HISTORY</h2>
          <div className="space-y-3">
            <button
              onClick={() => setView('rounds-history')}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white p-6 rounded-2xl text-left shadow-lg transition-all"
            >
              <div className="font-bold text-lg mb-1">My Rounds</div>
              <div className="text-sm text-indigo-100">View all your golf rounds</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
