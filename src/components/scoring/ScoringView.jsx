import { useState, useEffect } from 'react';
import { ref, get, set, remove } from 'firebase/database';
import { database } from '../../firebase';
import { buildHoleOrder } from '../../utils/holes';
import { getPlayerCourseHandicap, getStrokeHoles } from '../../utils/handicap';
import RoundCompleteModal from './RoundCompleteModal';
import ScoringHeader from './ScoringHeader';
import HoleCard from './HoleCard';
import Scorecard from './Scorecard';

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
  const isTeamFormat = !isSolo && currentEvent?.teams && currentEvent.teams[selectedTeam];

  const scoringUnit = isSolo
    ? null
    : isTeamFormat
      ? currentEvent.teams[selectedTeam]
      : currentEvent?.players?.[selectedTeam] || null;

  const scoringBasePath = !isSolo
    ? isTeamFormat
      ? `events/${currentEvent.id}/teams/${selectedTeam}`
      : `events/${currentEvent.id}/players/${selectedTeam}`
    : null;

  const scoringDisplayName = isSolo
    ? null
    : isTeamFormat
      ? (scoringUnit?.name || 'Team')
      : (scoringUnit?.displayName || 'Player');

  // ==================== MULLIGAN DETECTION ====================
  const usesMulligans = !isSolo && currentEvent?.meta?.handicap?.enabled && currentEvent?.meta?.handicap?.applicationMethod === 'mulligans';
  const mulligansTotal = !isSolo ? (scoringUnit?.mulligansTotal || 0) : 0;
  const mulligansRemaining = !isSolo ? (scoringUnit?.mulligansRemaining ?? mulligansTotal) : 0;

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
    : currentEvent?.meta?.scoringMethod || 'stroke';

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
  const holeOrder = buildHoleOrder(numHoles, startingHole);

  // ==================== HANDICAP STROKE HOLES ====================
  const handicapEnabled = !isSolo && currentEvent?.meta?.handicap?.enabled;
  const strokeHoles = (() => {
    if (!handicapEnabled || format !== 'stableford') return {};
    const playerHandicap = isTeamFormat
      ? (() => {
          const hcps = Object.keys(scoringUnit?.members || {})
            .map(uid => currentEvent.players?.[uid]?.handicap)
            .filter(h => h != null);
          return hcps.length > 0 ? hcps.reduce((s, h) => s + h, 0) / hcps.length : null;
        })()
      : scoringUnit?.handicap;
    const coursePar = coursePars.reduce((sum, p) => sum + (p || 0), 0);
    const courseHandicap = getPlayerCourseHandicap(playerHandicap, {
      handicapEnabled,
      courseSlope: currentEvent?.meta?.courseSlope || null,
      courseRating: currentEvent?.meta?.courseRating || null,
      coursePar,
      handicapAllowance: currentEvent?.meta?.handicap?.allowance || 100
    });
    return getStrokeHoles(courseHandicap, { handicapEnabled, courseStrokeIndexes });
  })();

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
      <div className="min-h-screen bg-[#00285e] p-6 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">
            {isTeamFormat ? 'Team not found in this event' : 'Player not found in this event'}
          </p>
          <button onClick={() => setView('event-lobby')} className="bg-white text-[#004f4e] px-6 py-3 rounded-xl font-semibold">
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (isSolo && !currentSoloRound) {
    return (
      <div className="min-h-screen bg-[#00285e] p-6 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Round not found</p>
          <button onClick={() => setView('home')} className="bg-white text-[#004f4e] px-6 py-3 rounded-xl font-semibold">
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
  const [showRoundComplete, setShowRoundComplete] = useState(false);

  const savedTrackStats = !isSolo && !isTeamFormat
    ? (currentEvent?.players?.[selectedTeam]?.trackStats || false)
    : false;
  const [trackStats, setTrackStats] = useState(savedTrackStats);

  // Handler for the Track Stats toggle — saves preference to Firebase
  const handleTrackStatsToggle = async () => {
    const newValue = !trackStats;
    setTrackStats(newValue);

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
          const strokesOnHole = strokeHoles[holeNum] || 0;
          totalPoints += calculateStablefordPoints(hole.score, par + strokesOnHole);
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

  const useStatFlow = isSolo || trackStats;

  const handleScoreSelect = (score) => {
    if (score === currentPar + 3 && (maxHoleScore === null || strokesOnCurrentHole >= 2)) {
      setShowCustomScore(true);
      setCurrentScore(currentPar + 3);
      setCurrentPutts(null);
      return;
    }
    setShowCustomScore(false);
    setCurrentScore(score);
    setCurrentPutts(null);

    if (useStatFlow && currentPar < 4) {
      setCurrentFairway(null);
    }
  };

  const handleCustomScoreConfirm = () => {
    if (!currentScore || currentScore < 1) return;
    setShowCustomScore(false);
    setCurrentPutts(null);
    if (useStatFlow && currentPar < 4) {
      setCurrentFairway(null);
    }
  };

  const handleFairwaySelect = (fairway) => {
    setCurrentFairway(fairway);
  };

  const handlePuttsSelect = (putts) => {
    const finalPutts = putts === '3+' ? 3 : putts;
    setCurrentPutts(finalPutts);
  };

  const isReadyToSave = (() => {
    if (!currentScore) return false;
    if (!useStatFlow) return true;
    if (currentPar === 3 && currentScore === 1) return true;
    if (currentPar >= 4 && !currentFairway) return false;
    const opts = getPuttOptions(currentPar, currentScore);
    if (opts.length > 0 && currentPutts === null) return false;
    return true;
  })();

  const handleConfirmAndNext = () => {
    if (!isReadyToSave) return;

    const finalPutts = useStatFlow
      ? (currentPar === 3 && currentScore === 1 ? 1 : currentPutts)
      : null;
    const finalFairway = useStatFlow ? currentFairway : null;

    saveHoleData(currentScore, finalFairway, finalPutts);
  };

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
    const holeEntry = {
      score,
      putts: putts ?? null,
      fairway: fairway ?? null,
      gir: gir ?? false,
      notes: notes || ''
    };

    Object.keys(holeEntry).forEach(key => {
      if (holeEntry[key] === null || holeEntry[key] === undefined) {
        delete holeEntry[key];
      }
    });

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

          if (!next) {
            setShowRoundComplete(true);
          }
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

      const mulliganLog = scoringUnit?.mulliganLog || {};
      const holeLog = mulliganLog[currentHole] || 0;
      await set(ref(database, `${scoringBasePath}/mulliganLog/${currentHole}`), holeLog + 1);

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

  const handleUndoMulligan = async () => {
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
  };

  const handleBack = async () => {
    if (isSolo) {
      setView('home');
    } else {
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

  const handleBackToLobby = async () => {
    if (isTeamFormat) {
      try {
        await remove(ref(database, `${scoringBasePath}/scoringLockedBy`));
      } catch (err) {
        console.error('Error clearing scoring lock:', err);
      }
    }
    setSelectedTeam(null);
    setShowRoundComplete(false);
    setView('event-lobby');
  };

  // ==================== DISPLAY HELPERS ====================

  const stats = calculateStats(null, null);

  const strokesOnCurrentHole = strokeHoles[currentHole] || 0;
  const maxHoleScore = (() => {
    if (format === 'stableford') {
      if (strokesOnCurrentHole >= 2) return currentPar + 4;
      return currentPar + 2 + strokesOnCurrentHole;
    }
    return null;
  })();

  const quickScoreButtons = [
    { label: 'Eagle', value: currentPar - 2, color: 'bg-yellow-400 hover:bg-yellow-500' },
    { label: 'Birdie', value: currentPar - 1, color: 'bg-green-500 hover:bg-green-600' },
    { label: 'Par', value: currentPar, color: 'bg-gray-400 hover:bg-gray-500' },
    { label: 'Bogey', value: currentPar + 1, color: 'bg-orange-400 hover:bg-orange-500' },
    { label: 'Double', value: currentPar + 2, color: 'bg-red-500 hover:bg-red-600' },
    { label: strokesOnCurrentHole === 1 && format === 'stableford' ? 'Triple' : 'Triple+', value: currentPar + 3, color: 'bg-red-800 hover:bg-red-900' }
  ].filter(btn => btn.value >= 1 && (maxHoleScore === null || btn.value <= maxHoleScore));

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

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-[#00285e] p-2 md:p-4">
      <div className="max-w-2xl mx-auto">

        <RoundCompleteModal
          show={showRoundComplete && !isSolo}
          numHoles={numHoles}
          onBackToLobby={handleBackToLobby}
          onReview={() => setShowRoundComplete(false)}
        />

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <button onClick={handleBack} className="text-white hover:text-[#c8d6e5]">
            ← {isSolo ? 'Back' : 'Back to Lobby'}
          </button>
          {isSolo && (
            <button
              onClick={endRound}
              className="text-white hover:text-[#c8d6e5] font-semibold"
            >
              End Round
            </button>
          )}
        </div>

        <ScoringHeader
          isSolo={isSolo}
          isTeamFormat={isTeamFormat}
          courseName={courseName}
          scoringDisplayName={scoringDisplayName}
          teamMemberNames={teamMemberNames}
          stats={stats}
          format={format}
          usesMulligans={usesMulligans}
          mulligansRemaining={mulligansRemaining}
          mulligansTotal={mulligansTotal}
          trackStats={trackStats}
          onTrackStatsToggle={handleTrackStatsToggle}
        />

        <HoleCard
          currentHole={currentHole}
          currentPar={currentPar}
          currentYardage={currentYardage}
          currentSI={currentSI}
          strokeHoles={strokeHoles}
          strokesOnCurrentHole={strokesOnCurrentHole}
          isFirstHole={isFirstHole}
          isLastHole={isLastHole}
          isSolo={isSolo}
          useStatFlow={useStatFlow}
          usesMulligans={usesMulligans}
          format={format}
          mulligansRemaining={mulligansRemaining}
          mulligansTotal={mulligansTotal}
          confirmingMulligan={confirmingMulligan}
          mulliganLogCurrentHole={!isSolo ? (scoringUnit?.mulliganLog?.[currentHole] || 0) : 0}
          currentScore={currentScore}
          showCustomScore={showCustomScore}
          currentFairway={currentFairway}
          currentPutts={currentPutts}
          maxHoleScore={maxHoleScore}
          quickScoreButtons={quickScoreButtons}
          fairwayButtons={fairwayButtons}
          puttOptions={puttOptions}
          isReadyToSave={isReadyToSave}
          notes={notes}
          feedback={feedback}
          onPrevHole={() => { const prev = getPrevHole(currentHole); if (prev) goToHole(prev); }}
          onNextHole={() => { const next = getNextHole(currentHole); if (next) goToHole(next); }}
          onScoreSelect={handleScoreSelect}
          onCustomScoreDecrease={() => setCurrentScore(Math.max(currentPar + 3, currentScore - 1))}
          onCustomScoreIncrease={() => setCurrentScore(Math.min(maxHoleScore ?? 15, currentScore + 1))}
          onCustomScoreConfirm={handleCustomScoreConfirm}
          onFairwaySelect={handleFairwaySelect}
          onPuttsSelect={handlePuttsSelect}
          onConfirmAndNext={handleConfirmAndNext}
          onClearScore={handleClearScore}
          onStartMulligan={() => setConfirmingMulligan(true)}
          onConfirmMulligan={useMulligan}
          onCancelMulligan={() => setConfirmingMulligan(false)}
          onUndoMulligan={handleUndoMulligan}
          onNotesChange={(e) => setNotes(e.target.value)}
        />

        <Scorecard
          first9={first9}
          second9={second9}
          first9Label={first9Label}
          second9Label={second9Label}
          coursePars={coursePars}
          courseStrokeIndexes={courseStrokeIndexes}
          strokeHoles={strokeHoles}
          isSolo={isSolo}
          trackStats={trackStats}
          usesMulligans={usesMulligans}
          format={format}
          mulliganLog={!isSolo ? (scoringUnit?.mulliganLog || {}) : {}}
          getHoleData={getHoleData}
          goToHole={goToHole}
          getScoreColor={getScoreColor}
        />

      </div>
    </div>
  );
}
