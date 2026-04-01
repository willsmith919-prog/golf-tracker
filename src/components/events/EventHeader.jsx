export default function EventHeader({ currentEvent, isHost, eventStatus, feedback, setView, setFeedback }) {
  const meta = currentEvent.meta;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-gray-900">{meta.name}</h1>
        <div className="flex items-center gap-2">
          {isHost && (eventStatus === 'open' || eventStatus === 'active') && (
            <button
              onClick={() => setView('edit-event')}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
            >
              ✏️ Edit
            </button>
          )}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
            eventStatus === 'open'
              ? 'bg-yellow-100 text-yellow-700'
              : eventStatus === 'active'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {eventStatus === 'active' && '🔴 '}{eventStatus}
          </span>
        </div>
      </div>

      <div className="space-y-1 text-gray-600">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Course:</span>
          {meta.courseName}
          {meta.teeName && (
            <span className="text-gray-400">({meta.teeName})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Format:</span>
          {meta.formatName || meta.format}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Date:</span>
          {new Date(meta.date).toLocaleDateString()}
          {meta.time && ` at ${meta.time}`}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Holes:</span>
          {meta.numHoles} holes (starting on {meta.startingHole})
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="bg-blue-50 px-4 py-2 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">Event Code</div>
          <div className="font-mono font-bold text-blue-600 text-lg">{meta.eventCode}</div>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(meta.eventCode);
            setFeedback('Code copied!');
            setTimeout(() => setFeedback(''), 2000);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
        >
          Copy Code
        </button>
      </div>

      {feedback && <div className="mt-2 text-sm text-green-600">{feedback}</div>}
    </div>
  );
}
