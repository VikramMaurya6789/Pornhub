'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthPanel from '../../components/AuthPanel';
import { fetchMe, getCachedUser } from '../../lib/auth-client';
import { Logo } from '../../components/Header';

function safeNext(v) {
  return typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/';
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const mode = sp.get('mode') === 'register' ? 'register' : 'signin';
  const next = safeNext(sp.get('next'));
  const auth = sp.get('auth'); // 'success' | 'error' | null (from Google OAuth)
  const [checking, setChecking] = useState(true);

  // If already signed in, go where they were headed.
  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = getCachedUser();
      if (cached) {
        router.replace(next);
        return;
      }
      const user = await fetchMe().catch(() => null);
      if (!alive) return;
      if (user) {
        router.replace(next);
      } else {
        setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router, next]);

  // Coming back from Google OAuth.
  useEffect(() => {
    if (auth === 'success' && !checking) {
      const t = setTimeout(() => router.replace(next), 1200);
      return () => clearTimeout(t);
    }
  }, [auth, checking, router, next]);

  if (checking && !auth) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-[#ff9900] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8" aria-label="OrangeHub home">
        <Logo size="lg" />
      </Link>

      <div className="w-full max-w-sm bg-[#141414] border border-[#2a2a2a] rounded-3xl shadow-2xl overflow-hidden">
        {auth === 'error' && (
          <p className="mx-6 mt-6 text-xs font-semibold text-red-300 bg-red-950/50 border border-red-900/60 rounded-xl px-3.5 py-2.5">
            Google sign-in failed. Please try again.
          </p>
        )}
        {auth === 'success' ? (
          <div className="px-6 py-10 flex flex-col items-center gap-4 text-center">
            <span className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-green-400" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <p className="text-lg font-black text-white">Welcome!</p>
            <p className="text-xs text-neutral-500">Taking you back…</p>
          </div>
        ) : (
          <AuthPanel initialMode={mode} next={next} />
        )}
      </div>

      <p className="mt-6 text-xs text-neutral-600 text-center max-w-xs">
        By signing in you agree to our{' '}
        <Link href="/terms" className="text-neutral-400 hover:text-white underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-neutral-400 hover:text-white underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
