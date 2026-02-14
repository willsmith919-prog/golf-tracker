import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';
import CourseSelector from '../shared/CourseSelector.jsx';

export default function SoloSetupView({ setView, setCurrentSoloRound, user }) {
  const [globalCourses, setGlobalCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTeeId, setSelectedTeeId] = useState('');
  const [selectedTeeData, setSelectedTeeData] = useState(null);
  const [selectedCourseData, setSelectedCourseData] = useState(null);
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
        setGlobalCourses(coursesArray);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading courses:', error);
      setLoading(false);
    }
  };

  const handleCourseChange = (courseId) => {
    setSelectedCourseId(courseId);
    setSelectedTeeId('');
    setSelectedTeeData(null);
    setSelectedCourseData(null);
  };

  const handleTeeChange = (teeId, teeData, courseData) => {
    setSelectedTeeId(teeId);
    setSelectedTeeData(teeData);
    setSelectedCourseData(courseData);
  };

  const startRound = async () => {
    if (!selectedCourseData || !selectedTeeData) {
      alert('Please select a course and tee');
      return;
    }

    const roundId = `solo-${Date.now()}`;

    const endingHole = numHoles === 9 
      ? (startingHole === 1 ? 9 : 18)
      : 18;

    const newRound = {
      id: roundId,
      userId: user.uid,
      userName: user.displayName || 'Player',
      courseId: selectedCourseData.id,
      courseName: selectedCourseData.name,
      teeId: selectedTeeId,
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
      courseStrokeIndexes: selectedCourseData.strokeIndex
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

          {/* Shared Course/Tee Selector */}
          <CourseSelector
            globalCourses={globalCourses}
            selectedCourseId={selectedCourseId}
            selectedTeeId={selectedTeeId}
            onCourseChange={handleCourseChange}
            onTeeChange={handleTeeChange}
          />

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
            disabled={!selectedCourseId || !selectedTeeId}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-colors"
          >
            Start Round
          </button>
        </div>
      </div>
    </div>
  );
}
