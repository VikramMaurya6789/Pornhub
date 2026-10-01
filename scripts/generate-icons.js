const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function run() {
  const svgPath = path.join(__dirname, '..', 'app', 'icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  const out192 = path.join(__dirname, '..', 'public', 'icon-192.png');
  const out512 = path.join(__dirname, '..', 'public', 'icon-512.png');

  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(out192);

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(out512);

  console.log('Successfully generated icon-192.png and icon-512.png');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
