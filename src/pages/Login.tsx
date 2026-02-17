import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

export function Login() {
  const { session, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    if (session) navigate('/board');
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
        setMessage('Account created! Check your email to confirm.');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signInWithGoogle();
    setGoogleLoading(false);
  };

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    backgroundColor: '#ffffff',
    border: `1px solid ${focused ? '#17a2b8' : '#e0e0e0'}`,
    boxShadow: focused ? '0 0 0 3px rgba(23,162,184,0.1)' : 'none',
    color: '#1a1a1a',
    transition: 'border-color 200ms ease, box-shadow 200ms ease',
  });

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ backgroundColor: '#f5f5f5' }}
    >
      {/* Card */}
      <div
        className="flex flex-col w-full p-8 rounded-xl gap-5"
        style={{
          maxWidth: 420,
          margin: '0 16px',
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        {/* Logo + heading */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg text-white"
            style={{ backgroundColor: '#17a2b8' }}
          >
            C
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: '#1a1a1a' }}>
              CollabBoard
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#666666' }}>
              {isSignUp ? 'Create your account' : 'Sign in to your workspace'}
            </p>
          </div>
        </div>

        {/* Google button */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: '#f5f5f5',
            border: '1px solid #e0e0e0',
            color: '#1a1a1a',
            cursor: googleLoading ? 'not-allowed' : 'pointer',
            opacity: googleLoading ? 0.6 : 1,
            transition: 'background-color 200ms ease',
          }}
          onMouseEnter={(e) => {
            if (!googleLoading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e8e8e8';
          }}
          onMouseLeave={(e) => {
            if (!googleLoading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f5f5f5';
          }}
        >
          {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div style={{ flex: 1, height: 1, backgroundColor: '#e0e0e0' }} />
          <span style={{ color: '#999999', fontSize: '0.75rem' }}>or</span>
          <div style={{ flex: 1, height: 1, backgroundColor: '#e0e0e0' }} />
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Email */}
          <div className="relative">
            <Mail size={15} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: emailFocused ? '#17a2b8' : '#999999', pointerEvents: 'none',
            }} />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              required
              className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle(emailFocused)}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock size={15} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: passwordFocused ? '#17a2b8' : '#999999', pointerEvents: 'none',
            }} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              required
              className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle(passwordFocused)}
            />
          </div>

          {/* Feedback */}
          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ color: '#dc3545', backgroundColor: 'rgba(220,53,69,0.08)', border: '1px solid rgba(220,53,69,0.2)' }}>
              {error}
            </p>
          )}
          {message && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ color: '#28a745', backgroundColor: 'rgba(40,167,69,0.08)', border: '1px solid rgba(40,167,69,0.2)' }}>
              {message}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold mt-1"
            style={{
              backgroundColor: '#17a2b8',
              color: '#ffffff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background-color 200ms ease',
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#138496';
            }}
            onMouseLeave={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#17a2b8';
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {/* Toggle sign up / sign in */}
        <p className="text-center text-xs" style={{ color: '#666666' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }}
            style={{ color: '#17a2b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#138496'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#17a2b8'; }}
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
