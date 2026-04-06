import { calculateStablefordPoints } from '../../utils/scoring';

export default function Scorecard({
  first9,
  second9,
  first9Label,
  second9Label,
  coursePars,
  courseStrokeIndexes,
  strokeHoles,
  isSolo,
  trackStats,
  usesMulligans,
  format,
  mulliganLog,
  getHoleData,
  goToHole,
  getScoreColor
}) {
  const renderSection = (holes, label) => (
    <div className={label === first9Label ? 'mb-6' : ''}>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{label}</h3>
      <table className="w-full table-fixed text-xs">
        <colgroup>
          <col className="w-8" />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left py-1 px-0.5 text-gray-500">Hole</th>
            {holes.map(h => (
              <th key={h} className="text-center py-1 px-0.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className={courseStrokeIndexes.length > 0 ? '' : 'border-b border-gray-200'}>
            <td className="py-1 px-0.5 text-gray-500">Par</td>
            {holes.map(h => {
              const strokeCount = strokeHoles[h] || 0;
              return (
                <td key={h} className="text-center py-1 px-0.5">
                  {coursePars[h - 1]}
                  {strokeCount > 0 && (
                    <div className="flex justify-center gap-0.5 mt-0.5">
                      {Array.from({ length: strokeCount }).map((_, i) => (
                        <span key={i} className="inline-block w-1 h-1 rounded-full bg-[#00285e]" />
                      ))}
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
          {courseStrokeIndexes.length > 0 && (
            <tr className="border-b border-gray-200">
              <td className="py-1 px-0.5 text-gray-400">SI</td>
              {holes.map(h => (
                <td key={h} className={`text-center py-1 px-0.5 ${strokeHoles[h] ? 'text-[#00285e] font-semibold' : 'text-gray-400'}`}>
                  {courseStrokeIndexes[h - 1] ?? '-'}
                </td>
              ))}
            </tr>
          )}
          <tr>
            <td className="py-1 px-0.5 text-gray-500">Score</td>
            {holes.map(h => {
              const hole = getHoleData(h);
              const par = coursePars[h - 1];
              const holeMulligans = !isSolo ? (mulliganLog?.[h] || 0) : 0;
              return (
                <td
                  key={h}
                  className={`text-center py-1 px-0.5 cursor-pointer ${getScoreColor(hole?.score, par)}`}
                  onClick={() => goToHole(h)}
                >
                  {hole?.score || '-'}
                  {(isSolo || trackStats) && hole?.gir && <span className="text-green-600" style={{ fontSize: '8px' }}>●</span>}
                  {holeMulligans > 0 && <span className="text-[#00285e]" style={{ fontSize: '8px' }}>{'🎟️'.repeat(holeMulligans)}</span>}
                </td>
              );
            })}
          </tr>
          {format === 'stableford' && (
            <tr>
              <td className="py-1 px-0.5 text-gray-500">Pts</td>
              {holes.map(h => {
                const hole = getHoleData(h);
                const par = coursePars[h - 1];
                const pts = hole?.score ? calculateStablefordPoints(hole.score, par + (strokeHoles[h] || 0)) : null;
                return (
                  <td key={h} className={`text-center py-1 px-0.5 font-semibold ${
                    pts == null ? 'text-gray-400' :
                    pts >= 3 ? 'text-green-600' :
                    pts === 2 ? 'text-gray-700' :
                    pts === 1 ? 'text-orange-500' :
                    'text-red-600'
                  }`}>
                    {pts != null ? pts : '-'}
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Scorecard</h2>
      {renderSection(first9, first9Label)}
      {second9.length > 0 && renderSection(second9, second9Label)}
      <div className="mt-4 text-sm text-gray-600 text-center">
        {(isSolo || trackStats) && '● = Green in Regulation · '}
        {usesMulligans && '🎟️ = Mulligan used · '}
        Tap any hole to edit
      </div>
    </div>
  );
}
