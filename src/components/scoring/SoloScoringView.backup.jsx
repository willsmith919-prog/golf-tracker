import { useState, useEffect } from 'react';
import { ref, set, get } from 'firebase/database';
import { database } from '../../firebase';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

const ENTRY_STATE = {
  SCORE: 'ENTERING_SCORE',
  FAIRWAY: 'ENTERING_FAIRWAY',
  PUTTS: 'ENTERING_PUTTS'
};

export default function SoloScoringView({ 
  currentSoloRound, 
  setCurrentSoloRound, 
  setView,
  user 
}) {
  const [entryState, setEntryState] = useState(ENTRY_STATE.SCORE);
  const [currentScore, setCurrentScore] = useState(null);
  const [currentFairway, setCurrentFairway] = useState(null);
  const [notes, setNotes] = useState('');

  const currentHole = currentSoloRound.currentHole;
  const currentPar = currentSoloRound.coursePars[currentHole - 1];
  const currentYardage = currentSoloRound.courseYardages[currentHole - 1];
  const currentSI = currentSoloRound.courseStrokeIndexes[currentHole - 1];
  const holeData = currentSoloRound.holes[currentHole];

  // Load existing hole data when navigating to a hole
  useEffect(() => {
    if (holeData) {
      setCurrentScore(holeData.score);
      setCurrentFairway(holeData.fairway);
      setNotes(holeData.notes || '');
      setEntryState(ENTRY_STATE.SCORE); // Allow re-editing
    } else {
      setCurrentScore(null);
      setCurrentFairway(null);
      setNotes('');
      setEntryState(ENTRY_STATE.SCORE);
    }
  }, [currentHole]);

  // Recalculate stats whenever we return to this view
  useEffect(() => {
    const stats = calculateStats(currentSoloRound);
    if (JSON.stringify(stats) !== JSON.stringify(currentSoloRound.stats)) {
      const updatedRound = { ...currentSoloRound };
      updatedRound.stats = stats;
      setCurrentSoloRound(updatedRound);
    }
  }, [currentHole, currentSoloRound.holes]);

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

  const getPuttOptions = (par, score) => {
    // Hole in one - don't show putts (auto = 1)
    if (par === 3 && score === 1) return [];
    
    // Eagle
    if (score === par - 2) return [0, 1];
    
    // Birdie  
    if (score === par - 1) return [0, 1, 2];
    
    // Par or worse
    return [0, 1, 2, '3+'];
  };

  const calculateGIR = (par, score, putts) => {
    // Hole in one is always GIR
    if (score === 1) return true;
    
    const strokesToGreen = score - putts;
    return strokesToGreen <= (par - 2);
  };

  const handleScoreSelect = (score) => {
    setCurrentScore(score);
    
    // For Par 3, clear fairway
    if (currentPar < 4) {
      setCurrentFairway(null);
    }
    
    // Check if hole in one (skip putts)
    if (currentPar === 3 && score === 1) {
      setCurrentFairway(null);
      saveHoleData(score, null, 1);
    }
  };

  const handleFairwaySelect = (fairway) => {
    setCurrentFairway(fairway);
  };

  const handlePuttsSelect = (putts) => {
    const finalPutts = putts === '3+' ? 3 : putts;
    saveHoleData(currentScore, currentFairway, finalPutts);
  };

  const saveHoleData = async (score, fairway, putts) => {
    const gir = calculateGIR(currentPar, score, putts);
    
    const holeData = {
      score,
      putts,
      fairway,
      gir,
      notes
    };

    // Update round data
    const updatedRound = { ...currentSoloRound };
    updatedRound.holes[currentHole] = holeData;

    // Recalculate stats
    const stats = calculateStats(updatedRound);
    updatedRound.stats = stats;

    // Save to Firebase
    try {
      await set(ref(database, `soloRounds/${updatedRound.id}`), updatedRound);
      
      // Update user's solo rounds list
      await set(ref(database, `users/${user.uid}/soloRounds/${updatedRound.id}`), {
        date: updatedRound.date,
        courseName: updatedRound.courseName,
        score: stats.totalScore,
        toPar: stats.toPar,
        numHoles: updatedRound.numHoles
      });

      setCurrentSoloRound(updatedRound);

      // Check if this is the final hole
      const endingHole = updatedRound.endingHole || 18;
      const isLastHole = currentHole === endingHole;

      if (isLastHole) {
        // Prompt to end round
        setTimeout(() => {
          if (confirm('Round complete! Would you like to finish and view your scorecard?')) {
            updatedRound.status = 'complete';
            set(ref(database, `soloRounds/${updatedRound.id}/status`), 'complete');
            setView('solo-scorecard');
          }
        }, 500);
      } else {
        // Auto-advance to next hole
        setTimeout(() => {
          goToHole(currentHole + 1);
        }, 500);
      }

    } catch (error) {
      console.error('Error saving hole data:', error);
    }
  };

  const calculateStats = (round) => {
    let totalScore = 0;
    let totalPutts = 0;
    let fairwaysHit = 0;
    let fairwaysPossible = 0;
    let greensInRegulation = 0;
    let stablefordPoints = 0;
    let holesPlayed = 0;

    for (let i = 1; i <= 18; i++) {
      const hole = round.holes[i];
      if (hole) {
        holesPlayed++;
        totalScore += hole.score;
        totalPutts += hole.putts;
        greensInRegulation += hole.gir ? 1 : 0;

        const par = round.coursePars[i - 1];
        
        // Fairway tracking (par 4 and 5 only)
        if (par >= 4) {
          fairwaysPossible++;
          if (hole.fairway === 'hit') {
            fairwaysHit++;
          }
        }

        if (round.format === 'stableford') {
          stablefordPoints += calculateStablefordPoints(hole.score, par);
        }
      }
    }

    const playedPars = round.coursePars.slice(0, holesPlayed);
    const parTotal = playedPars.reduce((sum, par) => sum + par, 0);
    const toPar = totalScore - parTotal;

    return {
      totalScore,
      toPar,
      totalPutts,
      fairwaysHit,
      fairwaysPossible,
      greensInRegulation,
      stablefordPoints
    };
  };

  const goToHole = (hole) => {
    const startingHole = currentSoloRound.startingHole || 1;
    const endingHole = currentSoloRound.endingHole || 18;
    
    if (hole < startingHole || hole > endingHole) return;
    
    const updatedRound = { ...currentSoloRound };
    updatedRound.currentHole = hole;
    setCurrentSoloRound(updatedRound);
  };

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

  const endRound = async () => {
    if (confirm('End round and save?')) {
      const updatedRound = { ...currentSoloRound };
      updatedRound.status = 'complete';
      
      try {
        await set(ref(database, `soloRounds/${updatedRound.id}`), updatedRound);
        setView('home');
      } catch (error) {
        console.error('Error ending round:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-2 md:p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={() => setView('home')} 
            className="text-white hover:text-blue-200"
          >
            ← Back
          </button>
          <button
            onClick={endRound}
            className="text-white hover:text-blue-200 font-semibold"
          >
            End Round
          </button>
        </div>

        {/* Stats Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{currentSoloRound.courseName}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600">Score</div>
              <div className="text-3xl font-bold text-gray-900">{currentSoloRound.stats.totalScore || 0}</div>
              <div className="text-sm text-gray-600">
                Thru {Object.keys(currentSoloRound.holes).length} holes
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">To Par</div>
              <div className="text-3xl font-bold text-gray-900">
                {currentSoloRound.stats.toPar > 0 ? '+' : ''}{currentSoloRound.stats.toPar || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">
                {currentSoloRound.format === 'stableford' ? 'Points' : 'Putts'}
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {currentSoloRound.format === 'stableford' 
                  ? currentSoloRound.stats.stablefordPoints 
                  : currentSoloRound.stats.totalPutts}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Fairways</div>
              <div className="text-3xl font-bold text-gray-900">
                {currentSoloRound.stats.fairwaysHit}/{currentSoloRound.stats.fairwaysPossible}
              </div>
              <div className="text-xs text-gray-500">
                {currentSoloRound.stats.fairwaysPossible > 0 
                  ? `${((currentSoloRound.stats.fairwaysHit / currentSoloRound.stats.fairwaysPossible) * 100).toFixed(0)}%`
                  : '0%'}
              </div>
            </div>
          </div>
        </div>

        {/* Hole Info */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => goToHole(currentHole - 1)}
              disabled={currentHole === (currentSoloRound.startingHole || 1)}
              className="bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed p-3 rounded-xl"
            >
              <ChevronLeftIcon />
            </button>

            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900">Hole {currentHole}</div>
              <div className="text-xl text-gray-600 mt-1">Par {currentPar}</div>
              <div className="text-sm text-gray-500">{currentYardage} yards</div>
              <div className="text-sm text-gray-500">SI: {currentSI}</div>
            </div>

            <button
              onClick={() => goToHole(currentHole + 1)}
              disabled={currentHole === (currentSoloRound.endingHole || 18)}
              className="bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed p-3 rounded-xl"
            >
              <ChevronRightIcon />
            </button>
          </div>

          {/* Score Entry - Always Visible */}
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

          {/* Fairway Entry - Shows after score entered (Par 4/5 only) */}
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

          {/* Putts Entry - Shows after fairway (or after score for Par 3) */}
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

        {/* Scorecard */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Scorecard</h2>
          
          {/* Determine which holes to show */}
          {(() => {
            const startingHole = currentSoloRound.startingHole || 1;
            const endingHole = currentSoloRound.endingHole || 18;
            const numHoles = currentSoloRound.numHoles || 18;

            // For 9-hole rounds, only show the 9 being played
            if (numHoles === 9) {
              const holes = Array.from({ length: 9 }, (_, i) => startingHole + i);
              const isFront9 = startingHole === 1;
              
              return (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    {isFront9 ? 'Front 9' : 'Back 9'}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="text-left p-2">Hole</th>
                          {holes.map(h => (
                            <th key={h} className="text-center p-2 min-w-[40px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-200">
                          <td className="p-2 text-gray-600">Par</td>
                          {holes.map(h => (
                            <td key={h} className="text-center p-2">{currentSoloRound.coursePars[h - 1]}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-2 text-gray-600">Score</td>
                          {holes.map(h => {
                            const hole = currentSoloRound.holes[h];
                            const par = currentSoloRound.coursePars[h - 1];
                            return (
                              <td 
                                key={h} 
                                className={`text-center p-2 cursor-pointer hover:bg-gray-100 ${getScoreColor(hole?.score, par)}`}
                                onClick={() => goToHole(h)}
                              >
                                {hole?.score || '-'}
                                {hole?.gir && <span className="text-green-600">●</span>}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // For 18-hole rounds, show both front and back 9
            return (
              <>
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
                            <td key={h} className="text-center p-2">{currentSoloRound.coursePars[h - 1]}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-2 text-gray-600">Score</td>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => {
                            const hole = currentSoloRound.holes[h];
                            const par = currentSoloRound.coursePars[h - 1];
                            return (
                              <td 
                                key={h} 
                                className={`text-center p-2 cursor-pointer hover:bg-gray-100 ${getScoreColor(hole?.score, par)}`}
                                onClick={() => goToHole(h)}
                              >
                                {hole?.score || '-'}
                                {hole?.gir && <span className="text-green-600">●</span>}
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
                            <td key={h} className="text-center p-2">{currentSoloRound.coursePars[h - 1]}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-2 text-gray-600">Score</td>
                          {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => {
                            const hole = currentSoloRound.holes[h];
                            const par = currentSoloRound.coursePars[h - 1];
                            return (
                              <td 
                                key={h} 
                                className={`text-center p-2 cursor-pointer hover:bg-gray-100 ${getScoreColor(hole?.score, par)}`}
                                onClick={() => goToHole(h)}
                              >
                                {hole?.score || '-'}
                                {hole?.gir && <span className="text-green-600">●</span>}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}

          <div className="mt-4 text-sm text-gray-600 text-center">
            ● = Green in Regulation · Tap any hole to edit
          </div>
        </div>
      </div>
    </div>
  );
}
