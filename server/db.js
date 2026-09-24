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
    is_blocked INTEGER NOT NULL DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS user_top5 (
    user_id INTEGER NOT NULL,
    anime_id INTEGER NOT NULL,
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, anime_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(anime_id) REFERENCES anime(id) ON DELETE CASCADE
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

  CREATE TABLE IF NOT EXISTS custom_genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  if (!userColNames.includes('is_blocked')) {
    db.exec('ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0;');
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
  if (!animeColNames.includes('season')) {
    try {
      db.exec("ALTER TABLE anime ADD COLUMN season TEXT DEFAULT '';");
    } catch (e) {}
  }
  if (!animeColNames.includes('related_json')) {
    try {
      db.exec("ALTER TABLE anime ADD COLUMN related_json TEXT DEFAULT '[]';");
    } catch (e) {}
  }

  const top5Info = db.prepare('PRAGMA table_info(user_top5)').all();
  const top5ColNames = top5Info.map(c => c.name);
  if (!top5ColNames.includes('position')) {
    try {
      db.exec('ALTER TABLE user_top5 ADD COLUMN position INTEGER DEFAULT 0;');
    } catch (e) {}
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

    // 1. Restore customAnime FIRST so anime records exist for ratings, favorites, top5
    if (Array.isArray(data.customAnime)) {
      const insertAnimeStmt = db.prepare(`
        INSERT INTO anime (id, slug, title, title_lower, original_title, original_title_lower, image_url, type, year, genres, description, season, related_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          title_lower = excluded.title_lower,
          original_title = excluded.original_title,
          original_title_lower = excluded.original_title_lower,
          image_url = excluded.image_url,
          type = excluded.type,
          year = excluded.year,
          genres = excluded.genres,
          description = excluded.description,
          season = excluded.season,
          related_json = excluded.related_json,
          updated_at = excluded.updated_at
      `);
      for (const a of data.customAnime) {
        try {
          const tLower = normalizeSearchText(a.title);
          const oLower = normalizeSearchText(a.original_title || a.originalTitle || '');
          insertAnimeStmt.run(
            a.id,
            a.slug || `anime-${a.id}`,
            a.title,
            tLower,
            a.original_title || a.originalTitle || null,
            oLower || null,
            a.image_url || a.imageUrl || null,
            a.type || 'Сериал',
            a.year ? String(a.year) : null,
            typeof a.genres === 'string' ? a.genres : JSON.stringify(a.genres || []),
            a.description || '',
            a.season || '',
            typeof a.related_json === 'string' ? a.related_json : JSON.stringify(a.related_json || a.linkedAnime || []),
            a.created_at || new Date().toISOString(),
            a.updated_at || new Date().toISOString()
          );
        } catch (e) {}
      }
    }

    // 2. Restore customGenres
    if (Array.isArray(data.customGenres)) {
      const insertGenreStmt = db.prepare('INSERT OR IGNORE INTO custom_genres (name) VALUES (?)');
      for (const g of data.customGenres) {
        if (typeof g === 'string' && g.trim()) {
          try {
            insertGenreStmt.run(g.trim());
          } catch (e) {}
        }
      }
    }

    // 3. Restore users with strict protection of existing avatar, banner, and nickname
    if (Array.isArray(data.users)) {
      const insertUserStmt = db.prepare(`
        INSERT INTO users (id, email, nickname, password_hash, salt, avatar_url, banner_url, allow_password_set, is_blocked, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          avatar_url = COALESCE(users.avatar_url, excluded.avatar_url),
          banner_url = COALESCE(users.banner_url, excluded.banner_url),
          nickname = COALESCE(users.nickname, excluded.nickname),
          email = COALESCE(users.email, excluded.email),
          is_blocked = COALESCE(excluded.is_blocked, users.is_blocked, 0)
      `);
      for (const u of data.users) {
        try {
          const existingByEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(u.email.toLowerCase());
          if (existingByEmail) {
            db.prepare(`
              UPDATE users SET
                avatar_url = COALESCE(users.avatar_url, ?),
                banner_url = COALESCE(users.banner_url, ?),
                nickname = COALESCE(users.nickname, ?),
                is_blocked = COALESCE(users.is_blocked, ?)
              WHERE id = ?
            `).run(u.avatar_url || null, u.banner_url || null, u.nickname, u.is_blocked ? 1 : 0, existingByEmail.id);
          } else {
            insertUserStmt.run(
              u.id,
              u.email,
              u.nickname,
              u.password_hash || 'RESTORED_ACCOUNT',
              u.salt || 'RESTORED_SALT',
              u.avatar_url || null,
              u.banner_url || null,
              u.allow_password_set !== undefined ? u.allow_password_set : 0,
              u.is_blocked !== undefined ? u.is_blocked : 0,
              u.created_at || new Date().toISOString()
            );
          }
        } catch (e) {}
      }
      // Guarantee haitek user exists
      const haitekUser = db.prepare("SELECT id FROM users WHERE LOWER(nickname) = 'haitek' OR LOWER(email) = 'cik5921@gmail.com'").get();
      if (!haitekUser && Array.isArray(data.users)) {
        const hData = data.users.find(u => u.nickname?.toLowerCase() === 'haitek');
        if (hData) {
          try {
            db.prepare(`
              INSERT INTO users (id, email, nickname, password_hash, salt, avatar_url, banner_url, allow_password_set, is_blocked, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              hData.id || 24,
              hData.email || 'cik5921@gmail.com',
              hData.nickname || 'haitek',
              hData.password_hash || 'RESTORED_ACCOUNT',
              hData.salt || 'RESTORED_SALT',
              hData.avatar_url || null,
              hData.banner_url || null,
              0,
              0,
              hData.created_at || new Date().toISOString()
            );
          } catch (e) {
            console.error('[Database] Failed to insert haitek user explicitly:', e.message);
          }
        }
      }
    }

    // 4. Restore friend requests
    if (Array.isArray(data.friendRequests)) {
      const insertFriendStmt = db.prepare(`
        INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET
          status = excluded.status,
          updated_at = excluded.updated_at
      `);
      for (const f of data.friendRequests) {
        try {
          insertFriendStmt.run(f.id, f.from_user_id, f.to_user_id, f.status, f.created_at, f.updated_at);
        } catch (e) {}
      }
    }

    // 5. Restore ratings - IMPORTANT: Strictly DO NOT OVERWRITE or resurrect deleted/altered ratings for users who already have ratings!
    if (Array.isArray(data.ratings)) {
      const existingUserIdsWithRatings = new Set(
        db.prepare('SELECT DISTINCT user_id FROM ratings').all().map((r) => r.user_id)
      );

      const insertOrIgnoreRatingStmt = db.prepare(`
        INSERT OR IGNORE INTO ratings (id, user_id, anime_id, score, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const r of data.ratings) {
        try {
          let animeExists = db.prepare('SELECT id FROM anime WHERE id = ?').get(r.anime_id);
          if (!animeExists) {
            try {
              db.prepare('INSERT OR IGNORE INTO anime (id, slug, title, image_url) VALUES (?, ?, ?, ?)').run(
                r.anime_id,
                `anime-${r.anime_id}`,
                `Аниме #${r.anime_id}`,
                'https://placehold.co/300x450/1e293b/ffffff?text=Anime'
              );
              animeExists = true;
            } catch (e) {}
          }
          if (animeExists) {
            // Strictly insert ratings ONLY if this user has NO ratings in DB yet (fresh/empty DB cold start)
            // For user 5 (Just): preserve active ratings and never resurrect deleted/altered ratings
            // For club members (MrTech, haitek): insert missing ratings so their full lists are preserved
            if (r.user_id !== 5) {
              insertOrIgnoreRatingStmt.run(r.id, r.user_id, r.anime_id, r.score, r.created_at, r.updated_at);
            } else if (!existingUserIdsWithRatings.has(5)) {
              insertOrIgnoreRatingStmt.run(r.id, r.user_id, r.anime_id, r.score, r.created_at, r.updated_at);
            }
          }
        } catch (e) {}
      }
    }

    // 6. Restore favorites
    if (Array.isArray(data.favorites)) {
      const insertFavStmt = db.prepare(`
        INSERT OR IGNORE INTO favorites (id, user_id, anime_id, created_at)
        VALUES (?, ?, ?, ?)
      `);
      for (const fav of data.favorites) {
        try {
          insertFavStmt.run(fav.id, fav.user_id, fav.anime_id, fav.created_at || new Date().toISOString());
        } catch (e) {}
      }
    }

    // 7. Restore comment reactions
    if (Array.isArray(data.commentReactions)) {
      const insertReactStmt = db.prepare(`
        INSERT INTO comment_reactions (id, comment_id, user_id, type, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(comment_id, user_id) DO UPDATE SET
          type = excluded.type,
          created_at = excluded.created_at
      `);
      for (const cr of data.commentReactions) {
        try {
          insertReactStmt.run(cr.id, cr.comment_id, cr.user_id, cr.type, cr.created_at || new Date().toISOString());
        } catch (e) {}
      }
    }

    // 8. Restore comments
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

    // 9. Restore hidden anime preferences
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

    // 10. Restore user_top5
    if (Array.isArray(data.userTop5)) {
      const insertTop5Stmt = db.prepare(`
        INSERT OR REPLACE INTO user_top5 (user_id, anime_id, created_at, position)
        VALUES (?, ?, ?, ?)
      `);
      for (const t of data.userTop5) {
        try {
          insertTop5Stmt.run(t.user_id, t.anime_id, t.created_at || new Date().toISOString(), t.position ?? 0);
        } catch (e) {}
      }
    }

    console.log('[Database] Auto-restored custom anime, accounts, friendships, ratings, top5, and custom genres from accounts_backup.json.');
  } catch (err) {
    console.error('[Database] Failed to restore from accounts_backup.json:', err.message);
  }
}

// Helper to guarantee mutual friendship between all registered users
function ensureAllUsersFriends() {
  try {
    const users = db.prepare("SELECT id, nickname FROM users WHERE LOWER(nickname) != 'inspector'").all();
    if (users.length <= 1) return;

    const insertOrReplaceStmt = db.prepare(`
      INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
      VALUES (?, ?, 'accepted', datetime('now'), datetime('now'))
      ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET
        status = 'accepted',
        updated_at = datetime('now')
    `);

    for (let i = 0; i < users.length; i++) {
      for (let j = 0; j < users.length; j++) {
        if (i !== j) {
          insertOrReplaceStmt.run(users[i].id, users[j].id);
        }
      }
    }

    // Seed and permanently preserve Just's top-5: [2646, 6080, 2346, 1807, 5779]
    const justUser = db.prepare("SELECT id FROM users WHERE nickname = 'Just' OR email = 'just9jeeet@gmail.com' OR id = 5").get();
    if (justUser) {
      const justTop5Ids = [2646, 6080, 2346, 1807, 5779];
      const currentJustTop5 = db.prepare('SELECT anime_id FROM user_top5 WHERE user_id = ? ORDER BY position ASC').all(justUser.id).map(r => r.anime_id);
      if (currentJustTop5.length < 5 || JSON.stringify(currentJustTop5) !== JSON.stringify(justTop5Ids)) {
        db.prepare('DELETE FROM user_top5 WHERE user_id = ?').run(justUser.id);
        const insTop5 = db.prepare('INSERT INTO user_top5 (user_id, anime_id, position, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)');
        justTop5Ids.forEach((id, idx) => {
          insTop5.run(justUser.id, id, idx + 1);
        });
      }

      // Ensure Just rating for 6970 is 7, and 5655 has NO rating
      db.prepare('DELETE FROM ratings WHERE user_id = ? AND anime_id = 5655').run(justUser.id);
      db.prepare(`
        INSERT INTO ratings (user_id, anime_id, score, updated_at)
        VALUES (?, 6970, 7, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, anime_id) DO UPDATE SET score = 7, updated_at = CURRENT_TIMESTAMP
      `).run(justUser.id);
    }

    // Clean description of Башня Бога (2346)
    try {
      const towerAnime = db.prepare('SELECT description FROM anime WHERE id = 2346').get();
      if (towerAnime && towerAnime.description && towerAnime.description.includes('data-read-more')) {
        const cleanDesc = towerAnime.description.replace(/^data-read-more[^>]*>\s*/i, '').replace(/<[^>]+>/g, '').trim();
        db.prepare('UPDATE anime SET description = ? WHERE id = 2346').run(cleanDesc);
      }
    } catch (e) {}

    console.log('[Database] Synchronized mutual friendships for all users.');
  } catch (err) {
    console.error('[Database] Failed to ensure all users friends:', err.message);
  }
}

restoreAccountsFromBackup();
ensureAllUsersFriends();

// Helper to snapshot current accounts state to accounts_backup.json
function saveAccountsBackup() {
  try {
    const backupFile = path.join(dataDir, 'accounts_backup.json');
    const permFile = path.join(dataDir, 'accounts_backup_permanent.json');
    const users = db.prepare('SELECT * FROM users').all();
    const ratings = db.prepare('SELECT * FROM ratings').all();
    const friendRequests = db.prepare('SELECT * FROM friend_requests').all();
    const comments = db.prepare('SELECT * FROM comments').all();
    const hiddenAnime = db.prepare('SELECT * FROM user_hidden_anime').all();
    const userTop5 = db.prepare('SELECT * FROM user_top5').all();

    // Include ALL non-default anime, or anime that have ratings/favorites/top5/comments, or explicit IDs
    const customAnime = db.prepare(`
      SELECT * FROM anime
      WHERE id > 3400
         OR slug LIKE 'shiki-%'
         OR slug LIKE 'animego-%'
         OR id IN (SELECT anime_id FROM ratings)
         OR id IN (SELECT anime_id FROM user_top5)
         OR id IN (SELECT anime_id FROM favorites)
         OR id IN (SELECT anime_id FROM comments)
         OR id IN (6573, 6584, 6585, 6586, 7195)
    `).all();

    let customGenres = [];
    try {
      customGenres = db.prepare('SELECT name FROM custom_genres').all().map((r) => r.name);
    } catch (e) {}
    let favorites = [];
    try {
      favorites = db.prepare('SELECT * FROM favorites').all();
    } catch (e) {}
    let commentReactions = [];
    try {
      commentReactions = db.prepare('SELECT * FROM comment_reactions').all();
    } catch (e) {}

    const snapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      users,
      ratings,
      friendRequests,
      comments,
      hiddenAnime,
      userTop5,
      customAnime,
      customGenres,
      favorites,
      commentReactions
    };

    const payload = JSON.stringify(snapshot, null, 2);

    // Atomically overwrite old saves
    if (fs.existsSync(backupFile)) {
      try { fs.unlinkSync(backupFile); } catch (e) {}
    }
    fs.writeFileSync(backupFile, payload, 'utf8');

    // Also update permanent redundant archive
    if (fs.existsSync(permFile)) {
      try { fs.unlinkSync(permFile); } catch (e) {}
    }
    fs.writeFileSync(permFile, payload, 'utf8');
  } catch (err) {
    console.error('[Database] Failed to snapshot accounts_backup.json:', err.message);
  }
}

db.saveAccountsBackup = saveAccountsBackup;

// Helper for Russian number words normalization
function normalizeNumberWords(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/девятьсот\s+девяносто\s+девят(?:ого|ый|ое|ом|ая|ь)/g, '999')
    .replace(/девять\s+тысяч\s+девятьсот\s+девяносто\s+девят(?:ого|ый|ое|ом|ая|ь)/g, '9999')
    .replace(/девять\s+тысяч\s+четв[её]рт(?:ого|ый|ое|ом|ая)/g, '9004')
    .replace(/триста/g, '300')
    .replace(/двести/g, '200')
    .replace(/сто/g, '100')
    .replace(/девяносто\s+девят(?:ого|ый|ое|ом|ая|ь)/g, '99')
    .replace(/перв(?:ый|ого|ое|ая|ом|ую)|1-?й/g, '1')
    .replace(/втор(?:ой|ого|ое|ая|ом|ую)|2-?й/g, '2')
    .replace(/трет(?:ий|ьего|ье|ья|ьем|ью)|3-?й/g, '3')
    .replace(/четв[её]рт(?:ый|ого|ое|ая|ом|ую)|4-?й/g, '4')
    .replace(/пят(?:ый|ого|ое|ая|ом|ую)|5-?й/g, '5')
    .replace(/шест(?:ой|ого|ое|ая|ом|ую)|6-?й/g, '6')
    .replace(/седьм(?:ой|ого|ое|ая|ом|ую)|7-?й/g, '7')
    .replace(/восьм(?:ой|ого|ое|ая|ом|ую)|8-?й/g, '8')
    .replace(/девят(?:ый|ого|ое|ая|ом|ую)|9-?й/g, '9')
    .replace(/десят(?:ый|ого|ое|ая|ом|ую)|10-?й/g, '10');
}

function getWordKey(title) {
  const norm = normalizeNumberWords(title)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const stop = new Set(['к', 'в', 'на', 'с', 'по', 'о', 'от', 'до', 'и', 'из', 'за', 'для', 'у', 'а', 'но', 'то']);
  const words = norm.split(' ').filter(w => w.length > 0 && !stop.has(w));
  words.sort();
  return words.join(' ');
}

function getOriginalTitles(orig) {
  if (!orig || orig === 'null') return [];
  return orig.split('/').map(p => {
    return p.toLowerCase().trim()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }).filter(p => p.length >= 4);
}

function extractSeasonNumber(title) {
  if (!title) return 1;
  const t = title.toLowerCase();
  const m = t.match(/(?:сезон|season|\bчасть|\bpart)\s*([0-9]+)/i);
  if (m) return parseInt(m[1], 10);
  const mEnd = t.match(/\s+([2-9]|10)\b(?!\s*уровн|\s*лет|\s*тысяч|\s*секунд)/);
  if (mEnd) return parseInt(mEnd[1], 10);
  return 1;
}

// Auto-deduplicate anime records on startup
function deduplicateAnimeDatabase() {
  try {
    // 1. Exact title_lower and year duplicates
    const duplicates = db.prepare(`
      SELECT title_lower as norm_title, year, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM anime
      WHERE title_lower IS NOT NULL AND title_lower != ''
      GROUP BY title_lower, year
      HAVING count > 1
    `).all();

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

    // 2. Number-word and canonical original_title duplicates (Bucketed Map for instant startup)
    const all = db.prepare('SELECT id, slug, title, original_title, year, type, image_url, genres, description FROM anime').all();
    const buckets = new Map();

    for (const a of all) {
      const aWordKey = getWordKey(a.title);
      if (aWordKey && aWordKey.length >= 8) {
        if (!buckets.has(aWordKey)) buckets.set(aWordKey, []);
        buckets.get(aWordKey).push(a);
      }
      const aOrigs = getOriginalTitles(a.original_title);
      for (const ao of aOrigs) {
        if (ao && ao.length >= 8) {
          const origKey = 'orig_' + ao;
          if (!buckets.has(origKey)) buckets.set(origKey, []);
          buckets.get(origKey).push(a);
        }
      }
    }

    const checkedPairs = new Set();

    for (const group of buckets.values()) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        const a = group[i];
        const aSeason = extractSeasonNumber(a.title);
        const aIsOva = /ova|спешл|спецвыпуск/i.test(a.title) || a.type === 'OVA' || a.type === 'Спешл';

        for (let j = i + 1; j < group.length; j++) {
          const b = group[j];
          if (a.id === b.id) continue;
          const pairKey = [a.id, b.id].sort().join('-');
          if (checkedPairs.has(pairKey)) continue;
          checkedPairs.add(pairKey);

          const yearMatch = !a.year || !b.year || a.year === b.year;
          if (!yearMatch) continue;

          const bIsOva = /ova|спешл|спецвыпуск/i.test(b.title) || b.type === 'OVA' || b.type === 'Спешл';
          if (aIsOva !== bIsOva) continue;

          const bSeason = extractSeasonNumber(b.title);
          if (aSeason !== bSeason) continue;

          const rA = db.prepare('SELECT count(*) as c FROM ratings WHERE anime_id = ?').get(a.id).c;
          const rB = db.prepare('SELECT count(*) as c FROM ratings WHERE anime_id = ?').get(b.id).c;

          let keeper = a;
          let dup = b;
          if (rB > rA) {
            keeper = b;
            dup = a;
          } else if (rA === rB) {
            const aIsAnimeGo = !a.slug.startsWith('shiki-');
            const bIsAnimeGo = !b.slug.startsWith('shiki-');
            if (!aIsAnimeGo && bIsAnimeGo) {
              keeper = b;
              dup = a;
            }
          }

          // Merge dup into keeper
          let bestTitle = keeper.title;
          if (/[0-9]/.test(dup.title) && !/[0-9]/.test(keeper.title)) {
            bestTitle = dup.title;
          }

          let keeperGenres = [];
          try { keeperGenres = JSON.parse(keeper.genres || '[]'); } catch (e) {}
          let dupGenres = [];
          try { dupGenres = JSON.parse(dup.genres || '[]'); } catch (e) {}
          for (const g of dupGenres) {
            if (!keeperGenres.includes(g)) keeperGenres.push(g);
          }

          let origTitle = keeper.original_title || '';
          if (dup.original_title) {
            const parts = dup.original_title.split('/').map(p => p.trim()).filter(Boolean);
            for (const p of parts) {
              if (!origTitle.toLowerCase().includes(p.toLowerCase())) {
                origTitle = origTitle ? `${origTitle} / ${p}` : p;
              }
            }
          }

          const keeperDesc = keeper.description || '';
          const dupDesc = dup.description || '';
          const bestDesc = (dupDesc.length > keeperDesc.length && dupDesc.length > 30) ? dupDesc : (keeperDesc || dupDesc);
          const bestYear = keeper.year || dup.year || '';
          const bestType = keeper.type || dup.type || 'Сериал';
          const bestImage = (!keeper.image_url || keeper.image_url.includes('placeholder')) ? dup.image_url : keeper.image_url;

          db.prepare(`UPDATE OR IGNORE ratings SET anime_id = ? WHERE anime_id = ?`).run(keeper.id, dup.id);
          db.prepare(`DELETE FROM ratings WHERE anime_id = ?`).run(dup.id);
          db.prepare(`UPDATE OR IGNORE favorites SET anime_id = ? WHERE anime_id = ?`).run(keeper.id, dup.id);
          db.prepare(`DELETE FROM favorites WHERE anime_id = ?`).run(dup.id);
          db.prepare(`UPDATE OR IGNORE user_hidden_anime SET anime_id = ? WHERE anime_id = ?`).run(keeper.id, dup.id);
          db.prepare(`DELETE FROM user_hidden_anime WHERE anime_id = ?`).run(dup.id);
          db.prepare(`UPDATE comments SET anime_id = ? WHERE anime_id = ?`).run(keeper.id, dup.id);
          db.prepare(`DELETE FROM anime WHERE id = ?`).run(dup.id);

          db.prepare(`
            UPDATE anime SET
              title = ?,
              title_lower = ?,
              original_title = ?,
              original_title_lower = ?,
              image_url = ?,
              type = ?,
              year = ?,
              genres = ?,
              description = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(bestTitle, normalizeSearchText(bestTitle), origTitle, normalizeSearchText(origTitle), bestImage, bestType, bestYear, JSON.stringify(keeperGenres), bestDesc, keeper.id);
        }
      }
    }
    console.log('[Database] Deduplication completed successfully.');
  } catch (err) {
    console.error('[Database] Deduplication error:', err.message);
  }
}

function areSameAnime(a, b) {
  if (!a || !b) return false;
  if (a.id === b.id) return true;

  const aYear = String(a.year || '').trim();
  const bYear = String(b.year || '').trim();
  if (aYear && bYear && Math.abs(parseInt(aYear, 10) - parseInt(bYear, 10)) > 1) {
    return false;
  }

  const aIsOva = /ova|спешл|спецвыпуск/i.test(a.title || '') || a.type === 'OVA' || a.type === 'Спешл';
  const bIsOva = /ova|спешл|спецвыпуск/i.test(b.title || '') || b.type === 'OVA' || b.type === 'Спешл';
  if (aIsOva !== bIsOva) return false;

  const aIsMovie = a.type === 'Фильм' || /\b(фильм|movie)\b/i.test(a.title || '');
  const bIsMovie = b.type === 'Фильм' || /\b(фильм|movie)\b/i.test(b.title || '');
  if (aIsMovie !== bIsMovie) return false;

  const aSeason = extractSeasonNumber(a.title);
  const bSeason = extractSeasonNumber(b.title);
  const aHasExplicitSeason = aSeason !== null;
  const bHasExplicitSeason = bSeason !== null;
  if (aHasExplicitSeason !== bHasExplicitSeason && ((aSeason || 1) > 1 || (bSeason || 1) > 1)) {
    return false;
  }
  if (aHasExplicitSeason && bHasExplicitSeason && aSeason !== bSeason) {
    return false;
  }

  const aNorm = normalizeSearchText(a.title);
  const bNorm = normalizeSearchText(b.title);
  if (aNorm && bNorm && aNorm === bNorm) return true;

  const aNumNorm = normalizeNumberWords(a.title);
  const bNumNorm = normalizeNumberWords(b.title);
  if (aNumNorm && bNumNorm && aNumNorm === bNumNorm) return true;

  const aKey = getWordKey(a.title);
  const bKey = getWordKey(b.title);
  if (aKey && bKey && aKey.length >= 8 && aKey === bKey) return true;

  const aOrigs = getOriginalTitles(a.original_title || a.originalTitle);
  const bOrigs = getOriginalTitles(b.original_title || b.originalTitle);
  if (aOrigs.length > 0 && bOrigs.length > 0) {
    for (const ao of aOrigs) {
      if (ao.length >= 8 && bOrigs.includes(ao)) {
        return true;
      }
    }
  }

  const aAllOrig = normalizeSearchText(a.original_title || a.originalTitle || '');
  const bAllOrig = normalizeSearchText(b.original_title || b.originalTitle || '');
  if (aNorm && aNorm.length >= 10 && (bAllOrig.includes(aNorm) || bNorm === aNorm)) return true;
  if (bNorm && bNorm.length >= 10 && (aAllOrig.includes(bNorm) || aNorm === bNorm)) return true;

  return false;
}

function deduplicateAnimeList(items) {
  if (!Array.isArray(items) || items.length <= 1) return items || [];
  const result = [];
  const mergedIds = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || mergedIds.has(item.id)) continue;

    let merged = { ...item };
    merged.aliasIds = Array.isArray(merged.aliasIds) ? [...merged.aliasIds] : [merged.id];
    let hasRating = merged.myScore !== null && merged.myScore !== undefined;

    for (let j = i + 1; j < items.length; j++) {
      const other = items[j];
      if (!other || mergedIds.has(other.id)) continue;

      if (areSameAnime(merged, other)) {
        mergedIds.add(other.id);
        merged.aliasIds.push(other.id);

        const otherHasRating = other.myScore !== null && other.myScore !== undefined;
        if (!hasRating && otherHasRating) {
          merged.myScore = other.myScore;
          hasRating = true;
        }

        if ((!merged.averageScore || merged.averageScore === 0) && other.averageScore) {
          merged.averageScore = other.averageScore;
          merged.ratingCount = other.ratingCount;
        } else if (other.ratingCount > (merged.ratingCount || 0)) {
          merged.averageScore = other.averageScore;
          merged.ratingCount = other.ratingCount;
        }

        if (/[0-9]/.test(other.title) && !/[0-9]/.test(merged.title)) {
          merged.title = other.title;
        }

        const g1 = Array.isArray(merged.genres) ? merged.genres : [];
        const g2 = Array.isArray(other.genres) ? other.genres : [];
        merged.genres = Array.from(new Set([...g1, ...g2]));

        const d1 = merged.description || '';
        const d2 = other.description || '';
        if (d2.length > d1.length && d2.length > 40) {
          merged.description = d2;
        }

        const o1 = merged.originalTitle || merged.original_title || '';
        const o2 = other.originalTitle || other.original_title || '';
        if (o2 && !o1.toLowerCase().includes(o2.toLowerCase().slice(0, 15))) {
          merged.originalTitle = o1 ? `${o1} / ${o2}` : o2;
          merged.original_title = merged.originalTitle;
        }

        const f1 = Array.isArray(merged.friendsRatings) ? merged.friendsRatings : [];
        const f2 = Array.isArray(other.friendsRatings) ? other.friendsRatings : [];
        const friendMap = new Map();
        [...f1, ...f2].forEach((f) => {
          if (f && f.userId && !friendMap.has(f.userId)) {
            friendMap.set(f.userId, f);
          }
        });
        merged.friendsRatings = Array.from(friendMap.values());

        if (!merged.season && other.season) {
          merged.season = other.season;
        }
        if ((!merged.linkedAnime || merged.linkedAnime.length === 0) && other.linkedAnime && other.linkedAnime.length > 0) {
          merged.linkedAnime = other.linkedAnime;
          merged.related_json = other.related_json;
        }

        merged.isFavorite = Boolean(merged.isFavorite || other.isFavorite);
        merged.isHidden = Boolean(merged.isHidden || other.isHidden);
      }
    }
    result.push(merged);
  }
  return result;
}

db.normalizeNumberWords = normalizeNumberWords;
db.getWordKey = getWordKey;
db.areSameAnime = areSameAnime;
db.deduplicateAnimeList = deduplicateAnimeList;
db.ensureAllUsersFriends = ensureAllUsersFriends;

deduplicateAnimeDatabase();

module.exports = db;
