import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';
import { TrashIcon } from '../icons';

export default function CreateEventView({
  currentUser,
  currentLeague,
  courses,
  globalCourses,
  newEvent,
  setNewEvent,
  selectedBaseCourse,
  setSelectedBaseCourse,
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
  const addTeam = () => {
    if (newEvent.format === 'stableford') {
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

  const createEvent = async () => {
    const minPlayers = creatingEventForLeague ? 0 : (newEvent.format === 'stableford' ? 1 : 2);
    
    if (!newEvent.name || !newEvent.courseId || newEvent.teams.length < minPlayers) {
      const teamWord = newEvent.format === 'stableford' ? 'player' : 'teams';
      const teamMsg = minPlayers === 0 ? '' : ` and at least ${minPlayers} ${teamWord}`;
      setFeedback(`Please add event name, course${teamMsg}`);
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    try {
      const course = courses.find(c => c.id === newEvent.courseId);
      const eventId = 'event-' + Date.now();
      const eventCode = await generateEventCode(course.id);
      
      const eventData = {
        meta: {
          name: newEvent.name,
          courseId: course.id,
          courseName: course.name,
          coursePars: course.holes,
          format: newEvent.format,
          date: newEvent.date,
          time: newEvent.time || null,
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
            players: newEvent.format === 'stableford' ? [team.player1] : [team.player1, team.player2],
            currentHole: newEvent.startingHole,
            scores: {}
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
          date: new Date().toISOString().split('T')[0],
          time: '',
          format: 'scramble',
          startingHole: 1,
          teams: []
        });
        setSelectedBaseCourse('');
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

  const formatNames = {
    scramble: "2-Man Scramble",
    shamble: "2-Man Shamble",
    bestball: "2-Man Best Ball",
    stableford: "Individual Stableford"
  };

  const formatDescriptions = {
    scramble: "Both players hit, pick the best shot, both play from there. One team score per hole.",
    shamble: "Both players hit, pick the best drive, then each plays their own ball. Best individual score counts.",
    bestball: "Each player plays their own ball. Lower score of the two counts for the team.",
    stableford: "Individual scoring. Points awarded based on score vs par. Highest points wins."
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
                placeholder="March Scramble"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Course</label>
              <select
                value={selectedBaseCourse}
                onChange={(e) => {
                  setSelectedBaseCourse(e.target.value);
                  setNewEvent({ ...newEvent, courseId: '' });
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select a course</option>
                {globalCourses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name} {course.location && `- ${course.location}`}
                  </option>
                ))}
              </select>
            </div>

            {selectedBaseCourse && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tee</label>
                <select
                  value={newEvent.courseId}
                  onChange={(e) => setNewEvent({ ...newEvent, courseId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select a tee</option>
                  {courses
                    .filter(c => c.courseId === selectedBaseCourse)
                    .map(course => {
                      const totalYards = course.yardages?.reduce((sum, y) => sum + (parseInt(y) || 0), 0) || 0;
                      return (
                        <option key={course.id} value={course.id}>
                          {course.teeName} - Rating: {course.rating} / Slope: {course.slope} / {totalYards} yards
                        </option>
                      );
                    })}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Format</label>
              <select
                value={newEvent.format}
                onChange={(e) => setNewEvent({ ...newEvent, format: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="scramble">2-Man Scramble</option>
                <option value="shamble">2-Man Shamble</option>
                <option value="bestball">2-Man Best Ball</option>
                <option value="stableford">Individual Stableford</option>
              </select>
              <p className="text-sm text-gray-600 mt-2">{formatDescriptions[newEvent.format]}</p>
            </div>

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

            {!creatingEventForLeague && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Starting Hole</label>
                <select
                  value={newEvent.startingHole}
                  onChange={(e) => setNewEvent({ ...newEvent, startingHole: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => (
                    <option key={hole} value={hole}>Hole {hole}</option>
                  ))}
                </select>
              </div>
            )}

            {!creatingEventForLeague && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {newEvent.format === 'stableford' ? 'Players' : 'Teams'}
                </label>
                
                {newEvent.teams.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {newEvent.teams.map(team => (
                      <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-semibold text-gray-900">{team.name}</div>
                          {newEvent.format !== 'stableford' && (
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
                  {newEvent.format === 'stableford' ? (
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
