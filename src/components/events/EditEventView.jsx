import { ref, update } from 'firebase/database';
import { database } from '../../firebase';

export default function EditEventView({
  editingEvent,
  setEditingEvent,
  editForm,
  setEditForm,
  courses,
  globalCourses,
  feedback,
  setFeedback,
  setView
}) {
  const saveEventEdits = async () => {
    try {
      const course = courses.find(c => c.id === editForm.courseId);
      
      if (!editForm.name || !editForm.courseId) {
        setFeedback('Please fill in all required fields');
        setTimeout(() => setFeedback(''), 2000);
        return;
      }
      
      const updates = {};
      updates[`events/${editingEvent.id}/meta/name`] = editForm.name;
      updates[`events/${editingEvent.id}/meta/courseId`] = course.id;
      updates[`events/${editingEvent.id}/meta/courseName`] = course.name;
      updates[`events/${editingEvent.id}/meta/coursePars`] = course.holes;
      updates[`events/${editingEvent.id}/meta/date`] = editForm.date;
      updates[`events/${editingEvent.id}/meta/time`] = editForm.time || null;
      updates[`events/${editingEvent.id}/meta/format`] = editForm.format;

      await update(ref(database), updates);
      
      setFeedback('Event updated!');
      setTimeout(() => {
        setEditingEvent(null);
        setView('league-dashboard');
        setFeedback('');
      }, 1500);
    } catch (error) {
      console.error('Error updating event:', error);
      setFeedback('Error updating event');
      setTimeout(() => setFeedback(''), 2000);
    }
  };

  const formatDescriptions = {
    scramble: "Both players hit, pick the best shot, both play from there. One team score per hole.",
    shamble: "Both players hit, pick the best drive, then each plays their own ball. Best individual score counts.",
    bestball: "Each player plays their own ball. Lower score of the two counts for the team.",
    stableford: "Individual scoring. Points awarded based on score vs par. Highest points wins."
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => { 
            setEditingEvent(null); 
            setView('event-details'); 
          }} 
          className="text-white mb-6 hover:text-blue-200"
        >
          ← Back
        </button>
        
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Edit Event</h2>

          {feedback && (
            <div className={`border-2 p-3 rounded-lg mb-4 text-sm ${
              feedback.includes('Error') || feedback.includes('required')
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              {feedback}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Event Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Course</label>
              <select
                value={(() => {
                  const selectedCourse = courses.find(c => c.id === editForm.courseId);
                  return selectedCourse?.courseId || '';
                })()}
                onChange={(e) => {
                  setEditForm({ ...editForm, courseId: '' });
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select a course</option>
                {globalCourses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name} {course.location && `- ${course.location}`}
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const selectedCourse = courses.find(c => c.id === editForm.courseId);
              const baseCourseId = selectedCourse?.courseId;
              return baseCourseId ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tee</label>
                  <select
                    value={editForm.courseId}
                    onChange={(e) => setEditForm({ ...editForm, courseId: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select a tee</option>
                    {courses
                      .filter(c => c.courseId === baseCourseId)
                      .map(course => {
                        const totalYards = course.yardages?.reduce((sum, y) => sum + (parseInt(y) || 0), 0) || 0;
                        return (
                          <option key={course.id} value={course.id}>
                            {course.teeName} - Rating: {course.rating} / Slope: {course.slope} / {totalYards} yards
                          </option>
                        );
                      })}
                  </select>
                </div>
              ) : null;
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
                <input
                  type="time"
                  value={editForm.time}
                  onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Format</label>
              <select
                value={editForm.format}
                onChange={(e) => setEditForm({ ...editForm, format: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="scramble">2-Man Scramble</option>
                <option value="shamble">2-Man Shamble</option>
                <option value="bestball">2-Man Best Ball</option>
                <option value="stableford">Individual Stableford</option>
              </select>
              <p className="text-sm text-gray-600 mt-2">{formatDescriptions[editForm.format]}</p>
            </div>

            <button
              onClick={saveEventEdits}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 text-lg"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
