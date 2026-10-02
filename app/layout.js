import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AgeGate from '../components/AgeGate';
import CookieConsent from '../components/CookieConsent';
import StartingAnimation from '../components/StartingAnimation';
import FirebaseAnalytics from '../components/FirebaseAnalytics';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';
import PwaInstallBanner from '../components/PwaInstallBanner';
import MobileBottomNav from '../components/MobileBottomNav';

export const viewport = {
  themeColor: '#FF9000',
  colorScheme: 'dark',
};

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://orangehub.royalcloud.qzz.io'),
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OrangeHub',
  },
  title: {
    default: 'OrangeHub — Free HD Videos & Trending Movies',
    template: '%s | OrangeHub',
  },
  description: 'Watch 1080p Full HD trending videos, top models & exclusive movies on OrangeHub. 100% free streaming with zero ads and ultra-fast playback.',
  applicationName: 'OrangeHub',
  keywords: ['OrangeHub', 'Free HD Videos', 'Trending Movies', '1080p Streaming', 'Ad-free Video Player', 'Full HD'],
  authors: [{ name: 'OrangeHub' }],
  creator: 'OrangeHub',
  publisher: 'OrangeHub',
  other: {
    rating: 'adult',
    RTA: 'RTA-5042-1996-1400-1577-RTA',
  },
  openGraph: {
    title: 'OrangeHub — Free HD Videos & Trending Movies',
    description: 'Watch 1080p Full HD trending videos, top models & exclusive movies on OrangeHub. 100% free streaming with zero ads and ultra-fast playback.',
    url: 'https://orangehub.royalcloud.qzz.io',
    siteName: 'OrangeHub',
    images: [
      {
        url: 'https://orangehub.royalcloud.qzz.io/og-banner.png',
        width: 1200,
        height: 630,
        alt: 'OrangeHub — Free 1080p HD Streaming Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrangeHub — Free HD Videos & Trending Movies',
    description: 'Watch 1080p Full HD trending videos, top models & exclusive movies on OrangeHub. 100% free streaming with zero ads and ultra-fast playback.',
    images: ['https://orangehub.royalcloud.qzz.io/og-banner.png'],
    creator: '@OrangeHub',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://orangehub.royalcloud.qzz.io" />
        <link rel="preconnect" href="https://ei.phncdn.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://ei.phncdn.com" />
        <link rel="dns-prefetch" href="https://di.phncdn.com" />
        <link rel="dns-prefetch" href="https://ci.phncdn.com" />
        <meta name="rating" content="adult" />
        <meta name="rating" content="RTA-5042-1996-1400-1577-RTA" />
        <meta name="RTA" content="RTA-5042-1996-1400-1577-RTA" />
        <meta name="theme-color" content="#FF9000" />
        <meta name="msapplication-TileColor" content="#FF9000" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OrangeHub" />
        <script
          type="text/plain"
          id="rta-label"
          dangerouslySetInnerHTML={{
            __html: 'RTA-5042-1996-1400-1577-RTA',
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var v = localStorage.getItem('oh_age_verified') === '1' || localStorage.getItem('oh_age_ok') === '1' || (document.cookie && document.cookie.indexOf('oh_age_verified=1') !== -1);
                  if (v) {
                    document.documentElement.classList.add('oh-age-verified');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var origSetAttr = Element.prototype.setAttribute;
                  Element.prototype.setAttribute = function(name, value) {
                    if (name === 'bis_skin_checked') return;
                    return origSetAttr.apply(this, arguments);
                  };
                  var clean = function() {
                    var els = document.querySelectorAll('[bis_skin_checked]');
                    for (var i = 0; i < els.length; i++) {
                      els[i].removeAttribute('bis_skin_checked');
                    }
                  };
                  if (typeof MutationObserver !== 'undefined') {
                    new MutationObserver(function(mutations) {
                      for (var i = 0; i < mutations.length; i++) {
                        var m = mutations[i];
                        if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked') {
                          m.target.removeAttribute('bis_skin_checked');
                        }
                      }
                    }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['bis_skin_checked'] });
                  }
                  clean();
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', clean);
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-black text-neutral-200 antialiased pb-[64px] lg:pb-0" suppressHydrationWarning>
        <ServiceWorkerRegister />
        <FirebaseAnalytics />
        <StartingAnimation />
        <AgeGate />
        <CookieConsent />
        <PwaInstallBanner />
        <Header />
        <main className="min-h-[70vh]">{children}</main>
        <Footer />
        <MobileBottomNav />
      </body>
    </html>
  );
}
