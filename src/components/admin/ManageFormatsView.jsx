import { useState } from 'react';
import { ref, remove } from 'firebase/database';
import { database } from '../../firebase';

// ============================================================
// MANAGE FORMATS VIEW — List all formats with edit/delete
// Includes filter chips to narrow down the format list.
// ============================================================

export default function ManageFormatsView({
  formats,
  feedback,
  setFeedback,
  setView,
  setFormatForm,
  setEditingFormat,
  loadFormats
}) {
  // ==================== FILTER STATE ====================
  const [filters, setFilters] = useState({
    teamSize: null,        // null = any, or 1/2/3/4
    scoringMethod: null,   // null = any, or 'stroke'/'stableford'/'match_play'
    combinationMethod: null, // null = any, or 'scramble'/'shamble'/etc.
    competition: null,     // null = any, or 'full_field'/'round_robin'/'wolf'
    handicap: null         // null = any, 'enabled', or 'disabled'
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

  // Apply filters to the format list
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

  // Build chip options from what actually exists in the format list
  // (so we only show filter options that would match at least one format)
  const existingTeamSizes = [...new Set(formats.map(f => f.teamSize))].sort();
  const existingScoringMethods = [...new Set(formats.map(f => f.scoringMethod))];
  const existingCombinations = [...new Set(formats.filter(f => f.teamSize > 1).map(f => f.combinationMethod))];
  const existingCompetitions = [...new Set(formats.map(f => f.competition?.structure || 'full_field'))];
  const hasHandicapFormats = formats.some(f => f.handicap?.enabled);
  const hasNonHandicapFormats = formats.some(f => !f.handicap?.enabled);

  // ==================== LABEL MAPS ====================
  // ==================== LABEL MAPS ====================
  const teamSizeLabels = {
    1: 'Individual',
    2: '2-Person Team',
    3: '3-Person Team',
    4: '4-Person Team'
  };

  const scoringMethodLabels = {
    stroke: 'Stroke Play',
    stableford: 'Stableford',
    match_play: 'Match Play'
  };

  const combinationLabels = {
    individual: 'Individual',
    scramble: 'Scramble',
    shamble: 'Shamble',
    bestball: 'Best Ball',
    alternate_shot: 'Alternate Shot'
  };

  const competitionLabels = {
    full_field: null,  // Don't show a badge for the default
    round_robin: 'Round Robin',
    wolf: 'Wolf'
  };

  const applicationMethodLabels = {
    strokes: null,  // Don't show a badge for the default
    mulligans: 'Mulligans',
    none: 'HC: Seeding Only'
  };

  const handleEdit = (format) => {
    setEditingFormat(format);
    setFormatForm({
      name: format.name || '',
      description: format.description || '',
      teamSize: format.teamSize || 2,
      scoringMethod: format.scoringMethod || 'stroke',
      combinationMethod: format.combinationMethod || 'scramble',
      handicapEnabled: format.handicap?.enabled || false,
      handicapAllowance: format.handicap?.allowance || 100,
      handicapApplicationMethod: format.handicap?.applicationMethod || 'strokes',
      mulliganConversion: format.handicap?.mulliganConversion || {
        strokesPerMulligan: 3,
        maxMulligans: 10,
        perHoleLimit: 1
      },
      stablefordPoints: format.stablefordPoints || {
        albatross: 5,
        eagle: 4,
        birdie: 3,
        par: 2,
        bogey: 1,
        doubleBogey: 0,
        worse: 0
      },
      competitionStructure: format.competition?.structure || 'full_field',
      roundRobin: format.competition?.roundRobin || {
        holesPerMatch: 6,
        pointsForWin: 1,
        pointsForTie: 0.5,
        pointsForLoss: 0,
        matchScoringMethod: 'match_play',
        autoGenerateMatchups: true
      },
      wolf: format.competition?.wolf || {
        blindWolfBonus: 2,
        loneWolfBonus: 1,
        pointsPerHoleWon: 1,
        pointsPerHoleLost: 1
      }
    });
    setView('add-edit-format');
  };

  const handleDelete = async (format) => {
    if (!confirm(`Delete "${format.name}"? This cannot be undone.`)) return;

    try {
      await remove(ref(database, `formats/${format.id}`));
      setFeedback(`Deleted "${format.name}"`);
      setTimeout(() => setFeedback(''), 2000);
      loadFormats();
    } catch (error) {
      console.error('Error deleting format:', error);
      setFeedback('Error deleting format');
      setTimeout(() => setFeedback(''), 2000);
    }
  };

  const handleAdd = () => {
    setEditingFormat(null);
    setFormatForm({
      name: '',
      description: '',
      teamSize: 2,
      scoringMethod: 'stroke',
      combinationMethod: 'scramble',
      handicapEnabled: false,
      handicapAllowance: 100,
      handicapApplicationMethod: 'strokes',
      mulliganConversion: {
        strokesPerMulligan: 3,
        maxMulligans: 10,
        perHoleLimit: 1
      },
      stablefordPoints: {
        albatross: 5,
        eagle: 4,
        birdie: 3,
        par: 2,
        bogey: 1,
        doubleBogey: 0,
        worse: 0
      },
      competitionStructure: 'full_field',
      roundRobin: {
        holesPerMatch: 6,
        pointsForWin: 1,
        pointsForTie: 0.5,
        pointsForLoss: 0,
        matchScoringMethod: 'match_play',
        autoGenerateMatchups: true
      },
      wolf: {
        blindWolfBonus: 2,
        loneWolfBonus: 1,
        pointsPerHoleWon: 1,
        pointsPerHoleLost: 1
      }
    });
    setView('add-edit-format');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setView('home')}
          className="text-white mb-6 hover:text-blue-200"
        >
          ← Back
        </button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
              Manage Formats
            </h2>
            <button
              onClick={handleAdd}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 font-semibold"
            >
              + Add Format
            </button>
          </div>

          {feedback && (
            <div className="mb-4 bg-blue-50 border-2 border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm">
              {feedback}
            </div>
          )}

          {formats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No formats yet. Click "+ Add Format" to create one.
            </p>
          ) : (
            <>
              {/* Filter Chips */}
              {formats.length > 1 && (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter</span>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800">
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* Team Size chips */}
                    {existingTeamSizes.length > 1 && existingTeamSizes.map(size => (
                      <button
                        key={`ts-${size}`}
                        onClick={() => toggleFilter('teamSize', size)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          filters.teamSize === size
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {teamSizeLabels[size] || `${size}-Person`}
                      </button>
                    ))}

                    {/* Scoring Method chips */}
                    {existingScoringMethods.length > 1 && existingScoringMethods.map(method => (
                      <button
                        key={`sm-${method}`}
                        onClick={() => toggleFilter('scoringMethod', method)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          filters.scoringMethod === method
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {scoringMethodLabels[method] || method}
                      </button>
                    ))}

                    {/* Combination Method chips */}
                    {existingCombinations.length > 1 && existingCombinations.map(combo => (
                      <button
                        key={`cm-${combo}`}
                        onClick={() => toggleFilter('combinationMethod', combo)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          filters.combinationMethod === combo
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {combinationLabels[combo] || combo}
                      </button>
                    ))}

                    {/* Competition Structure chips */}
                    {existingCompetitions.length > 1 && existingCompetitions.map(comp => (
                      <button
                        key={`comp-${comp}`}
                        onClick={() => toggleFilter('competition', comp)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          filters.competition === comp
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {competitionLabels[comp] || 'Full Field'}
                      </button>
                    ))}

                    {/* Handicap chips */}
                    {hasHandicapFormats && hasNonHandicapFormats && (
                      <>
                        <button
                          onClick={() => toggleFilter('handicap', 'enabled')}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            filters.handicap === 'enabled'
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          Handicap
                        </button>
                        <button
                          onClick={() => toggleFilter('handicap', 'disabled')}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            filters.handicap === 'disabled'
                              ? 'bg-gray-600 text-white border-gray-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          No Handicap
                        </button>
                      </>
                    )}
                  </div>
                  {hasActiveFilters && (
                    <p className="text-xs text-gray-500">
                      Showing {filteredFormats.length} of {formats.length} formats
                    </p>
                  )}
                </div>
              )}

              {/* Format List */}
              {filteredFormats.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No formats match the current filters.
                </p>
              ) : (
              <div className="space-y-4">
              {filteredFormats.map(format => (
                <div key={format.id} className="border-2 border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{format.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{format.description}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                          {teamSizeLabels[format.teamSize] || `${format.teamSize}-Person`}
                        </span>
                        <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                          {scoringMethodLabels[format.scoringMethod] || format.scoringMethod}
                        </span>
                        {format.teamSize > 1 && (
                          <span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                            {combinationLabels[format.combinationMethod] || format.combinationMethod}
                          </span>
                        )}
                        {format.handicap?.enabled && (
                          <span className="inline-block bg-orange-100 text-orange-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                            HC: {format.handicap.allowance}% {format.handicap.applicationMethod === 'mulligans' ? 'Mulligans' : format.handicap.applicationMethod === 'none' ? 'Seeding Only' : 'Strokes'}
                          </span>
                        )}
                        {competitionLabels[format.competition?.structure] && (
                          <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                            {competitionLabels[format.competition.structure]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(format)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(format)}
                        className="text-red-600 hover:text-red-800 text-sm font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
