// ============================================================
// ROUND OPTIONS — Reusable component for hole count + starting hole
//
// Used by both SoloSetupView and CreateEventView so the
// round configuration UI only needs to be maintained in one place.
//
// Props:
//   numHoles       — 9 or 18
//   startingHole   — 1 or 10
//   onNumHolesChange    — callback: (numHoles) => void
//   onStartingHoleChange — callback: (startingHole) => void
// ============================================================

export default function RoundOptions({
  numHoles = 18,
  startingHole = 1,
  onNumHolesChange,
  onStartingHoleChange
}) {
  return (
    <>
      {/* Number of Holes */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Number of Holes
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-center p-4 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="numHoles"
              value="9"
              checked={numHoles === 9}
              onChange={() => onNumHolesChange(9)}
              className="w-5 h-5 text-blue-600"
            />
            <span className="ml-3 text-gray-900 font-medium">9 Holes</span>
          </label>
          <label className="flex items-center justify-center p-4 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="numHoles"
              value="18"
              checked={numHoles === 18}
              onChange={() => onNumHolesChange(18)}
              className="w-5 h-5 text-blue-600"
            />
            <span className="ml-3 text-gray-900 font-medium">18 Holes</span>
          </label>
        </div>
      </div>

      {/* Starting Hole */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Starting Hole
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-center p-4 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="startingHole"
              value="1"
              checked={startingHole === 1}
              onChange={() => onStartingHoleChange(1)}
              className="w-5 h-5 text-blue-600"
            />
            <span className="ml-3 text-gray-900 font-medium">
              {numHoles === 9 ? 'Front 9 (1-9)' : 'Hole 1'}
            </span>
          </label>
          <label className="flex items-center justify-center p-4 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="startingHole"
              value="10"
              checked={startingHole === 10}
              onChange={() => onStartingHoleChange(10)}
              className="w-5 h-5 text-blue-600"
            />
            <span className="ml-3 text-gray-900 font-medium">
              {numHoles === 9 ? 'Back 9 (10-18)' : 'Hole 10'}
            </span>
          </label>
        </div>
      </div>
    </>
  );
}
