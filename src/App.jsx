import { useState, useEffect } from 'react';
import { database, auth } from './firebase';
import { ref, onValue, set, get, update, remove, push } from 'firebase/database';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { getDeviceId, formatNames, formatDescriptions } from './utils/helpers';
import { calculateStablefordPoints, calculateTeamStats } from './utils/scoring';

function App() {
  const [view, setView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading2, setAuthLoading2] = useState(false);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && (view === 'login' || view === 'signup')) {
        setView('home');
      }
      if (!user) {
        setView('login');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Loading screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // Login view
  if (view === 'login') {
    const handleLogin = async (e) => {
      e.preventDefault();
      setAuthError('');
      setAuthLoading2(true);
      try {
        await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          setAuthError('No account found with this email');
        } else if (err.code === 'auth/wrong-password') {
          setAuthError('Incorrect password');
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
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {authLoading2 ? 'Logging in...' : 'Login'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button
                onClick={() => { setAuthError(''); setView('signup'); }}
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

  // Temporary home view - just to prove login works
  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 p-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Welcome!</h1>
          <p className="text-white mb-4">You're logged in as {currentUser?.email}</p>
          <button
            onClick={() => signOut(auth)}
            className="bg-white text-blue-900 px-6 py-3 rounded-xl font-semibold"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default App;