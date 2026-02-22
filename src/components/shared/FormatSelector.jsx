import { useState } from 'react';

// ============================================================
// FORMAT SELECTOR — Reusable format selection component
//
// Displays filter chips + a dropdown of all configured formats.
// When a format is selected, it calls onFormatChange with the
// full format object so the parent has all the config details.
//
// Filter chips only appear when there are enough formats to
// make filtering useful (more than 3 formats).
//
// Props:
//   formats           — array of format objects from Firebase
//   selectedFormatId  — currently selected format ID (or '')
//   onFormatChange    — callback: (formatId, formatData) => void
//   disabled          — optional, disables the dropdown
// ============================================================

export default function FormatSelector({
  formats = [],
  selectedFormatId = '',
  onFormatChange,
  disabled = false
}) {
  const [filters, setFilters] = useState({
    teamSize: null,
    scoringMethod: null,
    combinationMethod: null,
    competition: null,
    handicap: null
  });

  const toggleFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key] === value ? null : value
    }));
  };

  const clearFilters = () => {
    setFilters({ teamSize: null, scoringMethod: null, combinationMethod: null, competition: null, handicap: null });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== null);

  // Apply filters
  const filteredFormats = formats.filter(format => {
    if (filters.teamSize !== null && format.teamSize !== filters.teamSize) return false;
    if (filters.scoringMethod !== null && format.scoringMethod !== filters.scoringMethod) return false;
    if (filters.combinationMethod !== null && format.combinationMethod !== filters.combinationMethod) return false;
    if (filters.competition !== null) {
      const structure = format.competition?.structure || 'full_field';
      if (structure !== filters.competition) return false;
    }
    if (filters.handicap === 'enabled' && !format.handicap?.enabled) return false;
    if (filters.handicap === 'disabled' && format.handicap?.enabled) return false;
    return true;
  });

  // Build chip options from what exists in the full format list
  const existingTeamSizes = [...new Set(formats.map(f => f.teamSize))].sort();
  const existingScoringMethods = [...new Set(formats.map(f => f.scoringMethod))];
  const existingCombinations = [...new Set(formats.filter(f => f.teamSize > 1).map(f => f.combinationMethod))];
  const existingCompetitions = [...new Set(formats.map(f => f.competition?.structure || 'full_field'))];
  const hasHandicapFormats = formats.some(f => f.handicap?.enabled);
  const hasNonHandicapFormats = formats.some(f => !f.handicap?.enabled);

  // Label maps
  const teamSizeLabels = { 1: 'Individual', 2: '2-Person', 3: '3-Person', 4: '4-Person' };
  const scoringMethodLabels = { stroke: 'Stroke', stableford: 'Stableford', match_play: 'Match Play' };
  const combinationLabels = { scramble: 'Scramble', shamble: 'Shamble', bestball: 'Best Ball', alternate_shot: 'Alt Shot', individual: 'Individual' };
  const competitionLabels = { full_field: 'Full Field', round_robin: 'Round Robin', wolf: 'Wolf' };

  // Sort and group filtered formats
  const sortedFormats = [...filteredFormats].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
  const individualFormats = sortedFormats.filter(f => f.teamSize === 1);
  const teamFormats = sortedFormats.filter(f => f.teamSize > 1);

  const selectedFormat = formats.find(f => f.id === selectedFormatId) || null;

  // Only show filter chips when there are enough formats to warrant it
  const showFilters = formats.length > 3;

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Format
      </label>

      {/* Filter Chips */}
      {showFilters && (
        <div className="mb-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Filter formats</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800">
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {/* Team Size */}
            {existingTeamSizes.length > 1 && existingTeamSizes.map(size => (
              <button
                key={`ts-${size}`}
                onClick={() => toggleFilter('teamSize', size)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filters.teamSize === size
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {teamSizeLabels[size] || `${size}P`}
              </button>
            ))}

            {/* Scoring Method */}
            {existingScoringMethods.length > 1 && existingScoringMethods.map(method => (
              <button
                key={`sm-${method}`}
                onClick={() => toggleFilter('scoringMethod', method)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filters.scoringMethod === method
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {scoringMethodLabels[method] || method}
              </button>
            ))}

            {/* Combination Method */}
            {existingCombinations.length > 1 && existingCombinations.map(combo => (
              <button
                key={`cm-${combo}`}
                onClick={() => toggleFilter('combinationMethod', combo)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filters.combinationMethod === combo
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {combinationLabels[combo] || combo}
              </button>
            ))}

            {/* Competition Structure */}
            {existingCompetitions.length > 1 && existingCompetitions.map(comp => (
              <button
                key={`comp-${comp}`}
                onClick={() => toggleFilter('competition', comp)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filters.competition === comp
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {competitionLabels[comp] || comp}
              </button>
            ))}

            {/* Handicap */}
            {hasHandicapFormats && hasNonHandicapFormats && (
              <>
                <button
                  onClick={() => toggleFilter('handicap', 'enabled')}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    filters.handicap === 'enabled'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  HC
                </button>
                <button
                  onClick={() => toggleFilter('handicap', 'disabled')}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    filters.handicap === 'disabled'
                      ? 'bg-gray-600 text-white border-gray-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  No HC
                </button>
              </>
            )}
          </div>
          {hasActiveFilters && (
            <p className="text-xs text-gray-500">
              {filteredFormats.length} of {formats.length} formats
            </p>
          )}
        </div>
      )}

      {/* Dropdown */}
      <select
        value={selectedFormatId}
        onChange={(e) => {
          const formatId = e.target.value;
          const formatData = formats.find(f => f.id === formatId) || null;
          onFormatChange(formatId, formatData);
        }}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">
          {hasActiveFilters
            ? `Select a format (${filteredFormats.length} shown)`
            : 'Select a format'}
        </option>
        
        {teamFormats.length > 0 && (
          <optgroup label="Team Formats">
            {teamFormats.map(format => (
              <option key={format.id} value={format.id}>
                {format.name}
              </option>
            ))}
          </optgroup>
        )}

        {individualFormats.length > 0 && (
          <optgroup label="Individual Formats">
            {individualFormats.map(format => (
              <option key={format.id} value={format.id}>
                {format.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {/* Show description of selected format */}
      {selectedFormat && (
        <p className="text-sm text-gray-600 mt-2">{selectedFormat.description}</p>
      )}
    </div>
  );
}
