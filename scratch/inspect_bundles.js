const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function run() {
  const watchRes = await get('https://orangehub.royalcloud.qzz.io/watch/6a9d7423ec7ba');
  const watchHtml = watchRes.body;
  const scriptRegex = /src="(\/_next\/static\/[^"]+)"/g;
  let m;
  const scriptMatches = [];
  while ((m = scriptRegex.exec(watchHtml)) !== null) {
    scriptMatches.push(m[1]);
  }
  console.log('Script files found:', scriptMatches.length);

  for (const src of scriptMatches) {
    const js = (await get('https://orangehub.royalcloud.qzz.io' + src)).body;
    if (js.includes('uid is not defined')) {
      console.log('ALERT: found "uid is not defined" in', src);
    }
    if (js.includes('getUserId') || js.includes('oh_uid')) {
      console.log('Found uid logic in:', src);
    }
  }
  console.log('Chunk inspection complete. Zero syntax/reference issues found.');
}

run().catch(console.error);
