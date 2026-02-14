// ============================================================
// COURSE SELECTOR — Reusable course + tee selection component
//
// Used by both SoloSetupView and CreateEventView so the
// course/tee selection UI only needs to be maintained in one place.
//
// Props:
//   globalCourses    — array of course objects from Firebase (with nested tees)
//   selectedCourseId — currently selected course ID (or '')
//   selectedTeeId    — currently selected tee ID (or '')
//   onCourseChange   — callback when course changes: (courseId) => void
//   onTeeChange      — callback when tee changes: (teeId, teeData, courseData) => void
//                       teeData = { name, rating, slope, pars, yardages }
//                       courseData = { id, name, location, strokeIndex }
//   disabled         — optional, disables both dropdowns
// ============================================================

export default function CourseSelector({
  globalCourses = [],
  selectedCourseId = '',
  selectedTeeId = '',
  onCourseChange,
  onTeeChange,
  disabled = false
}) {
  const selectedCourse = globalCourses.find(c => c.id === selectedCourseId) || null;

  // Convert the tees object on a course into an array for the dropdown
  const getTeesArray = () => {
    if (!selectedCourse?.tees) return [];
    return Object.entries(selectedCourse.tees).map(([id, data]) => ({
      id,
      ...data
    }));
  };

  const tees = getTeesArray();

  return (
    <>
      {/* Course Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Course
        </label>
        <select
          value={selectedCourseId}
          onChange={(e) => onCourseChange(e.target.value)}
          disabled={disabled}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Select a course</option>
          {globalCourses.map(course => (
            <option key={course.id} value={course.id}>
              {course.name} {course.location && `- ${course.location}`}
            </option>
          ))}
        </select>
      </div>

      {/* Tee Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Tee
        </label>
        <select
          value={selectedTeeId}
          onChange={(e) => {
            const teeId = e.target.value;
            const teeData = selectedCourse?.tees?.[teeId] || null;
            onTeeChange(teeId, teeData, selectedCourse);
          }}
          disabled={!selectedCourseId || disabled}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Select a tee</option>
          {tees.map(tee => {
            const totalYards = tee.yardages?.reduce((sum, y) => sum + (parseInt(y) || 0), 0) || 0;
            return (
              <option key={tee.id} value={tee.id}>
                {tee.name} - Rating: {tee.rating} / Slope: {tee.slope} / {totalYards} yards
              </option>
            );
          })}
        </select>
      </div>
    </>
  );
}
