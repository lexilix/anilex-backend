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
  authMiddleware,
  optionalAuthMiddleware
} = require('./auth');
const {
  seedInitialData,
  syncFromAnimeGo,
  fetchNextAnimeGoPage,
  fetchOngoingAnime,
  searchAnimeGo,
  searchShikimori
} = require('./scraper');
const {
  scrapeAnimeGoUserList,
  parseAnimeGoHtml,
  importUserRatings
} = require('./animego_importer');

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
    version: '1.0.4',
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
    const user = db.prepare('SELECT id, email, nickname, avatar_url, banner_url, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
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
      WHERE ${nickCol} LIKE ?
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
          ratedCount: canSeeScore ? (u.rated_count || 0) : null,
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
      return res.json({ success: true, status: 'pending_sent', requestId: existingDirect.id });
    }

    if (existingReverse) {
      if (existingReverse.status === 'accepted') {
        return res.json({ success: true, status: 'accepted', message: 'Вы уже друзья' });
      }
      if (existingReverse.status === 'pending') {
        // Automatically accept reverse request
        db.prepare("UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(existingReverse.id);
        return res.json({ success: true, status: 'accepted', message: 'Заявка принята!' });
      }
    }

    const insertResult = db.prepare(`
      INSERT INTO friend_requests (from_user_id, to_user_id, status)
      VALUES (?, ?, 'pending')
    `).run(currentUserId, targetUserId);

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

    if (targetUserId === currentUserId) {
      isFriend = true;
      friendshipStatus = 'self';
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

    const stats = db.prepare(`
      SELECT COUNT(id) as rated_count, ROUND(AVG(score), 1) as avg_score
      FROM ratings WHERE user_id = ?
    `).get(targetUserId);

    // Ratings list is sent ONLY if isFriend is true!
    let ratings = [];
    if (isFriend) {
      ratings = db.prepare(`
        SELECT a.id, a.slug, a.title, a.image_url, a.type, a.year, a.genres, r.score, r.updated_at
        FROM ratings r
        JOIN anime a ON r.anime_id = a.id
        WHERE r.user_id = ?
        ORDER BY r.score DESC, r.updated_at DESC
      `).all(targetUserId);
    }

    return res.json({
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        bannerUrl: user.banner_url,
        createdAt: user.created_at,
        ratedCount: isFriend ? (stats.rated_count || 0) : null,
        avgScore: isFriend && stats.avg_score !== null ? Number(stats.avg_score) : null,
        isFriend,
        friendshipStatus,
        requestId
      },
      ratings: ratings.map(r => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        imageUrl: r.image_url,
        type: r.type,
        year: r.year,
        genres: JSON.parse(r.genres || '[]'),
        score: r.score,
        updatedAt: r.updated_at
      })),
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
      SELECT u.id, u.nickname, u.email, u.avatar_url,
             COUNT(r.id) as rated_count,
             ROUND(AVG(r.score), 1) as avg_score
      FROM users u
      LEFT JOIN ratings r ON u.id = r.user_id
      GROUP BY u.id
      ORDER BY rated_count DESC, u.nickname ASC
    `).all();

    return res.json({
      friends: users.map(u => ({
        id: u.id,
        nickname: u.nickname,
        email: u.email,
        avatarUrl: u.avatar_url,
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

    const sortedGenres = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({ genres: sortedGenres });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка получения жанров' });
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
      limit = 20
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

      // Check if we have matches in local DB using indexed Unicode lower columns
      let andConditions = [];
      let andParams = [];
      for (const w of meaningfulWords) {
        andConditions.push('(title_lower LIKE ? OR original_title_lower LIKE ?)');
        andParams.push(`%${w}%`, `%${w}%`);
      }

      const countCheckSql = `SELECT COUNT(id) as cnt FROM anime WHERE ${andConditions.join(' AND ')}`;
      const countCheck = db.prepare(countCheckSql).get(...andParams);

      if (!countCheck || countCheck.cnt === 0) {
        console.log(`[Search Fallback] No local results for "${cleanSearch}". Searching AnimeGO & Shikimori...`);
        try {
          await searchAnimeGo(cleanSearch);
          await searchShikimori(cleanSearch);
        } catch (e) {
          console.error('[Search Fallback] Error fetching online anime sources:', e);
        }
      }

      // Add WHERE condition: ALL meaningful words must match in title_lower or original_title_lower!
      for (const w of meaningfulWords) {
        whereClauses.push('(a.title_lower LIKE ? OR a.original_title_lower LIKE ?)');
        params.push(`%${w}%`, `%${w}%`);
      }

      // Relevance rank cases:
      // Exact title match: 100
      // Starts with title: 50
      // Contains full phrase: 30
      // Per matching word in title: 10
      // Per matching word in original_title: 5
      let rankCases = [
        '(CASE WHEN a.title_lower = ? THEN 100 WHEN a.original_title_lower = ? THEN 80 ELSE 0 END)',
        '(CASE WHEN a.title_lower LIKE ? THEN 50 WHEN a.original_title_lower LIKE ? THEN 40 ELSE 0 END)',
        '(CASE WHEN a.title_lower LIKE ? THEN 30 WHEN a.original_title_lower LIKE ? THEN 20 ELSE 0 END)'
      ];
      searchRankParams.push(normSearch, normSearch, `${normSearch}%`, `${normSearch}%`, `%${normSearch}%`, `%${normSearch}%`);

      for (const w of meaningfulWords) {
        rankCases.push('(CASE WHEN a.title_lower LIKE ? THEN 10 WHEN a.original_title_lower LIKE ? THEN 5 ELSE 0 END)');
        searchRankParams.push(`%${w}%`, `%${w}%`);
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

    // Status filter
    if (filterStatus === 'friends_rated') {
      whereClauses.push('(SELECT COUNT(*) FROM ratings WHERE anime_id = a.id) > 0');
    } else if (filterStatus === 'my_rated' && currentUserId) {
      whereClauses.push('(SELECT COUNT(*) FROM ratings WHERE anime_id = a.id AND user_id = ?) > 0');
      params.push(currentUserId);
    } else if (filterStatus === 'my_unrated' && currentUserId) {
      whereClauses.push('(SELECT COUNT(*) FROM ratings WHERE anime_id = a.id AND user_id = ?) = 0');
      params.push(currentUserId);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Check if we need to auto-scrape next page from AnimeGO on the fly!
    // When requesting near the end of catalog and not doing a narrow text search:
    if ((!filterStatus || filterStatus === 'all') && !search && (!genres || genres.trim().length === 0) && (!type || type === 'all')) {
      const currentTotalRow = db.prepare(`SELECT COUNT(DISTINCT a.id) as total FROM anime a ${whereSql}`).get(...params);
      const currentTotal = currentTotalRow ? currentTotalRow.total : 0;

      if (offset + limitNum >= currentTotal) {
        console.log(`[AnimeGO Live Sync] Approaching end of catalog (${offset + limitNum} >= ${currentTotal}). Auto-scraping next page...`);
        try {
          await fetchNextAnimeGoPage();
        } catch (e) {
          console.error('[AnimeGO Live Sync] Error scraping next page:', e);
        }
      }
    }

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

    const totalRow = db.prepare(countSql).get(...params);
    const items = db.prepare(querySql).all(currentUserId || -1, currentUserId || -1, ...params, ...searchRankParams, limitNum, offset);

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
        myScore: item.my_score !== null && item.my_score !== undefined ? item.my_score : null,
        isFavorite: Boolean(item.is_favorite),
        averageScore: item.rating_count > 0 && item.avg_score !== null ? Number(item.avg_score) : null,
        ratingCount: Number(item.rating_count),
        commentsCount: Number(item.comments_count || 0),
        friendsRatings: friendsMap[item.id] || []
      });
    }

    return res.json({
      items: formattedItems,
      total: totalRow ? totalRow.total : 0,
      page: pageNum,
      limit: limitNum,
      totalPages: isCatalogEndless ? Math.max(pageNum + 20, 500) : Math.ceil((totalRow ? totalRow.total : 0) / limitNum),
      recommendationGenresCount: recommendedGenres.length
    });
  } catch (err) {
    console.error('Error fetching anime:', err);
    return res.status(500).json({ error: 'Ошибка получения каталога аниме' });
  }
});

// Single Anime
app.get('/api/anime/:id', optionalAuthMiddleware, (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const animeId = parseInt(req.params.id, 10);

    const anime = db.prepare('SELECT * FROM anime WHERE id = ?').get(animeId);
    if (!anime) {
      return res.status(404).json({ error: 'Аниме не найдено' });
    }

    const stats = db.prepare(`
      SELECT ROUND(AVG(score), 1) as avg_score, COUNT(id) as rating_count
      FROM ratings WHERE anime_id = ?
    `).get(animeId);

    let myScore = null;
    let isFavorite = false;
    if (currentUserId) {
      const myRow = db.prepare('SELECT score FROM ratings WHERE anime_id = ? AND user_id = ?').get(animeId, currentUserId);
      if (myRow) myScore = myRow.score;

      const favRow = db.prepare('SELECT id FROM favorites WHERE anime_id = ? AND user_id = ?').get(animeId, currentUserId);
      if (favRow) isFavorite = true;
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
      genres: JSON.parse(anime.genres || '[]'),
      description: anime.description,
      myScore,
      isFavorite,
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
  let clean = title.trim();
  const splitParts = clean.split(/\s*[—–:]\s*/);
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
    .replace(/\.+$/, '')
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

    const target = db.prepare('SELECT id, slug, title, original_title, year, type, image_url FROM anime WHERE id = ?').get(animeId);
    if (!target) {
      return res.status(404).json({ error: 'Аниме не найдено' });
    }

    const resultsMap = new Map();
    const normalize = db.normalizeSearchText || ((s) => (s || '').toLowerCase().trim());
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
          ROUND(AVG(r.score), 1) as avg_score,
          COUNT(r.id) as rating_count,
          (SELECT score FROM ratings WHERE anime_id = a.id AND user_id = ?) as my_score
        FROM anime a
        LEFT JOIN ratings r ON a.id = r.anime_id
        WHERE a.title_lower LIKE ?
        GROUP BY a.id
      `).all(currentUserId || -1, `${normBase}%`);

      const escapedBase = normBase.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`^${escapedBase}(?:\\s+(?:[0-9]+|II|III|IV|V|VI|VII|VIII|IX|X|сезон|фильм|часть|ova|спешл|movie|final|код|тренировка|бесконечный|деревня|квартал|поезд)|:|$|\\s*[—–\\-]|\\.)`, 'i');

      for (const c of candidates) {
        const normCand = normalize(c.title);
        if (!regex.test(normCand)) continue;

        let relation = 'Связанная часть';
        const tLower = normCand;
        if (c.id === target.id) {
          relation = 'Текущий тайтл';
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
        } else if (/фильм|movie/i.test(tLower) || c.type === 'Фильм') {
          relation = 'Фильм';
        } else if (/ova|спешл|ona/i.test(tLower) || c.type === 'OVA') {
          relation = 'Спешл / OVA';
        } else if (!/[0-9]/.test(tLower)) {
          relation = '1-й сезон / Начало';
        }

        resultsMap.set(c.id, {
          id: c.id,
          slug: c.slug,
          title: c.title,
          originalTitle: c.original_title,
          year: c.year,
          type: c.type,
          imageUrl: c.image_url,
          relation,
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

    return res.json({ success: true, isFavorite });
  } catch (err) {
    console.error('Toggle favorite error:', err);
    return res.status(500).json({ error: 'Ошибка обновления избранного' });
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

// Rated Anime list for user profile
app.get('/api/user/rated-anime', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { search, genres, type, sort = 'my_score_desc' } = req.query;

    const params = [userId];
    let whereClauses = ['r.user_id = ?'];

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
    const { score } = req.body;

    const anime = db.prepare('SELECT id FROM anime WHERE id = ?').get(animeId);
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
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: JSON.parse(n.data || '{}'),
        isRead: Boolean(n.is_read),
        createdAt: n.created_at
      })),
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
    await seedInitialData();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Anime Rating server running at http://0.0.0.0:${PORT}`);
    });
  }

  startServer().catch(console.error);
}
