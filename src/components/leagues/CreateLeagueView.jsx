import { useState } from 'react';
import { ref, set } from 'firebase/database';
import { createCode } from '../../utils/codes';
import { database } from '../../firebase';

// Suggested default point values for up to 16 positions
const SUGGESTED_DEFAULTS = [25, 20, 16, 13, 10, 8, 6, 5, 4, 3, 2, 1];

export default function CreateLeagueView({
  currentUser,
  userProfile,
  newLeague,
  setNewLeague,
  feedback,
  setFeedback,
  setView,
  setCurrentLeague,
  setUserLeagues,
  loadUserLeagues
}) {
  const [showPointsConfig, setShowPointsConfig] = useState(false);

  // --- Helpers for dynamic point position rows ---

  const addPositionRow = () => {
    const positions = { ...newLeague.pointSystem };
    const nextPlace = Object.keys(positions).length + 1;
    // Use the suggested default if we have one, otherwise 0
    const suggestedValue = SUGGESTED_DEFAULTS[nextPlace - 1] || 0;
    positions[nextPlace] = suggestedValue;
    setNewLeague({ ...newLeague, pointSystem: positions });
  };

  const removeLastPositionRow = () => {
    const positions = { ...newLeague.pointSystem };
    const keys = Object.keys(positions);
    if (keys.length <= 1) return; // always keep at least 1st place
    delete positions[keys.length];
    setNewLeague({ ...newLeague, pointSystem: positions });
  };

  const updatePositionPoints = (place, value) => {
    setNewLeague({
      ...newLeague,
      pointSystem: { ...newLeague.pointSystem, [place]: parseInt(value) || 0 }
    });
  };

  // --- Ordinal suffix helper (1st, 2nd, 3rd, 4th...) ---
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // --- Form submission ---
  const handleCreateLeague = async (e) => {
    e.preventDefault();
    setFeedback('');

    if (!newLeague.name.trim()) {
      setFeedback('Please enter a league name');
      return;
    }

    if (!newLeague.seasonName.trim()) {
      setFeedback('Please enter a season name');
      return;
    }

    if (!userProfile) {
      setFeedback('User profile not loaded. Please try again.');
      return;
    }

    try {
      const leagueId = 'league-' + Date.now();
      const seasonId = 'season-' + Date.now();
      const code = await createCode('league', leagueId);

      const leagueData = {
        meta: {
          name: newLeague.name.trim(),
          code: code,
          commissionerId: currentUser.uid,
          description: newLeague.description.trim(),
          createdAt: Date.now()
        },
        members: {
          [currentUser.uid]: {
            displayName: userProfile?.profile?.displayName || userProfile?.displayName || currentUser.email || 'Unknown',
            role: 'commissioner',
            handicap: userProfile?.profile?.handicap || userProfile?.handicap || null,
            joinedAt: Date.now()
          }
        },
        seasons: {
          [seasonId]: {
            name: newLeague.seasonName.trim(),
            status: 'active',
            startDate: newLeague.seasonStartDate || null,
            endDate: newLeague.seasonEndDate || null,
            defaultPointsConfig: {
              positions: { ...newLeague.pointSystem },
              participationPoints: newLeague.participationPoints
            },
            dropLowest: newLeague.dropLowest,
            events: [],
            standings: {}
          }
        }
      };

      // Write league to Firebase
      await set(ref(database, `leagues/${leagueId}`), leagueData);

      // Write membership to user's profile
      await set(ref(database, `users/${currentUser.uid}/leagueMemberships/${leagueId}`), {
        role: 'commissioner',
        joinedAt: Date.now()
      });

      // Refresh leagues list and navigate to dashboard
      const leagues = await loadUserLeagues(currentUser.uid);
      setUserLeagues(leagues);
      setCurrentLeague({ id: leagueId, ...leagueData, userRole: 'commissioner' });

      setFeedback(`League created! Code: ${code}`);
      setTimeout(() => {
        setView('league-dashboard');
        setFeedback('');
      }, 1500);

    } catch (error) {
      console.error('Error creating league:', error);
      setFeedback('Error creating league. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-[#c8d6e5]">
          ← Back
        </button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Create League</h2>

          {feedback && (
            <div className={`border-2 p-3 rounded-lg mb-4 text-sm ${
              feedback.includes('Error') || feedback.includes('required') || feedback.includes('Please')
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              {feedback}
            </div>
          )}

          <form onSubmit={handleCreateLeague} className="space-y-6">

            {/* ===== LEAGUE INFO ===== */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">League Name</label>
              <input
                type="text"
                value={newLeague.name}
                onChange={(e) => setNewLeague({ ...newLeague, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                placeholder="Sunday Golf League"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description (Optional)</label>
              <textarea
                value={newLeague.description}
                onChange={(e) => setNewLeague({ ...newLeague, description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                placeholder="Weekly competitive league for golfers of all levels"
                rows={3}
              />
            </div>

            {/* ===== SEASON INFO ===== */}
            <div className="border-t-2 border-gray-100 pt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">First Season</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Season Name</label>
                  <input
                    type="text"
                    value={newLeague.seasonName}
                    onChange={(e) => setNewLeague({ ...newLeague, seasonName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                    placeholder="2026 Season"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={newLeague.seasonStartDate}
                      onChange={(e) => setNewLeague({ ...newLeague, seasonStartDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={newLeague.seasonEndDate}
                      onChange={(e) => setNewLeague({ ...newLeague, seasonEndDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ===== POINTS CONFIG ===== */}
            <div className="border-t-2 border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Default Points Config</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    These defaults will pre-fill when you create events. You can adjust per event.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPointsConfig(!showPointsConfig)}
                  className="text-[#00285e] hover:text-[#003a7d] text-sm font-semibold"
                >
                  {showPointsConfig ? 'Collapse' : 'Expand'}
                </button>
              </div>

              {showPointsConfig && (
                <div className="space-y-4">

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
                      value={newLeague.participationPoints}
                      onChange={(e) => setNewLeague({ ...newLeague, participationPoints: parseInt(e.target.value) || 0 })}
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
                      value={newLeague.dropLowest}
                      onChange={(e) => setNewLeague({ ...newLeague, dropLowest: parseInt(e.target.value) || 0 })}
                      className="w-24 px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none text-center"
                    />
                  </div>

                  {/* Position Points */}
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Points by Finishing Position
                    </label>
                    <div className="space-y-2">
                      {Object.keys(newLeague.pointSystem)
                        .sort((a, b) => Number(a) - Number(b))
                        .map((place) => (
                          <div key={place} className="flex items-center gap-3">
                            <div className="w-16 text-sm font-medium text-gray-600">{ordinal(Number(place))}</div>
                            <input
                              type="number"
                              min="0"
                              value={newLeague.pointSystem[place]}
                              onChange={(e) => updatePositionPoints(place, e.target.value)}
                              className="w-20 px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none text-center"
                            />
                            <span className="text-xs text-gray-400">pts</span>
                          </div>
                        ))}
                    </div>

                    {/* Add / Remove buttons */}
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        type="button"
                        onClick={addPositionRow}
                        className="text-[#00285e] hover:text-[#003a7d] text-sm font-semibold flex items-center gap-1"
                      >
                        + Add Position
                      </button>
                      {Object.keys(newLeague.pointSystem).length > 1 && (
                        <button
                          type="button"
                          onClick={removeLastPositionRow}
                          className="text-red-500 hover:text-red-600 text-sm font-semibold flex items-center gap-1"
                        >
                          − Remove Last
                        </button>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {Object.keys(newLeague.pointSystem).length} positions
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Collapsed summary */}
              {!showPointsConfig && (
                <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600">
                  {Object.keys(newLeague.pointSystem).length} positions configured
                  · {newLeague.participationPoints} participation pts
                  · Drop lowest {newLeague.dropLowest}
                </div>
              )}
            </div>

            {/* ===== SUBMIT ===== */}
            <button
              type="submit"
              className="w-full bg-[#00285e] text-white py-4 rounded-xl font-semibold hover:bg-[#003a7d] text-lg"
            >
              Create League
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
