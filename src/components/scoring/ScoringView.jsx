import { useState, useEffect } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

// ============================================================
// UNIFIED SCORING VIEW
// Handles both solo rounds and team event scoring.
// 
// Mode is determined by which props are passed in:
//   - Solo mode:  currentSoloRound + setCurrentSoloRound + user
//   - Team mode:  currentEvent + setCurrentEvent + selectedTeam + setSelectedTeam
//
// Supports wrap-around hole order: an 18-hole round starting on
// hole 10 plays 10→18 then 1→9, with the scorecard displayed
// in that same order.
// ============================================================

export default function ScoringView({
  // --- Solo mode props ---
  currentSoloRound = null,
  setCurrentSoloRound = null,
  user = null,
  // --- Team mode props ---
  currentEvent = null,
  setCurrentEvent = null,
  selectedTeam = null,
  setSelectedTeam = null,
  // --- Shared props ---
  feedback = '',
  setFeedback = () => {},
  setView
}) {

  // ==================== MODE DETECTION ====================
  const isSolo = !!currentSoloRound;

  // ==================== DATA EXTRACTION ====================
  const team = !isSolo ? currentEvent?.teams?.[selectedTeam] : null;

  const coursePars = isSolo
    ? currentSoloRound.coursePars
    : currentEvent?.meta?.coursePars || [];

  const courseYardages = isSolo
    ? currentSoloRound.courseYardages || []
    : currentEvent?.meta?.courseYardages || [];

  const courseStrokeIndexes = isSolo
    ? currentSoloRound.courseStrokeIndexes || []
    : currentEvent?.meta?.courseStrokeIndexes || [];

  const format = isSolo
    ? currentSoloRound.format
    : currentEvent?.meta?.format || 'stroke';

  const courseName = isSolo
    ? currentSoloRound.courseName
    : currentEvent?.meta?.courseName || '';

  const startingHole = isSolo
    ? (currentSoloRound.startingHole || 1)
    : (currentEvent?.meta?.startingHole || 1);

  const endingHole = isSolo
    ? (currentSoloRound.endingHole || 18)
    : (currentEvent?.meta?.endingHole || 18);

  const numHoles = isSolo
    ? (currentSoloRound.numHoles || 18)
    : (currentEvent?.meta?.numHoles || 18);

  const currentHole = isSolo
    ? currentSoloRound.currentHole
    : team?.currentHole || 1;

  // ==================== HOLE ORDER ====================
  // Build an array of hole numbers in the order they're played.
  // For start=1, 18 holes:  [1, 2, 3, ..., 18]
  // For start=10, 18 holes: [10, 11, ..., 18, 1, 2, ..., 9]
  // For start=10, 9 holes:  [10, 11, ..., 18]
  // For start=1, 9 holes:   [1, 2, ..., 9]

  const buildHoleOrder = () => {
    const holes = [];
    for (let i = 0; i < numHoles; i++) {
      // Wrap around: (startingHole - 1 + i) mod 18 gives 0-17, then +1 for 1-18
      const holeNum = ((startingHole - 1 + i) % 18) + 1;
      holes.push(holeNum);
    }
    return holes;
  };

  const holeOrder = buildHoleOrder();

  // Get next/previous hole in play order (returns null if at the end/start)
  const getNextHole = (current) => {
    const idx = holeOrder.indexOf(current);
    if (idx === -1 || idx === holeOrder.length - 1) return null;
    return holeOrder[idx + 1];
  };

  const getPrevHole = (current) => {
    const idx = holeOrder.indexOf(current);
    if (idx <= 0) return null;
    return holeOrder[idx - 1];
  };

  // Is this the first/last hole in the play order?
  const isFirstHole = holeOrder[0] === currentHole;
  const isLastHole = holeOrder[holeOrder.length - 1] === currentHole;

  // Split holeOrder into two halves for the scorecard display.
  // For 18 holes: first 9 shown as "OUT", last 9 as "IN"
  // For 9 holes: just one section
  const first9 = numHoles === 18 ? holeOrder.slice(0, 9) : holeOrder;
  const second9 = numHoles === 18 ? holeOrder.slice(9, 18) : [];

  // Labels for scorecard sections
  const first9Label = numHoles === 9
    ? (startingHole === 1 ? 'Front 9' : 'Back 9')
    : 'OUT';
  const second9Label = 'IN';

  // ==================== NOT FOUND STATES ====================

  if (!isSolo && !team) {
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

  if (isSolo && !currentSoloRound) {
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

  // ==================== LOCAL STATE ====================
  const [currentScore, setCurrentScore] = useState(null);
  const [currentFairway, setCurrentFairway] = useState(null);
  const [notes, setNotes] = useState('');

  // ==================== HOLE DATA ACCESS ====================

  const getHoleData = (hole) => {
    if (isSolo) {
      return currentSoloRound.holes[hole] || null;
    }
    if (team.holes && team.holes[hole]) {
      return team.holes[hole];
    }
    if (team.scores && team.scores[hole]) {
      return { score: team.scores[hole], putts: null, fairway: null, gir: null, notes: '' };
    }
    return null;
  };

  const currentPar = coursePars[currentHole - 1];
  const currentYardage = courseYardages[currentHole - 1];
  const currentSI = courseStrokeIndexes[currentHole - 1];
  const holeData = getHoleData(currentHole);

  // ==================== EFFECTS ====================

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

  useEffect(() => {
    if (!isSolo) return;
    const stats = calculateStats(null, null);
    if (JSON.stringify(stats) !== JSON.stringify(currentSoloRound.stats)) {
      const updatedRound = { ...currentSoloRound };
      updatedRound.stats = stats;
      setCurrentSoloRound(updatedRound);
    }
  }, [currentHole, isSolo ? currentSoloRound.holes : null]);

  // ==================== CALCULATIONS ====================

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

  const calculateGIR = (par, score, putts) => {
    if (score === 1) return true;
    if (putts === null || putts === undefined) return false;
    const strokesToGreen = score - putts;
    return strokesToGreen <= (par - 2);
  };

  const getPuttOptions = (par, score) => {
    if (!score) return [];
    if (par === 3 && score === 1) return [];
    if (score === par - 2) return [0, 1];
    if (score === par - 1) return [0, 1, 2];
    return [0, 1, 2, '3+'];
  };

  const calculateStats = (justSavedHole, justSavedData) => {
    let totalScore = 0;
    let totalPutts = 0;
    let totalPoints = 0;
    let fairwaysHit = 0;
    let fairwaysPossible = 0;
    let greensInRegulation = 0;
    let holesPlayed = 0;

    // Only count holes that are part of this round
    for (const holeNum of holeOrder) {
      const hole = (holeNum === justSavedHole) ? justSavedData : getHoleData(holeNum);
      if (hole && hole.score) {
        holesPlayed++;
        totalScore += hole.score;
        totalPutts += hole.putts || 0;
        greensInRegulation += hole.gir ? 1 : 0;

        const par = coursePars[holeNum - 1];
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

    // Calculate par for holes played (in play order)
    const playedHoleNums = holeOrder.slice(0, holesPlayed);
    const parTotal = playedHoleNums.reduce((sum, h) => sum + (coursePars[h - 1] || 0), 0);
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

  // ==================== HANDLERS ====================

  const handleScoreSelect = (score) => {
    setCurrentScore(score);
    if (currentPar < 4) {
      setCurrentFairway(null);
    }
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

  // ==================== SAVE ====================

  const saveHoleData = async (score, fairway, putts) => {
    if (!score || score < 1 || score > 15) {
      setFeedback('Please enter a valid score');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }

    const gir = calculateGIR(currentPar, score, putts);
    const holeEntry = { score, putts, fairway, gir, notes };

    try {
      if (isSolo) {
        const updatedRound = { ...currentSoloRound };
        updatedRound.holes[currentHole] = holeEntry;
        const stats = calculateStats(currentHole, holeEntry);
        updatedRound.stats = stats;

        await set(ref(database, `soloRounds/${updatedRound.id}`), updatedRound);
        await set(ref(database, `users/${user.uid}/soloRounds/${updatedRound.id}`), {
          date: updatedRound.date,
          courseName: updatedRound.courseName,
          score: stats.totalScore,
          toPar: stats.toPar,
          numHoles: updatedRound.numHoles
        });

        setCurrentSoloRound(updatedRound);

        if (isLastHole) {
          setTimeout(() => {
            if (confirm('Round complete! Would you like to finish and view your scorecard?')) {
              updatedRound.status = 'complete';
              set(ref(database, `soloRounds/${updatedRound.id}/status`), 'complete');
              setView('solo-scorecard');
            }
          }, 500);
        } else {
          const next = getNextHole(currentHole);
          if (next) setTimeout(() => goToHole(next), 500);
        }

      } else {
        await set(
          ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/holes/${currentHole}`),
          holeEntry
        );
        await set(
          ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/scores/${currentHole}`),
          parseInt(score)
        );
        const updatedStats = calculateStats(currentHole, holeEntry);
        await set(
          ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/stats`),
          updatedStats
        );

        setTimeout(async () => {
          const next = getNextHole(currentHole);
          if (next) {
            await set(
              ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/currentHole`),
              next
            );
          }
          const eventSnapshot = await get(ref(database, `events/${currentEvent.id}`));
          const updatedEvent = eventSnapshot.val();
          setCurrentEvent({ id: currentEvent.id, ...updatedEvent });
        }, 500);
      }
    } catch (error) {
      console.error('Error saving score:', error);
      setFeedback('Error saving score');
      setTimeout(() => setFeedback(''), 2000);
    }
  };

  // ==================== NAVIGATION ====================

  const goToHole = (hole) => {
    // Only allow navigation to holes in the play order
    if (!holeOrder.includes(hole)) return;

    if (isSolo) {
      const updatedRound = { ...currentSoloRound };
      updatedRound.currentHole = hole;
      setCurrentSoloRound(updatedRound);
    } else {
      set(
        ref(database, `events/${currentEvent.id}/teams/${selectedTeam}/currentHole`),
        hole
      ).then(async () => {
        const eventSnapshot = await get(ref(database, `events/${currentEvent.id}`));
        const updatedEvent = eventSnapshot.val();
        setCurrentEvent({ id: currentEvent.id, ...updatedEvent });
      }).catch(error => {
        console.error('Error changing hole:', error);
      });
    }
  };

  const endRound = async () => {
    if (!confirm('End round and save?')) return;
    if (isSolo) {
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

  const handleBack = () => {
    if (isSolo) {
      setView('home');
    } else {
      setSelectedTeam(null);
      setView('event-lobby');
    }
  };

  // ==================== DISPLAY HELPERS ====================

  const stats = calculateStats(null, null);

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

  // Helper to render a scorecard section (used for both halves)
  const renderScorecardSection = (holes, label) => (
    <div className={label === first9Label ? 'mb-6' : ''}>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{label}</h3>
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
                <td key={h} className="text-center p-2">{coursePars[h - 1]}</td>
              ))}
            </tr>
            <tr>
              <td className="p-2 text-gray-600">Score</td>
              {holes.map(h => {
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
  );

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-2 md:p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <button onClick={handleBack} className="text-white hover:text-blue-200">
            ← {isSolo ? 'Back' : 'Back to Lobby'}
          </button>
          {isSolo && (
            <button
              onClick={endRound}
              className="text-white hover:text-blue-200 font-semibold"
            >
              End Round
            </button>
          )}
        </div>

        {/* Stats Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
          {isSolo ? (
            <h2 className="text-xl font-bold text-gray-900 mb-4">{courseName}</h2>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{team.name}</h1>
              <div className="text-sm text-gray-600 mb-4">{team.players.join(' & ')}</div>
            </>
          )}

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
              onClick={() => { const prev = getPrevHole(currentHole); if (prev) goToHole(prev); }}
              disabled={isFirstHole}
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
              onClick={() => { const next = getNextHole(currentHole); if (next) goToHole(next); }}
              disabled={isLastHole}
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

          {/* Fairway Entry */}
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

          {/* Putts Entry */}
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

          {renderScorecardSection(first9, first9Label)}
          {second9.length > 0 && renderScorecardSection(second9, second9Label)}

          <div className="mt-4 text-sm text-gray-600 text-center">
            ● = Green in Regulation · Tap any hole to edit
          </div>
        </div>
      </div>
    </div>
  );
}
