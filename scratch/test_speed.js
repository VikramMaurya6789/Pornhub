const https = require('https');

function timeGet(url) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    https.get(url, (res) => {
      let bytes = 0;
      res.on('data', (c) => bytes += c.length);
      res.on('end', () => {
        const dt = Date.now() - t0;
        resolve({
          url,
          status: res.statusCode,
          ms: dt,
          bytes,
          cache: res.headers['cache-control'] || '',
          xVercelCache: res.headers['x-vercel-cache'] || '',
        });
      });
    }).on('error', (err) => resolve({ url, error: err.message }));
  });
}

async function run() {
  console.log('Testing live response speeds...\n');
  const urls = [
    'https://orangehub.royalcloud.qzz.io/',
    'https://orangehub.royalcloud.qzz.io/api/feed?type=home',
    'https://orangehub.royalcloud.qzz.io/api/avatar?name=Angela%20White',
    'https://orangehub.royalcloud.qzz.io/og-banner.png',
    'https://orangehub.royalcloud.qzz.io/models',
  ];

  for (const u of urls) {
    const r = await timeGet(u);
    console.log(`${r.ms}ms [${r.status}] ${u} (Cache: ${r.xVercelCache || 'N/A'}, Cache-Control: ${r.cache})`);
  }
}

run();
