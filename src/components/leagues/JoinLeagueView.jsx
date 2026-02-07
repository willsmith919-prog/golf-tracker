import { ref, set, get } from 'firebase/database';
import { database } from '../../firebase';

export default function JoinLeagueView({
  currentUser,
  userProfile,
  leagueCode,
  setLeagueCode,
  feedback,
  setFeedback,
  setView,
  setCurrentLeague,
  setUserLeagues,
  loadUserLeagues
}) {
  const handleJoinLeague = async (e) => {
    e.preventDefault();
    setFeedback('');

    if (!leagueCode) {
      setFeedback('Please enter a league code');
      return;
    }

    if (!userProfile) {
      setFeedback('User profile not loaded. Please try logging out and back in.');
      return;
    }

    try {
      const codeSnapshot = await get(ref(database, `leagueCodes/${leagueCode}`));
      const leagueId = codeSnapshot.val();

      if (!leagueId) {
        setFeedback('League not found. Check your code.');
        return;
      }

      const leagueSnapshot = await get(ref(database, `leagues/${leagueId}`));
      const leagueData = leagueSnapshot.val();

      if (!leagueData) {
        setFeedback('League not found. Check your code.');
        return;
      }

      if (leagueData.members && leagueData.members[currentUser.uid]) {
        setFeedback('You are already a member of this league');
        setTimeout(() => {
          const league = { id: leagueId, ...leagueData, userRole: leagueData.members[currentUser.uid].role };
          setCurrentLeague(league);
          setView('league-dashboard');
        }, 1500);
        return;
      }

      await set(ref(database, `leagues/${leagueId}/members/${currentUser.uid}`), {
        displayName: userProfile.displayName,
        role: 'player',
        handicap: userProfile.handicap || null,
        joinedAt: Date.now()
      });

      await set(ref(database, `users/${currentUser.uid}/leagues/${leagueId}`), {
        role: 'player',
        joinedAt: Date.now()
      });

      const leagues = await loadUserLeagues(currentUser.uid);
      setUserLeagues(leagues);
      const joinedLeague = leagues.find(l => l.id === leagueId);
      setCurrentLeague(joinedLeague);

      setFeedback('Successfully joined league!');
      setTimeout(() => {
        setView('league-dashboard');
        setFeedback('');
      }, 1500);

    } catch (error) {
      console.error('Error joining league:', error);
      setFeedback('Error joining league. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 flex items-center justify-center">
      <div className="max-w-md w-full">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">← Back</button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Join League</h2>
          <p className="text-gray-600 mb-6">Enter the code from your league commissioner</p>

          {feedback && (
            <div className={`border-2 p-3 rounded-lg mb-4 text-sm ${
              feedback.includes('Error') || feedback.includes('not found')
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              {feedback}
            </div>
          )}

          <form onSubmit={handleJoinLeague}>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">League Code</label>
              <input
                type="text"
                value={leagueCode}
                onChange={(e) => setLeagueCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none uppercase text-center text-2xl font-mono tracking-widest"
                placeholder="ABC-1234"
                maxLength={8}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 text-lg"
            >
              Join League
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
