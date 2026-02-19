import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const errorParam = params.get('error');
      const errorDescription = params.get('error_description');

      // OAuth error returned from provider
      if (errorParam) {
        setError(errorDescription || errorParam);
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      // PKCE flow — exchange ?code= for a session
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          setTimeout(() => navigate('/login'), 3000);
          return;
        }
        navigate('/dashboard', { replace: true });
        return;
      }

      // Implicit flow — #access_token in hash; Supabase client picks it up automatically
      if (window.location.hash.includes('access_token')) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          setError(sessionError?.message || 'Authentication failed');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }
        navigate('/dashboard', { replace: true });
        return;
      }

      // No auth params — shouldn't land here normally
      navigate('/login', { replace: true });
    };

    handleCallback();
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #070d1a 0%, #0d1a2e 50%, #0a1525 100%)',
        gap: '16px',
      }}
    >
      {error ? (
        <>
          <p style={{ color: '#ff6b6b', fontSize: '15px', margin: 0 }}>{error}</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
            Redirecting to login…
          </p>
        </>
      ) : (
        <>
          <Loader2 size={32} style={{ color: '#17c5c8', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: 0 }}>
            Completing sign in…
          </p>
        </>
      )}
    </div>
  );
}
