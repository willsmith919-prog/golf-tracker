import { useState, useEffect } from 'react';
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
  setView
}) {
  const team = currentEvent.teams[selectedTeam];
  const coursePars = currentEvent.meta.coursePars;
  const courseYardages = currentEvent.meta.courseYardages || [];
  const courseStrokeIndexes = currentEvent.meta.courseStrokeIndexes || [];
  const format = currentEvent.meta.format;

  // --- Local state for step-by-step entry ---
  const [currentScore, setCurrentScore] = useState(null);
  const [currentFairway, setCurrentFairway] = useState(null);
  const [notes, setNotes] = useState('');

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
  const currentYardage = courseYardages[currentHole - 1];
  const currentSI = courseStrokeIndexes[currentHole - 1];

  // --- Backward compatibility ---
  // "holes" is the new format (rich objects). "scores" is the old format (bare numbers).
  // We read from "holes" first, falling back to "scores" for old events.
  const getHoleData = (hole) => {
    // New format: team.holes[hole] = { score, putts, fairway, gir, notes }
    if (team.holes && team.holes[hole]) {
      return team.holes[hole];
    }
    // Old format: team.scores[hole] = number
    if (team.scores && team.scores[hole]) {
      return { score: team.scores[hole], putts: null, fairway: null, gir: null, notes: '' };
    }
    return null;
  };

  const holeData = getHoleData(currentHole);

  // Load existing hole data when navigating to a hole
  useEffect(() => {
    if (holeData) {
      setCurrentScore(holeData.score);
      setCurrentFairway(holeData.fairway);
      setNotes(holeData.notes || '');
    } else {
      setCurrentScore(null);
      setCurrentFairway(null);
      setNotes('');
    }
  }, [currentHole]);

  // --- Stableford calculation ---
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

  // --- GIR calculation ---
  // GIR = "Green in Regulation". It means you got your ball onto the green
  // in (par - 2) strokes or fewer. So on a Par 4, reaching the green in 2 shots = GIR.
  const calculateGIR = (par, score, putts) => {
    if (score === 1) return true; // Hole in one is always GIR
    if (putts === null || putts === undefined) return false;
    const strokesToGreen = score - putts;
    return strokesToGreen <= (par - 2);
  };

  // --- Putt options based on score ---
  const getPuttOptions = (par, score) => {
    if (!score) return [];
    // Hole in one — no putts needed
    if (par === 3 && score === 1) return [];
    // Eagle
    if (score === par - 2) return [0, 1];
    // Birdie
    if (score === par - 1) return [0, 1, 2];
    // Par or worse
    return [0, 1, 2, '3+'];
  };

  // --- Score selection handler ---
  const handleScoreSelect = (score) => {
    setCurrentScore(score);

    // For Par 3, clear fairway (no fairway on par 3s)
    if (currentPar < 4) {
      setCurrentFairway(null);
    }

    // Check if hole in one (skip putts, save immediately)
    if (currentPar === 3 && score === 1) {
      setCurrentFairway(null);
      saveHoleData(score, null, 1);
    }
  };

  // --- Fairway selection handler ---
  const handleFairwaySelect = (fairway) => {
    setCurrentFairway(fairway);
  };

  // --- Putts selection handler ---
  const handlePuttsSelect = (putts) => {
    const finalPutts = putts === '3+' ? 3 : putts;
    saveHoleData(currentScore, currentFairway, finalPutts);
  };

  // --- Save hole data to Firebase ---
  const saveHoleData = async (score, fairway, putts) => {
    if (!score || score < 1 || score > 15) {
      setFeedback('Please enter a valid score');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }

    const gir = calculateGIR(currentPar, score, putts);

    const holeEntry = {
      score,
      putts,
      fairway,
      gir,
      notes
    };

    try {
      // Save using new "holes" format
      await set(
        ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/holes/${currentHole}`),
        holeEntry
      );

      // Also save to old "scores" path for backward compatibility with any
      // other views that might still read from it (like leaderboards)
      await set(
        ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/scores/${currentHole}`),
        parseInt(score)
      );

      // Recalculate and save stats
      const updatedStats = calculateStats(currentHole, holeEntry);
      await set(
        ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/stats`),
        updatedStats
      );

      // Auto-advance to next hole after a short delay
      const endingHole = currentEvent.meta.endingHole || 18;
      setTimeout(async () => {
        if (currentHole < endingHole) {
          await set(
            ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/currentHole`),
            currentHole + 1
          );
        }

        // Refresh event data from Firebase
        const eventSnapshot = await get(ref(database, `events/${currentEvent.id}`));
        const updatedEvent = eventSnapshot.val();
        setCurrentEvent({ id: currentEvent.id, ...updatedEvent });
      }, 500);

    } catch (error) {
      console.error('Error saving score:', error);
      setFeedback('Error saving score');
      setTimeout(() => setFeedback(''), 2000);
    }
  };

  // --- Navigate to a different hole ---
  const goToHole = async (hole) => {
    const startingHole = currentEvent.meta.startingHole || 1;
    const endingHole = currentEvent.meta.endingHole || 18;
    if (hole < startingHole || hole > endingHole) return;

    try {
      await set(
        ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/currentHole`),
        hole
      );

      const eventSnapshot = await get(ref(database, `events/${currentEvent.id}`));
      const updatedEvent = eventSnapshot.val();
      setCurrentEvent({ id: currentEvent.id, ...updatedEvent });
    } catch (error) {
      console.error('Error changing hole:', error);
    }
  };

  // --- Calculate running stats across all holes ---
  const calculateStats = (justSavedHole, justSavedData) => {
    let totalScore = 0;
    let totalPutts = 0;
    let totalPoints = 0;
    let fairwaysHit = 0;
    let fairwaysPossible = 0;
    let greensInRegulation = 0;
    let holesPlayed = 0;

    for (let i = 1; i <= 18; i++) {
      // Use the just-saved data for the current hole, otherwise read from team
      const hole = (i === justSavedHole) ? justSavedData : getHoleData(i);
      if (hole && hole.score) {
        holesPlayed++;
        totalScore += hole.score;
        totalPutts += hole.putts || 0;
        greensInRegulation += hole.gir ? 1 : 0;

        const par = coursePars[i - 1];

        // Fairway tracking (par 4 and 5 only)
        if (par >= 4) {
          fairwaysPossible++;
          if (hole.fairway === 'hit') {
            fairwaysHit++;
          }
        }

        if (format === 'stableford') {
          totalPoints += calculateStablefordPoints(hole.score, par);
        }
      }
    }

    const playedPars = coursePars.slice(0, holesPlayed);
    const parTotal = playedPars.reduce((sum, par) => sum + par, 0);
    const toPar = totalScore - parTotal;

    return {
      totalScore,
      toPar,
      totalPutts,
      fairwaysHit,
      fairwaysPossible,
      greensInRegulation,
      stablefordPoints: totalPoints,
      holesPlayed
    };
  };

  // Get current stats for display
  const stats = calculateStats(null, null);

  // --- Button configs ---
  const quickScoreButtons = [
    { label: 'Eagle', value: currentPar - 2, color: 'bg-yellow-400 hover:bg-yellow-500' },
    { label: 'Birdie', value: currentPar - 1, color: 'bg-green-500 hover:bg-green-600' },
    { label: 'Par', value: currentPar, color: 'bg-gray-400 hover:bg-gray-500' },
    { label: 'Bogey', value: currentPar + 1, color: 'bg-orange-400 hover:bg-orange-500' },
    { label: 'Double', value: currentPar + 2, color: 'bg-red-500 hover:bg-red-600' }
  ];

  const fairwayButtons = [
    { label: 'Left', value: 'left', color: 'bg-orange-400 hover:bg-orange-500' },
    { label: 'Hit', value: 'hit', color: 'bg-green-500 hover:bg-green-600' },
    { label: 'Short', value: 'short', color: 'bg-orange-400 hover:bg-orange-500' },
    { label: 'Right', value: 'right', color: 'bg-orange-400 hover:bg-orange-500' }
  ];

  const puttOptions = getPuttOptions(currentPar, currentScore);

  const getScoreColor = (score, par) => {
    if (!score) return 'text-gray-400';
    if (score < par) return 'text-green-600 font-bold';
    if (score === par) return 'text-gray-900';
    return 'text-red-600 font-bold';
  };

  const startingHole = currentEvent.meta.startingHole || 1;
  const endingHole = currentEvent.meta.endingHole || 18;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-2 md:p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={() => {
              setSelectedTeam(null);
              setView('event-lobby');
            }} 
            className="text-white hover:text-blue-200"
          >
            ← Back to Lobby
          </button>
        </div>

        {/* Team Header + Stats */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{team.name}</h1>
          <div className="text-sm text-gray-600 mb-4">{team.players.join(' & ')}</div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600">Score</div>
              <div className="text-3xl font-bold text-gray-900">{stats.totalScore || 0}</div>
              <div className="text-sm text-gray-600">
                Thru {stats.holesPlayed} holes
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">To Par</div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.toPar > 0 ? '+' : ''}{stats.toPar || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">
                {format === 'stableford' ? 'Points' : 'Putts'}
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {format === 'stableford' 
                  ? stats.stablefordPoints 
                  : stats.totalPutts}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Fairways</div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.fairwaysHit}/{stats.fairwaysPossible}
              </div>
              <div className="text-xs text-gray-500">
                {stats.fairwaysPossible > 0 
                  ? `${((stats.fairwaysHit / stats.fairwaysPossible) * 100).toFixed(0)}%`
                  : '0%'}
              </div>
            </div>
          </div>
        </div>

        {/* Current Hole */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => goToHole(currentHole - 1)}
              disabled={currentHole === startingHole}
              className="bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed p-3 rounded-xl"
            >
              <ChevronLeftIcon />
            </button>

            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900">Hole {currentHole}</div>
              <div className="text-xl text-gray-600 mt-1">Par {currentPar}</div>
              {currentYardage && (
                <div className="text-sm text-gray-500">{currentYardage} yards</div>
              )}
              {currentSI && (
                <div className="text-sm text-gray-500">SI: {currentSI}</div>
              )}
            </div>

            <button
              onClick={() => goToHole(currentHole + 1)}
              disabled={currentHole === endingHole}
              className="bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed p-3 rounded-xl"
            >
              <ChevronRightIcon />
            </button>
          </div>

          {/* Score Entry */}
          <div className="mb-4">
            <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Score</h3>
            <div className="grid grid-cols-5 gap-2">
              {quickScoreButtons.map(btn => (
                <button
                  key={btn.label}
                  onClick={() => handleScoreSelect(btn.value)}
                  className={`${
                    currentScore === btn.value 
                      ? 'ring-4 ring-blue-400' 
                      : ''
                  } ${btn.color} text-white py-4 rounded-xl font-semibold shadow-lg transition-all`}
                >
                  <div className="text-sm">{btn.label}</div>
                  <div className="text-2xl font-bold">{btn.value}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fairway Entry — shows after score entered, only for Par 4+ */}
          {currentScore && currentPar >= 4 && (
            <div className="mb-4">
              <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Fairway</h3>
              <div className="grid grid-cols-4 gap-3">
                {fairwayButtons.map(btn => (
                  <button
                    key={btn.label}
                    onClick={() => handleFairwaySelect(btn.value)}
                    className={`${
                      currentFairway === btn.value 
                        ? 'ring-4 ring-blue-400' 
                        : ''
                    } ${btn.color} text-white py-6 rounded-xl font-semibold text-lg shadow-lg transition-all`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Putts Entry — shows after fairway (or after score for Par 3) */}
          {currentScore && (currentPar < 4 || currentFairway) && puttOptions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Putts</h3>
              <div className="grid grid-cols-4 gap-3">
                {puttOptions.map(putts => (
                  <button
                    key={putts}
                    onClick={() => handlePuttsSelect(putts)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all"
                  >
                    {putts}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this hole..."
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none resize-none"
            rows="3"
          />
        </div>

        {feedback && (
          <div className="mb-4 bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm text-center">
            {feedback}
          </div>
        )}

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
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 text-gray-600">Par</td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => (
                      <td key={h} className="text-center p-2">{coursePars[h - 1]}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-2 text-gray-600">Score</td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => {
                      const hole = getHoleData(h);
                      const par = coursePars[h - 1];
                      return (
                        <td 
                          key={h} 
                          className={`text-center p-2 cursor-pointer hover:bg-gray-100 ${getScoreColor(hole?.score, par)}`}
                          onClick={() => goToHole(h)}
                        >
                          {hole?.score || '-'}
                          {hole?.gir && <span className="text-green-600 text-xs">●</span>}
                        </td>
                      );
                    })}
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
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 text-gray-600">Par</td>
                    {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                      <td key={h} className="text-center p-2">{coursePars[h - 1]}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-2 text-gray-600">Score</td>
                    {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => {
                      const hole = getHoleData(h);
                      const par = coursePars[h - 1];
                      return (
                        <td 
                          key={h} 
                          className={`text-center p-2 cursor-pointer hover:bg-gray-100 ${getScoreColor(hole?.score, par)}`}
                          onClick={() => goToHole(h)}
                        >
                          {hole?.score || '-'}
                          {hole?.gir && <span className="text-green-600 text-xs">●</span>}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600 text-center">
            ● = Green in Regulation · Tap any hole to edit
          </div>
        </div>
      </div>
    </div>
  );
}
