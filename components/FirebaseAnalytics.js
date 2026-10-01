'use client';
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initAnalytics } from '../lib/firebase';
import { logEvent } from 'firebase/analytics';
import { isAnalyticsAllowed } from '../lib/consent';

function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isAnalyticsAllowed()) return;
    initAnalytics()
      .then((analytics) => {
        if (analytics) {
          const qs = searchParams?.toString();
          const pagePath = pathname + (qs ? `?${qs}` : '');
          logEvent(analytics, 'page_view', {
            page_path: pagePath,
            page_location: typeof window !== 'undefined' ? window.location.href : '',
            page_title: typeof document !== 'undefined' ? document.title : '',
          });
        }
      })
      .catch(() => {});
  }, [pathname, searchParams]);

  return null;
}

export default function FirebaseAnalytics() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTracker />
    </Suspense>
  );
}
