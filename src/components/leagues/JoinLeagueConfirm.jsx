import { useEffect, useState } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';

export default function JoinLeagueConfirm({
  currentUser,
  userProfile,
  joinCode,
  setView,
  setCurrentLeague,
}) {
  const [league, setLeague] = useState(null);
  const [leagueId, setLeagueId] = useState(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  // When the screen loads, fetch the league data using the code
  useEffect(() => {
    const fetchLeague = async () => {
      try {
        // Look up the code to get the leagueId
        const codeSnapshot = await get(ref(database, `codes/${joinCode}`));
        if (!codeSnapshot.exists()) {
          setError('Code not found.');
          setLoading(false);
          return;
        }

        const codeData = codeSnapshot.val();
        const id = codeData.targetId;
        console.log('targetId from code:', id);
        console.log('league path:', `leagues/${id}`);
        
        setLeagueId(id);

        // Fetch the actual league data
        const leagueSnapshot = await get(ref(database, `leagues/${id}`));
        if (!leagueSnapshot.exists()) {
          setError('League not found.');
          setLoading(false);
          return;
        }

        const leagueData = leagueSnapshot.val();
        setLeague(leagueData);

        // Check if the user is already a member
        const isMember = leagueData.members && leagueData.members[currentUser.uid];
        setAlreadyMember(!!isMember);

      } catch (err) {
        console.error('Error fetching league:', err);
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchLeague();
  }, []);

  const handleJoin = async () => {
    setJoining(true);
    try {
      // Add user to league members
      await set(ref(database, `leagues/${leagueId}/members/${currentUser.uid}`), {
        role: 'member',
        joinedAt: Date.now(),
      });

      // Add league reference to user's profile
      await set(ref(database, `users/${currentUser.uid}/leagueMemberships/${leagueId}`), {
        role: 'member',
        joinedAt: Date.now(),
      });

      // Load the full league and take user to the dashboard
      const leagueSnapshot = await get(ref(database, `leagues/${leagueId}`));
      setCurrentLeague({ id: leagueId, ...leagueSnapshot.val() });
      setView('league-dashboard');

    } catch (err) {
      console.error('Error joining league:', err);
      setError('Something went wrong. Please try again.');
      setJoining(false);
    }
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 flex items-center justify-center">
        <p className="text-white text-lg">Loading...</p>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 flex flex-col items-center justify-center">
        <p className="text-white text-lg mb-4">{error}</p>
        <button
          onClick={() => setView('home')}
          className="text-white/70 hover:text-white text-sm"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 font-sans">
      <div className="max-w-2xl mx-auto">

        {/* Back button */}
        <button
          onClick={() => setView('home')}
          className="text-white/70 hover:text-white text-sm mb-6 block"
        >
          ← Back
        </button>

        {/* League card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-4">
          <div className="text-3xl mb-3">🏆</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {league?.meta?.name || 'Unnamed League'}
          </h1>
          {league?.meta?.description && (
            <p className="text-gray-600 text-sm mb-4">{league.meta.description}</p>
          )}
          <div className="text-sm text-gray-500">
            {Object.keys(league?.members || {}).length} member{Object.keys(league?.members || {}).length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Already a member message */}
        {alreadyMember ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 text-center">
            <p className="text-yellow-800 font-semibold mb-1">You're already a member of this league.</p>
            <p className="text-yellow-700 text-sm mb-4">No need to join again.</p>
            <button
              onClick={() => setView('home')}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              ← Back to Home
            </button>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 rounded-2xl shadow-lg transition-all text-lg"
          >
            {joining ? 'Joining...' : 'Join League'}
          </button>
        )}

      </div>
    </div>
  );
}