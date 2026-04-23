'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, checkAdminAccess } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const adminCheck = await checkAdminAccess(session.user.id);
      if (adminCheck.isAdmin) {
        router.push('/dashboard');
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (data.user) {
        const adminCheck = await checkAdminAccess(data.user.id);

        if (!adminCheck.isAdmin) {
          await supabase.auth.signOut();
          if (adminCheck.reason === 'profile_not_found') {
            setError(`Access denied: no profile found for this account (user id: ${data.user.id}).`);
          } else if (adminCheck.reason === 'db_error') {
            setError(`Access check failed: ${adminCheck.details ?? 'database error while reading profile role.'}`);
          } else {
            setError(`Access denied. Current role: ${adminCheck.role ?? 'unknown'}. Admin privileges required.`);
          }
          setLoading(false);
          return;
        }

        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>GBE Go Admin</h1>
        <p style={styles.subtitle}>Sign in to access the admin dashboard</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={styles.submitBtn}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  card: {
    background: 'white',
    borderRadius: 12,
    padding: 48,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    width: '100%',
    maxWidth: 450,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  submitBtn: {
    width: '100%',
    marginTop: 8,
  },
};
