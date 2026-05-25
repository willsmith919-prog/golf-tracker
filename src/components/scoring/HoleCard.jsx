import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import { calculateStablefordPoints } from '../../utils/scoring';

export default function HoleCard({
  // Hole info
  currentHole,
  currentPar,
  currentYardage,
  currentSI,
  strokeHoles,
  strokesOnCurrentHole,
  isFirstHole,
  isLastHole,
  // Mode flags
  isSolo,
  useStatFlow,
  usesMulligans,
  format,
  // Mulligan state
  mulligansRemaining,
  mulligansTotal,
  confirmingMulligan,
  mulliganLogCurrentHole,
  // Score state
  currentScore,
  showCustomScore,
  currentFairway,
  currentPutts,
  maxHoleScore,
  // Computed inputs
  quickScoreButtons,
  fairwayButtons,
  puttOptions,
  isReadyToSave,
  // Notes & feedback
  notes,
  feedback,
  // Callbacks
  onPrevHole,
  onNextHole,
  onScoreSelect,
  onCustomScoreDecrease,
  onCustomScoreIncrease,
  onCustomScoreConfirm,
  statMode = 'traditional',
  currentPractical = { teeShot: null, secondShot: null, approach: null, wedgePlay: null, threePutt: null, putt610: null, putt36: null },
  onPracticalSelect = () => {},
  onFairwaySelect,
  onPuttsSelect,
  onConfirmAndNext,
  onClearScore,
  onStartMulligan,
  onConfirmMulligan,
  onCancelMulligan,
  onUndoMulligan,
  onNotesChange,
  isScoringForOther = false,
  scoringDisplayName = ''
}) {
  return (
    <>
      {/* Current Hole Card */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
        {isScoringForOther && (
          <div className="bg-orange-400 text-white text-sm font-semibold text-center rounded-xl px-4 py-2 mb-4">
            ⚠️ Scoring for {scoringDisplayName} — not your score
          </div>
        )}
        {/* Hole Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onPrevHole}
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
            {(strokeHoles[currentHole] || 0) > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 bg-[#f0f4ff] text-[#00285e] text-sm font-semibold px-3 py-1 rounded-full">
                {Array.from({ length: strokeHoles[currentHole] }).map((_, i) => (
                  <span key={i} className="inline-block w-2 h-2 rounded-full bg-[#00285e]" />
                ))}
                +{strokeHoles[currentHole]} stroke{strokeHoles[currentHole] > 1 ? 's' : ''}
              </div>
            )}
          </div>

          <button
            onClick={onNextHole}
            disabled={isLastHole}
            className="bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed p-3 rounded-xl"
          >
            <ChevronRightIcon />
          </button>
        </div>

        {/* Mulligan — shown above score entry so it's logged before scoring */}
        {usesMulligans && !confirmingMulligan && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            {mulligansRemaining > 0 ? (
              <>
                <button
                  onClick={onStartMulligan}
                  className="w-full bg-[#f0f4ff] hover:bg-[#e8eef8] text-[#00285e] py-2.5 rounded-xl font-semibold transition-all text-sm"
                >
                  🎟️ Use Mulligan ({mulligansRemaining} left)
                </button>
                {mulliganLogCurrentHole > 0 && (
                  <button
                    onClick={onUndoMulligan}
                    className="w-full mt-2 text-sm text-[#003a7d] hover:text-[#00285e] transition-all"
                  >
                    ↩ Undo mulligan on this hole ({mulliganLogCurrentHole} used)
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="text-center text-sm text-gray-400 font-semibold">
                  🎟️ No mulligans remaining
                </div>
                {mulliganLogCurrentHole > 0 && (
                  <button
                    onClick={onUndoMulligan}
                    className="w-full mt-2 text-sm text-[#003a7d] hover:text-[#00285e] transition-all"
                  >
                    ↩ Undo mulligan on this hole ({mulliganLogCurrentHole} used)
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
                onClick={onConfirmMulligan}
                className="flex-1 bg-[#00285e] hover:bg-[#003a7d] text-white py-3 rounded-xl font-semibold transition-all"
              >
                ✓ Confirm Mulligan
              </button>
              <button
                onClick={onCancelMulligan}
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
                onClick={() => onScoreSelect(btn.value)}
                className={`${
                  currentScore === btn.value && !(showCustomScore && btn.label === 'Triple+')
                    ? 'ring-4 ring-[#003a7d]'
                    : ''
                } ${showCustomScore && btn.label === 'Triple+' ? 'ring-4 ring-[#003a7d]' : ''} ${btn.color} text-white py-4 rounded-xl font-semibold shadow-lg transition-all`}
              >
                <div className="text-sm">{btn.label}</div>
                <div className="text-2xl font-bold">
                  {btn.label === 'Triple+' && maxHoleScore === null ? `${btn.value}+` : btn.value}
                </div>
                {format === 'stableford' && btn.label !== 'Triple+' && (
                  <div className="text-xs mt-0.5 opacity-90">
                    {calculateStablefordPoints(btn.value, currentPar + strokesOnCurrentHole)} pts
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Custom Score Adjuster — shown when Triple+ is tapped */}
          {showCustomScore && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-center text-sm text-gray-600 mb-3">Adjust Score</div>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={onCustomScoreDecrease}
                  disabled={currentScore <= currentPar + 3}
                  className="bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed w-14 h-14 rounded-xl text-2xl font-bold"
                >
                  −
                </button>
                <div className="text-5xl font-bold text-gray-900 w-20 text-center">{currentScore}</div>
                <button
                  onClick={onCustomScoreIncrease}
                  disabled={currentScore >= 15}
                  className="bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed w-14 h-14 rounded-xl text-2xl font-bold"
                >
                  +
                </button>
              </div>
              <div className="text-center text-xs text-gray-400 mt-1">
                +{currentScore - currentPar} over par
              </div>
              {format === 'stableford' && (
                <div className={`text-center text-sm font-semibold mt-2 ${
                  calculateStablefordPoints(currentScore, currentPar + strokesOnCurrentHole) >= 3 ? 'text-green-600' :
                  calculateStablefordPoints(currentScore, currentPar + strokesOnCurrentHole) === 2 ? 'text-gray-700' :
                  calculateStablefordPoints(currentScore, currentPar + strokesOnCurrentHole) === 1 ? 'text-orange-500' :
                  'text-red-600'
                }`}>
                  {calculateStablefordPoints(currentScore, currentPar + strokesOnCurrentHole)} pts
                </div>
              )}
              <button
                onClick={onCustomScoreConfirm}
                className="w-full mt-3 bg-[#00285e] hover:bg-[#003a7d] text-white py-3 rounded-xl font-semibold transition-all"
              >
                Confirm Score: {currentScore}
              </button>
            </div>
          )}
        </div>

        {/* Traditional: Fairway Entry */}
        {useStatFlow && statMode === 'traditional' && currentScore && !showCustomScore && currentPar >= 4 && (
          <div className="mb-4">
            <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Fairway</h3>
            <div className="grid grid-cols-4 gap-3">
              {fairwayButtons.map(btn => (
                <button
                  key={btn.label}
                  onClick={() => onFairwaySelect(btn.value)}
                  className={`${
                    currentFairway === btn.value ? 'ring-4 ring-[#003a7d]' : ''
                  } ${btn.color} text-white py-6 rounded-xl font-semibold text-lg shadow-lg transition-all`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Traditional: Putts Entry */}
        {useStatFlow && statMode === 'traditional' && currentScore && !showCustomScore && (currentPar < 4 || currentFairway) && puttOptions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Putts</h3>
            <div className="grid grid-cols-4 gap-3">
              {puttOptions.map(putts => {
                const puttVal = putts === '3+' ? 3 : putts;
                return (
                  <button
                    key={putts}
                    onClick={() => onPuttsSelect(putts)}
                    className={`${
                      currentPutts === puttVal ? 'ring-4 ring-[#003a7d]' : ''
                    } bg-[#00285e] hover:bg-[#003a7d] text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >
                    {putts}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Practical: Sequential stat entry */}
        {useStatFlow && statMode === 'practical' && currentScore && !showCustomScore && (
          <>
            {/* Tee Shot — par 4/5 only */}
            {currentPar >= 4 && (
              <div className="mb-4">
                <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Tee Shot</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onPracticalSelect('teeShot', 'hit')}
                    className={`${currentPractical.teeShot === 'hit' ? 'ring-4 ring-[#003a7d]' : ''} bg-green-500 hover:bg-green-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✓</button>
                  <button
                    onClick={() => onPracticalSelect('teeShot', 'miss')}
                    className={`${currentPractical.teeShot === 'miss' ? 'ring-4 ring-[#003a7d]' : ''} bg-red-500 hover:bg-red-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✗</button>
                </div>
              </div>
            )}

            {/* Second Shot — par 5 only, after tee shot */}
            {currentPar === 5 && currentPractical.teeShot !== null && (
              <div className="mb-4">
                <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Second Shot</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onPracticalSelect('secondShot', 'hit')}
                    className={`${currentPractical.secondShot === 'hit' ? 'ring-4 ring-[#003a7d]' : ''} bg-green-500 hover:bg-green-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✓</button>
                  <button
                    onClick={() => onPracticalSelect('secondShot', 'miss')}
                    className={`${currentPractical.secondShot === 'miss' ? 'ring-4 ring-[#003a7d]' : ''} bg-red-500 hover:bg-red-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✗</button>
                </div>
              </div>
            )}

            {/* Approach — all pars, unlocks after tee/second shot or immediately for par 3 */}
            {(currentPar < 4 || (currentPar === 4 && currentPractical.teeShot !== null) || (currentPar === 5 && currentPractical.secondShot !== null)) && (
              <div className="mb-4">
                <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Approach</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onPracticalSelect('approach', 'hit')}
                    className={`${currentPractical.approach === 'hit' ? 'ring-4 ring-[#003a7d]' : ''} bg-green-500 hover:bg-green-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✓</button>
                  <button
                    onClick={() => onPracticalSelect('approach', 'miss')}
                    className={`${currentPractical.approach === 'miss' ? 'ring-4 ring-[#003a7d]' : ''} bg-red-500 hover:bg-red-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✗</button>
                </div>
              </div>
            )}

            {/* Wedge Play — after approach */}
            {currentPractical.approach !== null && (
              <div className="mb-4">
                <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Wedge Play</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => onPracticalSelect('wedgePlay', 'hit')}
                    className={`${currentPractical.wedgePlay === 'hit' ? 'ring-4 ring-[#003a7d]' : ''} bg-green-500 hover:bg-green-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✓</button>
                  <button
                    onClick={() => onPracticalSelect('wedgePlay', 'miss')}
                    className={`${currentPractical.wedgePlay === 'miss' ? 'ring-4 ring-[#003a7d]' : ''} bg-red-500 hover:bg-red-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✗</button>
                  <button
                    onClick={() => onPracticalSelect('wedgePlay', 'na')}
                    className={`${currentPractical.wedgePlay === 'na' ? 'ring-4 ring-[#003a7d]' : ''} bg-gray-400 hover:bg-gray-500 text-white py-6 rounded-xl font-semibold text-sm shadow-lg transition-all`}
                  >N/A</button>
                </div>
              </div>
            )}

            {/* 3 Putt — after wedge play */}
            {currentPractical.wedgePlay !== null && (
              <div className="mb-4">
                <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">3 Putt?</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onPracticalSelect('threePutt', false)}
                    className={`${currentPractical.threePutt === false ? 'ring-4 ring-[#003a7d]' : ''} bg-green-500 hover:bg-green-600 text-white py-6 rounded-xl font-bold text-xl shadow-lg transition-all`}
                  >No</button>
                  <button
                    onClick={() => onPracticalSelect('threePutt', true)}
                    className={`${currentPractical.threePutt === true ? 'ring-4 ring-[#003a7d]' : ''} bg-red-500 hover:bg-red-600 text-white py-6 rounded-xl font-bold text-xl shadow-lg transition-all`}
                  >Yes</button>
                </div>
              </div>
            )}

            {/* Putt 6–10 ft — after 3 putt */}
            {currentPractical.threePutt !== null && (
              <div className="mb-4">
                <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Putt 6–10 ft</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => onPracticalSelect('putt610', 'hit')}
                    className={`${currentPractical.putt610 === 'hit' ? 'ring-4 ring-[#003a7d]' : ''} bg-green-500 hover:bg-green-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✓</button>
                  <button
                    onClick={() => onPracticalSelect('putt610', 'miss')}
                    className={`${currentPractical.putt610 === 'miss' ? 'ring-4 ring-[#003a7d]' : ''} bg-red-500 hover:bg-red-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✗</button>
                  <button
                    onClick={() => onPracticalSelect('putt610', 'na')}
                    className={`${currentPractical.putt610 === 'na' ? 'ring-4 ring-[#003a7d]' : ''} bg-gray-400 hover:bg-gray-500 text-white py-6 rounded-xl font-semibold text-sm shadow-lg transition-all`}
                  >N/A</button>
                </div>
              </div>
            )}

            {/* Putt 3–6 ft — only if 6–10 ft was missed or N/A (a make there means no 3–6 footer) */}
            {currentPractical.putt610 !== null && currentPractical.putt610 !== 'hit' && (
              <div className="mb-4">
                <h3 className="text-center text-sm font-semibold text-gray-700 mb-3">Putt 3–6 ft</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => onPracticalSelect('putt36', 'hit')}
                    className={`${currentPractical.putt36 === 'hit' ? 'ring-4 ring-[#003a7d]' : ''} bg-green-500 hover:bg-green-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✓</button>
                  <button
                    onClick={() => onPracticalSelect('putt36', 'miss')}
                    className={`${currentPractical.putt36 === 'miss' ? 'ring-4 ring-[#003a7d]' : ''} bg-red-500 hover:bg-red-600 text-white py-6 rounded-xl font-bold text-2xl shadow-lg transition-all`}
                  >✗</button>
                  <button
                    onClick={() => onPracticalSelect('putt36', 'na')}
                    className={`${currentPractical.putt36 === 'na' ? 'ring-4 ring-[#003a7d]' : ''} bg-gray-400 hover:bg-gray-500 text-white py-6 rounded-xl font-semibold text-sm shadow-lg transition-all`}
                  >N/A</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Save & Next / Clear Confirmation Bar */}
        {currentScore && !showCustomScore && (
          <div className="mb-4 bg-[#f0f4ff] border-2 border-[#dce8f5] rounded-xl p-4">
            <div className="text-center mb-3">
              <div className="text-sm text-gray-600">
                Hole {currentHole} — Selected:
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {currentScore} ({currentScore < currentPar ? currentScore - currentPar : currentScore === currentPar ? 'E' : '+' + (currentScore - currentPar)})
                {useStatFlow && statMode === 'traditional' && currentFairway && ` · ${currentFairway === 'hit' ? 'FW' : currentFairway.charAt(0).toUpperCase() + currentFairway.slice(1)}`}
                {useStatFlow && statMode === 'traditional' && currentPutts !== null && ` · ${currentPutts}P`}
              </div>
              {!isReadyToSave && useStatFlow && (
                <div className="text-xs text-amber-600 mt-1">
                  {statMode === 'practical'
                    ? 'Complete all stats above →'
                    : currentPar >= 4 && !currentFairway ? 'Select fairway →' : 'Select putts →'}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onConfirmAndNext}
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
                onClick={onClearScore}
                className="px-5 py-3 rounded-xl font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition-all"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notes — solo only */}
      {isSolo && (
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={onNotesChange}
            placeholder="Add notes about this hole..."
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none resize-none"
            rows="3"
          />
        </div>
      )}

      {/* Feedback Message */}
      {feedback && (
        <div className="mb-4 bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm text-center">
          {feedback}
        </div>
      )}
    </>
  );
}
