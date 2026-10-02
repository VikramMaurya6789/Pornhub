'use client';

import { useEffect, useState } from 'react';

// Detect chunk-load / dynamic-import failures (stale bundle after a deploy).
function isChunkError(err) {
  const msg = String(err?.message || err || '');
  const name = String(err?.name || '');
  return (
    name === 'ChunkLoadError' ||
    /loading chunk .* failed/i.test(msg) ||
    /chunkloaderror/i.test(msg) ||
    /dynamically imported module/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg)
  );
}

const RELOAD_GUARD_KEY = 'oh_global_error_reloaded';

export default function GlobalError({ error, reset }) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    try {
      console.error('[OrangeHub GlobalError]:', error?.message || error, error?.digest || '');
    } catch {}

    // Self-heal: if this looks like a stale-chunk failure after a deploy,
    // reload exactly once so the browser picks up the current bundle.
    // Guarded by sessionStorage so a genuinely broken chunk can't loop.
    try {
      if (isChunkError(error)) {
        const last = parseInt(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0', 10);
        if (!isNaN(last) && Date.now() - last < 30000) return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {}
  }, [error]);

  const message = error?.message || 'Unknown error';
  const digest = error?.digest || '';

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'rgba(255,153,0,0.15)',
              border: '1px solid rgba(255,153,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: 32,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff9900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#a3a3a3', margin: '0 0 24px', lineHeight: 1.6 }}>
            The page hit an unexpected error. Try reloading — if it keeps happening, let us know.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                try {
                  reset();
                } catch {
                  window.location.reload();
                }
              }}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                background: '#ff9900',
                color: '#000',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => setShowDetails((s) => !s)}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                background: '#1c1c1c',
                color: '#d4d4d4',
                fontSize: 14,
                border: '1px solid #2a2a2a',
                cursor: 'pointer',
              }}
            >
              {showDetails ? 'Hide details' : 'Error details'}
            </button>
          </div>
          {showDetails && (
            <pre
              style={{
                marginTop: 20,
                padding: 12,
                borderRadius: 12,
                background: '#141414',
                border: '1px solid #2a2a2a',
                fontSize: 11,
                color: '#f87171',
                textAlign: 'left',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message}
              {digest ? `\n\nDigest: ${digest}` : ''}
            </pre>
          )}
        </div>
      </body>
    </html>
  );
}
