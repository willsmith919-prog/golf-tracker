import React from 'react';
import { ref, set } from 'firebase/database';
import { database } from '../../firebase';
import { PlusIcon, TrashIcon } from '../icons';

export default function AddEditCourseView({
  currentUser,
  courseForm,
  setCourseForm,
  editingCourse,
  setEditingCourse,
  feedback,
  setFeedback,
  setView,
  loadCourses
}) {
  const addTee = () => {
    const newTee = {
      id: `tee-${Date.now()}`,
      name: '',
      rating: '',
      slope: '',
      pars: Array(18).fill(''),
      yardages: Array(18).fill('')
    };
    setCourseForm({ ...courseForm, tees: [...courseForm.tees, newTee] });
  };

  const removeTee = (index) => {
    if (courseForm.tees.length === 1) {
      setFeedback('Must have at least one tee');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }
    const newTees = courseForm.tees.filter((_, i) => i !== index);
    setCourseForm({ ...courseForm, tees: newTees });
  };

  const updateTeeField = (teeIndex, field, value) => {
    const newTees = [...courseForm.tees];
    newTees[teeIndex][field] = value;
    setCourseForm({ ...courseForm, tees: newTees });
  };

  const updateTeeHole = (teeIndex, holeIndex, field, value) => {
    const newTees = [...courseForm.tees];
    newTees[teeIndex][field][holeIndex] = value;
    setCourseForm({ ...courseForm, tees: newTees });
  };

  const updateStrokeIndex = (holeIndex, value) => {
    const newStrokeIndex = [...courseForm.strokeIndex];
    newStrokeIndex[holeIndex] = value;
    setCourseForm({ ...courseForm, strokeIndex: newStrokeIndex });
  };

  const saveCourse = async () => {
    setFeedback('');

    if (!courseForm.name) {
      setFeedback('Course name is required');
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    for (let i = 0; i < courseForm.tees.length; i++) {
      const tee = courseForm.tees[i];
      if (!tee.name) {
        setFeedback(`Tee ${i + 1}: Name is required`);
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
      if (!tee.rating || !tee.slope) {
        setFeedback(`Tee ${i + 1}: Rating and slope are required`);
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
      for (let h = 0; h < 18; h++) {
        if (!tee.pars[h] || parseInt(tee.pars[h]) < 3 || parseInt(tee.pars[h]) > 6) {
          setFeedback(`Tee ${i + 1}, Hole ${h + 1}: Par must be between 3 and 6`);
          setTimeout(() => setFeedback(''), 3000);
          return;
        }
      }
      for (let h = 0; h < 18; h++) {
        if (!tee.yardages[h] || parseInt(tee.yardages[h]) < 50 || parseInt(tee.yardages[h]) > 700) {
          setFeedback(`Tee ${i + 1}, Hole ${h + 1}: Yardage must be between 50 and 700`);
          setTimeout(() => setFeedback(''), 3000);
          return;
        }
      }
    }

    const siSet = new Set();
    for (let i = 0; i < 18; i++) {
      const si = parseInt(courseForm.strokeIndex[i]);
      if (!si || si < 1 || si > 18) {
        setFeedback(`Hole ${i + 1}: Stroke index must be between 1 and 18`);
        setTimeout(() => setFeedback(''), 3000);
        return;
      }
      if (siSet.has(si)) {
        setFeedback(`Stroke index ${si} is used more than once. Each value from 1-18 must be used exactly once.`);
        setTimeout(() => setFeedback(''), 4000);
        return;
      }
      siSet.add(si);
    }

    for (let i = 1; i <= 18; i++) {
      if (!siSet.has(i)) {
        setFeedback(`Stroke index ${i} is missing. Each value from 1-18 must be used exactly once.`);
        setTimeout(() => setFeedback(''), 4000);
        return;
      }
    }

    try {
      const courseId = editingCourse?.id || `course-${Date.now()}`;
      
      const teeData = {};
      courseForm.tees.forEach(tee => {
        teeData[tee.id] = {
          name: tee.name,
          rating: parseFloat(tee.rating) || 0,
          slope: parseInt(tee.slope) || 0,
          pars: tee.pars.map(p => parseInt(p) || 0),
          yardages: tee.yardages.map(y => parseInt(y) || 0)
        };
      });

      const courseData = {
        name: courseForm.name,
        location: courseForm.location,
        strokeIndex: courseForm.strokeIndex.map(si => parseInt(si) || 0),
        tees: teeData,
        createdBy: currentUser.uid,
        createdAt: editingCourse?.createdAt || Date.now()
      };

      await set(ref(database, `courses/${courseId}`), courseData);
      
      setFeedback('Course saved!');
      setTimeout(async () => {
        await loadCourses();
        setView('manage-courses');
        setFeedback('');
      }, 1500);

    } catch (error) {
      console.error('Error saving course:', error);
      setFeedback('Error saving course: ' + error.message);
    }
  };

  const calculateTotal = (array, start, end) => {
    return array.slice(start, end).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-6xl mx-auto">
        <button 
          onClick={() => { 
            setView('manage-courses'); 
            setEditingCourse(null); 
          }} 
          className="text-white mb-6 hover:text-blue-200"
        >
          ← Back
        </button>
        
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            {editingCourse ? 'Edit Course' : 'Add Course'}
          </h2>

          {/* Basic Info */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Course Name</label>
                <input
                  type="text"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  placeholder="Glen Eagle Golf Course"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={courseForm.location}
                  onChange={(e) => setCourseForm({ ...courseForm, location: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  placeholder="Syracuse, UT"
                />
              </div>
            </div>
          </div>

          {/* Tees */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Tees</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left p-2 text-sm font-semibold text-gray-700">Tee Name</th>
                    <th className="text-left p-2 text-sm font-semibold text-gray-700">Rating</th>
                    <th className="text-left p-2 text-sm font-semibold text-gray-700">Slope</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {courseForm.tees.map((tee, index) => (
                    <tr key={tee.id} className="border-b border-gray-200">
                      <td className="p-2">
                        <input
                          type="text"
                          value={tee.name}
                          onChange={(e) => updateTeeField(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                          placeholder="Black"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.1"
                          value={tee.rating}
                          onChange={(e) => updateTeeField(index, 'rating', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                          placeholder="72.1"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={tee.slope}
                          onChange={(e) => updateTeeField(index, 'slope', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                          placeholder="131"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => removeTee(index)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Delete tee"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={addTee}
              className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold flex items-center gap-2"
            >
              <PlusIcon />
              Add Tee
            </button>
          </div>

          {/* Stroke Index */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Stroke Index (Handicap)</h3>
            <p className="text-sm text-gray-600 mb-3">
              Assign each hole a handicap stroke value from 1-18 (1 = hardest, 18 = easiest). Each value must be used exactly once.
            </p>
            
            {/* Front 9 */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Front 9</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="p-1 text-left min-w-[60px]"></th>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => (
                        <th key={h} className="p-1 text-center w-16">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="p-1 text-gray-600">SI</td>
                      {[...Array(9)].map((_, i) => (
                        <td key={i} className="p-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={courseForm.strokeIndex[i]}
                            onChange={(e) => updateStrokeIndex(i, e.target.value)}
                            className="w-full px-1 py-1 text-center rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Back 9 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Back 9</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="p-1 text-left min-w-[60px]"></th>
                      {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                        <th key={h} className="p-1 text-center w-16">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="p-1 text-gray-600">SI</td>
                      {[...Array(9)].map((_, i) => (
                        <td key={i} className="p-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={courseForm.strokeIndex[i + 9]}
                            onChange={(e) => updateStrokeIndex(i + 9, e.target.value)}
                            className="w-full px-1 py-1 text-center rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Pars */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Pars</h3>
            
            {/* Front 9 */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Front 9</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="p-1 text-left min-w-[60px]"></th>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => (
                        <th key={h} className="p-1 text-center w-16">{h}</th>
                      ))}
                      <th className="p-1 text-center w-16 font-bold">OUT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="p-1 text-gray-600">Par</td>
                      {[...Array(9)].map((_, i) => (
                        <td key={i} className="p-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={courseForm.tees[0]?.pars[i] || ''}
                            onChange={(e) => {
                              const newTees = courseForm.tees.map(tee => ({
                                ...tee,
                                pars: tee.pars.map((p, idx) => idx === i ? e.target.value : p)
                              }));
                              setCourseForm({ ...courseForm, tees: newTees });
                            }}
                            className="w-full px-1 py-1 text-center rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                      ))}
                      <td className="p-1 text-center font-bold bg-gray-200">
                        {calculateTotal(courseForm.tees[0]?.pars || [], 0, 9)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Back 9 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Back 9</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="p-1 text-left min-w-[60px]"></th>
                      {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                        <th key={h} className="p-1 text-center w-16">{h}</th>
                      ))}
                      <th className="p-1 text-center w-16 font-bold">IN</th>
                      <th className="p-1 text-center w-16 font-bold">TOT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="p-1 text-gray-600">Par</td>
                      {[...Array(9)].map((_, i) => (
                        <React.Fragment key={i}>
                          <td className="p-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={courseForm.tees[0]?.pars[i + 9] || ''}
                              onChange={(e) => {
                                const newTees = courseForm.tees.map(tee => ({
                                  ...tee,
                                  pars: tee.pars.map((p, idx) => idx === i + 9 ? e.target.value : p)
                                }));
                                setCourseForm({ ...courseForm, tees: newTees });
                              }}
                              className="w-full px-1 py-1 text-center rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                          {i === 8 && (
                            <td className="p-1 text-center font-bold bg-gray-200">
                              {calculateTotal(courseForm.tees[0]?.pars || [], 9, 18)}
                            </td>
                          )}
                        </React.Fragment>
                      ))}
                      <td className="p-1 text-center font-bold bg-gray-200">
                        {calculateTotal(courseForm.tees[0]?.pars || [], 0, 18)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Yardages by Tee */}
          {courseForm.tees.map((tee, teeIndex) => (
            <div key={tee.id} className="mb-6 border-2 border-gray-200 rounded-xl p-4">
              <h4 className="text-md font-bold text-gray-900 mb-3">
                {tee.name || `Tee ${teeIndex + 1}`} - Yardages
              </h4>
              
              {/* Front 9 */}
              <div className="mb-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Front 9</h5>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="p-1 text-left min-w-[60px]"></th>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => (
                          <th key={h} className="p-1 text-center w-16">{h}</th>
                        ))}
                        <th className="p-1 text-center w-16 font-bold">OUT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="p-1 text-gray-600">Yds</td>
                        {[...Array(9)].map((_, i) => (
                          <td key={i} className="p-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={tee.yardages[i]}
                              onChange={(e) => updateTeeHole(teeIndex, i, 'yardages', e.target.value)}
                              className="w-full px-1 py-1 text-center rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                        ))}
                        <td className="p-1 text-center font-bold">{calculateTotal(tee.yardages, 0, 9)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Back 9 */}
              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Back 9</h5>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="p-1 text-left min-w-[60px]"></th>
                        {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                          <th key={h} className="p-1 text-center w-16">{h}</th>
                        ))}
                        <th className="p-1 text-center w-16 font-bold">IN</th>
                        <th className="p-1 text-center w-16 font-bold">TOT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="p-1 text-gray-600">Yds</td>
                        {[...Array(9)].map((_, i) => (
                          <td key={i} className="p-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={tee.yardages[i + 9]}
                              onChange={(e) => updateTeeHole(teeIndex, i + 9, 'yardages', e.target.value)}
                              className="w-full px-1 py-1 text-center rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                        ))}
                        <td className="p-1 text-center font-bold">{calculateTotal(tee.yardages, 9, 18)}</td>
                        <td className="p-1 text-center font-bold">{calculateTotal(tee.yardages, 0, 18)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}

          {/* Feedback message right above Save button */}
          {feedback && (
            <div className={`mb-4 p-4 rounded-xl text-center font-semibold ${
              feedback.includes('Error') || feedback.includes('required') || feedback.includes('must') || feedback.includes('missing')
                ? 'bg-red-50 border-2 border-red-500 text-red-800'
                : 'bg-green-50 border-2 border-green-500 text-green-800'
            }`}>
              {feedback}
            </div>
          )}

          <button
            onClick={saveCourse}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 text-lg"
          >
            Save Course
          </button>
        </div>
      </div>
    </div>
  );
}
