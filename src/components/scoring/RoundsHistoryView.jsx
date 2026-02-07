import { useState, useEffect } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';

export default function RoundsHistoryView({ user, setView, setCurrentSoloRound }) {
  const [rounds, setRounds] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'solo', 'league', 'event'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllRounds();
  }, [user]);

  const loadAllRounds = async () => {
    if (!user) return;
    
    try {
      const allRounds = [];

      // Load solo rounds
      const soloRoundsRef = ref(database, `users/${user.uid}/soloRounds`);
      const soloSnapshot = await get(soloRoundsRef);
      
      if (soloSnapshot.exists()) {
        const soloData = soloSnapshot.val();
        for (const [id, summary] of Object.entries(soloData)) {
          const fullRoundSnapshot = await get(ref(database, `soloRounds/${id}`));
          if (fullRoundSnapshot.exists()) {
            allRounds.push({
              id,
              type: 'solo',
              ...summary,
              fullData: fullRoundSnapshot.val()
            });
          }
        }
      }

      // TODO: Load league rounds when that feature is built
      // const leagueRoundsRef = ref(database, `users/${user.uid}/leagueRounds`);
      
      // TODO: Load event rounds when that feature is built
      // const eventRoundsRef = ref(database, `users/${user.uid}/eventRounds`);

      // Sort by date, most recent first
      allRounds.sort((a, b) => b.date - a.date);
      setRounds(allRounds);
      setLoading(false);
    } catch (error) {
      console.error('Error loading rounds:', error);
      setLoading(false);
    }
  };

  const filteredRounds = rounds.filter(round => {
    if (filter === 'all') return true;
    return round.type === filter;
  });

  const viewRound = (round) => {
    if (round.type === 'solo') {
      setCurrentSoloRound(round.fullData);
      setView('solo-scorecard');
    }
    // TODO: Add handlers for league and event rounds
  };

  const deleteRound = async (round) => {
    if (round.type !== 'solo') {
      alert('Only solo rounds can be deleted');
      return;
    }

    const confirmDelete = confirm(
      `Are you sure you want to delete this round?\n\n` +
      `${round.courseName} - ${formatDate(round.date)}\n` +
      `Score: ${round.score} (${formatToPar(round.toPar)})\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      // Delete from soloRounds
      await set(ref(database, `soloRounds/${round.id}`), null);
      
      // Delete from user's soloRounds list
      await set(ref(database, `users/${user.uid}/soloRounds/${round.id}`), null);

      // Remove from local state
      setRounds(rounds.filter(r => r.id !== round.id));

      alert('Round deleted successfully');
    } catch (error) {
      console.error('Error deleting round:', error);
      alert('Failed to delete round. Please try again.');
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatToPar = (toPar) => {
    if (toPar === 0) return 'E';
    return toPar > 0 ? `+${toPar}` : `${toPar}`;
  };

  const getRoundTypeLabel = (type) => {
    switch (type) {
      case 'solo': return 'Solo Round';
      case 'league': return 'League';
      case 'event': return 'Event';
      default: return 'Round';
    }
  };

  const getRoundTypeBadgeColor = (type) => {
    switch (type) {
      case 'solo': return 'bg-green-100 text-green-800';
      case 'league': return 'bg-blue-100 text-blue-800';
      case 'event': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Loading rounds...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => setView('home')} 
          className="text-white mb-6 hover:text-blue-200 flex items-center gap-2"
        >
          ← Back
        </button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">My Rounds</h1>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All ({rounds.length})
            </button>
            <button
              onClick={() => setFilter('solo')}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                filter === 'solo'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Solo ({rounds.filter(r => r.type === 'solo').length})
            </button>
            <button
              onClick={() => setFilter('league')}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                filter === 'league'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              League ({rounds.filter(r => r.type === 'league').length})
            </button>
            <button
              onClick={() => setFilter('event')}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                filter === 'event'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Events ({rounds.filter(r => r.type === 'event').length})
            </button>
          </div>

          {/* Rounds List */}
          {filteredRounds.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No rounds yet</p>
              <button
                onClick={() => setView('solo-setup')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold"
              >
                Start Your First Round
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRounds.map(round => (
                <div 
                  key={round.id}
                  className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-400 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${getRoundTypeBadgeColor(round.type)}`}>
                          {getRoundTypeLabel(round.type)}
                        </span>
                        {round.numHoles === 9 && (
                          <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-200 text-gray-700">
                            9 Holes
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        {formatDate(round.date)}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {round.courseName}
                      </h3>
                      <div className="text-sm text-gray-600 mt-1">
                        {round.fullData?.teeName || 'White Tees'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-900">
                        {round.score}
                      </div>
                      <div className="text-lg text-gray-600">
                        ({formatToPar(round.toPar)})
                      </div>
                    </div>
                  </div>

                  {round.fullData?.stats && (
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-600">Putts</div>
                        <div className="text-lg font-bold text-gray-900">
                          {round.fullData.stats.totalPutts || 0}
                        </div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-600">GIR</div>
                        <div className="text-lg font-bold text-gray-900">
                          {round.fullData.stats.greensInRegulation || 0}
                        </div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-600">Fairways</div>
                        <div className="text-lg font-bold text-gray-900">
                          {round.fullData.stats.fairwaysHit || 0}/
                          {round.fullData.stats.fairwaysPossible || 0}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => viewRound(round)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold"
                    >
                      View Scorecard
                    </button>
                    
                    {round.type === 'solo' && (
                      <button
                        onClick={() => deleteRound(round)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold"
                        title="Delete round"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
