const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function verifyAll() {
  console.log('--- 1. RTA / ADULT RATING META & OG BANNER ON HOMEPAGE ---');
  const home = await get('https://orangehub.royalcloud.qzz.io/');
  console.log('Homepage status:', home.status);
  console.log('Has rating=adult:', home.body.includes('content="adult"'));
  console.log('Has RTA label:', home.body.includes('RTA-5042-1996-1400-1577-RTA'));
  console.log('Has og-banner absolute URL:', home.body.includes('https://orangehub.royalcloud.qzz.io/og-banner.png'));

  console.log('\n--- 2. OG BANNER DIRECT URL ---');
  const ogRes = await get('https://orangehub.royalcloud.qzz.io/og-banner.png');
  console.log('og-banner.png status:', ogRes.status, 'Content-Type:', ogRes.headers['content-type'], 'Length:', ogRes.body.length);

  console.log('\n--- 3. TRENDING SEARCHES API & CACHE ---');
  const trend = await get('https://orangehub.royalcloud.qzz.io/api/trending-searches');
  console.log('trending-searches status:', trend.status);
  console.log('Cache-Control:', trend.headers['cache-control']);
  try {
    const trendJson = JSON.parse(trend.body);
    console.log('Queries count:', trendJson.queries?.length, 'Sample:', trendJson.queries?.slice(0, 4));
  } catch (e) {
    console.log('Failed to parse json:', e.message);
  }

  console.log('\n--- 4. FANS ALSO WATCHED ON PORNSTAR PAGE ---');
  const star = await get('https://orangehub.royalcloud.qzz.io/pornstar/angela-white');
  console.log('Pornstar page status:', star.status);
  console.log('Has "Fans Also Watched":', star.body.includes('Fans Also Watched'));

  console.log('\n--- 5. SITEMAPS ---');
  const smIndex = await get('https://orangehub.royalcloud.qzz.io/sitemap.xml');
  console.log('sitemap.xml status:', smIndex.status);
  console.log('Has sitemap-creators.xml:', smIndex.body.includes('sitemap-creators.xml'));
  console.log('Has sitemap-categories.xml:', smIndex.body.includes('sitemap-categories.xml'));

  const smCreators = await get('https://orangehub.royalcloud.qzz.io/sitemap-creators.xml');
  console.log('sitemap-creators.xml status:', smCreators.status, 'Cache-Control:', smCreators.headers['cache-control']);
  console.log('Contains /pornstar/ links:', smCreators.body.includes('/pornstar/'));

  const smCats = await get('https://orangehub.royalcloud.qzz.io/sitemap-categories.xml');
  console.log('sitemap-categories.xml status:', smCats.status, 'Cache-Control:', smCats.headers['cache-control']);
  console.log('Contains /category/ links:', smCats.body.includes('/category/'));

  console.log('\n--- 6. ANONYMOUS COMMENTS API & RATE LIMIT ---');
  const testUid = 'verify_test_' + Date.now();
  const c1 = await post('https://orangehub.royalcloud.qzz.io/api/comments', {
    vkey: '6543b56a4b16c',
    uid: testUid,
    author: 'Tester',
    text: 'Live verification test comment',
  });
  console.log('First comment status:', c1.status);
  try {
    console.log('Comment 1 response:', JSON.parse(c1.body));
  } catch {
    console.log('Body:', c1.body);
  }

  // Rate limit test (within 30s)
  const c2 = await post('https://orangehub.royalcloud.qzz.io/api/comments', {
    vkey: '6543b56a4b16c',
    uid: testUid,
    author: 'Tester',
    text: 'Second immediate comment',
  });
  console.log('Immediate second comment status (expect 429):', c2.status);
  try {
    console.log('Comment 2 response:', JSON.parse(c2.body));
  } catch {
    console.log('Body:', c2.body);
  }

  const cList = await get('https://orangehub.royalcloud.qzz.io/api/comments?vkey=6543b56a4b16c');
  console.log('GET comments status:', cList.status);

  console.log('\n--- 7. CACHE-CONTROL HEADERS ON CORE APIS ---');
  const feed = await get('https://orangehub.royalcloud.qzz.io/api/feed?type=home');
  console.log('/api/feed Cache-Control:', feed.headers['cache-control']);

  const cat = await get('https://orangehub.royalcloud.qzz.io/api/category?slug=amateur');
  console.log('/api/category Cache-Control:', cat.headers['cache-control']);

  const search = await get('https://orangehub.royalcloud.qzz.io/api/search?q=japanese');
  console.log('/api/search Cache-Control:', search.headers['cache-control']);

  const cats = await get('https://orangehub.royalcloud.qzz.io/api/categories');
  console.log('/api/categories Cache-Control:', cats.headers['cache-control']);

  const vid = await get('https://orangehub.royalcloud.qzz.io/api/video?vkey=6543b56a4b16c');
  console.log('/api/video Cache-Control:', vid.headers['cache-control']);

  console.log('\n--- 8. LEADERBOARD /models ---');
  const models = await get('https://orangehub.royalcloud.qzz.io/models');
  console.log('/models status:', models.status);
  console.log('Does NOT contain "This Week":', !models.body.includes('This Week'));
  console.log('Does NOT contain "This Month":', !models.body.includes('This Month'));

  console.log('\n--- 9. /api/download 404 TEST ---');
  const dl = await get('https://orangehub.royalcloud.qzz.io/api/download');
  console.log('/api/download status (expect 404):', dl.status);

  console.log('\n=== ALL VERIFICATIONS COMPLETE ===');
}

verifyAll().catch(console.error);
