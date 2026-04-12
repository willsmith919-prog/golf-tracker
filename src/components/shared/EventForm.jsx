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
  preFillEvent = null,
  leaguePointsConfig = null
}) {
  const mergedData = { ...initialData, ...(preFillEvent || {}) };

  // Build the initial league points config from the league's defaults (if creating from a league)
  // or from the existing event data (if editing). Preserves teamPointDistribution if already set.
  const initialLeaguePoints = leaguePointsConfig
    ? {
        enabled: true,
        positions: { ...(leaguePointsConfig.positions || {}) },
        participationPoints: leaguePointsConfig.participationPoints ?? 5,
        teamPointDistribution: leaguePointsConfig.teamPointDistribution || 'full',
        nonLeagueHandling: leaguePointsConfig.nonLeagueHandling || 'skip'
      }
    : null;
  
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
      },
      leaguePoints: initialLeaguePoints
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

    const baseHandicap = formatData?.handicap || { enabled: false, allowance: 100 };
    setFormData({
      ...formData,
      formatId: formatId,
      format: formatData?.combinationMethod || 'scramble',
      scoringMethod: scoringMethod,
      teamSize: formatData?.teamSize || 2,
      formatName: formatData?.name || '',
      handicap: { ...baseHandicap, useSlope: baseHandicap.useSlope ?? true },
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
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00285e]"></div>
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
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
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
                            ? 'border-[#00285e] bg-[#f0f4ff] font-semibold'
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
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Handicap Calculation</p>
                </div>
                <DisplayToggle
                  label="Adjust handicaps for this course"
                  description="Uses slope & course rating to fine-tune strokes. Turn off for casual rounds where players just use their stated handicap."
                  checked={formData.handicap?.useSlope ?? true}
                  onChange={(val) => setFormData({ ...formData, handicap: { ...formData.handicap, useSlope: val } })}
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

      {/* ===== LEAGUE POINTS — only shown when creating from a league ===== */}
      {formData.leaguePoints && (
        <div className="border-2 border-[#dce8f5] bg-[#f0f4ff] rounded-xl p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1">🏆 League Points</label>
          <p className="text-sm text-gray-500 mb-4">
            Points awarded to players based on finishing position. Pre-filled from league defaults — adjust for this event if needed.
          </p>

          {/* Point Positions */}
          <div className="bg-white rounded-lg p-4 mb-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Points by Finishing Position</div>
            <div className="space-y-2">
              {Object.keys(formData.leaguePoints.positions)
                .sort((a, b) => Number(a) - Number(b))
                .map((place) => {
                  const n = Number(place);
                  const s = ['th', 'st', 'nd', 'rd'];
                  const v = n % 100;
                  const ord = n + (s[(v - 20) % 10] || s[v] || s[0]);
                  return (
                    <div key={place} className="flex items-center gap-3">
                      <div className="w-16 text-sm font-medium text-gray-600">{ord}</div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.leaguePoints.positions[place]}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          const updated = { ...formData.leaguePoints.positions, [place]: val === '' ? 0 : parseInt(val) };
                          setFormData({ ...formData, leaguePoints: { ...formData.leaguePoints, positions: updated } });
                        }}
                        className="w-20 px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none text-center"
                      />
                      <span className="text-xs text-gray-400">pts</span>
                    </div>
                  );
                })}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => {
                  const positions = formData.leaguePoints.positions;
                  const nextPlace = Object.keys(positions).length + 1;
                  const updated = { ...positions, [nextPlace]: 0 };
                  setFormData({ ...formData, leaguePoints: { ...formData.leaguePoints, positions: updated } });
                }}
                className="text-[#00285e] hover:text-[#00285e] text-sm font-semibold"
              >
                + Add Position
              </button>
              {Object.keys(formData.leaguePoints.positions).length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const positions = { ...formData.leaguePoints.positions };
                    delete positions[Object.keys(positions).length];
                    setFormData({ ...formData, leaguePoints: { ...formData.leaguePoints, positions } });
                  }}
                  className="text-red-500 hover:text-red-600 text-sm font-semibold"
                >
                  − Remove Last
                </button>
              )}
            </div>
          </div>

          {/* Participation Points */}
          <div className="bg-white rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">Participation Points</div>
                <div className="text-xs text-gray-500">Flat points every player earns just for playing</div>
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.leaguePoints.participationPoints}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setFormData({
                    ...formData,
                    leaguePoints: { ...formData.leaguePoints, participationPoints: val === '' ? 0 : parseInt(val) }
                  });
                }}
                className="w-20 px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none text-center"
              />
            </div>
          </div>

          {/* Team Point Distribution — only shown when format has teamSize > 1 */}
          {formData.teamSize > 1 && (
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 mb-1">Team Point Distribution</div>
              <p className="text-xs text-gray-500 mb-3">
                When a team finishes in a given place, how are the league points distributed to individual members?
              </p>
              <div className="flex gap-3">
                {[
                  { value: 'full', label: 'Full Points Each', desc: `Each member gets all ${Object.values(formData.leaguePoints.positions)[0] || 0} pts for 1st` },
                  { value: 'split', label: 'Split Evenly', desc: `Each member gets ${Math.round((Object.values(formData.leaguePoints.positions)[0] || 0) / (formData.teamSize || 2) * 10) / 10} pts for 1st` }
                ].map(option => (
                  <label
                    key={option.value}
                    className={`flex-1 p-3 rounded-xl border-2 cursor-pointer transition-colors text-center ${
                      formData.leaguePoints.teamPointDistribution === option.value
                        ? 'border-[#00285e] bg-[#f0f4ff] font-semibold'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="teamPointDist"
                      value={option.value}
                      checked={formData.leaguePoints.teamPointDistribution === option.value}
                      onChange={() => setFormData({
                        ...formData,
                        leaguePoints: { ...formData.leaguePoints, teamPointDistribution: option.value }
                      })}
                      className="sr-only"
                    />
                    <div className="text-sm">{option.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{option.desc}</div>
                  </label>
                ))}
              </div>
              {/* Non-League Player Handling */}
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm font-medium text-gray-700 mb-1">Non-League Player Handling</div>
            <p className="text-xs text-gray-500 mb-3">
              When a guest or non-league member finishes in a scoring position, how should the points be handled?
            </p>
            <div className="flex gap-3">
              {[
                { value: 'skip', label: 'Skip Position', desc: 'Non-league finishes 3rd → nobody gets 3rd place points' },
                { value: 'award_around', label: 'Award Around', desc: 'Non-league finishes 3rd → next league member gets 3rd place points' }
              ].map(option => (
                <label
                  key={option.value}
                  className={`flex-1 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    formData.leaguePoints.nonLeagueHandling === option.value
                      ? 'border-[#00285e] bg-[#f0f4ff] font-semibold'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="nonLeagueHandling"
                    value={option.value}
                    checked={formData.leaguePoints.nonLeagueHandling === option.value}
                    onChange={() => setFormData({
                      ...formData,
                      leaguePoints: { ...formData.leaguePoints, nonLeagueHandling: option.value }
                    })}
                    className="sr-only"
                  />
                  <div className="text-sm">{option.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{option.desc}</div>
                </label>
              ))}
            </div>
          </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
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
        className="w-full bg-[#00285e] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#003a7d] shadow-lg"
      >
        {submitLabel}
      </button>
    </div>
  );
}
