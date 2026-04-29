import { ref, remove } from 'firebase/database';
import { database } from '../../firebase';
import { PlusIcon, EditIcon, TrashIcon } from '../icons';

export default function ManageCoursesView({
  globalCourses,
  feedback,
  setFeedback,
  setView,
  setCourseForm,
  setEditingCourse,
  loadCourses
}) {
  const handleDeleteCourse = async (courseId, courseName) => {
    if (!confirm(`Delete ${courseName}? This cannot be undone.`)) {
      return;
    }

    try {
      await remove(ref(database, `courses/${courseId}`));
      await loadCourses();
      setFeedback('Course deleted');
      setTimeout(() => setFeedback(''), 2000);
    } catch (error) {
      console.error('Error deleting course:', error);
      setFeedback('Error deleting course');
      setTimeout(() => setFeedback(''), 2000);
    }
  };

  const emptyCourseForm = {
    name: '',
    location: '',
    strokeIndex: Array(18).fill(''),
    tees: [{
      id: 'tee-1',
      name: '',
      rating: '',
      slope: '',
      pars: Array(18).fill(''),
      yardages: Array(18).fill('')
    }]
  };

  return (
    <div className="min-h-screen bg-[#00285e] p-6">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-[#c8d6e5]">
          ← Back to Home
        </button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Manage Courses</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('import-course')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Import CSV
              </button>
              <button
                onClick={() => {
                  setCourseForm(emptyCourseForm);
                  setEditingCourse(null);
                  setView('add-edit-course');
                }}
                className="bg-[#00285e] text-white px-4 py-2 rounded-lg hover:bg-[#003a7d] font-semibold flex items-center gap-2"
              >
                <PlusIcon />
                Add Course
              </button>
            </div>
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

          {globalCourses.length > 0 ? (
            <div className="space-y-3">
              {globalCourses.map(course => (
                <div key={course.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 text-lg">{course.name}</div>
                      {course.location && (
                        <div className="text-sm text-gray-600 mb-2">{course.location}</div>
                      )}
                      <div className="text-sm text-gray-600">
                        {Object.keys(course.tees || {}).length} tee{Object.keys(course.tees || {}).length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const teesArray = Object.entries(course.tees || {}).map(([id, tee]) => ({
                            id,
                            ...tee
                          }));
                          setCourseForm({
                            name: course.name,
                            location: course.location || '',
                            strokeIndex: course.strokeIndex || Array(18).fill(''),
                            tees: teesArray.length > 0 ? teesArray : [{
                              id: 'tee-1',
                              name: '',
                              rating: '',
                              slope: '',
                              pars: Array(18).fill(''),
                              yardages: Array(18).fill('')
                            }]
                          });
                          setEditingCourse(course);
                          setView('add-edit-course');
                        }}
                        className="text-[#00285e] hover:text-[#003a7d] font-semibold"
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id, course.name)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No courses yet</p>
              <button
                onClick={() => {
                  setCourseForm(emptyCourseForm);
                  setEditingCourse(null);
                  setView('add-edit-course');
                }}
                className="bg-[#00285e] text-white px-6 py-3 rounded-xl hover:bg-[#003a7d] font-semibold"
              >
                Add First Course
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
