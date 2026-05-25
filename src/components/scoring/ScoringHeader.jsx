export default function ScoringHeader({
  isSolo,
  isTeamFormat,
  courseName,
  scoringDisplayName,
  teamMemberNames,
  stats,
  practicalStats = null,
  format,
  usesMulligans,
  mulligansRemaining,
  mulligansTotal,
  trackStats,
  onTrackStatsToggle,
  statMode = 'traditional',
  onStatModeChange = () => {},
  isScoringForOther = false
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
          <div className="text-center mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{scoringDisplayName}</h1>
            {isScoringForOther && (
              <span className="inline-block bg-orange-400 text-white text-xs font-semibold px-3 py-0.5 rounded-full mt-1">
                ⚠️ Not your score
              </span>
            )}
          </div>
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
        {(isSolo || trackStats) && statMode === 'traditional' && (
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
        {(isSolo || trackStats) && statMode === 'practical' && (
          <>
            <div className="text-center">
              <div className="text-sm text-gray-600">3 Putts</div>
              <div className={`text-3xl font-bold ${(practicalStats?.threePutts ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {practicalStats?.threePutts ?? 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Approach</div>
              <div className="text-3xl font-bold text-gray-900">
                {practicalStats?.approachHits ?? 0}/{practicalStats?.approachAttempts ?? 0}
              </div>
              <div className="text-xs text-gray-500">
                {(practicalStats?.approachAttempts ?? 0) > 0
                  ? `${((practicalStats.approachHits / practicalStats.approachAttempts) * 100).toFixed(0)}%`
                  : '0%'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Tee Shot</div>
              <div className="text-3xl font-bold text-gray-900">
                {practicalStats?.teeShotHits ?? 0}/{practicalStats?.teeShotAttempts ?? 0}
              </div>
              <div className="text-xs text-gray-500">
                {(practicalStats?.teeShotAttempts ?? 0) > 0
                  ? `${((practicalStats.teeShotHits / practicalStats.teeShotAttempts) * 100).toFixed(0)}%`
                  : '0%'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Track Stats section — solo always shows tabs; event individual shows toggle + tabs */}
      {!isTeamFormat && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {!isSolo && (
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold text-gray-700">Track Stats</div>
                <div className="text-xs text-gray-500">
                  {trackStats
                    ? statMode === 'practical' ? 'Practical metrics' : 'Fairways, putts, GIR'
                    : 'Off'}
                </div>
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
          {(isSolo || trackStats) && (
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => onStatModeChange('traditional')}
                className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${
                  statMode === 'traditional'
                    ? 'bg-white text-[#00285e] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Traditional
              </button>
              <button
                onClick={() => onStatModeChange('practical')}
                className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${
                  statMode === 'practical'
                    ? 'bg-white text-[#00285e] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Practical
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
