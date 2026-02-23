import { ref, get, set } from 'firebase/database';
import { useState } from 'react';
import { database } from '../../firebase';

export default function JoinEventView({
  currentUser,
  userProfile,
  setView,
  setCurrentEvent
}) {
  const [joinCode, setJoinCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const joinEvent = async () => {
    if (!joinCode) {
      setFeedback('Please enter an event code');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }

    setLoading(true);

    try {
      const codeSnapshot = await get(ref(database, `eventCodes/${joinCode}`));
      if (!codeSnapshot.exists()) {
        setFeedback('Event not found. Check your code.');
        setTimeout(() => setFeedback(''), 3000);
        setLoading(false);
        return;
      }

      const eventId = codeSnapshot.val();
      const eventSnapshot = await get(ref(database, `events/${eventId}`));
      
      if (!eventSnapshot.exists()) {
        setFeedback('Event not found.');
        setTimeout(() => setFeedback(''), 3000);
        setLoading(false);
        return;
      }

      const event = eventSnapshot.val();

      // Check if event is still open for joining
      if (event.meta?.status === 'completed') {
        setFeedback('This event has already ended.');
        setTimeout(() => setFeedback(''), 3000);
        setLoading(false);
        return;
      }

      // Check if the user is already in this event
      const alreadyJoined = event.players && event.players[currentUser.uid];

      if (!alreadyJoined) {
        // Add user to the event's players node
        await set(ref(database, `events/${eventId}/players/${currentUser.uid}`), {
          displayName: userProfile?.displayName || 'Unknown',
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
      setView('event-lobby');
    } catch (error) {
      console.error('Error joining event:', error);
      setFeedback('Error joining event. Please try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">
          ← Back to Home
        </button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Event</h1>
          <p className="text-gray-600 mb-6">
            Enter the event code shared by the host to join their event.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Event Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && joinEvent()}
                placeholder="WOLF-A3X9"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-center text-xl font-mono uppercase tracking-wider"
                autoFocus
              />
            </div>

            {feedback && (
              <div className="bg-blue-50 border-2 border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm">
                {feedback}
              </div>
            )}

            <button
              onClick={joinEvent}
              disabled={loading}
              className={`w-full py-4 rounded-xl font-semibold text-lg shadow-lg transition-all ${
                loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Joining...' : 'Join Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
