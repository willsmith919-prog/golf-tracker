import { ref, set, get } from 'firebase/database';
import { database } from '../../firebase';

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
  generateLeagueCode,
  loadUserLeagues
}) {
  const handleCreateLeague = async (e) => {
    e.preventDefault();
    setFeedback('');

    if (!newLeague.name) {
      setFeedback('Please enter a league name');
      return;
    }

    if (!userProfile) {
      setFeedback('User profile not loaded. Please try again.');
      return;
    }

    try {
      const leagueId = 'league-' + Date.now();
      const code = await generateLeagueCode();

      const leagueData = {
        meta: {
          name: newLeague.name,
          code: code,
          commissionerId: currentUser.uid,
          description: newLeague.description,
          createdAt: Date.now()
        },
        members: {
          [currentUser.uid]: {
            displayName: userProfile.displayName,
            role: 'commissioner',
            handicap: userProfile.handicap || null,
            joinedAt: Date.now()
          }
        },
        seasons: {
          'season-2026': {
            name: newLeague.seasonName,
            status: 'active',
            pointSystem: newLeague.pointSystem,
            events: [],
            standings: {}
          }
        }
      };

      await set(ref(database, `leagues/${leagueId}`), leagueData);
      await set(ref(database, `leagueCodes/${code}`), leagueId);
      await set(ref(database, `users/${currentUser.uid}/leagues/${leagueId}`), {
        role: 'commissioner',
        joinedAt: Date.now()
      });

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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">← Back</button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Create League</h2>

          {feedback && (
            <div className={`border-2 p-3 rounded-lg mb-4 text-sm ${
              feedback.includes('Error') || feedback.includes('required')
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              {feedback}
            </div>
          )}

          <form onSubmit={handleCreateLeague} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">League Name</label>
              <input
                type="text"
                value={newLeague.name}
                onChange={(e) => setNewLeague({ ...newLeague, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                placeholder="Sunday Golf League"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description (Optional)</label>
              <textarea
                value={newLeague.description}
                onChange={(e) => setNewLeague({ ...newLeague, description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                placeholder="Weekly competitive league for golfers of all levels"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Season Name</label>
              <input
                type="text"
                value={newLeague.seasonName}
                onChange={(e) => setNewLeague({ ...newLeague, seasonName: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                placeholder="2026 Season"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Point System</label>
              <div className="bg-gray-50 p-4 rounded-xl">
                <div className="grid grid-cols-5 gap-3">
                  {[1, 2, 3, 4, 5].map(place => (
                    <div key={place}>
                      <label className="block text-xs text-gray-600 mb-1">{place}{place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'}</label>
                      <input
                        type="number"
                        value={newLeague.pointSystem[place]}
                        onChange={(e) => setNewLeague({
                          ...newLeague,
                          pointSystem: { ...newLeague.pointSystem, [place]: parseInt(e.target.value) || 0 }
                        })}
                        className="w-full px-2 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 text-lg"
            >
              Create League
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
