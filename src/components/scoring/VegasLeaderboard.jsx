import { useState } from 'react';
import { calculateVegasResults } from '../../utils/calculateVegasResults';
import { buildHoleOrder } from '../../utils/holes';
import { getPlayerCourseHandicap, getStrokeHoles } from '../../utils/handicap';

export default function VegasLeaderboard({ sideGame, currentEvent, currentUser }) {
  const [showGrid, setShowGrid] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  const meta = currentEvent?.meta || {};
  const numHoles = meta.numHoles || 18;
  const startingHole = meta.startingHole || 1;
  const holeOrder = buildHoleOrder(numHoles, startingHole);
  const coursePars = meta.coursePars || [];
  const handicapEnabled = meta.handicap?.enabled || false;
  const useSlope = meta.handicap?.useSlope ?? true;
  const coursePar = coursePars.reduce((sum, p) => sum + (p || 0), 0);

  const handicapConfig = {
    handicapEnabled,
    courseSlope: useSlope ? (meta.courseSlope || null) : null,
    courseRating: useSlope ? (meta.courseRating || null) : null,
    coursePar,
    handicapAllowance: meta.handicap?.allowance || 100,
    courseStrokeIndexes: meta.courseStrokeIndexes || []
  };

  // Vegas always needs individual player scores regardless of main game team format
  const evPlayers = currentEvent?.players || {};
  const entries = Object.entries(evPlayers).map(([uid, player]) => {
    const courseHandicap = getPlayerCourseHandicap(player.handicap, handicapConfig);
    const strokeHoles = handicapEnabled ? getStrokeHoles(courseHandicap, handicapConfig) : {};
    return {
      id: uid,
      scores: player.scores || {},
      holes: player.holes || {},
      strokeHoles,
      holesPlayed: player.stats?.holesPlayed || 0
    };
  });

  const getName = (uid) => evPlayers[uid]?.displayName || 'Unknown';
  const getFirstName = (uid) => getName(uid).split(' ')[0];

  // Derive is1v1 from config before calculations
  const is1v1 = sideGame.type === 'vegas1v1';

  // Side identifiers
  const teamAName = sideGame.teams?.teamA?.name || 'Team A';
  const teamBName = sideGame.teams?.teamB?.name || 'Team B';
  const teamAIds = sideGame.teams?.teamA?.playerIds || [];
  const teamBIds = sideGame.teams?.teamB?.playerIds || [];

  // 1v1: auto-assign from event players if not explicitly configured
  const allPlayerIds = Object.keys(evPlayers);
  const playerAId = sideGame.players?.playerA || (is1v1 ? allPlayerIds[0] : null);
  const playerBId = sideGame.players?.playerB || (is1v1 ? allPlayerIds[1] : null);
  const playerAName = playerAId ? getName(playerAId) : 'Player A';
  const playerBName = playerBId ? getName(playerBId) : 'Player B';

  // For 1v1, inject auto-assigned player IDs if not explicitly set
  const effectiveConfig = is1v1
    ? { ...sideGame, players: { playerA: playerAId, playerB: playerBId } }
    : sideGame;

  const { scoringMode, holeByHole, finalScore } =
    calculateVegasResults(entries, holeOrder, coursePars, effectiveConfig);

  const isNet = scoringMode === 'net';

  const sideALabel = is1v1 ? playerAName : teamAName;
  const sideBLabel = is1v1 ? playerBName : teamBName;

  const myUid = currentUser?.uid;
  const mySide = is1v1
    ? (myUid === playerAId ? 'a' : myUid === playerBId ? 'b' : null)
    : (teamAIds.includes(myUid) ? 'a' : teamBIds.includes(myUid) ? 'b' : null);

  // Guard: 1v1 just needs 2 players in the event; 2v2 needs explicit team assignment
  const isConfigured = is1v1
    ? (allPlayerIds.length >= 2)
    : (teamAIds.length === 2 && teamBIds.length === 2);

  if (!isConfigured) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🎯</div>
        <p className="text-gray-500 text-sm">Player assignment not complete.</p>
        <p className="text-xs text-gray-400 mt-1">The host needs to assign players in the event lobby.</p>
      </div>
    );
  }

  const { leader, margin } = finalScore || {};
  const holesDecided = holeByHole.filter(h => h.status !== 'pending').length;
  const pendingCount = holeByHole.filter(h => h.status === 'pending').length;
  const leaderIsA = leader === 'teamA' || leader === 'playerA';
  const leaderIsB = leader === 'teamB' || leader === 'playerB';

  // ==================== HELPERS ====================

  const vegasNum = (n) => (n != null ? String(n) : '—');

  const marginText = (row) => {
    if (row.status === 'pending') return '—';
    if (row.status === 'halved') return 'AS';
    return `+${Math.abs(row.margin)}`;
  };

  const marginCls = (row) => {
    if (row.status === 'pending' || row.status === 'halved') return 'text-gray-400';
    return row.margin > 0 ? 'text-[#00285e] font-bold' : 'text-[#e63946] font-bold';
  };

  const runningText = (rt) => {
    if (rt === 0) return 'AS';
    return `+${Math.abs(rt)}`;
  };

  const runningCls = (rt) => {
    if (rt === 0) return 'text-gray-500';
    return rt > 0 ? 'text-[#00285e] font-semibold' : 'text-[#e63946] font-semibold';
  };

  // ==================== BANNER ====================

  const Banner = () => {
    if (holesDecided === 0) {
      return (
        <div className="bg-gray-100 rounded-xl px-4 py-3 text-center text-sm text-gray-500 mb-4">
          Waiting for scores...
        </div>
      );
    }
    if (leader === 'tied') {
      return (
        <div className="bg-gray-100 rounded-xl px-4 py-3 text-center mb-4">
          <span className="text-lg font-bold text-gray-700">All Square</span>
          <span className="text-xs text-gray-500 ml-2">
            after {holesDecided} {is1v1 ? 'super-hole' : 'hole'}{holesDecided !== 1 ? 's' : ''}
          </span>
        </div>
      );
    }
    const leaderName = leaderIsA ? sideALabel : sideBLabel;
    const bannerBg = leaderIsA ? 'bg-[#00285e]' : 'bg-[#e63946]';
    return (
      <div className={`${bannerBg} rounded-xl px-4 py-3 text-center mb-4`}>
        <span className="text-white font-bold">{leaderName}</span>
        <span className="text-white/80 text-sm ml-2">leads</span>
        <span className="text-white font-bold text-lg ml-2">+{margin}</span>
        <span className="text-white/60 text-xs ml-2">
          after {holesDecided} {is1v1 ? 'super-hole' : 'hole'}{holesDecided !== 1 ? 's' : ''}
        </span>
      </div>
    );
  };

  // ==================== ROW — 2v2 ====================

  const Row2v2 = ({ row, idx }) => {
    const isExpanded = expandedRow === idx;
    const aWins = row.status === 'teamA';
    const bWins = row.status === 'teamB';

    return (
      <div>
        <button
          onClick={() => setExpandedRow(isExpanded ? null : idx)}
          className={`w-full grid items-center gap-1 px-2 py-2 rounded-xl border transition-all text-sm ${
            isExpanded ? 'border-[#00285e]/40 bg-[#f0f4ff]' : 'border-gray-100 bg-white hover:bg-gray-50'
          }`}
          style={{ gridTemplateColumns: '32px 1fr 44px 44px 1fr' }}
        >
          {/* Hole # */}
          <div className="text-center text-xs font-semibold text-gray-500">{row.hole}</div>

          {/* Team A Vegas # */}
          <div className={`text-center text-sm font-bold ${aWins ? 'text-[#00285e]' : bWins ? 'text-gray-300' : 'text-gray-600'}`}>
            <span className={aWins ? 'bg-[#eef3ff] px-1.5 py-0.5 rounded' : ''}>
              {row.status === 'pending' ? <span className="text-gray-300">—</span> : vegasNum(row.teamA?.vegasNumber)}
            </span>
          </div>

          {/* Hole margin */}
          <div className={`text-center text-xs ${marginCls(row)}`}>{marginText(row)}</div>

          {/* Running total */}
          <div className={`text-center text-xs ${runningCls(row.runningTotal)}`}>{runningText(row.runningTotal)}</div>

          {/* Team B Vegas # */}
          <div className={`text-center text-sm font-bold ${bWins ? 'text-[#e63946]' : aWins ? 'text-gray-300' : 'text-gray-600'}`}>
            <span className={bWins ? 'bg-red-50 px-1.5 py-0.5 rounded' : ''}>
              {row.status === 'pending' ? <span className="text-gray-300">—</span> : vegasNum(row.teamB?.vegasNumber)}
            </span>
          </div>
        </button>

        {isExpanded && row.status !== 'pending' && (
          <div className="mx-1 mb-1 bg-gray-50 border border-gray-200 rounded-xl p-3 grid grid-cols-2 gap-4">
            {[
              { label: teamAName, color: 'text-[#00285e]', ids: teamAIds, data: row.teamA },
              { label: teamBName, color: 'text-[#e63946]', ids: teamBIds, data: row.teamB }
            ].map(({ label, color, ids, data }) => (
              <div key={label}>
                <div className={`text-xs font-semibold ${color} mb-2`}>{label}</div>
                {ids.map((uid, i) => (
                  <div key={uid} className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">{getFirstName(uid)}</span>
                    <span className="font-semibold text-gray-900">{data?.scores?.[i] ?? '—'}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 mt-1.5 pt-1.5 flex justify-between text-xs">
                  <span className="text-gray-400">Vegas #</span>
                  <span className={`font-bold ${color}`}>{data?.vegasNumber ?? '—'}</span>
                </div>
              </div>
            ))}
            {isNet && (
              <div className="col-span-2 text-center text-xs text-gray-400">
                Net scores (handicap strokes applied)
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ==================== ROW — 1v1 ====================

  const Row1v1 = ({ row, idx }) => {
    const isExpanded = expandedRow === idx;
    const aWins = row.status === 'playerA';
    const bWins = row.status === 'playerB';
    const holeLabel = row.holes.length > 1 ? `${row.holes[0]}-${row.holes[1]}` : `${row.holes[0]}`;
    const isSingleHole = row.holes.length === 1;

    return (
      <div>
        <button
          onClick={() => setExpandedRow(isExpanded ? null : idx)}
          className={`w-full grid items-center gap-1 px-2 py-2 rounded-xl border transition-all text-sm ${
            isExpanded ? 'border-[#00285e]/40 bg-[#f0f4ff]' : 'border-gray-100 bg-white hover:bg-gray-50'
          }`}
          style={{ gridTemplateColumns: '48px 1fr 44px 44px 1fr' }}
        >
          {/* Hole pair label */}
          <div className="text-center text-xs font-semibold text-gray-500">{holeLabel}</div>

          {/* Player A Vegas # */}
          <div className={`text-center text-sm font-bold ${aWins ? 'text-[#00285e]' : bWins ? 'text-gray-300' : 'text-gray-600'}`}>
            <span className={aWins ? 'bg-[#eef3ff] px-1.5 py-0.5 rounded' : ''}>
              {row.status === 'pending' ? <span className="text-gray-300">—</span> : vegasNum(row.playerA?.vegasNumber)}
            </span>
          </div>

          {/* Hole margin */}
          <div className={`text-center text-xs ${marginCls(row)}`}>{marginText(row)}</div>

          {/* Running total */}
          <div className={`text-center text-xs ${runningCls(row.runningTotal)}`}>{runningText(row.runningTotal)}</div>

          {/* Player B Vegas # */}
          <div className={`text-center text-sm font-bold ${bWins ? 'text-[#e63946]' : aWins ? 'text-gray-300' : 'text-gray-600'}`}>
            <span className={bWins ? 'bg-red-50 px-1.5 py-0.5 rounded' : ''}>
              {row.status === 'pending' ? <span className="text-gray-300">—</span> : vegasNum(row.playerB?.vegasNumber)}
            </span>
          </div>
        </button>

        {isExpanded && row.status !== 'pending' && (
          <div className="mx-1 mb-1 bg-gray-50 border border-gray-200 rounded-xl p-3 grid grid-cols-2 gap-4">
            {[
              { label: playerAName, color: 'text-[#00285e]', data: row.playerA },
              { label: playerBName, color: 'text-[#e63946]', data: row.playerB }
            ].map(({ label, color, data }) => (
              <div key={label}>
                <div className={`text-xs font-semibold ${color} mb-2`}>{label.split(' ')[0]}</div>
                {(data?.scores || []).map((score, si) => (
                  <div key={si} className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Hole {row.holes[si]}</span>
                    <span className="font-semibold text-gray-900">{score ?? '—'}</span>
                  </div>
                ))}
                {!isSingleHole && (
                  <div className="border-t border-gray-200 mt-1.5 pt-1.5 flex justify-between text-xs">
                    <span className="text-gray-400">Vegas #</span>
                    <span className={`font-bold ${color}`}>{data?.vegasNumber ?? '—'}</span>
                  </div>
                )}
              </div>
            ))}
            {isNet && (
              <div className="col-span-2 text-center text-xs text-gray-400">
                Net scores (handicap strokes applied)
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDER ====================

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{sideGame.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {is1v1 ? '1v1 — consecutive hole pairs' : '2v2 — per-hole Vegas numbers'} · {isNet ? 'Net' : 'Gross'}
          </p>
        </div>
        <span className="flex-shrink-0 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
          Vegas {is1v1 ? '1v1' : '2v2'}
        </span>
      </div>

      <Banner />

      {/* Side labels with "You" highlight */}
      <div className="flex items-center justify-between px-2 mb-3">
        <span className={`text-sm font-semibold text-[#00285e] ${mySide === 'a' ? 'underline underline-offset-2' : ''}`}>
          {sideALabel}
          {mySide === 'a' && <span className="ml-1.5 text-xs bg-[#00285e] text-white px-1.5 py-0.5 rounded-full">You</span>}
        </span>
        <span className="text-xs text-gray-400">vs</span>
        <span className={`text-sm font-semibold text-[#e63946] ${mySide === 'b' ? 'underline underline-offset-2' : ''}`}>
          {sideBLabel}
          {mySide === 'b' && <span className="ml-1.5 text-xs bg-[#e63946] text-white px-1.5 py-0.5 rounded-full">You</span>}
        </span>
      </div>

      {/* Column headers */}
      {showGrid && (
        <div
          className="grid items-center gap-1 px-2 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide"
          style={{ gridTemplateColumns: is1v1 ? '48px 1fr 44px 44px 1fr' : '32px 1fr 44px 44px 1fr' }}
        >
          <div className="text-center">{is1v1 ? 'Holes' : 'Hole'}</div>
          <div className={`text-center truncate ${mySide === 'a' ? 'text-[#00285e]' : ''}`}>
            {is1v1 ? playerAName.split(' ')[0] : teamAName}
          </div>
          <div className="text-center">±</div>
          <div className="text-center">Total</div>
          <div className={`text-center truncate ${mySide === 'b' ? 'text-[#e63946]' : ''}`}>
            {is1v1 ? playerBName.split(' ')[0] : teamBName}
          </div>
        </div>
      )}

      {/* Grid toggle */}
      <button
        onClick={() => { setShowGrid(!showGrid); setExpandedRow(null); }}
        className="w-full text-xs text-[#00285e] font-semibold mb-3 flex items-center justify-center gap-1"
      >
        {showGrid ? '▲ Hide' : '▼ Show'} hole-by-hole
      </button>

      {showGrid && (
        <div className="space-y-1">
          {holeByHole.map((row, idx) =>
            is1v1
              ? <Row1v1 key={idx} row={row} idx={idx} />
              : <Row2v2 key={idx} row={row} idx={idx} />
          )}
        </div>
      )}

      {pendingCount > 0 && showGrid && (
        <div className="mt-3 text-xs text-amber-600 text-center">
          {pendingCount} {is1v1 ? 'super-hole' : 'hole'}{pendingCount > 1 ? 's' : ''} still pending
        </div>
      )}

      {/* How Vegas works */}
      <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-500 space-y-1">
        <div className="font-semibold text-gray-600 mb-1">How Vegas works</div>
        {is1v1 ? (
          <>
            <div>• Holes are paired consecutively (1&2, 3&4, etc.).</div>
            <div>• Each player combines their two scores into a number — lower score goes first. E.g., scores of 4 and 3 → <strong>34</strong>.</div>
            <div>• Lower Vegas number wins the pair. The margin is added to a running total.</div>
          </>
        ) : (
          <>
            <div>• Each team combines their two players' scores into a number — lower score goes first. E.g., scores of 3 and 4 → <strong>34</strong>.</div>
            <div>• Lower Vegas number wins the hole. The margin (difference between the two numbers) is added to a running total.</div>
          </>
        )}
        {isNet && <div>• Handicap strokes are applied to individual scores before combining.</div>}
        <div>• <strong>±</strong> = hole result margin. <strong>Total</strong> = running differential.</div>
      </div>
    </div>
  );
}
