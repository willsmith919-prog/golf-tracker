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
          {meta.date ? (() => {
            const [y, m, d] = meta.date.split('-').map(Number);
            const dateStr = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
            if (!meta.time) return dateStr;
            const [h, min] = meta.time.split(':').map(Number);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hour12 = h % 12 || 12;
            return `${dateStr} at ${hour12}:${String(min).padStart(2, '0')} ${ampm}`;
          })() : '—'}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Holes:</span>
          {meta.numHoles} holes (starting on {meta.startingHole})
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="bg-[#f0f4ff] px-4 py-2 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">Event Code</div>
          <div className="font-mono font-bold text-[#00285e] text-lg">{meta.eventCode}</div>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(meta.eventCode);
            setFeedback('Code copied!');
            setTimeout(() => setFeedback(''), 2000);
          }}
          className="bg-[#00285e] text-white px-4 py-2 rounded-lg hover:bg-[#003a7d] text-sm font-semibold"
        >
          Copy Code
        </button>
      </div>

      {feedback && <div className="mt-2 text-sm text-green-600">{feedback}</div>}
    </div>
  );
}
