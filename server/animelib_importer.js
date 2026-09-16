const db = require('./db');

/**
 * Extracts userId or slug from AnimeLib URL
 */
function extractAnimeLibUser(input) {
  if (!input || typeof input !== 'string') return '';
  const clean = input.trim();
  const match = clean.match(/user\/([a-zA-Z0-9_-]+)/i);
  if (match) return match[1];
  return clean.replace(/^@/, '').split('/')[0].split('?')[0].trim();
}

/**
 * Parses AnimeLib raw HTML or JSON text
 */
function parseAnimeLibContent(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const text = rawText.trim();
  const allItems = [];

  // 1. Check if raw JSON was pasted
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : (parsed.data || parsed.items || parsed.bookmarks || []);
      if (Array.isArray(list) && list.length > 0) {
        for (const item of list) {
          const animeData = item.anime || item.media || item.item || item;
          const title = (animeData.rus_name || animeData.russian || animeData.name || animeData.title || '').trim();
          const originalTitle = (animeData.eng_name || animeData.name || animeData.original_title || '').trim();
          const rawScore = item.user_rating || item.user_rate || item.score || animeData.user_rating || animeData.score;
          const score = typeof rawScore === 'number' ? Math.round(rawScore) : parseInt(rawScore, 10) || 0;
          const slug = (animeData.slug || animeData.id ? `animelib-${animeData.slug || animeData.id}` : '').trim();
          const image = animeData.cover?.default || animeData.cover?.thumbnail || animeData.image || null;

          if (title) {
            allItems.push({
              slug: slug || title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'),
              title,
              originalTitle,
              score: score >= 0 && score <= 10 ? score : 0,
              image,
              type: 'Сериал'
            });
          }
        }
        if (allItems.length > 0) return allItems;
      }
    } catch (e) {
      // Not pure JSON, continue to HTML / text parsing
    }
  }

  // 2. Check for embedded Next.js or Nuxt data inside HTML
  const nextDataMatch = text.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const nextObj = JSON.parse(nextDataMatch[1]);
      const state = nextObj.props?.pageProps;
      if (state) {
        const list = state.bookmarks || state.items || state.list || [];
        if (Array.isArray(list) && list.length > 0) {
          return parseAnimeLibContent(JSON.stringify(list));
        }
      }
    } catch (e) {}
  }

  // 3. Regular expression HTML scraping for media cards
  // Matches typical AnimeLib card blocks: href="/ru/anime/slug", title / cover / score
  const cardRegex = /<a[^>]+href="(\/(?:ru\/)?(?:anime|title)\/([^"/?#]+))"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = cardRegex.exec(text)) !== null) {
    const slug = match[2].trim();
    const innerHtml = match[3];

    // Title match
    const titleMatch = innerHtml.match(/class="[^"]*(?:title|name)[^"]*"[^>]*>([\s\S]*?)<\//i) ||
                       innerHtml.match(/data-title="([^"]+)"/i) ||
                       innerHtml.match(/alt="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null;
    if (!title || title.length < 2) continue;

    // Score match (e.g. data-rating="10" or class="rating">10<)
    const scoreMatch = innerHtml.match(/(?:data-rating|data-score)="(\d+)"/i) ||
                       innerHtml.match(/class="[^"]*(?:user-score|rating|vote)[^"]*"[^>]*>\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

    // Image match
    const imgMatch = innerHtml.match(/<img[^>]+src="([^"]+)"/i);
    const image = imgMatch ? imgMatch[1] : null;

    allItems.push({
      slug: slug || title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'),
      title,
      originalTitle: '',
      score: score >= 0 && score <= 10 ? score : 0,
      image,
      type: 'Сериал'
    });
  }

  // 4. Line-based text fallback (e.g. "Магическая битва - 10" or "Шаман Кинг 9/10")
  if (allItems.length === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 3) continue;

      // Pattern: "Title [ -|:] Score" or "Title (Score/10)"
      const lineMatch = trimmed.match(/^([a-zA-Zа-яА-Я0-9\s:!—–,.'«»]+?)(?:\s*[-—–:]\s*|\s*\(?\s*)(\d{1,2})(?:\s*\/\s*10)?\s*\)?$/);
      if (lineMatch) {
        const title = lineMatch[1].trim();
        const score = parseInt(lineMatch[2], 10);
        if (title.length > 1 && score >= 0 && score <= 10) {
          allItems.push({
            slug: title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'),
            title,
            originalTitle: '',
            score,
            image: null,
            type: 'Сериал'
          });
        }
      }
    }
  }

  return allItems;
}

/**
 * Attempts to scrape from AnimeLib public profile if accessible
 */
async function scrapeAnimeLibUserList(inputUrlOrUser) {
  const user = extractAnimeLibUser(inputUrlOrUser);
  if (!user) {
    throw new Error('Укажите никнейм, ID или ссылку на профиль AnimeLib (например, https://v5.animelib.org/ru/user/12345)');
  }

  const urlsToTry = [
    `https://v5.animelib.org/ru/user/${encodeURIComponent(user)}`,
    `https://animelib.me/ru/user/${encodeURIComponent(user)}`
  ];

  for (const url of urlsToTry) {
    try {
      console.log('[AnimeLib Importer] Attempting to fetch:', url);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://v5.animelib.org/'
        }
      });

      if (res.ok) {
        const html = await res.text();
        const items = parseAnimeLibContent(html);
        if (items.length > 0) {
          console.log(`[AnimeLib Importer] Successfully parsed ${items.length} items from URL`);
          return items;
        }
      }
    } catch (err) {
      console.warn('[AnimeLib Importer] Request failed for', url, err.message);
    }
  }

  throw new Error(
    'AnimeLib защищён Cloudflare и не отдаёт профиль напрямую серверу. Пожалуйста, откройте страницу вашего списка на AnimeLib, скопируйте HTML или текст страницы (Ctrl+A, Ctrl+C) и вставьте в поле ниже!'
  );
}

module.exports = {
  extractAnimeLibUser,
  parseAnimeLibContent,
  scrapeAnimeLibUserList
};
