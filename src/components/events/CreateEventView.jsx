import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';
import { TrashIcon } from '../icons';
import CourseSelector from '../shared/CourseSelector.jsx';
import RoundOptions from '../shared/RoundOptions.jsx';
import FormatSelector from '../shared/FormatSelector.jsx';

export default function CreateEventView({
  currentUser,
  currentLeague,
  globalCourses,
  formats,
  newEvent,
  setNewEvent,
  newTeam,
  setNewTeam,
  creatingEventForLeague,
  setCreatingEventForLeague,
  feedback,
  setFeedback,
  setView,
  setCurrentEvent,
  setCurrentLeague,
  generateEventCode,
  deviceId
}) {
  // Track selected course/tee IDs locally
  const selectedCourseId = newEvent.selectedCourseId || '';
  const selectedTeeId = newEvent.selectedTeeId || '';

  const handleCourseChange = (courseId) => {
    setNewEvent({
      ...newEvent,
      selectedCourseId: courseId,
      selectedTeeId: '',
      courseId: '',
      courseName: '',
      coursePars: [],
      courseYardages: [],
      courseStrokeIndexes: []
    });
  };

  const handleTeeChange = (teeId, teeData, courseData) => {
    setNewEvent({
      ...newEvent,
      selectedTeeId: teeId,
      courseId: courseData?.id || '',
      courseName: courseData?.name || '',
      coursePars: teeData?.pars || [],
      courseYardages: teeData?.yardages || [],
      courseStrokeIndexes: courseData?.strokeIndex || [],
      teeId: teeId,
      teeName: teeData?.name || '',
      teeRating: teeData?.rating || '',
      teeSlope: teeData?.slope || ''
    });
  };

  const handleFormatChange = (formatId, formatData) => {
    // Build smart display defaults based on the format's settings
    const handicapEnabled = formatData?.handicap?.enabled || false;
    const applicationMethod = formatData?.handicap?.applicationMethod || 'strokes';
    const scoringMethod = formatData?.scoringMethod || 'stroke';
    const competitionStructure = formatData?.competition?.structure || 'full_field';

    const smartDisplay = {
      showGross: true,
      showNet: handicapEnabled && applicationMethod === 'strokes',
      primarySort: handicapEnabled && applicationMethod === 'strokes' ? 'net' : 'gross',
      showRelativeToPar: true,
      showHoleByHole: true,
      showStrokeHoles: handicapEnabled && applicationMethod === 'strokes',
      showMulligansRemaining: handicapEnabled && applicationMethod === 'mulligans',
      showMatchStatus: scoringMethod === 'match_play' || competitionStructure === 'round_robin',
      showRoundRobinGrid: competitionStructure === 'round_robin'
    };

    setNewEvent({
      ...newEvent,
      formatId: formatId,
      format: formatData?.combinationMethod || 'scramble',
      scoringMethod: scoringMethod,
      teamSize: formatData?.teamSize || 2,
      formatName: formatData?.name || '',
      handicap: formatData?.handicap || { enabled: false, allowance: 100 },
      stablefordPoints: formatData?.stablefordPoints || null,
      competition: formatData?.competition || { structure: 'full_field' },
      display: smartDisplay
    });
  };

  const addTeam = () => {
    if (newEvent.teamSize === 1) {
      if (!newTeam.name) {
        setFeedback('Please enter player name');
        setTimeout(() => setFeedback(''), 2000);
        return;
      }
      setNewEvent({
        ...newEvent,
        teams: [...newEvent.teams, { name: newTeam.name, player1: newTeam.name, id: Date.now() }]
      });
      setNewTeam({ name: '', player1: '', player2: '' });
    } else {
      if (!newTeam.name || !newTeam.player1 || !newTeam.player2) {
        setFeedback('Please fill in all team fields');
        setTimeout(() => setFeedback(''), 2000);
        return;
      }
      setNewEvent({
        ...newEvent,
        teams: [...newEvent.teams, { ...newTeam, id: Date.now() }]
      });
      setNewTeam({ name: '', player1: '', player2: '' });
    }
  };

  const removeTeam = (teamId) => {
    setNewEvent({
      ...newEvent,
      teams: newEvent.teams.filter(t => t.id !== teamId)
    });
  };

  // Reusable toggle for display settings
  const DisplayToggle = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );

  const createEvent = async () => {
    const minPlayers = creatingEventForLeague ? 0 : (newEvent.teamSize === 1 ? 1 : 2);
    
    if (!newEvent.name || !newEvent.courseId || !newEvent.selectedTeeId || newEvent.teams.length < minPlayers) {
      const teamWord = newEvent.teamSize === 1 ? 'player' : 'teams';
      const teamMsg = minPlayers === 0 ? '' : ` and at least ${minPlayers} ${teamWord}`;
      setFeedback(`Please add event name, course/tee${teamMsg}`);
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    try {
      const eventId = 'event-' + Date.now();
      const eventCode = await generateEventCode(newEvent.courseId);

      const eventStartingHole = newEvent.startingHole || 1;
      const eventNumHoles = newEvent.numHoles || 18;

      // Calculate ending hole
      let eventEndingHole;
      if (eventNumHoles === 9) {
        eventEndingHole = eventStartingHole === 1 ? 9 : 18;
      } else {
        // 18 holes: if starting on 10, wrap around and end on 9
        eventEndingHole = eventStartingHole === 1 ? 18 : 9;
      }
      
      const eventData = {
        meta: {
          name: newEvent.name,
          courseId: newEvent.courseId,
          courseName: newEvent.courseName,
          coursePars: newEvent.coursePars,
          courseYardages: newEvent.courseYardages || [],
          courseStrokeIndexes: newEvent.courseStrokeIndexes || [],
          teeId: newEvent.teeId,
          teeName: newEvent.teeName,
          format: newEvent.format,               // combination method (scramble, etc.)
          formatId: newEvent.formatId || null,    // ← ADD: reference to format
          formatName: newEvent.formatName || '',  // ← ADD: human-readable name
          scoringMethod: newEvent.scoringMethod || 'stroke',  // ← ADD
          teamSize: newEvent.teamSize || 2,       // ← ADD
          handicap: newEvent.handicap || { enabled: false, allowance: 100 },  // ← ADD
          stablefordPoints: newEvent.stablefordPoints || null,  // ← ADD
          competition: newEvent.competition || { structure: 'full_field' },
          display: newEvent.display || {},
          date: newEvent.date,
          time: newEvent.time || null,
          numHoles: eventNumHoles,
          startingHole: eventStartingHole,
          endingHole: eventEndingHole,
          createdBy: currentUser?.uid || deviceId,
          status: creatingEventForLeague ? "draft" : "active",
          leagueId: creatingEventForLeague?.leagueId || null,
          seasonId: creatingEventForLeague?.seasonId || null,
          createdAt: Date.now(),
          eventCode: eventCode
        },
        teams: {},
        registrations: {}
      };

      if (!creatingEventForLeague) {
        newEvent.teams.forEach((team, index) => {
          const teamKey = `team-${Date.now()}-${index}`;
          eventData.teams[teamKey] = {
            name: team.name,
            players: newEvent.teamSize === 1 ? [team.player1] : [team.player1, team.player2],
            currentHole: eventStartingHole,
            holes: {},
            stats: {
              totalScore: 0,
              toPar: 0,
              totalPutts: 0,
              fairwaysHit: 0,
              fairwaysPossible: 0,
              greensInRegulation: 0,
              stablefordPoints: 0
            }
          };
        });
      }

      await set(ref(database, `events/${eventId}`), eventData);
      await set(ref(database, `eventCodes/${eventCode}`), eventId);

      if (creatingEventForLeague) {
        const seasonEventsRef = ref(database, `leagues/${creatingEventForLeague.leagueId}/seasons/${creatingEventForLeague.seasonId}/events`);
        const eventsSnapshot = await get(seasonEventsRef);
        const events = eventsSnapshot.val() || [];
        events.push(eventId);
        await set(seasonEventsRef, events);
      }

      setFeedback(`Event created! Code: ${eventCode}`);
      
      setTimeout(async () => {
        setNewEvent({
          name: '',
          courseId: '',
          selectedCourseId: '',
          selectedTeeId: '',
          courseName: '',
          coursePars: [],
          courseYardages: [],
          courseStrokeIndexes: [],
          teeId: '',
          teeName: '',
          date: new Date().toISOString().split('T')[0],
          time: '',
          format: 'scramble',
          formatId: '',                  // ← ADD
          formatName: '',                // ← ADD
          scoringMethod: 'stroke',       // ← ADD
          teamSize: 2,                   // ← ADD
          handicap: { enabled: false, allowance: 100 },  // ← ADD
          stablefordPoints: null,        // ← ADD
          competition: { structure: 'full_field' },
          display: {
            showGross: true, showNet: true, primarySort: 'net',
            showRelativeToPar: true, showHoleByHole: true, showStrokeHoles: true,
            showMulligansRemaining: false, showMatchStatus: false, showRoundRobinGrid: false
          },
          startingHole: 1,
          numHoles: 18,
          teams: []
        });
        setNewTeam({ name: '', player1: '', player2: '' });
        setFeedback('');
        
        if (creatingEventForLeague) {
          const leagueSnapshot = await get(ref(database, `leagues/${creatingEventForLeague.leagueId}`));
          const updatedLeague = leagueSnapshot.val();
          setCurrentLeague({ 
            id: creatingEventForLeague.leagueId, 
            ...updatedLeague, 
            userRole: currentLeague.userRole 
          });
          setCreatingEventForLeague(null);
          setView('league-dashboard');
        } else {
          setCurrentEvent({ id: eventId, ...eventData });
          setView('event-lobby');
        }
      }, 1500);

    } catch (error) {
      console.error('Error creating event:', error);
      setFeedback('Error creating event. Please try again.');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => {
            if (creatingEventForLeague) {
              setCreatingEventForLeague(null);
              setView('league-dashboard');
            } else {
              setView('home');
            }
          }} 
          className="text-white mb-6 hover:text-blue-200"
        >
          ← Back
        </button>
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Georgia, serif' }}>Create Event</h2>
          {creatingEventForLeague && (
            <div className="bg-blue-50 border-2 border-blue-200 p-3 rounded-lg mb-6">
              <div className="text-sm text-blue-800">Creating event for <strong>{currentLeague?.meta?.name}</strong></div>
            </div>
          )}
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Event Name</label>
              <input
                type="text"
                value={newEvent.name}
                onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                placeholder="e.g., Week 1 Scramble"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Shared Course/Tee Selector */}
            <CourseSelector
              globalCourses={globalCourses}
              selectedCourseId={selectedCourseId}
              selectedTeeId={selectedTeeId}
              onCourseChange={handleCourseChange}
              onTeeChange={handleTeeChange}
            />

            <FormatSelector
              formats={formats}
              selectedFormatId={newEvent.formatId || ''}
              onFormatChange={handleFormatChange}
            />

            {/* Leaderboard Display — only shown after a format is selected */}
            {newEvent.formatId && (
              <div className="border-2 border-gray-200 rounded-xl p-5">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Leaderboard Display</label>
                <p className="text-sm text-gray-500 mb-3">What should the scoreboard show for this event?</p>
                <div className="space-y-3">

                  {/* Always available */}
                  <DisplayToggle
                    label="Show scores relative to par"
                    description='Display "+3" or "-2" instead of just the total'
                    checked={newEvent.display?.showRelativeToPar ?? true}
                    onChange={(val) => setNewEvent({ ...newEvent, display: { ...newEvent.display, showRelativeToPar: val } })}
                  />
                  <DisplayToggle
                    label="Show hole-by-hole scores"
                    description="Show each hole's score, not just the running total"
                    checked={newEvent.display?.showHoleByHole ?? true}
                    onChange={(val) => setNewEvent({ ...newEvent, display: { ...newEvent.display, showHoleByHole: val } })}
                  />

                  {/* Handicap stroke display */}
                  {newEvent.handicap?.enabled && newEvent.handicap?.applicationMethod === 'strokes' && (
                    <>
                      <div className="border-t border-gray-200 pt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Handicap Display</p>
                      </div>
                      <DisplayToggle
                        label="Show Gross score"
                        description="The raw score before handicap adjustment"
                        checked={newEvent.display?.showGross ?? true}
                        onChange={(val) => setNewEvent({ ...newEvent, display: { ...newEvent.display, showGross: val } })}
                      />
                      <DisplayToggle
                        label="Show Net score"
                        description="The score after handicap strokes are subtracted"
                        checked={newEvent.display?.showNet ?? true}
                        onChange={(val) => setNewEvent({ ...newEvent, display: { ...newEvent.display, showNet: val } })}
                      />
                      {newEvent.display?.showGross && newEvent.display?.showNet && (
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Sort leaderboard by:</label>
                          <div className="flex gap-3">
                            {['net', 'gross'].map(sort => (
                              <label key={sort} className={`flex-1 text-center p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                                newEvent.display?.primarySort === sort
                                  ? 'border-blue-500 bg-blue-50 font-semibold'
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}>
                                <input
                                  type="radio"
                                  name="eventPrimarySort"
                                  value={sort}
                                  checked={newEvent.display?.primarySort === sort}
                                  onChange={() => setNewEvent({ ...newEvent, display: { ...newEvent.display, primarySort: sort } })}
                                  className="sr-only"
                                />
                                {sort === 'net' ? 'Net Score' : 'Gross Score'}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <DisplayToggle
                        label="Highlight stroke holes"
                        description="Mark which holes get a handicap stroke"
                        checked={newEvent.display?.showStrokeHoles ?? true}
                        onChange={(val) => setNewEvent({ ...newEvent, display: { ...newEvent.display, showStrokeHoles: val } })}
                      />
                    </>
                  )}

                  {/* Mulligan display */}
                  {newEvent.handicap?.enabled && newEvent.handicap?.applicationMethod === 'mulligans' && (
                    <>
                      <div className="border-t border-gray-200 pt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mulligan Display</p>
                      </div>
                      <DisplayToggle
                        label="Show mulligans remaining"
                        description="Display how many mulligans each team has left"
                        checked={newEvent.display?.showMulligansRemaining ?? true}
                        onChange={(val) => setNewEvent({ ...newEvent, display: { ...newEvent.display, showMulligansRemaining: val } })}
                      />
                    </>
                  )}

                  {/* Match play display */}
                  {(newEvent.scoringMethod === 'match_play' || newEvent.competition?.structure === 'round_robin') && (
                    <>
                      <div className="border-t border-gray-200 pt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Match Play Display</p>
                      </div>
                      <DisplayToggle
                        label="Show match status"
                        description='Display "2 UP", "1 DOWN", "AS" (all square)'
                        checked={newEvent.display?.showMatchStatus ?? true}
                        onChange={(val) => setNewEvent({ ...newEvent, display: { ...newEvent.display, showMatchStatus: val } })}
                      />
                    </>
                  )}

                  {/* Round robin display */}
                  {newEvent.competition?.structure === 'round_robin' && (
                    <DisplayToggle
                      label="Show round-robin results grid"
                      description="Display the grid showing who played whom and point totals"
                      checked={newEvent.display?.showRoundRobinGrid ?? true}
                      onChange={(val) => setNewEvent({ ...newEvent, display: { ...newEvent.display, showRoundRobinGrid: val } })}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
                <input
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Shared Round Options (9/18 holes + starting hole) */}
            {!creatingEventForLeague && (
              <RoundOptions
                numHoles={newEvent.numHoles || 18}
                startingHole={newEvent.startingHole || 1}
                onNumHolesChange={(n) => setNewEvent({ ...newEvent, numHoles: n })}
                onStartingHoleChange={(h) => setNewEvent({ ...newEvent, startingHole: h })}
              />
            )}

            {!creatingEventForLeague && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {newEvent.teamSize === 1 ? 'Players' : 'Teams'}
                </label>
                
                {newEvent.teams.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {newEvent.teams.map(team => (
                      <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-semibold text-gray-900">{team.name}</div>
                          {newEvent.teamSize !== 1 && (
                            <div className="text-sm text-gray-600">{team.player1} & {team.player2}</div>
                          )}
                        </div>
                        <button
                          onClick={() => removeTeam(team.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 p-4 bg-blue-50 rounded-xl">
                  {newEvent.teamSize === 1 ? (
                    <>
                      <input
                        type="text"
                        value={newTeam.name}
                        onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                        placeholder="Player name"
                        className="w-full px-4 py-2 rounded-lg border-2 border-blue-200 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={addTeam}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-semibold"
                      >
                        Add Player
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={newTeam.name}
                        onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                        placeholder="Team name"
                        className="w-full px-4 py-2 rounded-lg border-2 border-blue-200 focus:border-blue-500 focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={newTeam.player1}
                          onChange={(e) => setNewTeam({ ...newTeam, player1: e.target.value })}
                          placeholder="Player 1"
                          className="px-4 py-2 rounded-lg border-2 border-blue-200 focus:border-blue-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={newTeam.player2}
                          onChange={(e) => setNewTeam({ ...newTeam, player2: e.target.value })}
                          placeholder="Player 2"
                          className="px-4 py-2 rounded-lg border-2 border-blue-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={addTeam}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-semibold"
                      >
                        Add Team
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {feedback && (
              <div className="bg-blue-50 border-2 border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm">
                {feedback}
              </div>
            )}

            <button
              onClick={createEvent}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 shadow-lg"
            >
              Create Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
