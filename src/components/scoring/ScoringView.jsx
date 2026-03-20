import { useState, useEffect } from 'react';
import { ref, get, set, remove } from 'firebase/database';
import { database } from '../../firebase';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

// ============================================================
// UNIFIED SCORING VIEW
// Handles solo rounds, individual event scoring, AND team event scoring.
// 
// Mode is determined by which props are passed in:
//   - Solo mode:  currentSoloRound + setCurrentSoloRound + user
//   - Event mode: currentEvent + setCurrentEvent + selectedTeam + setSelectedTeam + currentUser
//
// In event mode, selectedTeam can be either:
//   - A team ID (like "team-1234") for team formats → reads/writes to events/{id}/teams/{teamId}
//   - A user ID for individual formats → reads/writes to events/{id}/players/{userId}
//
// The component detects which mode by checking if selectedTeam exists
// in currentEvent.teams (team format) or currentEvent.players (individual).
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
  // --- Event mode props ---
  currentEvent = null,
  setCurrentEvent = null,
  selectedTeam = null,
  setSelectedTeam = null,
  currentUser = null,
  // --- Shared props ---
  feedback = '',
  setFeedback = () => {},
  setView
}) {

  // ==================== MODE DETECTION ====================
  const isSolo = !!currentSoloRound;

  // ==================== TEAM vs INDIVIDUAL DETECTION ====================
  // In event mode, figure out if we're scoring for a team or an individual.
  // If selectedTeam is found in currentEvent.teams, it's a team format.
  // Otherwise, fall back to the old individual player path.

  const isTeamFormat = !isSolo && currentEvent?.teams && currentEvent.teams[selectedTeam];

  // The data source: either a team object or an individual player object
  const scoringUnit = isSolo
    ? null
    : isTeamFormat
      ? currentEvent.teams[selectedTeam]
      : currentEvent?.players?.[selectedTeam] || null;

  // The Firebase path prefix for saving scores
  const scoringBasePath = !isSolo
    ? isTeamFormat
      ? `events/${currentEvent.id}/teams/${selectedTeam}`
      : `events/${currentEvent.id}/players/${selectedTeam}`
    : null;

  // Display name for the header
  const scoringDisplayName = isSolo
    ? null
    : isTeamFormat
      ? (scoringUnit?.name || 'Team')
      : (scoringUnit?.displayName || 'Player');

  // ==================== MULLIGAN DETECTION ====================
  const usesMulligans = !isSolo && currentEvent?.meta?.handicap?.enabled && currentEvent?.meta?.handicap?.applicationMethod === 'mulligans';
  const mulligansTotal = !isSolo ? (scoringUnit?.mulligansTotal || 0) : 0;
  const mulligansRemaining = !isSolo ? (scoringUnit?.mulligansRemaining ?? mulligansTotal) : 0;

  // Build list of team member names for display (team format only)
  const teamMemberNames = isTeamFormat
    ? Object.keys(scoringUnit?.members || {}).map(uid =>
        currentEvent.players?.[uid]?.displayName || 'Unknown'
      )
    : [];

  // ==================== DATA EXTRACTION ====================

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
    : scoringUnit?.currentHole || startingHole;

  // ==================== HOLE ORDER ====================
  const buildHoleOrder = () => {
    const holes = [];
    for (let i = 0; i < numHoles; i++) {
      const holeNum = ((startingHole - 1 + i) % 18) + 1;
      holes.push(holeNum);
    }
    return holes;
  };

  const holeOrder = buildHoleOrder();

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

  const isFirstHole = holeOrder[0] === currentHole;
  const isLastHole = holeOrder[holeOrder.length - 1] === currentHole;

  const first9 = numHoles === 18 ? holeOrder.slice(0, 9) : holeOrder;
  const second9 = numHoles === 18 ? holeOrder.slice(9, 18) : [];

  const first9Label = numHoles === 9
    ? (startingHole === 1 ? 'Front 9' : 'Back 9')
    : 'OUT';
  const second9Label = 'IN';

  // ==================== NOT FOUND STATES ====================

  if (!isSolo && !scoringUnit) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">
            {isTeamFormat ? 'Team not found in this event' : 'Player not found in this event'}
          </p>
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
  const [currentPutts, setCurrentPutts] = useState(null);
  const [notes, setNotes] = useState('');
  const [confirmingMulligan, setConfirmingMulligan] = useState(false);
  const [showCustomScore, setShowCustomScore] = useState(false);

  // ============================================================
  // FIX #3: trackStats is now initialized from the player's saved
  // preference in Firebase. When the user toggles it, we write
  // the new value to Firebase so it survives navigation (e.g.
  // going to the Live Leaderboard and back).
  //
  // For individual event mode: reads/writes events/{id}/players/{uid}/trackStats
  // For team mode: not shown (team mode doesn't show the toggle)
  // For solo mode: always tracks stats, this toggle isn't used
  // ============================================================
  const savedTrackStats = !isSolo && !isTeamFormat
    ? (currentEvent?.players?.[selectedTeam]?.trackStats || false)
    : false;
  const [trackStats, setTrackStats] = useState(savedTrackStats);

  // Handler for the Track Stats toggle — saves preference to Firebase
  const handleTrackStatsToggle = async () => {
    const newValue = !trackStats;
    setTrackStats(newValue);

    // Persist to Firebase so it survives navigation
    if (!isSolo && !isTeamFormat && currentEvent?.id && selectedTeam) {
      try {
        await set(
          ref(database, `events/${currentEvent.id}/players/${selectedTeam}/trackStats`),
          newValue
        );
      } catch (err) {
        console.error('Error saving trackStats preference:', err);
      }
    }
  };

  // ==================== HOLE DATA ACCESS ====================

  const getHoleData = (hole) => {
    if (isSolo) {
      return currentSoloRound.holes[hole] || null;
    }
    if (scoringUnit.holes && scoringUnit.holes[hole]) {
      return scoringUnit.holes[hole];
    }
    if (scoringUnit.scores && scoringUnit.scores[hole]) {
      return { score: scoringUnit.scores[hole], putts: null, fairway: null, gir: null, notes: '' };
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
      setCurrentPutts(holeData.putts);
      setNotes(holeData.notes || '');
    } else {
      setCurrentScore(null);
      setCurrentFairway(null);
      setCurrentPutts(null);
      setNotes('');
    }
    setConfirmingMulligan(false);
    setShowCustomScore(false);
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
  // NEW FLOW: Score selection never auto-saves. User must explicitly
  // confirm with "Save & Next". This prevents accidental double-taps
  // from scoring the wrong hole.

  // Whether we're in the full stat-tracking flow (fairway → putts → confirm)
  const useStatFlow = isSolo || trackStats;

  const handleScoreSelect = (score) => {
    // If this is the Triple+ button, open custom score mode
    if (score === currentPar + 3) {
      setShowCustomScore(true);
      setCurrentScore(currentPar + 3);
      setCurrentPutts(null);
      return;
    }
    setShowCustomScore(false);
    setCurrentScore(score);
    setCurrentPutts(null);

    // For stat tracking: reset fairway on par 3s (no fairway needed)
    if (useStatFlow && currentPar < 4) {
      setCurrentFairway(null);
    }
  };

  const handleCustomScoreConfirm = () => {
    if (!currentScore || currentScore < 1) return;
    setShowCustomScore(false);
    setCurrentPutts(null);
    // For stat tracking: reset fairway on par 3s
    if (useStatFlow && currentPar < 4) {
      setCurrentFairway(null);
    }
  };

  const handleFairwaySelect = (fairway) => {
    setCurrentFairway(fairway);
  };

  const handlePuttsSelect = (putts) => {
    // Just select the putts — don't save yet. User confirms with Save & Next.
    const finalPutts = putts === '3+' ? 3 : putts;
    setCurrentPutts(finalPutts);
  };

  // Determine if we have everything needed to save
  const isReadyToSave = (() => {
    if (!currentScore) return false;
    if (!useStatFlow) return true; // No stats needed, score alone is enough
    // Hole-in-one on par 3: no fairway or putts needed
    if (currentPar === 3 && currentScore === 1) return true;
    // Par 4+: need fairway AND putts
    if (currentPar >= 4 && !currentFairway) return false;
    // Need putts (unless no putt options exist for this score)
    const opts = getPuttOptions(currentPar, currentScore);
    if (opts.length > 0 && currentPutts === null) return false;
    return true;
  })();

  // Save and advance to next hole
  const handleConfirmAndNext = () => {
    if (!isReadyToSave) return;

    const finalPutts = useStatFlow
      ? (currentPar === 3 && currentScore === 1 ? 1 : currentPutts)
      : null;
    const finalFairway = useStatFlow ? currentFairway : null;

    saveHoleData(currentScore, finalFairway, finalPutts);
  };

  // Clear current selection without saving
  const handleClearScore = () => {
    setCurrentScore(null);
    setCurrentFairway(null);
    setCurrentPutts(null);
    setShowCustomScore(false);
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
        // ===== EVENT MODE (team or individual) =====
        // scoringBasePath is either events/{id}/teams/{teamId} or events/{id}/players/{userId}
        await set(
          ref(database, `${scoringBasePath}/holes/${currentHole}`),
          holeEntry
        );
        await set(
          ref(database, `${scoringBasePath}/scores/${currentHole}`),
          parseInt(score)
        );
        const updatedStats = calculateStats(currentHole, holeEntry);
        await set(
          ref(database, `${scoringBasePath}/stats`),
          updatedStats
        );

        setTimeout(async () => {
          const next = getNextHole(currentHole);
          if (next) {
            await set(
              ref(database, `${scoringBasePath}/currentHole`),
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
    if (!holeOrder.includes(hole)) return;

    if (isSolo) {
      const updatedRound = { ...currentSoloRound };
      updatedRound.currentHole = hole;
      setCurrentSoloRound(updatedRound);
    } else {
      set(
        ref(database, `${scoringBasePath}/currentHole`),
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

  // ==================== MULLIGAN ====================

  const useMulligan = async () => {
    if (mulligansRemaining <= 0) {
      setFeedback('No mulligans remaining');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }

    try {
      const newRemaining = mulligansRemaining - 1;
      await set(ref(database, `${scoringBasePath}/mulligansRemaining`), newRemaining);

      // Log the mulligan usage on this hole
      const mulliganLog = scoringUnit?.mulliganLog || {};
      const holeLog = mulliganLog[currentHole] || 0;
      await set(ref(database, `${scoringBasePath}/mulliganLog/${currentHole}`), holeLog + 1);

      // Refresh event data
      const eventSnapshot = await get(ref(database, `events/${currentEvent.id}`));
      const updatedEvent = eventSnapshot.val();
      setCurrentEvent({ id: currentEvent.id, ...updatedEvent });

      setFeedback(`Mulligan used! ${newRemaining} remaining`);
      setTimeout(() => setFeedback(''), 2000);
      setConfirmingMulligan(false);
    } catch (error) {
      console.error('Error using mulligan:', error);
      setFeedback('Error using mulligan');
      setTimeout(() => setFeedback(''), 2000);
    }
  };

const handleBack = async () => {
    if (isSolo) {
      setView('home');
    } else {
      // Clear the scoring lock if this is a team format
      if (isTeamFormat) {
        try {
          await remove(ref(database, `${scoringBasePath}/scoringLockedBy`));
        } catch (err) {
          console.error('Error clearing scoring lock:', err);
        }
      }
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
    { label: 'Double', value: currentPar + 2, color: 'bg-red-500 hover:bg-red-600' },
    { label: 'Triple+', value: currentPar + 3, color: 'bg-red-800 hover:bg-red-900' }
  ].filter(btn => btn.value >= 1);

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
                const holeMulligans = !isSolo ? (scoringUnit?.mulliganLog?.[h] || 0) : 0;
                return (
                  <td
                    key={h}
                    className={`text-center p-2 cursor-pointer hover:bg-gray-100 ${getScoreColor(hole?.score, par)}`}
                    onClick={() => goToHole(h)}
                  >
                    {hole?.score || '-'}
                    {(isSolo || trackStats) && hole?.gir && <span className="text-green-600 text-xs">●</span>}
                    {holeMulligans > 0 && <span className="text-purple-500 text-xs">{'🎟️'.repeat(holeMulligans)}</span>}
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
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {scoringDisplayName}
              </h1>
              {isTeamFormat && teamMemberNames.length > 0 && (
                <div className="text-sm text-gray-500 mb-1">
                  {teamMemberNames.join(' & ')}
                </div>
              )}
              <div className="text-sm text-gray-600 mb-4">{courseName}</div>
            </>
          )}

          <div className={`grid ${(isSolo || trackStats) ? 'grid-cols-2 md:grid-cols-5' : usesMulligans ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
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
            {usesMulligans && (
              <div className="text-center">
                <div className="text-sm text-gray-600">Mulligans</div>
                <div className={`text-3xl font-bold ${mulligansRemaining > 0 ? 'text-purple-700' : 'text-gray-400'}`}>
                  {mulligansRemaining}
                </div>
                <div className="text-sm text-gray-600">of {mulligansTotal}</div>
              </div>
            )}
            {(isSolo || trackStats) && (
              <>
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
                {/* ============================================================
                    FIX #5: GIR stat added to the stats header.
                    Shows greens hit as a fraction (e.g. 3/8) with a percentage.
                    Matches the existing Fairways display pattern.
                   ============================================================ */}
                <div className="text-center">
                  <div className="text-sm text-gray-600">GIR</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {stats.greensInRegulation}/{stats.holesPlayed}
                  </div>
                  <div className="text-xs text-gray-500">
                    {stats.holesPlayed > 0
                      ? `${((stats.greensInRegulation / stats.holesPlayed) * 100).toFixed(0)}%`
                      : '0%'}
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
              </>
            )}
          </div>

          {/* Track Stats Toggle — event mode only (individual, non-team) */}
          {!isSolo && !isTeamFormat && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-700">Track Stats</div>
                <div className="text-xs text-gray-500">Fairways, putts, GIR</div>
              </div>
              <button
                onClick={handleTrackStatsToggle}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  trackStats ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    trackStats ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
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

          {/* Mulligan — shown ABOVE score entry so it's logged before scoring */}
          {usesMulligans && !confirmingMulligan && (
            <div className="mb-4 pb-4 border-b border-gray-200">
              {mulligansRemaining > 0 ? (
                <>
                  <button
                    onClick={() => setConfirmingMulligan(true)}
                    className="w-full bg-purple-100 hover:bg-purple-200 text-purple-700 py-2.5 rounded-xl font-semibold transition-all text-sm"
                  >
                    🎟️ Use Mulligan ({mulligansRemaining} left)
                  </button>
                  {(scoringUnit?.mulliganLog?.[currentHole] || 0) > 0 && (
                    <button
                      onClick={async () => {
                        if (!confirm('Undo a mulligan on this hole?')) return;
                        try {
                          const holeCount = scoringUnit.mulliganLog[currentHole];
                          const newRemaining = mulligansRemaining + 1;
                          await set(ref(database, `${scoringBasePath}/mulligansRemaining`), newRemaining);
                          if (holeCount <= 1) {
                            await remove(ref(database, `${scoringBasePath}/mulliganLog/${currentHole}`));
                          } else {
                            await set(ref(database, `${scoringBasePath}/mulliganLog/${currentHole}`), holeCount - 1);
                          }
                          const eventSnapshot = await get(ref(database, `events/${currentEvent.id}`));
                          setCurrentEvent({ id: currentEvent.id, ...eventSnapshot.val() });
                          setFeedback(`Mulligan restored! ${newRemaining} remaining`);
                          setTimeout(() => setFeedback(''), 2000);
                        } catch (error) {
                          console.error('Error undoing mulligan:', error);
                          setFeedback('Error undoing mulligan');
                          setTimeout(() => setFeedback(''), 2000);
                        }
                      }}
                      className="w-full mt-2 text-sm text-purple-400 hover:text-purple-600 transition-all"
                    >
                      ↩ Undo mulligan on this hole ({scoringUnit.mulliganLog[currentHole]} used)
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="text-center text-sm text-gray-400 font-semibold">
                    🎟️ No mulligans remaining
                  </div>
                  {(scoringUnit?.mulliganLog?.[currentHole] || 0) > 0 && (
                    <button
                      onClick={async () => {
                        if (!confirm('Undo a mulligan on this hole?')) return;
                        try {
                          const holeCount = scoringUnit.mulliganLog[currentHole];
                          const newRemaining = mulligansRemaining + 1;
                          await set(ref(database, `${scoringBasePath}/mulligansRemaining`), newRemaining);
                          if (holeCount <= 1) {
                            await remove(ref(database, `${scoringBasePath}/mulliganLog/${currentHole}`));
                          } else {
                            await set(ref(database, `${scoringBasePath}/mulliganLog/${currentHole}`), holeCount - 1);
                          }
                          const eventSnapshot = await get(ref(database, `events/${currentEvent.id}`));
                          setCurrentEvent({ id: currentEvent.id, ...eventSnapshot.val() });
                          setFeedback(`Mulligan restored! ${newRemaining} remaining`);
                          setTimeout(() => setFeedback(''), 2000);
                        } catch (error) {
                          console.error('Error undoing mulligan:', error);
                          setFeedback('Error undoing mulligan');
                          setTimeout(() => setFeedback(''), 2000);
                        }
                      }}
                      className="w-full mt-2 text-sm text-purple-400 hover:text-purple-600 transition-all"
                    >
                      ↩ Undo mulligan on this hole ({scoringUnit.mulliganLog[currentHole]} used)
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Mulligan Confirmation */}
          {usesMulligans && confirmingMulligan && (
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-center text-sm text-gray-700 mb-3">
                Use a mulligan on Hole {currentHole}?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={useMulligan}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition-all"
                >
                  ✓ Confirm Mulligan
                </button>
                <button
                  onClick={() => setConfirmingMulligan(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Score Entry */}
          <div className="mb-4">
            <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Score</h3>
            <div className="grid grid-cols-3 gap-2">
              {quickScoreButtons.map(btn => (
                <button
                  key={btn.label}
                  onClick={() => handleScoreSelect(btn.value)}
                  className={`${
                    currentScore === btn.value && !(showCustomScore && btn.label === 'Triple+')
                      ? 'ring-4 ring-blue-400'
                      : ''
                  } ${showCustomScore && btn.label === 'Triple+' ? 'ring-4 ring-blue-400' : ''} ${btn.color} text-white py-4 rounded-xl font-semibold shadow-lg transition-all`}
                >
                  <div className="text-sm">{btn.label}</div>
                  <div className="text-2xl font-bold">{btn.label === 'Triple+' ? `${btn.value}+` : btn.value}</div>
                </button>
              ))}
            </div>

            {/* Custom Score Adjuster — shown when Triple+ is tapped */}
            {showCustomScore && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-center text-sm text-gray-600 mb-3">Adjust Score</div>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setCurrentScore(Math.max(currentPar + 3, currentScore - 1))}
                    disabled={currentScore <= currentPar + 3}
                    className="bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed w-14 h-14 rounded-xl text-2xl font-bold"
                  >
                    −
                  </button>
                  <div className="text-5xl font-bold text-gray-900 w-20 text-center">{currentScore}</div>
                  <button
                    onClick={() => setCurrentScore(Math.min(15, currentScore + 1))}
                    disabled={currentScore >= 15}
                    className="bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed w-14 h-14 rounded-xl text-2xl font-bold"
                  >
                    +
                  </button>
                </div>
                <div className="text-center text-xs text-gray-400 mt-1">
                  +{currentScore - currentPar} over par
                </div>
                <button
                  onClick={() => {
                    // Just close the custom adjuster — the Save & Next button
                    // below will handle the actual save
                    setShowCustomScore(false);
                    setCurrentPutts(null);
                    if (useStatFlow && currentPar < 4) {
                      setCurrentFairway(null);
                    }
                  }}
                  className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-all"
                >
                  Confirm Score: {currentScore}
                </button>
              </div>
            )}
          </div>

          {/* Fairway Entry — solo or when tracking stats */}
          {useStatFlow && currentScore && !showCustomScore && currentPar >= 4 && (
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

          {/* Putts Entry — solo or when tracking stats */}
          {useStatFlow && currentScore && !showCustomScore && (currentPar < 4 || currentFairway) && puttOptions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Putts</h3>
              <div className="grid grid-cols-4 gap-3">
                {puttOptions.map(putts => {
                  const puttVal = putts === '3+' ? 3 : putts;
                  return (
                    <button
                      key={putts}
                      onClick={() => handlePuttsSelect(putts)}
                      className={`${
                        currentPutts === puttVal ? 'ring-4 ring-blue-400' : ''
                      } bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                    >
                      {putts}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================
              SAVE & NEXT / CLEAR CONFIRMATION BAR
              Shows whenever a score is selected. Prevents accidental
              double-taps from scoring the wrong hole.
             ============================================================ */}
          {currentScore && !showCustomScore && (
            <div className="mb-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="text-center mb-3">
                <div className="text-sm text-gray-600">
                  Hole {currentHole} — Selected:
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {currentScore} ({currentScore < currentPar ? currentScore - currentPar : currentScore === currentPar ? 'E' : '+' + (currentScore - currentPar)})
                  {useStatFlow && currentFairway && ` · ${currentFairway === 'hit' ? 'FW' : currentFairway.charAt(0).toUpperCase() + currentFairway.slice(1)}`}
                  {useStatFlow && currentPutts !== null && ` · ${currentPutts}P`}
                </div>
                {!isReadyToSave && useStatFlow && (
                  <div className="text-xs text-amber-600 mt-1">
                    {currentPar >= 4 && !currentFairway ? 'Select fairway →' : 'Select putts →'}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmAndNext}
                  disabled={!isReadyToSave}
                  className={`flex-1 py-3 rounded-xl font-semibold text-lg transition-all ${
                    isReadyToSave
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  ✓ Save & Next
                </button>
                <button
                  onClick={handleClearScore}
                  className="px-5 py-3 rounded-xl font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition-all"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Mulligans are now shown above the score entry */}
        </div>

        {/* Notes — solo only */}

        {/* Notes — solo only */}
        {isSolo && (
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
        )}

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
            {(isSolo || trackStats) && '● = Green in Regulation · '}
            {usesMulligans && '🎟️ = Mulligan used · '}
            Tap any hole to edit
          </div>
        </div>
      </div>
    </div>
  );
}
