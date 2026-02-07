import { database } from '../../firebase';

export default function SoloScorecardView({ currentSoloRound, setView }) {
  if (!currentSoloRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Round not found</p>
          <button onClick={() => setView('home')} className="bg-white text-blue-900 px-6 py-3 rounded-xl font-semibold">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatToPar = (toPar) => {
    if (toPar === 0) return 'Even';
    return toPar > 0 ? `+${toPar}` : `${toPar}`;
  };

  const getScoreColor = (score, par) => {
    if (!score) return 'text-gray-400';
    if (score < par) return 'text-green-600 font-bold';
    if (score === par) return 'text-gray-900';
    return 'text-red-600 font-bold';
  };

  const calculateFairwayPercentage = () => {
    const { fairwaysHit, fairwaysPossible } = currentSoloRound.stats;
    if (fairwaysPossible === 0) return '0';
    return ((fairwaysHit / fairwaysPossible) * 100).toFixed(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => setView('past-rounds')} 
          className="text-white mb-4 hover:text-blue-200"
        >
          ← Back to Rounds
        </button>

        {/* Round Summary Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 mb-4">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {currentSoloRound.courseName}
            </h1>
            <p className="text-gray-600">{currentSoloRound.teeName} Tees</p>
            <p className="text-sm text-gray-500">{formatDate(currentSoloRound.date)}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-xl text-center">
              <div className="text-sm text-gray-600 mb-1">Score</div>
              <div className="text-3xl font-bold text-gray-900">
                {currentSoloRound.stats.totalScore}
              </div>
              <div className="text-sm text-gray-600">
                ({formatToPar(currentSoloRound.stats.toPar)})
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl text-center">
              <div className="text-sm text-gray-600 mb-1">Total Putts</div>
              <div className="text-3xl font-bold text-gray-900">
                {currentSoloRound.stats.totalPutts}
              </div>
              <div className="text-sm text-gray-600">
                {(currentSoloRound.stats.totalPutts / 18).toFixed(1)} avg
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl text-center">
              <div className="text-sm text-gray-600 mb-1">GIR</div>
              <div className="text-3xl font-bold text-gray-900">
                {currentSoloRound.stats.greensInRegulation}
              </div>
              <div className="text-sm text-gray-600">
                {((currentSoloRound.stats.greensInRegulation / 18) * 100).toFixed(0)}%
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl text-center">
              <div className="text-sm text-gray-600 mb-1">Fairways</div>
              <div className="text-3xl font-bold text-gray-900">
                {currentSoloRound.stats.fairwaysHit}/{currentSoloRound.stats.fairwaysPossible}
              </div>
              <div className="text-sm text-gray-600">
                {calculateFairwayPercentage()}%
              </div>
            </div>
          </div>

          {currentSoloRound.format === 'stableford' && (
            <div className="bg-green-50 p-4 rounded-xl text-center">
              <div className="text-sm text-gray-600 mb-1">Stableford Points</div>
              <div className="text-3xl font-bold text-green-700">
                {currentSoloRound.stats.stablefordPoints}
              </div>
            </div>
          )}
        </div>

        {/* Detailed Scorecard */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Scorecard</h2>
          
          {/* Front 9 */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Front 9</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left p-2">Hole</th>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => (
                      <th key={h} className="text-center p-2 min-w-[50px]">{h}</th>
                    ))}
                    <th className="text-center p-2 font-bold">OUT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 text-gray-600">Par</td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => (
                      <td key={h} className="text-center p-2 font-semibold">
                        {currentSoloRound.coursePars[h - 1]}
                      </td>
                    ))}
                    <td className="text-center p-2 font-bold bg-gray-100">
                      {currentSoloRound.coursePars.slice(0, 9).reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 text-gray-600">Yards</td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => (
                      <td key={h} className="text-center p-2 text-xs text-gray-500">
                        {currentSoloRound.courseYardages[h - 1]}
                      </td>
                    ))}
                    <td className="text-center p-2 text-xs text-gray-500 bg-gray-100">
                      {currentSoloRound.courseYardages.slice(0, 9).reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-gray-600">Score</td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => {
                      const hole = currentSoloRound.holes[h];
                      const par = currentSoloRound.coursePars[h - 1];
                      return (
                        <td key={h} className={`text-center p-2 ${getScoreColor(hole?.score, par)}`}>
                          <div className="flex items-center justify-center gap-1">
                            {hole?.score || '-'}
                            {hole?.gir && <span className="text-green-600 text-xs">●</span>}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center p-2 font-bold bg-gray-100">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((sum, h) => 
                        sum + (currentSoloRound.holes[h]?.score || 0), 0
                      ) || '-'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="p-2 text-gray-600 text-xs">Putts</td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => {
                      const hole = currentSoloRound.holes[h];
                      return (
                        <td key={h} className="text-center p-2 text-xs text-gray-600">
                          {hole?.putts ?? '-'}
                        </td>
                      );
                    })}
                    <td className="text-center p-2 text-xs text-gray-600 bg-gray-100">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((sum, h) => 
                        sum + (currentSoloRound.holes[h]?.putts || 0), 0
                      ) || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Back 9 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Back 9</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left p-2">Hole</th>
                    {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                      <th key={h} className="text-center p-2 min-w-[50px]">{h}</th>
                    ))}
                    <th className="text-center p-2 font-bold">IN</th>
                    <th className="text-center p-2 font-bold">TOT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 text-gray-600">Par</td>
                    {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                      <td key={h} className="text-center p-2 font-semibold">
                        {currentSoloRound.coursePars[h - 1]}
                      </td>
                    ))}
                    <td className="text-center p-2 font-bold bg-gray-100">
                      {currentSoloRound.coursePars.slice(9, 18).reduce((a, b) => a + b, 0)}
                    </td>
                    <td className="text-center p-2 font-bold bg-gray-200">
                      {currentSoloRound.coursePars.reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 text-gray-600">Yards</td>
                    {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                      <td key={h} className="text-center p-2 text-xs text-gray-500">
                        {currentSoloRound.courseYardages[h - 1]}
                      </td>
                    ))}
                    <td className="text-center p-2 text-xs text-gray-500 bg-gray-100">
                      {currentSoloRound.courseYardages.slice(9, 18).reduce((a, b) => a + b, 0)}
                    </td>
                    <td className="text-center p-2 text-xs text-gray-500 bg-gray-200">
                      {currentSoloRound.courseYardages.reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-gray-600">Score</td>
                    {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => {
                      const hole = currentSoloRound.holes[h];
                      const par = currentSoloRound.coursePars[h - 1];
                      return (
                        <td key={h} className={`text-center p-2 ${getScoreColor(hole?.score, par)}`}>
                          <div className="flex items-center justify-center gap-1">
                            {hole?.score || '-'}
                            {hole?.gir && <span className="text-green-600 text-xs">●</span>}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center p-2 font-bold bg-gray-100">
                      {[10, 11, 12, 13, 14, 15, 16, 17, 18].reduce((sum, h) => 
                        sum + (currentSoloRound.holes[h]?.score || 0), 0
                      ) || '-'}
                    </td>
                    <td className="text-center p-2 font-bold bg-gray-200">
                      {currentSoloRound.stats.totalScore || '-'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="p-2 text-gray-600 text-xs">Putts</td>
                    {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => {
                      const hole = currentSoloRound.holes[h];
                      return (
                        <td key={h} className="text-center p-2 text-xs text-gray-600">
                          {hole?.putts ?? '-'}
                        </td>
                      );
                    })}
                    <td className="text-center p-2 text-xs text-gray-600 bg-gray-100">
                      {[10, 11, 12, 13, 14, 15, 16, 17, 18].reduce((sum, h) => 
                        sum + (currentSoloRound.holes[h]?.putts || 0), 0
                      ) || '-'}
                    </td>
                    <td className="text-center p-2 text-xs text-gray-600 bg-gray-200">
                      {currentSoloRound.stats.totalPutts}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600 text-center">
            ● = Green in Regulation
          </div>
        </div>

        {/* Hole Notes */}
        {Object.entries(currentSoloRound.holes).some(([_, hole]) => hole.notes) && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Notes</h2>
            <div className="space-y-3">
              {Object.entries(currentSoloRound.holes)
                .filter(([_, hole]) => hole.notes)
                .map(([holeNum, hole]) => (
                  <div key={holeNum} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="text-sm font-semibold text-gray-700 mb-1">
                      Hole {holeNum}
                    </div>
                    <div className="text-gray-600">{hole.notes}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
