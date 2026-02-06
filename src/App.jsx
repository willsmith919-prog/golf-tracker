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

return null;
}

export default App;
  