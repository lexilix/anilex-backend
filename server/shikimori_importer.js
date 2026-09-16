const db = require('./db');

/**
 * Extracts clean username from URL or raw input
 */
function extractShikimoriUsername(input) {
  if (!input || typeof input !== 'string') return '';
  let clean = input.trim();
  // Match URLs like https://shikimori.one/username, https://shikimori.io/username, etc.
  const urlMatch = clean.match(/shikimori\.(?:one|io|me)\/(?:users\/)?([a-zA-Z0-9_-]+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }
  // Remove leading @ or query params
  clean = clean.replace(/^@/, '').split('/')[0].split('?')[0].trim();
  return clean;
}

/**
 * Maps Shikimori kind to Russian anime type
 */
function mapShikimoriKind(kind) {
  switch ((kind || '').toLowerCase()) {
    case 'movie':
      return 'Фильм';
    case 'ova':
      return 'OVA';
    case 'ona':
      return 'ONA';
    case 'special':
      return 'Спешл';
    case 'music':
      return 'Клип';
    default:
      return 'Сериал';
  }
}

/**
 * Scrapes user anime rates from Shikimori public API
 */
async function scrapeShikimoriUserRates(usernameOrUrl) {
  const username = extractShikimoriUsername(usernameOrUrl);
  if (!username) {
    throw new Error('Укажите никнейм или ссылку на профиль Shikimori (например, https://shikimori.one/nickname)');
  }

  console.log('[Shikimori Importer] Fetching anime rates for user:', username);
  const allItems = [];
  let page = 1;
  const limit = 500;
  const maxPages = 20; // up to 10,000 anime

  while (page <= maxPages) {
    const url = `https://shikimori.one/api/users/${encodeURIComponent(username)}/anime_rates?limit=${limit}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Anilex/1.0.6 (https://anilex-anime.web.app)',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Пользователь «${username}» не найден на Shikimori`);
      }
      if (res.status === 403 || res.status === 401) {
        throw new Error('Список аниме этого пользователя на Shikimori скрыт настройками приватности');
      }
      throw new Error(`Ошибка ответа Shikimori API: HTTP ${res.status}`);
    }

    const rates = await res.json();
    if (!Array.isArray(rates) || rates.length === 0) {
      break;
    }

    for (const r of rates) {
      const anime = r.anime;
      if (!anime) continue;

      const title = (anime.russian || anime.name || '').trim();
      const originalTitle = (anime.name || '').trim();
      if (!title) continue;

      let image = null;
      if (anime.image) {
        const rawImg = anime.image.original || anime.image.preview;
        if (rawImg) {
          image = rawImg.startsWith('http') ? rawImg : `https://shikimori.one${rawImg}`;
        }
      }

      let year = null;
      if (anime.aired_on) {
        const y = parseInt(anime.aired_on.slice(0, 4), 10);
        if (y > 1950 && y < 2050) year = String(y);
      }

      const slug = (anime.url || '').replace('/animes/', '').trim() || `shiki-${anime.id}`;
      const score = typeof r.score === 'number' && r.score >= 0 && r.score <= 10 ? r.score : 0;

      allItems.push({
        slug,
        title,
        originalTitle,
        score,
        image,
        type: mapShikimoriKind(anime.kind),
        year,
        description: title
      });
    }

    console.log(`[Shikimori Importer] Page ${page}: retrieved ${rates.length} rates. Total: ${allItems.length}`);
    if (rates.length < limit) {
      break;
    }
    page++;
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return allItems;
}

module.exports = {
  extractShikimoriUsername,
  scrapeShikimoriUserRates
};
