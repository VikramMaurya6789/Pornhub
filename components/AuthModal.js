'use client';
import { useEffect, useState } from 'react';
import { IconX, IconCheck, IconSpinner, IconUser, IconLock, IconEye, IconEyeOff } from './Icons';
import { OPEN_AUTH_EVENT, setCachedUser } from '../lib/auth-client';
import { getUserId } from '../lib/uid';

const MailSvg = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={p.size || 16} height={p.size || 16} className={p.className}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

function Field({ label, icon, error, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">{label}</span>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">{icon}</span>
        {children}
      </div>
      {error && <span className="block text-xs text-red-400 mt-1.5 font-medium">{error}</span>}
    </label>
  );
}

const inputCls =
  'w-full bg-[#0e0e0e] border border-[#2c2c2c] focus:border-[#ff9900] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition-colors min-h-[48px]';

export default function AuthModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('signin'); // 'signin' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onOpen = (e) => {
      setMode(e?.detail?.mode === 'register' ? 'register' : 'signin');
      setErrors({});
      setFormError('');
      setDone(false);
      setShowPw(false);
      setOpen(true);
    };
    window.addEventListener(OPEN_AUTH_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_AUTH_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  if (!open) return null;

  const switchMode = (m) => {
    setMode(m);
    setErrors({});
    setFormError('');
    setDone(false);
  };

  const validate = () => {
    const e = {};
    if (mode === 'register' && name.trim() && name.trim().length > 40) e.name = 'Keep it under 40 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = 'Enter a valid email address.';
    if (!password || password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (mode === 'register' && password !== confirm) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setFormError('');
    if (!validate() || loading) return;
    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'register'
          ? { name: name.trim(), email: email.trim(), password, guestUid: getUserId() || null }
          : { email: email.trim(), password, guestUid: getUserId() || null };
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.user) {
        setFormError(j.error || 'Something went wrong. Try again.');
        return;
      }
      setCachedUser(j.user);
      setDone(true);
      setTimeout(() => setOpen(false), 900);
    } catch {
      setFormError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm fade-in"
      onClick={() => !loading && setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'register' ? 'Create account' : 'Sign in'}
    >
      <div
        className="w-full max-w-sm bg-[#141414] border border-[#2a2a2a] rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button
            type="button"
            onClick={() => !loading && setOpen(false)}
            aria-label="Close"
            className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-xl text-neutral-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <IconX size={18} />
          </button>
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#ff9900] flex items-center justify-center shadow-lg shadow-[#ff9900]/30 mb-3">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-black">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-white">
            {done ? 'Welcome!' : mode === 'register' ? 'Create account' : 'Welcome back'}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {done
              ? 'You are signed in.'
              : mode === 'register'
                ? 'Save favorites, history and playlists to your account.'
                : 'Sign in to sync your library.'}
          </p>
        </div>

        {done ? (
          <div className="px-6 pb-8 pt-2 flex flex-col items-center gap-3">
            <span className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center">
              <IconCheck size={26} className="text-green-400 stroke-[3]" />
            </span>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="px-6">
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#0e0e0e] rounded-2xl border border-[#222]">
                {[
                  { id: 'signin', label: 'Sign In' },
                  { id: 'register', label: 'Register' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => switchMode(t.id)}
                    className={`min-h-[44px] rounded-xl text-sm font-bold transition-all cursor-pointer ${
                      mode === t.id ? 'bg-[#ff9900] text-black shadow' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={submit} className="px-6 py-5 space-y-4" noValidate>
              {mode === 'register' && (
                <Field label="Name (optional)" icon={<IconUser size={16} />} error={errors.name}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What should we call you?"
                    autoComplete="name"
                    className={inputCls}
                  />
                </Field>
              )}

              <Field label="Email" icon={<MailSvg size={16} />} error={errors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  className={inputCls}
                />
              </Field>

              <Field label="Password" icon={<IconLock size={16} />} error={errors.password}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className={`${inputCls} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white transition-colors cursor-pointer"
                >
                  {showPw ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                </button>
              </Field>

              {mode === 'register' && (
                <Field label="Confirm password" icon={<IconLock size={16} />} error={errors.confirm}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    className={inputCls}
                  />
                </Field>
              )}

              {formError && (
                <p className="text-xs font-semibold text-red-300 bg-red-950/50 border border-red-900/60 rounded-xl px-3.5 py-2.5">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[52px] rounded-2xl bg-[#ff9900] hover:bg-[#ffa826] disabled:opacity-60 text-black font-black text-sm shadow-lg shadow-[#ff9900]/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <IconSpinner size={18} />
                    {mode === 'register' ? 'Creating account...' : 'Signing in...'}
                  </>
                ) : mode === 'register' ? (
                  'Create Account'
                ) : (
                  'Sign In'
                )}
              </button>

              <p className="text-center text-xs text-neutral-500">
                {mode === 'register' ? (
                  <>
                    Already have an account?{' '}
                    <button type="button" onClick={() => switchMode('signin')} className="text-[#ff9900] font-bold hover:underline cursor-pointer">
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    New here?{' '}
                    <button type="button" onClick={() => switchMode('register')} className="text-[#ff9900] font-bold hover:underline cursor-pointer">
                      Create an account
                    </button>
                  </>
                )}
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
