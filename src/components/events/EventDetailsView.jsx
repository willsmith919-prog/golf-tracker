import { ref, set, remove } from 'firebase/database';
import { database } from '../../firebase';
import { UsersIcon, EditIcon } from '../icons';

export default function EventDetailsView({
  currentUser,
  userProfile,
  currentLeague,
  editingEvent,
  setEditingEvent,
  eventRegistrations,
  feedback,
  setFeedback,
  setView
}) {
  const registrations = Object.entries(eventRegistrations || {}).map(([uid, data]) => ({
    uid,
    ...data
  }));

  const handleRegister = async () => {
    if (!userProfile) {
      setFeedback('User profile not loaded');
      return;
    }

    try {
      await set(ref(database, `events/${editingEvent.id}/registrations/${currentUser.uid}`), {
        displayName: userProfile.displayName,
        handicap: userProfile.handicap || null,
        registeredAt: Date.now()
      });

      setFeedback('Successfully registered!');
      setTimeout(() => setFeedback(''), 2000);
    } catch (error) {
      console.error('Error registering:', error);
      setFeedback('Error registering. Please try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  const handleWithdraw = async () => {
    if (!confirm('Withdraw from this event?')) {
      return;
    }

    try {
      await remove(ref(database, `events/${editingEvent.id}/registrations/${currentUser.uid}`));
      setFeedback('Withdrawn from event');
      setTimeout(() => setFeedback(''), 2000);
    } catch (error) {
      console.error('Error withdrawing:', error);
      setFeedback('Error withdrawing. Please try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  const isRegistered = eventRegistrations && eventRegistrations[currentUser.uid];
  const isCommissioner = currentLeague && currentLeague.userRole === 'commissioner';

  const formatNames = {
    scramble: "2-Man Scramble",
    shamble: "2-Man Shamble",
    bestball: "2-Man Best Ball",
    stableford: "Individual Stableford"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => {
            setEditingEvent(null);
            setView('league-dashboard');
          }} 
          className="text-white mb-6 hover:text-blue-200"
        >
          ← Back to League
        </button>

        {/* Event Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{editingEvent.meta.name}</h1>
              <div className="space-y-1 text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Course:</span>
                  {editingEvent.meta.courseName}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Format:</span>
                  {formatNames[editingEvent.meta.format]}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Date:</span>
                  {new Date(editingEvent.meta.date).toLocaleDateString()}
                  {editingEvent.meta.time && ` at ${editingEvent.meta.time}`}
                </div>
              </div>
            </div>
            
            {isCommissioner && (
              <button
                onClick={() => {
                  setView('edit-event');
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-semibold flex items-center gap-2"
              >
                <EditIcon />
                Edit
              </button>
            )}
          </div>

          {feedback && (
            <div className={`border-2 p-3 rounded-lg mb-4 text-sm ${
              feedback.includes('Error')
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              {feedback}
            </div>
          )}

          {editingEvent.meta.status === 'draft' && (
            <div className="mt-4">
              {isRegistered ? (
                <button
                  onClick={handleWithdraw}
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700"
                >
                  Withdraw from Event
                </button>
              ) : (
                <button
                  onClick={handleRegister}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
                >
                  Register for Event
                </button>
              )}
            </div>
          )}

          {editingEvent.meta.status === 'locked' && (
            <div className="mt-4 bg-yellow-50 border-2 border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm">
              🔒 This event is locked. Registration is closed.
            </div>
          )}
        </div>

        {/* Registrations */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Registered Players ({registrations.length})
          </h2>
          
          {registrations.length > 0 ? (
            <div className="space-y-2">
              {registrations.map(reg => (
                <div key={reg.uid} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-semibold text-gray-900">{reg.displayName}</div>
                    {reg.handicap !== null && reg.handicap !== undefined && (
                      <div className="text-sm text-gray-600">Handicap: {reg.handicap}</div>
                    )}
                  </div>
                  {reg.uid === currentUser.uid && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">
                      You
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <UsersIcon className="mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600">No registrations yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
