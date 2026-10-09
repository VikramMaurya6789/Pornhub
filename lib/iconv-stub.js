// Minimal iconv-lite stub for Cloudflare Workers.
// The app only processes UTF-8 HTML (cheerio always receives strings from
// res.text(), never Buffers needing charset detection), so the full
// encoding tables (580KB x3 in the bundle) are dead weight.
// This stub satisfies the import without bundling the tables.
function decode(buf, enc) {
  if (Buffer.isBuffer(buf)) return buf.toString('utf-8');
  return String(buf);
}
function encode(str, enc) {
  return Buffer.from(String(str), 'utf-8');
}
module.exports = {
  decode,
  encode,
  encodingExists: () => true,
  getEncoder: () => ({ write: encode, end: () => Buffer.alloc(0) }),
  getDecoder: () => ({ write: decode, end: () => '' }),
};
module.exports.default = module.exports;
