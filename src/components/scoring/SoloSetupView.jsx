import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';

export default function SoloSetupView({ setView, setCurrentSoloRound, user }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTee, setSelectedTee] = useState(null);
  const [format, setFormat] = useState('stroke');
  const [numHoles, setNumHoles] = useState(18);
  const [startingHole, setStartingHole] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const coursesSnapshot = await get(ref(database, 'courses'));
      if (coursesSnapshot.exists()) {
        const coursesData = coursesSnapshot.val();
        const coursesArray = Object.entries(coursesData).map(([id, data]) => ({
          id,
          ...data
        }));
        setCourses(coursesArray);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading courses:', error);
      setLoading(false);
    }
  };

  // Convert tees object to array for mapping
  const getTeesArray = (course) => {
    if (!course?.tees) return [];
    return Object.entries(course.tees).map(([id, data]) => ({
      id,
      ...data
    }));
  };

  const startRound = async () => {
    if (!selectedCourse || !selectedTee) {
      alert('Please select a course and tee');
      return;
    }

    const roundId = `solo-${Date.now()}`;
    const selectedTeeData = selectedCourse.tees[selectedTee];

    // Determine ending hole based on starting hole and number of holes
    const endingHole = numHoles === 9 
      ? (startingHole === 1 ? 9 : 18)
      : 18;

    const newRound = {
      id: roundId,
      userId: user.uid,
      userName: user.displayName || 'Player',
      courseId: selectedCourse.id,
      courseName: selectedCourse.name,
      teeId: selectedTee,
      teeName: selectedTeeData.name,
      format: format,
      numHoles: numHoles,
      startingHole: startingHole,
      endingHole: endingHole,
      date: Date.now(),
      status: 'in_progress',
      currentHole: startingHole,
      holes: {},
      stats: {
        totalScore: 0,
        toPar: 0,
        totalPutts: 0,
        fairwaysHit: 0,
        fairwaysPossible: 0,
        greensInRegulation: 0,
        stablefordPoints: 0
      },
      coursePars: selectedTeeData.pars,
      courseYardages: selectedTeeData.yardages,
      courseStrokeIndexes: selectedCourse.strokeIndex
    };

    setCurrentSoloRound(newRound);
    setView('solo-scoring');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Loading courses...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => setView('home')} 
          className="text-white mb-6 hover:text-blue-200 flex items-center gap-2"
        >
          ← Back
        </button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Play Solo</h1>

          {/* Course Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Course
            </label>
            <select
              value={selectedCourse?.id || ''}
              onChange={(e) => {
                const course = courses.find(c => c.id === e.target.value);
                setSelectedCourse(course);
                setSelectedTee(null);
              }}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-gray-900"
            >
              <option value="">Select a course</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name}
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
              value={selectedTee || ''}
              onChange={(e) => setSelectedTee(e.target.value)}
              disabled={!selectedCourse}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Select a tee</option>
              {getTeesArray(selectedCourse).map(tee => {
                const totalYards = tee.yardages?.reduce((sum, y) => sum + (parseInt(y) || 0), 0) || 0;
                return (
                  <option key={tee.id} value={tee.id}>
                    {tee.name} - Rating: {tee.rating} / Slope: {tee.slope} / {totalYards} yards
                  </option>
                );
              })}
            </select>
          </div>

          {/* Scoring Format */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Scoring Format
            </label>
            <div className="space-y-3">
              <label className="flex items-center p-4 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="stroke"
                  checked={format === 'stroke'}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-5 h-5 text-blue-600"
                />
                <span className="ml-3 text-gray-900 font-medium">Stroke Play</span>
              </label>
              <label className="flex items-center p-4 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="stableford"
                  checked={format === 'stableford'}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-5 h-5 text-blue-600"
                />
                <span className="ml-3 text-gray-900 font-medium">Stableford</span>
              </label>
            </div>
          </div>

          {/* Number of Holes */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Number of Holes
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-center p-4 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="numHoles"
                  value="9"
                  checked={numHoles === 9}
                  onChange={(e) => setNumHoles(parseInt(e.target.value))}
                  className="w-5 h-5 text-blue-600"
                />
                <span className="ml-3 text-gray-900 font-medium">9 Holes</span>
              </label>
              <label className="flex items-center justify-center p-4 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="numHoles"
                  value="18"
                  checked={numHoles === 18}
                  onChange={(e) => setNumHoles(parseInt(e.target.value))}
                  className="w-5 h-5 text-blue-600"
                />
                <span className="ml-3 text-gray-900 font-medium">18 Holes</span>
              </label>
            </div>
          </div>

          {/* Starting Hole (only for 9 holes) */}
          {numHoles === 9 && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Starting Hole
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-center p-4 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="startingHole"
                    value="1"
                    checked={startingHole === 1}
                    onChange={(e) => setStartingHole(parseInt(e.target.value))}
                    className="w-5 h-5 text-blue-600"
                  />
                  <span className="ml-3 text-gray-900 font-medium">Front 9 (1-9)</span>
                </label>
                <label className="flex items-center justify-center p-4 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="startingHole"
                    value="10"
                    checked={startingHole === 10}
                    onChange={(e) => setStartingHole(parseInt(e.target.value))}
                    className="w-5 h-5 text-blue-600"
                  />
                  <span className="ml-3 text-gray-900 font-medium">Back 9 (10-18)</span>
                </label>
              </div>
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={startRound}
            disabled={!selectedCourse || !selectedTee}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-colors"
          >
            Start Round
          </button>
        </div>
      </div>
    </div>
  );
}
