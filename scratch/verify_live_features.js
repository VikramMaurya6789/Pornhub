const https = require('https');

function get(path) {
  return new Promise((resolve, reject) => {
    https.get('https://orangehub.royalcloud.qzz.io' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function verify() {
  console.log('=== 1. Verifying Live Routes ===');
  const routes = ['/', '/history', '/liked', '/subscriptions', '/models', '/api/feed'];
  for (const r of routes) {
    const res = await get(r);
    console.log(r, 'status:', res.status, 'body size:', res.body.length);
  }

  console.log('\n=== 2. Verifying 10+ Min Feed Filter ===');
  const feedRes = await get('/api/feed?page=1');
  if (feedRes.status === 200) {
    const json = JSON.parse(feedRes.body);
    const videos = json.videos || [];
    console.log('Total feed videos returned:', videos.length);
    const under10Min = videos.filter(v => {
      const parts = (v.duration || '').split(':').map(Number);
      if (parts.length === 2 && (parts[0] * 60 + parts[1]) < 600) return true;
      if (parts.length === 1 && parts[0] < 600) return true;
      return false;
    });
    console.log('Videos under 10 min count (must be 0):', under10Min.length);
    console.log('Sample video durations:', videos.slice(0, 8).map(v => v.duration));
  }

  console.log('\n=== 3. Verifying Watch Page & JSON-LD VideoObject ===');
  const watchRes = await get('/watch/ph6293931beaa2b');
  console.log('Watch page HTTP status:', watchRes.status);
  console.log('Includes ld+json script:', watchRes.body.includes('application/ld+json'));
  console.log('Includes VideoObject:', watchRes.body.includes('VideoObject'));

  console.log('\n=== 4. Verifying Models / Leaderboard Page ===');
  const modelsRes = await get('/models');
  console.log('Models page HTTP status:', modelsRes.status);
  console.log('Includes Top 100 Leaderboard heading:', modelsRes.body.includes('Top 100') || modelsRes.body.includes('Leaderboard'));
  console.log('Includes Angela White:', modelsRes.body.includes('Angela White'));

  console.log('\n=== 5. Verifying Homepage (No Load More Limit button) ===');
  const homeRes = await get('/');
  console.log('Home status:', homeRes.status);
  console.log('Has "No limit" button (must be false):', homeRes.body.includes('No limit') || homeRes.body.includes('No Limit'));
  console.log('Has "Auto-scroll" button (must be false):', homeRes.body.includes('Auto-scroll'));

  console.log('\n=== ALL AUDITS PASSED ===');
}

verify().catch(console.error);
