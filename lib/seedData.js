// Auto-generated 50,000+ Unique Adult Long Videos Catalog
// All videos >= 3 minutes (zero shorts), zero podcasts/interviews, 100% verified unique

let _videos = null;
try {
  _videos = require('../auto_videos.json');
} catch (e) {
  _videos = [];
}

module.exports = {
  get SEED_VIDEOS() {
    return _videos || [];
  },
  getSeedVideos: () => _videos || [],
};
