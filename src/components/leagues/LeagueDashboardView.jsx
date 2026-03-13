import { ref, get, set, remove } from 'firebase/database';
import { database } from '../../firebase';
import {
  PlusIcon,
  CalendarIcon,
  TrophyIcon
} from '../icons';

export default function LeagueDashboardView({
  currentUser,
  userProfile,
  currentLeague,
  setCurrentLeague,
  leagueEvents,
  feedback,
  setFeedback,
  setView,
  setCreatingEventForLeague,
  setEditingEvent,
  setCurrentEvent
}) {
  const isCommissioner = currentLeague.userRole === 'commissioner';
  const members = Object.entries(currentLeague.members || {}).map(([uid, data]) => ({
    uid,
    ...data
  }));
  const activeSeason = Object.values(currentLeague.seasons || {}).find(s => s.status === 'active');

  // Split events into upcoming, live, and past
  const upcomingEvents = leagueEvents.filter(e => e.meta.status === 'open' || e.meta.status === 'draft');
  const liveEvents = leagueEvents.filter(e => e.meta.status === 'active');
  const pastEvents = leagueEvents
    .filter(e => e.meta.status === 'completed')
    .sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date)); // most recent first

  // Check if the current user is registered for a given event
  const isRegistered = (event) => {
    return event.players && event.players[currentUser.uid];
  };

  // Register the current user for an event, then navigate to lobby
  const handleRegisterAndView = async (event) => {
    try {
      const displayName = userProfile?.profile?.displayName || userProfile?.displayName || currentUser.email || 'Unknown';
      const handicap = userProfile?.profile?.handicap || userProfile?.handicap || null;

      await set(ref(database, `events/${event.id}/players/${currentUser.uid}`), {
        displayName: displayName,
        role: 'player',
        handicap: handicap,
        joinedAt: Date.now()
      });

      // Also write to user's events list
      await set(ref(database, `users/${currentUser.uid}/events/${event.id}`), {
        role: 'player',
        joinedAt: Date.now()
      });

      // Refresh the event data and navigate to lobby
      const snapshot = await get(ref(database, `events/${event.id}`));
      const updatedEvent = snapshot.val();
      setCurrentEvent({ id: event.id, ...updatedEvent });
      setView('event-lobby');
    } catch (error) {
      console.error('Error registering for event:', error);
      setFeedback('Error registering. Please try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // Navigate to lobby for an event the user is already part of
  const handleViewLobby = async (event) => {
    // Refresh event data to get latest
    try {
      const snapshot = await get(ref(database, `events/${event.id}`));
      const updatedEvent = snapshot.val();
      setCurrentEvent({ id: event.id, ...updatedEvent });
      setView('event-lobby');
    } catch (error) {
      console.error('Error loading event:', error);
      setFeedback('Error loading event. Please try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  const handleRemoveMember = async (memberUid, memberName) => {
    if (!confirm(`Remove ${memberName} from the league?`)) {
      return;
    }

    try {
      await remove(ref(database, `leagues/${currentLeague.id}/members/${memberUid}`));
      await remove(ref(database, `users/${memberUid}/leagueMemberships/${memberUid}`));

      const leagueSnapshot = await get(ref(database, `leagues/${currentLeague.id}`));
      const updatedLeague = leagueSnapshot.val();
      setCurrentLeague({ id: currentLeague.id, ...updatedLeague, userRole: currentLeague.userRole });

      setFeedback(`${memberName} removed from league`);
      setTimeout(() => setFeedback(''), 3000);
    } catch (error) {
      console.error('Error removing member:', error);
      setFeedback('Error removing member');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  const handleDeleteEvent = async (eventId, eventName) => {
    if (!confirm(`Delete "${eventName}"? This will remove all scores and registrations.`)) {
      return;
    }

    try {
      const seasonId = Object.keys(currentLeague.seasons || {}).find(
        sid => currentLeague.seasons[sid].status === 'active'
      );
      
      if (seasonId) {
        const eventsArray = currentLeague.seasons[seasonId].events || [];
        const updatedEvents = eventsArray.filter(eid => eid !== eventId);
        await set(ref(database, `leagues/${currentLeague.id}/seasons/${seasonId}/events`), updatedEvents);
      }

      // Clean up the event code from the unified codes system
      const eventSnapshot = await get(ref(database, `events/${eventId}/meta/eventCode`));
      if (eventSnapshot.exists()) {
        const eventCode = eventSnapshot.val();
        await remove(ref(database, `codes/${eventCode}`));
      }

      await remove(ref(database, `events/${eventId}`));

      const leagueSnapshot = await get(ref(database, `leagues/${currentLeague.id}`));
      const updatedLeague = leagueSnapshot.val();
      setCurrentLeague({ id: currentLeague.id, ...updatedLeague, userRole: currentLeague.userRole });

      setFeedback('Event deleted');
      setTimeout(() => setFeedback(''), 3000);
    } catch (error) {
      console.error('Error deleting event:', error);
      setFeedback('Error deleting event');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // Helper to get player count for an event
  const getPlayerCount = (event) => {
    return Object.keys(event.players || {}).length;
  };

  // Helper to format date nicely
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Render a single event card
  const renderEventCard = (event, section) => {
    const playerCount = getPlayerCount(event);
    const registered = isRegistered(event);

    return (
      <div key={event.id} className="p-4 bg-gray-50 rounded-xl">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Event name + live indicator */}
            <div className="flex items-center gap-2">
              <div className="font-semibold text-gray-900">{event.meta.name}</div>
              {section === 'live' && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  LIVE
                </span>
              )}
              {section === 'past' && (
                <span className="bg-gray-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  FINAL
                </span>
              )}
            </div>

            {/* Course + format */}
            <div className="text-sm text-gray-600 mt-1">
              {event.meta.courseName}
              {event.meta.formatName && ` · ${event.meta.formatName}`}
              {!event.meta.formatName && event.meta.format && ` · ${event.meta.format}`}
            </div>

            {/* Date + time */}
            <div className="text-sm text-gray-600">
              {formatDate(event.meta.date)}
              {event.meta.time && ` · ${event.meta.time}`}
            </div>

            {/* Player count */}
            <div className="text-xs text-gray-500 mt-1">
              {playerCount} player{playerCount !== 1 ? 's' : ''} registered
              {section === 'upcoming' && registered && (
                <span className="text-green-600 font-semibold ml-2">✓ You're in</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-end gap-2 ml-3">
            {section === 'upcoming' && (
              <>
                {registered ? (
                  <button
                    onClick={() => handleViewLobby(event)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold whitespace-nowrap"
                  >
                    View Lobby
                  </button>
                ) : (
                  <button
                    onClick={() => handleRegisterAndView(event)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-semibold whitespace-nowrap"
                  >
                    Register
                  </button>
                )}
              </>
            )}

            {section === 'live' && (
              <button
                onClick={() => handleViewLobby(event)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-semibold whitespace-nowrap"
              >
                View Live
              </button>
            )}

            {section === 'past' && (
              <button
                onClick={() => handleViewLobby(event)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-semibold whitespace-nowrap"
              >
                View Results
              </button>
            )}

            {isCommissioner && section === 'upcoming' && (
              <button
                onClick={() => handleDeleteEvent(event.id, event.meta.name)}
                className="text-red-500 hover:text-red-600 text-xs font-semibold"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">← Back to Home</button>

        {/* Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{currentLeague.meta.name}</h1>
            {isCommissioner && (
              <button
                onClick={() => setView('edit-league')}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="League Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
            )}
          </div>
          {currentLeague.meta.description && (
            <p className="text-gray-600 mb-4">{currentLeague.meta.description}</p>
          )}
          
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 px-4 py-2 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">League Code</div>
              <div className="font-mono font-bold text-blue-600 text-lg">{currentLeague.meta.code}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentLeague.meta.code);
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

        {/* Members */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Members ({members.length})</h2>
          <div className="space-y-3">
            {members.map(member => (
              <div key={member.uid} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    {member.displayName}
                    {member.role === 'commissioner' && <span className="text-yellow-500">⭐</span>}
                  </div>
                  {member.handicap !== null && member.handicap !== undefined && (
                    <div className="text-sm text-gray-600">Handicap: {member.handicap}</div>
                  )}
                </div>
                {isCommissioner && member.uid !== currentUser.uid && (
                  <button
                    onClick={() => handleRemoveMember(member.uid, member.displayName)}
                    className="text-red-600 hover:text-red-700 text-sm font-semibold"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ===== EVENTS SECTION ===== */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Events</h2>
            {isCommissioner && (
              <button
                onClick={() => {
                  setCreatingEventForLeague({
                    leagueId: currentLeague.id,
                    seasonId: Object.keys(currentLeague.seasons || {}).find(
                      sid => currentLeague.seasons[sid].status === 'active'
                    )
                  });
                  setView('create-event');
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold flex items-center gap-2"
              >
                <PlusIcon />
                Create Event
              </button>
            )}
          </div>

          {leagueEvents.length === 0 ? (
            // No events at all
            <div className="text-center py-8">
              <CalendarIcon className="mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600 mb-4">No events yet</p>
              {isCommissioner && (
                <button
                  onClick={() => {
                    setCreatingEventForLeague({
                      leagueId: currentLeague.id,
                      seasonId: Object.keys(currentLeague.seasons || {}).find(
                        sid => currentLeague.seasons[sid].status === 'active'
                      )
                    });
                    setView('create-event');
                  }}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold"
                >
                  Create First Event
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">

              {/* Live Events */}
              {liveEvents.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    In Progress
                  </div>
                  <div className="space-y-3">
                    {liveEvents.map(event => renderEventCard(event, 'live'))}
                  </div>
                </div>
              )}

              {/* Upcoming Events */}
              {upcomingEvents.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">
                    Upcoming
                  </div>
                  <div className="space-y-3">
                    {upcomingEvents.map(event => renderEventCard(event, 'upcoming'))}
                  </div>
                </div>
              )}

              {/* Past Events */}
              {pastEvents.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Completed
                  </div>
                  <div className="space-y-3">
                    {pastEvents.map(event => renderEventCard(event, 'past'))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Standings */}
        {activeSeason && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {activeSeason.name || 'Season'} Standings
            </h2>
            
            {activeSeason.standings && Object.keys(activeSeason.standings).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(activeSeason.standings)
                  .sort(([, a], [, b]) => (b.points || 0) - (a.points || 0))
                  .map(([uid, data], index) => {
                    const member = members.find(m => m.uid === uid);
                    return (
                      <div key={uid} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="text-lg font-bold text-gray-400 w-8">#{index + 1}</div>
                          <div className="font-semibold text-gray-900">{member?.displayName || 'Unknown'}</div>
                        </div>
                        <div className="text-lg font-bold text-blue-600">{data.points || 0} pts</div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-8">
                <TrophyIcon className="mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600">No standings yet</p>
                <p className="text-sm text-gray-500 mt-2">Standings will appear after events are completed</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
