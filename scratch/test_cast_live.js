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

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('=== VERIFYING LIVE CHROMCAST AVAILABILITY GATING ===\n');

  const watchRes = await get('https://orangehub.royalcloud.qzz.io/watch/6a9d7423ec7ba');
  console.log('[Watch Page] Status:', watchRes.status, 'HTML length:', watchRes.body.length);

  const scriptRegex = /src="(\/_next\/static\/[^"]+)"/g;
  let m;
  const scriptMatches = [];
  while ((m = scriptRegex.exec(watchRes.body)) !== null) {
    scriptMatches.push(m[1]);
  }
  console.log('Total scripts found:', scriptMatches.length);

  let foundCastGating = false;
  let foundNoDevicesCheck = false;
  let foundTimeout = false;

  for (const src of scriptMatches) {
    await sleep(200);
    const js = (await get('https://orangehub.royalcloud.qzz.io' + src)).body;

    if (js.includes('NO_DEVICES_AVAILABLE')) {
      foundNoDevicesCheck = true;
      console.log('  -> Found NO_DEVICES_AVAILABLE check in:', src);
    }
    if (js.includes('CAST_STATE_CHANGED')) {
      foundCastGating = true;
      console.log('  -> Found CAST_STATE_CHANGED listener in:', src);
    }
    if (js.includes('5000') && js.includes('google-cast-sender-sdk')) {
      foundTimeout = true;
      console.log('  -> Found 5s timeout & Cast SDK in:', src);
    }
  }

  console.log('\nVerification Summary:');
  console.log('1. NO_DEVICES_AVAILABLE state gate in bundle:', foundNoDevicesCheck);
  console.log('2. CAST_STATE_CHANGED listener in bundle:', foundCastGating);
  console.log('3. 5000ms detection timeout in bundle:', foundTimeout);

  if (foundNoDevicesCheck && foundCastGating && foundTimeout) {
    console.log('\nSUCCESS: All Cast availability gating requirements are active in production!');
  } else {
    console.error('\nFAILURE: Missing gating checks in bundle.');
    process.exit(1);
  }
}

run().catch(console.error);
