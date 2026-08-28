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
            {/* Quick Fill Demo Credentials */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center mb-2.5">
                Quick Demo Login (1-Click Fill)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('lmo.delhi@gov.in');
                    setPassword('Officer@2026');
                  }}
                  className="px-2.5 py-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold rounded-lg border border-indigo-200 text-left transition-colors"
                >
                  👮 <strong>LMO Officer</strong>
                  <span className="block text-[10px] text-indigo-600 font-normal font-mono">Officer@2026</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('trader@example.com');
                    setPassword('Trader@2026');
                  }}
                  className="px-2.5 py-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg border border-emerald-200 text-left transition-colors"
                >
                  🏪 <strong>Trader</strong>
                  <span className="block text-[10px] text-emerald-600 font-normal font-mono">Trader@2026</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('supervisor.delhi@gov.in');
                    setPassword('Supervisor@2026');
                  }}
                  className="px-2.5 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-lg border border-amber-200 text-left transition-colors"
                >
                  🛡️ <strong>Supervisor</strong>
                  <span className="block text-[10px] text-amber-600 font-normal font-mono">Supervisor@2026</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin.delhi@gov.in');
                    setPassword('Admin@2026');
                  }}
                  className="px-2.5 py-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold rounded-lg border border-purple-200 text-left transition-colors"
                >
                  ⚙️ <strong>Admin</strong>
                  <span className="block text-[10px] text-purple-600 font-normal font-mono">Admin@2026</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('gatc.delhi@gov.in');
                    setPassword('GATC@2026');
                  }}
                  className="px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold rounded-lg border border-blue-200 text-left transition-colors"
                >
                  🔬 <strong>GATC Lab</strong>
                  <span className="block text-[10px] text-blue-600 font-normal font-mono">GATC@2026</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('applicant.delhi@example.com');
                    setPassword('Applicant@2026');
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold rounded-lg border border-slate-200 text-left transition-colors"
                >
                  📝 <strong>Applicant</strong>
                  <span className="block text-[10px] text-slate-600 font-normal font-mono">Applicant@2026</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};