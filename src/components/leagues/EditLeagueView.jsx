import { useState, useEffect } from 'react';
import { ref, update, get } from 'firebase/database';
import { database } from '../../firebase';

// Same suggested defaults as CreateLeagueView
const SUGGESTED_DEFAULTS = [25, 20, 16, 13, 10, 8, 6, 5, 4, 3, 2, 1];

export default function EditLeagueView({
  currentUser,
  currentLeague,
  setCurrentLeague,
  setView,
  feedback,
  setFeedback
}) {
  // Which section is active: 'league' or 'season'
  const [activeTab, setActiveTab] = useState('league');
  const [saving, setSaving] = useState(false);

  // Find the active season ID and data
  const activeSeasonId = Object.keys(currentLeague.seasons || {}).find(
    sid => currentLeague.seasons[sid].status === 'active'
  );
  const activeSeason = activeSeasonId ? currentLeague.seasons[activeSeasonId] : null;

  // --- League Info form state ---
  const [leagueName, setLeagueName] = useState(currentLeague.meta?.name || '');
  const [leagueDescription, setLeagueDescription] = useState(currentLeague.meta?.description || '');

  // --- Season Config form state ---
  const [seasonName, setSeasonName] = useState(activeSeason?.name || '');
  const [seasonStartDate, setSeasonStartDate] = useState(activeSeason?.startDate || '');
  const [seasonEndDate, setSeasonEndDate] = useState(activeSeason?.endDate || '');
  const [participationPoints, setParticipationPoints] = useState(
    activeSeason?.defaultPointsConfig?.participationPoints ?? 5
  );
  const [dropLowest, setDropLowest] = useState(activeSeason?.dropLowest ?? 0);
  const [pointPositions, setPointPositions] = useState(() => {
    // Load existing positions, or fall back to defaults
    const existing = activeSeason?.defaultPointsConfig?.positions;
    if (existing && Object.keys(existing).length > 0) {
      return { ...existing };
    }
    // Fallback: check old pointSystem location
    const oldSystem = activeSeason?.pointSystem;
    if (oldSystem && Object.keys(oldSystem).length > 0) {
      return { ...oldSystem };
    }
    // Last resort: suggested defaults
    const defaults = {};
    SUGGESTED_DEFAULTS.forEach((pts, i) => { defaults[i + 1] = pts; });
    return defaults;
  });

  // --- Ordinal helper ---
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // --- Position row helpers ---
  const addPositionRow = () => {
    const nextPlace = Object.keys(pointPositions).length + 1;
    const suggestedValue = SUGGESTED_DEFAULTS[nextPlace - 1] || 0;
    setPointPositions({ ...pointPositions, [nextPlace]: suggestedValue });
  };

  const removeLastPositionRow = () => {
    const keys = Object.keys(pointPositions);
    if (keys.length <= 1) return;
    const updated = { ...pointPositions };
    delete updated[keys.length];
    setPointPositions(updated);
  };

  const updatePositionPoints = (place, value) => {
    setPointPositions({ ...pointPositions, [place]: parseInt(value) || 0 });
  };

  // --- Save League Info ---
  const handleSaveLeagueInfo = async () => {
    if (!leagueName.trim()) {
      setFeedback('League name is required');
      return;
    }

    setSaving(true);
    try {
      await update(ref(database, `leagues/${currentLeague.id}/meta`), {
        name: leagueName.trim(),
        description: leagueDescription.trim()
      });

      // Refresh the currentLeague object so the dashboard reflects changes
      const snapshot = await get(ref(database, `leagues/${currentLeague.id}`));
      const updatedLeague = snapshot.val();
      setCurrentLeague({ id: currentLeague.id, ...updatedLeague, userRole: currentLeague.userRole });

      setFeedback('League info saved!');
      setTimeout(() => {
        setFeedback('');
        setView('league-dashboard');
      }, 1000);
    } catch (error) {
      console.error('Error saving league info:', error);
      setFeedback('Error saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // --- Save Season Config ---
  const handleSaveSeasonConfig = async () => {
    if (!activeSeasonId) {
      setFeedback('No active season found');
      return;
    }

    if (!seasonName.trim()) {
      setFeedback('Season name is required');
      return;
    }

    setSaving(true);
    try {
      const seasonPath = `leagues/${currentLeague.id}/seasons/${activeSeasonId}`;

      await update(ref(database, seasonPath), {
        name: seasonName.trim(),
        startDate: seasonStartDate || null,
        endDate: seasonEndDate || null,
        dropLowest: dropLowest,
        defaultPointsConfig: {
          positions: { ...pointPositions },
          participationPoints: participationPoints
        }
      });

      // Refresh the currentLeague object
      const snapshot = await get(ref(database, `leagues/${currentLeague.id}`));
      const updatedLeague = snapshot.val();
      setCurrentLeague({ id: currentLeague.id, ...updatedLeague, userRole: currentLeague.userRole });

      setFeedback('Season config saved!');
      setTimeout(() => {
        setFeedback('');
        setView('league-dashboard');
      }, 1000);
    } catch (error) {
      console.error('Error saving season config:', error);
      setFeedback('Error saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#00285e] p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setView('league-dashboard')}
          className="text-white mb-6 hover:text-[#c8d6e5]"
        >
          ← Back to Dashboard
        </button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">League Settings</h2>

          {/* Feedback */}
          {feedback && (
            <div className={`border-2 p-3 rounded-lg mb-4 text-sm ${
              feedback.includes('Error') || feedback.includes('required')
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              {feedback}
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex border-b-2 border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('league')}
              className={`flex-1 py-3 text-center font-semibold text-sm transition-colors ${
                activeTab === 'league'
                  ? 'text-[#00285e] border-b-2 border-[#003a7d] -mb-[2px]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              League Info
            </button>
            <button
              onClick={() => setActiveTab('season')}
              className={`flex-1 py-3 text-center font-semibold text-sm transition-colors ${
                activeTab === 'season'
                  ? 'text-[#00285e] border-b-2 border-[#003a7d] -mb-[2px]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Season Config
            </button>
          </div>

          {/* ===== LEAGUE INFO TAB ===== */}
          {activeTab === 'league' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">League Name</label>
                <input
                  type="text"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                  placeholder="Sunday Golf League"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  value={leagueDescription}
                  onChange={(e) => setLeagueDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                  placeholder="Weekly competitive league for golfers of all levels"
                  rows={3}
                />
              </div>

              <button
                onClick={handleSaveLeagueInfo}
                disabled={saving}
                className="w-full bg-[#00285e] text-white py-3 rounded-xl font-semibold hover:bg-[#003a7d] disabled:bg-gray-400 text-lg"
              >
                {saving ? 'Saving...' : 'Save League Info'}
              </button>
            </div>
          )}

          {/* ===== SEASON CONFIG TAB ===== */}
          {activeTab === 'season' && (
            <div className="space-y-6">

              {!activeSeason ? (
                <div className="text-center py-8 text-gray-500">
                  No active season found. Create a new season from the dashboard.
                </div>
              ) : (
                <>
                  {/* Season Name & Dates */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Season Name</label>
                      <input
                        type="text"
                        value={seasonName}
                        onChange={(e) => setSeasonName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                        placeholder="2026 Season"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                        <input
                          type="date"
                          value={seasonStartDate}
                          onChange={(e) => setSeasonStartDate(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                        <input
                          type="date"
                          value={seasonEndDate}
                          onChange={(e) => setSeasonEndDate(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Participation Points */}
                  <div className="bg-[#f0f4ff] p-4 rounded-xl">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Participation Points
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Flat points every player earns just for playing in an event, regardless of finish.
                    </p>
                    <input
                      type="number"
                      min="0"
                      value={participationPoints}
                      onChange={(e) => setParticipationPoints(parseInt(e.target.value) || 0)}
                      className="w-24 px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none text-center"
                    />
                  </div>

                  {/* Drop Lowest */}
                  <div className="bg-[#f0f4ff] p-4 rounded-xl">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Drop Lowest Scores
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      How many of a player's worst event results to exclude from final standings. Set to 0 to count all events.
                    </p>
                    <input
                      type="number"
                      min="0"
                      value={dropLowest}
                      onChange={(e) => setDropLowest(parseInt(e.target.value) || 0)}
                      className="w-24 px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none text-center"
                    />
                  </div>

                  {/* Point Positions */}
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Points by Finishing Position
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      These are the defaults that pre-fill when you create events. Each event can be customized.
                    </p>
                    <div className="space-y-2">
                      {Object.keys(pointPositions)
                        .sort((a, b) => Number(a) - Number(b))
                        .map((place) => (
                          <div key={place} className="flex items-center gap-3">
                            <div className="w-16 text-sm font-medium text-gray-600">
                              {ordinal(Number(place))}
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={pointPositions[place]}
                              onChange={(e) => updatePositionPoints(place, e.target.value)}
                              className="w-20 px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none text-center"
                            />
                            <span className="text-xs text-gray-400">pts</span>
                          </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                      <button
                        type="button"
                        onClick={addPositionRow}
                        className="text-[#00285e] hover:text-[#003a7d] text-sm font-semibold"
                      >
                        + Add Position
                      </button>
                      {Object.keys(pointPositions).length > 1 && (
                        <button
                          type="button"
                          onClick={removeLastPositionRow}
                          className="text-red-500 hover:text-red-600 text-sm font-semibold"
                        >
                          − Remove Last
                        </button>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {Object.keys(pointPositions).length} positions
                      </span>
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveSeasonConfig}
                    disabled={saving}
                    className="w-full bg-[#00285e] text-white py-3 rounded-xl font-semibold hover:bg-[#003a7d] disabled:bg-gray-400 text-lg"
                  >
                    {saving ? 'Saving...' : 'Save Season Config'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
