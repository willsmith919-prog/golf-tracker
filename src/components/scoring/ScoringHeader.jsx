export default function ScoringHeader({
  isSolo,
  isTeamFormat,
  courseName,
  scoringDisplayName,
  teamMemberNames,
  stats,
  format,
  usesMulligans,
  mulligansRemaining,
  mulligansTotal,
  trackStats,
  onTrackStatsToggle
}) {
  const gridCols = (isSolo || trackStats)
    ? 'grid-cols-2 md:grid-cols-5'
    : format === 'stableford'
      ? (usesMulligans ? 'grid-cols-4' : 'grid-cols-3')
      : usesMulligans ? 'grid-cols-3' : 'grid-cols-2';

  return (
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

      <div className={`grid ${gridCols} gap-4`}>
        <div className="text-center">
          <div className="text-sm text-gray-600">Score</div>
          <div className="text-3xl font-bold text-gray-900">{stats.totalScore || 0}</div>
          <div className="text-sm text-gray-600">Thru {stats.holesPlayed} holes</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600">To Par</div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.toPar > 0 ? '+' : ''}{stats.toPar || 0}
          </div>
        </div>
        {format === 'stableford' && (
          <div className="text-center">
            <div className="text-sm text-gray-600">Points</div>
            <div className="text-3xl font-bold text-[#00285e]">{stats.stablefordPoints || 0}</div>
          </div>
        )}
        {usesMulligans && (
          <div className="text-center">
            <div className="text-sm text-gray-600">Mulligans</div>
            <div className={`text-3xl font-bold ${mulligansRemaining > 0 ? 'text-[#00285e]' : 'text-gray-400'}`}>
              {mulligansRemaining}
            </div>
            <div className="text-sm text-gray-600">of {mulligansTotal}</div>
          </div>
        )}
        {(isSolo || trackStats) && (
          <>
            <div className="text-center">
              <div className="text-sm text-gray-600">Putts</div>
              <div className="text-3xl font-bold text-gray-900">{stats.totalPutts}</div>
            </div>
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
            onClick={onTrackStatsToggle}
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
  );
}
