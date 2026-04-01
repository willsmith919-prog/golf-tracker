export default function ThroughHoleFilter({
  throughHole,
  setThroughHole,
  showAllHoles,
  setShowAllHoles,
  holeOrder,
  numHoles,
  myThroughHole,
  myHolesPlayed
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500">Compare:</span>

        {/* All button — always shown */}
        <button
          onClick={() => { setThroughHole(null); setShowAllHoles(false); }}
          className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
            throughHole === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Holes
        </button>

        {/* Smart "Through Hole X" — based on user's current progress */}
        {myThroughHole !== null && myHolesPlayed < numHoles && (
          <button
            onClick={() => { setThroughHole(myThroughHole); setShowAllHoles(false); }}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
              throughHole === myThroughHole
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            Thru {myHolesPlayed} ({myThroughHole})
          </button>
        )}

        {/* Expand/collapse for custom hole selection */}
        <button
          onClick={() => setShowAllHoles(!showAllHoles)}
          className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
            showAllHoles
              ? 'bg-gray-300 text-gray-700'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {showAllHoles ? 'Hide ▲' : 'By Hole ▼'}
        </button>
      </div>

      {/* Expanded hole picker — all holes in order */}
      {showAllHoles && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mt-2">
          {holeOrder.map((h) => (
            <button
              key={h}
              onClick={() => setThroughHole(throughHole === h ? null : h)}
              className={`flex-shrink-0 w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                throughHole === h
                  ? 'bg-blue-600 text-white'
                  : h === myThroughHole
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      )}

      {/* Active filter indicator */}
      {throughHole !== null && (
        <div className="text-xs text-blue-600 mt-1.5 font-medium">
          Showing scores through Hole {throughHole} ({holeOrder.indexOf(throughHole) + 1} of {numHoles} holes)
        </div>
      )}
    </div>
  );
}
