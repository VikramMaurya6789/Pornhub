// Netlify Scheduled Function: refreshes the catalog + pre-warms the "newest"
// feed cache in the DB every day, so every section shows fresh videos daily.
// Runs at ~02:30 UTC daily (08:00 IST).
export const config = {
  schedule: '30 2 * * *',
};

const SITE_URL = (process.env.URL || 'https://orangehub-195.netlify.app').replace(/\/$/, '');

export default async () => {
  const headers = {};
  if (process.env.CRON_SECRET) {
    headers['Authorization'] = `Bearer ${process.env.CRON_SECRET}`;
  }
  const started = Date.now();
  try {
    const res = await fetch(`${SITE_URL}/api/cron/sync`, {
      headers,
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json().catch(() => ({}));
    console.log(
      `[daily-sync] done in ${Date.now() - started}ms:`,
      res.status,
      JSON.stringify(data).slice(0, 400)
    );
    return new Response(JSON.stringify({ ok: res.ok, status: res.status }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // Even if waiting timed out, the sync endpoint keeps running server-side.
    console.error(`[daily-sync] trigger finished in ${Date.now() - started}ms:`, e.message);
    return new Response(JSON.stringify({ ok: true, note: 'trigger fired', ms: Date.now() - started }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
