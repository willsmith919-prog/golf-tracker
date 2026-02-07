import { ref, get, set, remove } from 'firebase/database';
import { database } from '../../firebase';
import {
  PlusIcon,
  CalendarIcon,
  TrophyIcon
} from '../icons';

export default function LeagueDashboardView({
  currentUser,
  currentLeague,
  setCurrentLeague,
  leagueEvents,
  feedback,
  setFeedback,
  setView,
  setCreatingEventForLeague,
  setEditingEvent
}) {
  const isCommissioner = currentLeague.userRole === 'commissioner';
  const members = Object.entries(currentLeague.members || {}).map(([uid, data]) => ({
    uid,
    ...data
  }));
  const activeSeason = Object.values(currentLeague.seasons || {}).find(s => s.status === 'active');

  const handleRemoveMember = async (memberUid, memberName) => {
    if (!confirm(`Remove ${memberName} from the league?`)) {
      return;
    }

    try {
      await remove(ref(database, `leagues/${currentLeague.id}/members/${memberUid}`));
      await remove(ref(database, `users/${memberUid}/leagues/${currentLeague.id}`));

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

      const eventSnapshot = await get(ref(database, `events/${eventId}/meta/eventCode`));
      if (eventSnapshot.exists()) {
        await remove(ref(database, `eventCodes/${eventSnapshot.val()}`));
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">← Back to Home</button>

        {/* Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentLeague.meta.name}</h1>
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

        {/* Events */}
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

          {leagueEvents.length > 0 ? (
            <div className="space-y-3">
              {leagueEvents.map((event) => {
                const formatNames = {
                  scramble: "2-Man Scramble",
                  shamble: "2-Man Shamble",
                  bestball: "2-Man Best Ball",
                  stableford: "Individual Stableford"
                };
                
                return (
                  <div key={event.id} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{event.meta.name}</div>
                        <div className="text-sm text-gray-600">
                          {event.meta.courseName} · {formatNames[event.meta.format] || event.meta.format}
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(event.meta.date).toLocaleDateString()}
                          {event.meta.time && ` · ${event.meta.time}`}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Status: {event.meta.status === 'draft' ? '📝 Draft' : event.meta.status === 'locked' ? '🔒 Locked' : '✅ Active'}
                          {event.meta.status === 'draft' && ' · Registration Open'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.meta.status === 'draft' && (
                          <button
                            onClick={() => {
                              setEditingEvent(event);
                              setView('event-details');
                            }}
                            className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                          >
                            View
                          </button>
                        )}
                        {isCommissioner && (
                          <button
                            onClick={() => handleDeleteEvent(event.id, event.meta.name)}
                            className="text-red-600 hover:text-red-700 text-sm font-semibold"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
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
