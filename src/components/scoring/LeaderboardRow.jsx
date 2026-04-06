import EntryDetail from './EntryDetail';

const formatToPar = (toPar) => {
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
};

const getToParColor = (toPar) => {
  if (toPar < 0) return 'text-green-600';
  if (toPar === 0) return 'text-gray-900';
  return 'text-red-600';
};

const getProgressPercent = (holesPlayed, numHoles, throughHole, holeOrder) => {
  const total = throughHole !== null ? (holeOrder.indexOf(throughHole) + 1) : numHoles;
  return Math.round((holesPlayed / total) * 100);
};

export default function LeaderboardRow({
  entry,
  isExpanded,
  onToggleExpand,
  isTeamFormat,
  handicapEnabled,
  display,
  primarySort,
  isStableford,
  numHoles,
  throughHole,
  holeOrder,
  usesMulligans,
  players,
  // EntryDetail props
  first9,
  second9,
  startingHole,
  coursePars,
  scoringMethod
}) {
  return (
    <div
      className={`rounded-xl transition-all ${
        entry.isMyEntry ? 'bg-[#f0f4ff] border-2 border-[#dce8f5]' : 'bg-gray-50 border border-gray-100'
      }`}
    >
      {/* Main row — tappable */}
      <button
        onClick={onToggleExpand}
        className="w-full grid grid-cols-[32px_1fr_60px_60px_48px] items-center px-3 py-3 text-left"
      >
        {/* Position */}
        <div className={`text-lg font-bold ${
          entry.position === 1 ? 'text-yellow-500' :
          entry.position === 2 ? 'text-gray-400' :
          entry.position === 3 ? 'text-amber-600' :
          'text-gray-500'
        }`}>
          {entry.position}
        </div>

        {/* Name + subtitle + progress */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-900 truncate">
              {entry.displayName}
            </span>
            {entry.isMyEntry && (
              <span className="text-[10px] bg-[#f0f4ff] text-[#00285e] px-1.5 py-0.5 rounded-full shrink-0">
                {isTeamFormat ? 'Your Team' : 'You'}
              </span>
            )}
            {!isTeamFormat && players[entry.id]?.isGuest && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">
                Guest
              </span>
            )}
            {!isTeamFormat && entry.role === 'host' && (
              <span className="text-[10px] bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded-full shrink-0">
                Host
              </span>
            )}
          </div>
          {/* Subtitle: team member names for team format */}
          {isTeamFormat && entry.subtitle && (
            <div className="text-xs text-gray-500 truncate">{entry.subtitle}</div>
          )}
          {/* Mulligans remaining badge */}
          {usesMulligans && entry.mulligansTotal > 0 && (
            <div className="text-[10px] text-[#00285e] font-semibold">
              🎟️ {entry.mulligansRemaining}/{entry.mulligansTotal} mulligans
            </div>
          )}
          {/* Progress bar */}
          <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden w-full max-w-[120px]">
            <div
              className={`h-full rounded-full transition-all ${
                entry.holesPlayed === numHoles ? 'bg-green-500' : 'bg-[#00285e]'
              }`}
              style={{ width: `${getProgressPercent(entry.holesPlayed, numHoles, throughHole, holeOrder)}%` }}
            />
          </div>
        </div>

        {/* Primary score */}
        <div className="text-center">
          {entry.holesPlayed > 0 ? (
            <span className={`text-lg font-bold ${
              isStableford
                ? 'text-[#00285e]'
                : display.showRelativeToPar !== false
                  ? getToParColor(primarySort === 'net' && handicapEnabled ? entry.netToPar : entry.toPar)
                  : 'text-gray-900'
            }`}>
              {isStableford
                ? entry.stablefordPoints
                : display.showRelativeToPar !== false
                  ? formatToPar(primarySort === 'net' && handicapEnabled ? entry.netToPar : entry.toPar)
                  : (primarySort === 'net' && handicapEnabled ? entry.netTotal : entry.totalScore)
              }
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>

        {/* Secondary score (only if handicap shows both, and not stableford) */}
        {!isStableford && handicapEnabled && display.showNet !== false && display.showGross !== false && (
          <div className="text-center">
            {entry.holesPlayed > 0 ? (
              <span className={`text-sm ${
                getToParColor(primarySort === 'net' ? entry.toPar : entry.netToPar)
              } opacity-70`}>
                {display.showRelativeToPar !== false
                  ? formatToPar(primarySort === 'net' ? entry.toPar : entry.netToPar)
                  : (primarySort === 'net' ? entry.totalScore : entry.netTotal)
                }
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
        )}

        {/* Thru */}
        <div className="text-center text-sm text-gray-600">
          {throughHole !== null
            ? (entry.holesPlayed === 0 ? '-' : entry.holesPlayed)
            : entry.holesPlayed === 0
            ? '-'
            : entry.holesPlayed === numHoles
            ? 'F'
            : entry.holesPlayed
          }
        </div>
      </button>

      {/* Expanded detail — hole-by-hole scorecard */}
      {isExpanded && (
        <div className="px-3 pb-3">
          <EntryDetail
            entry={entry}
            first9={first9}
            second9={second9}
            numHoles={numHoles}
            startingHole={startingHole}
            coursePars={coursePars}
            handicapEnabled={handicapEnabled}
            display={display}
            isStableford={isStableford}
            usesMulligans={usesMulligans}
            scoringMethod={scoringMethod}
          />
        </div>
      )}
    </div>
  );
}
