-- OrangeHub D1 schema (SQLite). Converted from prisma/schema.prisma.
-- Conventions: DateTime -> TEXT (ISO 8601), Json -> TEXT (stringified),
-- Boolean -> INTEGER (0/1). IDs generated in JS (cuid-compatible strings).

CREATE TABLE IF NOT EXISTS VideoCache (
  vkey TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  thumbnail TEXT,
  duration TEXT,
  durationSec INTEGER,
  views TEXT,
  viewsNum INTEGER,
  data TEXT NOT NULL,
  cachedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_VideoCache_expiresAt ON VideoCache(expiresAt);

CREATE TABLE IF NOT EXISTS FeedCache (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  cachedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_FeedCache_expiresAt ON FeedCache(expiresAt);

CREATE TABLE IF NOT EXISTS Favorite (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  vkey TEXT NOT NULL,
  title TEXT,
  thumbnail TEXT,
  createdAt TEXT NOT NULL,
  UNIQUE(userId, vkey)
);
CREATE INDEX IF NOT EXISTS idx_Favorite_userId_createdAt ON Favorite(userId, createdAt);

CREATE TABLE IF NOT EXISTS WatchHistory (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  vkey TEXT NOT NULL,
  title TEXT,
  thumbnail TEXT,
  durationSec INTEGER,
  progressSec INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT NOT NULL,
  UNIQUE(userId, vkey)
);
CREATE INDEX IF NOT EXISTS idx_WatchHistory_userId_updatedAt ON WatchHistory(userId, updatedAt);

CREATE TABLE IF NOT EXISTS VideoStat (
  vkey TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS SearchLog (
  query TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Playlist (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  isPublic INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_Playlist_userId ON Playlist(userId);

CREATE TABLE IF NOT EXISTS PlaylistItem (
  id TEXT PRIMARY KEY,
  playlistId TEXT NOT NULL REFERENCES Playlist(id) ON DELETE CASCADE,
  vkey TEXT NOT NULL,
  title TEXT,
  thumbnail TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  addedAt TEXT NOT NULL,
  UNIQUE(playlistId, vkey)
);
CREATE INDEX IF NOT EXISTS idx_PlaylistItem_playlistId ON PlaylistItem(playlistId);

CREATE TABLE IF NOT EXISTS Report (
  id TEXT PRIMARY KEY,
  vkey TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_Report_vkey ON Report(vkey);

CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  passwordHash TEXT,
  googleId TEXT UNIQUE,
  phone TEXT UNIQUE,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_User_email ON User(email);

CREATE TABLE IF NOT EXISTS Session (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_Session_userId ON Session(userId);
CREATE INDEX IF NOT EXISTS idx_Session_expiresAt ON Session(expiresAt);

-- Static video catalog (52k videos, imported from auto_videos.json).
-- Used for sitemaps, watch-page metadata fallback, and scraper fallback.
CREATE TABLE IF NOT EXISTS SeedVideo (
  vkey TEXT PRIMARY KEY,
  title TEXT,
  url TEXT,
  thumbnail TEXT,
  duration TEXT,
  views TEXT,
  added TEXT,
  hd INTEGER NOT NULL DEFAULT 0,
  premium INTEGER NOT NULL DEFAULT 0,
  author TEXT,
  preview TEXT
);
