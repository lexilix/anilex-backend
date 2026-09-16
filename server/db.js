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

// Custom Unicode / Cyrillic lowercase and ё/е normalization
function normalizeSearchText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[«»""''`]/g, '')
    .trim();
}

let hasLowerUtf8 = false;
try {
  if (typeof db.function === 'function') {
    db.function('lower_utf8', (str) => normalizeSearchText(str));
    hasLowerUtf8 = true;
    console.log('[Database] Custom lower_utf8 function registered successfully.');
  }
} catch (e) {
  console.log('[Database] Custom lower_utf8 function note:', e.message);
}

db.hasLowerUtf8 = hasLowerUtf8;
db.normalizeSearchText = normalizeSearchText;
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

  CREATE TABLE IF NOT EXISTS user_hidden_anime (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    anime_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(anime_id) REFERENCES anime(id) ON DELETE CASCADE,
    UNIQUE(user_id, anime_id)
  );

  CREATE INDEX IF NOT EXISTS idx_ratings_anime ON ratings(anime_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_hidden_anime_user ON user_hidden_anime(user_id);
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

  // Re-index all anime titles with normalizeSearchText (converting ё to е and stripping punctuation)
  const normSetting = db.prepare("SELECT value FROM app_settings WHERE key = 'search_normalized_v3'").get();
  if (!normSetting) {
    console.log('[Database] Re-indexing all anime titles with Unicode ё/е normalization...');
    const allRows = db.prepare('SELECT id, title, original_title FROM anime').all();
    const updateLowerStmt = db.prepare('UPDATE anime SET title_lower = ?, original_title_lower = ? WHERE id = ?');
    db.exec('BEGIN TRANSACTION;');
    for (const row of allRows) {
      const tl = normalizeSearchText(row.title);
      const otl = normalizeSearchText(row.original_title);
      updateLowerStmt.run(tl, otl, row.id);
    }
    db.exec('COMMIT;');
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('search_normalized_v3', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
    console.log(`[Database] Normalized search index ready for ${allRows.length} anime titles.`);
  } else {
    // Backfill any newly added rows missing title_lower
    const unindexedRows = db.prepare("SELECT id, title, original_title FROM anime WHERE title_lower IS NULL OR title_lower = ''").all();
    if (unindexedRows.length > 0) {
      const updateLowerStmt = db.prepare('UPDATE anime SET title_lower = ?, original_title_lower = ? WHERE id = ?');
      db.exec('BEGIN TRANSACTION;');
      for (const row of unindexedRows) {
        const tl = normalizeSearchText(row.title);
        const otl = normalizeSearchText(row.original_title);
        updateLowerStmt.run(tl, otl, row.id);
      }
      db.exec('COMMIT;');
    }
  }
} catch (e) {
  console.log('Migration note:', e.message);
}

// Auto-restore registered accounts, ratings, friendships, and comments from persistent backup
function restoreAccountsFromBackup() {
  let backupFile = path.join(dataDir, 'accounts_backup.json');
  if (!fs.existsSync(backupFile)) {
    backupFile = path.join(dataDir, 'accounts_backup_permanent.json');
  }
  if (!fs.existsSync(backupFile)) return;

  try {
    const raw = fs.readFileSync(backupFile, 'utf8');
    const data = JSON.parse(raw);

    // Restore users with strict protection of existing avatar, banner, and nickname
    if (Array.isArray(data.users)) {
      const insertUserStmt = db.prepare(`
        INSERT INTO users (id, email, nickname, password_hash, salt, avatar_url, banner_url, allow_password_set, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          avatar_url = COALESCE(users.avatar_url, excluded.avatar_url),
          banner_url = COALESCE(users.banner_url, excluded.banner_url),
          nickname = COALESCE(users.nickname, excluded.nickname),
          email = COALESCE(users.email, excluded.email)
      `);
      for (const u of data.users) {
        try {
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
        } catch (e) {}
      }
    }

    // Restore friend requests
    if (Array.isArray(data.friendRequests)) {
      const insertFriendStmt = db.prepare(`
        INSERT OR IGNORE INTO friend_requests (id, from_user_id, to_user_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const f of data.friendRequests) {
        try {
          insertFriendStmt.run(f.id, f.from_user_id, f.to_user_id, f.status, f.created_at, f.updated_at);
        } catch (e) {}
      }
    }

    // Restore ratings
    if (Array.isArray(data.ratings)) {
      const insertRatingStmt = db.prepare(`
        INSERT OR IGNORE INTO ratings (id, user_id, anime_id, score, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const r of data.ratings) {
        try {
          const animeExists = db.prepare('SELECT id FROM anime WHERE id = ?').get(r.anime_id);
          if (!animeExists) {
            db.prepare(`
              INSERT OR IGNORE INTO anime (id, slug, title, title_lower, image_url, type, description, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
              r.anime_id,
              `restored-anime-${r.anime_id}`,
              `Аниме #${r.anime_id}`,
              `аниме #${r.anime_id}`,
              'https://placehold.co/300x450/1e293b/ffffff?text=Anime',
              'Сериал',
              'Восстановленное аниме'
            );
          }
          insertRatingStmt.run(r.id, r.user_id, r.anime_id, r.score, r.created_at, r.updated_at);
        } catch (e) {}
      }
    }

    // Restore comments
    if (Array.isArray(data.comments)) {
      const insertCommentStmt = db.prepare(`
        INSERT OR IGNORE INTO comments (id, anime_id, user_id, content, parent_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const c of data.comments) {
        try {
          insertCommentStmt.run(c.id, c.anime_id, c.user_id, c.content, c.parent_id || null, c.created_at);
        } catch (e) {}
      }
    }

    // Restore hidden anime preferences
    if (Array.isArray(data.hiddenAnime)) {
      const insertHiddenStmt = db.prepare(`
        INSERT OR IGNORE INTO user_hidden_anime (id, user_id, anime_id, created_at)
        VALUES (?, ?, ?, ?)
      `);
      for (const h of data.hiddenAnime) {
        try {
          insertHiddenStmt.run(h.id, h.user_id, h.anime_id, h.created_at || new Date().toISOString());
        } catch (e) {}
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
    const hiddenAnime = db.prepare('SELECT * FROM user_hidden_anime').all();

    const snapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      users,
      ratings,
      friendRequests,
      comments,
      hiddenAnime
    };

    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), 'utf8');

    // Also update permanent redundant archive
    const permFile = path.join(dataDir, 'accounts_backup_permanent.json');
    fs.writeFileSync(permFile, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (err) {
    console.error('[Database] Failed to snapshot accounts_backup.json:', err.message);
  }
}

db.saveAccountsBackup = saveAccountsBackup;

// Auto-deduplicate anime records on startup
function deduplicateAnimeDatabase() {
  try {
    const duplicates = db.prepare(`
      SELECT title_lower as norm_title, year, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM anime
      WHERE title_lower IS NOT NULL AND title_lower != ''
      GROUP BY title_lower, year
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

      let keeperOrig = keeper.original_title || '';
      let keeperDesc = keeper.description || '';

      for (const dup of toDelete) {
        let dupGenres = [];
        try { dupGenres = JSON.parse(dup.genres || '[]'); } catch (e) {}
        for (const g of dupGenres) {
          if (!keeperGenres.includes(g)) keeperGenres.push(g);
        }

        if (dup.original_title) {
          const parts = dup.original_title.split('/').map(p => p.trim()).filter(Boolean);
          for (const p of parts) {
            if (!keeperOrig.toLowerCase().includes(p.toLowerCase())) {
              keeperOrig = keeperOrig ? `${keeperOrig} / ${p}` : p;
            }
          }
        }

        if ((!keeperDesc || keeperDesc.length < 40) && dup.description && dup.description.length > keeperDesc.length) {
          keeperDesc = dup.description;
        }

        db.prepare(`UPDATE OR IGNORE ratings SET anime_id = ? WHERE anime_id = ?`).run(keeper.id, dup.id);
        db.prepare(`DELETE FROM ratings WHERE anime_id = ?`).run(dup.id);
        db.prepare(`UPDATE OR IGNORE favorites SET anime_id = ? WHERE anime_id = ?`).run(keeper.id, dup.id);
        db.prepare(`DELETE FROM favorites WHERE anime_id = ?`).run(dup.id);
        db.prepare(`UPDATE OR IGNORE user_hidden_anime SET anime_id = ? WHERE anime_id = ?`).run(keeper.id, dup.id);
        db.prepare(`DELETE FROM user_hidden_anime WHERE anime_id = ?`).run(dup.id);
        db.prepare(`UPDATE comments SET anime_id = ? WHERE anime_id = ?`).run(keeper.id, dup.id);
        db.prepare(`DELETE FROM anime WHERE id = ?`).run(dup.id);
      }

      db.prepare(`
        UPDATE anime SET
          genres = ?,
          original_title = ?,
          original_title_lower = ?,
          description = ?
        WHERE id = ?
      `).run(JSON.stringify(keeperGenres), keeperOrig, normalizeSearchText(keeperOrig), keeperDesc, keeper.id);
    }
    console.log('[Database] Deduplication completed successfully.');
  } catch (err) {
    console.error('[Database] Deduplication error:', err.message);
  }
}

deduplicateAnimeDatabase();

module.exports = db;
