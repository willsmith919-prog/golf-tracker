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
    teamSize: null,
    scoringMethod: null,
    combinationMethod: null,
    competition: null,
    handicap: null,
    category: null   // null = any, 'main_game', 'side_game', 'both'
  });

  const toggleFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key] === value ? null : value
    }));
  };

  const clearFilters = () => {
    setFilters({ teamSize: null, scoringMethod: null, combinationMethod: null, competition: null, handicap: null, category: null });
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
    if (filters.category !== null) {
      const cat = format.formatCategory || 'main_game';
      if (cat !== filters.category) return false;
    }
    return true;
  });

  const hasSideGameFormats = formats.some(f => f.formatCategory === 'side_game' || f.formatCategory === 'both');

  // Build chip options from what actually exists in the format list.
  // Side game formats have no teamSize/scoringMethod, so exclude them from
  // main-game filter chip generation to avoid blank/undefined buttons.
  const mainGameOnlyFormats = formats.filter(f => (f.formatCategory || 'main_game') !== 'side_game');
  const existingTeamSizes = [...new Set(mainGameOnlyFormats.map(f => f.teamSize))].filter(v => v != null).sort();
  const existingScoringMethods = [...new Set(mainGameOnlyFormats.map(f => f.scoringMethod))].filter(Boolean);
  const existingCombinations = [...new Set(mainGameOnlyFormats.filter(f => f.teamSize > 1).map(f => f.combinationMethod))].filter(Boolean);
  const existingCompetitions = [...new Set(mainGameOnlyFormats.map(f => f.competition?.structure || 'full_field'))];
  const hasHandicapFormats = mainGameOnlyFormats.some(f => f.handicap?.enabled);
  const hasNonHandicapFormats = mainGameOnlyFormats.some(f => !f.handicap?.enabled);

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
      formatCategory: format.formatCategory || 'main_game',
      sideGameType: format.sideGameType || 'skins',
      sideGameVariant: format.sideGameVariant || 'gross',
      sideGameCarryover: format.sideGameCarryover !== false,
      teamSize: format.teamSize || 2,
      scoringMethod: format.scoringMethod || 'stroke',
      combinationMethod: format.combinationMethod || 'scramble',
      handicapEnabled: format.handicap?.enabled || false,
      handicapAllowance: format.handicap?.allowance || 100,
      handicapApplicationMethod: format.handicap?.applicationMethod || 'strokes',
      teamHandicapMethod: format.handicap?.teamHandicapMethod || 'average',
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
      formatCategory: 'main_game',
      sideGameType: 'skins',
      sideGameVariant: 'gross',
      sideGameCarryover: true,
      teamSize: 2,
      scoringMethod: 'stroke',
      combinationMethod: 'scramble',
      handicapEnabled: false,
      handicapAllowance: 100,
      handicapApplicationMethod: 'strokes',
      teamHandicapMethod: 'average',
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
    <div className="min-h-screen bg-[#00285e] p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setView('home')}
          className="text-white mb-6 hover:text-[#c8d6e5]"
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
              className="bg-[#00285e] text-white px-4 py-2 rounded-xl hover:bg-[#003a7d] font-semibold"
            >
              + Add Format
            </button>
          </div>

          {feedback && (
            <div className="mb-4 bg-[#f0f4ff] border-2 border-[#dce8f5] text-[#007a78] px-4 py-3 rounded-xl text-sm">
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
                      <button onClick={clearFilters} className="text-xs text-[#00285e] hover:text-[#007a78]">
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
                            ? 'bg-[#00285e] text-white border-[#003a7d]'
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
                            ? 'bg-[#00285e] text-white border-[#003a7d]'
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
                            ? 'bg-[#00285e] text-white border-[#00285e]'
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

                    {/* Category chips */}
                    {hasSideGameFormats && (
                      <>
                        <button
                          onClick={() => toggleFilter('category', 'main_game')}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            filters.category === 'main_game'
                              ? 'bg-[#00285e] text-white border-[#00285e]'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          Main Game
                        </button>
                        <button
                          onClick={() => toggleFilter('category', 'side_game')}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            filters.category === 'side_game'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          Side Game
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
                        {/* Category badge — only shown for non-default categories */}
                        {format.formatCategory === 'side_game' && (
                          <span className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                            🎯 Side Game
                          </span>
                        )}
                        {format.formatCategory === 'both' && (
                          <span className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                            ⛳ Main + Side
                          </span>
                        )}

                        {/* Main game badges — skip for pure side games */}
                        {format.formatCategory !== 'side_game' && (
                          <>
                            <span className="inline-block bg-[#f0f4ff] text-[#007a78] text-xs font-semibold px-2.5 py-1 rounded-lg">
                              {teamSizeLabels[format.teamSize] || `${format.teamSize}-Person`}
                            </span>
                            <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                              {scoringMethodLabels[format.scoringMethod] || format.scoringMethod}
                            </span>
                            {format.teamSize > 1 && (
                              <span className="inline-block bg-[#f0f4ff] text-[#007a78] text-xs font-semibold px-2.5 py-1 rounded-lg">
                                {combinationLabels[format.combinationMethod] || format.combinationMethod}
                              </span>
                            )}
                            {format.handicap?.enabled && (
                              <span className="inline-block bg-orange-100 text-orange-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                                HC: {format.handicap.allowance}% {format.handicap.applicationMethod === 'mulligans' ? 'Mulligans' : format.handicap.applicationMethod === 'none' ? 'Seeding Only' : 'Strokes'}
                              </span>
                            )}
                            {competitionLabels[format.competition?.structure] && (
                              <span className="inline-block bg-[#f0f4ff] text-[#007a78] text-xs font-semibold px-2.5 py-1 rounded-lg">
                                {competitionLabels[format.competition.structure]}
                              </span>
                            )}
                          </>
                        )}

                        {/* Side game type badge */}
                        {format.sideGameType && (
                          <span className="inline-block bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-amber-200">
                            {format.sideGameType === 'skins' ? 'Skins' : format.sideGameType}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(format)}
                        className="text-[#00285e] hover:text-[#007a78] text-sm font-semibold"
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
