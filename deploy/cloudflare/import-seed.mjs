// Import auto_videos.json (52k videos) into D1 SeedVideo table.
// Usage (after `npx wrangler d1 create orangehub` and schema applied):
//   node deploy/cloudflare/import-seed.mjs
// This generates deploy/cloudflare/seed-batches/*.sql (500 rows each),
// then run: for f in deploy/cloudflare/seed-batches/*.sql; do
//             npx wrangler d1 execute orangehub --file "$f" --remote; done
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(__dirname, 'seed-batches');

const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'auto_videos.json'), 'utf8'));
console.log(`Loaded ${src.length} videos`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const esc = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return "'" + String(v).replace(/'/g, "''") + "'";
};

const BATCH = 500;
let batch = [], n = 0;
for (const v of src) {
  if (!v.vkey) continue;
  batch.push(
    `(${esc(v.vkey)},${esc(v.title)},${esc(v.url)},${esc(v.thumbnail)},${esc(v.duration)},${esc(v.views)},${esc(v.added)},${esc(v.hd)},${esc(v.premium)},${esc(v.author)},${esc(v.preview)})`
  );
  if (batch.length >= BATCH) {
    n++;
    fs.writeFileSync(
      path.join(OUT, `batch-${String(n).padStart(3, '0')}.sql`),
      `INSERT OR REPLACE INTO SeedVideo (vkey,title,url,thumbnail,duration,views,added,hd,premium,author,preview) VALUES\n` +
        batch.join(',\n') + ';\n'
    );
    batch = [];
  }
}
if (batch.length) {
  n++;
  fs.writeFileSync(
    path.join(OUT, `batch-${String(n).padStart(3, '0')}.sql`),
    `INSERT OR REPLACE INTO SeedVideo (vkey,title,url,thumbnail,duration,views,added,hd,premium,author,preview) VALUES\n` +
      batch.join(',\n') + ';\n'
  );
}
console.log(`Wrote ${n} batch files to ${OUT}`);
