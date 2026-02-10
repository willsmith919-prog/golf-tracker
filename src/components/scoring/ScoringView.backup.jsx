import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

export default function ScoringView({
  currentEvent,
  setCurrentEvent,
  selectedTeam,
  setSelectedTeam,
  feedback,
  setFeedback,
  scoreConfirmation,
  setScoreConfirmation,
  setView
}) {
  const team = currentEvent.teams[selectedTeam];
  const coursePars = currentEvent.meta.coursePars;
  const format = currentEvent.meta.format;

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Team not found</p>
          <button onClick={() => setView('event-lobby')} className="bg-white text-blue-900 px-6 py-3 rounded-xl font-semibold">
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const currentHole = team.currentHole;
  const currentPar = coursePars[currentHole - 1];

  const calculateStablefordPoints = (score, par) => {
    const diff = score - par;
    if (diff >= 2) return 0;
    if (diff === 1) return 1;
    if (diff === 0) return 2;
    if (diff === -1) return 3;
    if (diff === -2) return 4;
    if (diff <= -3) return 5;
    return 0;
  };

  const getHoleScore = (hole) => {
    return team.scores[hole] || null;
  };

  const saveScore = async (hole, score) => {
    if (!score || score < 1 || score > 15) {
      setFeedback('Please enter a valid score');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }

    try {
      await set(ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/scores/${hole}`), parseInt(score));

      setScoreConfirmation({ hole, score: parseInt(score) });

      setTimeout(async () => {
        setScoreConfirmation(null);
        
        if (hole < 18) {
          await set(ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/currentHole`), hole + 1);
          
          const eventSnapshot = await get(ref(database, `events/${currentEvent.id}`));
          const updatedEvent = eventSnapshot.val();
          setCurrentEvent({ id: currentEvent.id, ...updatedEvent });
        }
      }, 1000);

    } catch (error) {
      console.error('Error saving score:', error);
      setFeedback('Error saving score');
      setTimeout(() => setFeedback(''), 2000);
    }
  };

  const goToHole = async (hole) => {
    if (hole < 1 || hole > 18) return;

    try {
      await set(ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/currentHole`), hole);
      
      const eventSnapshot = await get(ref(database, `events/${currentEvent.id}`));
      const updatedEvent = eventSnapshot.val();
      setCurrentEvent({ id: currentEvent.id, ...updatedEvent });
    } catch (error) {
      console.error('Error changing hole:', error);
    }
  };

  const calculateTotals = () => {
    let totalScore = 0;
    let totalPoints = 0;
    let holesPlayed = 0;

    for (let i = 1; i <= 18; i++) {
      const score = team.scores[i];
      if (score) {
        totalScore += score;
        holesPlayed++;
        if (format === 'stableford') {
          totalPoints += calculateStablefordPoints(score, coursePars[i - 1]);
        }
      }
    }

    const totalPar = coursePars.reduce((sum, par) => sum + par, 0);
    const scoreToPar = totalScore - totalPar;

    return { totalScore, totalPoints, holesPlayed, scoreToPar };
  };

  const totals = calculateTotals();

  const quickScoreButtons = [
    { label: 'Eagle', value: currentPar - 2 },
    { label: 'Birdie', value: currentPar - 1 },
    { label: 'Par', value: currentPar },
    { label: 'Bogey', value: currentPar + 1 },
    { label: 'Double', value: currentPar + 2 }
  ];

  const getScoreBgColor = (score, par) => {
    if (!score) return 'bg-white';
    if (score === par - 2) return 'bg-yellow-200';
    if (score === par - 1) return 'bg-red-200';
    if (score === par + 1) return 'bg-blue-200';
    if (score >= par + 2) return 'bg-gray-300';
    return 'bg-white';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-4">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => {
            setSelectedTeam(null);
            setView('event-lobby');
          }} 
          className="text-white mb-4 hover:text-blue-200"
        >
          ← Back to Lobby
        </button>

        {/* Team Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{team.name}</h1>
          <div className="text-sm text-gray-600 mb-4">{team.players.join(' & ')}</div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-xs text-gray-600 mb-1">Holes</div>
              <div className="text-2xl font-bold text-gray-900">{totals.holesPlayed}/18</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-xs text-gray-600 mb-1">Score</div>
              <div className="text-2xl font-bold text-gray-900">
                {totals.totalScore > 0 ? (
                  <>
                    {totals.totalScore}
                    <span className="text-sm ml-1">
                      ({totals.scoreToPar > 0 ? '+' : ''}{totals.scoreToPar})
                    </span>
                  </>
                ) : '-'}
              </div>
            </div>
            {format === 'stableford' && (
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-xs text-gray-600 mb-1">Points</div>
                <div className="text-2xl font-bold text-gray-900">{totals.totalPoints}</div>
              </div>
            )}
            {format !== 'stableford' && (
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-xs text-gray-600 mb-1">Par</div>
                <div className="text-2xl font-bold text-gray-900">{coursePars.reduce((a, b) => a + b, 0)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Current Hole */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => goToHole(currentHole - 1)}
              disabled={currentHole === 1}
              className="bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed p-3 rounded-xl"
            >
              <ChevronLeftIcon />
            </button>

            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">Hole</div>
              <div className="text-5xl font-bold text-gray-900">{currentHole}</div>
              <div className="text-lg text-gray-600 mt-1">Par {currentPar}</div>
            </div>

            <button
              onClick={() => goToHole(currentHole + 1)}
              disabled={currentHole === 18}
              className="bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed p-3 rounded-xl"
            >
              <ChevronRightIcon />
            </button>
          </div>

          {/* Score Confirmation */}
          {scoreConfirmation && scoreConfirmation.hole === currentHole && (
            <div className="bg-green-50 border-2 border-green-200 text-green-800 px-4 py-3 rounded-xl mb-4 text-center font-semibold">
              ✓ Score saved: {scoreConfirmation.score}
            </div>
          )}

          {/* Quick Score Buttons */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {quickScoreButtons.map(btn => (
              <button
                key={btn.label}
                onClick={() => saveScore(currentHole, btn.value)}
                className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm"
              >
                <div>{btn.label}</div>
                <div className="text-xs opacity-80">{btn.value}</div>
              </button>
            ))}
          </div>

          {/* Manual Score Entry */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Or enter score manually:</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="15"
                placeholder="Score"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    saveScore(currentHole, parseInt(e.target.value));
                    e.target.value = '';
                  }
                }}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-center text-2xl font-bold"
              />
              <button
                onClick={(e) => {
                  const input = e.target.parentElement.querySelector('input');
                  saveScore(currentHole, parseInt(input.value));
                  input.value = '';
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold"
              >
                Save
              </button>
            </div>
          </div>

          {feedback && (
            <div className="mt-4 bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm text-center">
              {feedback}
            </div>
          )}
        </div>

        {/* Scorecard */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
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
                      <th key={h} className="text-center p-2 min-w-[40px]">{h}</th>
                    ))}
                    <th className="text-center p-2 font-bold">OUT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 text-gray-600">Par</td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => (
                      <td key={h} className="text-center p-2">{coursePars[h - 1]}</td>
                    ))}
                    <td className="text-center p-2 font-bold">
                      {coursePars.slice(0, 9).reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-gray-600">Score</td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => {
                      const score = getHoleScore(h);
                      const par = coursePars[h - 1];
                      return (
                        <td key={h} className={`text-center p-2 ${getScoreBgColor(score, par)} font-semibold`}>
                          {score || '-'}
                        </td>
                      );
                    })}
                    <td className="text-center p-2 font-bold bg-gray-100">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((sum, h) => sum + (getHoleScore(h) || 0), 0) || '-'}
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
                      <th key={h} className="text-center p-2 min-w-[40px]">{h}</th>
                    ))}
                    <th className="text-center p-2 font-bold">IN</th>
                    <th className="text-center p-2 font-bold">TOT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 text-gray-600">Par</td>
                    {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                      <td key={h} className="text-center p-2">{coursePars[h - 1]}</td>
                    ))}
                    <td className="text-center p-2 font-bold">
                      {coursePars.slice(9, 18).reduce((a, b) => a + b, 0)}
                    </td>
                    <td className="text-center p-2 font-bold bg-gray-200">
                      {coursePars.reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-gray-600">Score</td>
                    {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => {
                      const score = getHoleScore(h);
                      const par = coursePars[h - 1];
                      return (
                        <td key={h} className={`text-center p-2 ${getScoreBgColor(score, par)} font-semibold`}>
                          {score || '-'}
                        </td>
                      );
                    })}
                    <td className="text-center p-2 font-bold bg-gray-100">
                      {[10, 11, 12, 13, 14, 15, 16, 17, 18].reduce((sum, h) => sum + (getHoleScore(h) || 0), 0) || '-'}
                    </td>
                    <td className="text-center p-2 font-bold bg-gray-200">
                      {totals.totalScore || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
