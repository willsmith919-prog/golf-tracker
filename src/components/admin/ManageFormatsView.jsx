import { ref, remove } from 'firebase/database';
import { database } from '../../firebase';

// ============================================================
// MANAGE FORMATS VIEW — List all formats with edit/delete
// Mirrors the ManageCoursesView pattern.
// ============================================================

export default function ManageFormatsView({
  formats,
  feedback,
  setFeedback,
  setView,
  setFormatForm,
  setEditingFormat,
  loadFormats
}) {
  console.log('ManageFormatsView rendering, formats:', formats);
  const teamSizeLabels = {
    1: 'Individual',
    2: '2-Person Team',
    4: '4-Person Team'
  };

  const scoringMethodLabels = {
    stroke: 'Stroke Play',
    stableford: 'Stableford',
    match_play: 'Match Play'
  };

  const combinationLabels = {
    individual: 'Individual',
    scramble: 'Scramble',
    shamble: 'Shamble',
    bestball: 'Best Ball',
    alternate_shot: 'Alternate Shot'
  };

  const handleEdit = (format) => {
    setEditingFormat(format);
    setFormatForm({
      name: format.name || '',
      description: format.description || '',
      teamSize: format.teamSize || 2,
      scoringMethod: format.scoringMethod || 'stroke',
      combinationMethod: format.combinationMethod || 'scramble',
      handicapEnabled: format.handicap?.enabled || false,
      handicapAllowance: format.handicap?.allowance || 100,
      stablefordPoints: format.stablefordPoints || {
        albatross: 5,
        eagle: 4,
        birdie: 3,
        par: 2,
        bogey: 1,
        doubleBogey: 0,
        worse: 0
      }
    });
    setView('add-edit-format');
  };

  const handleDelete = async (format) => {
    if (!confirm(`Delete "${format.name}"? This cannot be undone.`)) return;

    try {
      await remove(ref(database, `formats/${format.id}`));
      setFeedback(`Deleted "${format.name}"`);
      setTimeout(() => setFeedback(''), 2000);
      loadFormats();
    } catch (error) {
      console.error('Error deleting format:', error);
      setFeedback('Error deleting format');
      setTimeout(() => setFeedback(''), 2000);
    }
  };

  const handleAdd = () => {
    setEditingFormat(null);
    setFormatForm({
      name: '',
      description: '',
      teamSize: 2,
      scoringMethod: 'stroke',
      combinationMethod: 'scramble',
      handicapEnabled: false,
      handicapAllowance: 100,
      stablefordPoints: {
        albatross: 5,
        eagle: 4,
        birdie: 3,
        par: 2,
        bogey: 1,
        doubleBogey: 0,
        worse: 0
      }
    });
    setView('add-edit-format');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setView('home')}
          className="text-white mb-6 hover:text-blue-200"
        >
          ← Back
        </button>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
              Manage Formats
            </h2>
            <button
              onClick={handleAdd}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 font-semibold"
            >
              + Add Format
            </button>
          </div>

          {feedback && (
            <div className="mb-4 bg-blue-50 border-2 border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm">
              {feedback}
            </div>
          )}

          {formats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No formats yet. Click "+ Add Format" to create one.
            </p>
          ) : (
            <div className="space-y-4">
              {formats.map(format => (
                <div key={format.id} className="border-2 border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{format.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{format.description}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                          {teamSizeLabels[format.teamSize] || `${format.teamSize}-Person`}
                        </span>
                        <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                          {scoringMethodLabels[format.scoringMethod] || format.scoringMethod}
                        </span>
                        {format.teamSize > 1 && (
                          <span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                            {combinationLabels[format.combinationMethod] || format.combinationMethod}
                          </span>
                        )}
                        {format.handicap?.enabled && (
                          <span className="inline-block bg-orange-100 text-orange-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                            Handicap: {format.handicap.allowance}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(format)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(format)}
                        className="text-red-600 hover:text-red-800 text-sm font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
