import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';


// ── Login page ────────────────────────────────────────────────────
export function Login() {
  const { session, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    if (session) navigate('/dashboard');
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

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '13px 14px 13px 42px',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: '#ffffff',
    transition: 'border-color 200ms ease, box-shadow 200ms ease',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #070d1a 0%, #0d1a2e 50%, #0a1525 100%)',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow accents */}
      <div style={{
        position: 'absolute', top: '-80px', left: '50%', transform: 'translateX(-50%)',
        width: '500px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(23,197,200,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-60px', right: '-60px',
        width: '300px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(220,53,69,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo + Title */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
        <img
          src="/logo.svg"
          alt="CollabBoard logo"
          style={{ width: 120, height: 'auto', filter: 'drop-shadow(0 0 16px rgba(23,197,200,0.45))' }}
        />
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: "'Arial Black', 'Impact', sans-serif",
              fontWeight: 900,
              fontSize: '28px',
              letterSpacing: '0.12em',
              color: '#ffffff',
              textTransform: 'uppercase',
              textShadow: '0 0 20px rgba(23,197,200,0.4)',
              margin: 0,
            }}
          >
            COLLABBOARD
          </h1>
          <div style={{
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #17c5c8, transparent)',
            marginTop: '8px',
            borderRadius: '1px',
          }} />
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'rgba(13, 26, 46, 0.85)',
          border: '1px solid rgba(23,197,200,0.2)',
          borderRadius: '16px',
          padding: '28px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(23,197,200,0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Subtitle */}
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textAlign: 'center', margin: '0 0 20px 0' }}>
          {isSignUp ? 'Create your account' : 'Sign in to your workspace'}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Email */}
          <div style={{ position: 'relative' }}>
            <Mail
              size={15}
              style={{
                position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                color: emailFocused ? '#17c5c8' : 'rgba(255,255,255,0.3)',
                pointerEvents: 'none', transition: 'color 200ms ease',
              }}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              required
              style={{
                ...inputBase,
                border: `1px solid ${emailFocused ? '#17c5c8' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: emailFocused ? '0 0 0 3px rgba(23,197,200,0.15)' : 'none',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ position: 'relative' }}>
            <Lock
              size={15}
              style={{
                position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                color: passwordFocused ? '#17c5c8' : 'rgba(255,255,255,0.3)',
                pointerEvents: 'none', transition: 'color 200ms ease',
              }}
            />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              required
              style={{
                ...inputBase,
                paddingRight: '44px',
                border: `1px solid ${passwordFocused ? '#17c5c8' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: passwordFocused ? '0 0 0 3px rgba(23,197,200,0.15)' : 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)', padding: '2px',
              }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Feedback */}
          {error && (
            <p style={{
              fontSize: '12px', color: '#ff6b6b',
              backgroundColor: 'rgba(220,53,69,0.12)',
              border: '1px solid rgba(220,53,69,0.25)',
              borderRadius: '6px', padding: '8px 12px', margin: 0,
            }}>
              {error}
            </p>
          )}
          {message && (
            <p style={{
              fontSize: '12px', color: '#5ee8e8',
              backgroundColor: 'rgba(23,197,200,0.1)',
              border: '1px solid rgba(23,197,200,0.25)',
              borderRadius: '6px', padding: '8px 12px', margin: 0,
            }}>
              {message}
            </p>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            {/* Sign in / Create account */}
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '13px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                background: loading
                  ? 'rgba(23,197,200,0.4)'
                  : 'linear-gradient(135deg, #17c5c8 0%, #0fa3b1 100%)',
                color: '#000',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(23,197,200,0.35)',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 22px rgba(23,197,200,0.55)';
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(23,197,200,0.35)';
              }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Please wait…' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>

            {/* Toggle: other mode */}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }}
              style={{
                flex: 1,
                padding: '13px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255,255,255,0.18)',
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.backgroundColor = 'rgba(255,255,255,0.07)';
                b.style.borderColor = 'rgba(255,255,255,0.35)';
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.backgroundColor = 'transparent';
                b.style.borderColor = 'rgba(255,255,255,0.18)';
              }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>or</span>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#ffffff',
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            cursor: googleLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: googleLoading ? 0.6 : 1,
            transition: 'background-color 200ms ease',
          }}
          onMouseEnter={(e) => {
            if (!googleLoading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.11)';
          }}
          onMouseLeave={(e) => {
            if (!googleLoading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
          }}
        >
          {googleLoading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            // Google G icon
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continue with Google
        </button>

        {/* Forgot password */}
        <p style={{ textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>
          <button
            type="button"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.3)', fontSize: '12px',
              transition: 'color 200ms ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#17c5c8'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)'; }}
          >
            Forgot password?
          </button>
        </p>
      </div>
    </div>
  );
}
