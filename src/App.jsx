import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, get, set, update, remove, onValue, off } from 'firebase/database';
import { auth, database } from './firebase';
import { getDeviceId } from './utils/helpers';
import './App.css';

// View components
import LoginView from './components/auth/LoginView.jsx';
import SignupView from './components/auth/SignupView.jsx';
import HomeView from './components/home/HomeView.jsx';
import CreateLeagueView from './components/leagues/CreateLeagueView.jsx';
import JoinLeagueView from './components/leagues/JoinLeagueView.jsx';
import LeagueDashboardView from './components/leagues/LeagueDashboardView.jsx';
import CreateEventView from './components/events/CreateEventView.jsx';
import EventLobbyView from './components/events/EventLobbyView.jsx';
import EventDetailsView from './components/events/EventDetailsView.jsx';
import EditEventView from './components/events/EditEventView.jsx';
import ScoringView from './components/scoring/ScoringView.jsx';
import ManageCoursesView from './components/admin/ManageCoursesView.jsx';
import AddEditCourseView from './components/admin/AddEditCourseView.jsx';
import SoloSetupView from './components/scoring/SoloSetupView.jsx';
import SoloScoringView from './components/scoring/SoloScoringView.jsx';
import PastRoundsView from './components/scoring/PastRoundsView.jsx';
import SoloScorecardView from './components/scoring/SoloScorecardView.jsx';

function App() {
  // ==================== HELPER FUNCTIONS ====================
  
  const isAdmin = () => {
    return currentUser && currentUser.email === 'willsmith919@gmail.com';
  };

  const generateEventCode = async (courseId) => {
    const coursePrefix = courseId.split('-')[0].toUpperCase().substring(0, 4);
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `${coursePrefix}-${randomPart}`;
    
    const snapshot = await get(ref(database, `eventCodes/${code}`));
    if (snapshot.exists()) {
      return generateEventCode(courseId);
    }
    
    return code;
  };

  const generateLeagueCode = async () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = '0123456789';
    
    let code;
    let exists = true;
    
    while (exists) {
      const letters = Array(3).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
      const numbers = Array(4).fill(0).map(() => nums[Math.floor(Math.random() * nums.length)]).join('');
      code = `${letters}-${numbers}`;
      
      const snapshot = await get(ref(database, `leagueCodes/${code}`));
      exists = snapshot.exists();
    }
    
    return code;
  };

  const loadUserLeagues = async (userId) => {
    try {
      const userSnapshot = await get(ref(database, `users/${userId}/leagues`));
      const userLeagues = userSnapshot.val() || {};
      
      const leaguesData = [];
      for (const leagueId of Object.keys(userLeagues)) {
        const leagueSnapshot = await get(ref(database, `leagues/${leagueId}`));
        const league = leagueSnapshot.val();
        if (league) {
          leaguesData.push({ id: leagueId, ...league, userRole: userLeagues[leagueId].role });
        }
      }
      
      return leaguesData;
    } catch (error) {
      console.error('Error loading leagues:', error);
      return [];
    }
  };

  // ==================== STATE DECLARATIONS ====================
  
  // View state
  const [view, setView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Course state
  const [courses, setCourses] = useState([]);
  const [globalCourses, setGlobalCourses] = useState([]);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({
    name: '',
    location: '',
    strokeIndex: Array(18).fill(''),
    tees: [{
      id: 'tee-1',
      name: '',
      rating: '',
      slope: '',
      pars: Array(18).fill(''),
      yardages: Array(18).fill('')
    }]
  });
  
  // Event creation state
  const [newEvent, setNewEvent] = useState({
    name: '',
    courseId: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    format: 'scramble',
    startingHole: 1,
    teams: []
  });
  const [selectedBaseCourse, setSelectedBaseCourse] = useState('');
  const [newTeam, setNewTeam] = useState({ name: '', player1: '', player2: '' });
  
  // Current event/team state
  const [joinCode, setJoinCode] = useState('');
  const [currentEvent, setCurrentEvent] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  
  // UI state
  const [feedback, setFeedback] = useState('');
  const [scoreConfirmation, setScoreConfirmation] = useState(null);
  
  // Auth state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [signupHandicap, setSignupHandicap] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading2, setAuthLoading2] = useState(false);
  
  // League state
  const [userLeagues, setUserLeagues] = useState([]);
  const [currentLeague, setCurrentLeague] = useState(null);
  const [newLeague, setNewLeague] = useState({
    name: '',
    description: '',
    seasonName: '2026 Season',
    pointSystem: { 1: 20, 2: 16, 3: 13, 4: 10, 5: 8 }
  });
  const [leagueCode, setLeagueCode] = useState('');
  const [creatingEventForLeague, setCreatingEventForLeague] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [leagueEvents, setLeagueEvents] = useState([]);
  const [eventRegistrations, setEventRegistrations] = useState({});
  
  // Refs
  const eventListenerRef = useRef(null);
  const undoTimerRef = useRef(null);
  const deviceId = getDeviceId();

  // Solo Scoring
  const [currentSoloRound, setCurrentSoloRound] = useState(null);

  // ==================== LOAD COURSES ====================
  
  const loadCourses = async () => {
    try {
      const coursesSnapshot = await get(ref(database, 'courses'));
      const coursesData = coursesSnapshot.val() || {};
      const coursesArray = Object.entries(coursesData).map(([id, data]) => ({
        id,
        ...data
      })).sort((a, b) => a.name.localeCompare(b.name));
      
      setGlobalCourses(coursesArray);
      
      const eventCourses = [];
      coursesArray.forEach(course => {
        Object.entries(course.tees || {}).forEach(([teeId, tee]) => {
          eventCourses.push({
            id: `${course.id}-${teeId}`,
            courseId: course.id,
            teeId: teeId,
            name: course.name,
            location: course.location,
            teeName: tee.name,
            holes: tee.pars,
            pars: tee.pars,
            yardages: tee.yardages,
            strokeIndex: course.strokeIndex,
            rating: tee.rating,
            slope: tee.slope
          });
        });
      });
      
      setCourses(eventCourses);
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  // ==================== EFFECTS ====================
  
  useEffect(() => { 
    loadCourses(); 
  }, []);

  useEffect(() => {
    return () => {
      if (eventListenerRef.current) {
        off(eventListenerRef.current);
      }
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const profileSnapshot = await get(ref(database, `users/${user.uid}`));
          const profile = profileSnapshot.val();
          setUserProfile(profile);
          
          const leagues = await loadUserLeagues(user.uid);
          setUserLeagues(leagues);
          
          if (view === 'login' || view === 'signup') {
            setView('home');
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUserProfile(null);
        setUserLeagues([]);
        setView('login');
      }
      
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load league events when viewing dashboard
  useEffect(() => {
    const loadLeagueEvents = async () => {
      if (view !== 'league-dashboard' || !currentLeague) {
        setLeagueEvents([]);
        return;
      }

      const activeSeason = Object.values(currentLeague.seasons || {}).find(s => s.status === 'active');
      
      if (!activeSeason || !activeSeason.events) {
        setLeagueEvents([]);
        return;
      }

      try {
        const eventsData = [];
        for (const eventId of activeSeason.events) {
          const snapshot = await get(ref(database, `events/${eventId}`));
          const event = snapshot.val();
          if (event) {
            eventsData.push({ id: eventId, ...event });
          }
        }
        eventsData.sort((a, b) => new Date(a.meta.date) - new Date(b.meta.date));
        setLeagueEvents(eventsData);

        activeSeason.events.forEach(eventId => {
          const eventRef = ref(database, `events/${eventId}`);
          onValue(eventRef, (snapshot) => {
            const updatedEvent = snapshot.val();
            if (updatedEvent) {
              setLeagueEvents(prev => {
                const updated = prev.map(e => 
                  e.id === eventId ? { id: eventId, ...updatedEvent } : e
                );
                return updated.sort((a, b) => new Date(a.meta.date) - new Date(b.meta.date));
              });
            }
          });
        });
      } catch (error) {
        console.error('Error loading league events:', error);
      }
    };

    loadLeagueEvents();

    return () => {
      if (view === 'league-dashboard' && currentLeague) {
        const activeSeason = Object.values(currentLeague.seasons || {}).find(s => s.status === 'active');
        if (activeSeason?.events) {
          activeSeason.events.forEach(eventId => {
            off(ref(database, `events/${eventId}`));
          });
        }
      }
    };
  }, [view, currentLeague]);

  // Populate edit form when editingEvent changes
  useEffect(() => {
    if (editingEvent && view === 'edit-event') {
      setEditForm({
        name: editingEvent.meta.name,
        courseId: editingEvent.meta.courseId,
        date: editingEvent.meta.date,
        time: editingEvent.meta.time || '',
        format: editingEvent.meta.format
      });
    } else {
      setEditForm(null);
    }
  }, [editingEvent, view]);

  // ==================== LOADING STATE ====================
  
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // ==================== VIEW ROUTING ====================

  if (view === 'login') {
    return (
      <LoginView
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        authError={authError}
        setAuthError={setAuthError}
        authLoading2={authLoading2}
        setAuthLoading2={setAuthLoading2}
        setView={setView}
      />
    );
  }

  if (view === 'signup') {
    return (
      <SignupView
        signupEmail={signupEmail}
        setSignupEmail={setSignupEmail}
        signupPassword={signupPassword}
        setSignupPassword={setSignupPassword}
        signupDisplayName={signupDisplayName}
        setSignupDisplayName={setSignupDisplayName}
        signupHandicap={signupHandicap}
        setSignupHandicap={setSignupHandicap}
        authError={authError}
        setAuthError={setAuthError}
        authLoading2={authLoading2}
        setAuthLoading2={setAuthLoading2}
        setView={setView}
      />
    );
  }

  if (view === 'home') {
    return (
      <HomeView
        currentUser={currentUser}
        userProfile={userProfile}
        userLeagues={userLeagues}
        isAdmin={isAdmin}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        feedback={feedback}
        setFeedback={setFeedback}
        setView={setView}
        setCurrentLeague={setCurrentLeague}
        setCurrentEvent={setCurrentEvent}
      />
    );
  }

  if (view === 'create-league') {
    return (
      <CreateLeagueView
        currentUser={currentUser}
        userProfile={userProfile}
        newLeague={newLeague}
        setNewLeague={setNewLeague}
        feedback={feedback}
        setFeedback={setFeedback}
        setView={setView}
        setCurrentLeague={setCurrentLeague}
        setUserLeagues={setUserLeagues}
        generateLeagueCode={generateLeagueCode}
        loadUserLeagues={loadUserLeagues}
      />
    );
  }

  if (view === 'join-league') {
    return (
      <JoinLeagueView
        currentUser={currentUser}
        userProfile={userProfile}
        leagueCode={leagueCode}
        setLeagueCode={setLeagueCode}
        feedback={feedback}
        setFeedback={setFeedback}
        setView={setView}
        setCurrentLeague={setCurrentLeague}
        setUserLeagues={setUserLeagues}
        loadUserLeagues={loadUserLeagues}
      />
    );
  }

  if (view === 'league-dashboard' && currentLeague) {
    return (
      <LeagueDashboardView
        currentUser={currentUser}
        currentLeague={currentLeague}
        setCurrentLeague={setCurrentLeague}
        leagueEvents={leagueEvents}
        feedback={feedback}
        setFeedback={setFeedback}
        setView={setView}
        setCreatingEventForLeague={setCreatingEventForLeague}
        setEditingEvent={setEditingEvent}
      />
    );
  }

  if (view === 'create-event') {
    return (
      <CreateEventView
        currentUser={currentUser}
        currentLeague={currentLeague}
        courses={courses}
        globalCourses={globalCourses}
        newEvent={newEvent}
        setNewEvent={setNewEvent}
        selectedBaseCourse={selectedBaseCourse}
        setSelectedBaseCourse={setSelectedBaseCourse}
        newTeam={newTeam}
        setNewTeam={setNewTeam}
        creatingEventForLeague={creatingEventForLeague}
        setCreatingEventForLeague={setCreatingEventForLeague}
        feedback={feedback}
        setFeedback={setFeedback}
        setView={setView}
        setCurrentEvent={setCurrentEvent}
        setCurrentLeague={setCurrentLeague}
        generateEventCode={generateEventCode}
        deviceId={deviceId}
      />
    );
  }

  if (view === 'event-lobby' && currentEvent) {
    return (
      <EventLobbyView
        currentEvent={currentEvent}
        feedback={feedback}
        setFeedback={setFeedback}
        setView={setView}
        setSelectedTeam={setSelectedTeam}
      />
    );
  }

  if (view === 'event-details' && editingEvent) {
    return (
      <EventDetailsView
        currentUser={currentUser}
        userProfile={userProfile}
        currentLeague={currentLeague}
        editingEvent={editingEvent}
        setEditingEvent={setEditingEvent}
        eventRegistrations={eventRegistrations}
        feedback={feedback}
        setFeedback={setFeedback}
        setView={setView}
      />
    );
  }

  if (view === 'scoring' && currentEvent && selectedTeam) {
    return (
      <ScoringView
        currentEvent={currentEvent}
        setCurrentEvent={setCurrentEvent}
        selectedTeam={selectedTeam}
        setSelectedTeam={setSelectedTeam}
        feedback={feedback}
        setFeedback={setFeedback}
        scoreConfirmation={scoreConfirmation}
        setScoreConfirmation={setScoreConfirmation}
        setView={setView}
      />
    );
  }

  if (view === 'edit-event' && editingEvent && editForm) {
    return (
      <EditEventView
        editingEvent={editingEvent}
        setEditingEvent={setEditingEvent}
        editForm={editForm}
        setEditForm={setEditForm}
        courses={courses}
        globalCourses={globalCourses}
        feedback={feedback}
        setFeedback={setFeedback}
        setView={setView}
      />
    );
  }

  if (view === 'manage-courses') {
    return (
      <ManageCoursesView
        globalCourses={globalCourses}
        feedback={feedback}
        setFeedback={setFeedback}
        setView={setView}
        setCourseForm={setCourseForm}
        setEditingCourse={setEditingCourse}
        loadCourses={loadCourses}
      />
    );
  }

  if (view === 'add-edit-course') {
    return (
      <AddEditCourseView
        currentUser={currentUser}
        courseForm={courseForm}
        setCourseForm={setCourseForm}
        editingCourse={editingCourse}
        setEditingCourse={setEditingCourse}
        feedback={feedback}
        setFeedback={setFeedback}
        setView={setView}
        loadCourses={loadCourses}
      />
    );
  }

  if (view === 'solo-setup') {
    return (
      <SoloSetupView 
        setView={setView}
        setCurrentSoloRound={setCurrentSoloRound}
        user={currentUser}
      />
    );
  }

  if (view === 'solo-scoring') {
    return (
      <SoloScoringView
        currentSoloRound={currentSoloRound}
        setCurrentSoloRound={setCurrentSoloRound}
        setView={setView}
        user={currentUser}
      />
    );
  }

  if (view === 'past-rounds') {
    return (
      <PastRoundsView
        user={currentUser}
        setView={setView}
        setCurrentSoloRound={setCurrentSoloRound}
      />
    );
  }

  if (view === 'solo-scorecard') {
    return (
      <SoloScorecardView
        currentSoloRound={currentSoloRound}
        setView={setView}
      />
    );
  }
  return null;
}

export default App;