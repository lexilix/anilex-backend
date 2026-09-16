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

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('friend_request', 'comment_reply')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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
  CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
  CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
`);

// Migrations for users and anime schema
try {
  const userTableInfo = db.prepare('PRAGMA table_info(users)').all();
  const userColNames = userTableInfo.map(c => c.name);
  if (!userColNames.includes('avatar_url')) {
    db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT;');
  }
  if (!userColNames.includes('banner_url')) {
    db.exec('ALTER TABLE users ADD COLUMN banner_url TEXT;');
  }
  if (!userColNames.includes('allow_password_set')) {
    db.exec('ALTER TABLE users ADD COLUMN allow_password_set INTEGER DEFAULT 0;');
  }

  const commentsInfo = db.prepare('PRAGMA table_info(comments)').all();
  const commentColNames = commentsInfo.map(c => c.name);
  if (!commentColNames.includes('parent_id')) {
    db.exec('ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL REFERENCES comments(id) ON DELETE CASCADE;');
  }

  // Anime table Unicode lower search columns
  const animeInfo = db.prepare('PRAGMA table_info(anime)').all();
  const animeColNames = animeInfo.map(c => c.name);
  if (!animeColNames.includes('title_lower')) {
    db.exec('ALTER TABLE anime ADD COLUMN title_lower TEXT;');
  }
  if (!animeColNames.includes('original_title_lower')) {
    db.exec('ALTER TABLE anime ADD COLUMN original_title_lower TEXT;');
  }

  // Create indexes for fast search
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_anime_title_lower ON anime(title_lower);
    CREATE INDEX IF NOT EXISTS idx_anime_orig_lower ON anime(original_title_lower);
  `);

  // Backfill any missing title_lower / original_title_lower using JavaScript toLowerCase()
  const unindexedRows = db.prepare('SELECT id, title, original_title FROM anime WHERE title_lower IS NULL OR title_lower = \'\'').all();
  if (unindexedRows.length > 0) {
    console.log(`[Database] Indexing ${unindexedRows.length} anime titles for instant Unicode search...`);
    const updateLowerStmt = db.prepare('UPDATE anime SET title_lower = ?, original_title_lower = ? WHERE id = ?');
    db.exec('BEGIN TRANSACTION;');
    for (const row of unindexedRows) {
      const tl = (row.title || '').trim().toLowerCase();
      const otl = (row.original_title || '').trim().toLowerCase();
      updateLowerStmt.run(tl, otl, row.id);
    }
    db.exec('COMMIT;');
    console.log('[Database] Anime search index ready.');
  }
} catch (e) {
  console.log('Migration note:', e.message);
}

// Auto-restore registered accounts, ratings, friendships, and comments from persistent backup
function restoreAccountsFromBackup() {
  const backupFile = path.join(dataDir, 'accounts_backup.json');
  if (!fs.existsSync(backupFile)) return;

  try {
    const raw = fs.readFileSync(backupFile, 'utf8');
    const data = JSON.parse(raw);

    // Restore users
    if (Array.isArray(data.users)) {
      const insertUserStmt = db.prepare(`
        INSERT OR IGNORE INTO users (id, email, nickname, password_hash, salt, avatar_url, banner_url, allow_password_set, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const u of data.users) {
        insertUserStmt.run(
          u.id,
          u.email,
          u.nickname,
          u.password_hash || 'RESTORED_ACCOUNT',
          u.salt || 'RESTORED_SALT',
          u.avatar_url || null,
          u.banner_url || null,
          u.allow_password_set !== undefined ? u.allow_password_set : 0,
          u.created_at || new Date().toISOString()
        );
      }
    }

    // Restore friend requests
    if (Array.isArray(data.friendRequests)) {
      const insertFriendStmt = db.prepare(`
        INSERT OR IGNORE INTO friend_requests (id, from_user_id, to_user_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const f of data.friendRequests) {
        insertFriendStmt.run(f.id, f.from_user_id, f.to_user_id, f.status, f.created_at, f.updated_at);
      }
    }

    // Restore ratings
    if (Array.isArray(data.ratings)) {
      const insertRatingStmt = db.prepare(`
        INSERT OR IGNORE INTO ratings (id, user_id, anime_id, score, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const r of data.ratings) {
        insertRatingStmt.run(r.id, r.user_id, r.anime_id, r.score, r.created_at, r.updated_at);
      }
    }

    // Restore comments
    if (Array.isArray(data.comments)) {
      const insertCommentStmt = db.prepare(`
        INSERT OR IGNORE INTO comments (id, anime_id, user_id, content, parent_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const c of data.comments) {
        insertCommentStmt.run(c.id, c.anime_id, c.user_id, c.content, c.parent_id || null, c.created_at);
      }
    }

    console.log('[Database] Auto-restored accounts, friendships, and ratings from accounts_backup.json.');
  } catch (err) {
    console.error('[Database] Failed to restore from accounts_backup.json:', err.message);
  }
}

restoreAccountsFromBackup();

// Helper to snapshot current accounts state to accounts_backup.json
function saveAccountsBackup() {
  try {
    const backupFile = path.join(dataDir, 'accounts_backup.json');
    const users = db.prepare('SELECT * FROM users').all();
    const ratings = db.prepare('SELECT * FROM ratings').all();
    const friendRequests = db.prepare('SELECT * FROM friend_requests').all();
    const comments = db.prepare('SELECT * FROM comments').all();

    const snapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      users,
      ratings,
      friendRequests,
      comments
    };

    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (err) {
    console.error('[Database] Failed to snapshot accounts_backup.json:', err.message);
  }
}

db.saveAccountsBackup = saveAccountsBackup;

// Auto-deduplicate anime records on startup
function deduplicateAnimeDatabase() {
  try {
    const duplicates = db.prepare(`
      SELECT LOWER(TRIM(title)) as norm_title, year, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM anime
      GROUP BY LOWER(TRIM(title)), year
      HAVING count > 1
    `).all();

    if (duplicates.length === 0) return;
    console.log(`[Database] Found ${duplicates.length} duplicate anime groups. Merging...`);

    for (const group of duplicates) {
      const idList = group.ids.split(',').map(Number);
      const records = db.prepare(`SELECT * FROM anime WHERE id IN (${idList.join(',')})`).all();
      if (records.length < 2) continue;

      records.sort((a, b) => {
        const aIsAnimeGo = !a.slug.startsWith('shiki-');
        const bIsAnimeGo = !b.slug.startsWith('shiki-');
        if (aIsAnimeGo && !bIsAnimeGo) return -1;
        if (!aIsAnimeGo && bIsAnimeGo) return 1;
        const aDesc = (a.description || '').length;
        const bDesc = (b.description || '').length;
        if (aDesc !== bDesc) return bDesc - aDesc;
        return a.id - b.id;
      });

      const keeper = records[0];
      const toDelete = records.slice(1);

      let keeperGenres = [];
      try { keeperGenres = JSON.parse(keeper.genres || '[]'); } catch (e) {}

      for (const dup of toDelete) {
        let dupGenres = [];
        try { dupGenres = JSON.parse(dup.genres || '[]'); } catch (e) {}
        for (const g of dupGenres) {
          if (!keeperGenres.includes(g)) keeperGenres.push(g);
        }

        db.prepare(`UPDATE OR IGNORE ratings SET anime_id = ? WHERE anime_id = ?`).run(keeper.id, dup.id);
        db.prepare(`DELETE FROM ratings WHERE anime_id = ?`).run(dup.id);
        db.prepare(`UPDATE OR IGNORE favorites SET anime_id = ? WHERE anime_id = ?`).run(keeper.id, dup.id);
        db.prepare(`DELETE FROM favorites WHERE anime_id = ?`).run(dup.id);
        db.prepare(`UPDATE comments SET anime_id = ? WHERE anime_id = ?`).run(keeper.id, dup.id);
        db.prepare(`DELETE FROM anime WHERE id = ?`).run(dup.id);
      }

      db.prepare(`UPDATE anime SET genres = ? WHERE id = ?`).run(JSON.stringify(keeperGenres), keeper.id);
    }
    console.log('[Database] Deduplication completed successfully.');
  } catch (err) {
    console.error('[Database] Deduplication error:', err.message);
  }
}

deduplicateAnimeDatabase();

module.exports = db;
