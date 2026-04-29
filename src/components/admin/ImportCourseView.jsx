import { useState, useRef } from 'react';
import { ref, set } from 'firebase/database';
import { database } from '../../firebase';

const TEMPLATE_CSV = `course_name,Glen Eagle Golf Club
location,Syracuse UT
,H1,H2,H3,H4,H5,H6,H7,H8,H9,H10,H11,H12,H13,H14,H15,H16,H17,H18
PAR,4,5,3,4,4,5,4,3,4,4,4,3,5,4,4,3,5,4
SI,7,1,15,5,13,3,9,17,11,8,2,18,4,14,6,10,16,12
Black,73.5,135,385,560,185,425,390,535,415,175,415,430,405,175,535,395,420,185,555
Blue,71.2,128,365,540,165,405,370,515,395,155,395,410,385,155,515,375,400,165,535
White,69.4,120,340,505,145,380,350,490,370,135,370,385,360,130,490,350,375,140,510
Red,67.1,113,285,445,125,325,295,425,310,110,310,325,300,105,430,290,315,120,445

course_name,Oakridge Country Club
location,Farmington UT
,H1,H2,H3,H4,H5,H6,H7,H8,H9,H10,H11,H12,H13,H14,H15,H16,H17,H18
PAR,4,3,5,4,4,3,5,4,4,4,4,5,3,4,4,5,3,4
SI,9,17,1,11,5,15,3,13,7,10,16,2,18,8,12,4,14,6
Blue,70.8,125,355,155,500,385,375,165,490,370,380,390,400,510,145,380,375,505,145,370
White,68.9,118,330,135,475,360,350,145,465,345,355,365,375,485,125,355,350,480,125,345`;

function parseCourseBlock(lines, blockIndex) {
  const errors = [];
  let name = '';
  let location = '';
  let pars = [];
  let strokeIndex = [];
  const tees = [];

  for (const line of lines) {
    const cells = line.split(',');
    const key = cells[0].trim().toLowerCase();

    if (key === 'course_name') {
      name = cells.slice(1).join(',').trim();
    } else if (key === 'location') {
      location = cells.slice(1).join(',').trim();
    } else if (key === 'par') {
      pars = cells.slice(1, 19).map(v => parseInt(v.trim()) || 0);
    } else if (key === 'si') {
      strokeIndex = cells.slice(1, 19).map(v => parseInt(v.trim()) || 0);
    } else if (key === '' || key === 'hole' || /^h\d+$/.test(key)) {
      // header row — skip
    } else {
      const teeName = cells[0].trim();
      const rating = parseFloat(cells[1]) || 0;
      const slope = parseInt(cells[2]) || 0;
      const yardages = cells.slice(3, 21).map(v => parseInt(v.trim()) || 0);
      if (teeName && yardages.length === 18) {
        tees.push({ id: `tee-${Date.now()}-${blockIndex}-${tees.length}`, name: teeName, rating, slope, yardages });
      }
    }
  }

  const label = name ? `"${name}"` : `Course ${blockIndex + 1}`;

  if (!name) errors.push(`${label}: missing course_name row`);
  if (pars.length !== 18) errors.push(`${label}: PAR row needs 18 values (found ${pars.length})`);
  if (strokeIndex.length !== 18) errors.push(`${label}: SI row needs 18 values (found ${strokeIndex.length})`);
  if (tees.length === 0) errors.push(`${label}: no tee rows found`);

  for (let i = 0; i < pars.length; i++) {
    if (pars[i] < 3 || pars[i] > 6) errors.push(`${label}, hole ${i + 1}: par ${pars[i]} must be 3–6`);
  }

  const siSet = new Set(strokeIndex);
  if (siSet.size !== 18 || !strokeIndex.every(v => v >= 1 && v <= 18)) {
    errors.push(`${label}: SI must contain each value 1–18 exactly once`);
  }

  for (const tee of tees) {
    for (let i = 0; i < 18; i++) {
      if (tee.yardages[i] < 50 || tee.yardages[i] > 700) {
        errors.push(`${label}, ${tee.name}, hole ${i + 1}: yardage ${tee.yardages[i]} out of range (50–700)`);
      }
    }
  }

  if (errors.length > 0) return { errors };

  const teesWithPars = tees.map(t => ({ ...t, pars }));
  return { name, location, pars, strokeIndex, tees: teesWithPars, errors: [] };
}

function parseCSV(text) {
  const allLines = text.split(/\r?\n/).map(l => l.trim());

  // Split into blocks on blank lines
  const blocks = [];
  let current = [];
  for (const line of allLines) {
    if (line === '') {
      if (current.length > 0) { blocks.push(current); current = []; }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  if (blocks.length === 0) return { courses: [], errors: ['File appears to be empty'] };

  const courses = [];
  const allErrors = [];

  blocks.forEach((block, i) => {
    const result = parseCourseBlock(block, i);
    if (result.errors.length > 0) {
      allErrors.push(...result.errors);
    } else {
      courses.push(result);
    }
  });

  return { courses, errors: allErrors };
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'courses_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function ScorecardPreview({ course }) {
  const total = (arr, s, e) => arr.slice(s, e).reduce((sum, v) => sum + (v || 0), 0);

  return (
    <div className="mb-6">
      <div className="bg-gray-50 rounded-t-xl px-4 py-3 border-b border-gray-200">
        <div className="font-bold text-gray-900">{course.name}</div>
        {course.location && <div className="text-sm text-gray-500">{course.location}</div>}
        <div className="text-xs text-gray-400 mt-0.5">{course.tees.length} tee{course.tees.length !== 1 ? 's' : ''}</div>
      </div>
      <div className="overflow-x-auto rounded-b-xl border border-gray-200">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#00285e] text-white">
              <td className="p-2 font-semibold min-w-[90px]">Hole</td>
              {[...Array(9)].map((_, i) => <td key={i} className="p-2 text-center w-9">{i + 1}</td>)}
              <td className="p-2 text-center font-bold w-10">OUT</td>
              {[...Array(9)].map((_, i) => <td key={i} className="p-2 text-center w-9">{i + 10}</td>)}
              <td className="p-2 text-center font-bold w-9">IN</td>
              <td className="p-2 text-center font-bold w-10">TOT</td>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white border-b border-gray-200">
              <td className="p-2 font-semibold text-gray-700">Par</td>
              {course.pars.slice(0, 9).map((p, i) => <td key={i} className="p-2 text-center">{p}</td>)}
              <td className="p-2 text-center font-bold bg-gray-100">{total(course.pars, 0, 9)}</td>
              {course.pars.slice(9, 18).map((p, i) => <td key={i} className="p-2 text-center">{p}</td>)}
              <td className="p-2 text-center font-bold bg-gray-100">{total(course.pars, 9, 18)}</td>
              <td className="p-2 text-center font-bold bg-gray-100">{total(course.pars, 0, 18)}</td>
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200">
              <td className="p-2 font-semibold text-gray-500">SI</td>
              {course.strokeIndex.slice(0, 9).map((s, i) => <td key={i} className="p-2 text-center text-gray-500">{s}</td>)}
              <td className="p-2 bg-gray-100"></td>
              {course.strokeIndex.slice(9, 18).map((s, i) => <td key={i} className="p-2 text-center text-gray-500">{s}</td>)}
              <td className="p-2 bg-gray-100"></td>
              <td className="p-2 bg-gray-100"></td>
            </tr>
            {course.tees.map((tee, ti) => (
              <tr key={ti} className={`border-b border-gray-200 ${ti % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="p-2 font-semibold text-gray-800">
                  {tee.name}
                  <div className="text-gray-400 font-normal">{tee.rating} / {tee.slope}</div>
                </td>
                {tee.yardages.slice(0, 9).map((y, i) => <td key={i} className="p-2 text-center">{y}</td>)}
                <td className="p-2 text-center font-bold bg-gray-100">{total(tee.yardages, 0, 9)}</td>
                {tee.yardages.slice(9, 18).map((y, i) => <td key={i} className="p-2 text-center">{y}</td>)}
                <td className="p-2 text-center font-bold bg-gray-100">{total(tee.yardages, 9, 18)}</td>
                <td className="p-2 text-center font-bold bg-gray-100">{total(tee.yardages, 0, 18)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ImportCourseView({ currentUser, feedback, setFeedback, setView, loadCourses }) {
  const [parsed, setParsed] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseCSV(e.target.result);
      setParseErrors(result.errors);
      setParsed(result.courses.length > 0 ? result.courses : null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      for (const course of parsed) {
        const courseId = `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const teeData = {};
        course.tees.forEach(tee => {
          teeData[tee.id] = { name: tee.name, rating: tee.rating, slope: tee.slope, pars: tee.pars, yardages: tee.yardages };
        });
        await set(ref(database, `courses/${courseId}`), {
          name: course.name,
          location: course.location,
          strokeIndex: course.strokeIndex,
          tees: teeData,
          createdBy: currentUser.uid,
          createdAt: Date.now()
        });
      }

      setFeedback(`${parsed.length} course${parsed.length !== 1 ? 's' : ''} imported!`);
      await loadCourses();
      setTimeout(() => { setFeedback(''); setView('manage-courses'); }, 1500);
    } catch (err) {
      setFeedback('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#00285e] p-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => setView('manage-courses')} className="text-white mb-6 hover:text-[#c8d6e5]">
          ← Back
        </button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Import Courses from CSV</h2>
          <p className="text-gray-600 mb-6">
            One file can hold as many courses as you want — separate each course with a blank line.
          </p>

          {/* Step 1 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-7 h-7 rounded-full bg-[#00285e] text-white text-sm font-bold flex items-center justify-center">1</div>
              <h3 className="text-lg font-bold text-gray-900">Download the template</h3>
            </div>
            <button
              onClick={downloadTemplate}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download courses_template.csv
            </button>
            <p className="text-sm text-gray-500 mt-2">
              The template has two sample courses so you can see the format. Replace them with your courses — add as many as you need, each separated by a blank row.
            </p>
          </div>

          {/* Format reference */}
          <div className="mb-8 bg-gray-50 rounded-xl p-4 overflow-x-auto">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Format (repeat per course, blank line between)</p>
            <table className="text-xs text-gray-700 border-collapse">
              <tbody>
                <tr><td className="pr-4 py-0.5 font-mono font-semibold">course_name</td><td className="text-gray-500">Your Course Name</td></tr>
                <tr><td className="pr-4 py-0.5 font-mono font-semibold">location</td><td className="text-gray-500">City, State</td></tr>
                <tr className="text-gray-400"><td className="pr-4 py-0.5 font-mono">(header)</td><td>H1, H2, … H18 — optional, for readability</td></tr>
                <tr><td className="pr-4 py-0.5 font-mono font-semibold">PAR</td><td className="text-gray-500">4, 5, 3, … (18 values, each 3–6)</td></tr>
                <tr><td className="pr-4 py-0.5 font-mono font-semibold">SI</td><td className="text-gray-500">7, 1, 15, … (1–18 each used exactly once)</td></tr>
                <tr><td className="pr-4 py-0.5 font-mono font-semibold text-blue-700">[Tee name]</td><td className="text-gray-500">73.5, 135, 385, … (rating, slope, then 18 yardages)</td></tr>
                <tr><td className="pr-4 py-0.5 italic text-gray-400" colSpan={2}>(blank line)</td></tr>
                <tr><td className="pr-4 py-0.5 font-mono font-semibold">course_name</td><td className="text-gray-500">Next Course Name</td></tr>
                <tr><td className="pr-4 py-0.5 italic text-gray-400" colSpan={2}>… and so on</td></tr>
              </tbody>
            </table>
          </div>

          {/* Step 2 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-7 h-7 rounded-full bg-[#00285e] text-white text-sm font-bold flex items-center justify-center">2</div>
              <h3 className="text-lg font-bold text-gray-900">Upload your CSV</h3>
            </div>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-[#00285e] hover:bg-blue-50 transition-colors"
            >
              <svg className="mx-auto mb-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p className="text-gray-600 font-semibold">Click to select or drag & drop a .csv file</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          {/* Errors */}
          {parseErrors.length > 0 && (
            <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-xl p-4">
              <p className="font-semibold text-red-800 mb-2">Fix these issues and re-upload:</p>
              <ul className="list-disc list-inside space-y-1">
                {parseErrors.map((e, i) => <li key={i} className="text-sm text-red-700">{e}</li>)}
              </ul>
            </div>
          )}

          {/* Preview */}
          {parsed && parsed.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-full bg-[#00285e] text-white text-sm font-bold flex items-center justify-center">3</div>
                <h3 className="text-lg font-bold text-gray-900">
                  Review &amp; save
                  <span className="ml-2 text-base font-normal text-gray-500">
                    {parsed.length} course{parsed.length !== 1 ? 's' : ''} ready to import
                  </span>
                </h3>
              </div>
              {parsed.map((course, i) => <ScorecardPreview key={i} course={course} />)}
            </div>
          )}

          {feedback && (
            <div className={`mb-4 p-4 rounded-xl text-center font-semibold ${
              feedback.includes('Error')
                ? 'bg-red-50 border-2 border-red-500 text-red-800'
                : 'bg-green-50 border-2 border-green-500 text-green-800'
            }`}>
              {feedback}
            </div>
          )}

          {parsed && parsed.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-[#00285e] text-white py-4 rounded-xl font-semibold hover:bg-[#003a7d] text-lg disabled:opacity-60"
            >
              {saving ? 'Saving…' : `Save ${parsed.length} Course${parsed.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
