/**
 * Number & Views formatting utilities for OrangeHub
 * Enforces en-US thousands separators (e.g. 2,898) and single "views" suffix.
 */

export function formatCount(val) {
  if (val === null || val === undefined || val === '') return '';
  const s = String(val).trim();

  // If European dot thousands separator: e.g. "2.898 Videos" or "12.450"
  // Replaces 1-3 digits followed by dot and 3 digits with comma
  let out = s.replace(/\b(\d{1,3})\.(\d{3})\b/g, '$1,$2');

  // Format any raw 4+ digit numbers without commas to en-US comma format
  out = out.replace(/\b(\d{4,})\b/g, (match) => {
    const num = parseInt(match, 10);
    return isNaN(num) ? match : num.toLocaleString('en-US');
  });

  return out;
}

export function parseViewsNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).trim().toLowerCase().replace(/views?$/i, '').trim();
  if (s.endsWith('b')) return Math.round(parseFloat(s) * 1e9);
  if (s.endsWith('m')) return Math.round(parseFloat(s) * 1e6);
  if (s.endsWith('k')) return Math.round(parseFloat(s) * 1e3);
  const clean = s.replace(/,/g, '');
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatMaxViews(upstream, internal) {
  const upNum = parseViewsNumber(upstream);
  const intNum = typeof internal === 'number' ? internal : parseViewsNumber(internal);
  const n = Math.max(upNum, intNum);

  if (!n || n <= 0) {
    return upstream ? formatViews(upstream) : '0 views';
  }

  const suffix = n === 1 ? 'view' : 'views';
  if (n >= 1_000_000) {
    const m = (n / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${m}M ${suffix}`;
  }
  if (n >= 10_000) {
    const k = (n / 1_000).toFixed(1).replace(/\.0$/, '');
    return `${k}K ${suffix}`;
  }
  return `${n.toLocaleString('en-US')} ${suffix}`;
}

export function formatViews(val) {
  if (val === null || val === undefined || val === '') return '';
  let s = String(val).trim();

  // Strip trailing "views" or "view" if present to avoid duplication
  s = s.replace(/\s*views?$/i, '').trim();

  // Format count (e.g. 2.898 -> 2,898 or 2898 -> 2,898)
  s = formatCount(s);

  return `${s} views`;
}

export function parseDurationSec(d) {
  if (!d) return 0;
  if (typeof d === 'number') return d;
  const str = String(d).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const parts = str.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2 && parts.every((n) => !isNaN(n))) return parts[0] * 60 + parts[1];
  const minMatch = str.match(/(\d+)\s*(?:min|m\b)/i);
  const secMatch = str.match(/(\d+)\s*(?:sec|s\b)/i);
  let total = 0;
  if (minMatch) total += parseInt(minMatch[1], 10) * 60;
  if (secMatch) total += parseInt(secMatch[1], 10);
  return total;
}
