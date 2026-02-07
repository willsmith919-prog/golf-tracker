import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';

export default function PastRoundsView({ user, setView, setCurrentSoloRound }) {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRounds();
  }, [user]);

  const loadRounds = async () => {
    if (!user) return;
    
    try {
      const userRoundsRef = ref(database, `users/${user.uid}/soloRounds`);
      const snapshot = await get(userRoundsRef);
      
      if (snapshot.exists()) {
        const roundsData = snapshot.val();
        const roundsArray = await Promise.all(
          Object.entries(roundsData).map(async ([id, summary]) => {
            // Get full round data
            const fullRoundSnapshot = await get(ref(database, `soloRounds/${id}`));
            return {
              id,
              ...summary,
              fullData: fullRoundSnapshot.val()
            };
          })
        );
        
        // Sort by date, most recent first
        roundsArray.sort((a, b) => b.date - a.date);
        setRounds(roundsArray);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading rounds:', error);
      setLoading(false);
    }
  };

  const viewScorecard = (round) => {
    setCurrentSoloRound(round.fullData);
    setView('solo-scorecard');
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatToPar = (toPar) => {
    if (toPar === 0) return 'E';
    return toPar > 0 ? `+${toPar}` : `${toPar}`;
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

          {rounds.length === 0 ? (
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
              {rounds.map(round => (
                <div 
                  key={round.id}
                  className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-400 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
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

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-600">Putts</div>
                      <div className="text-lg font-bold text-gray-900">
                        {round.fullData?.stats?.totalPutts || 0}
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-600">GIR</div>
                      <div className="text-lg font-bold text-gray-900">
                        {round.fullData?.stats?.greensInRegulation || 0}
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-600">Fairways</div>
                      <div className="text-lg font-bold text-gray-900">
                        {round.fullData?.stats?.fairwaysHit || 0}/
                        {round.fullData?.stats?.fairwaysPossible || 0}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => viewScorecard(round)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold"
                  >
                    View Scorecard
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
