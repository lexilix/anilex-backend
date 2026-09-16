// Auto-respawn with --experimental-sqlite if missing
try {
  require('node:sqlite');
} catch (err) {
  if (err.code === 'ERR_UNKNOWN_BUILTIN_MODULE' && !process.execArgv.includes('--experimental-sqlite')) {
    console.log('[Database] Auto-relaunching with --experimental-sqlite flag...');
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(process.execPath, ['--experimental-sqlite', ...process.argv.slice(1)], {
      stdio: 'inherit',
      env: process.env
    });
    process.exit(result.status ?? 0);
  }
}

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// Ensure data folder exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'anime_ratings.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Custom Unicode / Cyrillic lowercase function for SQLite (supported in Node >= 22.13.0)
let hasLowerUtf8 = false;
try {
  if (typeof db.function === 'function') {
    db.function('lower_utf8', (str) => typeof str === 'string' ? str.toLowerCase() : '');
    hasLowerUtf8 = true;
    console.log('[Database] Custom lower_utf8 function registered successfully.');
  }
} catch (e) {
  console.log('[Database] Custom lower_utf8 function note:', e.message);
}

db.hasLowerUtf8 = hasLowerUtf8;
db.lowerSql = function (col) {
  return hasLowerUtf8 ? `lower_utf8(${col})` : `LOWER(${col})`;
};

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    avatar_url TEXT,
    banner_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS anime (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    original_title TEXT,
    image_url TEXT NOT NULL,
    type TEXT,
    year TEXT,
    genres TEXT NOT NULL DEFAULT '[]',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    anime_id INTEGER NOT NULL,
    score INTEGER NOT NULL CHECK(score >= 0 AND score <= 10),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(anime_id) REFERENCES anime(id) ON DELETE CASCADE,
    UNIQUE(user_id, anime_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    anime_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(anime_id) REFERENCES anime(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    anime_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(anime_id) REFERENCES anime(id) ON DELETE CASCADE,
    UNIQUE(user_id, anime_id)
  );

  CREATE TABLE IF NOT EXISTS comment_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('like', 'dislike')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(comment_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(from_user_id, to_user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_ratings_anime ON ratings(anime_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id);
  CREATE INDEX IF NOT EXISTS idx_anime_slug ON anime(slug);
  CREATE INDEX IF NOT EXISTS idx_comments_anime ON comments(anime_id);
  CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
  CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
  CREATE INDEX IF NOT EXISTS idx_favorites_anime ON favorites(anime_id);
  CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);
  CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON comment_reactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON friend_requests(from_user_id);
  CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id);
`);

// Migration for avatar_url and banner_url if table was created without them
try {
  const tableInfo = db.prepare('PRAGMA table_info(users)').all();
  const columnNames = tableInfo.map(c => c.name);
  if (!columnNames.includes('avatar_url')) {
    db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT;');
  }
  if (!columnNames.includes('banner_url')) {
    db.exec('ALTER TABLE users ADD COLUMN banner_url TEXT;');
  }

  const commentsInfo = db.prepare('PRAGMA table_info(comments)').all();
  const commentColNames = commentsInfo.map(c => c.name);
  if (!commentColNames.includes('parent_id')) {
    db.exec('ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL REFERENCES comments(id) ON DELETE CASCADE;');
  }
} catch (e) {
  console.log('Migration note:', e.message);
}

// Purge any test users and mock data (keep ONLY genuine users registered by the user)
try {
  // Delete mock or test users (e.g. НовыйНикОтаку, ОтакуКлуб, test emails, demo emails)
  db.exec(`
    DELETE FROM ratings WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%@test.com' OR email LIKE '%@example.com' OR nickname IN ('НовыйНикОтаку', 'ОтакуКлуб', 'ТестовыйДруг', 'Алексей', 'Мария', 'Дмитрий')
    );
    DELETE FROM comments WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%@test.com' OR email LIKE '%@example.com' OR nickname IN ('НовыйНикОтаку', 'ОтакуКлуб', 'ТестовыйДруг', 'Алексей', 'Мария', 'Дмитрий')
    );
    DELETE FROM users WHERE email LIKE '%@test.com' OR email LIKE '%@example.com' OR nickname IN ('НовыйНикОтаку', 'ОтакуКлуб', 'ТестовыйДруг', 'Алексей', 'Мария', 'Дмитрий');
  `);
  console.log('[Database] Purged test users. Only real user accounts remain.');
} catch (e) {
  console.error('Error purging test accounts:', e.message);
}

module.exports = db;
