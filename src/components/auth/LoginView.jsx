import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) { setResetMessage('Please enter your email address.'); return; }
    setResetLoading(true);
    setResetMessage('');
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetMessage('Check your email for a reset link.');
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setResetMessage('No account found with that email.');
      } else if (err.code === 'auth/invalid-email') {
        setResetMessage('Invalid email address.');
      } else {
        setResetMessage('Something went wrong. Try again.');
      }
    }
    setResetLoading(false);
  };

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
    <div className="min-h-screen bg-[#00285e] p-6 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img src="/icon-192x192.png" alt="LiveLinks" className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-5xl font-bold text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>LiveLinks</h1>
          <p className="text-[#c8d6e5]">Golf League Management</p>
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
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
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
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00285e] focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading2}
              className="w-full bg-[#00285e] text-white py-3 rounded-xl font-semibold hover:bg-[#003a7d] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading2 ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setShowForgotPassword(!showForgotPassword); setResetMessage(''); setResetEmail(loginEmail); }}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Forgot password?
            </button>
          </div>

          {showForgotPassword && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-3">Reset your password</p>
              {resetMessage ? (
                <>
                <p className="text-sm text-green-700">{resetMessage}</p>
                <p className="text-xs text-gray-500 mt-1">Don't see it? Check your spam or junk folder.</p>
              </>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-3">
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-[#00285e] focus:outline-none text-sm"
                  />
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-[#00285e] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#003a7d] disabled:opacity-50"
                  >
                    {resetLoading ? 'Sending...' : 'Send Reset Email'}
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setAuthError('');
                setView('signup');
              }}
              className="text-[#00285e] hover:text-[#003a7d] font-semibold text-sm"
            >
              Don't have an account? Sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
