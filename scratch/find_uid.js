const fs = require('fs');
const path = require('path');

function walk(dir) {
  let res = [];
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (f === 'node_modules' || f === '.next' || f === '.git' || f === 'scratch') return;
    if (fs.statSync(full).isDirectory()) res = res.concat(walk(full));
    else if (/\.(js|jsx|ts|tsx)$/.test(f)) res.push(full);
  });
  return res;
}

const files = walk('.');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (/\buid\b/.test(l) || /getUserId/.test(l) || /oh_uid/.test(l)) {
      console.log(`${file}:${idx + 1}: ${l.trim()}`);
    }
  });
});
