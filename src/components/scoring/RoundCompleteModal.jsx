export default function RoundCompleteModal({ show, numHoles, onBackToLobby, onReview }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🏌️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Round Complete!</h2>
        <p className="text-gray-600 mb-6">
          All {numHoles} holes scored. Your scores have been saved.
        </p>
        <div className="space-y-3">
          <button
            onClick={onBackToLobby}
            className="w-full bg-[#e17055] text-white py-4 rounded-xl font-semibold text-lg shadow-lg transition-all"
          >
            Back to Lobby
          </button>
          <button
            onClick={onReview}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-all"
          >
            Review Scorecard
          </button>
        </div>
      </div>
    </div>
  );
}
