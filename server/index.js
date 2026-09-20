// Auto-respawn with --experimental-sqlite if missing (critical for Node 22.x on Render)
try {
  require('node:sqlite');
} catch (err) {
  if (err.code === 'ERR_UNKNOWN_BUILTIN_MODULE' && !process.execArgv.includes('--experimental-sqlite')) {
    console.log('[Server] Auto-relaunching with --experimental-sqlite flag...');
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(process.execPath, ['--experimental-sqlite', ...process.argv.slice(1)], {
      stdio: 'inherit',
      env: process.env
    });
    process.exit(result.status ?? 0);
  }
}

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const db = require('./db');
const {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  authMiddleware,
  optionalAuthMiddleware
} = require('./auth');
const {
  seedInitialData,
  syncFromAnimeGo,
  fetchNextAnimeGoPage,
  fetchOngoingAnime,
  searchAnimeGo,
  searchShikimori,
  scrapeAnimeGoPage,
  insertOrUpdateAnime
} = require('./scraper');
const {
  scrapeAnimeGoUserList,
  parseAnimeGoHtml,
  importUserRatings,
  findOrInsertAnime
} = require('./animego_importer');
const { scrapeShikimoriUserRates } = require('./shikimori_importer');
const { parseAnimeLibContent, scrapeAnimeLibUserList } = require('./animelib_importer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
// Allow up to 25mb for custom avatar and banner image uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health & Version check
app.get('/api/version', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.9',
    nodeVersion: process.version,
    hasLowerUtf8: Boolean(db.hasLowerUtf8)
  });
});

// ----------------------------------------------------
// IMAGE PROXY (Bypasses Referer & hotlink restrictions)
// ----------------------------------------------------
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('Image URL required');
  }

  try {
    const upstreamRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://animego.me/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send('Failed to fetch upstream image');
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

    const buffer = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Image proxy error:', err.message);
    return res.status(500).send('Proxy error');
  }
});

// ----------------------------------------------------
// AUTH & PROFILE ROUTES
// ----------------------------------------------------

// Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, nickname, password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Введите адрес почты' });
    }
    if (!nickname || !nickname.trim()) {
      return res.status(400).json({ error: 'Введите никнейм' });
    }
    if (!password || password.length < 3) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 3 символа' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanNick = nickname.trim();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'Пользователь с такой почтой уже зарегистрирован' });
    }

    const { hash, salt } = hashPassword(password);
    const stmt = db.prepare(`
      INSERT INTO users (email, nickname, password_hash, salt)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(cleanEmail, cleanNick, hash, salt);

    const user = {
      id: Number(result.lastInsertRowid),
      email: cleanEmail,
      nickname: cleanNick,
      avatarUrl: null,
      bannerUrl: null
    };

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    const token = generateToken(user);
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Введите почту и пароль' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!user) {
      return res.status(400).json({ error: 'Пользователь с такой почтой не найден' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован администратором' });
    }

    let isValid = false;
    if (user.allow_password_set === 1 || user.password_hash === 'RESTORED_ACCOUNT') {
      // First login on restored account automatically sets the password
      const { hash, salt } = hashPassword(password);
      db.prepare('UPDATE users SET password_hash = ?, salt = ?, allow_password_set = 0 WHERE id = ?').run(hash, salt, user.id);
      isValid = true;
      if (typeof db.saveAccountsBackup === 'function') {
        db.saveAccountsBackup();
      }
    } else {
      isValid = verifyPassword(password, user.password_hash, user.salt);
    }

    if (!isValid) {
      return res.status(400).json({ error: 'Неверный пароль' });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatar_url || null,
      bannerUrl: user.banner_url || null
    };

    const token = generateToken(safeUser);
    return res.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// Current User Profile
app.get('/api/auth/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, nickname, avatar_url, banner_url, is_blocked, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован администратором' });
    }

    const stats = db.prepare(`
      SELECT COUNT(id) as rated_count, ROUND(AVG(score), 1) as avg_score
      FROM ratings WHERE user_id = ?
    `).get(req.user.id);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatar_url || null,
        bannerUrl: user.banner_url || null,
        createdAt: user.created_at,
        ratedCount: stats.rated_count || 0,
        avgScore: stats.avg_score !== null ? Number(stats.avg_score) : null
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка проверки профиля' });
  }
});

// Update Profile (Nickname, Email, Password, Avatar, Banner)
app.put('/api/auth/profile', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { nickname, email, currentPassword, newPassword, avatarUrl, bannerUrl } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    let updatedNickname = user.nickname;
    let updatedEmail = user.email;
    let updatedAvatar = avatarUrl !== undefined ? avatarUrl : user.avatar_url;
    let updatedBanner = bannerUrl !== undefined ? bannerUrl : user.banner_url;

    if (nickname && nickname.trim()) {
      updatedNickname = nickname.trim();
    }

    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== user.email) {
        const checkExisting = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(cleanEmail, userId);
        if (checkExisting) {
          return res.status(400).json({ error: 'Пользователь с такой почтой уже существует' });
        }
        updatedEmail = cleanEmail;
      }
    }

    if (newPassword && newPassword.trim()) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Для смены пароля введите текущий пароль' });
      }
      const isValid = verifyPassword(currentPassword, user.password_hash, user.salt);
      if (!isValid) {
        return res.status(400).json({ error: 'Текущий пароль указан неверно' });
      }
      if (newPassword.trim().length < 3) {
        return res.status(400).json({ error: 'Новый пароль должен содержать от 3 символов' });
      }

      const { hash, salt } = hashPassword(newPassword.trim());
      db.prepare(`
        UPDATE users
        SET nickname = ?, email = ?, password_hash = ?, salt = ?, avatar_url = ?, banner_url = ?
        WHERE id = ?
      `).run(updatedNickname, updatedEmail, hash, salt, updatedAvatar, updatedBanner, userId);
    } else {
      db.prepare(`
        UPDATE users
        SET nickname = ?, email = ?, avatar_url = ?, banner_url = ?
        WHERE id = ?
      `).run(updatedNickname, updatedEmail, updatedAvatar, updatedBanner, userId);
    }

    const updatedUser = {
      id: userId,
      email: updatedEmail,
      nickname: updatedNickname,
      avatarUrl: updatedAvatar,
      bannerUrl: updatedBanner
    };

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    const token = generateToken(updatedUser);
    return res.json({ user: updatedUser, token });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// Multi-platform import ratings (Shikimori, AnimeLib, AnimeGO, raw text/HTML)
app.post('/api/user/import', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform = 'shikimori', input, rawContent } = req.body;

    let items = [];

    if (platform === 'shikimori') {
      if (!input || typeof input !== 'string' || !input.trim()) {
        return res.status(400).json({ error: 'Укажите никнейм или ссылку на профиль Shikimori' });
      }
      items = await scrapeShikimoriUserRates(input.trim());
    } else if (platform === 'animelib') {
      if (rawContent && typeof rawContent === 'string' && rawContent.trim()) {
        items = parseAnimeLibContent(rawContent);
      } else if (input && typeof input === 'string' && input.trim()) {
        items = await scrapeAnimeLibUserList(input.trim());
      } else {
        return res.status(400).json({ error: 'Укажите ссылку на профиль AnimeLib или вставьте HTML/список' });
      }
    } else if (platform === 'animego') {
      if (rawContent && typeof rawContent === 'string' && rawContent.trim()) {
        items = parseAnimeGoHtml(rawContent);
      } else if (input && typeof input === 'string' && input.trim()) {
        items = await scrapeAnimeGoUserList(input.trim());
      } else {
        return res.status(400).json({ error: 'Укажите ссылку/ID профиля AnimeGO или вставьте HTML страницы' });
      }
    } else if (platform === 'raw') {
      if (!rawContent || typeof rawContent !== 'string' || !rawContent.trim()) {
        return res.status(400).json({ error: 'Вставьте список аниме или JSON' });
      }
      items = parseAnimeLibContent(rawContent);
      if (items.length === 0) {
        items = parseAnimeGoHtml(rawContent);
      }
    } else {
      return res.status(400).json({ error: 'Неизвестная платформа для импорта' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Не удалось найти оценки аниме в указанном источнике' });
    }

    const result = importUserRatings(userId, items);

    // Fetch updated stats
    const stats = db.prepare(`
      SELECT COUNT(id) as rated_count, ROUND(AVG(score), 1) as avg_score
      FROM ratings WHERE user_id = ?
    `).get(userId);

    return res.json({
      success: true,
      platform,
      result,
      stats: {
        ratedCount: stats.rated_count || 0,
        avgScore: stats.avg_score !== null ? Number(stats.avg_score) : null
      }
    });
  } catch (err) {
    console.error('Import ratings error:', err);
    return res.status(500).json({ error: err.message || 'Ошибка импорта оценок' });
  }
});

// Import arbitrary list of anime items directly (creating missing anime in catalog and rating them)
app.post('/api/user/import-items', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items = [] } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Список аниме пуст' });
    }

    const result = importUserRatings(userId, items);

    // Fetch updated stats
    const stats = db.prepare(`
      SELECT COUNT(id) as rated_count, ROUND(AVG(score), 1) as avg_score
      FROM ratings WHERE user_id = ?
    `).get(userId);

    return res.json({
      success: true,
      result,
      stats: {
        ratedCount: stats.rated_count || 0,
        avgScore: stats.avg_score !== null ? Number(stats.avg_score) : null
      }
    });
  } catch (err) {
    console.error('Import items error:', err);
    return res.status(500).json({ error: err.message || 'Ошибка импорта тайтлов' });
  }
});

// Create/add single anime to catalog and rate for user
app.post('/api/anime/create', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { title, originalTitle, image, score, type = 'Сериал' } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Укажите название аниме' });
    }

    const item = {
      title: title.trim(),
      originalTitle: (originalTitle || '').trim(),
      image: (image || '').trim(),
      type,
      score: typeof score === 'number' ? score : 0
    };

    const anime = findOrInsertAnime(item);
    if (!anime) {
      return res.status(500).json({ error: 'Не удалось создать аниме' });
    }

    const numScore = (typeof score === 'number' && score >= 0 && score <= 10) ? score : null;
    if (numScore !== null) {
      db.prepare(`
        INSERT INTO ratings (user_id, anime_id, score, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, anime_id) DO UPDATE SET
          score = excluded.score,
          updated_at = CURRENT_TIMESTAMP
      `).run(userId, anime.id, numScore);
    }

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.json({
      success: true,
      anime: {
        id: anime.id,
        title: anime.title,
        slug: anime.slug,
        score: numScore
      }
    });
  } catch (err) {
    console.error('Create anime error:', err);
    return res.status(500).json({ error: err.message || 'Ошибка создания аниме' });
  }
});

// Import ratings from AnimeGO (via public user URL/ID or pasted HTML)
app.post('/api/user/import-animego', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { animegoUrlOrId, rawHtml } = req.body;

    let items = [];
    if (rawHtml && typeof rawHtml === 'string' && rawHtml.trim()) {
      items = parseAnimeGoHtml(rawHtml);
    } else if (animegoUrlOrId && typeof animegoUrlOrId === 'string' && animegoUrlOrId.trim()) {
      items = await scrapeAnimeGoUserList(animegoUrlOrId);
    } else {
      return res.status(400).json({ error: 'Укажите ссылку/ID профиля AnimeGO или вставьте HTML страницы' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Не удалось найти оценки аниме в указанном профиле или HTML' });
    }

    const result = importUserRatings(userId, items);

    // Fetch updated stats
    const stats = db.prepare(`
      SELECT COUNT(id) as rated_count, ROUND(AVG(score), 1) as avg_score
      FROM ratings WHERE user_id = ?
    `).get(userId);

    return res.json({
      success: true,
      result,
      stats: {
        ratedCount: stats.rated_count || 0,
        avgScore: stats.avg_score !== null ? Number(stats.avg_score) : null
      }
    });
  } catch (err) {
    console.error('Import AnimeGO error:', err);
    return res.status(500).json({ error: err.message || 'Ошибка импорта оценок с AnimeGO' });
  }
});

// Helper: Get list of confirmed friend IDs for a user
function getConfirmedFriendIds(userId) {
  if (!userId) return [];
  try {
    const rows = db.prepare(`
      SELECT (CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END) as friend_id
      FROM friend_requests
      WHERE (from_user_id = ? OR to_user_id = ?) AND status = 'accepted'
    `).all(userId, userId, userId);
    return rows.map(r => r.friend_id);
  } catch (err) {
    console.error('Error getting friend ids:', err);
    return [];
  }
}

// Helper: Create a persistent notification for a user
function createNotification(userId, type, title, message, data = {}) {
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, type, title, message, JSON.stringify(data));
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

// Search users by nickname (Strictly for authenticated users; strangers cannot see ratings)
app.get('/api/users/search', optionalAuthMiddleware, (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    if (!currentUserId) {
      return res.status(401).json({
        error: 'Для просмотра аккаунтов и поиска друзей необходимо войти в аккаунт',
        users: []
      });
    }

    const { q = '' } = req.query;
    const term = `%${q.trim().toLowerCase()}%`;
    const nickCol = db.lowerSql ? db.lowerSql('u.nickname') : 'LOWER(u.nickname)';

    const users = db.prepare(`
      SELECT u.id, u.nickname, u.avatar_url, u.banner_url,
             COUNT(r.id) as rated_count,
             ROUND(AVG(r.score), 1) as avg_score
      FROM users u
      LEFT JOIN ratings r ON u.id = r.user_id
      WHERE ${nickCol} LIKE ? AND LOWER(u.nickname) != 'inspector'
      GROUP BY u.id
      ORDER BY rated_count DESC, u.nickname ASC
      LIMIT 20
    `).all(term);

    // If logged in, fetch friendship relationships
    let friendMap = {};
    if (currentUserId && users.length > 0) {
      const userIds = users.map(u => u.id);
      const placeholders = userIds.map(() => '?').join(',');
      const relations = db.prepare(`
        SELECT id, from_user_id, to_user_id, status
        FROM friend_requests
        WHERE (from_user_id = ? AND to_user_id IN (${placeholders}))
           OR (to_user_id = ? AND from_user_id IN (${placeholders}))
      `).all(currentUserId, ...userIds, currentUserId, ...userIds);

      for (const rel of relations) {
        const otherId = rel.from_user_id === currentUserId ? rel.to_user_id : rel.from_user_id;
        if (rel.status === 'accepted') {
          friendMap[otherId] = { status: 'accepted', requestId: rel.id };
        } else if (rel.status === 'pending') {
          if (rel.from_user_id === currentUserId) {
            friendMap[otherId] = { status: 'pending_sent', requestId: rel.id };
          } else {
            friendMap[otherId] = { status: 'pending_received', requestId: rel.id };
          }
        }
      }
    }

    return res.json({
      users: users.map(u => {
        let friendshipStatus = 'none';
        let requestId = null;
        if (u.id === currentUserId) {
          friendshipStatus = 'self';
        } else if (friendMap[u.id]) {
          friendshipStatus = friendMap[u.id].status;
          requestId = friendMap[u.id].requestId;
        }

        // Ratings are visible ONLY to confirmed friends or the user themself
        const canSeeScore = (u.id === currentUserId || friendshipStatus === 'accepted');

        return {
          id: u.id,
          nickname: u.nickname,
          avatarUrl: u.avatar_url,
          bannerUrl: u.banner_url,
          ratedCount: u.rated_count || 0,
          avgScore: canSeeScore && u.avg_score !== null ? Number(u.avg_score) : null,
          friendshipStatus,
          requestId
        };
      })
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка поиска пользователей' });
  }
});

// Send friend request
app.post('/api/friends/request/:targetUserId', authMiddleware, (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = parseInt(req.params.targetUserId, 10);

    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Неверный ID пользователя' });
    }
    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'Нельзя отправить заявку в друзья самому себе' });
    }

    const targetUser = db.prepare('SELECT id, nickname FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Check existing relation in either direction
    const existingDirect = db.prepare('SELECT id, status FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?').get(currentUserId, targetUserId);
    const existingReverse = db.prepare('SELECT id, status FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?').get(targetUserId, currentUserId);

    if (existingDirect) {
      if (existingDirect.status === 'accepted') {
        return res.json({ success: true, status: 'accepted', message: 'Вы уже друзья' });
      }
      if (existingDirect.status === 'pending') {
        return res.json({ success: true, status: 'pending_sent', message: 'Заявка уже отправлена' });
      }
      // If rejected, re-send
      db.prepare("UPDATE friend_requests SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(existingDirect.id);
      if (typeof db.saveAccountsBackup === 'function') {
        db.saveAccountsBackup();
      }
      return res.json({ success: true, status: 'pending_sent', requestId: existingDirect.id });
    }

    if (existingReverse) {
      if (existingReverse.status === 'accepted') {
        return res.json({ success: true, status: 'accepted', message: 'Вы уже друзья' });
      }
      if (existingReverse.status === 'pending') {
        // Automatically accept reverse request
        db.prepare("UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(existingReverse.id);
        if (typeof db.saveAccountsBackup === 'function') {
          db.saveAccountsBackup();
        }
        return res.json({ success: true, status: 'accepted', message: 'Заявка принята!' });
      }
    }

    const insertResult = db.prepare(`
      INSERT INTO friend_requests (from_user_id, to_user_id, status)
      VALUES (?, ?, 'pending')
    `).run(currentUserId, targetUserId);

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    const newRequestId = Number(insertResult.lastInsertRowid);
    const sender = db.prepare('SELECT id, nickname, avatar_url FROM users WHERE id = ?').get(currentUserId);
    createNotification(
      targetUserId,
      'friend_request',
      'Заявка в друзья',
      `${sender ? sender.nickname : 'Пользователь'} хочет добавить вас в друзья`,
      {
        fromUserId: currentUserId,
        fromNickname: sender ? sender.nickname : '',
        fromAvatar: sender ? sender.avatar_url : null,
        requestId: newRequestId
      }
    );

    return res.json({ success: true, status: 'pending_sent', requestId: newRequestId });
  } catch (err) {
    console.error('Send friend request error:', err);
    return res.status(500).json({ error: 'Ошибка отправки заявки в друзья' });
  }
});

// Respond to friend request (Accept / Reject)
app.post('/api/friends/respond/:requestId', authMiddleware, (req, res) => {
  try {
    const currentUserId = req.user.id;
    const requestId = parseInt(req.params.requestId, 10);
    const { action } = req.body; // 'accept' or 'reject'

    if (action !== 'accept' && action !== 'reject') {
      return res.status(400).json({ error: 'Неверное действие (accept или reject)' });
    }

    const request = db.prepare('SELECT id, from_user_id, to_user_id, status FROM friend_requests WHERE id = ? AND to_user_id = ?').get(requestId, currentUserId);
    if (!request) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    if (action === 'accept') {
      db.prepare("UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(requestId);
      if (typeof db.saveAccountsBackup === 'function') {
        db.saveAccountsBackup();
      }
      const responder = db.prepare('SELECT id, nickname, avatar_url FROM users WHERE id = ?').get(currentUserId);
      createNotification(
        request.from_user_id,
        'friend_accepted',
        'Заявка в друзья принята',
        `${responder ? responder.nickname : 'Пользователь'} принял(а) вашу заявку в друзья!`,
        {
          fromUserId: currentUserId,
          fromNickname: responder ? responder.nickname : '',
          fromAvatar: responder ? responder.avatar_url : null
        }
      );
      return res.json({ success: true, status: 'accepted', message: 'Заявка в друзья принята' });
    } else {
      // Upon rejection, delete or set to rejected so user can request again in future
      db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
      if (typeof db.saveAccountsBackup === 'function') {
        db.saveAccountsBackup();
      }
      return res.json({ success: true, status: 'rejected', message: 'Заявка отклонена' });
    }
  } catch (err) {
    console.error('Respond to friend request error:', err);
    return res.status(500).json({ error: 'Ошибка обработки заявки' });
  }
});

// Get incoming and outgoing friend requests
app.get('/api/friends/requests', authMiddleware, (req, res) => {
  try {
    const currentUserId = req.user.id;

    const incoming = db.prepare(`
      SELECT fr.id as request_id, fr.created_at, u.id as user_id, u.nickname, u.avatar_url,
             COUNT(r.id) as rated_count, ROUND(AVG(r.score), 1) as avg_score
      FROM friend_requests fr
      JOIN users u ON fr.from_user_id = u.id
      LEFT JOIN ratings r ON u.id = r.user_id
      WHERE fr.to_user_id = ? AND fr.status = 'pending'
      GROUP BY fr.id
      ORDER BY fr.created_at DESC
    `).all(currentUserId);

    const outgoing = db.prepare(`
      SELECT fr.id as request_id, fr.created_at, u.id as user_id, u.nickname, u.avatar_url
      FROM friend_requests fr
      JOIN users u ON fr.to_user_id = u.id
      WHERE fr.from_user_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `).all(currentUserId);

    return res.json({
      incoming: incoming.map(i => ({
        requestId: i.request_id,
        createdAt: i.created_at,
        user: {
          id: i.user_id,
          nickname: i.nickname,
          avatarUrl: i.avatar_url,
          ratedCount: i.rated_count || 0,
          avgScore: i.avg_score !== null ? Number(i.avg_score) : null
        }
      })),
      outgoing: outgoing.map(o => ({
        requestId: o.request_id,
        createdAt: o.created_at,
        user: {
          id: o.user_id,
          nickname: o.nickname,
          avatarUrl: o.avatar_url
        }
      }))
    });
  } catch (err) {
    console.error('Get friend requests error:', err);
    return res.status(500).json({ error: 'Ошибка получения заявок в друзья' });
  }
});

// Get list of accepted friends for the user
app.get('/api/friends/my', authMiddleware, (req, res) => {
  try {
    const currentUserId = req.user.id;

    const friends = db.prepare(`
      SELECT fr.id as friendship_id, fr.updated_at as accepted_at,
             u.id as user_id, u.nickname, u.avatar_url,
             COUNT(r.id) as rated_count, ROUND(AVG(r.score), 1) as avg_score
      FROM friend_requests fr
      JOIN users u ON (CASE WHEN fr.from_user_id = ? THEN fr.to_user_id ELSE fr.from_user_id END) = u.id
      LEFT JOIN ratings r ON u.id = r.user_id
      WHERE (fr.from_user_id = ? OR fr.to_user_id = ?) AND fr.status = 'accepted'
      GROUP BY u.id
      ORDER BY u.nickname ASC
    `).all(currentUserId, currentUserId, currentUserId);

    return res.json({
      friends: friends.map(f => ({
        friendshipId: f.friendship_id,
        acceptedAt: f.accepted_at,
        id: f.user_id,
        nickname: f.nickname,
        avatarUrl: f.avatar_url,
        ratedCount: f.rated_count || 0,
        avgScore: f.avg_score !== null ? Number(f.avg_score) : null
      }))
    });
  } catch (err) {
    console.error('Get my friends error:', err);
    return res.status(500).json({ error: 'Ошибка получения друзей' });
  }
});

// Friend public profile and their ratings (Ratings visible ONLY to confirmed friends)
app.get('/api/users/:id/profile', optionalAuthMiddleware, (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    if (!currentUserId) {
      return res.status(401).json({ error: 'Войдите в аккаунт, чтобы просматривать профили пользователей' });
    }

    const targetUserId = parseInt(req.params.id, 10);
    const user = db.prepare('SELECT id, nickname, avatar_url, banner_url, created_at FROM users WHERE id = ?').get(targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Check friendship
    let isFriend = false;
    let friendshipStatus = 'none';
    let requestId = null;

    const isDevAdmin = currentUserId === 5 || (req.user && (req.user.nickname === 'Just' || req.user.email === 'just9jeeet@gmail.com'));
    if (targetUserId === currentUserId || isDevAdmin) {
      isFriend = true;
      friendshipStatus = targetUserId === currentUserId ? 'self' : 'accepted';
    } else {
      const relation = db.prepare(`
        SELECT id, from_user_id, to_user_id, status
        FROM friend_requests
        WHERE (from_user_id = ? AND to_user_id = ?)
           OR (to_user_id = ? AND from_user_id = ?)
      `).get(currentUserId, targetUserId, currentUserId, targetUserId);

      if (relation) {
        if (relation.status === 'accepted') {
          isFriend = true;
          friendshipStatus = 'accepted';
        } else if (relation.status === 'pending') {
          friendshipStatus = relation.from_user_id === currentUserId ? 'pending_sent' : 'pending_received';
          requestId = relation.id;
        }
      }
    }

    // Compute stats (for MrTech, exclude secret title from public count so it stays unchanged)
    const isTargetMrTech = targetUserId === 20 || user.nickname === 'MrTech';
    const isTargetVenicek = targetUserId === 21 || user.nickname === 'Venicek';

    const stats = db.prepare(`
      SELECT COUNT(r.id) as rated_count, ROUND(AVG(r.score), 1) as avg_score
      FROM ratings r
      JOIN anime a ON r.anime_id = a.id
      WHERE r.user_id = ? ${isTargetMrTech ? "AND a.title != 'Лимонные девочки'" : ''}
    `).get(targetUserId);

    // Fetch user top 5 IDs
    const top5Rows = db.prepare('SELECT anime_id FROM user_top5 WHERE user_id = ? ORDER BY position ASC, created_at ASC').all(targetUserId);
    let top5Ids = top5Rows.map(r => r.anime_id);

    const lemonAnime = db.prepare("SELECT id, slug, title, image_url, type, year, genres FROM anime WHERE title = 'Лимонные девочки'").get();
    const lemonId = lemonAnime ? lemonAnime.id : 7170;

    if ((user.nickname === 'Just' || targetUserId === 5) && top5Ids.length === 0) {
      top5Ids = [3495, 1803, 1807, 2040, 2646];
    }
    if (isTargetMrTech && !top5Ids.includes(lemonId)) {
      top5Ids.unshift(lemonId);
    }
    if (isTargetVenicek) {
      top5Ids = top5Ids.filter(id => id !== lemonId);
    }

    // Always fetch full details for top-5 anime to return directly as top5Anime
    let top5Anime = [];
    if (top5Ids.length > 0) {
      const top5Placeholders = top5Ids.map(() => '?').join(',');
      const top5AnimeRows = db.prepare(`
        SELECT a.id, a.slug, a.title, a.image_url, a.type, a.year, a.genres,
               COALESCE(r.score, 10) as score
        FROM anime a
        LEFT JOIN ratings r ON r.anime_id = a.id AND r.user_id = ?
        WHERE a.id IN (${top5Placeholders}) ${isTargetVenicek ? "AND a.title != 'Лимонные девочки'" : ''}
      `).all(targetUserId, ...top5Ids);

      top5Anime = top5Ids.map(id => {
        const item = top5AnimeRows.find(r => r.id === id);
        if (!item) return null;
        const isLemon = isTargetMrTech && (item.title === 'Лимонные девочки' || item.id === lemonId);
        return {
          id: item.id,
          slug: item.slug,
          title: item.title,
          imageUrl: item.image_url,
          type: item.type,
          year: item.year,
          genres: JSON.parse(item.genres || '[]'),
          score: isLemon ? 10 : item.score,
          isPinned: true,
          isSecretTop: isLemon,
          isPermanentPin: isLemon
        };
      }).filter(Boolean);
    }

    // Ratings list is sent if isFriend is true, OR if target user has top-5 pinned items!
    let ratings = [];
    if (isFriend) {
      let orderClause = 'r.score DESC, r.updated_at DESC';
      if (isTargetMrTech) {
        orderClause = `(CASE WHEN a.title = 'Лимонные девочки' THEN 999 ELSE r.score END) DESC, r.updated_at DESC`;
      }

      ratings = db.prepare(`
        SELECT a.id, a.slug, a.title, a.image_url, a.type, a.year, a.genres, r.score, r.updated_at
        FROM ratings r
        JOIN anime a ON r.anime_id = a.id
        WHERE r.user_id = ? ${isTargetVenicek ? "AND a.title != 'Лимонные девочки'" : ''}
        ORDER BY ${orderClause}
      `).all(targetUserId);
    } else if (top5Ids.length > 0) {
      // Even if not friends yet, show Top-5 pinned items on public profile!
      const placeholders = top5Ids.map(() => '?').join(',');
      ratings = db.prepare(`
        SELECT a.id, a.slug, a.title, a.image_url, a.type, a.year, a.genres, r.score, r.updated_at
        FROM ratings r
        JOIN anime a ON r.anime_id = a.id
        WHERE r.user_id = ? AND a.id IN (${placeholders}) ${isTargetVenicek ? "AND a.title != 'Лимонные девочки'" : ''}
      `).all(targetUserId, ...top5Ids);
    }

    return res.json({
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        bannerUrl: user.banner_url,
        createdAt: user.created_at,
        ratedCount: stats ? (stats.rated_count || 0) : 0,
        avgScore: isFriend && stats && stats.avg_score !== null ? Number(stats.avg_score) : null,
        isFriend,
        friendshipStatus,
        requestId
      },
      top5Anime: top5Anime.slice(0, 5),
      ratings: (() => {
        let formatted = ratings.map(r => {
          const isLemon = isTargetMrTech && (r.title === 'Лимонные девочки' || r.id === lemonId);
          const isPinned = isLemon || top5Ids.includes(r.id);
          return {
            id: r.id,
            slug: r.slug,
            title: r.title,
            imageUrl: r.image_url,
            type: r.type,
            year: r.year,
            genres: JSON.parse(r.genres || '[]'),
            score: r.score,
            isSecretTop: isLemon,
            isPinned,
            isPermanentPin: isLemon,
            updatedAt: r.updated_at
          };
        });

        if (isTargetVenicek) {
          formatted = formatted.filter(r => r.title !== 'Лимонные девочки' && r.id !== lemonId);
        }

        if (isTargetMrTech && !formatted.some(r => r.title === 'Лимонные девочки' || r.id === lemonId)) {
          if (lemonAnime) {
            formatted.unshift({
              id: lemonAnime.id,
              slug: lemonAnime.slug,
              title: lemonAnime.title,
              imageUrl: lemonAnime.image_url,
              type: lemonAnime.type,
              year: lemonAnime.year,
              genres: JSON.parse(lemonAnime.genres || '[]'),
              score: 10,
              isSecretTop: true,
              isPinned: true,
              isPermanentPin: true,
              updatedAt: new Date().toISOString()
            });
          }
        }
        return formatted;
      })(),
      top5Ids: top5Ids.slice(0, 5),
      isRestricted: !isFriend,
      message: !isFriend ? 'Оценки пользователя доступны только взаимным друзьям' : null
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка загрузки профиля друга' });
  }
});

// List of all registered users (Friends Club / Community)
app.get('/api/friends', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.nickname, u.email, u.avatar_url, u.banner_url, u.is_blocked,
             COUNT(r.id) as rated_count,
             ROUND(AVG(r.score), 1) as avg_score
      FROM users u
      LEFT JOIN ratings r ON u.id = r.user_id
      WHERE LOWER(u.nickname) != 'inspector'
      GROUP BY u.id
      ORDER BY rated_count DESC, u.nickname ASC
    `).all();

    return res.json({
      friends: users.map(u => ({
        id: u.id,
        nickname: u.nickname,
        email: u.email,
        avatarUrl: u.avatar_url,
        bannerUrl: u.banner_url,
        isBlocked: Boolean(u.is_blocked),
        rated_count: u.rated_count || 0,
        avg_score: u.avg_score !== null ? Number(u.avg_score) : null
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка получения списка пользователей' });
  }
});

// ----------------------------------------------------
// GENRES & METADATA
// ----------------------------------------------------

app.get('/api/genres', (req, res) => {
  try {
    const rows = db.prepare('SELECT genres FROM anime').all();
    const counts = {};
    for (const row of rows) {
      try {
        const list = JSON.parse(row.genres || '[]');
        for (const g of list) {
          counts[g] = (counts[g] || 0) + 1;
        }
      } catch (e) {}
    }

    // Include custom replenished genres
    try {
      const customRows = db.prepare('SELECT name FROM custom_genres').all();
      for (const cr of customRows) {
        if (cr.name && counts[cr.name] === undefined) {
          counts[cr.name] = 0;
        }
      }
    } catch (e) {}

    const sortedGenres = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({ genres: sortedGenres });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка получения жанров' });
  }
});

// Endpoint to replenish/add new custom genres
app.post('/api/genres', (req, res) => {
  try {
    const { name, genres } = req.body;
    const toAdd = [];
    if (typeof name === 'string' && name.trim()) {
      toAdd.push(name.trim());
    }
    if (Array.isArray(genres)) {
      for (const g of genres) {
        if (typeof g === 'string' && g.trim()) {
          toAdd.push(g.trim());
        }
      }
    }

    if (toAdd.length === 0) {
      return res.status(400).json({ error: 'Укажите название жанра' });
    }

    const insertStmt = db.prepare('INSERT OR IGNORE INTO custom_genres (name) VALUES (?)');
    for (const g of toAdd) {
      insertStmt.run(g);
    }

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    // Re-query all genres with counts
    const rows = db.prepare('SELECT genres FROM anime').all();
    const counts = {};
    for (const row of rows) {
      try {
        const list = JSON.parse(row.genres || '[]');
        for (const g of list) {
          counts[g] = (counts[g] || 0) + 1;
        }
      } catch (e) {}
    }

    try {
      const customRows = db.prepare('SELECT name FROM custom_genres').all();
      for (const cr of customRows) {
        if (cr.name && counts[cr.name] === undefined) {
          counts[cr.name] = 0;
        }
      }
    } catch (e) {}

    const sortedGenres = Object.entries(counts)
      .map(([gName, count]) => ({ name: gName, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({ success: true, genres: sortedGenres });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка добавления жанра: ' + err.message });
  }
});

app.get('/api/types', (req, res) => {
  try {
    const types = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM anime
      WHERE type IS NOT NULL AND type != ''
      GROUP BY type
      ORDER BY count DESC
    `).all();
    return res.json({ types });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка получения типов' });
  }
});

// ----------------------------------------------------
// FEATURED CAROUSEL (TOP RATED & NEWEST)
// ----------------------------------------------------
app.get('/api/anime/featured', optionalAuthMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const { tab = 'top', limit = 15 } = req.query;
    const limitNum = Math.min(30, Math.max(5, parseInt(limit, 10) || 15));

    if (tab === 'newest') {
      // 15 live ongoings airing right now from AnimeGO /anime/status/ongoing
      const ongoingItems = await fetchOngoingAnime(limitNum);
      const formatted = [];

      for (const item of ongoingItems) {
        // Find in DB to get real ID and ratings
        const dbRow = db.prepare(`
          SELECT
            a.id,
            a.slug,
            a.title,
            a.original_title,
            a.image_url,
            a.type,
            a.year,
            a.genres,
            a.description,
            ROUND(AVG(r.score), 1) as avg_score,
            COUNT(r.id) as rating_count,
            (SELECT score FROM ratings WHERE anime_id = a.id AND user_id = ?) as my_score
          FROM anime a
          LEFT JOIN ratings r ON a.id = r.anime_id
          WHERE a.slug = ? OR LOWER(TRIM(a.title)) = LOWER(?)
          GROUP BY a.id
          LIMIT 1
        `).get(currentUserId || -1, item.slug, (item.title || '').trim());

        if (dbRow) {
          formatted.push({
            id: dbRow.id,
            slug: dbRow.slug,
            title: dbRow.title,
            originalTitle: dbRow.original_title,
            imageUrl: dbRow.image_url,
            type: dbRow.type,
            year: dbRow.year,
            genres: JSON.parse(dbRow.genres || '[]'),
            description: dbRow.description,
            myScore: dbRow.my_score !== null && dbRow.my_score !== undefined ? dbRow.my_score : null,
            averageScore: dbRow.rating_count > 0 && dbRow.avg_score !== null ? Number(dbRow.avg_score) : null,
            ratingCount: Number(dbRow.rating_count)
          });
        }
      }

      return res.json({ items: formatted.slice(0, 15) });
    }

    if (tab === 'my') {
      if (!currentUserId) {
        return res.json({ items: [] });
      }

      const items = db.prepare(`
        SELECT
          a.id,
          a.slug,
          a.title,
          a.original_title,
          a.image_url,
          a.type,
          a.year,
          a.genres,
          a.description,
          r.score as my_score,
          ROUND((SELECT AVG(score) FROM ratings WHERE anime_id = a.id), 1) as avg_score,
          (SELECT COUNT(id) FROM ratings WHERE anime_id = a.id) as rating_count
        FROM ratings r
        JOIN anime a ON r.anime_id = a.id
        WHERE r.user_id = ?
        ORDER BY r.score DESC, r.updated_at DESC
        LIMIT ?
      `).all(currentUserId, limitNum);

      const formatted = items.map(item => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        originalTitle: item.original_title,
        imageUrl: item.image_url,
        type: item.type,
        year: item.year,
        genres: JSON.parse(item.genres || '[]'),
        description: item.description,
        myScore: item.my_score,
        averageScore: item.rating_count > 0 && item.avg_score !== null ? Number(item.avg_score) : null,
        ratingCount: Number(item.rating_count)
      }));

      return res.json({ items: formatted });
    }

    // Top rated: strictly ONLY anime that have at least 1 user rating!
    const items = db.prepare(`
      SELECT
        a.id,
        a.slug,
        a.title,
        a.original_title,
        a.image_url,
        a.type,
        a.year,
        a.genres,
        a.description,
        ROUND(AVG(r.score), 1) as avg_score,
        COUNT(r.id) as rating_count,
        (
          SELECT score FROM ratings
          WHERE anime_id = a.id AND user_id = ?
        ) as my_score
      FROM anime a
      LEFT JOIN ratings r ON a.id = r.anime_id
      GROUP BY LOWER(TRIM(a.title)), a.year
      HAVING COUNT(r.id) > 0
      ORDER BY
        avg_score DESC,
        rating_count DESC,
        (CASE WHEN a.year IS NOT NULL AND a.year != '' THEN a.year ELSE '0000' END) DESC,
        a.id DESC
      LIMIT ?
    `).all(currentUserId || -1, Math.min(15, limitNum));

    const formatted = items.map(item => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      originalTitle: item.original_title,
      imageUrl: item.image_url,
      type: item.type,
      year: item.year,
      genres: JSON.parse(item.genres || '[]'),
      description: item.description,
      myScore: item.my_score !== null && item.my_score !== undefined ? item.my_score : null,
      averageScore: item.rating_count > 0 && item.avg_score !== null ? Number(item.avg_score) : null,
      ratingCount: Number(item.rating_count)
    }));

    return res.json({ items: formatted });
  } catch (err) {
    console.error('Featured anime error:', err);
    return res.status(500).json({ error: 'Ошибка получения рекомендаций' });
  }
});

// ----------------------------------------------------
// ANIME CATALOG & LIVE ANIMEGO INFINITE SCROLL
// ----------------------------------------------------

// Helper for Russian word stemming to match grammatical forms (e.g. "безработный" -> "безработн" -> matches "безработного")
function stemRussianWord(word) {
  if (!word) return '';
  const w = word.toLowerCase().replace(/ё/g, 'е').trim();
  if (w.length <= 3) return w;
  return w.replace(/(?:[ое]го|[ое]му|[ыи]ми|[ыи]х|[ыи]е|[ое]й|[ыи]м|[ая]я|[ую]ю|ом|ем|ах|ях|ам|ям|ов|ев|ей|ий|ый|ой|а|я|у|ю|е|о|ы|и|ь)$/i, '');
}

app.get('/api/anime', optionalAuthMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const {
      search,
      genres,
      type,
      year,
      filterStatus,
      sort = 'newest',
      page = 1,
      limit = 15
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const offset = (pageNum - 1) * limitNum;
    const params = [];
    let whereClauses = [];

    // Search
    let searchRankSql = '';
    let searchRankParams = [];
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      const normalize = db.normalizeSearchText || ((s) => (s || '').toLowerCase().trim());
      const normSearch = normalize(cleanSearch);

      const allWords = normSearch.split(/\s+/).filter(w => w.length > 0);
      const stopWords = new Set(['у', 'в', 'и', 'с', 'к', 'о', 'на', 'по', 'за', 'из', 'от', 'до', 'об', 'a', 'an', 'to', 'in', 'on', 'of', 'at', 'is', 'no', 'wa']);
      let meaningfulWords = allWords.filter(w => w.length > 2 && !stopWords.has(w));
      if (meaningfulWords.length === 0) {
        meaningfulWords = allWords.filter(w => w.length > 1);
        if (meaningfulWords.length === 0) {
          meaningfulWords = allWords;
        }
      }

      // Add WHERE condition: meaningful words or their stems must match in title_lower or original_title_lower!
      for (const w of meaningfulWords) {
        const stem = stemRussianWord(w);
        if (stem && stem.length >= 3 && stem !== w) {
          whereClauses.push('(a.title_lower LIKE ? OR a.original_title_lower LIKE ? OR a.title_lower LIKE ? OR a.original_title_lower LIKE ?)');
          params.push(`%${w}%`, `%${w}%`, `%${stem}%`, `%${stem}%`);
        } else {
          whereClauses.push('(a.title_lower LIKE ? OR a.original_title_lower LIKE ?)');
          params.push(`%${w}%`, `%${w}%`);
        }
      }

      // Relevance rank cases:
      let rankCases = [
        '(CASE WHEN a.title_lower = ? THEN 100 WHEN a.original_title_lower = ? THEN 80 ELSE 0 END)',
        '(CASE WHEN a.title_lower LIKE ? THEN 50 WHEN a.original_title_lower LIKE ? THEN 40 ELSE 0 END)',
        '(CASE WHEN a.title_lower LIKE ? THEN 30 WHEN a.original_title_lower LIKE ? THEN 20 ELSE 0 END)'
      ];
      searchRankParams.push(normSearch, normSearch, `${normSearch}%`, `${normSearch}%`, `%${normSearch}%`, `%${normSearch}%`);

      for (const w of meaningfulWords) {
        const stem = stemRussianWord(w);
        rankCases.push('(CASE WHEN a.title_lower LIKE ? THEN 15 WHEN a.original_title_lower LIKE ? THEN 8 ELSE 0 END)');
        searchRankParams.push(`%${w}%`, `%${w}%`);
        if (stem && stem.length >= 3 && stem !== w) {
          rankCases.push('(CASE WHEN a.title_lower LIKE ? THEN 10 WHEN a.original_title_lower LIKE ? THEN 5 ELSE 0 END)');
          searchRankParams.push(`%${stem}%`, `%${stem}%`);
        }
      }

      searchRankSql = `(${rankCases.join(' + ')}) DESC, `;
    }

    // Year filter
    if (year && year.trim() && year !== 'all') {
      whereClauses.push('a.year = ?');
      params.push(year.trim());
    }

    // Type filter
    if (type && type.trim() && type !== 'all') {
      whereClauses.push('a.type = ?');
      params.push(type.trim());
    }

    // Genres filter
    if (genres && genres.trim()) {
      const genreList = genres.split(',').map(g => g.trim()).filter(Boolean);
      for (const g of genreList) {
        whereClauses.push('a.genres LIKE ?');
        params.push(`%"${g}"%`);
      }
    }

    // Status filter or unrated sort (Photo 1)
    if (filterStatus === 'friends_rated') {
      whereClauses.push('(SELECT COUNT(*) FROM ratings WHERE anime_id = a.id) > 0');
    } else if (filterStatus === 'my_rated' && currentUserId) {
      whereClauses.push('(SELECT COUNT(*) FROM ratings WHERE anime_id = a.id AND user_id = ?) > 0');
      params.push(currentUserId);
    } else if ((filterStatus === 'my_unrated' || sort === 'unrated') && currentUserId) {
      whereClauses.push('(SELECT COUNT(*) FROM ratings WHERE anime_id = a.id AND user_id = ?) = 0');
      params.push(currentUserId);
    }

    // Exclude missing / 404 / placehold.co covers and promo commercial junk on general browse, but NEVER hide during search!
    if (!search || !search.trim()) {
      whereClauses.push("a.image_url IS NOT NULL AND a.image_url != '' AND a.image_url NOT LIKE '%missing_original%' AND a.image_url NOT LIKE '%404%' AND a.image_url NOT LIKE '%placeholder%' AND a.image_url NOT LIKE '%placehold.co%' AND a.title NOT LIKE '%сникерс%' AND a.original_title NOT LIKE '%snickers%'");
    } else {
      whereClauses.push("a.title NOT LIKE '%сникерс%' AND a.original_title NOT LIKE '%snickers%'");
    }

    // Exclude anime marked as 'not interested' (hidden) by current user on main catalog (Photo 1 & Photo 4)
    // When searching, keep them in results so they can be shown dimmed / marked as not interested
    if (currentUserId && (!search || search.trim().length === 0)) {
      whereClauses.push('(SELECT COUNT(*) FROM user_hidden_anime WHERE user_id = ? AND anime_id = a.id) = 0');
      params.push(currentUserId);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Recommendations logic
    let recommendedGenres = [];
    if (sort === 'recommendations' && currentUserId) {
      const topRatedAnime = db.prepare(`
        SELECT a.genres
        FROM ratings r
        JOIN anime a ON r.anime_id = a.id
        WHERE r.user_id = ? AND r.score >= 8
      `).all(currentUserId);

      const genreFreq = {};
      for (const row of topRatedAnime) {
        try {
          const list = JSON.parse(row.genres || '[]');
          for (const g of list) {
            genreFreq[g] = (genreFreq[g] || 0) + 1;
          }
        } catch (e) {}
      }

      recommendedGenres = Object.keys(genreFreq);
    }

    // ORDER BY
    let orderBySql = "ORDER BY (CASE WHEN a.year IS NOT NULL AND a.year != '' THEN a.year ELSE '0000' END) DESC, a.id DESC";
    if (sort === 'my_score_desc') {
      orderBySql = `
        ORDER BY
          (CASE WHEN my_score IS NOT NULL THEN my_score ELSE -1 END) DESC,
          (CASE WHEN avg_score IS NOT NULL THEN avg_score ELSE 0 END) DESC,
          (CASE WHEN a.year IS NOT NULL AND a.year != '' THEN a.year ELSE '0000' END) DESC,
          a.id DESC
      `;
    } else if (sort === 'year_desc') {
      orderBySql = "ORDER BY (CASE WHEN a.year IS NOT NULL AND a.year != '' THEN a.year ELSE '0000' END) DESC, a.id DESC";
    } else if (sort === 'year_asc') {
      orderBySql = "ORDER BY (CASE WHEN a.year IS NOT NULL AND a.year != '' THEN a.year ELSE '9999' END) ASC, a.id ASC";
    } else if (sort === 'rating') {
      orderBySql = `
        ORDER BY
          (CASE WHEN avg_score IS NOT NULL THEN 1 ELSE 0 END) DESC,
          avg_score DESC,
          rating_count DESC,
          a.id DESC
      `;
    } else if (sort === 'unrated') {
      orderBySql = `
        ORDER BY
          (CASE WHEN avg_score IS NOT NULL THEN 1 ELSE 0 END) DESC,
          avg_score DESC,
          rating_count DESC,
          (CASE WHEN a.year IS NOT NULL AND a.year != '' THEN a.year ELSE '0000' END) DESC,
          a.id DESC
      `;
    } else if (sort === 'recommendations') {
      if (recommendedGenres.length > 0) {
        const genreChecks = recommendedGenres
          .map(g => `(CASE WHEN a.genres LIKE '%"${g.replace(/'/g, "''")}"%' THEN 1 ELSE 0 END)`)
          .join(' + ');

        orderBySql = `
          ORDER BY
            (${genreChecks}) DESC,
            (CASE WHEN my_score IS NULL THEN 1 ELSE 0 END) DESC,
            RANDOM()
        `;
      } else {
        orderBySql = `
          ORDER BY
            (CASE WHEN avg_score IS NOT NULL THEN avg_score ELSE 5 END) DESC,
            RANDOM()
        `;
      }
    } else {
      orderBySql = "ORDER BY (CASE WHEN a.year IS NOT NULL AND a.year != '' THEN a.year ELSE '0000' END) DESC, a.id DESC";
    }

    if (searchRankSql) {
      orderBySql = `ORDER BY ${searchRankSql} ` + orderBySql.replace(/^ORDER BY\s+/i, '');
    }

    const querySql = `
      SELECT
        a.id,
        a.slug,
        a.title,
        a.original_title,
        a.image_url,
        a.type,
        a.year,
        a.genres,
        a.description,
        a.created_at,
        a.season,
        a.related_json,
        ROUND(AVG(r.score), 1) as avg_score,
        COUNT(r.id) as rating_count,
        (
          SELECT score FROM ratings
          WHERE anime_id = a.id AND user_id = ?
        ) as my_score,
        (
          SELECT COUNT(id) FROM favorites
          WHERE anime_id = a.id AND user_id = ?
        ) as is_favorite,
        (
          SELECT COUNT(id) FROM user_hidden_anime
          WHERE anime_id = a.id AND user_id = ?
        ) as is_hidden,
        (
          SELECT COUNT(id) FROM comments WHERE anime_id = a.id
        ) as comments_count
      FROM anime a
      LEFT JOIN ratings r ON a.id = r.anime_id
      ${whereSql}
      GROUP BY LOWER(TRIM(a.title)), a.year
      ${orderBySql}
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(DISTINCT (LOWER(TRIM(a.title)) || '_' || a.year)) as total
      FROM anime a
      ${whereSql}
    `;

    let items = db.prepare(querySql).all(currentUserId || -1, currentUserId || -1, currentUserId || -1, ...params, ...searchRankParams, limitNum, offset);
    let currentTotal = totalRow ? totalRow.total : items.length;

    // If searching and 0 results found in local database, fetch from AnimeGO / Shikimori reserve and save to backup
    if (search && search.trim() && items.length === 0) {
      const cleanSearch = search.trim();
      console.log(`[Search] No local results for "${cleanSearch}". Checking AnimeGO / Shikimori...`);
      try {
        let externalFound = await searchAnimeGo(cleanSearch);
        if (!externalFound || externalFound === 0) {
          externalFound = await searchShikimori(cleanSearch);
        }
        if (externalFound > 0) {
          if (typeof db.saveAccountsBackup === 'function') {
            db.saveAccountsBackup();
          }
          items = db.prepare(querySql).all(currentUserId || -1, currentUserId || -1, currentUserId || -1, ...params, ...searchRankParams, limitNum, offset);
          const totalAfter = db.prepare(countSql).get(...params);
          if (totalAfter) currentTotal = totalAfter.total;
        }
      } catch (err) {
        console.error('[Search] External search error:', err.message);
      }
    }

    const animeIds = items.map(it => it.id);
    let friendsMap = {};
    if (currentUserId && animeIds.length > 0) {
      const friendIds = getConfirmedFriendIds(currentUserId);
      if (friendIds.length > 0) {
        const friendPlaceholders = friendIds.map(() => '?').join(',');
        const animePlaceholders = animeIds.map(() => '?').join(',');
        const ratingsRows = db.prepare(`
          SELECT r.anime_id, r.score, r.updated_at, u.id as user_id, u.nickname
          FROM ratings r
          JOIN users u ON r.user_id = u.id
          WHERE r.anime_id IN (${animePlaceholders}) AND r.user_id IN (${friendPlaceholders})
          ORDER BY r.updated_at DESC
        `).all(...animeIds, ...friendIds);

        for (const row of ratingsRows) {
          if (!friendsMap[row.anime_id]) {
            friendsMap[row.anime_id] = [];
          }
          friendsMap[row.anime_id].push({
            userId: row.user_id,
            nickname: row.nickname,
            score: row.score,
            updatedAt: row.updated_at
          });
        }
      }
    }

    const isCatalogEndless = (!filterStatus || filterStatus === 'all') && !search && (!genres || genres.trim().length === 0) && (!type || type === 'all') && (!year || year === 'all');

    const seenTitles = new Set();
    const formattedItems = [];

    for (const item of items) {
      const key = `${(item.title || '').trim().toLowerCase()}_${item.year || ''}`;
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);

      formattedItems.push({
        id: item.id,
        slug: item.slug,
        title: item.title,
        originalTitle: item.original_title,
        imageUrl: item.image_url,
        type: item.type,
        year: item.year,
        genres: JSON.parse(item.genres || '[]'),
        description: item.description,
        season: item.season || '',
        linkedAnime: (() => {
          try {
            return JSON.parse(item.related_json || '[]');
          } catch (e) {
            return [];
          }
        })(),
        related_json: item.related_json || '[]',
        myScore: item.my_score !== null && item.my_score !== undefined ? item.my_score : null,
        isFavorite: Boolean(item.is_favorite),
        isHidden: Boolean(item.is_hidden),
        averageScore: item.rating_count > 0 && item.avg_score !== null ? Number(item.avg_score) : null,
        ratingCount: Number(item.rating_count),
        commentsCount: Number(item.comments_count || 0),
        friendsRatings: friendsMap[item.id] || []
      });
    }

    const dedupedItems = db.deduplicateAnimeList ? db.deduplicateAnimeList(formattedItems) : formattedItems;
    const countReduction = formattedItems.length - dedupedItems.length;
    const adjustedTotal = Math.max(dedupedItems.length, (currentTotal || 0) - Math.max(0, countReduction));

    return res.json({
      items: dedupedItems,
      total: adjustedTotal,
      page: pageNum,
      limit: limitNum,
      totalPages: isCatalogEndless ? Math.max(pageNum + 20, 500) : Math.ceil(adjustedTotal / limitNum),
      recommendationGenresCount: recommendedGenres.length
    });
  } catch (err) {
    console.error('Error fetching anime:', err);
    return res.status(500).json({ error: 'Ошибка получения каталога аниме' });
  }
});

// Single Anime
app.get('/api/anime/:id', optionalAuthMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const animeId = parseInt(req.params.id, 10);

    const anime = db.prepare('SELECT * FROM anime WHERE id = ?').get(animeId);
    if (!anime) {
      return res.status(404).json({ error: 'Аниме не найдено' });
    }

    let parsedGenres = [];
    try { parsedGenres = JSON.parse(anime.genres || '[]'); } catch (e) {}

    // On-the-fly auto-enrichment for anime missing genres or description (Primary: AnimeGO, Fallback: Shikimori)
    if (parsedGenres.length === 0 || !anime.description || anime.description === 'Описание отсутствует.' || anime.description.length < 20) {
      try {
        let fetchedDesc = '';
        let fetchedGenres = [];

        const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        // 1. Try AnimeGO by slug
        if (anime.slug && !anime.slug.startsWith('shiki-') && !anime.slug.startsWith('anime-') && !anime.slug.startsWith('restored-')) {
          try {
            const agRes = await fetch(`https://animego.me/anime/${anime.slug}`, {
              headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
              }
            });
            if (agRes.ok) {
              const html = await agRes.text();
              const descMatch = html.match(/<div[^>]*class="[^"]*\bdescription\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
              const genreMatches = [...html.matchAll(/href="\/anime\/genre\/([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(g => g[2].trim());
              if (descMatch) {
                fetchedDesc = descMatch[1]
                  .replace(/<[^>]+>/g, '')
                  .replace(/&quot;/g, '"')
                  .replace(/&amp;/g, '&')
                  .replace(/&#039;/g, "'")
                  .replace(/&nbsp;/g, ' ')
                  .replace(/&laquo;/g, '«')
                  .replace(/&raquo;/g, '»')
                  .replace(/^spoiler#click[^\n]*/i, '')
                  .replace(/Развернуть/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();
              }
              if (genreMatches.length > 0) fetchedGenres = genreMatches;
            }
          } catch (e) {}
        }

        // 2. Try AnimeGO by search
        if ((!fetchedDesc || fetchedGenres.length === 0) && anime.title) {
          try {
            const cleanSearch = anime.title.replace(/\s+(?:2-й|3-й|4-й)?\s*сезон.*$/i, '').trim();
            const sRes = await fetch(`https://animego.me/search/anime?q=${encodeURIComponent(cleanSearch)}`, {
              headers: { 'User-Agent': USER_AGENT }
            });
            if (sRes.ok) {
              const html = await sRes.text();
              const parts = html.split(/<div class="ani-grid__item\s[^"]*">/);
              if (parts.length > 1) {
                const linkMatch = parts[1].match(/href="\/anime\/([a-zA-Z0-9\-]+)"/);
                if (linkMatch && linkMatch[1]) {
                  const dRes = await fetch(`https://animego.me/anime/${linkMatch[1]}`, {
                    headers: { 'User-Agent': USER_AGENT }
                  });
                  if (dRes.ok) {
                    const dHtml = await dRes.text();
                    const descMatch = dHtml.match(/<div[^>]*class="[^"]*\bdescription\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
                    const genreMatches = [...dHtml.matchAll(/href="\/anime\/genre\/([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(g => g[2].trim());
                    if (descMatch && !fetchedDesc) {
                      fetchedDesc = descMatch[1]
                        .replace(/<[^>]+>/g, '')
                        .replace(/&quot;/g, '"')
                        .replace(/&amp;/g, '&')
                        .replace(/&#039;/g, "'")
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&laquo;/g, '«')
                        .replace(/&raquo;/g, '»')
                        .replace(/^spoiler#click[^\n]*/i, '')
                        .replace(/Развернуть/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    }
                    if (genreMatches.length > 0 && fetchedGenres.length === 0) fetchedGenres = genreMatches;
                  }
                }
              }
            }
          } catch (e) {}
        }

        // 3. Fallback: Shikimori API
        if (!fetchedDesc || fetchedGenres.length === 0) {
          let shikiDetails = null;
          if (anime.slug && anime.slug.startsWith('shiki-')) {
            const sRes = await fetch(`https://shikimori.one/api/animes/${anime.slug.replace('shiki-', '')}`, {
              headers: { 'User-Agent': USER_AGENT }
            });
            if (sRes.ok) shikiDetails = await sRes.json();
          }
          if (!shikiDetails) {
            const sRes = await fetch(`https://shikimori.one/api/animes?search=${encodeURIComponent(anime.title)}&limit=3`, {
              headers: { 'User-Agent': USER_AGENT }
            });
            if (sRes.ok) {
              const list = await sRes.json();
              if (Array.isArray(list) && list[0]) {
                const dRes = await fetch(`https://shikimori.one/api/animes/${list[0].id}`, {
                  headers: { 'User-Agent': USER_AGENT }
                });
                if (dRes.ok) shikiDetails = await dRes.json();
              }
            }
          }

          if (shikiDetails) {
            if (!fetchedDesc && shikiDetails.description) {
              fetchedDesc = shikiDetails.description.replace(/\[[^\]]+\]/g, '').trim();
            }
            if (fetchedGenres.length === 0 && Array.isArray(shikiDetails.genres) && shikiDetails.genres.length > 0) {
              fetchedGenres = shikiDetails.genres.map(g => g.russian || g.name).filter(Boolean);
            }
          }
        }

        let hasChanges = false;
        if (parsedGenres.length === 0 && fetchedGenres.length > 0) {
          parsedGenres = fetchedGenres;
          anime.genres = JSON.stringify(parsedGenres);
          hasChanges = true;
        }
        if ((!anime.description || anime.description.length < 20 || anime.description === 'Описание отсутствует.') && fetchedDesc) {
          anime.description = fetchedDesc;
          hasChanges = true;
        }

        if (hasChanges) {
          db.prepare('UPDATE anime SET genres = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(anime.genres, anime.description, anime.id);
        }
      } catch (e) {
        // Silently continue if external API is unreachable
      }
    }

    const stats = db.prepare(`
      SELECT ROUND(AVG(score), 1) as avg_score, COUNT(id) as rating_count
      FROM ratings WHERE anime_id = ?
    `).get(animeId);

    let myScore = null;
    let isFavorite = false;
    let isHidden = false;
    if (currentUserId) {
      const myRow = db.prepare('SELECT score FROM ratings WHERE anime_id = ? AND user_id = ?').get(animeId, currentUserId);
      if (myRow) myScore = myRow.score;

      const favRow = db.prepare('SELECT id FROM favorites WHERE anime_id = ? AND user_id = ?').get(animeId, currentUserId);
      if (favRow) isFavorite = true;

      const hiddenRow = db.prepare('SELECT id FROM user_hidden_anime WHERE anime_id = ? AND user_id = ?').get(animeId, currentUserId);
      if (hiddenRow) isHidden = true;
    }

    let friendsRatings = [];
    if (currentUserId) {
      const friendIds = getConfirmedFriendIds(currentUserId);
      if (friendIds.length > 0) {
        const friendPlaceholders = friendIds.map(() => '?').join(',');
        friendsRatings = db.prepare(`
          SELECT r.score, r.updated_at, u.id as user_id, u.nickname
          FROM ratings r
          JOIN users u ON r.user_id = u.id
          WHERE r.anime_id = ? AND r.user_id IN (${friendPlaceholders})
          ORDER BY r.updated_at DESC
        `).all(animeId, ...friendIds);
      }
    }

    return res.json({
      id: anime.id,
      slug: anime.slug,
      title: anime.title,
      originalTitle: anime.original_title,
      imageUrl: anime.image_url,
      type: anime.type,
      year: anime.year,
      genres: parsedGenres,
      description: anime.description,
      season: anime.season || '',
      linkedAnime: (() => {
        try {
          return JSON.parse(anime.related_json || '[]');
        } catch (e) {
          return [];
        }
      })(),
      related_json: anime.related_json || '[]',
      myScore,
      isFavorite,
      isHidden,
      averageScore: stats.rating_count > 0 && stats.avg_score !== null ? Number(stats.avg_score) : null,
      ratingCount: Number(stats.rating_count),
      friendsRatings: friendsRatings.map(r => ({
        userId: r.user_id,
        nickname: r.nickname,
        score: r.score,
        updatedAt: r.updated_at
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка загрузки тайтла' });
  }
});

// Helper to extract base franchise title
function extractFranchiseBase(title) {
  if (!title) return '';
  let clean = title.replace(/\u00A0/g, ' ').trim();
  const splitParts = clean.split(/\s*[-—–:!.]\s*/);
  if (splitParts[0] && splitParts[0].length >= 4) {
    clean = splitParts[0].trim();
  }
  clean = clean
    .replace(/\s+(?:[2-9]|10|II|III|IV|V|VI|VII|VIII|IX|X)\b/gi, '')
    .replace(/\s+(?:2-й|3-й|4-й|5-й|6-й|второй|третий|четвертый|пятый)\s+сезон\b/gi, '')
    .replace(/\s+сезон\s+[0-9]+\b/gi, '')
    .replace(/\s+Часть\s+[0-9]+\b/gi, '')
    .replace(/\s+Part\s+[0-9]+\b/gi, '')
    .replace(/\s+Фильм.*$/gi, '')
    .replace(/\s+Movie.*$/gi, '')
    .replace(/\s+OVA.*$/gi, '')
    .replace(/\s+Спешл.*$/gi, '')
    .replace(/[-—–!.:]+$/, '')
    .trim();
  return clean;
}

// Related continuations and seasons for an anime
app.get('/api/anime/:id/related', optionalAuthMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const animeId = parseInt(req.params.id, 10);
    if (isNaN(animeId)) {
      return res.status(400).json({ error: 'Неверный ID аниме' });
    }

    const target = db.prepare('SELECT id, slug, title, original_title, year, type, image_url, season, related_json FROM anime WHERE id = ?').get(animeId);
    if (!target) {
      return res.status(404).json({ error: 'Аниме не найдено' });
    }

    const resultsMap = new Map();
    const normalize = db.normalizeSearchText || ((s) => (s || '').toLowerCase().trim());

    // 1. Add target itself
    resultsMap.set(target.id, {
      id: target.id,
      slug: target.slug,
      title: target.title,
      originalTitle: target.original_title,
      year: target.year,
      type: target.type,
      imageUrl: target.image_url,
      relation: target.season || 'Текущий тайтл',
      isCurrent: true,
      myScore: null,
      averageScore: null,
      ratingCount: 0
    });

    // 2. Add explicitly linked anime from target's related_json
    if (target.related_json) {
      try {
        const linkedList = JSON.parse(target.related_json);
        if (Array.isArray(linkedList)) {
          for (const item of linkedList) {
            if (item && item.id && Number(item.id) !== target.id) {
              const fullItem = db.prepare('SELECT id, slug, title, original_title, year, type, image_url, season FROM anime WHERE id = ?').get(Number(item.id));
              resultsMap.set(Number(item.id), {
                id: Number(item.id),
                slug: fullItem ? fullItem.slug : `anime-${item.id}`,
                title: fullItem ? fullItem.title : (item.title || ''),
                originalTitle: fullItem ? fullItem.original_title : (item.originalTitle || ''),
                year: fullItem ? fullItem.year : (item.year || ''),
                type: fullItem ? fullItem.type : (item.type || 'Сериал'),
                imageUrl: fullItem ? fullItem.image_url : (item.imageUrl || ''),
                relation: item.relation || (fullItem && fullItem.season) || 'Связанная часть',
                isCurrent: false,
                myScore: null,
                averageScore: null,
                ratingCount: 0
              });
            }
          }
        }
      } catch (e) {}
    }

    // 3. Add any anime that has linked this target
    try {
      const referencingAnime = db.prepare(`
        SELECT id, slug, title, original_title, year, type, image_url, season, related_json
        FROM anime
        WHERE related_json LIKE ?
      `).all(`%"id":${animeId}%`);

      for (const ref of referencingAnime) {
        if (ref.id !== target.id && !resultsMap.has(ref.id)) {
          let relationTag = ref.season || 'Связанная часть';
          try {
            const parsed = JSON.parse(ref.related_json || '[]');
            const linkEntry = parsed.find((x) => Number(x.id) === animeId);
            if (linkEntry && linkEntry.relation) {
              // If referencing anime says this target is X, referencing anime might be its counterpart
              relationTag = ref.season || relationTag;
            }
          } catch (e) {}
          resultsMap.set(ref.id, {
            id: ref.id,
            slug: ref.slug,
            title: ref.title,
            originalTitle: ref.original_title,
            year: ref.year,
            type: ref.type,
            imageUrl: ref.image_url,
            relation: relationTag,
            isCurrent: false,
            myScore: null,
            averageScore: null,
            ratingCount: 0
          });
        }
      }
    } catch (e) {}

    const base = extractFranchiseBase(target.title);

    if (base && base.length >= 4) {
      const normBase = normalize(base);
      const candidates = db.prepare(`
        SELECT
          a.id,
          a.slug,
          a.title,
          a.original_title,
          a.year,
          a.type,
          a.image_url,
          a.season,
          ROUND(AVG(r.score), 1) as avg_score,
          COUNT(r.id) as rating_count,
          (SELECT score FROM ratings WHERE anime_id = a.id AND user_id = ?) as my_score
        FROM anime a
        LEFT JOIN ratings r ON a.id = r.anime_id
        WHERE a.title_lower LIKE ?
          AND a.image_url NOT LIKE '%placehold.co%'
          AND a.image_url NOT LIKE '%placeholder%'
          AND a.image_url NOT LIKE '%missing_original%'
          AND a.title NOT LIKE '%сникерс%'
          AND a.original_title NOT LIKE '%snickers%'
        GROUP BY a.id
      `).all(currentUserId || -1, `${normBase}%`);

      const escapedBase = normBase.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`^${escapedBase}(?:\\s*(?:[0-9]+|II|III|IV|V|VI|VII|VIII|IX|X|сезон|фильм|часть|ova|спешл|movie|final|код|тренировка|бесконечный|деревня|квартал|поезд)|:|$|\\s*[-—–!:.\\s]|\\.)`, 'i');

      for (const c of candidates) {
        const normCand = normalize(c.title);
        if (!regex.test(normCand)) continue;

        let relation = c.season || 'Связанная часть';
        const tLower = normCand;
        if (c.id === target.id) {
          relation = target.season || 'Текущий тайтл';
        } else if (c.season) {
          relation = c.season;
        } else if (/пролог|prologue/i.test(tLower)) {
          relation = 'Пролог / Спешл';
        } else if (/солнечный день|день девятый|памятный/i.test(tLower)) {
          relation = 'Спешл';
        } else if (/спешл|ova|ona|спецвыпуск/i.test(tLower) || c.type === 'OVA' || c.type === 'Спешл') {
          relation = 'Спешл / OVA';
        } else if (/фильм|movie/i.test(tLower) || c.type === 'Фильм') {
          relation = 'Фильм';
        } else if (/часть\s*2|part\s*2/i.test(tLower)) {
          relation = 'Часть 2';
        } else if (/часть\s*3|part\s*3/i.test(tLower)) {
          relation = 'Часть 3';
        } else if (/2-й сезон|\b2\b|\bii\b|второй сезон/i.test(tLower)) {
          relation = '2-й сезон';
        } else if (/3-й сезон|\b3\b|\biii\b|третий сезон/i.test(tLower)) {
          relation = '3-й сезон';
        } else if (/4-й сезон|\b4\b|\biv\b|финал/i.test(tLower)) {
          relation = '4-й сезон / Финал';
        } else if (/мини-аниме|спин-офф/i.test(tLower)) {
          relation = 'Мини-аниме / Спин-офф';
        } else if (!/[0-9]/.test(tLower)) {
          relation = '1-й сезон / Начало';
        }

        const existing = resultsMap.get(c.id);
        resultsMap.set(c.id, {
          id: c.id,
          slug: c.slug,
          title: c.title,
          originalTitle: c.original_title,
          year: c.year,
          type: c.type,
          imageUrl: c.image_url,
          relation: (existing && existing.relation !== 'Связанная часть') ? existing.relation : relation,
          isCurrent: c.id === target.id,
          myScore: c.my_score !== null && c.my_score !== undefined ? c.my_score : null,
          averageScore: c.rating_count > 0 && c.avg_score !== null ? Number(c.avg_score) : null,
          ratingCount: Number(c.rating_count)
        });
      }
    }

    // Convert map to sorted list
    const items = Array.from(resultsMap.values()).sort((a, b) => {
      const yrA = parseInt(a.year, 10) || 0;
      const yrB = parseInt(b.year, 10) || 0;
      if (yrA !== yrB) return yrA - yrB;
      return a.id - b.id;
    });

    return res.json({ items });
  } catch (err) {
    console.error('Error fetching related anime:', err);
    return res.status(500).json({ error: 'Ошибка загрузки связанных тайтлов' });
  }
});

// Similar anime feed by genres and description (Photo 1)
app.get('/api/anime/:id/similar', optionalAuthMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const animeId = parseInt(req.params.id, 10);
    if (isNaN(animeId)) {
      return res.status(400).json({ error: 'Неверный ID аниме' });
    }

    const target = db.prepare('SELECT id, slug, title, original_title, year, type, image_url, genres, description FROM anime WHERE id = ?').get(animeId);
    if (!target) {
      return res.status(404).json({ error: 'Аниме не найдено' });
    }

    let targetGenres = [];
    try {
      targetGenres = JSON.parse(target.genres || '[]');
    } catch (e) {
      targetGenres = [];
    }
    const targetGenreSet = new Set(targetGenres.map(g => (g || '').toLowerCase().trim()));

    // Significant keywords from title and description
    const stopWords = new Set([
      'аниме', 'сезон', 'серия', 'серии', 'фильм', 'история', 'жизнь', 'мир', 'время',
      'человек', 'однажды', 'теперь', 'когда', 'только', 'после', 'перед', 'через',
      'между', 'чтобы', 'будет', 'были', 'было', 'была', 'быть', 'всего', 'также',
      'очень', 'самый', 'своей', 'своего', 'своих', 'своем', 'может', 'могут',
      'этого', 'этом', 'этой', 'этих', 'который', 'которая', 'которое', 'которые',
      'anime', 'season', 'series', 'movie', 'story', 'world', 'with', 'from',
      'about', 'after', 'before', 'their', 'there', 'where', 'which', 'would', 'could'
    ]);

    const cleanKeywordsText = `${target.title} ${target.original_title || ''} ${target.description || ''}`
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ');

    const targetKeywords = Array.from(new Set(
      cleanKeywordsText
        .split(/\s+/)
        .filter(w => w.length >= 4 && !stopWords.has(w))
    )).slice(0, 30);

    // Exclude same franchise continuations (which appear in "Связанное и продолжения")
    const franchiseBase = extractFranchiseBase(target.title);
    const normBase = franchiseBase && franchiseBase.length >= 4 ? db.normalizeSearchText(franchiseBase) : null;

    // Load candidates with rating statistics
    const candidates = db.prepare(`
      SELECT
        a.id,
        a.slug,
        a.title,
        a.original_title,
        a.year,
        a.type,
        a.image_url,
        a.genres,
        a.description,
        ROUND(AVG(r.score), 1) as avg_score,
        COUNT(r.id) as rating_count,
        (SELECT score FROM ratings WHERE anime_id = a.id AND user_id = ?) as my_score
      FROM anime a
      LEFT JOIN ratings r ON a.id = r.anime_id
      WHERE a.id != ?
      GROUP BY a.id
    `).all(currentUserId || -1, animeId);

    const scored = [];
    const fallbackList = [];

    for (const c of candidates) {
      // Exclude same franchise titles
      if (normBase && db.normalizeSearchText(c.title).startsWith(normBase)) {
        continue;
      }

      let cGenres = [];
      try {
        cGenres = JSON.parse(c.genres || '[]');
      } catch (e) {
        cGenres = [];
      }

      const matchingGenres = cGenres.filter(g => targetGenreSet.has((g || '').toLowerCase().trim()));

      const cText = `${c.title} ${c.original_title || ''} ${c.description || ''}`.toLowerCase();
      let matchingKeywordsCount = 0;
      for (const kw of targetKeywords) {
        if (cText.includes(kw)) {
          matchingKeywordsCount++;
        }
      }

      const avgScore = c.rating_count > 0 && c.avg_score !== null ? Number(c.avg_score) : null;
      const ratingCount = Number(c.rating_count || 0);

      const itemData = {
        id: c.id,
        slug: c.slug,
        title: c.title,
        originalTitle: c.original_title,
        year: c.year,
        type: c.type,
        imageUrl: c.image_url,
        genres: cGenres,
        matchingGenres,
        averageScore: avgScore,
        ratingCount,
        myScore: c.my_score !== null && c.my_score !== undefined ? c.my_score : null
      };

      fallbackList.push({
        ...itemData,
        score: (avgScore || 5.0) * 10 + Math.min(ratingCount, 20)
      });

      // Calculate similarity score
      let simScore = 0;
      if (matchingGenres.length > 0) {
        simScore += matchingGenres.length * 25;
        if (targetGenreSet.size > 0 && matchingGenres.length === targetGenreSet.size) {
          simScore += 30; // Full genre match bonus
        }
      }
      if (matchingKeywordsCount > 0) {
        simScore += matchingKeywordsCount * 6;
      }
      if (c.type && target.type && c.type === target.type) {
        simScore += 3;
      }
      if (avgScore) {
        simScore += avgScore * 1.5;
      }
      if (ratingCount > 0) {
        simScore += Math.min(ratingCount, 15);
      }

      if (matchingGenres.length > 0 || matchingKeywordsCount > 0) {
        scored.push({
          ...itemData,
          similarityScore: Math.round(simScore)
        });
      }
    }

    scored.sort((a, b) => b.similarityScore - a.similarityScore);

    // Ensure we have at least 35 candidates so the carousel can rotate 5 items continuously
    if (scored.length < 35) {
      fallbackList.sort((a, b) => b.score - a.score);
      const existingIds = new Set(scored.map(x => x.id));
      for (const fb of fallbackList) {
        if (!existingIds.has(fb.id)) {
          existingIds.add(fb.id);
          scored.push({
            ...fb,
            similarityScore: Math.round(fb.score)
          });
          if (scored.length >= 35) break;
        }
      }
    }

    return res.json({ items: scored.slice(0, 40) });
  } catch (err) {
    console.error('Error fetching similar anime:', err);
    return res.status(500).json({ error: 'Ошибка загрузки похожих тайтлов' });
  }
});


// Register anime into database (e.g. from client external search)
app.post('/api/anime/register', (req, res) => {
  try {
    const { anime } = req.body;
    if (!anime || !anime.title) {
      return res.status(400).json({ error: 'Требуется объект anime с названием' });
    }

    const animeId = parseInt(anime.id, 10);
    const slug = anime.slug || (animeId ? `anime-${animeId}` : `anime-${Date.now()}`);
    const normalize = db.normalizeSearchText || ((s) => (s || '').toLowerCase().trim());
    const tLower = normalize(anime.title);
    const oLower = normalize(anime.originalTitle || anime.original_title || '');
    const genresStr = JSON.stringify(anime.genres || []);

    if (animeId && !isNaN(animeId)) {
      db.prepare(`
        INSERT INTO anime (id, slug, title, title_lower, original_title, original_title_lower, image_url, type, year, genres, description, season, related_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          title_lower = excluded.title_lower,
          original_title = excluded.original_title,
          original_title_lower = excluded.original_title_lower,
          image_url = excluded.image_url,
          type = excluded.type,
          year = excluded.year,
          genres = excluded.genres,
          description = excluded.description
      `).run(
        animeId,
        slug,
        anime.title,
        tLower,
        anime.originalTitle || anime.original_title || '',
        oLower,
        anime.imageUrl || anime.image_url || '',
        anime.type || 'Сериал',
        anime.year || '',
        genresStr,
        anime.description || '',
        anime.season || '',
        JSON.stringify(anime.linkedAnime || [])
      );

      if (typeof db.saveAccountsBackup === 'function') {
        db.saveAccountsBackup();
      }

      return res.json({ success: true, id: animeId });
    } else {
      const result = db.prepare(`
        INSERT INTO anime (slug, title, title_lower, original_title, original_title_lower, image_url, type, year, genres, description, season, related_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        slug,
        anime.title,
        tLower,
        anime.originalTitle || anime.original_title || '',
        oLower,
        anime.imageUrl || anime.image_url || '',
        anime.type || 'Сериал',
        anime.year || '',
        genresStr,
        anime.description || '',
        anime.season || '',
        JSON.stringify(anime.linkedAnime || [])
      );

      if (typeof db.saveAccountsBackup === 'function') {
        db.saveAccountsBackup();
      }

      return res.json({ success: true, id: Number(result.lastInsertRowid) });
    }
  } catch (err) {
    console.error('Register anime error:', err.message);
    return res.status(500).json({ error: 'Ошибка регистрации аниме: ' + err.message });
  }
});

// Toggle Favorite for an anime
app.post('/api/anime/:id/favorite', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const animeId = parseInt(req.params.id, 10);
    if (isNaN(animeId)) {
      return res.status(400).json({ error: 'Неверный ID аниме' });
    }

    const anime = db.prepare('SELECT id FROM anime WHERE id = ?').get(animeId);
    if (!anime) {
      return res.status(404).json({ error: 'Аниме не найдено' });
    }

    const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND anime_id = ?').get(userId, animeId);
    let isFavorite = false;

    if (existing) {
      db.prepare('DELETE FROM favorites WHERE id = ?').run(existing.id);
      isFavorite = false;
    } else {
      db.prepare('INSERT INTO favorites (user_id, anime_id) VALUES (?, ?)').run(userId, animeId);
      isFavorite = true;
    }

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.json({ success: true, isFavorite });
  } catch (err) {
    console.error('Toggle favorite error:', err);
    return res.status(500).json({ error: 'Ошибка обновления избранного' });
  }
});

// Toggle 'Not Interested' (Hide from catalog) for an anime (Photo 4)
app.post('/api/anime/:id/hide', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const animeId = parseInt(req.params.id, 10);
    if (isNaN(animeId)) {
      return res.status(400).json({ error: 'Неверный ID аниме' });
    }

    const anime = db.prepare('SELECT id FROM anime WHERE id = ?').get(animeId);
    if (!anime) {
      return res.status(404).json({ error: 'Аниме не найдено' });
    }

    const existing = db.prepare('SELECT id FROM user_hidden_anime WHERE user_id = ? AND anime_id = ?').get(userId, animeId);
    let isHidden = false;

    if (existing) {
      db.prepare('DELETE FROM user_hidden_anime WHERE id = ?').run(existing.id);
      isHidden = false;
    } else {
      db.prepare('INSERT INTO user_hidden_anime (user_id, anime_id) VALUES (?, ?)').run(userId, animeId);
      isHidden = true;
    }

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.json({ success: true, isHidden, animeId });
  } catch (err) {
    console.error('Toggle hide anime error:', err);
    return res.status(500).json({ error: 'Ошибка скрытия аниме' });
  }
});

// User Favorites list for user profile
app.get('/api/user/favorites', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { search, genres, type, sort = 'favorite_desc' } = req.query;

    const params = [userId, userId];
    let whereClauses = ['f.user_id = ?'];

    if (search && search.trim()) {
      const tCol = db.lowerSql ? db.lowerSql('a.title') : 'LOWER(a.title)';
      const otCol = db.lowerSql ? db.lowerSql('a.original_title') : 'LOWER(a.original_title)';
      whereClauses.push(`(${tCol} LIKE ? OR ${otCol} LIKE ?)`);
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term);
    }

    if (type && type.trim() && type !== 'all') {
      whereClauses.push('a.type = ?');
      params.push(type.trim());
    }

    if (genres && genres.trim()) {
      const genreList = genres.split(',').map(g => g.trim()).filter(Boolean);
      for (const g of genreList) {
        whereClauses.push('a.genres LIKE ?');
        params.push(`%"${g}"%`);
      }
    }

    let orderBySql = 'ORDER BY f.created_at DESC';
    if (sort === 'year_desc') {
      orderBySql = 'ORDER BY a.year DESC, a.id DESC';
    } else if (sort === 'title_asc') {
      orderBySql = 'ORDER BY a.title ASC';
    }

    const items = db.prepare(`
      SELECT
        a.id,
        a.slug,
        a.title,
        a.original_title,
        a.image_url,
        a.type,
        a.year,
        a.genres,
        a.description,
        f.created_at as favorited_at,
        ROUND((SELECT AVG(score) FROM ratings WHERE anime_id = a.id), 1) as avg_score,
        (SELECT COUNT(id) FROM ratings WHERE anime_id = a.id) as rating_count,
        (
          SELECT score FROM ratings
          WHERE anime_id = a.id AND user_id = ?
        ) as my_score,
        1 as is_favorite
      FROM favorites f
      JOIN anime a ON f.anime_id = a.id
      WHERE ${whereClauses.join(' AND ')}
      ${orderBySql}
    `).all(...params);

    const formatted = items.map(item => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      originalTitle: item.original_title,
      imageUrl: item.image_url,
      type: item.type,
      year: item.year,
      genres: JSON.parse(item.genres || '[]'),
      description: item.description,
      myScore: item.my_score !== null && item.my_score !== undefined ? item.my_score : null,
      favoritedAt: item.favorited_at,
      averageScore: item.rating_count > 0 && item.avg_score !== null ? Number(item.avg_score) : null,
      ratingCount: Number(item.rating_count),
      isFavorite: true
    }));

    return res.json({ items: formatted, total: formatted.length });
  } catch (err) {
    console.error('Get favorites error:', err);
    return res.status(500).json({ error: 'Ошибка получения избранных тайтлов' });
  }
});

// User Hidden ('Не интересует') list for user profile
app.get('/api/user/hidden', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { search, type } = req.query;

    const params = [userId, userId];
    let whereClauses = ['h.user_id = ?'];

    if (search && search.trim()) {
      const tCol = db.lowerSql ? db.lowerSql('a.title') : 'LOWER(a.title)';
      const otCol = db.lowerSql ? db.lowerSql('a.original_title') : 'LOWER(a.original_title)';
      whereClauses.push(`(${tCol} LIKE ? OR ${otCol} LIKE ?)`);
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term);
    }

    if (type && type.trim() && type !== 'all') {
      whereClauses.push('a.type = ?');
      params.push(type.trim());
    }

    const items = db.prepare(`
      SELECT
        a.id,
        a.slug,
        a.title,
        a.original_title,
        a.image_url,
        a.type,
        a.year,
        a.genres,
        a.description,
        h.created_at as hidden_at,
        ROUND((SELECT AVG(score) FROM ratings WHERE anime_id = a.id), 1) as avg_score,
        (SELECT COUNT(id) FROM ratings WHERE anime_id = a.id) as rating_count,
        (
          SELECT score FROM ratings
          WHERE anime_id = a.id AND user_id = ?
        ) as my_score
      FROM user_hidden_anime h
      JOIN anime a ON a.id = h.anime_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY h.created_at DESC
    `).all(...params);

    const formatted = items.map(item => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      originalTitle: item.original_title,
      imageUrl: item.image_url,
      type: item.type,
      year: item.year,
      genres: JSON.parse(item.genres || '[]'),
      description: item.description,
      myScore: item.my_score !== null && item.my_score !== undefined ? item.my_score : null,
      hiddenAt: item.hidden_at,
      averageScore: item.rating_count > 0 && item.avg_score !== null ? Number(item.avg_score) : null,
      ratingCount: Number(item.rating_count),
      isHidden: true
    }));

    return res.json({ items: formatted, total: formatted.length });
  } catch (err) {
    console.error('Get hidden anime error:', err);
    return res.status(500).json({ error: 'Ошибка получения скрытых тайтлов' });
  }
});

// Get user Top-5 anime IDs
app.get('/api/user/top5', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const isMrTech = userId === 20 || req.user.nickname === 'MrTech';
    const isVenicek = userId === 21 || req.user.nickname === 'Venicek';
    const rows = db.prepare('SELECT anime_id FROM user_top5 WHERE user_id = ? ORDER BY position ASC, created_at ASC').all(userId);
    let ids = rows.map(r => r.anime_id);

    const lemonAnime = db.prepare("SELECT id FROM anime WHERE title = 'Лимонные девочки'").get();
    const lemonId = lemonAnime ? lemonAnime.id : 7170;

    if (isMrTech && !ids.includes(lemonId)) {
      ids.unshift(lemonId);
    }
    if (isVenicek) {
      ids = ids.filter(id => id !== lemonId);
    }
    return res.json({ top5Ids: ids.slice(0, 5) });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка получения Топ-5' });
  }
});

// Toggle anime in Top-5 for current user (max 5 allowed)
app.post('/api/user/top5/toggle', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { animeId } = req.body;
    if (!animeId) return res.status(400).json({ error: 'Укажите animeId' });

    const isMrTech = userId === 20 || req.user.nickname === 'MrTech';
    const isVenicek = userId === 21 || req.user.nickname === 'Venicek';

    const lemonAnime = db.prepare("SELECT id FROM anime WHERE title = 'Лимонные девочки'").get();
    const lemonId = lemonAnime ? lemonAnime.id : 7170;

    if (isMrTech && Number(animeId) === lemonId) {
      return res.status(400).json({ error: 'Этот тайтл закреплен навсегда и его нельзя снять' });
    }
    if (isVenicek && Number(animeId) === lemonId) {
      return res.status(400).json({ error: 'Недоступно для добавления' });
    }

    const existing = db.prepare('SELECT 1 FROM user_top5 WHERE user_id = ? AND anime_id = ?').get(userId, animeId);
    if (existing) {
      db.prepare('DELETE FROM user_top5 WHERE user_id = ? AND anime_id = ?').run(userId, animeId);
    } else {
      const countRow = db.prepare('SELECT COUNT(*) as count FROM user_top5 WHERE user_id = ?').get(userId);
      let count = countRow ? countRow.count : 0;
      if (isMrTech) {
        const hasLemon = db.prepare('SELECT 1 FROM user_top5 WHERE user_id = ? AND anime_id = ?').get(userId, lemonId);
        if (!hasLemon) count += 1;
      }
      if (count >= 5) {
        return res.status(400).json({ error: 'В Топ-5 можно добавить только 5 аниме, больше нельзя!' });
      }
      db.prepare('INSERT OR IGNORE INTO user_top5 (user_id, anime_id, position) VALUES (?, ?, ?)').run(userId, animeId, count);
    }

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    const rows = db.prepare('SELECT anime_id FROM user_top5 WHERE user_id = ? ORDER BY position ASC, created_at ASC').all(userId);
    let ids = rows.map(r => r.anime_id);
    if (isMrTech && !ids.includes(lemonId)) ids.unshift(lemonId);
    if (isVenicek) ids = ids.filter(id => id !== lemonId);

    return res.json({
      top5Ids: ids.slice(0, 5),
      message: existing ? 'Удалено из Топ-5' : 'Добавлено в Топ-5'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка обновления Топ-5' });
  }
});

// Bulk set Top-5 anime for current user
app.post('/api/user/top5/set', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    let { animeIds } = req.body;
    if (!Array.isArray(animeIds)) {
      return res.status(400).json({ error: 'animeIds must be an array' });
    }

    const isMrTech = userId === 20 || req.user.nickname === 'MrTech';
    const isVenicek = userId === 21 || req.user.nickname === 'Venicek';

    const lemonAnime = db.prepare("SELECT id FROM anime WHERE title = 'Лимонные девочки'").get();
    const lemonId = lemonAnime ? lemonAnime.id : 7170;

    if (isVenicek) {
      animeIds = animeIds.filter(id => Number(id) !== lemonId);
    }
    if (isMrTech && !animeIds.includes(lemonId)) {
      animeIds.unshift(lemonId);
    }

    const finalIds = animeIds.slice(0, 5);

    db.prepare('DELETE FROM user_top5 WHERE user_id = ?').run(userId);
    const insertStmt = db.prepare('INSERT OR REPLACE INTO user_top5 (user_id, anime_id, position) VALUES (?, ?, ?)');
    finalIds.forEach((aId, idx) => {
      insertStmt.run(userId, Number(aId), idx);
    });

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.json({ success: true, top5Ids: finalIds });
  } catch (err) {
    console.error('Set top5 error:', err);
    return res.status(500).json({ error: 'Ошибка сохранения Топ-5' });
  }
});

// Rated Anime list for user profile
app.get('/api/user/rated-anime', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { search, genres, type, sort = 'my_score_desc' } = req.query;

    const params = [userId];
    let whereClauses = ['r.user_id = ?', "a.title != 'Лимонные девочки'"];

    if (search && search.trim()) {
      const tCol = db.lowerSql ? db.lowerSql('a.title') : 'LOWER(a.title)';
      const otCol = db.lowerSql ? db.lowerSql('a.original_title') : 'LOWER(a.original_title)';
      whereClauses.push(`(${tCol} LIKE ? OR ${otCol} LIKE ?)`);
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term);
    }

    if (type && type.trim() && type !== 'all') {
      whereClauses.push('a.type = ?');
      params.push(type.trim());
    }

    if (genres && genres.trim()) {
      const genreList = genres.split(',').map(g => g.trim()).filter(Boolean);
      for (const g of genreList) {
        whereClauses.push('a.genres LIKE ?');
        params.push(`%"${g}"%`);
      }
    }

    let orderBySql = 'ORDER BY r.score DESC, r.updated_at DESC';
    if (sort === 'my_score_asc') {
      orderBySql = 'ORDER BY r.score ASC, r.updated_at DESC';
    } else if (sort === 'newest') {
      orderBySql = 'ORDER BY a.year DESC, a.id DESC';
    } else if (sort === 'recent_rated') {
      orderBySql = 'ORDER BY r.updated_at DESC';
    }

    const items = db.prepare(`
      SELECT
        a.id,
        a.slug,
        a.title,
        a.original_title,
        a.image_url,
        a.type,
        a.year,
        a.genres,
        a.description,
        r.score as my_score,
        r.updated_at as rated_at,
        ROUND((SELECT AVG(score) FROM ratings WHERE anime_id = a.id), 1) as avg_score,
        (SELECT COUNT(id) FROM ratings WHERE anime_id = a.id) as rating_count
      FROM ratings r
      JOIN anime a ON r.anime_id = a.id
      WHERE ${whereClauses.join(' AND ')}
      ${orderBySql}
    `).all(...params);

    const formatted = items.map(item => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      originalTitle: item.original_title,
      imageUrl: item.image_url,
      type: item.type,
      year: item.year,
      genres: JSON.parse(item.genres || '[]'),
      description: item.description,
      myScore: item.my_score,
      ratedAt: item.rated_at,
      averageScore: item.rating_count > 0 && item.avg_score !== null ? Number(item.avg_score) : null,
      ratingCount: Number(item.rating_count)
    }));

    return res.json({ items: formatted, total: formatted.length });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка получения оцененных тайтлов' });
  }
});

// Rate an anime (Strictly authenticated users only)
app.post('/api/anime/:id/rate', authMiddleware, (req, res) => {
  try {
    const animeId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { score, anime: animeData } = req.body;

    let anime = db.prepare('SELECT id FROM anime WHERE id = ?').get(animeId);
    if (!anime && animeData && animeData.title) {
      // Auto-register missing anime from client/external search
      const slug = animeData.slug || `anime-${animeId}`;
      const normalize = db.normalizeSearchText || ((s) => (s || '').toLowerCase().trim());
      const tLower = normalize(animeData.title);
      const oLower = normalize(animeData.originalTitle || animeData.original_title || '');
      const genresStr = JSON.stringify(animeData.genres || []);
      try {
        db.prepare(`
          INSERT INTO anime (id, slug, title, title_lower, original_title, original_title_lower, image_url, type, year, genres, description, season, related_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title = excluded.title
        `).run(
          animeId,
          slug,
          animeData.title,
          tLower,
          animeData.originalTitle || animeData.original_title || '',
          oLower,
          animeData.imageUrl || animeData.image_url || '',
          animeData.type || 'Сериал',
          animeData.year || '',
          genresStr,
          animeData.description || '',
          animeData.season || '',
          JSON.stringify(animeData.linkedAnime || [])
        );
        anime = { id: animeId };
      } catch (insertErr) {
        console.warn('Auto-create anime on rate notice:', insertErr.message);
      }
    }

    if (!anime) {
      return res.status(404).json({ error: 'Аниме не найдено' });
    }

    if (score === null || score === undefined || score === '') {
      db.prepare('DELETE FROM ratings WHERE user_id = ? AND anime_id = ?').run(userId, animeId);
    } else {
      const numScore = parseInt(score, 10);
      if (isNaN(numScore) || numScore < 0 || numScore > 10) {
        return res.status(400).json({ error: 'Оценка должна быть числом от 0 до 10' });
      }

      db.prepare(`
        INSERT INTO ratings (user_id, anime_id, score, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, anime_id) DO UPDATE SET
          score = excluded.score,
          updated_at = CURRENT_TIMESTAMP
      `).run(userId, animeId, numScore);
    }

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    const stats = db.prepare(`
      SELECT
        ROUND(AVG(score), 1) as avg_score,
        COUNT(id) as rating_count
      FROM ratings
      WHERE anime_id = ?
    `).get(animeId);

    let friendsRatings = [];
    const friendIds = getConfirmedFriendIds(userId);
    if (friendIds.length > 0) {
      const friendPlaceholders = friendIds.map(() => '?').join(',');
      friendsRatings = db.prepare(`
        SELECT r.score, r.updated_at, u.id as user_id, u.nickname
        FROM ratings r
        JOIN users u ON r.user_id = u.id
        WHERE r.anime_id = ? AND r.user_id IN (${friendPlaceholders})
        ORDER BY r.updated_at DESC
      `).all(animeId, ...friendIds);
    }

    return res.json({
      success: true,
      myScore: score !== null && score !== undefined ? parseInt(score, 10) : null,
      averageScore: stats.rating_count > 0 && stats.avg_score !== null ? Number(stats.avg_score) : null,
      ratingCount: Number(stats.rating_count),
      friendsRatings: friendsRatings.map(r => ({
        userId: r.user_id,
        nickname: r.nickname,
        score: r.score,
        updatedAt: r.updated_at
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка сохранения оценки' });
  }
});

// ----------------------------------------------------
// COMMENTS SYSTEM (THREADED REPLIES & REACTIONS)
// ----------------------------------------------------

app.get('/api/anime/:id/comments', optionalAuthMiddleware, (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    if (!currentUserId) {
      return res.status(401).json({
        comments: [],
        requiresAuth: true,
        message: 'Для просмотра комментариев и аккаунтов участников необходимо войти в аккаунт'
      });
    }

    const animeId = parseInt(req.params.id, 10);

    const comments = db.prepare(`
      SELECT
        c.id,
        c.anime_id,
        c.parent_id,
        c.content,
        c.created_at,
        u.id as user_id,
        u.nickname,
        u.avatar_url,
        (SELECT COUNT(id) FROM comment_reactions WHERE comment_id = c.id AND type = 'like') as likes_count,
        (SELECT COUNT(id) FROM comment_reactions WHERE comment_id = c.id AND type = 'dislike') as dislikes_count,
        (
          SELECT type FROM comment_reactions
          WHERE comment_id = c.id AND user_id = ?
        ) as user_reaction
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.anime_id = ?
      ORDER BY c.created_at ASC
    `).all(currentUserId || -1, animeId);

    const commentMap = {};
    const topLevel = [];

    for (const c of comments) {
      const item = {
        id: c.id,
        parentId: c.parent_id || null,
        content: c.content,
        createdAt: c.created_at,
        likesCount: Number(c.likes_count || 0),
        dislikesCount: Number(c.dislikes_count || 0),
        userReaction: c.user_reaction || null,
        user: {
          id: c.user_id,
          nickname: c.nickname,
          avatarUrl: c.avatar_url
        },
        replies: []
      };
      commentMap[c.id] = item;
    }

    for (const c of comments) {
      const item = commentMap[c.id];
      if (c.parent_id && commentMap[c.parent_id]) {
        commentMap[c.parent_id].replies.push(item);
      } else {
        topLevel.push(item);
      }
    }

    // Sort topLevel newest first
    topLevel.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    // Sort replies oldest first (chronological mini-thread)
    for (const tl of topLevel) {
      tl.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    return res.json({ comments: topLevel });
  } catch (err) {
    console.error('Comments error:', err);
    return res.status(500).json({ error: 'Ошибка загрузки комментариев' });
  }
});

app.post('/api/anime/:id/comments', authMiddleware, (req, res) => {
  try {
    const animeId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { content, parentId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Комментарий не может быть пустым' });
    }

    const cleanContent = content.trim();
    if (cleanContent.length > 2000) {
      return res.status(400).json({ error: 'Комментарий слишком длинный' });
    }

    const anime = db.prepare('SELECT id, title FROM anime WHERE id = ?').get(animeId);
    if (!anime) {
      return res.status(404).json({ error: 'Аниме не найдено' });
    }

    let validParentId = null;
    if (parentId) {
      const parent = db.prepare('SELECT id, user_id FROM comments WHERE id = ? AND anime_id = ?').get(parentId, animeId);
      if (parent) {
        validParentId = parent.id;
      }
    }

    const stmt = db.prepare(`
      INSERT INTO comments (user_id, anime_id, parent_id, content)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(userId, animeId, validParentId, cleanContent);

    const user = db.prepare('SELECT avatar_url, nickname FROM users WHERE id = ?').get(userId);

    // If this is a reply to another user's comment, send a notification
    if (validParentId) {
      const parentComment = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(validParentId);
      if (parentComment && parentComment.user_id !== userId) {
        createNotification(
          parentComment.user_id,
          'comment_reply',
          'Ответ на комментарий',
          `${user ? user.nickname : 'Пользователь'} ответил(а) на ваш комментарий к аниме «${anime.title}»`,
          {
            fromUserId: userId,
            fromNickname: user ? user.nickname : '',
            fromAvatar: user ? user.avatar_url : null,
            animeId,
            animeTitle: anime.title,
            commentId: Number(result.lastInsertRowid),
            parentCommentId: validParentId
          }
        );
      }
    }

    const newComment = {
      id: Number(result.lastInsertRowid),
      parentId: validParentId,
      content: cleanContent,
      createdAt: new Date().toISOString(),
      likesCount: 0,
      dislikesCount: 0,
      userReaction: null,
      user: {
        id: userId,
        nickname: req.user.nickname,
        avatarUrl: user ? user.avatar_url : null
      },
      replies: []
    };

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.status(201).json({ comment: newComment });
  } catch (err) {
    console.error('Add comment error:', err);
    return res.status(500).json({ error: 'Ошибка добавления комментария' });
  }
});

// React to a comment (Like / Dislike toggle)
app.post('/api/comments/:id/react', authMiddleware, (req, res) => {
  try {
    const commentId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { type } = req.body; // 'like' or 'dislike'

    if (type !== 'like' && type !== 'dislike') {
      return res.status(400).json({ error: 'Неверный тип реакции (like или dislike)' });
    }

    const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Комментарий не найден' });
    }

    const existing = db.prepare('SELECT id, type FROM comment_reactions WHERE comment_id = ? AND user_id = ?').get(commentId, userId);

    let finalReaction = null;
    if (existing) {
      if (existing.type === type) {
        // Toggle off
        db.prepare('DELETE FROM comment_reactions WHERE id = ?').run(existing.id);
        finalReaction = null;
      } else {
        // Switch reaction
        db.prepare('UPDATE comment_reactions SET type = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?').run(type, existing.id);
        finalReaction = type;
      }
    } else {
      // Insert new reaction
      db.prepare('INSERT INTO comment_reactions (comment_id, user_id, type) VALUES (?, ?, ?)').run(commentId, userId, type);
      finalReaction = type;
    }

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    const counts = db.prepare(`
      SELECT
        (SELECT COUNT(id) FROM comment_reactions WHERE comment_id = ? AND type = 'like') as likes_count,
        (SELECT COUNT(id) FROM comment_reactions WHERE comment_id = ? AND type = 'dislike') as dislikes_count
    `).get(commentId, commentId);

    return res.json({
      success: true,
      commentId,
      userReaction: finalReaction,
      likesCount: Number(counts.likes_count || 0),
      dislikesCount: Number(counts.dislikes_count || 0)
    });
  } catch (err) {
    console.error('React to comment error:', err);
    return res.status(500).json({ error: 'Ошибка сохранения реакции' });
  }
});

app.delete('/api/comments/:id', authMiddleware, (req, res) => {
  try {
    const commentId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Комментарий не найден' });
    }

    if (comment.user_id !== userId) {
      return res.status(403).json({ error: 'Вы можете удалять только свои комментарии' });
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка удаления комментария' });
  }
});

// Sync from AnimeGO manually
app.post('/api/anime/sync', async (req, res) => {
  try {
    const { pages = [4, 5, 6] } = req.body;
    const addedCount = await syncFromAnimeGo(pages);
    return res.json({ success: true, count: addedCount });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка синхронизации: ' + err.message });
  }
});

// ----------------------------------------------------
// NOTIFICATIONS API
// ----------------------------------------------------

// Get user notifications + unread count
app.get('/api/notifications', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = db.prepare(`
      SELECT id, type, title, message, data, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 30
    `).all(userId);

    const unreadRow = db.prepare(`
      SELECT COUNT(id) as count FROM notifications WHERE user_id = ? AND is_read = 0
    `).get(userId);

    return res.json({
      notifications: notifications.map(n => {
        const data = JSON.parse(n.data || '{}');
        let isAccepted = false;
        let isRejected = false;
        if (n.type === 'friend_request' && data.requestId) {
          const reqRow = db.prepare('SELECT status FROM friend_requests WHERE id = ?').get(data.requestId);
          if (reqRow) {
            if (reqRow.status === 'accepted') isAccepted = true;
            if (reqRow.status === 'rejected') isRejected = true;
          } else if (n.is_read) {
            isAccepted = true;
          }
        }
        return {
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          data,
          isRead: Boolean(n.is_read),
          isAccepted,
          isRejected,
          createdAt: n.created_at
        };
      }),
      unreadCount: unreadRow ? unreadRow.count : 0
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ error: 'Ошибка получения уведомлений' });
  }
});

// Mark single notification as read
app.post('/api/notifications/:id/read', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка обновления уведомления' });
  }
});

// Mark all notifications as read
app.post('/api/notifications/read-all', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка обновления уведомлений' });
  }
});

// Delete notification
app.delete('/api/notifications/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(id, userId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка удаления уведомления' });
  }
});

// ----------------------------------------------------
// DEVELOPER CONSOLE ROUTES (JUST ONLY)
// ----------------------------------------------------

function devAdminMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация в консоли разработчика' });
  }
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Неверный или просроченный токен' });
  }
  const isJust = decoded.nickname === 'Just' || decoded.email === 'just9jeeet@gmail.com' || decoded.id === 5;
  if (!isJust) {
    return res.status(403).json({ error: 'Доступ разрешен только разработчику Just' });
  }
  req.user = decoded;
  next();
}

// Dev Auth - verify Just credentials
app.post('/api/dev/auth', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }
    const cleanLogin = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(nickname) = ?').get(cleanLogin, cleanLogin);
    if (!user) {
      return res.status(400).json({ error: 'Пользователь не найден' });
    }
    const isJust = user.nickname === 'Just' || user.email === 'just9jeeet@gmail.com' || user.id === 5;
    if (!isJust) {
      return res.status(403).json({ error: 'Вход в консоль разработчика разрешен только для аккаунта Just' });
    }
    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(400).json({ error: 'Неверный пароль аккаунта Just' });
    }
    const safeUser = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatar_url || null,
      bannerUrl: user.banner_url || null
    };
    const token = generateToken(safeUser);
    return res.json({ success: true, token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка авторизации разработчика' });
  }
});

// Dev: Get all users with stats
app.get('/api/dev/users', devAdminMiddleware, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.nickname, u.email, u.avatar_url, u.banner_url, u.is_blocked, u.created_at,
             COUNT(r.id) as rated_count,
             ROUND(AVG(r.score), 1) as avg_score
      FROM users u
      LEFT JOIN ratings r ON u.id = r.user_id
      GROUP BY u.id
      ORDER BY u.id ASC
    `).all();

    return res.json({
      users: users.map(u => ({
        id: u.id,
        nickname: u.nickname,
        email: u.email,
        avatarUrl: u.avatar_url,
        bannerUrl: u.banner_url,
        isBlocked: Boolean(u.is_blocked),
        createdAt: u.created_at,
        ratedCount: u.rated_count || 0,
        avgScore: u.avg_score !== null ? Number(u.avg_score) : null
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

// Dev: Update user profile
app.put('/api/dev/users/:id', devAdminMiddleware, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { nickname, email, avatarUrl, bannerUrl, top5Ids, isBlocked } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    let updatedNickname = nickname !== undefined ? nickname.trim() : user.nickname;
    let updatedEmail = email !== undefined ? email.trim().toLowerCase() : user.email;
    let updatedAvatar = avatarUrl !== undefined ? avatarUrl : user.avatar_url;
    let updatedBanner = bannerUrl !== undefined ? bannerUrl : user.banner_url;
    let updatedBlocked = user.is_blocked || 0;

    if (isBlocked !== undefined) {
      const isJust = targetUserId === 5 || user.nickname === 'Just' || user.email === 'just9jeeet@gmail.com';
      if (isJust && (isBlocked === true || isBlocked === 1 || isBlocked === '1')) {
        return res.status(403).json({ error: 'Нельзя заблокировать аккаунт главного разработчика Just' });
      }
      updatedBlocked = (isBlocked === true || isBlocked === 1 || isBlocked === '1') ? 1 : 0;
    }

    if (Array.isArray(top5Ids)) {
      const cleanBanner = (updatedBanner || '').split('#top5=')[0];
      updatedBanner = cleanBanner + (top5Ids.length > 0 ? '#top5=' + top5Ids.join(',') : '');
      db.prepare('DELETE FROM user_top5 WHERE user_id = ?').run(targetUserId);
      const top5InsertStmt = db.prepare('INSERT OR REPLACE INTO user_top5 (user_id, anime_id, position) VALUES (?, ?, ?)');
      top5Ids.slice(0, 5).forEach((aId, idx) => {
        top5InsertStmt.run(targetUserId, Number(aId), idx);
      });
    }

    db.prepare(`
      UPDATE users
      SET nickname = ?, email = ?, avatar_url = ?, banner_url = ?, is_blocked = ?
      WHERE id = ?
    `).run(updatedNickname, updatedEmail, updatedAvatar, updatedBanner, updatedBlocked, targetUserId);

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.json({
      success: true,
      user: {
        id: targetUserId,
        nickname: updatedNickname,
        email: updatedEmail,
        avatarUrl: updatedAvatar,
        bannerUrl: updatedBanner,
        isBlocked: Boolean(updatedBlocked)
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка обновления пользователя: ' + err.message });
  }
});

// Dev: Block user
app.post('/api/dev/users/:id/block', devAdminMiddleware, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const user = db.prepare('SELECT id, nickname, email FROM users WHERE id = ?').get(targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const isJust = targetUserId === 5 || user.nickname === 'Just' || user.email === 'just9jeeet@gmail.com';
    if (isJust) {
      return res.status(403).json({ error: 'Нельзя заблокировать аккаунт главного разработчика Just' });
    }

    db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(targetUserId);
    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.json({
      success: true,
      id: targetUserId,
      isBlocked: true,
      message: `Пользователь «${user.nickname}» успешно заблокирован`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка блокировки пользователя: ' + err.message });
  }
});

// Dev: Unblock user
app.post('/api/dev/users/:id/unblock', devAdminMiddleware, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const user = db.prepare('SELECT id, nickname FROM users WHERE id = ?').get(targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    db.prepare('UPDATE users SET is_blocked = 0 WHERE id = ?').run(targetUserId);
    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.json({
      success: true,
      id: targetUserId,
      isBlocked: false,
      message: `Пользователь «${user.nickname}» успешно разблокирован`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка разблокировки пользователя: ' + err.message });
  }
});

// Dev: Get user ratings with search, score, genre, type, and sort filters
app.get('/api/dev/users/:id/ratings', devAdminMiddleware, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { search, genres, type, score, sort = 'my_score_desc' } = req.query;

    let whereClauses = ['r.user_id = ?', "a.title != 'Лимонные девочки'"];
    let params = [targetUserId];

    if (search && search.trim()) {
      whereClauses.push('(a.title_lower LIKE ? OR a.original_title_lower LIKE ?)');
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term);
    }

    if (score && score !== 'all') {
      const numScore = parseInt(score, 10);
      if (!isNaN(numScore)) {
        whereClauses.push('r.score = ?');
        params.push(numScore);
      }
    }

    if (type && type.trim() && type !== 'all') {
      whereClauses.push('a.type = ?');
      params.push(type.trim());
    }

    if (genres && genres.trim()) {
      const gList = genres.split(',').map(g => g.trim()).filter(Boolean);
      for (const g of gList) {
        whereClauses.push('a.genres LIKE ?');
        params.push(`%"${g}"%`);
      }
    }

    let orderBy = 'ORDER BY r.score DESC, r.updated_at DESC';
    if (sort === 'my_score_asc') orderBy = 'ORDER BY r.score ASC, r.updated_at DESC';
    else if (sort === 'title_asc') orderBy = 'ORDER BY a.title ASC';
    else if (sort === 'recent_rated') orderBy = 'ORDER BY r.updated_at DESC';

    const rows = db.prepare(`
      SELECT a.id, a.slug, a.title, a.original_title, a.image_url, a.type, a.year, a.genres, a.description,
             r.score, r.updated_at,
             (SELECT COUNT(*) FROM user_top5 WHERE user_id = r.user_id AND anime_id = a.id) as is_top5
      FROM ratings r
      JOIN anime a ON r.anime_id = a.id
      WHERE ${whereClauses.join(' AND ')}
      ${orderBy}
    `).all(...params);

    return res.json({
      ratings: rows.map(r => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        originalTitle: r.original_title,
        imageUrl: r.image_url,
        type: r.type,
        year: r.year,
        genres: JSON.parse(r.genres || '[]'),
        description: r.description,
        score: r.score,
        isTop5: Boolean(r.is_top5),
        updatedAt: r.updated_at
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка загрузки оценок пользователя' });
  }
});

// Dev: Get unrated anime for a specific user
app.get('/api/dev/users/:id/unrated', devAdminMiddleware, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { search, genres, type, limit = 60, page = 1 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(10, parseInt(limit, 10) || 60));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = ['a.id NOT IN (SELECT anime_id FROM ratings WHERE user_id = ?)', "a.title != 'Лимонные девочки'"];
    let params = [targetUserId];

    if (search && search.trim()) {
      whereClauses.push('(a.title_lower LIKE ? OR a.original_title_lower LIKE ?)');
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term);
    }

    if (type && type.trim() && type !== 'all') {
      whereClauses.push('a.type = ?');
      params.push(type.trim());
    }

    if (genres && genres.trim()) {
      const gList = genres.split(',').map(g => g.trim()).filter(Boolean);
      for (const g of gList) {
        whereClauses.push('a.genres LIKE ?');
        params.push(`%"${g}"%`);
      }
    }

    const whereSql = whereClauses.join(' AND ');
    const countRow = db.prepare(`SELECT COUNT(id) as total FROM anime a WHERE ${whereSql}`).get(...params);
    const total = countRow ? countRow.total : 0;

    const rows = db.prepare(`
      SELECT a.id, a.slug, a.title, a.original_title, a.image_url, a.type, a.year, a.genres, a.description,
             ROUND((SELECT AVG(score) FROM ratings WHERE anime_id = a.id), 1) as avg_score,
             (SELECT COUNT(id) FROM ratings WHERE anime_id = a.id) as rating_count
      FROM anime a
      WHERE ${whereSql}
      ORDER BY a.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    return res.json({
      items: rows.map(r => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        originalTitle: r.original_title,
        imageUrl: r.image_url,
        type: r.type,
        year: r.year,
        genres: JSON.parse(r.genres || '[]'),
        description: r.description,
        averageScore: r.rating_count > 0 && r.avg_score !== null ? Number(r.avg_score) : null,
        ratingCount: Number(r.rating_count)
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка загрузки неоцененных тайтлов' });
  }
});

// Dev: Batch import ratings for user
app.post('/api/dev/users/:userId/import', devAdminMiddleware, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const { items, overwrite = false } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Список тайтлов для импорта пуст' });
    }

    let newlyRatedCount = 0;
    let updatedRatedCount = 0;
    let skippedCount = 0;

    const findAnimeStmt = db.prepare('SELECT id, title FROM anime WHERE title_lower = ? OR original_title_lower = ? LIMIT 1');
    const findFuzzyStmt = db.prepare('SELECT id, title FROM anime WHERE title_lower LIKE ? LIMIT 1');
    const existingRatingStmt = db.prepare('SELECT id, score FROM ratings WHERE user_id = ? AND anime_id = ?');
    const insertRatingStmt = db.prepare('INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
    const updateRatingStmt = db.prepare('UPDATE ratings SET score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const createAnimeStmt = db.prepare(`
      INSERT INTO anime (title, title_lower, original_title, original_title_lower, description, image_url, type, year, genres, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    for (const it of items) {
      const title = (it.title || '').trim();
      if (!title) continue;
      const originalTitle = (it.originalTitle || '').trim();
      const score = Math.min(10, Math.max(1, parseInt(it.score, 10) || 10));

      const titleLower = title.toLowerCase();
      const origLower = originalTitle ? originalTitle.toLowerCase() : '';

      let matched = findAnimeStmt.get(titleLower, origLower || titleLower);
      if (!matched) {
        matched = findFuzzyStmt.get(`%${titleLower}%`);
      }

      let animeId;
      if (matched) {
        animeId = matched.id;
      } else {
        const imgUrl = it.imageUrl || it.image || 'https://placehold.co/300x450/1e293b/ffffff?text=' + encodeURIComponent(title.slice(0, 30));
        const resInfo = createAnimeStmt.run(
          title,
          titleLower,
          originalTitle,
          origLower,
          title,
          imgUrl,
          it.type || 'Сериал',
          it.year || '',
          JSON.stringify(Array.isArray(it.genres) ? it.genres : [])
        );
        animeId = resInfo.lastInsertRowid;
      }

      const existing = existingRatingStmt.get(targetUserId, animeId);
      if (existing) {
        if (overwrite) {
          updateRatingStmt.run(score, existing.id);
          updatedRatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        insertRatingStmt.run(targetUserId, animeId, score);
        newlyRatedCount++;
      }
    }

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.json({
      success: true,
      total: items.length,
      newlyRatedCount,
      updatedRatedCount,
      skippedCount
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка импорта оценок: ' + err.message });
  }
});

// Dev: Set user rating
app.post('/api/dev/users/:userId/ratings', devAdminMiddleware, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const { animeId, score } = req.body;
    const numScore = parseInt(score, 10);

    if (isNaN(numScore) || numScore < 1 || numScore > 10) {
      return res.status(400).json({ error: 'Оценка должна быть от 1 до 10' });
    }

    const existing = db.prepare('SELECT id FROM ratings WHERE user_id = ? AND anime_id = ?').get(targetUserId, animeId);
    if (existing) {
      db.prepare('UPDATE ratings SET score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(numScore, existing.id);
    } else {
      db.prepare('INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(targetUserId, animeId, numScore);
    }

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.json({ success: true, animeId, score: numScore });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка установки оценки' });
  }
});

// Dev: Delete user rating
app.delete('/api/dev/users/:userId/ratings/:animeId', devAdminMiddleware, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const animeId = parseInt(req.params.animeId, 10);
    db.prepare('DELETE FROM ratings WHERE user_id = ? AND anime_id = ?').run(targetUserId, animeId);
    db.prepare('DELETE FROM user_top5 WHERE user_id = ? AND anime_id = ?').run(targetUserId, animeId);

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка удаления оценки' });
  }
});

// Dev: Create New Anime
app.post('/api/dev/anime', devAdminMiddleware, (req, res) => {
  try {
    const { title, originalTitle, description, imageUrl, type = 'Сериал', year = '', genres = [], season = '', linkedAnime = [] } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Укажите название аниме' });
    }

    const cleanTitle = title.trim();
    const cleanOriginalTitle = (originalTitle || '').trim();
    const cleanDesc = (description || '').trim();
    const cleanImage = (imageUrl || '').trim();
    const cleanType = (type || 'Сериал').trim();
    const cleanYear = (year || '').trim();
    const cleanSeason = typeof season === 'string' ? season.trim() : '';
    const cleanRelatedJson = typeof linkedAnime === 'string' ? linkedAnime : JSON.stringify(Array.isArray(linkedAnime) ? linkedAnime : []);

    let returnGenres = [];
    let finalGenresJson = '[]';
    if (Array.isArray(genres)) {
      returnGenres = genres.map((g) => String(g).trim()).filter(Boolean);
      finalGenresJson = JSON.stringify(returnGenres);
    } else if (typeof genres === 'string') {
      try {
        const parsed = JSON.parse(genres);
        returnGenres = Array.isArray(parsed) ? parsed : [genres];
        finalGenresJson = JSON.stringify(returnGenres);
      } catch (e) {
        returnGenres = genres.split(',').map((g) => g.trim()).filter(Boolean);
        finalGenresJson = JSON.stringify(returnGenres);
      }
    }

    const normalize = db.normalizeSearchText || ((s) => (s || '').toLowerCase().trim());
    const titleLower = normalize(cleanTitle);
    const origLower = normalize(cleanOriginalTitle);

    // Generate unique slug
    const baseSlug = cleanTitle
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s-]/gi, '')
      .trim()
      .replace(/\s+/g, '-');
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const slug = `${baseSlug || 'anime'}-${randomSuffix}`;

    const stmt = db.prepare(`
      INSERT INTO anime (slug, title, title_lower, original_title, original_title_lower, description, image_url, type, year, genres, season, related_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    const info = stmt.run(slug, cleanTitle, titleLower, cleanOriginalTitle, origLower, cleanDesc, cleanImage, cleanType, cleanYear, finalGenresJson, cleanSeason, cleanRelatedJson);
    const newId = Number(info.lastInsertRowid);

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    let parsedLinked = [];
    try {
      parsedLinked = JSON.parse(cleanRelatedJson);
    } catch (e) {}

    const createdAnime = {
      id: newId,
      slug,
      title: cleanTitle,
      originalTitle: cleanOriginalTitle,
      description: cleanDesc,
      imageUrl: cleanImage,
      type: cleanType,
      year: cleanYear,
      genres: returnGenres,
      season: cleanSeason,
      linkedAnime: parsedLinked,
      averageScore: null,
      ratingCount: 0,
      myScore: null
    };

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(201).json({
      success: true,
      anime: createdAnime
    });
  } catch (err) {
    console.error('Dev create anime error:', err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Ошибка создания тайтла: ' + err.message });
  }
});

// Dev: Update Anime (Title, Description, Image, Year, Type, Genres)
app.put('/api/dev/anime/:id', devAdminMiddleware, (req, res) => {
  try {
    const animeId = parseInt(req.params.id, 10);
    const anime = db.prepare('SELECT * FROM anime WHERE id = ?').get(animeId);
    if (!anime) {
      return res.status(404).json({ error: 'Тайтл не найден' });
    }

    const { title, originalTitle, description, imageUrl, type, year, genres, season, linkedAnime, related_json } = req.body;

    const newTitle = title !== undefined ? String(title).trim() : anime.title;
    const newOriginalTitle = originalTitle !== undefined ? String(originalTitle).trim() : (anime.original_title || '');
    const normalize = db.normalizeSearchText || ((s) => (s || '').toLowerCase().trim());
    const newTitleLower = normalize(newTitle);
    const newOriginalTitleLower = normalize(newOriginalTitle);
    const newDesc = description !== undefined ? String(description).trim() : anime.description;
    const newImage = imageUrl !== undefined ? String(imageUrl).trim() : anime.image_url;
    const newType = type !== undefined ? String(type) : anime.type;
    const newYear = year !== undefined ? String(year).trim() : anime.year;
    const newSeason = season !== undefined ? String(season).trim() : (anime.season || '');

    let finalRelatedJson = anime.related_json || '[]';
    let returnLinked = [];
    if (linkedAnime !== undefined) {
      if (Array.isArray(linkedAnime)) {
        returnLinked = linkedAnime;
        finalRelatedJson = JSON.stringify(linkedAnime);
      } else if (typeof linkedAnime === 'string') {
        try {
          returnLinked = JSON.parse(linkedAnime);
          finalRelatedJson = linkedAnime;
        } catch (e) {
          returnLinked = [];
          finalRelatedJson = '[]';
        }
      }
    } else if (related_json !== undefined) {
      finalRelatedJson = typeof related_json === 'string' ? related_json : JSON.stringify(related_json);
      try {
        returnLinked = JSON.parse(finalRelatedJson);
      } catch (e) {
        returnLinked = [];
      }
    } else {
      try {
        returnLinked = JSON.parse(anime.related_json || '[]');
      } catch (e) {
        returnLinked = [];
      }
    }

    let finalGenresJson = anime.genres;
    let returnGenres = [];
    if (genres !== undefined) {
      if (Array.isArray(genres)) {
        returnGenres = genres;
        finalGenresJson = JSON.stringify(genres);
      } else if (typeof genres === 'string') {
        try {
          const parsed = JSON.parse(genres);
          returnGenres = Array.isArray(parsed) ? parsed : [genres];
          finalGenresJson = JSON.stringify(returnGenres);
        } catch (e) {
          returnGenres = genres.split(',').map((g) => g.trim()).filter(Boolean);
          finalGenresJson = JSON.stringify(returnGenres);
        }
      }
    } else {
      try {
        returnGenres = JSON.parse(anime.genres || '[]');
      } catch (e) {
        returnGenres = [];
      }
    }

    db.prepare(`
      UPDATE anime
      SET title = ?, title_lower = ?, original_title = ?, original_title_lower = ?, description = ?, image_url = ?, type = ?, year = ?, genres = ?, season = ?, related_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newTitle, newTitleLower, newOriginalTitle, newOriginalTitleLower, newDesc, newImage, newType, newYear, finalGenresJson, newSeason, finalRelatedJson, animeId);

    // Sync reciprocal links: ensure each linked anime also references this anime
    if (Array.isArray(returnLinked)) {
      for (const target of returnLinked) {
        if (!target || !target.id || Number(target.id) === animeId) continue;
        try {
          const targetRow = db.prepare('SELECT id, related_json, season FROM anime WHERE id = ?').get(Number(target.id));
          if (targetRow) {
            let targetList = [];
            try {
              targetList = JSON.parse(targetRow.related_json || '[]');
            } catch (e) {
              targetList = [];
            }
            const existingIdx = targetList.findIndex((x) => Number(x.id) === animeId);
            const myRelation = newSeason || 'Связанная часть';
            if (existingIdx !== -1) {
              if (!targetList[existingIdx].relation || targetList[existingIdx].relation === 'Связанная часть') {
                targetList[existingIdx].relation = myRelation;
              }
            } else {
              targetList.push({
                id: animeId,
                title: newTitle,
                originalTitle: newOriginalTitle,
                year: newYear,
                type: newType,
                imageUrl: newImage,
                relation: myRelation
              });
            }
            db.prepare('UPDATE anime SET related_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(JSON.stringify(targetList), Number(target.id));
          }
        } catch (e) {}
      }
    }

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      success: true,
      anime: {
        id: animeId,
        title: newTitle,
        originalTitle: newOriginalTitle,
        description: newDesc,
        imageUrl: newImage,
        type: newType,
        year: newYear,
        genres: returnGenres,
        season: newSeason,
        linkedAnime: returnLinked
      }
    });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Ошибка обновления тайтла: ' + err.message });
  }
});

// Dev: Delete Anime
app.delete('/api/dev/anime/:id', devAdminMiddleware, (req, res) => {
  try {
    const animeId = parseInt(req.params.id, 10);
    if (!animeId) {
      return res.status(400).json({ error: 'Неверный ID тайтла' });
    }

    const anime = db.prepare('SELECT id, title FROM anime WHERE id = ?').get(animeId);

    // Clean up reactions on comments for this anime
    try {
      db.prepare(`
        DELETE FROM comment_reactions 
        WHERE comment_id IN (SELECT id FROM comments WHERE anime_id = ?)
      `).run(animeId);
    } catch (e) {}

    db.prepare('DELETE FROM ratings WHERE anime_id = ?').run(animeId);
    db.prepare('DELETE FROM favorites WHERE anime_id = ?').run(animeId);
    db.prepare('DELETE FROM user_top5 WHERE anime_id = ?').run(animeId);
    db.prepare('DELETE FROM user_hidden_anime WHERE anime_id = ?').run(animeId);
    db.prepare('DELETE FROM comments WHERE anime_id = ?').run(animeId);
    db.prepare('DELETE FROM anime WHERE id = ?').run(animeId);

    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      success: true,
      id: animeId,
      message: anime ? `Тайтл «${anime.title}» успешно удален из базы данных` : 'Тайтл удален'
    });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Ошибка удаления тайтла: ' + err.message });
  }
});

// Dev: Delete User Account
app.delete('/api/dev/users/:id', devAdminMiddleware, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) {
      return res.status(400).json({ error: 'Неверный ID пользователя' });
    }

    const targetUser = db.prepare('SELECT id, nickname, email FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Strictly disallow deleting Just (id: 5 or nickname Just)
    if (targetUser.id === 5 || targetUser.nickname === 'Just' || targetUser.email === 'just9jeeet@gmail.com') {
      return res.status(403).json({ error: 'Нельзя удалить аккаунт главного разработчика Just' });
    }

    // 1. Delete user comment reactions
    try {
      db.prepare('DELETE FROM comment_reactions WHERE user_id = ?').run(userId);
    } catch (e) {}

    // 2. Delete reactions on comments made by this user
    try {
      db.prepare(`
        DELETE FROM comment_reactions 
        WHERE comment_id IN (SELECT id FROM comments WHERE user_id = ?)
      `).run(userId);
    } catch (e) {}

    // 3. Delete user data across all tables
    db.prepare('DELETE FROM ratings WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_top5 WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_hidden_anime WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM comments WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM friend_requests WHERE from_user_id = ? OR to_user_id = ?').run(userId, userId);
    try {
      db.prepare('DELETE FROM notifications WHERE user_id = ? OR from_user_id = ?').run(userId, userId);
    } catch (e) {}

    // 4. Delete user account
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    // 5. Update backup
    if (typeof db.saveAccountsBackup === 'function') {
      db.saveAccountsBackup();
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      success: true,
      id: userId,
      message: `Аккаунт пользователя «${targetUser.nickname}» (ID: ${targetUser.id}) успешно удален со всеми данными.`
    });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Ошибка удаления пользователя: ' + err.message });
  }
});

// Serve client in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const indexHtml = path.join(clientDist, 'index.html');
  if (require('node:fs').existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  next();
});

// Export app for Firebase Functions
module.exports = app;

// Start Server locally
if (require.main === module) {
  async function startServer() {
    console.log('[Server] Initializing database & catalog...');
    try {
      // Purge blue placeholder junk, missing_original covers, 404s, and commercial snickers promos
      db.prepare(`
        DELETE FROM ratings WHERE anime_id IN (
          SELECT id FROM anime WHERE image_url LIKE '%placehold.co%' OR image_url LIKE '%placeholder%' OR image_url LIKE '%missing_original%' OR image_url LIKE '%404%' OR image_url IS NULL OR image_url = '' OR slug LIKE 'restored-anime-%' OR title LIKE '%сникерс%' OR original_title LIKE '%snickers%'
        )
      `).run();
      db.prepare(`
        DELETE FROM favorites WHERE anime_id IN (
          SELECT id FROM anime WHERE image_url LIKE '%placehold.co%' OR image_url LIKE '%placeholder%' OR image_url LIKE '%missing_original%' OR image_url LIKE '%404%' OR image_url IS NULL OR image_url = '' OR slug LIKE 'restored-anime-%' OR title LIKE '%сникерс%' OR original_title LIKE '%snickers%'
        )
      `).run();
      db.prepare(`
        DELETE FROM anime WHERE image_url LIKE '%placehold.co%' OR image_url LIKE '%placeholder%' OR image_url LIKE '%missing_original%' OR image_url LIKE '%404%' OR image_url IS NULL OR image_url = '' OR slug LIKE 'restored-anime-%' OR title LIKE '%сникерс%' OR original_title LIKE '%snickers%'
      `).run();
      db.prepare('DELETE FROM ratings WHERE anime_id NOT IN (SELECT id FROM anime)').run();

      // Merge fate movie duplicate 7412 -> 1014
      const f1014 = db.prepare('SELECT id FROM anime WHERE id = 1014').get();
      const f7412 = db.prepare('SELECT id FROM anime WHERE id = 7412').get();
      if (f1014 && f7412) {
        db.prepare('UPDATE OR IGNORE ratings SET anime_id = 1014 WHERE anime_id = 7412').run();
        db.prepare('DELETE FROM ratings WHERE anime_id = 7412').run();
        db.prepare('DELETE FROM anime WHERE id = 7412').run();
      }

      // Guarantee MrTech 10/10 rating for Lemon Girls
      const mrTechUser = db.prepare("SELECT id FROM users WHERE nickname = 'MrTech'").get();
      const lemonAnime = db.prepare("SELECT id FROM anime WHERE title = 'Лимонные девочки'").get();
      if (mrTechUser && lemonAnime) {
        const hasRate = db.prepare('SELECT id FROM ratings WHERE user_id = ? AND anime_id = ?').get(mrTechUser.id, lemonAnime.id);
        if (!hasRate) {
          db.prepare('INSERT INTO ratings (user_id, anime_id, score, created_at, updated_at) VALUES (?, ?, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(mrTechUser.id, lemonAnime.id);
        } else {
          db.prepare('UPDATE ratings SET score = 10 WHERE id = ?').run(hasRate.id);
        }
        // Guarantee Lemon Girls in MrTech user_top5
        db.prepare('INSERT OR IGNORE INTO user_top5 (user_id, anime_id) VALUES (?, ?)').run(mrTechUser.id, lemonAnime.id);
      }

      // Strictly delete user Inspector from database if found
      const inspectorUser = db.prepare("SELECT id FROM users WHERE LOWER(nickname) = 'inspector'").get();
      if (inspectorUser) {
        db.prepare('DELETE FROM ratings WHERE user_id = ?').run(inspectorUser.id);
        db.prepare('DELETE FROM user_top5 WHERE user_id = ?').run(inspectorUser.id);
        db.prepare('DELETE FROM friend_requests WHERE from_user_id = ? OR to_user_id = ?').run(inspectorUser.id, inspectorUser.id);
        db.prepare('DELETE FROM user_hidden_anime WHERE user_id = ?').run(inspectorUser.id);
        db.prepare('DELETE FROM favorites WHERE user_id = ?').run(inspectorUser.id);
        db.prepare('DELETE FROM users WHERE id = ?').run(inspectorUser.id);
      }

      // Guarantee top-5 for user Just (id: 5)
      const justUser = db.prepare("SELECT id FROM users WHERE nickname = 'Just' OR id = 5").get();
      if (justUser) {
        const justTop5 = [3495, 1803, 1807, 2040, 2646];
        const countRow = db.prepare('SELECT COUNT(*) as count FROM user_top5 WHERE user_id = ?').get(justUser.id);
        if (!countRow || countRow.count === 0) {
          for (const aId of justTop5) {
            db.prepare('INSERT OR IGNORE INTO user_top5 (user_id, anime_id) VALUES (?, ?)').run(justUser.id, aId);
          }
        }
      }

      // Strictly purge any Lemon Girls rating or top5 from Venicek
      const venicekUser = db.prepare("SELECT id FROM users WHERE nickname = 'Venicek'").get();
      if (venicekUser && lemonAnime) {
        db.prepare('DELETE FROM ratings WHERE user_id = ? AND anime_id = ?').run(venicekUser.id, lemonAnime.id);
        db.prepare('DELETE FROM user_top5 WHERE user_id = ? AND anime_id = ?').run(venicekUser.id, lemonAnime.id);
      }
    } catch (e) {
      console.warn('[Server] Startup cleanup warning:', e.message);
    }

    await seedInitialData();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Anime Rating server running at http://0.0.0.0:${PORT}`);
    });

    // ----------------------------------------------------
    // 5-HOUR BACKGROUND CATALOG UPDATER
    // Sourced from AnimeGO (primary: https://animego.me)
    // Fallback / Reserve: Shikimori (https://shikimori.one) & AnimeLib (https://animelib.org)
    // Rule: Update once every 5 hours. Only update if new release or cover changed.
    // If not changed, DO NOT TOUCH.
    // ----------------------------------------------------
    let isCatalogUpdating = false;

    async function runPeriodicCatalogUpdate() {
      if (isCatalogUpdating) return;
      isCatalogUpdating = true;

      console.log('[Catalog Scheduler] Starting scheduled 5-hour catalog update...');
      let newTitlesAdded = 0;
      let coversUpdated = 0;

      const normalize = db.normalizeSearchText || ((s) => (s || '').toLowerCase().trim());

      function processScrapedItem(item) {
        if (!item || !item.title) return;
        const cleanTitle = item.title.trim();
        const cleanOriginal = (item.originalTitle || '').trim();
        const normTitle = normalize(cleanTitle);
        const normOriginal = normalize(cleanOriginal);

        let existing = null;
        if (item.slug) {
          existing = db.prepare('SELECT id, slug, title, original_title, image_url FROM anime WHERE slug = ?').get(item.slug);
        }
        if (!existing) {
          existing = db.prepare('SELECT id, slug, title, original_title, image_url FROM anime WHERE title_lower = ? OR (original_title_lower IS NOT NULL AND original_title_lower = ?)').get(normTitle, normOriginal);
        }

        if (existing) {
          // Existing anime: check if cover changed to a valid non-placeholder image
          const curImg = existing.image_url || '';
          const newImg = item.image || '';
          const isNewValid = newImg && !newImg.includes('missing') && !newImg.includes('404') && !newImg.includes('placehold');

          // Update ONLY if current image was missing/404/broken OR if a genuinely new cover is available
          const needsCoverUpdate = isNewValid && (curImg !== newImg) && (
            !curImg ||
            curImg.includes('missing') ||
            curImg.includes('404') ||
            curImg.includes('placehold')
          );

          if (needsCoverUpdate) {
            db.prepare(`
              UPDATE anime
              SET image_url = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(newImg, existing.id);
            coversUpdated++;
            console.log(`[Catalog Scheduler] Updated cover for "${existing.title}" (ID: ${existing.id})`);
          }
          // "если не изменили или не добавили то не трогай" - if no change, do nothing!
        } else {
          // Brand new title! Insert it into database
          insertOrUpdateAnime(item);
          newTitlesAdded++;
          console.log(`[Catalog Scheduler] Added new title: "${item.title}"`);
        }
      }

      // 1. PRIMARY SOURCE: AnimeGO (https://animego.me)
      let animeGoSuccess = false;
      try {
        console.log('[Catalog Scheduler] Primary source: Checking https://animego.me...');
        const p1 = await scrapeAnimeGoPage(1);
        const p2 = await scrapeAnimeGoPage(2);
        const animeGoItems = [...(p1 || []), ...(p2 || [])];

        if (animeGoItems.length > 0) {
          animeGoSuccess = true;
          for (const it of animeGoItems) {
            processScrapedItem(it);
          }
          console.log(`[Catalog Scheduler] AnimeGO: checked ${animeGoItems.length} titles.`);
        }
      } catch (err) {
        console.warn('[Catalog Scheduler] Primary source AnimeGO unavailable:', err.message);
      }

      // 2. FALLBACK / RESERVE SOURCES: Shikimori (https://shikimori.one) & AnimeLib
      // If AnimeGO failed or returned 0 items, fetch from reserve sources!
      if (!animeGoSuccess) {
        console.log('[Catalog Scheduler] Activating reserve sources (Shikimori & AnimeLib)...');

        // Reserve 1: Shikimori (https://shikimori.one / shikimori.io)
        try {
          const shikiRes = await fetch('https://shikimori.one/api/animes?order=popularity&status=ongoing&limit=25', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
          });
          if (shikiRes.ok) {
            const shikiList = await shikiRes.json();
            if (Array.isArray(shikiList)) {
              for (const d of shikiList) {
                const title = d.russian || d.name;
                const originalTitle = d.name || '';
                const slug = `shiki-${d.id}`;
                const image = d.image?.original ? (d.image.original.startsWith('http') ? d.image.original : `https://shikimori.one${d.image.original}`) : '';
                if (title && image) {
                  processScrapedItem({
                    slug,
                    title,
                    originalTitle,
                    image,
                    type: 'Сериал',
                    year: d.aired_on ? d.aired_on.slice(0, 4) : '',
                    genres: [],
                    description: ''
                  });
                }
              }
              console.log(`[Catalog Scheduler] Shikimori reserve processed ${shikiList.length} items.`);
            }
          }
        } catch (sErr) {
          console.warn('[Catalog Scheduler] Shikimori reserve error:', sErr.message);
        }

        // Reserve 2: AnimeLib (https://animelib.org / api.lib.social)
        try {
          const libRes = await fetch('https://api.lib.social/api/anime?page=1&site_id=5', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            }
          });
          if (libRes.ok) {
            const libData = await libRes.json();
            const libItems = libData?.data || [];
            if (Array.isArray(libItems)) {
              for (const item of libItems) {
                const title = item.rus_name || item.name;
                const originalTitle = item.eng_name || item.name || '';
                const slug = `lib-${item.slug || item.id}`;
                const image = item.cover?.default || item.cover?.thumbnail || '';
                if (title && image) {
                  processScrapedItem({
                    slug,
                    title,
                    originalTitle,
                    image,
                    type: 'Сериал',
                    year: item.releaseDate ? String(item.releaseDate).slice(0, 4) : '',
                    genres: [],
                    description: ''
                  });
                }
              }
              console.log(`[Catalog Scheduler] AnimeLib reserve processed ${libItems.length} items.`);
            }
          }
        } catch (lErr) {
          console.warn('[Catalog Scheduler] AnimeLib reserve error:', lErr.message);
        }
      }

      if (newTitlesAdded > 0 && typeof db.saveAccountsBackup === 'function') {
        db.saveAccountsBackup();
      }

      console.log(`[Catalog Scheduler] Update complete. Added: ${newTitlesAdded} new, Updated: ${coversUpdated} covers.`);
      isCatalogUpdating = false;
    }

    // Schedule: Strictly once every 5 hours (5 * 60 * 60 * 1000 = 18,000,000 ms)
    setInterval(runPeriodicCatalogUpdate, 5 * 60 * 60 * 1000);
  }

  startServer().catch(console.error);
}
