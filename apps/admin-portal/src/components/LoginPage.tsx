import React, { useState } from 'react';
import { Shield, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) { setError('Email and password are required'); return; }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-gov-navy text-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <h1 className="text-xl font-bold">Administration Control Plane</h1>
          <p className="text-xs text-slate-300">National Legal Metrology Verification &amp; Digital Certification Platform</p>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="rounded-md border border-gov-border bg-white p-8 shadow-card">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex w-12 h-12 items-center justify-center rounded-md bg-gov-navy">
                <Shield className="h-6 w-6 text-amber-400" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-gov-navy">Admin Sign In</h2>
              <p className="mt-1 text-xs text-slate-500">Restricted to authorised system administrators</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
                <input id="admin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-md border border-gov-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue" placeholder="admin.delhi@gov.in" autoComplete="email" autoFocus />
              </div>
              <div>
                <label htmlFor="admin-password" className="mb-1 block text-sm font-semibold text-slate-700">Password</label>
                <input id="admin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-md border border-gov-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue" placeholder="••••••••" autoComplete="current-password" />
              </div>
              {error && <div role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"><Lock className="h-4 w-4 shrink-0" aria-hidden="true" />{error}</div>}
              <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Signing in…' : 'Sign In'}</button>
            </form>
            <div className="mt-4 border-t border-gov-border pt-4 text-center text-xs text-slate-500">
              Demo credentials: admin.delhi@gov.in / Admin@2026
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};