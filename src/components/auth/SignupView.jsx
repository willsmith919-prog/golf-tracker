import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, database } from '../../firebase';

export default function SignupView({
  signupEmail,
  setSignupEmail,
  signupPassword,
  setSignupPassword,
  signupDisplayName,
  setSignupDisplayName,
  signupHandicap,
  setSignupHandicap,
  authError,
  setAuthError,
  authLoading2,
  setAuthLoading2,
  setView
}) {
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
