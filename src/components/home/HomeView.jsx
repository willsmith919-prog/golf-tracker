import { signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, database } from '../../firebase';

export default function HomeView({
  currentUser,
  userProfile,
  userLeagues,
  isAdmin,
  joinCode,
  setJoinCode,
  feedback,
  setFeedback,
  setView,
  setCurrentLeague,
  setCurrentEvent
}) {
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

        {/* QUICK PLAY */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
          <h3 className="text-white text-sm font-semibold mb-3 uppercase tracking-wider">Quick Play</h3>
          <p className="text-white/70 text-sm mb-4">For one-off events without a league</p>
          
          <div className="space-y-3">
            <button
              onClick={() => setView('create-event')}
              className="w-full bg-white/20 hover:bg-white/30 p-4 rounded-xl transition-all text-white text-left"
            >
              <div className="font-semibold">Create Event</div>
              <div className="text-sm text-white/80">Host a standalone golf event</div>
            </button>

            <button
              onClick={() => setView('solo-setup')}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white p-6 rounded-xl text-left shadow-lg transition-all"
            >
              <div className="font-bold text-lg mb-1">Play Solo</div>
              <div className="text-sm text-green-100">Track your personal round</div>
            </button>

            <div className="bg-white/20 p-4 rounded-xl">
              <div className="font-semibold text-white mb-3">Join Event</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && joinEvent()}
                  placeholder="WOLF-A3X9"
                  className="flex-1 px-4 py-2 rounded-lg border-2 border-white/30 bg-white/10 text-white placeholder-white/50 focus:border-white/50 focus:outline-none uppercase"
                />
                <button
                  onClick={joinEvent}
                  className="bg-white text-blue-900 px-5 py-2 rounded-lg hover:bg-white/90 font-semibold"
                >
                  Join
                </button>
              </div>
              {feedback && <div className="mt-2 text-sm text-white/90">{feedback}</div>}
            </div>
          </div>
        </div>
        {/* ROUND HISTORY */}
        <div className="mb-6">
            <h2 className="text-white text-lg font-semibold mb-3">ROUND HISTORY</h2>
          
          <div className="space-y-3">
            <button
              onClick={() => setView('rounds-history')}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white p-6 rounded-xl text-left shadow-lg transition-all"
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
