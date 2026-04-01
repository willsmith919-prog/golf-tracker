import { calculateStablefordPoints } from '../../utils/scoring';
import { getNetScore } from '../../utils/handicap';

const getScoreColor = (score, par) => {
  if (!score) return '';
  if (score < par) return 'bg-green-100 text-green-700 font-bold';
  if (score === par) return 'text-gray-900';
  if (score === par + 1) return 'bg-red-50 text-red-600 font-bold';
  return 'bg-red-100 text-red-700 font-bold';
};

export default function EntryDetail({
  entry,
  first9,
  second9,
  numHoles,
  startingHole,
  coursePars,
  handicapEnabled,
  display,
  isStableford,
  usesMulligans,
  scoringMethod
}) {
  const renderHoleRow = (holes, label) => (
    <div className="mb-3">
      <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left p-1 w-12">Hole</th>
              {holes.map(h => {
                const strokeCount = entry.strokeHoles[h] || 0;
                return (
                  <th key={h} className="text-center p-1 min-w-[28px]">
                    <div>{h}</div>
                    {handicapEnabled && display.showStrokeHoles !== false && strokeCount > 0 && (
                      <div className="flex justify-center gap-0.5 mt-0.5">
                        {Array.from({ length: strokeCount }).map((_, i) => (
                          <span key={i} className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                        ))}
                      </div>
                    )}
                  </th>
                );
              })}
              <th className="text-center p-1 min-w-[32px] font-bold">Tot</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="p-1 text-gray-500">Par</td>
              {holes.map(h => (
                <td key={h} className="text-center p-1 text-gray-500">{coursePars[h - 1]}</td>
              ))}
              <td className="text-center p-1 text-gray-600 font-semibold">
                {holes.reduce((sum, h) => sum + (coursePars[h - 1] || 0), 0)}
              </td>
            </tr>
            <tr>
              <td className="p-1 text-gray-500">Score</td>
              {holes.map(h => {
                const score = entry.scores[h] || entry.holes[h]?.score;
                const par = coursePars[h - 1];
                return (
                  <td key={h} className={`text-center p-1 rounded ${getScoreColor(score, par)}`}>
                    {score || '-'}
                    {usesMulligans && (entry.mulliganLog[h] || 0) > 0 && (
                      <span className="text-purple-500 text-[8px]">{'🎟️'.repeat(entry.mulliganLog[h])}</span>
                    )}
                  </td>
                );
              })}
              <td className="text-center p-1 font-bold text-gray-900">
                {holes.reduce((sum, h) => {
                  const s = entry.scores[h] || entry.holes[h]?.score || 0;
                  return sum + s;
                }, 0) || '-'}
              </td>
            </tr>
            {isStableford ? (
              <tr className="border-t border-gray-100">
                <td className="p-1 text-gray-500">Pts</td>
                {holes.map(h => {
                  const score = entry.scores[h] || entry.holes[h]?.score;
                  const par = coursePars[h - 1];
                  const pts = score ? calculateStablefordPoints(score, par) : null;
                  return (
                    <td key={h} className={`text-center p-1 rounded font-semibold ${
                      pts == null ? '' :
                      pts >= 3 ? 'text-green-600' :
                      pts === 2 ? 'text-gray-700' :
                      pts === 1 ? 'text-orange-500' :
                      'text-red-600'
                    }`}>
                      {pts != null ? pts : '-'}
                    </td>
                  );
                })}
                <td className="text-center p-1 font-bold text-blue-600">
                  {holes.reduce((sum, h) => {
                    const s = entry.scores[h] || entry.holes[h]?.score;
                    const par = coursePars[h - 1];
                    return sum + (s ? calculateStablefordPoints(s, par) : 0);
                  }, 0) || '-'}
                </td>
              </tr>
            ) : handicapEnabled && display.showNet !== false && (
              <tr className="border-t border-gray-100">
                <td className="p-1 text-gray-500">Net</td>
                {holes.map(h => {
                  const score = entry.scores[h] || entry.holes[h]?.score;
                  const par = coursePars[h - 1];
                  const net = score ? getNetScore(score, h, entry.strokeHoles, handicapEnabled) : null;
                  const strokeCount = entry.strokeHoles[h] || 0;
                  return (
                    <td key={h} className={`text-center p-1 rounded ${net ? getScoreColor(net, par) : ''}`}>
                      {net || '-'}
                      {strokeCount > 0 && display.showStrokeHoles !== false && (
                        <div className="flex justify-center gap-0.5 mt-0.5">
                          {Array.from({ length: strokeCount }).map((_, i) => (
                            <span key={i} className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="text-center p-1 font-bold text-gray-900">
                  {holes.reduce((sum, h) => {
                    const s = entry.scores[h] || entry.holes[h]?.score;
                    return sum + (s ? getNetScore(s, h, entry.strokeHoles, handicapEnabled) : 0);
                  }, 0) || '-'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      {display.showHoleByHole !== false && (
        <>
          {renderHoleRow(first9, numHoles === 18 ? 'OUT' : (startingHole === 1 ? 'Front 9' : 'Back 9'))}
          {second9.length > 0 && renderHoleRow(second9, 'IN')}
        </>
      )}

      {/* Stats summary */}
      <div className="flex gap-4 text-xs text-gray-500 mt-2">
        {display.showGross !== false && (
          <span>Gross: {entry.totalScore}</span>
        )}
        {handicapEnabled && display.showNet !== false && (
          <span>Net: {entry.netTotal}</span>
        )}
        {entry.handicap != null && handicapEnabled && (
          <span>HCP: {entry.courseHandicap}</span>
        )}
        {scoringMethod === 'stableford' && (
          <span>Points: {entry.stablefordPoints}</span>
        )}
        {usesMulligans && entry.mulligansTotal > 0 && (
          <span>Mulligans: {entry.mulligansRemaining}/{entry.mulligansTotal}</span>
        )}
      </div>
    </div>
  );
}
