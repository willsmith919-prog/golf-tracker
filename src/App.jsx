import { useState, useEffect, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut 
} from 'firebase/auth';
import { ref, get, set, update, remove, onValue, off } from 'firebase/database';
import { auth, database } from './firebase';
import { getDeviceId } from './utils/helpers';
import { 
  TrophyIcon,
  UsersIcon,
  PlusIcon,
  CalendarIcon,
  TrashIcon,
  LinkIcon,
  BarChartIcon,
  ClipboardListIcon,
  CopyIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RotateCcwIcon,
  EditIcon
} from './components/icons';
import './App.css';

function App() {
  // ==================== HELPER FUNCTIONS ====================
  
  // Admin check
  const isAdmin = () => {
    return currentUser && currentUser.email === 'willsmith919@gmail.com';
  };

  // Generate short event code
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

  // Generate league code
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
  const [managingCourses, setManagingCourses] = useState(false);
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
  const [eventValidationMessages, setEventValidationMessages] = useState({});
  
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
  const [expandedTeams, setExpandedTeams] = useState([]);
  const [editingHole, setEditingHole] = useState(null);
  const [playerScores, setPlayerScores] = useState(null);
  const [viewingTeamScorecard, setViewingTeamScorecard] = useState(null);
  
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
  const [editingTeamName, setEditingTeamName] = useState(null);
  const [tempTeamName, setTempTeamName] = useState('');
  
  // Refs
  const eventListenerRef = useRef(null);
  const undoTimerRef = useRef(null);
  const deviceId = getDeviceId();

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
      
      // Build courses array for event creation (flattened course+tee combinations)
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
            holes: tee.pars, // backwards compat
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
  
  // Initialize courses and cleanup
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

        // Set up real-time listeners
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

  // ==================== LOGIN VIEW ====================
  
  if (view === 'login') {
    const handleLogin = async (e) => {
      e.preventDefault();
      setAuthError('');
      setAuthLoading2(true);

      try {
        await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      } catch (err) {
        console.error('Login error:', err);
        if (err.code === 'auth/user-not-found') {
          setAuthError('No account found with this email');
        } else if (err.code === 'auth/wrong-password') {
          setAuthError('Incorrect password');
        } else if (err.code === 'auth/invalid-email') {
          setAuthError('Invalid email address');
        } else {
          setAuthError('Login failed. Please try again.');
        }
      }

      setAuthLoading2(false);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>LiveLinks</h1>
            <p className="text-blue-200">Golf League Management</p>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Login</h2>

            {authError && (
              <div className="bg-red-50 border-2 border-red-200 text-red-800 p-3 rounded-lg mb-4 text-sm">
                {authError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading2}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading2 ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setAuthError('');
                  setView('signup');
                }}
                className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                Don't have an account? Sign up
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== SIGNUP VIEW ====================
  
  if (view === 'signup') {
    const handleSignup = async (e) => {
      e.preventDefault();
      setAuthError('');
      setAuthLoading2(true);

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
        const user = userCredential.user;

        await set(ref(database, `users/${user.uid}`), {
          email: signupEmail,
          displayName: signupDisplayName,
          handicap: signupHandicap ? parseFloat(signupHandicap) : null,
          createdAt: Date.now()
        });

      } catch (err) {
        console.error('Signup error:', err);
        if (err.code === 'auth/email-already-in-use') {
          setAuthError('This email is already registered');
        } else if (err.code === 'auth/invalid-email') {
          setAuthError('Invalid email address');
        } else if (err.code === 'auth/weak-password') {
          setAuthError('Password must be at least 6 characters');
        } else {
          setAuthError('Signup failed. Please try again.');
        }
      }

      setAuthLoading2(false);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>LiveLinks</h1>
            <p className="text-blue-200">Golf League Management</p>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign Up</h2>

            {authError && (
              <div className="bg-red-50 border-2 border-red-200 text-red-800 p-3 rounded-lg mb-4 text-sm">
                {authError}
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={signupDisplayName}
                  onChange={(e) => setSignupDisplayName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  placeholder="How you'll appear in the league"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Handicap Index (Optional)</label>
                <input
                  type="number"
                  step="0.1"
                  value={signupHandicap}
                  onChange={(e) => setSignupHandicap(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. 12.4"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading2}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading2 ? 'Creating account...' : 'Sign Up'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setAuthError('');
                  setView('login');
                }}
                className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                Already have an account? Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // ==================== HOME VIEW ====================
  
  if (view === 'home') {
    const joinEvent = async () => {
      if (!joinCode) {
        setFeedback('Please enter an event code');
        setTimeout(() => setFeedback(''), 2000);
        return;
      }

      try {
        const codeSnapshot = await get(ref(database, `eventCodes/${joinCode}`));
        if (!codeSnapshot.exists()) {
          setFeedback('Event not found. Check your code.');
          setTimeout(() => setFeedback(''), 3000);
          return;
        }

        const eventId = codeSnapshot.val();
        const eventSnapshot = await get(ref(database, `events/${eventId}`));
        
        if (!eventSnapshot.exists()) {
          setFeedback('Event not found.');
          setTimeout(() => setFeedback(''), 3000);
          return;
        }

        const event = eventSnapshot.val();
        setCurrentEvent({ id: eventId, ...event });
        setJoinCode('');
        setView('event-lobby');
        setFeedback('');
      } catch (error) {
        console.error('Error joining event:', error);
        setFeedback('Error joining event. Please try again.');
        setTimeout(() => setFeedback(''), 3000);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 font-sans">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>LiveLinks</h1>
              {userProfile && (
                <p className="text-white/80">Welcome, {userProfile.displayName}</p>
              )}
            </div>
            <button
              onClick={async () => {
                await signOut(auth);
                setView('login');
              }}
              className="text-white/80 hover:text-white text-sm font-medium"
            >
              Logout
            </button>
          </div>

          {/* ADMIN SECTION */}
          {isAdmin() && (
            <div className="mb-6">
              <h2 className="text-white text-lg font-semibold mb-3">⚙️ ADMIN</h2>
              <button
                onClick={() => setView('manage-courses')}
                className="w-full bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold text-gray-900">Manage Courses</div>
                    <div className="text-sm text-gray-600">Add and edit golf courses</div>
                  </div>
                  <div className="text-gray-400">›</div>
                </div>
              </button>
            </div>
          )}

          {/* MY LEAGUES */}
          {userLeagues.length > 0 && (
            <div className="mb-6">
              <h2 className="text-white text-lg font-semibold mb-3">MY LEAGUES</h2>
              <div className="space-y-3">
                {userLeagues.map(league => (
                  <button
                    key={league.id}
                    onClick={() => {
                      setCurrentLeague(league);
                      setView('league-dashboard');
                    }}
                    className="w-full bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          {league.meta.name}
                          {league.userRole === 'commissioner' && (
                            <span className="text-yellow-500">⭐</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {league.userRole === 'commissioner' ? 'Commissioner' : 'Player'} · {Object.keys(league.seasons || {}).length} season{Object.keys(league.seasons || {}).length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="text-gray-400">›</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CREATE / JOIN LEAGUE */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setView('create-league')}
                className="bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🏆</div>
                  <div className="font-bold text-gray-900">Create League</div>
                </div>
              </button>
              <button
                onClick={() => setView('join-league')}
                className="bg-white/95 backdrop-blur-sm p-5 rounded-2xl shadow-xl hover:bg-white transition-all"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🤝</div>
                  <div className="font-bold text-gray-900">Join League</div>
                </div>
              </button>
            </div>
          </div>

          {/* QUICK PLAY */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <h3 className="text-white text-sm font-semibold mb-3 uppercase tracking-wider">Quick Play</h3>
            <p className="text-white/70 text-sm mb-4">For one-off events without a league</p>
            
            <div className="space-y-3">
              <button
                onClick={() => setView('create-event')}
                className="w-full bg-white/20 hover:bg-white/30 p-4 rounded-xl transition-all text-white text-left"
              >
                <div className="font-semibold">Create Event</div>
                <div className="text-sm text-white/80">Host a standalone golf event</div>
              </button>

              <div className="bg-white/20 p-4 rounded-xl">
                <div className="font-semibold text-white mb-3">Join Event</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && joinEvent()}
                    placeholder="WOLF-A3X9"
                    className="flex-1 px-4 py-2 rounded-lg border-2 border-white/30 bg-white/10 text-white placeholder-white/50 focus:border-white/50 focus:outline-none uppercase"
                  />
                  <button
                    onClick={joinEvent}
                    className="bg-white text-blue-900 px-5 py-2 rounded-lg hover:bg-white/90 font-semibold"
                  >
                    Join
                  </button>
                </div>
                {feedback && <div className="mt-2 text-sm text-white/90">{feedback}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
// ==================== CREATE LEAGUE VIEW ====================
  
  if (view === 'create-league') {
    const handleCreateLeague = async (e) => {
      e.preventDefault();
      setFeedback('');

      if (!newLeague.name) {
        setFeedback('Please enter a league name');
        return;
      }

      if (!userProfile) {
        setFeedback('User profile not loaded. Please try again.');
        return;
      }

      try {
        const leagueId = 'league-' + Date.now();
        const code = await generateLeagueCode();

        const leagueData = {
          meta: {
            name: newLeague.name,
            code: code,
            commissionerId: currentUser.uid,
            description: newLeague.description,
            createdAt: Date.now()
          },
          members: {
            [currentUser.uid]: {
              displayName: userProfile.displayName,
              role: 'commissioner',
              handicap: userProfile.handicap || null,
              joinedAt: Date.now()
            }
          },
          seasons: {
            'season-2026': {
              name: newLeague.seasonName,
              status: 'active',
              pointSystem: newLeague.pointSystem,
              events: [],
              standings: {}
            }
          }
        };

        await set(ref(database, `leagues/${leagueId}`), leagueData);
        await set(ref(database, `leagueCodes/${code}`), leagueId);
        await set(ref(database, `users/${currentUser.uid}/leagues/${leagueId}`), {
          role: 'commissioner',
          joinedAt: Date.now()
        });

        const leagues = await loadUserLeagues(currentUser.uid);
        setUserLeagues(leagues);
        setCurrentLeague({ id: leagueId, ...leagueData, userRole: 'commissioner' });
        
        setFeedback(`League created! Code: ${code}`);
        setTimeout(() => {
          setView('league-dashboard');
          setFeedback('');
        }, 1500);

      } catch (error) {
        console.error('Error creating league:', error);
        setFeedback('Error creating league. Please try again.');
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">← Back</button>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Create League</h2>

            {feedback && (
              <div className={`border-2 p-3 rounded-lg mb-4 text-sm ${
                feedback.includes('Error') || feedback.includes('required')
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}>
                {feedback}
              </div>
            )}

            <form onSubmit={handleCreateLeague} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">League Name</label>
                <input
                  type="text"
                  value={newLeague.name}
                  onChange={(e) => setNewLeague({ ...newLeague, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  placeholder="Sunday Golf League"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  value={newLeague.description}
                  onChange={(e) => setNewLeague({ ...newLeague, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  placeholder="Weekly competitive league for golfers of all levels"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Season Name</label>
                <input
                  type="text"
                  value={newLeague.seasonName}
                  onChange={(e) => setNewLeague({ ...newLeague, seasonName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                  placeholder="2026 Season"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Point System</label>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <div className="grid grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map(place => (
                      <div key={place}>
                        <label className="block text-xs text-gray-600 mb-1">{place}{place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'}</label>
                        <input
                          type="number"
                          value={newLeague.pointSystem[place]}
                          onChange={(e) => setNewLeague({
                            ...newLeague,
                            pointSystem: { ...newLeague.pointSystem, [place]: parseInt(e.target.value) || 0 }
                          })}
                          className="w-full px-2 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 text-lg"
              >
                Create League
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==================== JOIN LEAGUE VIEW ====================
  
  if (view === 'join-league') {
      const handleJoinLeague = async (e) => {
      e.preventDefault();
      setFeedback('');

      if (!leagueCode) {
        setFeedback('Please enter a league code');
        return;
      }

      if (!userProfile) {
        setFeedback('User profile not loaded. Please try logging out and back in.');
        return;
      }

      try {
        const codeSnapshot = await get(ref(database, `leagueCodes/${leagueCode}`));
        const leagueId = codeSnapshot.val();

        if (!leagueId) {
          setFeedback('League not found. Check your code.');
          return;
        }

        const leagueSnapshot = await get(ref(database, `leagues/${leagueId}`));
        const leagueData = leagueSnapshot.val();

        if (!leagueData) {
          setFeedback('League not found. Check your code.');
          return;
        }

        if (leagueData.members && leagueData.members[currentUser.uid]) {
          setFeedback('You are already a member of this league');
          setTimeout(() => {
            const league = { id: leagueId, ...leagueData, userRole: leagueData.members[currentUser.uid].role };
            setCurrentLeague(league);
            setView('league-dashboard');
          }, 1500);
          return;
        }

        await set(ref(database, `leagues/${leagueId}/members/${currentUser.uid}`), {
          displayName: userProfile.displayName,
          role: 'player',
          handicap: userProfile.handicap || null,
          joinedAt: Date.now()
        });

        await set(ref(database, `users/${currentUser.uid}/leagues/${leagueId}`), {
          role: 'player',
          joinedAt: Date.now()
        });

        const leagues = await loadUserLeagues(currentUser.uid);
        setUserLeagues(leagues);
        const joinedLeague = leagues.find(l => l.id === leagueId);
        setCurrentLeague(joinedLeague);

        setFeedback('Successfully joined league!');
        setTimeout(() => {
          setView('league-dashboard');
          setFeedback('');
        }, 1500);

      } catch (error) {
        console.error('Error joining league:', error);
        setFeedback('Error joining league. Please try again.');
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">← Back</button>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Join League</h2>
            <p className="text-gray-600 mb-6">Enter the code from your league commissioner</p>

            {feedback && (
              <div className={`border-2 p-3 rounded-lg mb-4 text-sm ${
                feedback.includes('Error') || feedback.includes('not found')
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}>
                {feedback}
              </div>
            )}

            <form onSubmit={handleJoinLeague}>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">League Code</label>
                <input
                  type="text"
                  value={leagueCode}
                  onChange={(e) => setLeagueCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none uppercase text-center text-2xl font-mono tracking-widest"
                  placeholder="ABC-1234"
                  maxLength={8}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 text-lg"
              >
                Join League
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }
// ==================== LEAGUE DASHBOARD VIEW ====================
  
  if (view === 'league-dashboard' && currentLeague) {
    const isCommissioner = currentLeague.userRole === 'commissioner';
    const members = Object.entries(currentLeague.members || {}).map(([uid, data]) => ({
      uid,
      ...data
    }));
    const activeSeason = Object.values(currentLeague.seasons || {}).find(s => s.status === 'active');

    const handleRemoveMember = async (memberUid, memberName) => {
      if (!confirm(`Remove ${memberName} from the league?`)) {
        return;
      }

      try {
        await remove(ref(database, `leagues/${currentLeague.id}/members/${memberUid}`));
        await remove(ref(database, `users/${memberUid}/leagues/${currentLeague.id}`));

        const leagueSnapshot = await get(ref(database, `leagues/${currentLeague.id}`));
        const updatedLeague = leagueSnapshot.val();
        setCurrentLeague({ id: currentLeague.id, ...updatedLeague, userRole: currentLeague.userRole });

        setFeedback(`${memberName} removed from league`);
        setTimeout(() => setFeedback(''), 3000);
      } catch (error) {
        console.error('Error removing member:', error);
        setFeedback('Error removing member');
        setTimeout(() => setFeedback(''), 3000);
      }
    };

    const handleDeleteEvent = async (eventId, eventName) => {
      if (!confirm(`Delete "${eventName}"? This will remove all scores and registrations.`)) {
        return;
      }

      try {
        // Remove event from season
        const seasonId = Object.keys(currentLeague.seasons || {}).find(
          sid => currentLeague.seasons[sid].status === 'active'
        );
        
        if (seasonId) {
          const eventsArray = currentLeague.seasons[seasonId].events || [];
          const updatedEvents = eventsArray.filter(eid => eid !== eventId);
          await set(ref(database, `leagues/${currentLeague.id}/seasons/${seasonId}/events`), updatedEvents);
        }

        // Get event code and remove it
        const eventSnapshot = await get(ref(database, `events/${eventId}/meta/eventCode`));
        if (eventSnapshot.exists()) {
          await remove(ref(database, `eventCodes/${eventSnapshot.val()}`));
        }

        // Remove the event itself
        await remove(ref(database, `events/${eventId}`));

        // Reload league data
        const leagueSnapshot = await get(ref(database, `leagues/${currentLeague.id}`));
        const updatedLeague = leagueSnapshot.val();
        setCurrentLeague({ id: currentLeague.id, ...updatedLeague, userRole: currentLeague.userRole });

        setFeedback('Event deleted');
        setTimeout(() => setFeedback(''), 3000);
      } catch (error) {
        console.error('Error deleting event:', error);
        setFeedback('Error deleting event');
        setTimeout(() => setFeedback(''), 3000);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('home')} className="text-white mb-6 hover:text-blue-200">← Back to Home</button>

          {/* Header */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentLeague.meta.name}</h1>
            {currentLeague.meta.description && (
              <p className="text-gray-600 mb-4">{currentLeague.meta.description}</p>
            )}
            
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 px-4 py-2 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">League Code</div>
                <div className="font-mono font-bold text-blue-600 text-lg">{currentLeague.meta.code}</div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentLeague.meta.code);
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

          {/* Members */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Members ({members.length})</h2>
            <div className="space-y-3">
              {members.map(member => (
                <div key={member.uid} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {member.displayName}
                      {member.role === 'commissioner' && <span className="text-yellow-500">⭐</span>}
                    </div>
                    {member.handicap !== null && member.handicap !== undefined && (
                      <div className="text-sm text-gray-600">Handicap: {member.handicap}</div>
                    )}
                  </div>
                  {isCommissioner && member.uid !== currentUser.uid && (
                    <button
                      onClick={() => handleRemoveMember(member.uid, member.displayName)}
                      className="text-red-600 hover:text-red-700 text-sm font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Events */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Events</h2>
              {isCommissioner && (
                <button
                  onClick={() => {
                    setCreatingEventForLeague({
                      leagueId: currentLeague.id,
                      seasonId: Object.keys(currentLeague.seasons || {}).find(
                        sid => currentLeague.seasons[sid].status === 'active'
                      )
                    });
                    setView('create-event');
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold flex items-center gap-2"
                >
                  <PlusIcon />
                  Create Event
                </button>
              )}
            </div>

            {leagueEvents.length > 0 ? (
              <div className="space-y-3">
                                {leagueEvents.map((event) => {
                  // Format display helper
                  const formatNames = {
                    scramble: "2-Man Scramble",
                    shamble: "2-Man Shamble",
                    bestball: "2-Man Best Ball",
                    stableford: "Individual Stableford"
                  };
                  
                  return (
                    <div key={event.id} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{event.meta.name}</div>
                          <div className="text-sm text-gray-600">
                            {event.meta.courseName} · {formatNames[event.meta.format] || event.meta.format}
                          </div>
                          <div className="text-sm text-gray-600">
                            {new Date(event.meta.date).toLocaleDateString()}
                            {event.meta.time && ` · ${event.meta.time}`}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Status: {event.meta.status === 'draft' ? '📝 Draft' : event.meta.status === 'locked' ? '🔒 Locked' : '✅ Active'}
                            {event.meta.status === 'draft' && ' · Registration Open'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {event.meta.status === 'draft' && (
                            <button
                              onClick={() => {
                                setEditingEvent(event);
                                setView('event-details');
                              }}
                              className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                            >
                              View
                            </button>
                          )}
                          {isCommissioner && (
                            <button
                              onClick={() => handleDeleteEvent(event.id, event.meta.name)}
                              className="text-red-600 hover:text-red-700 text-sm font-semibold"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarIcon className="mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600 mb-4">No events yet</p>
                {isCommissioner && (
                  <button
                    onClick={() => {
                      setCreatingEventForLeague({
                        leagueId: currentLeague.id,
                        seasonId: Object.keys(currentLeague.seasons || {}).find(
                          sid => currentLeague.seasons[sid].status === 'active'
                        )
                      });
                      setView('create-event');
                    }}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold"
                  >
                    Create First Event
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Standings */}
          {activeSeason && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {activeSeason.name || 'Season'} Standings
              </h2>
              
              {activeSeason.standings && Object.keys(activeSeason.standings).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(activeSeason.standings)
                    .sort(([, a], [, b]) => (b.points || 0) - (a.points || 0))
                    .map(([uid, data], index) => {
                      const member = members.find(m => m.uid === uid);
                      return (
                        <div key={uid} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="text-lg font-bold text-gray-400 w-8">#{index + 1}</div>
                            <div className="font-semibold text-gray-900">{member?.displayName || 'Unknown'}</div>
                          </div>
                          <div className="text-lg font-bold text-blue-600">{data.points || 0} pts</div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrophyIcon className="mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-600">No standings yet</p>
                  <p className="text-sm text-gray-500 mt-2">Standings will appear after events are completed</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  // ==================== CREATE EVENT VIEW ====================
  
  if (view === 'create-event') {
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

        // Add teams only for non-league events
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

        // Add event to league season if creating for league
        if (creatingEventForLeague) {
          const seasonEventsRef = ref(database, `leagues/${creatingEventForLeague.leagueId}/seasons/${creatingEventForLeague.seasonId}/events`);
          const eventsSnapshot = await get(seasonEventsRef);
          const events = eventsSnapshot.val() || [];
          events.push(eventId);
          await set(seasonEventsRef, events);
        }

        setFeedback(`Event created! Code: ${eventCode}`);
        
        setTimeout(async () => {
          // Reset form
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
            // Reload the league to get the updated events list
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

    // Format helpers
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
                    setNewEvent({ ...newEvent, courseId: '' }); // Reset tee selection
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
  // ==================== EVENT LOBBY VIEW ====================
  
  if (view === 'event-lobby' && currentEvent) {
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

  // ==================== EVENT DETAILS VIEW (for league events) ====================
  
  if (view === 'event-details' && editingEvent) {
    const registrations = Object.entries(eventRegistrations || {}).map(([uid, data]) => ({
      uid,
      ...data
    }));

    const handleRegister = async () => {
      if (!userProfile) {
        setFeedback('User profile not loaded');
        return;
      }

      try {
        await set(ref(database, `events/${editingEvent.id}/registrations/${currentUser.uid}`), {
          displayName: userProfile.displayName,
          handicap: userProfile.handicap || null,
          registeredAt: Date.now()
        });

        setFeedback('Successfully registered!');
        setTimeout(() => setFeedback(''), 2000);
      } catch (error) {
        console.error('Error registering:', error);
        setFeedback('Error registering. Please try again.');
        setTimeout(() => setFeedback(''), 3000);
      }
    };

    const handleWithdraw = async () => {
      if (!confirm('Withdraw from this event?')) {
        return;
      }

      try {
        await remove(ref(database, `events/${editingEvent.id}/registrations/${currentUser.uid}`));
        setFeedback('Withdrawn from event');
        setTimeout(() => setFeedback(''), 2000);
      } catch (error) {
        console.error('Error withdrawing:', error);
        setFeedback('Error withdrawing. Please try again.');
        setTimeout(() => setFeedback(''), 3000);
      }
    };

    const isRegistered = eventRegistrations && eventRegistrations[currentUser.uid];
    const isCommissioner = currentLeague && currentLeague.userRole === 'commissioner';

    const formatNames = {
      scramble: "2-Man Scramble",
      shamble: "2-Man Shamble",
      bestball: "2-Man Best Ball",
      stableford: "Individual Stableford"
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={() => {
              setEditingEvent(null);
              setView('league-dashboard');
            }} 
            className="text-white mb-6 hover:text-blue-200"
          >
            ← Back to League
          </button>

          {/* Event Header */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{editingEvent.meta.name}</h1>
                <div className="space-y-1 text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Course:</span>
                    {editingEvent.meta.courseName}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Format:</span>
                    {formatNames[editingEvent.meta.format]}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Date:</span>
                    {new Date(editingEvent.meta.date).toLocaleDateString()}
                    {editingEvent.meta.time && ` at ${editingEvent.meta.time}`}
                  </div>
                </div>
              </div>
              
              {isCommissioner && (
                <button
                  onClick={() => {
                    setView('edit-event');
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-semibold flex items-center gap-2"
                >
                  <EditIcon />
                  Edit
                </button>
              )}
            </div>

            {feedback && (
              <div className={`border-2 p-3 rounded-lg mb-4 text-sm ${
                feedback.includes('Error')
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}>
                {feedback}
              </div>
            )}

            {editingEvent.meta.status === 'draft' && (
              <div className="mt-4">
                {isRegistered ? (
                  <button
                    onClick={handleWithdraw}
                    className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700"
                  >
                    Withdraw from Event
                  </button>
                ) : (
                  <button
                    onClick={handleRegister}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
                  >
                    Register for Event
                  </button>
                )}
              </div>
            )}

            {editingEvent.meta.status === 'locked' && (
              <div className="mt-4 bg-yellow-50 border-2 border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm">
                🔒 This event is locked. Registration is closed.
              </div>
            )}
          </div>

          {/* Registrations */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Registered Players ({registrations.length})
            </h2>
            
            {registrations.length > 0 ? (
              <div className="space-y-2">
                {registrations.map(reg => (
                  <div key={reg.uid} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-semibold text-gray-900">{reg.displayName}</div>
                      {reg.handicap !== null && reg.handicap !== undefined && (
                        <div className="text-sm text-gray-600">Handicap: {reg.handicap}</div>
                      )}
                    </div>
                    {reg.uid === currentUser.uid && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">
                        You
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <UsersIcon className="mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600">No registrations yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
return null;
}

export default App;
  