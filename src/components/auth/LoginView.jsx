import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase.js';

export default function LoginView({
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  authError,
  setAuthError,
  authLoading2,
  setAuthLoading2,
  setView
}) {
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
