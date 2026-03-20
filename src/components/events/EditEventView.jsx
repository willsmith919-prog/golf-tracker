import { ref, update } from 'firebase/database';
import { database } from '../../firebase';
import EventForm from '../shared/EventForm.jsx';

export default function EditEventView({
  currentEvent,
  setCurrentEvent,
  globalCourses,
  formats,
  feedback,
  setFeedback,
  setView
}) {
  const meta = currentEvent.meta || {};

  const handleSave = async (formData, validationError) => {
    // If the form failed validation, it passes back null + an error message
    if (!formData) {
      setFeedback(validationError);
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    try {
      // Calculate ending hole
      const eventStartingHole = formData.startingHole || 1;
      const eventNumHoles = formData.numHoles || 18;
      let eventEndingHole;
      if (eventNumHoles === 9) {
        eventEndingHole = eventStartingHole === 1 ? 9 : 18;
      } else {
        eventEndingHole = eventStartingHole === 1 ? 18 : 9;
      }

      const updatedMeta = {
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
        leaguePoints: formData.leaguePoints || null
      };

      await update(ref(database, `events/${currentEvent.id}/meta`), updatedMeta);

      // Update local state so lobby reflects changes immediately
      setCurrentEvent({
        ...currentEvent,
        meta: { ...currentEvent.meta, ...updatedMeta }
      });

      setFeedback('Event updated!');
      setTimeout(() => {
        setFeedback('');
        setView('event-lobby');
      }, 1500);
    } catch (error) {
      console.error('Error updating event:', error);
      setFeedback('Error updating event. Please try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setView('event-lobby')}
          className="text-white mb-6 hover:text-blue-200"
        >
          ← Back to Lobby
        </button>
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Georgia, serif' }}>Edit Event</h2>

          <EventForm
            initialData={meta}
            globalCourses={globalCourses}
            formats={formats}
            showRoundOptions={true}
            submitLabel="Save Changes"
            onSubmit={handleSave}
            feedback={feedback}
            leaguePointsConfig={
              // If leaguePoints already exists on this event, pass it through
              // so EventForm pre-fills the section for editing.
              // If it's a league event but has no points yet, provide a
              // starter config so the commissioner can set it up.
              meta.leaguePoints
                ? meta.leaguePoints
                : meta.leagueId
                  ? { positions: { 1: 25, 2: 20, 3: 16, 4: 13, 5: 10, 6: 8, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }, participationPoints: 5 }
                  : null
            }
          />
        </div>
      </div>
    </div>
  );
}
