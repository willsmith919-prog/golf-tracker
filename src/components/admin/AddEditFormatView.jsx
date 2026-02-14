import { ref, set } from 'firebase/database';
import { database } from '../../firebase';

// ============================================================
// ADD/EDIT FORMAT VIEW — Form for creating or editing a format
// Mirrors the AddEditCourseView pattern.
// ============================================================

export default function AddEditFormatView({
  currentUser,
  formatForm,
  setFormatForm,
  editingFormat,
  setEditingFormat,
  feedback,
  setFeedback,
  setView,
  loadFormats
}) {
  const isEditing = !!editingFormat;

  // Combination methods that make sense for each team size
  const combinationOptions = {
    1: [
      { value: 'individual', label: 'Individual' }
    ],
    2: [
      { value: 'scramble', label: 'Scramble — Pick best shot, both play from there' },
      { value: 'shamble', label: 'Shamble — Pick best drive, play own ball from there' },
      { value: 'bestball', label: 'Best Ball — Each plays own ball, lower score counts' },
      { value: 'alternate_shot', label: 'Alternate Shot — Players take turns hitting' },
      { value: 'individual', label: 'Individual — Each player scored separately' }
    ],
    4: [
      { value: 'scramble', label: 'Scramble — Pick best shot, all play from there' },
      { value: 'bestball', label: 'Best Ball — Best score of the group counts' },
      { value: 'individual', label: 'Individual — Each player scored separately' }
    ]
  };

  const handleTeamSizeChange = (size) => {
    const newSize = parseInt(size);
    // Reset combination method when team size changes
    const defaultCombination = newSize === 1 ? 'individual' : 'scramble';
    setFormatForm({
      ...formatForm,
      teamSize: newSize,
      combinationMethod: defaultCombination
    });
  };

  const handleScoringMethodChange = (method) => {
    setFormatForm({
      ...formatForm,
      scoringMethod: method
    });
  };

  const handleStablefordChange = (key, value) => {
    setFormatForm({
      ...formatForm,
      stablefordPoints: {
        ...formatForm.stablefordPoints,
        [key]: parseInt(value) || 0
      }
    });
  };

  const handleSave = async () => {
    if (!formatForm.name.trim()) {
      setFeedback('Please enter a format name');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }

    try {
      const formatId = isEditing
        ? editingFormat.id
        : `format-${Date.now()}`;

      const formatData = {
        name: formatForm.name.trim(),
        description: formatForm.description.trim(),
        teamSize: formatForm.teamSize,
        scoringMethod: formatForm.scoringMethod,
        combinationMethod: formatForm.combinationMethod,
        handicap: {
          enabled: formatForm.handicapEnabled,
          allowance: formatForm.handicapAllowance
        },
        stablefordPoints: formatForm.scoringMethod === 'stableford'
          ? formatForm.stablefordPoints
          : null,
        createdBy: currentUser?.uid || null,
        createdAt: isEditing ? (editingFormat.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now()
      };

      await set(ref(database, `formats/${formatId}`), formatData);

      setFeedback(isEditing ? 'Format updated!' : 'Format created!');
      
      setTimeout(() => {
        setFeedback('');
        setEditingFormat(null);
        loadFormats();
        setView('manage-formats');
      }, 1000);

    } catch (error) {
      console.error('Error saving format:', error);
      setFeedback('Error saving format. Please try again.');
      setTimeout(() => setFeedback(''), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => {
            setEditingFormat(null);
            setView('manage-formats');
          }}
          className="text-white mb-6 hover:text-blue-200"
        >
          ← Back to Formats
        </button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Georgia, serif' }}>
            {isEditing ? 'Edit Format' : 'Create Format'}
          </h2>

          <div className="space-y-6">

            {/* Format Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Format Name
              </label>
              <input
                type="text"
                value={formatForm.name}
                onChange={(e) => setFormatForm({ ...formatForm, name: e.target.value })}
                placeholder="e.g., 2-Man Scramble - Net"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formatForm.description}
                onChange={(e) => setFormatForm({ ...formatForm, description: e.target.value })}
                placeholder="Briefly describe how this format works..."
                rows="3"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* Team Size */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Team Size
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 1, label: 'Individual' },
                  { value: 2, label: '2-Person' },
                  { value: 4, label: '4-Person' }
                ].map(option => (
                  <label
                    key={option.value}
                    className={`flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                      formatForm.teamSize === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="teamSize"
                      value={option.value}
                      checked={formatForm.teamSize === option.value}
                      onChange={(e) => handleTeamSizeChange(e.target.value)}
                      className="w-5 h-5 text-blue-600"
                    />
                    <span className="ml-3 text-gray-900 font-medium">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Scoring Method */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Scoring Method
              </label>
              <div className="space-y-3">
                {[
                  { value: 'stroke', label: 'Stroke Play', desc: 'Count total strokes. Lowest score wins.' },
                  { value: 'stableford', label: 'Stableford', desc: 'Points awarded based on score vs par. Highest points wins.' },
                  { value: 'match_play', label: 'Match Play', desc: 'Win individual holes. Most holes won wins the match.' }
                ].map(option => (
                  <label
                    key={option.value}
                    className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                      formatForm.scoringMethod === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scoringMethod"
                      value={option.value}
                      checked={formatForm.scoringMethod === option.value}
                      onChange={(e) => handleScoringMethodChange(e.target.value)}
                      className="w-5 h-5 text-blue-600 mt-0.5"
                    />
                    <div className="ml-3">
                      <div className="text-gray-900 font-medium">{option.label}</div>
                      <div className="text-sm text-gray-500">{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Stableford Point Values — only shown when stableford is selected */}
            {formatForm.scoringMethod === 'stableford' && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Stableford Point Values
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'albatross', label: 'Albatross (3 under)' },
                    { key: 'eagle', label: 'Eagle (2 under)' },
                    { key: 'birdie', label: 'Birdie (1 under)' },
                    { key: 'par', label: 'Par' },
                    { key: 'bogey', label: 'Bogey (1 over)' },
                    { key: 'doubleBogey', label: 'Double Bogey (2 over)' },
                    { key: 'worse', label: 'Triple+ (3+ over)' }
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{item.label}</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={formatForm.stablefordPoints[item.key] ?? 0}
                        onChange={(e) => handleStablefordChange(item.key, e.target.value)}
                        className="w-16 px-2 py-1 text-center rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Combination Method — only shown for team sizes > 1 */}
            {formatForm.teamSize > 1 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Score Combination Method
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  How are individual shots combined into a team score?
                </p>
                <div className="space-y-3">
                  {(combinationOptions[formatForm.teamSize] || []).map(option => (
                    <label
                      key={option.value}
                      className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        formatForm.combinationMethod === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="combinationMethod"
                        value={option.value}
                        checked={formatForm.combinationMethod === option.value}
                        onChange={(e) => setFormatForm({ ...formatForm, combinationMethod: e.target.value })}
                        className="w-5 h-5 text-blue-600"
                      />
                      <span className="ml-3 text-gray-900 text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Handicap Settings */}
            <div className="border-2 border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">
                  Handicap / Stroke Allowance
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formatForm.handicapEnabled}
                    onChange={(e) => setFormatForm({ ...formatForm, handicapEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {formatForm.handicapEnabled && (
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Handicap Allowance (% of player handicap to apply)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={formatForm.handicapAllowance}
                      onChange={(e) => setFormatForm({ ...formatForm, handicapAllowance: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-lg font-bold text-gray-900 w-16 text-center">
                      {formatForm.handicapAllowance}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Common: 100% for best ball, 35% for scramble, 80% for shamble
                  </p>
                </div>
              )}
            </div>

            {/* Feedback */}
            {feedback && (
              <div className="bg-blue-50 border-2 border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm">
                {feedback}
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 shadow-lg"
            >
              {isEditing ? 'Update Format' : 'Create Format'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
