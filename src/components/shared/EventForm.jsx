import { useState } from 'react';
import CourseSelector from './CourseSelector.jsx';
import RoundOptions from './RoundOptions.jsx';
import FormatSelector from './FormatSelector.jsx';

/**
 * Shared event form used by both CreateEventView and EditEventView.
 * 
 * Props:
 *   - initialData: object with form field defaults (empty for create, pre-filled for edit)
 *   - globalCourses: array of course objects for the CourseSelector
 *   - formats: array of format objects for the FormatSelector
 *   - showRoundOptions: boolean — whether to show 9/18 holes + starting hole (hidden for league events)
 *   - submitLabel: string — text for the submit button ("Create Event" or "Save Changes")
 *   - onSubmit: function(formData) — called with the form data when user clicks submit
 *   - feedback: string — feedback message to display
 */
export default function EventForm({
  initialData = {},
  globalCourses,
  formats,
  showRoundOptions = true,
  submitLabel = 'Submit',
  onSubmit,
  feedback,
  preFillEvent = null
}) {
  const mergedData = { ...initialData, ...(preFillEvent || {}) };
  
  const [formData, setFormData] = useState({
      name: mergedData.name || '',
      courseId: mergedData.courseId || '',
      selectedCourseId: mergedData.selectedCourseId || mergedData.courseId || '',
      selectedTeeId: mergedData.selectedTeeId || mergedData.teeId || '',
      courseName: mergedData.courseName || '',
      coursePars: mergedData.coursePars || [],
      courseYardages: mergedData.courseYardages || [],
      courseStrokeIndexes: mergedData.courseStrokeIndexes || [],
      teeId: mergedData.teeId || '',
      teeName: mergedData.teeName || '',
      date: mergedData.date || new Date().toISOString().split('T')[0],
      time: mergedData.time || '',
      format: mergedData.format || 'scramble',
      formatId: mergedData.formatId || '',
      formatName: mergedData.formatName || '',
      scoringMethod: mergedData.scoringMethod || 'stroke',
      teamSize: mergedData.teamSize || 2,
      handicap: mergedData.handicap || { enabled: false, allowance: 100 },
      stablefordPoints: mergedData.stablefordPoints || null,
      competition: mergedData.competition || { structure: 'full_field' },
      startingHole: mergedData.startingHole || 1,
      numHoles: mergedData.numHoles || 18,
      display: mergedData.display || {
        showGross: true, showNet: true, primarySort: 'net',
        showRelativeToPar: true, showHoleByHole: true, showStrokeHoles: true,
        showMulligansRemaining: false, showMatchStatus: false, showRoundRobinGrid: false
      }
    });

  const selectedCourseId = formData.selectedCourseId || '';
  const selectedTeeId = formData.selectedTeeId || '';

  const handleCourseChange = (courseId) => {
    setFormData({
      ...formData,
      selectedCourseId: courseId,
      selectedTeeId: '',
      courseId: '',
      courseName: '',
      coursePars: [],
      courseYardages: [],
      courseStrokeIndexes: []
    });
  };

  const handleTeeChange = (teeId, teeData, courseData) => {
    setFormData({
      ...formData,
      selectedTeeId: teeId,
      courseId: courseData?.id || '',
      courseName: courseData?.name || '',
      coursePars: teeData?.pars || [],
      courseYardages: teeData?.yardages || [],
      courseStrokeIndexes: courseData?.strokeIndex || [],
      teeId: teeId,
      teeName: teeData?.name || '',
      teeRating: teeData?.rating || '',
      teeSlope: teeData?.slope || ''
    });
  };

  const handleFormatChange = (formatId, formatData) => {
    const handicapEnabled = formatData?.handicap?.enabled || false;
    const applicationMethod = formatData?.handicap?.applicationMethod || 'strokes';
    const scoringMethod = formatData?.scoringMethod || 'stroke';
    const competitionStructure = formatData?.competition?.structure || 'full_field';

    const smartDisplay = {
      showGross: true,
      showNet: handicapEnabled && applicationMethod === 'strokes',
      primarySort: handicapEnabled && applicationMethod === 'strokes' ? 'net' : 'gross',
      showRelativeToPar: true,
      showHoleByHole: true,
      showStrokeHoles: handicapEnabled && applicationMethod === 'strokes',
      showMulligansRemaining: handicapEnabled && applicationMethod === 'mulligans',
      showMatchStatus: scoringMethod === 'match_play' || competitionStructure === 'round_robin',
      showRoundRobinGrid: competitionStructure === 'round_robin'
    };

    setFormData({
      ...formData,
      formatId: formatId,
      format: formatData?.combinationMethod || 'scramble',
      scoringMethod: scoringMethod,
      teamSize: formatData?.teamSize || 2,
      formatName: formatData?.name || '',
      handicap: formatData?.handicap || { enabled: false, allowance: 100 },
      stablefordPoints: formatData?.stablefordPoints || null,
      competition: formatData?.competition || { structure: 'full_field' },
      display: smartDisplay
    });
  };

  const DisplayToggle = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );

  const handleSubmit = () => {
    if (!formData.name || !formData.courseId || !formData.selectedTeeId) {
      // Let the parent handle feedback — just pass back null to indicate validation failed
      onSubmit(null, 'Please add event name and select a course/tee');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Event Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Week 1 Scramble"
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <CourseSelector
        globalCourses={globalCourses}
        selectedCourseId={selectedCourseId}
        selectedTeeId={selectedTeeId}
        onCourseChange={handleCourseChange}
        onTeeChange={handleTeeChange}
      />

      <FormatSelector
        formats={formats}
        selectedFormatId={formData.formatId || ''}
        onFormatChange={handleFormatChange}
      />

      {/* Leaderboard Display — only shown after a format is selected */}
      {formData.formatId && (
        <div className="border-2 border-gray-200 rounded-xl p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Leaderboard Display</label>
          <p className="text-sm text-gray-500 mb-3">What should the scoreboard show for this event?</p>
          <div className="space-y-3">

            <DisplayToggle
              label="Show scores relative to par"
              description='Display "+3" or "-2" instead of just the total'
              checked={formData.display?.showRelativeToPar ?? true}
              onChange={(val) => setFormData({ ...formData, display: { ...formData.display, showRelativeToPar: val } })}
            />
            <DisplayToggle
              label="Show hole-by-hole scores"
              description="Show each hole's score, not just the running total"
              checked={formData.display?.showHoleByHole ?? true}
              onChange={(val) => setFormData({ ...formData, display: { ...formData.display, showHoleByHole: val } })}
            />

            {formData.handicap?.enabled && formData.handicap?.applicationMethod === 'strokes' && (
              <>
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Handicap Display</p>
                </div>
                <DisplayToggle
                  label="Show Gross score"
                  description="The raw score before handicap adjustment"
                  checked={formData.display?.showGross ?? true}
                  onChange={(val) => setFormData({ ...formData, display: { ...formData.display, showGross: val } })}
                />
                <DisplayToggle
                  label="Show Net score"
                  description="The score after handicap strokes are subtracted"
                  checked={formData.display?.showNet ?? true}
                  onChange={(val) => setFormData({ ...formData, display: { ...formData.display, showNet: val } })}
                />
                {formData.display?.showGross && formData.display?.showNet && (
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Sort leaderboard by:</label>
                    <div className="flex gap-3">
                      {['net', 'gross'].map(sort => (
                        <label key={sort} className={`flex-1 text-center p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                          formData.display?.primarySort === sort
                            ? 'border-blue-500 bg-blue-50 font-semibold'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}>
                          <input
                            type="radio"
                            name="formPrimarySort"
                            value={sort}
                            checked={formData.display?.primarySort === sort}
                            onChange={() => setFormData({ ...formData, display: { ...formData.display, primarySort: sort } })}
                            className="sr-only"
                          />
                          {sort === 'net' ? 'Net Score' : 'Gross Score'}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <DisplayToggle
                  label="Highlight stroke holes"
                  description="Mark which holes get a handicap stroke"
                  checked={formData.display?.showStrokeHoles ?? true}
                  onChange={(val) => setFormData({ ...formData, display: { ...formData.display, showStrokeHoles: val } })}
                />
              </>
            )}

            {formData.handicap?.enabled && formData.handicap?.applicationMethod === 'mulligans' && (
              <>
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mulligan Display</p>
                </div>
                <DisplayToggle
                  label="Show mulligans remaining"
                  description="Display how many mulligans each team has left"
                  checked={formData.display?.showMulligansRemaining ?? true}
                  onChange={(val) => setFormData({ ...formData, display: { ...formData.display, showMulligansRemaining: val } })}
                />
              </>
            )}

            {(formData.scoringMethod === 'match_play' || formData.competition?.structure === 'round_robin') && (
              <>
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Match Play Display</p>
                </div>
                <DisplayToggle
                  label="Show match status"
                  description='Display "2 UP", "1 DOWN", "AS" (all square)'
                  checked={formData.display?.showMatchStatus ?? true}
                  onChange={(val) => setFormData({ ...formData, display: { ...formData.display, showMatchStatus: val } })}
                />
              </>
            )}

            {formData.competition?.structure === 'round_robin' && (
              <DisplayToggle
                label="Show round-robin results grid"
                description="Display the grid showing who played whom and point totals"
                checked={formData.display?.showRoundRobinGrid ?? true}
                onChange={(val) => setFormData({ ...formData, display: { ...formData.display, showRoundRobinGrid: val } })}
              />
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {showRoundOptions && (
        <RoundOptions
          numHoles={formData.numHoles || 18}
          startingHole={formData.startingHole || 1}
          onNumHolesChange={(n) => setFormData({ ...formData, numHoles: n })}
          onStartingHoleChange={(h) => setFormData({ ...formData, startingHole: h })}
        />
      )}

      {feedback && (
        <div className={`border-2 px-4 py-3 rounded-xl text-sm ${
          feedback.includes('Error') || feedback.includes('Please')
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          {feedback}
        </div>
      )}

      <button
        onClick={handleSubmit}
        className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 shadow-lg"
      >
        {submitLabel}
      </button>
    </div>
  );
}
