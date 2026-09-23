const fs = require('fs');

async function searchAnimeGo(query) {
  try {
    const res = await fetch(`https://animego.me/search/all?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const linkMatch = html.match(/\/anime\/([a-z0-9\-]+)/i);
    if (!linkMatch) return null;
    const slug = linkMatch[1];
    const pageUrl = `https://animego.me/anime/${slug}`;
    const pageRes = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const pageHtml = await pageRes.text();
    const titleMatch = pageHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const origMatch = pageHtml.match(/<li[^>]*class="[^"]*text-muted[^"]*"[^>]*>([^<]+)<\/li>/i) || pageHtml.match(/<span>([^<]+)<\/span>/);
    const imgMatch = pageHtml.match(/src="([^"]+\/upload\/anime\/images\/[^"]+)"/i) || pageHtml.match(/<img[^>]+src="([^"]+anime\/images[^"]+)"/i);
    const yearMatch = pageHtml.match(/href="\/anime\/year\/(\d{4})"/i);
    const typeMatch = pageHtml.match(/href="\/anime\/type\/([^"]+)"[^>]*>([^<]+)<\/a>/i);
    const descMatch = pageHtml.match(/<div class="description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    let cleanDesc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    return {
      title: titleMatch ? titleMatch[1].trim() : query,
      originalTitle: origMatch ? origMatch[1].trim() : '',
      imageUrl: imgMatch ? (imgMatch[1].startsWith('http') ? imgMatch[1] : `https://animego.me${imgMatch[1]}`) : '',
      year: yearMatch ? yearMatch[1] : '',
      type: typeMatch ? typeMatch[2].trim() : 'Сериал',
      description: cleanDesc,
      source: 'animego'
    };
  } catch (e) {
    console.error(`AnimeGO error for ${query}:`, e.message);
    return null;
  }
}

async function searchShikimori(query) {
  try {
    const res = await fetch(`https://shikimori.io/api/animes?search=${encodeURIComponent(query)}&limit=5`, {
      headers: { 'User-Agent': 'Anilex-Catalog/1.0', 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) return null;
    const top = list[0];
    const dRes = await fetch(`https://shikimori.io/api/animes/${top.id}`, {
      headers: { 'User-Agent': 'Anilex-Catalog/1.0', 'Accept': 'application/json' }
    });
    if (!dRes.ok) return null;
    const d = await dRes.json();
    let img = d.image?.original ? (d.image.original.startsWith('http') ? d.image.original : `https://shikimori.io${d.image.original}`) : '';
    if (!img || img.includes('missing_original')) {
      img = d.image?.preview ? (d.image.preview.startsWith('http') ? d.image.preview : `https://shikimori.io${d.image.preview}`) : '';
    }
    const typeMap = { tv: 'Сериал', movie: 'Фильм', ova: 'OVA', ona: 'ONA', special: 'Спешл' };
    return {
      shikiId: top.id,
      title: d.russian || top.name,
      originalTitle: top.name || '',
      imageUrl: img,
      year: top.aired_on ? top.aired_on.slice(0, 4) : '',
      type: typeMap[top.kind] || 'Сериал',
      genres: Array.isArray(d.genres) ? d.genres.map(g => g.russian || g.name) : [],
      description: d.description || '',
      source: 'shikimori'
    };
  } catch (e) {
    console.error(`Shikimori error for ${query}:`, e.message);
    return null;
  }
}

async function main() {
  const titlesToFetch = [
    { key: 'josee', qAnimego: 'Её заветное желание', qShiki: 'Josee to Tora to Sakana-tachi' },
    { key: 'medaka', qAnimego: 'Мэдака Куроива не понимает моей привлекательности', qShiki: 'Kuroiwa Medaka ni Watashi no Kawaii ga Tsuujinai' },
    { key: 'toradora', qAnimego: 'Торадора!', qShiki: 'Toradora!' },
    { key: 'toradora_ova', qAnimego: 'Торадора! Секрет приготовления бэнто', qShiki: 'Toradora! Bento no Gokui' },
    { key: 'secrets', qAnimego: 'Ты умеешь хранить секреты?', qShiki: 'Kono Kaisha ni Suki na Hito ga Imasu' },
    { key: 'reincarnation_kaben', qAnimego: 'Лепестки реинкарнации', qShiki: 'Reincarnation no Kaben' },
    { key: 'atelier', qAnimego: 'Ателье колдовских колпаков', qShiki: 'Tongari Boushi no Atelier' },
    { key: 'mushoku_goblin', qAnimego: 'Реинкарнация безработного Эрис убийца гоблинов', qShiki: 'Mushoku Tensei: Eris no Goblin Toubatsu' },
    { key: 'bluelock_nagi', qAnimego: 'Синяя тюрьма Блю Лок Эпизод с Наги', qShiki: 'Blue Lock: Episode Nagi' },
    { key: 'bluelock_s2', qAnimego: 'Синяя тюрьма Блю Лок 2', qShiki: 'Blue Lock vs. U-20 Japan' }
  ];

  const results = {};
  for (const item of titlesToFetch) {
    console.log(`Fetching ${item.key}...`);
    let data = await searchAnimeGo(item.qAnimego);
    if (!data || !data.imageUrl || data.imageUrl.includes('missing')) {
      console.log(`  Fallback to Shikimori for ${item.key}...`);
      const shikiData = await searchShikimori(item.qShiki);
      if (shikiData) {
        if (!data) data = shikiData;
        else {
          if (!data.imageUrl || data.imageUrl.includes('missing')) data.imageUrl = shikiData.imageUrl;
          if (!data.genres || data.genres.length === 0) data.genres = shikiData.genres;
          if (!data.description) data.description = shikiData.description;
          if (!data.originalTitle) data.originalTitle = shikiData.originalTitle;
        }
      }
    }
    results[item.key] = data;
    await new Promise(r => setTimeout(r, 600));
  }

  fs.writeFileSync('scripts/fetched_photo4_results.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('Done! Saved to scripts/fetched_photo4_results.json');
}

main();
