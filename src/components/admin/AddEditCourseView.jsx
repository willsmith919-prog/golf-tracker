import { ref, set } from 'firebase/database';
import { database } from '../../firebase';
import { PlusIcon, TrashIcon } from '../icons';

const cell = 'w-full text-center text-sm py-1 px-0.5 border border-gray-200 rounded focus:border-[#00285e] focus:outline-none bg-white';
const totalCell = 'p-1 text-center font-bold text-sm bg-gray-100 text-gray-700';

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
  const calcTotal = (arr, s, e) => arr.slice(s, e).reduce((sum, v) => sum + (parseInt(v) || 0), 0);

  const sortTees = (tees) => [...tees].sort((a, b) => {
    const ra = parseFloat(a.rating);
    const rb = parseFloat(b.rating);
    if (isNaN(ra) && isNaN(rb)) return 0;
    if (isNaN(ra)) return 1;
    if (isNaN(rb)) return -1;
    return rb - ra;
  });

  const resortTees = () => setCourseForm(prev => ({ ...prev, tees: sortTees(prev.tees) }));

  const updatePar = (holeIndex, value) => {
    const newTees = courseForm.tees.map(tee => ({
      ...tee,
      pars: tee.pars.map((p, i) => i === holeIndex ? value : p)
    }));
    setCourseForm({ ...courseForm, tees: newTees });
  };

  const updateStrokeIndex = (holeIndex, value) => {
    const newSI = [...courseForm.strokeIndex];
    newSI[holeIndex] = value;
    setCourseForm({ ...courseForm, strokeIndex: newSI });
  };

  const updateTeeField = (teeIndex, field, value) => {
    const newTees = [...courseForm.tees];
    newTees[teeIndex] = { ...newTees[teeIndex], [field]: value };
    setCourseForm({ ...courseForm, tees: newTees });
  };

  const updateYardage = (teeIndex, holeIndex, value) => {
    const newTees = [...courseForm.tees];
    const newYardages = [...newTees[teeIndex].yardages];
    newYardages[holeIndex] = value;
    newTees[teeIndex] = { ...newTees[teeIndex], yardages: newYardages };
    setCourseForm({ ...courseForm, tees: newTees });
  };

  const addTee = () => {
    setCourseForm(prev => ({
      ...prev,
      tees: sortTees([...prev.tees, {
        id: `tee-${Date.now()}`,
        name: '', rating: '', slope: '',
        pars: prev.tees[0]?.pars ? [...prev.tees[0].pars] : Array(18).fill(''),
        yardages: Array(18).fill('')
      }])
    }));
  };

  const removeTee = (index) => {
    if (courseForm.tees.length === 1) {
      setFeedback('Must have at least one tee');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }
    setCourseForm(prev => ({ ...prev, tees: sortTees(prev.tees.filter((_, i) => i !== index)) }));
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
      if (!tee.name) { setFeedback(`Tee ${i + 1}: Name is required`); setTimeout(() => setFeedback(''), 3000); return; }
      if (!tee.rating || !tee.slope) { setFeedback(`Tee ${i + 1}: Rating and slope are required`); setTimeout(() => setFeedback(''), 3000); return; }
      for (let h = 0; h < 18; h++) {
        const p = parseInt(tee.pars[h]);
        if (!p || p < 3 || p > 6) { setFeedback(`Hole ${h + 1}: Par must be 3–6`); setTimeout(() => setFeedback(''), 3000); return; }
      }
      for (let h = 0; h < 18; h++) {
        const y = parseInt(tee.yardages[h]);
        if (!y || y < 50 || y > 700) { setFeedback(`${tee.name}, hole ${h + 1}: Yardage must be 50–700`); setTimeout(() => setFeedback(''), 3000); return; }
      }
    }

    const siSet = new Set();
    for (let i = 0; i < 18; i++) {
      const si = parseInt(courseForm.strokeIndex[i]);
      if (!si || si < 1 || si > 18) { setFeedback(`Hole ${i + 1}: Stroke index must be 1–18`); setTimeout(() => setFeedback(''), 3000); return; }
      if (siSet.has(si)) { setFeedback(`Stroke index ${si} used more than once — each value 1–18 must appear exactly once`); setTimeout(() => setFeedback(''), 4000); return; }
      siSet.add(si);
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
      await set(ref(database, `courses/${courseId}`), {
        name: courseForm.name,
        location: courseForm.location,
        strokeIndex: courseForm.strokeIndex.map(si => parseInt(si) || 0),
        tees: teeData,
        createdBy: currentUser.uid,
        createdAt: editingCourse?.createdAt || Date.now()
      });
      setFeedback('Course saved!');
      setTimeout(async () => { await loadCourses(); setView('manage-courses'); setFeedback(''); }, 1500);
    } catch (error) {
      setFeedback('Error saving course: ' + error.message);
    }
  };

  const pars = courseForm.tees[0]?.pars || Array(18).fill('');
  const holes = Array.from({ length: 18 }, (_, i) => i);

  return (
    <div className="min-h-screen bg-[#00285e] p-4 lg:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <button
          onClick={() => { setView('manage-courses'); setEditingCourse(null); }}
          className="text-white mb-6 hover:text-[#c8d6e5]"
        >
          ← Back
        </button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 lg:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {editingCourse ? 'Edit Course' : 'Add Course'}
          </h2>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-w-2xl">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Course Name</label>
              <input
                type="text"
                value={courseForm.name}
                onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                placeholder="Glen Eagle Golf Course"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={courseForm.location}
                onChange={(e) => setCourseForm({ ...courseForm, location: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                placeholder="Syracuse, UT"
              />
            </div>
          </div>

          {/* Scorecard Table */}
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs" style={{ minWidth: '900px' }}>
              <thead>
                <tr className="bg-[#00285e] text-white">
                  <th className="p-2 text-left font-semibold rounded-tl-lg" style={{ minWidth: '110px' }}>Tee</th>
                  <th className="p-2 text-center font-semibold" style={{ width: '62px' }}>Rating</th>
                  <th className="p-2 text-center font-semibold" style={{ width: '56px' }}>Slope</th>
                  {[1,2,3,4,5,6,7,8,9].map(h => <th key={h} className="p-2 text-center" style={{ width: '44px' }}>{h}</th>)}
                  <th className="p-2 text-center font-bold" style={{ width: '46px' }}>OUT</th>
                  {[10,11,12,13,14,15,16,17,18].map(h => <th key={h} className="p-2 text-center" style={{ width: '44px' }}>{h}</th>)}
                  <th className="p-2 text-center font-bold" style={{ width: '46px' }}>IN</th>
                  <th className="p-2 text-center font-bold" style={{ width: '50px' }}>TOT</th>
                  <th style={{ width: '32px' }}></th>
                </tr>
              </thead>
              <tbody>

                {/* PAR row */}
                <tr className="bg-amber-50 border-b-2 border-gray-300">
                  <td colSpan={3} className="px-3 py-2 font-bold text-gray-700 text-xs uppercase tracking-widest">Par</td>
                  {holes.slice(0, 9).map(i => (
                    <td key={i} className="p-1">
                      <input type="text" inputMode="numeric" value={pars[i] || ''} onChange={e => updatePar(i, e.target.value)} className={cell} />
                    </td>
                  ))}
                  <td className={totalCell}>{calcTotal(pars, 0, 9) || '—'}</td>
                  {holes.slice(9, 18).map(i => (
                    <td key={i} className="p-1">
                      <input type="text" inputMode="numeric" value={pars[i] || ''} onChange={e => updatePar(i, e.target.value)} className={cell} />
                    </td>
                  ))}
                  <td className={totalCell}>{calcTotal(pars, 9, 18) || '—'}</td>
                  <td className={totalCell}>{calcTotal(pars, 0, 18) || '—'}</td>
                  <td></td>
                </tr>

                {/* SI row */}
                <tr className="bg-gray-50 border-b-2 border-gray-300">
                  <td colSpan={3} className="px-3 py-2 font-bold text-gray-500 text-xs uppercase tracking-widest">Stroke Index</td>
                  {holes.slice(0, 9).map(i => (
                    <td key={i} className="p-1">
                      <input type="text" inputMode="numeric" value={courseForm.strokeIndex[i] || ''} onChange={e => updateStrokeIndex(i, e.target.value)} className={cell} />
                    </td>
                  ))}
                  <td className="bg-gray-200"></td>
                  {holes.slice(9, 18).map(i => (
                    <td key={i} className="p-1">
                      <input type="text" inputMode="numeric" value={courseForm.strokeIndex[i] || ''} onChange={e => updateStrokeIndex(i, e.target.value)} className={cell} />
                    </td>
                  ))}
                  <td className="bg-gray-200"></td>
                  <td className="bg-gray-200"></td>
                  <td></td>
                </tr>

                {/* Tee rows */}
                {courseForm.tees.map((tee, ti) => (
                  <tr key={tee.id} className={`border-b border-gray-200 ${ti % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'}`}>
                    <td className="p-1">
                      <input
                        type="text"
                        value={tee.name}
                        onChange={e => updateTeeField(ti, 'name', e.target.value)}
                        placeholder="Black"
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[#00285e] focus:outline-none"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={tee.rating}
                        onChange={e => updateTeeField(ti, 'rating', e.target.value)}
                        onBlur={resortTees}
                        placeholder="72.1"
                        className={cell}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={tee.slope}
                        onChange={e => updateTeeField(ti, 'slope', e.target.value)}
                        placeholder="131"
                        className={cell}
                      />
                    </td>
                    {holes.slice(0, 9).map(i => (
                      <td key={i} className="p-1">
                        <input type="text" inputMode="numeric" value={tee.yardages[i] || ''} onChange={e => updateYardage(ti, i, e.target.value)} className={cell} />
                      </td>
                    ))}
                    <td className={totalCell}>{calcTotal(tee.yardages, 0, 9) || '—'}</td>
                    {holes.slice(9, 18).map(i => (
                      <td key={i} className="p-1">
                        <input type="text" inputMode="numeric" value={tee.yardages[i] || ''} onChange={e => updateYardage(ti, i, e.target.value)} className={cell} />
                      </td>
                    ))}
                    <td className={totalCell}>{calcTotal(tee.yardages, 9, 18) || '—'}</td>
                    <td className={totalCell}>{calcTotal(tee.yardages, 0, 18) || '—'}</td>
                    <td className="p-1 text-center">
                      <button onClick={() => removeTee(ti)} className="text-red-400 hover:text-red-600 p-1" title="Remove tee">
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
            className="mt-3 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <PlusIcon />
            Add Tee
          </button>

          {feedback && (
            <div className={`mt-6 p-4 rounded-xl text-center font-semibold ${
              feedback.includes('Error') || feedback.includes('required') || feedback.includes('must') || feedback.includes('missing')
                ? 'bg-red-50 border-2 border-red-500 text-red-800'
                : 'bg-green-50 border-2 border-green-500 text-green-800'
            }`}>
              {feedback}
            </div>
          )}

          <button
            onClick={saveCourse}
            className="mt-4 w-full bg-[#00285e] text-white py-3 rounded-xl font-semibold hover:bg-[#003a7d] text-lg"
          >
            Save Course
          </button>
        </div>
      </div>
    </div>
  );
}
