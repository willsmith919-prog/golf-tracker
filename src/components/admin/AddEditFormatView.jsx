import { ref, set } from 'firebase/database';
import { database } from '../../firebase';

// ============================================================
// ADD/EDIT FORMAT VIEW — Form for creating or editing a format
// 
// Sections:
//   1. Basics (name, description)
//   2. Team Size
//   3. Scoring Method (+ Stableford points)
//   4. Combination Method (for teams)
//   5. Handicap Settings (+ application method, mulligan config)
//   6. Competition Structure (full field, round robin, wolf)
//   7. Leaderboard Display
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

  // ==================== SAFE DEFAULTS FOR BACKWARD COMPATIBILITY ====================
  // When editing an old format that was created before the new fields existed,
  // some fields might be undefined. These defaults prevent crashes.
  // The "?? value" syntax means: "use this value if the left side is null or undefined"
  
  if (!formatForm.mulliganConversion) {
    formatForm.mulliganConversion = { strokesPerMulligan: 3, maxMulligans: 10, perHoleLimit: 1 };
  }
  if (!formatForm.roundRobin) {
    formatForm.roundRobin = {
      holesPerMatch: 6, pointsForWin: 1, pointsForTie: 0.5, pointsForLoss: 0,
      matchScoringMethod: 'match_play', autoGenerateMatchups: true
    };
  }
  if (!formatForm.wolf) {
    formatForm.wolf = { blindWolfBonus: 2, loneWolfBonus: 1, pointsPerHoleWon: 1, pointsPerHoleLost: 1 };
  }
  const handicapApplicationMethod = formatForm.handicapApplicationMethod ?? 'strokes';
  const competitionStructure = formatForm.competitionStructure ?? 'full_field';

  // Patch the form if these top-level fields are missing (old format being edited)
  if (formatForm.handicapApplicationMethod === undefined) {
    formatForm.handicapApplicationMethod = 'strokes';
  }
  if (formatForm.competitionStructure === undefined) {
    formatForm.competitionStructure = 'full_field';
  }

  // ==================== AUTO-GENERATED NAME & DESCRIPTION ====================
  // Builds a name like "2-Man Scramble - Stroke - HC: 35% Mulligans"
  // and a description summarizing the format settings.
  // These update live as the user changes settings.

  const generateName = () => {
    const parts = [];

    // Team size + combination (or competition structure if Wolf)
    if (formatForm.competitionStructure === 'wolf') {
      parts.push('Wolf');
    } else if (formatForm.teamSize === 1) {
      parts.push('Individual');
    } else {
      const comboLabels = {
        scramble: 'Scramble',
        shamble: 'Shamble',
        bestball: 'Best Ball',
        alternate_shot: 'Alternate Shot',
        individual: 'Individual'
      };
      parts.push(`${formatForm.teamSize}-Man ${comboLabels[formatForm.combinationMethod] || formatForm.combinationMethod}`);
    }

    // Scoring method (skip for stroke play since it's the default)
    if (formatForm.scoringMethod === 'stableford') {
      parts.push('Stableford');
    } else if (formatForm.scoringMethod === 'match_play') {
      parts.push('Match Play');
    }

    // Competition structure (skip full_field since it's the default)
    if (formatForm.competitionStructure === 'round_robin') {
      parts.push('Round Robin');
    }

    // Handicap
    if (formatForm.handicapEnabled) {
      const method = formatForm.handicapApplicationMethod;
      if (method === 'mulligans') {
        parts.push(`HC: ${formatForm.handicapAllowance}% Mulligans`);
      } else if (method === 'none') {
        parts.push('HC: Seeding Only');
      } else {
        // Only show "Net" for traditional strokes to keep it short
        parts.push('Net');
      }
    }

    return parts.join(' - ');
  };

  const generateDescription = () => {
    const lines = [];

    // Team/play style
    if (formatForm.competitionStructure === 'wolf') {
      lines.push('4-player Wolf format. Each hole, one player is the Wolf who picks a partner or goes alone.');
    } else if (formatForm.teamSize === 1) {
      lines.push('Individual play.');
    } else {
      const comboDescs = {
        scramble: `${formatForm.teamSize}-person teams. Pick the best shot each time, everyone plays from there.`,
        shamble: `${formatForm.teamSize}-person teams. Pick the best drive, then play your own ball.`,
        bestball: `${formatForm.teamSize}-person teams. Everyone plays their own ball, best score counts.`,
        alternate_shot: `${formatForm.teamSize}-person teams. Players alternate hitting the same ball.`,
        individual: `${formatForm.teamSize}-person groups. Each player scored individually.`
      };
      lines.push(comboDescs[formatForm.combinationMethod] || '');
    }

    // Scoring
    if (formatForm.scoringMethod === 'stableford') {
      lines.push('Stableford scoring (points based on score vs par).');
    } else if (formatForm.scoringMethod === 'match_play') {
      lines.push('Match play (win individual holes).');
    } else {
      lines.push('Stroke play (lowest total score wins).');
    }

    // Competition
    if (formatForm.competitionStructure === 'round_robin') {
      lines.push(`Round robin: teams play each other over ${formatForm.roundRobin.holesPerMatch}-hole matchups.`);
    }

    // Handicap
    if (formatForm.handicapEnabled) {
      if (formatForm.handicapApplicationMethod === 'mulligans') {
        lines.push(`Handicap as mulligans (${formatForm.handicapAllowance}% allowance, ${formatForm.mulliganConversion.strokesPerMulligan} strokes per mulligan).`);
      } else if (formatForm.handicapApplicationMethod === 'none') {
        lines.push('Handicap recorded for seeding only.');
      } else {
        lines.push(`${formatForm.handicapAllowance}% handicap applied as strokes on hardest-rated holes.`);
      }
    }

    return lines.join(' ');
  };

  // Track whether the user has manually edited the name/description.
  // If they haven't touched it (or it matches a previously generated value),
  // we keep auto-updating. If they've customized it, we leave it alone.
  const autoName = generateName();
  const autoDescription = generateDescription();

  // ==================== OPTION DEFINITIONS ====================

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
    3: [
      { value: 'scramble', label: 'Scramble — Pick best shot, all play from there' },
      { value: 'shamble', label: 'Shamble — Pick best drive, play own ball from there' },
      { value: 'bestball', label: 'Best Ball — Best score of the group counts' },
      { value: 'individual', label: 'Individual — Each player scored separately' }
    ],
    4: [
      { value: 'scramble', label: 'Scramble — Pick best shot, all play from there' },
      { value: 'bestball', label: 'Best Ball — Best score of the group counts' },
      { value: 'individual', label: 'Individual — Each player scored separately' }
    ]
  };

  // ==================== HANDLERS ====================

  const handleTeamSizeChange = (size) => {
    const newSize = parseInt(size);
    const defaultCombination = newSize === 1 ? 'individual' : 'scramble';
    
    // If switching away from 4-person and competition is wolf, reset it
    const newStructure = (formatForm.competitionStructure === 'wolf' && newSize !== 4)
      ? 'full_field'
      : formatForm.competitionStructure;

    setFormatForm({
      ...formatForm,
      teamSize: newSize,
      combinationMethod: defaultCombination,
      competitionStructure: newStructure
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

  const handleCompetitionStructureChange = (structure) => {
    const updates = { competitionStructure: structure };

    // Wolf requires 4 individual players
    if (structure === 'wolf') {
      updates.teamSize = 4;
      updates.combinationMethod = 'individual';
    }

    setFormatForm({ ...formatForm, ...updates });
  };

  const handleRoundRobinChange = (key, value) => {
    setFormatForm({
      ...formatForm,
      roundRobin: {
        ...formatForm.roundRobin,
        [key]: value
      }
    });
  };

  const handleWolfChange = (key, value) => {
    setFormatForm({
      ...formatForm,
      wolf: {
        ...formatForm.wolf,
        [key]: value
      }
    });
  };

  const handleMulliganChange = (key, value) => {
    setFormatForm({
      ...formatForm,
      mulliganConversion: {
        ...formatForm.mulliganConversion,
        [key]: value
      }
    });
  };

  // ==================== SAVE ====================

  const handleSave = async () => {
    // Use auto-generated name if the user left it blank
    const finalName = formatForm.name.trim() || autoName;
    const finalDescription = formatForm.description.trim() || autoDescription;

    if (!finalName) {
      setFeedback('Please enter a format name or configure settings to auto-generate one');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }

    try {
      const formatId = isEditing
        ? editingFormat.id
        : `format-${Date.now()}`;

      const formatData = {
        name: finalName,
        description: finalDescription,
        teamSize: formatForm.teamSize,
        scoringMethod: formatForm.scoringMethod,
        combinationMethod: formatForm.combinationMethod,

        // Handicap — expanded
        handicap: {
          enabled: formatForm.handicapEnabled,
          allowance: formatForm.handicapAllowance,
          applicationMethod: formatForm.handicapEnabled
            ? formatForm.handicapApplicationMethod
            : 'strokes',
          mulliganConversion: (formatForm.handicapEnabled && formatForm.handicapApplicationMethod === 'mulligans')
            ? formatForm.mulliganConversion
            : null
        },

        // Stableford points — only when stableford scoring
        stablefordPoints: formatForm.scoringMethod === 'stableford'
          ? formatForm.stablefordPoints
          : null,

        // Competition structure
        competition: {
          structure: formatForm.competitionStructure,
          roundRobin: formatForm.competitionStructure === 'round_robin'
            ? formatForm.roundRobin
            : null,
          wolf: formatForm.competitionStructure === 'wolf'
            ? formatForm.wolf
            : null
        },

        // Leaderboard display settings are configured per-event, not per-format.
        // See CreateEventView for display options.

        // Metadata
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

  // ==================== REUSABLE UI HELPERS ====================

  // A card-style radio option (used in several sections)
  const RadioCard = ({ name, value, checked, onChange, label, description, className = '' }) => (
    <label
      className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-colors ${
        checked
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:bg-gray-50'
      } ${className}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
      />
      <div className="ml-3">
        <div className="text-gray-900 font-medium">{label}</div>
        {description && <div className="text-sm text-gray-500 mt-0.5">{description}</div>}
      </div>
    </label>
  );

  // A toggle switch with label
  const ToggleSwitch = ({ label, checked, onChange, description }) => (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );

  // A small labeled number input
  const NumberInput = ({ label, value, onChange, min = 0, max = 99, step = 1, helpText }) => (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-24 px-3 py-2 text-center rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
      />
      {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
    </div>
  );

  // Section header with optional description
  const SectionHeader = ({ title, description }) => (
    <div className="mb-3">
      <label className="block text-sm font-semibold text-gray-700">{title}</label>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
  );

  // ==================== RENDER ====================

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

          <div className="space-y-8">

            {/* ========== SECTION 1: BASICS ========== */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Format Name
              </label>
              <input
                type="text"
                value={formatForm.name}
                onChange={(e) => setFormatForm({ ...formatForm, name: e.target.value })}
                placeholder={autoName || "e.g., 2-Man Scramble - Net"}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
              />
              {autoName && formatForm.name !== autoName && (
                <button
                  type="button"
                  onClick={() => setFormatForm({ ...formatForm, name: autoName })}
                  className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                >
                  Use suggested: "{autoName}"
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formatForm.description}
                onChange={(e) => setFormatForm({ ...formatForm, description: e.target.value })}
                placeholder={autoDescription || "Briefly describe how this format works..."}
                rows="3"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none resize-none"
              />
              {autoDescription && formatForm.description !== autoDescription && (
                <button
                  type="button"
                  onClick={() => setFormatForm({ ...formatForm, description: autoDescription })}
                  className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                >
                  Use suggested description
                </button>
              )}
            </div>

            {/* ========== SECTION 2: TEAM SIZE ========== */}
            <div>
              <SectionHeader title="Team Size" />
              <div className="grid grid-cols-4 gap-3">
                {[
                  { value: 1, label: 'Individual' },
                  { value: 2, label: '2-Person' },
                  { value: 3, label: '3-Person' },
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

              {/* Note when Wolf has locked team size */}
              {formatForm.competitionStructure === 'wolf' && (
                <p className="text-xs text-blue-600 mt-2">
                  Team size is set to 4-Person because Wolf requires exactly 4 players.
                </p>
              )}
            </div>

            {/* ========== SECTION 3: SCORING METHOD ========== */}
            <div>
              <SectionHeader title="Scoring Method" />
              <div className="space-y-3">
                {[
                  { value: 'stroke', label: 'Stroke Play', desc: 'Count total strokes. Lowest score wins.' },
                  { value: 'stableford', label: 'Stableford', desc: 'Points awarded based on score vs par. Highest points wins.' },
                  { value: 'match_play', label: 'Match Play', desc: 'Win individual holes. Most holes won wins the match.' }
                ].map(option => (
                  <RadioCard
                    key={option.value}
                    name="scoringMethod"
                    value={option.value}
                    checked={formatForm.scoringMethod === option.value}
                    onChange={(e) => handleScoringMethodChange(e.target.value)}
                    label={option.label}
                    description={option.desc}
                  />
                ))}
              </div>
            </div>

            {/* Stableford Point Values — only when stableford is selected */}
            {formatForm.scoringMethod === 'stableford' && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                <SectionHeader title="Stableford Point Values" />
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

            {/* ========== SECTION 4: COMBINATION METHOD ========== */}
            {formatForm.teamSize > 1 && (
              <div>
                <SectionHeader
                  title="Score Combination Method"
                  description="How are individual shots combined into a team score?"
                />
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

                {/* Note when Wolf has locked combination method */}
                {formatForm.competitionStructure === 'wolf' && (
                  <p className="text-xs text-blue-600 mt-2">
                    Combination method is set to Individual because Wolf scores each player separately.
                  </p>
                )}
              </div>
            )}

            {/* ========== SECTION 5: HANDICAP SETTINGS (EXPANDED) ========== */}
            <div className="border-2 border-gray-200 rounded-xl p-5">
              <ToggleSwitch
                label="Handicap / Stroke Allowance"
                checked={formatForm.handicapEnabled}
                onChange={(e) => setFormatForm({ ...formatForm, handicapEnabled: e.target.checked })}
              />

              {formatForm.handicapEnabled && (
                <div className="mt-5 space-y-5">

                  {/* Allowance slider */}
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

                  {/* Application Method — NEW */}
                  <div>
                    <SectionHeader
                      title="How Are Handicap Strokes Applied?"
                      description="Choose how the calculated handicap strokes are used during the round."
                    />
                    <div className="space-y-3">
                      <RadioCard
                        name="handicapApplicationMethod"
                        value="strokes"
                        checked={formatForm.handicapApplicationMethod === 'strokes'}
                        onChange={() => setFormatForm({ ...formatForm, handicapApplicationMethod: 'strokes' })}
                        label="Strokes (Traditional)"
                        description="Subtract strokes on the hardest-rated holes. If you 'get 6 strokes,' your score is reduced by 1 on the 6 hardest holes (based on the course's Stroke Index)."
                      />
                      <RadioCard
                        name="handicapApplicationMethod"
                        value="mulligans"
                        checked={formatForm.handicapApplicationMethod === 'mulligans'}
                        onChange={() => setFormatForm({ ...formatForm, handicapApplicationMethod: 'mulligans' })}
                        label="Mulligans (Do-Overs)"
                        description="Convert handicap strokes into mulligan shots. Instead of subtracting from your score, your team gets extra chances to re-hit a shot."
                      />
                      <RadioCard
                        name="handicapApplicationMethod"
                        value="none"
                        checked={formatForm.handicapApplicationMethod === 'none'}
                        onChange={() => setFormatForm({ ...formatForm, handicapApplicationMethod: 'none' })}
                        label="Seeding Only"
                        description="Handicap is recorded but not applied to scores. Useful for grouping players by skill level or determining tee order."
                      />
                    </div>
                  </div>

                  {/* Mulligan Settings — only when mulligans is selected */}
                  {formatForm.handicapApplicationMethod === 'mulligans' && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                      <SectionHeader
                        title="Mulligan Settings"
                        description="Configure how handicap strokes are converted to mulligans."
                      />
                      <div className="space-y-4">
                        <div>
                          <NumberInput
                            label="Handicap strokes per mulligan"
                            value={formatForm.mulliganConversion.strokesPerMulligan}
                            onChange={(e) => handleMulliganChange('strokesPerMulligan', parseInt(e.target.value) || 1)}
                            min={1}
                            max={10}
                            helpText="e.g., combined HC of 18 ÷ 3 = 6 mulligans"
                          />
                        </div>
                        <div>
                          <NumberInput
                            label="Max mulligans per team"
                            value={formatForm.mulliganConversion.maxMulligans}
                            onChange={(e) => handleMulliganChange('maxMulligans', parseInt(e.target.value) || 1)}
                            min={1}
                            max={30}
                            helpText="Cap so no team gets too many"
                          />
                        </div>
                        <div>
                          <NumberInput
                            label="Max mulligans per hole"
                            value={formatForm.mulliganConversion.perHoleLimit}
                            onChange={(e) => handleMulliganChange('perHoleLimit', parseInt(e.target.value) || 0)}
                            min={0}
                            max={5}
                            helpText="0 = no per-hole limit"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ========== SECTION 6: COMPETITION STRUCTURE (NEW) ========== */}
            <div>
              <SectionHeader
                title="Competition Structure"
                description="How do teams or players compete against each other?"
              />
              <div className="space-y-3">
                <RadioCard
                  name="competitionStructure"
                  value="full_field"
                  checked={formatForm.competitionStructure === 'full_field'}
                  onChange={() => handleCompetitionStructureChange('full_field')}
                  label="Full Field"
                  description="Standard leaderboard. All teams/players are ranked together. Best overall score wins."
                />
                <RadioCard
                  name="competitionStructure"
                  value="round_robin"
                  checked={formatForm.competitionStructure === 'round_robin'}
                  onChange={() => handleCompetitionStructureChange('round_robin')}
                  label="Round Robin"
                  description="Teams play against each other in mini-matches over groups of holes. Total points across all matchups determines the winner."
                />
                <RadioCard
                  name="competitionStructure"
                  value="wolf"
                  checked={formatForm.competitionStructure === 'wolf'}
                  onChange={() => handleCompetitionStructureChange('wolf')}
                  label="Wolf"
                  description="Exactly 4 players. Each hole, one player is the 'Wolf' who picks a partner (or goes alone for bonus points). The Wolf role rotates each hole."
                />
              </div>

              {/* Round Robin Settings */}
              {formatForm.competitionStructure === 'round_robin' && (
                <div className="mt-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
                  <SectionHeader
                    title="Round Robin Settings"
                    description="Configure how teams are matched up and how points are awarded."
                  />
                  <div className="space-y-4">
                    <div>
                      <NumberInput
                        label="Holes per matchup"
                        value={formatForm.roundRobin.holesPerMatch}
                        onChange={(e) => handleRoundRobinChange('holesPerMatch', parseInt(e.target.value) || 1)}
                        min={1}
                        max={18}
                        helpText="e.g., 4 teams playing 18 holes = 6 holes per matchup (3 matchups each)"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Points for win</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={formatForm.roundRobin.pointsForWin}
                          onChange={(e) => handleRoundRobinChange('pointsForWin', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-center rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Points for tie</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={formatForm.roundRobin.pointsForTie}
                          onChange={(e) => handleRoundRobinChange('pointsForTie', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-center rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Points for loss</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={formatForm.roundRobin.pointsForLoss}
                          onChange={(e) => handleRoundRobinChange('pointsForLoss', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-center rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">How is each matchup scored?</label>
                      <div className="space-y-2">
                        <RadioCard
                          name="matchScoringMethod"
                          value="match_play"
                          checked={formatForm.roundRobin.matchScoringMethod === 'match_play'}
                          onChange={() => handleRoundRobinChange('matchScoringMethod', 'match_play')}
                          label="Match Play"
                          description="Count holes won within each matchup"
                        />
                        <RadioCard
                          name="matchScoringMethod"
                          value="stroke"
                          checked={formatForm.roundRobin.matchScoringMethod === 'stroke'}
                          onChange={() => handleRoundRobinChange('matchScoringMethod', 'stroke')}
                          label="Stroke Play"
                          description="Compare total strokes for those holes"
                        />
                      </div>
                    </div>

                    <ToggleSwitch
                      label="Auto-generate matchup schedule"
                      description="Automatically create all team-vs-team pairings"
                      checked={formatForm.roundRobin.autoGenerateMatchups}
                      onChange={(e) => handleRoundRobinChange('autoGenerateMatchups', e.target.checked)}
                    />
                  </div>
                </div>
              )}

              {/* Wolf Settings */}
              {formatForm.competitionStructure === 'wolf' && (
                <div className="mt-4 bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                  <SectionHeader
                    title="Wolf Settings"
                    description="Configure point values for the Wolf format."
                  />
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <NumberInput
                        label="Blind Wolf bonus"
                        value={formatForm.wolf.blindWolfBonus}
                        onChange={(e) => handleWolfChange('blindWolfBonus', parseInt(e.target.value) || 0)}
                        min={0}
                        max={10}
                        helpText="Declared alone BEFORE seeing any tee shots"
                      />
                      <NumberInput
                        label="Lone Wolf bonus"
                        value={formatForm.wolf.loneWolfBonus}
                        onChange={(e) => handleWolfChange('loneWolfBonus', parseInt(e.target.value) || 0)}
                        min={0}
                        max={10}
                        helpText="Goes alone AFTER seeing tee shots"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <NumberInput
                        label="Points per hole won"
                        value={formatForm.wolf.pointsPerHoleWon}
                        onChange={(e) => handleWolfChange('pointsPerHoleWon', parseInt(e.target.value) || 0)}
                        min={0}
                        max={10}
                      />
                      <NumberInput
                        label="Points per hole lost"
                        value={formatForm.wolf.pointsPerHoleLost}
                        onChange={(e) => handleWolfChange('pointsPerHoleLost', parseInt(e.target.value) || 0)}
                        min={0}
                        max={10}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      In Wolf, the Wolf (with or without a partner) plays against the remaining players. 
                      Points swing both directions — winners gain and losers lose the same amount.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ========== FEEDBACK ========== */}
            {feedback && (
              <div className="bg-blue-50 border-2 border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm">
                {feedback}
              </div>
            )}

            {/* ========== SAVE BUTTON ========== */}
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
