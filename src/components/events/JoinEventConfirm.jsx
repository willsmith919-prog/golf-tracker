import { useEffect, useState } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';

export default function JoinEventConfirm({
  currentUser,
  userProfile,
  joinCode,
  setView,
  setCurrentEvent,
}) {
  const [event, setEvent] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        // Look up the code to get the eventId
        const codeSnapshot = await get(ref(database, `codes/${joinCode}`));
        if (!codeSnapshot.exists()) {
          setError('Code not found.');
          setLoading(false);
          return;
        }

        const codeData = codeSnapshot.val();
        const id = codeData.targetId;
        setEventId(id);

        // Fetch the actual event data
        const eventSnapshot = await get(ref(database, `events/${id}`));
        if (!eventSnapshot.exists()) {
          setError('Event not found.');
          setLoading(false);
          return;
        }

        const eventData = eventSnapshot.val();
        setEvent(eventData);

        // Check if user is already in this event
        const isJoined = eventData.players && eventData.players[currentUser.uid];
        setAlreadyJoined(!!isJoined);

      } catch (err) {
        console.error('Error fetching event:', err);
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, []);

  const handleJoin = async () => {
    setJoining(true);
    try {
      // Add user to event players
      await set(ref(database, `events/${eventId}/players/${currentUser.uid}`), {
        displayName: userProfile?.profile?.displayName || currentUser.email || 'Unknown',
        joinedAt: Date.now(),
        role: 'player',
        handicap: userProfile?.profile?.handicap || null,
      });

      // Add event reference to user's profile
      await set(ref(database, `users/${currentUser.uid}/events/${eventId}`), {
        role: 'player',
        joinedAt: Date.now(),
      });

      // Load the full event and take user to the lobby
      const eventSnapshot = await get(ref(database, `events/${eventId}`));
      setCurrentEvent({ id: eventId, ...eventSnapshot.val() });
      setView('event-lobby');

    } catch (err) {
      console.error('Error joining event:', err);
      setError('Something went wrong. Please try again.');
      setJoining(false);
    }
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 flex items-center justify-center">
        <p className="text-white text-lg">Loading...</p>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 flex flex-col items-center justify-center">
        <p className="text-white text-lg mb-4">{error}</p>
        <button
          onClick={() => setView('home')}
          className="text-white/70 hover:text-white text-sm"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  const meta = event?.meta || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 font-sans">
      <div className="max-w-2xl mx-auto">

        {/* Back button */}
        <button
          onClick={() => setView('home')}
          className="text-white/70 hover:text-white text-sm mb-6 block"
        >
          ← Back
        </button>

        {/* Event card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-4">
          <div className="text-3xl mb-3">📋</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {meta.name || 'Unnamed Event'}
          </h1>
          <div className="space-y-1 mt-3">
            {meta.courseName && (
              <p className="text-gray-600 text-sm">⛳ {meta.courseName}</p>
            )}
            {meta.date && (
              <p className="text-gray-600 text-sm">📅 {meta.date}</p>
            )}
            {meta.formatName && (
              <p className="text-gray-600 text-sm">🏌️ {meta.formatName}</p>
            )}
            {meta.teeName && (
              <p className="text-gray-600 text-sm">🎯 {meta.teeName} tees</p>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-3">
            {Object.keys(event?.players || {}).length} player{Object.keys(event?.players || {}).length !== 1 ? 's' : ''} joined
          </div>
        </div>

        {/* Already joined message */}
        {alreadyJoined ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 text-center">
            <p className="text-yellow-800 font-semibold mb-1">You're already in this event.</p>
            <p className="text-yellow-700 text-sm mb-4">No need to join again.</p>
            <button
              onClick={() => {
                setCurrentEvent({ id: eventId, ...event });
                setView('event-lobby');
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-semibold"
            >
              Go to Event →
            </button>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 rounded-2xl shadow-lg transition-all text-lg"
          >
            {joining ? 'Joining...' : 'Join Event'}
          </button>
        )}

      </div>
    </div>
  );
}