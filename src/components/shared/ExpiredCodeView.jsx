import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';

export default function ExpiredCodeView({
  joinCode,
  setView,
  setNewLeague,
  setCreatingEventForLeague,
  onCreateSimilar,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [codeType, setCodeType] = useState(null);
  const [details, setDetails] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const fetchExpiredData = async () => {
      try {
        // Look up the code
        const codeSnapshot = await get(ref(database, `codes/${joinCode}`));
        if (!codeSnapshot.exists()) {
          setError('Code not found.');
          setLoading(false);
          return;
        }

        const codeData = codeSnapshot.val();
        setCodeType(codeData.type);

        if (codeData.type === 'league') {
          // Fetch league details
          const leagueSnapshot = await get(ref(database, `leagues/${codeData.targetId}`));
          if (leagueSnapshot.exists()) {
            setDetails(leagueSnapshot.val());
          } else {
            setError('League no longer exists.');
          }

        } else if (codeData.type === 'event') {
          // Fetch event details
          const eventSnapshot = await get(ref(database, `events/${codeData.targetId}`));
          if (eventSnapshot.exists()) {
            const eventData = eventSnapshot.val();
            setDetails(eventData);

            // Build leaderboard from players
            const players = eventData.players || {};
            const sorted = Object.entries(players)
              .map(([id, player]) => {
                const scores = Object.values(player.scores || {});
                const total = scores.reduce((sum, s) => sum + (s || 0), 0);
                const holesPlayed = scores.filter(s => s > 0).length;
                return {
                  id,
                  displayName: player.displayName || 'Unknown',
                  total,
                  holesPlayed,
                };
              })
              .sort((a, b) => a.total - b.total);

            setLeaderboard(sorted);
          } else {
            setError('Event no longer exists.');
          }
        } else {
          setError('This code type does not support expired view.');
        }

      } catch (err) {
        console.error('Error fetching expired code data:', err);
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchExpiredData();
  }, []);

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <p className="text-white text-lg">Loading...</p>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] p-6 flex flex-col items-center justify-center">
        <p className="text-white text-lg mb-4">{error}</p>
        <button onClick={() => setView('home')} className="text-white/70 hover:text-white text-sm">
          ← Back to Home
        </button>
      </div>
    );
  }

  // --- Expired LEAGUE ---
  if (codeType === 'league') {
    const meta = details?.meta || {};
    return (
      <div className="min-h-screen bg-[#1a1a2e] p-6 font-sans">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('home')} className="text-white/70 hover:text-white text-sm mb-6 block">
            ← Back
          </button>

          {/* Expired badge */}
          <div className="bg-red-500/20 border border-red-400 rounded-2xl p-4 mb-4 text-center">
            <p className="text-red-200 font-semibold">This league code has expired</p>
          </div>

          {/* League details */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-4">
            <div className="text-3xl mb-3">🏆</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{meta.name || 'Unnamed League'}</h1>
            {meta.description && (
              <p className="text-gray-600 text-sm mb-3">{meta.description}</p>
            )}
            <div className="text-sm text-gray-500">
              {Object.keys(details?.members || {}).length} member{Object.keys(details?.members || {}).length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 mb-4">
            <p className="text-yellow-800 text-sm font-semibold mb-1">Why is this code expired?</p>
            <p className="text-yellow-700 text-sm">
              The commissioner regenerated the league code, which invalidated this one. 
              Ask the commissioner for the new code to join this league.
            </p>
          </div>

          {/* Create new league button */}
          <button
            onClick={() => setView('create-league')}
            className="w-full bg-[#00285e] hover:bg-[#003a7d] text-white font-bold py-4 rounded-2xl shadow-lg transition-all text-lg"
          >
            Create New League
          </button>
        </div>
      </div>
    );
  }

  // --- Expired EVENT ---
  if (codeType === 'event') {
    const meta = details?.meta || {};
    return (
      <div className="min-h-screen bg-[#1a1a2e] p-6 font-sans">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('home')} className="text-white/70 hover:text-white text-sm mb-6 block">
            ← Back
          </button>

          {/* Expired badge */}
          <div className="bg-red-500/20 border border-red-400 rounded-2xl p-4 mb-4 text-center">
            <p className="text-red-200 font-semibold">This event has ended</p>
          </div>

          {/* Event details */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-4">
            <div className="text-3xl mb-3">📋</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{meta.name || 'Unnamed Event'}</h1>
            <div className="space-y-1 mt-2">
              {meta.courseName && <p className="text-gray-600 text-sm">⛳ {meta.courseName}</p>}
              {meta.date && <p className="text-gray-600 text-sm">📅 {meta.date}</p>}
              {meta.formatName && <p className="text-gray-600 text-sm">🏌️ {meta.formatName}</p>}
              {meta.teeName && <p className="text-gray-600 text-sm">🎯 {meta.teeName} tees</p>}
            </div>
          </div>

          {/* Final leaderboard */}
          {leaderboard.length > 0 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">📊 Final Leaderboard</h2>
              <div className="space-y-2">
                {leaderboard.map((player, index) => (
                  <div key={player.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-6 text-center ${
                        index === 0 ? 'text-yellow-500' :
                        index === 1 ? 'text-gray-400' :
                        index === 2 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-gray-900 font-medium">{player.displayName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-900 font-bold">{player.total}</span>
                      <span className="text-gray-500 text-xs ml-1">({player.holesPlayed} holes)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create similar event button */}
          <button
            onClick={() => {
                onCreateSimilar({
                    courseId: meta.courseId,
                    courseName: meta.courseName,
                    teeId: meta.teeId,
                    teeName: meta.teeName,
                    formatId: meta.formatId,
                    formatName: meta.formatName,
                    scoringMethod: meta.scoringMethod,
                    teamSize: meta.teamSize,
                });
                }}
            className="w-full bg-[#00285e] hover:bg-[#003a7d] text-white font-bold py-4 rounded-2xl shadow-lg transition-all text-lg"
          >
            Create Similar Event
          </button>

        </div>
      </div>
    );
  }

  return null;
}