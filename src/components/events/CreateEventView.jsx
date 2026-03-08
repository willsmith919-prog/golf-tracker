import { ref, get, set } from 'firebase/database';
import { createCode } from '../../utils/codes';
import { database } from '../../firebase';
import EventForm from '../shared/EventForm.jsx';

export default function CreateEventView({
  currentUser,
  userProfile,
  currentLeague,
  globalCourses,
  formats,
  creatingEventForLeague,
  setCreatingEventForLeague,
  feedback,
  setFeedback,
  setView,
  setCurrentEvent,
  setCurrentLeague,
  generateEventCode,
  preFillEvent,
  setPreFillEvent,
}) {

  const handleCreate = async (formData, validationError) => {
    // If the form failed validation, it passes back null + an error message
    if (!formData) {
      setFeedback(validationError);
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    try {
      const eventId = 'event-' + Date.now();
const eventCode = await createCode('event', eventId);

      const eventStartingHole = formData.startingHole || 1;
      const eventNumHoles = formData.numHoles || 18;

      // Calculate ending hole
      let eventEndingHole;
      if (eventNumHoles === 9) {
        eventEndingHole = eventStartingHole === 1 ? 9 : 18;
      } else {
        eventEndingHole = eventStartingHole === 1 ? 18 : 9;
      }
      
      const eventData = {
        meta: {
          name: formData.name,
          courseId: formData.courseId,
          courseName: formData.courseName,
          coursePars: formData.coursePars,
          courseYardages: formData.courseYardages || [],
          courseStrokeIndexes: formData.courseStrokeIndexes || [],
          teeId: formData.teeId,
          teeName: formData.teeName,
          format: formData.format,
          formatId: formData.formatId || null,
          formatName: formData.formatName || '',
          scoringMethod: formData.scoringMethod || 'stroke',
          teamSize: formData.teamSize || 2,
          handicap: formData.handicap || { enabled: false, allowance: 100 },
          stablefordPoints: formData.stablefordPoints || null,
          competition: formData.competition || { structure: 'full_field' },
          display: formData.display || {},
          date: formData.date,
          time: formData.time || null,
          numHoles: eventNumHoles,
          startingHole: eventStartingHole,
          endingHole: eventEndingHole,
          createdBy: currentUser.uid,
          status: creatingEventForLeague ? "draft" : "open",
          leagueId: creatingEventForLeague?.leagueId || null,
          seasonId: creatingEventForLeague?.seasonId || null,
          createdAt: Date.now(),
          eventCode: eventCode
        },
        players: {
          [currentUser.uid]: {
            displayName: userProfile?.profile?.displayName || 'Unknown',
            joinedAt: Date.now(),
            role: 'host',
            handicap: userProfile?.profile?.handicap || null
          }
        }
      };

      // Write event to Firebase
      await set(ref(database, `events/${eventId}`), eventData);
      // Write event reference under the creator's user profile
      await set(ref(database, `users/${currentUser.uid}/events/${eventId}`), {
        role: 'host',
        joinedAt: Date.now()
      });

      if (creatingEventForLeague) {
        const seasonEventsRef = ref(database, `leagues/${creatingEventForLeague.leagueId}/seasons/${creatingEventForLeague.seasonId}/events`);
        const eventsSnapshot = await get(seasonEventsRef);
        const events = eventsSnapshot.val() || [];
        events.push(eventId);
        await set(seasonEventsRef, events);
      }

      setFeedback(`Event created! Code: ${eventCode}`);
      
      setTimeout(async () => {
        setFeedback('');
        
        if (creatingEventForLeague) {
          const leagueSnapshot = await get(ref(database, `leagues/${creatingEventForLeague.leagueId}`));
          const updatedLeague = leagueSnapshot.val();
          setCurrentLeague({ 
            id: creatingEventForLeague.leagueId, 
            ...updatedLeague, 
            userRole: currentLeague.userRole 
          });
          setCreatingEventForLeague(null);
          setView('league-dashboard');
        } else {
          setCurrentEvent({ id: eventId, ...eventData });
          setView('event-lobby');
        }
      }, 1500);

    } catch (error) {
      console.error('Error creating event:', error);
      setFeedback('Error creating event. Please try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => {
            if (creatingEventForLeague) {
              setCreatingEventForLeague(null);
              setView('league-dashboard');
            } else {
              setView('home');
            }
          }} 
          className="text-white mb-6 hover:text-blue-200"
        >
          ← Back
        </button>
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Georgia, serif' }}>Create Event</h2>
          {creatingEventForLeague && (
            <div className="bg-blue-50 border-2 border-blue-200 p-3 rounded-lg mb-6">
              <div className="text-sm text-blue-800">Creating event for <strong>{currentLeague?.meta?.name}</strong></div>
            </div>
          )}
          
          <EventForm
            globalCourses={globalCourses}
            formats={formats}
            showRoundOptions={!creatingEventForLeague}
            submitLabel="Create Event"
            onSubmit={handleCreate}
            feedback={feedback}
            preFillEvent={preFillEvent}
          />
        </div>
      </div>
    </div>
  );
}
