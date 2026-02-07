import { UsersIcon } from '../icons';

export default function EventLobbyView({
  currentEvent,
  feedback,
  setFeedback,
  setView,
  setSelectedTeam
}) {
  const teams = Object.entries(currentEvent.teams || {}).map(([key, data]) => ({
    key,
    ...data
  }));

  const handleJoinTeam = (teamKey) => {
    setSelectedTeam(teamKey);
    setView('scoring');
  };

  const formatNames = {
    scramble: "2-Man Scramble",
    shamble: "2-Man Shamble",
    bestball: "2-Man Best Ball",
    stableford: "Individual Stableford"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">
          ← Back to Home
        </button>

        {/* Event Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentEvent.meta.name}</h1>
          <div className="space-y-1 text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Course:</span>
              {currentEvent.meta.courseName}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Format:</span>
              {formatNames[currentEvent.meta.format]}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Date:</span>
              {new Date(currentEvent.meta.date).toLocaleDateString()}
              {currentEvent.meta.time && ` at ${currentEvent.meta.time}`}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="bg-blue-50 px-4 py-2 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Event Code</div>
              <div className="font-mono font-bold text-blue-600 text-lg">{currentEvent.meta.eventCode}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentEvent.meta.eventCode);
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

        {/* Teams */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {currentEvent.meta.format === 'stableford' ? 'Players' : 'Teams'}
          </h2>
          
          {teams.length > 0 ? (
            <div className="space-y-3">
              {teams.map(team => (
                <div key={team.key} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{team.name}</div>
                      <div className="text-sm text-gray-600">
                        {team.players.join(' & ')}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Currently on hole {team.currentHole}
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinTeam(team.key)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold"
                    >
                      View Scores
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <UsersIcon className="mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600">No teams yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
