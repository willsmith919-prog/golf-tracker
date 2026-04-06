import { signOut } from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';
import { lookupCode } from '../../utils/codes';
import { useEffect, useState } from 'react';
import { auth, database } from '../../firebase';

export default function HomeView({
  currentUser,
  userProfile,
  setUserProfile,
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
  // ==================== EDIT PROFILE STATE ====================
  // Controls whether the inline profile editor is open, and holds
  // the form values while the user is editing.
  const [editingProfile, setEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editHandicap, setEditHandicap] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState('');

  // When the user opens the editor, pre-fill with current values
  const openProfileEditor = () => {
    setEditDisplayName(userProfile?.profile?.displayName || '');
    setEditHandicap(userProfile?.profile?.handicap != null ? String(userProfile.profile.handicap) : '');
    setProfileFeedback('');
    setEditingProfile(true);
  };

  // Save profile changes to Firebase, then update local state
  const saveProfile = async () => {
    const trimmedName = editDisplayName.trim();
    if (!trimmedName) {
      setProfileFeedback('Display name cannot be empty.');
      return;
    }

    setSavingProfile(true);
    try {
      const newHandicap = editHandicap.trim() ? parseFloat(editHandicap) : null;

      // 1. Update the user's profile node in Firebase
      await update(ref(database, `users/${currentUser.uid}/profile`), {
        displayName: trimmedName,
        handicap: newHandicap,
      });

      // 2. Re-read the full user node so userProfile is fresh everywhere
      const profileSnapshot = await get(ref(database, `users/${currentUser.uid}`));
      setUserProfile(profileSnapshot.val());

      // 3. Update displayName in any league memberships this user belongs to.
      //    League member lists read displayName from leagues/{id}/members/{uid},
      //    so we need to keep those in sync when the user changes their name.
      if (userLeagues && userLeagues.length > 0) {
        const leagueUpdates = userLeagues.map(league =>
          update(ref(database, `leagues/${league.id}/members/${currentUser.uid}`), {
            displayName: trimmedName,
            handicap: newHandicap,
          })
        );
        await Promise.all(leagueUpdates);
      }

      setProfileFeedback('Profile updated!');
      setTimeout(() => {
        setEditingProfile(false);
        setProfileFeedback('');
      }, 1200);

    } catch (err) {
      console.error('Error updating profile:', err);
      setProfileFeedback('Failed to save. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

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

  const handleCodeEntry = async () => {
    if (!joinCode.trim()) {
      setFeedback('Please enter a code');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }

    try {
      const result = await lookupCode(joinCode.trim());

      if (!result) {
        setFeedback('Code not found. Check and try again.');
        setTimeout(() => setFeedback(''), 3000);
        return;
      }

      if (result.status === 'expired') {
        setView('expired-code');
        return;
      }

      setFeedback('');

      // Route to the right place based on code type
      if (result.type === 'league') {
        setView('join-league-confirm');
      } else if (result.type === 'series') {
        setView('join-series-confirm');
      } else if (result.type === 'event') {
        setView('join-event-confirm');
      } else if (result.type === 'game') {
        setView('join-game-confirm');
      } else {
        setFeedback('Unknown code type.');
        setTimeout(() => setFeedback(''), 3000);
      }

    } catch (error) {
      console.error('Error looking up code:', error);
      setFeedback('Something went wrong. Please try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>LiveLinks</h1>
            {userProfile && (
              <div className="flex items-center gap-2">
                <p className="text-white/80">Welcome, {userProfile?.profile?.displayName || 'Golfer'}</p>
                <button
                  onClick={openProfileEditor}
                  className="text-white/50 hover:text-white text-xs"
                  title="Edit profile"
                >
                  ✏️
                </button>
              </div>
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

        {/* ============================================ */}
        {/* EDIT PROFILE — inline editor                 */}
        {/* Opens when the user taps the ✏️ pencil next  */}
        {/* to their name. Saves displayName & handicap  */}
        {/* to Firebase and syncs league member records.  */}
        {/* ============================================ */}
        {editingProfile && (
          <div className="mb-6 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Edit Profile</h2>
              <button
                onClick={() => setEditingProfile(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                  placeholder="How you appear to others"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Handicap Index</label>
                <input
                  type="number"
                  step="0.1"
                  value={editHandicap}
                  onChange={(e) => setEditHandicap(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                  placeholder="e.g. 12.4"
                />
              </div>

              {profileFeedback && (
                <p className={`text-sm ${profileFeedback.includes('updated') ? 'text-green-600' : 'text-red-500'}`}>
                  {profileFeedback}
                </p>
              )}

              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full bg-[#00285e] hover:bg-[#003a7d] disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition-all"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

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
                        ? 'bg-white border-2 border-[#e63946] hover:border-[#c5303c]'
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
                            <span className="text-xs bg-[#e63946] text-white px-2 py-0.5 rounded-full">LIVE</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {event.role === 'host' ? 'Host' : 'Player'}
                          {event.courseName ? ` · ${event.courseName}` : ''}
                          {!isActive && event.status ? ` · ${event.status.charAt(0).toUpperCase() + event.status.slice(1)}` : ''}
                        </div>
                      </div>
                      <div className={isActive ? 'text-[#e63946]' : 'text-gray-400'}>›</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ENTER A CODE */}
        <div className="mb-6">
          <h2 className="text-white text-lg font-semibold mb-3">JOIN</h2>
          <div className="bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl">
            <p className="text-sm text-gray-600 mb-3">Have a code? Enter it to join a league, series, event, or game.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleCodeEntry()}
                placeholder="e.g. LG-4X9K"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#003a7d]"
                maxLength={7}
              />
              <button
                onClick={handleCodeEntry}
                className="bg-[#00285e] hover:bg-[#003a7d] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              >
                Go
              </button>
            </div>
            {feedback && (
              <p className="text-red-500 text-sm mt-2">{feedback}</p>
            )}
          </div>
        </div>

        {/* CREATE */}
        <div className="mb-6">
          <h2 className="text-white text-lg font-semibold mb-3">CREATE</h2>
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
              onClick={() => setView('create-event')}
              className="bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">📋</div>
                <div className="font-bold text-gray-900">Create Event</div>
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
            className="w-full bg-[#e17055] text-white p-6 rounded-2xl text-left shadow-lg transition-all"
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
              className="w-full bg-[#00285e] text-white p-6 rounded-2xl text-left shadow-lg transition-all"
            >
              <div className="font-bold text-lg mb-1">My Rounds</div>
              <div className="text-sm text-[#dce8f5]">View all your golf rounds</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
