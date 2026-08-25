import React, { useState } from 'react';
import { Scale, Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loginError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-gov-navy text-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3">
            <Scale className="h-8 w-8 text-amber-400" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t.brandTitle}</h1>
              <p className="text-xs text-slate-300">{t.brandSubtitle}</p>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gov-border p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gov-navy mb-4">
                <Shield className="h-7 w-7 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-gov-navy">{t.loginTitle}</h2>
              <p className="text-xs text-slate-500 mt-1">{t.loginSubtitle}</p>
            </div>
            <p className="text-xs text-slate-400 mb-4 text-center">{t.loginRequired}</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium text-slate-600 mb-1">{t.loginEmailLabel}</label>
                <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-gov-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gov-blue" placeholder="your@email.com" autoComplete="email" autoFocus />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-xs font-medium text-slate-600 mb-1">{t.loginPasswordLabel}</label>
                <div className="relative">
                  <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-gov-border px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-gov-blue" placeholder="********" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1} aria-label={showPassword ? 'Hide' : 'Show'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2"><Lock className="h-4 w-4 shrink-0" />{error}</div>}
              <button type="submit" disabled={submitting} className="w-full rounded-xl bg-gov-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{submitting ? 'Signing in...' : t.loginButton}</button>
            </form>
            <div className="mt-5 pt-4 border-t border-gov-border">
              <p className="text-[11px] text-slate-400 text-center">{t.loginDemoCredentials}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};