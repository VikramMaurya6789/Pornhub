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

const GoogleSvg = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.3 7.5 24 12 24z" />
    <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.5 0 10.2 0 12s.5 3.5 1.4 5.1l3.8-2.7z" />
    <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.9l3.8 2.9c1-2.9 3.7-5.1 6.8-5.1z" />
  </svg>
);

const PhoneSvg = ({ size = 16, className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
    <rect width="14" height="20" x="7" y="2" rx="2" ry="2" />
    <path d="M12 18h.01" />
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

function mapFirebaseError(e) {
  const code = e?.code || '';
  if (code.includes('invalid-phone-number')) return 'Enter a valid mobile number.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Try again later.';
  if (code.includes('quota-exceeded')) return 'SMS limit reached. Try again later.';
  if (code.includes('user-disabled')) return 'This number is blocked.';
  return 'Could not send OTP. Check the number and try again.';
}

// ---------- Phone (OTP) sign-in via Firebase ----------
function PhoneAuth({ onSuccess }) {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const digits10 = () => phone.replace(/\D/g, '').slice(-10);

  const sendOtp = async (isResend = false) => {
    const d = digits10();
    if (d.length !== 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
      const { app } = await import('../lib/firebase');
      const auth = getAuth(app);
      if (!window.__oh_recaptcha) {
        window.__oh_recaptcha = new RecaptchaVerifier(auth, 'oh-recaptcha', { size: 'invisible' });
      }
      const cr = await signInWithPhoneNumber(auth, '+91' + d, window.__oh_recaptcha);
      setConfirmResult(cr);
      setStep('otp');
      setOtp('');
      if (isResend) setResendIn(30);
      else setResendIn(30);
    } catch (e) {
      setError(mapFirebaseError(e));
      try {
        window.__oh_recaptcha?.clear();
      } catch {}
      window.__oh_recaptcha = null;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const code = otp.replace(/\D/g, '');
    if (code.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    if (!confirmResult) {
      setError('Please request a new OTP.');
      setStep('phone');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const cred = await confirmResult.confirm(code);
      const idToken = await cred.user.getIdToken();
      const r = await fetch('/api/auth/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ idToken, guestUid: getUserId() || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.user) {
        setError(j.error || 'Verification failed. Try again.');
        return;
      }
      setCachedUser(j.user);
      onSuccess();
    } catch {
      setError('Incorrect OTP. Check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 py-5 space-y-4">
      <div id="oh-recaptcha" />
      {step === 'phone' ? (
        <>
          <Field label="Mobile number" icon={<PhoneSvg />} error={null}>
            <div className="relative">
              <span className="absolute left-11 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-semibold pointer-events-none border-r border-[#2c2c2c] pr-2.5">
                +91
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                placeholder="98765 43210"
                inputMode="numeric"
                autoComplete="tel"
                className={`${inputCls} pl-[76px] tracking-widest`}
              />
            </div>
          </Field>
          {error && (
            <p className="text-xs font-semibold text-red-300 bg-red-950/50 border border-red-900/60 rounded-xl px-3.5 py-2.5">{error}</p>
          )}
          <button
            type="button"
            onClick={() => sendOtp(false)}
            disabled={loading}
            className="w-full min-h-[52px] rounded-2xl bg-[#ff9900] hover:bg-[#ffa826] disabled:opacity-60 text-black font-black text-sm shadow-lg shadow-[#ff9900]/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            {loading ? (
              <>
                <IconSpinner size={18} /> Sending OTP...
              </>
            ) : (
              'Send OTP'
            )}
          </button>
          <p className="text-center text-[11px] text-neutral-600">OTP will arrive by SMS. Standard rates may apply.</p>
        </>
      ) : (
        <>
          <div className="text-center">
            <p className="text-sm text-neutral-300">
              OTP sent to <span className="font-bold text-white">+91 {digits10()}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setError('');
              }}
              className="text-xs text-[#ff9900] font-bold hover:underline mt-1 cursor-pointer"
            >
              Change number
            </button>
          </div>
          <Field label="Enter OTP" icon={<IconLock size={16} />} error={null}>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${inputCls} tracking-[0.5em] text-center text-lg font-black`}
            />
          </Field>
          {error && (
            <p className="text-xs font-semibold text-red-300 bg-red-950/50 border border-red-900/60 rounded-xl px-3.5 py-2.5">{error}</p>
          )}
          <button
            type="button"
            onClick={verifyOtp}
            disabled={loading}
            className="w-full min-h-[52px] rounded-2xl bg-[#ff9900] hover:bg-[#ffa826] disabled:opacity-60 text-black font-black text-sm shadow-lg shadow-[#ff9900]/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            {loading ? (
              <>
                <IconSpinner size={18} /> Verifying...
              </>
            ) : (
              'Verify & Sign In'
            )}
          </button>
          <p className="text-center text-xs text-neutral-500">
            {resendIn > 0 ? (
              <>Resend OTP in {resendIn}s</>
            ) : (
              <button type="button" onClick={() => sendOtp(true)} disabled={loading} className="text-[#ff9900] font-bold hover:underline cursor-pointer">
                Resend OTP
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
}

// ---------- Main modal ----------
export default function AuthModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('email'); // 'email' | 'phone'
  const [mode, setMode] = useState('signin'); // email sub-mode
  const [providers, setProviders] = useState({ google: false, phone: true, email: true });
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
      setTab('email');
      setMode(e?.detail?.mode === 'register' ? 'register' : 'signin');
      setErrors({});
      setFormError('');
      setDone(false);
      setShowPw(false);
      setOpen(true);
      fetch('/api/auth/providers')
        .then((r) => r.json())
        .then((j) => setProviders({ google: !!j.google, phone: j.phone !== false, email: true }))
        .catch(() => {});
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

  const startGoogle = () => {
    const guestUid = getUserId() || '';
    const next = window.location.pathname + window.location.search;
    window.location.href = `/api/auth/google?guestUid=${encodeURIComponent(guestUid)}&next=${encodeURIComponent(next)}`;
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
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm fade-in overflow-y-auto"
      onClick={() => !loading && setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in or create account"
    >
      <div
        className="w-full max-w-sm bg-[#141414] border border-[#2a2a2a] rounded-3xl shadow-2xl overflow-hidden my-8"
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
            {done ? 'Welcome!' : mode === 'register' && tab === 'email' ? 'Create account' : 'Welcome back'}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {done ? 'You are signed in.' : 'Save favorites, history and playlists to your account.'}
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
            {/* Google button */}
            {providers.google && (
              <div className="px-6 pb-4">
                <button
                  type="button"
                  onClick={startGoogle}
                  className="w-full min-h-[52px] rounded-2xl bg-white hover:bg-neutral-100 text-black font-bold text-sm transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-[0.98] shadow"
                >
                  <GoogleSvg />
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 mt-4">
                  <span className="flex-1 h-px bg-[#222]" />
                  <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">or</span>
                  <span className="flex-1 h-px bg-[#222]" />
                </div>
              </div>
            )}

            {/* Main tabs: Email / Phone */}
            <div className="px-6">
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#0e0e0e] rounded-2xl border border-[#222]">
                <button
                  type="button"
                  onClick={() => setTab('email')}
                  className={`min-h-[44px] rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    tab === 'email' ? 'bg-[#ff9900] text-black shadow' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <MailSvg size={15} /> Email
                </button>
                {providers.phone && (
                  <button
                    type="button"
                    onClick={() => setTab('phone')}
                    className={`min-h-[44px] rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      tab === 'phone' ? 'bg-[#ff9900] text-black shadow' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <PhoneSvg size={15} /> Phone
                  </button>
                )}
              </div>
            </div>

            {tab === 'phone' ? (
              <PhoneAuth onSuccess={() => { setDone(true); setTimeout(() => setOpen(false), 900); }} />
            ) : (
              <>
                {/* Email sub-tabs */}
                <div className="px-6 pt-4">
                  <div className="flex gap-4 justify-center">
                    {[
                      { id: 'signin', label: 'Sign In' },
                      { id: 'register', label: 'Register' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => switchMode(t.id)}
                        className={`pb-1.5 text-sm font-bold transition-colors cursor-pointer border-b-2 ${
                          mode === t.id
                            ? 'text-[#ff9900] border-[#ff9900]'
                            : 'text-neutral-500 border-transparent hover:text-white'
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
          </>
        )}
      </div>
    </div>
  );
}
