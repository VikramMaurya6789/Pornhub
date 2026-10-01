/**
 * CDN fetch helpers.
 *
 * Primary: curl with Cloudflare DoH (1.1.1.1) to bypass ISP DNS hijacking & TLS inspection.
 * Fallback: Node.js native fetch with WebStream -> Node Readable conversion for cloud/Vercel serverless.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const REFERER = 'https://www.pornhub.org/';
const CURL_BIN = process.platform === 'win32' ? 'curl.exe' : 'curl';

function baseArgs(url = '', extraTimeout = 12) {
  const isOrg = (url || '').includes('pornhub.org') || (url || '').includes('ev-h.phncdn.com');
  const ref = isOrg ? 'https://www.pornhub.org/' : 'https://www.pornhub.com/';
  const orig = isOrg ? 'https://www.pornhub.org' : 'https://www.pornhub.com';
  return [
    '-sS', '-L',
    '--max-time', String(extraTimeout),
    '--tlsv1.2',
    '--doh-url', 'https://1.1.1.1/dns-query',
    '-H', `User-Agent: ${UA}`,
    '-H', `Referer: ${ref}`,
    '-H', `Origin: ${orig}`,
    '-H', 'Cookie: age_verified=1; accessAgeDisclaimerPH=1; platform=pc; hasVisited=1; il=en',
    '-H', 'Accept: */*',
  ];
}

async function fetchTextNative(url, timeoutSec = 12) {
  const isCdn = /phncdn\.com/i.test(url);
  const isOrg = (url || '').includes('pornhub.org') || (url || '').includes('ev-h.phncdn.com');
  const ref = isOrg ? 'https://www.pornhub.org/' : 'https://www.pornhub.com/';
  const orig = isOrg ? 'https://www.pornhub.org' : 'https://www.pornhub.com';

  const headers = {
    'User-Agent': UA,
    'Referer': ref,
    'Accept': '*/*',
  };
  if (!isCdn) {
    headers['Origin'] = orig;
    headers['Cookie'] = 'age_verified=1; accessAgeDisclaimerPH=1; platform=pc; hasVisited=1; il=en';
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutSec * 1000);
  try {
    const res = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const text = await res.text();
    return { status: res.status, text };
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function fetchStreamNative(url, range, timeoutSec = 15) {
  const isCdn = /phncdn\.com/i.test(url);
  const isOrg = (url || '').includes('pornhub.org') || (url || '').includes('ev-h.phncdn.com');
  const ref = isOrg ? 'https://www.pornhub.org/' : 'https://www.pornhub.com/';
  const orig = isOrg ? 'https://www.pornhub.org' : 'https://www.pornhub.com';

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutSec * 1000);

  const headers = {
    'User-Agent': UA,
    'Referer': ref,
    'Accept': '*/*',
  };
  if (!isCdn) {
    headers['Origin'] = orig;
    headers['Cookie'] = 'age_verified=1; accessAgeDisclaimerPH=1; platform=pc; hasVisited=1; il=en';
  }
  if (range) headers['Range'] = range;

  try {
    const res = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(t);

    const resHeaders = {};
    res.headers.forEach((v, k) => {
      resHeaders[k.toLowerCase()] = v;
    });

    return {
      status: res.status,
      headers: resHeaders,
      webStream: res.body,
      stream: null,
      buffer: null,
      done: Promise.resolve(),
      kill: () => { try { ctrl.abort(); } catch {} },
    };
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

/** Fetch a small text resource (m3u8 playlist or HTML). Resolves { status, text }.
 * Prioritizes curl with Cloudflare DoH to guarantee 100% ISP bypass in India / Gujarat.
 */
async function curlText(url, timeoutSec = 12) {
  // 1. Prioritize fast native fetch
  try {
    const res = await fetchTextNative(url, timeoutSec);
    if (res && res.status === 200 && res.text) {
      return res;
    }
  } catch (e) {
    // fallback to curl
  }

  // 2. Secondary fallback with curl DoH
  try {
    return await new Promise((resolve, reject) => {
      const p = spawn(CURL_BIN, [...baseArgs(url, Math.min(timeoutSec, 10)), '-w', '\n%{http_code}', url],
        { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = Buffer.alloc(0);
      let err = '';
      p.stdout.on('data', (d) => { out = Buffer.concat([out, d]); });
      p.stderr.on('data', (d) => { err += d.toString(); });
      p.on('error', reject);
      p.on('close', (code) => {
        const s = out.toString('utf8');
        const idx = s.lastIndexOf('\n');
        const status = parseInt(s.slice(idx + 1).trim(), 10) || 0;
        if (!status) return reject(new Error(`curl failed: ${err.trim() || 'code ' + code}`));
        resolve({ status, text: s.slice(0, idx) });
      });
    });
  } catch (curlErr) {
    throw curlErr;
  }
}

/**
 * Stream a media resource (.ts, .mp4, .m4s).
 * Fast curl with DoH prioritized to bypass ISP blocks in Gujarat / India.
 */
async function curlStream(url, range) {
  // 1. Try native fetch streaming first (fastest, pristine binary, zero byte loss)
  try {
    const nativeRes = await fetchStreamNative(url, range, 20);
    if (nativeRes && (nativeRes.status === 200 || nativeRes.status === 206)) {
      return nativeRes;
    }
  } catch (err) {
    console.warn('[cdn] fetchStreamNative failed, attempting fallback:', err.message);
  }

  // 2. Safe curl fallback without -i so no video bytes are ever discarded
  return await new Promise((resolve, reject) => {
    const args = [...baseArgs(url, 20)];
    if (range) {
      const m = String(range).match(/bytes=(\d*)-(\d*)/);
      if (m) args.push('--range', `${m[1] || '0'}-${m[2] || ''}`);
    }
    args.push(url);
    const p = spawn(CURL_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    p.stdout.on('data', (d) => chunks.push(d));
    p.on('error', reject);
    p.on('close', (code) => {
      const buffer = Buffer.concat(chunks);
      if (buffer.length > 0) {
        resolve({
          status: 200,
          headers: {
            'content-type': (/\.(mp4|m4s)/i.test(url) ? 'video/mp4' : 'video/mp2t'),
            'content-length': String(buffer.length),
          },
          webStream: null,
          stream: null,
          buffer,
          done: Promise.resolve(),
          kill: () => {},
        });
      } else {
        reject(new Error('curl returned empty stream with code ' + code));
      }
    });
  });
}

module.exports = { curlText, curlStream, UA, REFERER };
