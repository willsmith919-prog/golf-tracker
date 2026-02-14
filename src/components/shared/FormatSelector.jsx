// ============================================================
// FORMAT SELECTOR — Reusable format selection component
//
// Displays a dropdown of all configured formats from Firebase.
// When a format is selected, it calls onFormatChange with the
// full format object so the parent has all the config details.
//
// Props:
//   formats           — array of format objects from Firebase
//   selectedFormatId  — currently selected format ID (or '')
//   onFormatChange    — callback: (formatId, formatData) => void
//   disabled          — optional, disables the dropdown
// ============================================================

export default function FormatSelector({
  formats = [],
  selectedFormatId = '',
  onFormatChange,
  disabled = false
}) {
  const selectedFormat = formats.find(f => f.id === selectedFormatId) || null;

  // Sort formats alphabetically
  const sortedFormats = [...formats].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  // Group formats by team size for easier scanning
  const individualFormats = sortedFormats.filter(f => f.teamSize === 1);
  const teamFormats = sortedFormats.filter(f => f.teamSize > 1);

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Format
      </label>
      <select
        value={selectedFormatId}
        onChange={(e) => {
          const formatId = e.target.value;
          const formatData = formats.find(f => f.id === formatId) || null;
          onFormatChange(formatId, formatData);
        }}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">Select a format</option>
        
        {teamFormats.length > 0 && (
          <optgroup label="Team Formats">
            {teamFormats.map(format => (
              <option key={format.id} value={format.id}>
                {format.name}
              </option>
            ))}
          </optgroup>
        )}

        {individualFormats.length > 0 && (
          <optgroup label="Individual Formats">
            {individualFormats.map(format => (
              <option key={format.id} value={format.id}>
                {format.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {/* Show description of selected format */}
      {selectedFormat && (
        <p className="text-sm text-gray-600 mt-2">{selectedFormat.description}</p>
      )}
    </div>
  );
}
