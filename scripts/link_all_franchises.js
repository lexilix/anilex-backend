const db = require('../server/db');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const SECRET = 'anime-friends-secret-key-2026-minimalism';
const token = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, SECRET);

function extractFranchiseBase(title) {
  if (!title) return '';
  let clean = title.replace(/\u00A0/g, ' ').trim();

  // Special cases for major franchises
  if (/^судьба[\/:]/i.test(clean)) return 'Судьба';
  if (/^восхождение в тени/i.test(clean)) return 'Восхождение в тени';
  if (/^адский рай/i.test(clean)) return 'Адский рай';
  if (/^триган/i.test(clean)) return 'Триган';
  if (/^время пыток,\s*принцесса/i.test(clean)) return 'Время пыток, принцесса';
  if (/^раб спецотряда/i.test(clean)) return 'Раб спецотряда демонического города';
  if (/^магическая битва/i.test(clean)) return 'Магическая битва';
  if (/^золотое божество/i.test(clean)) return 'Золотое божество';
  if (/^адский учитель нубэ/i.test(clean)) return 'Адский учитель Нубэ';
  if (/^клинок,\s*рассекающий демонов/i.test(clean)) return 'Клинок, рассекающий демонов';
  if (/^атака титанов/i.test(clean)) return 'Атака титанов';
  if (/^re:zero/i.test(clean)) return 'Re:Zero';
  if (/^о моём перерождении в слизь/i.test(clean)) return 'О моём перерождении в слизь';
  if (/^восхождение героя щита/i.test(clean)) return 'Восхождение героя щита';
  if (/^бакуган/i.test(clean) || /^отчаянные бойцы бакуган/i.test(clean)) return 'Бакуган';
  if (/^моя геройская академия/i.test(clean)) return 'Моя геройская академия';
  if (/^семья шпиона/i.test(clean)) return 'Семья шпиона';
  if (/^мастера меча онлайн/i.test(clean)) return 'Мастера Меча Онлайн';
  if (/^человек-бензопила/i.test(clean)) return 'Человек-бензопила';
  if (/^ванпанчмен/i.test(clean)) return 'Ванпанчмен';
  if (/^доктор стоун/i.test(clean)) return 'Доктор Стоун';
  if (/^невероятные приключения джоджо/i.test(clean)) return 'Невероятные приключения ДжоДжо';
  if (/^этот замечательный мир/i.test(clean) || /^коносуба/i.test(clean)) return 'Этот замечательный мир!';
  if (/^госпожа кагуя/i.test(clean)) return 'Госпожа Кагуя';
  if (/^токийский гуль/i.test(clean)) return 'Токийский гуль';
  if (/^психопаспорт/i.test(clean)) return 'Психопаспорт';
  if (/^черный клевер/i.test(clean) || /^чёрный клевер/i.test(clean)) return 'Чёрный клевер';
  if (/^семь смертных грехов/i.test(clean)) return 'Семь смертных грехов';
  if (/^врата штейна/i.test(clean)) return 'Врата Штейна';
  if (/^бездомный бог/i.test(clean)) return 'Бездомный бог';
  if (/^код гиас/i.test(clean)) return 'Код Гиас';
  if (/^моб психо 100/i.test(clean)) return 'Моб Психо 100';
  if (/^синий экзорцист/i.test(clean)) return 'Синий экзорцист';
  if (/^блич/i.test(clean)) return 'Блич';
  if (/^евангелион/i.test(clean)) return 'Евангелион';
  if (/^проза бродячих псов/i.test(clean) || /^великий из бродячих псов/i.test(clean)) return 'Великий из бродячих псов';
  if (/^баскетбол куроко/i.test(clean)) return 'Баскетбол Куроко';
  if (/^волейбол/i.test(clean)) return 'Волейбол!!';
  if (/^хайкью/i.test(clean)) return 'Волейбол!!';

  const splitParts = clean.split(/\s*[-—–:!.]\s*/);
  if (splitParts[0] && splitParts[0].length >= 4) {
    clean = splitParts[0].trim();
  }
  clean = clean
    .replace(/\s+(?:[2-9]|10|II|III|IV|V|VI|VII|VIII|IX|X)\b/gi, '')
    .replace(/\s+(?:2-й|3-й|4-й|5-й|6-й|7-й|8-й|9-й|10-й|второй|третий|четвертый|пятый)\s+сезон\b/gi, '')
    .replace(/\s+сезон\s+[0-9]+\b/gi, '')
    .replace(/\s+Часть\s+[0-9]+\b/gi, '')
    .replace(/\s+Part\s+[0-9]+\b/gi, '')
    .replace(/\s+Фильм.*$/gi, '')
    .replace(/\s+Movie.*$/gi, '')
    .replace(/\s+OVA.*$/gi, '')
    .replace(/\s+ONA.*$/gi, '')
    .replace(/\s+Спешл.*$/gi, '')
    .replace(/[-—–!.:]+$/, '')
    .trim();
  return clean;
}

function detectAnimeSeason(title, originalTitle, type) {
  const fullText = (title + ' ' + (originalTitle || '')).trim();
  const seasonMatch = fullText.match(/(?:(?:(\d+)[- ]*(?:й|ой|ий|ый)?\s*сезон)|(?:сезон\s*(\d+))|(?:(\d+)(?:st|nd|rd|th)\s*season)|(?:season\s*(\d+)))/i);
  if (seasonMatch) {
    const num = seasonMatch[1] || seasonMatch[2] || seasonMatch[3] || seasonMatch[4];
    return num + '-й сезон';
  }
  const trailingNumMatch = (title || '').trim().match(/\s+(\d+)$/);
  if (trailingNumMatch) {
    return trailingNumMatch[1] + '-й сезон';
  }
  const partMatch = fullText.match(/(?:часть\s*(\d+)|part\s*(\d+))/i);
  if (partMatch) {
    return 'Часть ' + (partMatch[1] || partMatch[2]);
  }
  if (/фильм|movie/i.test(fullText) || type === 'Фильм') {
    const movieNum = fullText.match(/(?:фильм|movie)\s*(\d+)/i);
    return movieNum ? 'Фильм ' + movieNum[1] : 'Фильм';
  }
  if (/ova|ова/i.test(fullText) || type === 'OVA') return 'OVA';
  if (/ona|она/i.test(fullText) || type === 'ONA') return 'ONA';
  if (/спешл|special/i.test(fullText) || type === 'Спешл') return 'Спешл';
  if (type === 'Сериал') return '1-й сезон';
  return 'Связанная часть';
}

async function run() {
  console.log('1. Ensuring Hell Teacher Nube (Part 1) exists...');
  const nubeExists = db.prepare('SELECT id FROM anime WHERE id = 7196').get();
  if (!nubeExists) {
    db.prepare(`
      INSERT OR IGNORE INTO anime (id, slug, title, title_lower, original_title, original_title_lower, image_url, type, year, genres, description, season, related_json)
      VALUES (7196, 'jigoku-sensei-nube-2025', 'Адский учитель Нубэ (2025)', 'адский учитель нубэ (2025)', 'Jigoku Sensei Nube (2025) / Hell Teacher: Jigoku Sensei Nube', 'jigoku sensei nube (2025) / hell teacher: jigoku sensei nube', 'https://shikimori.one/system/animes/original/58957.jpg', 'Сериал', '2025', '["Комедия","Сёнэн","Сверхъестественное"]', 'Мэйсукэ Нуэно «Нубэ», учитель начальной школы Доумори и знаток потустороннего мира, защищает учеников от демонов с помощью своей демонической руки.', '1-й сезон', '[]')
    `).run();
  }

  console.log('2. Loading all anime from SQLite...');
  const allAnime = db.prepare('SELECT id, title, original_title, year, type, season, image_url, related_json FROM anime').all();

  const groups = {};
  for (const a of allAnime) {
    const base = extractFranchiseBase(a.title);
    if (base && base.length >= 4) {
      const key = base.toLowerCase();
      if (!groups[key]) groups[key] = { base, items: [] };
      groups[key].items.push(a);
    }
  }

  const franchiseClusters = Object.values(groups).filter(g => g.items.length > 1);
  console.log(`Found ${franchiseClusters.length} franchise clusters (>1 title).`);

  const updateStmt = db.prepare(`
    UPDATE anime
    SET season = ?, related_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  let totalUpdated = 0;
  const keyClustersToSyncRender = [];

  db.exec('BEGIN TRANSACTION;');

  for (const cluster of franchiseClusters) {
    // Sort cluster items chronologically by year / season / id
    cluster.items.sort((a, b) => {
      const yA = parseInt(a.year, 10) || 0;
      const yB = parseInt(b.year, 10) || 0;
      if (yA !== yB) return yA - yB;
      return a.id - b.id;
    });

    // Determine season for each item if not set
    for (let i = 0; i < cluster.items.length; i++) {
      const item = cluster.items[i];
      if (!item.season || item.season === 'Без сезона' || item.season === 'Связанная часть') {
        const detected = detectAnimeSeason(item.title, item.original_title, item.type);
        // If detected is generic "1-й сезон" but this is item i > 0 in a serial franchise, compute sequential season
        if (detected === '1-й сезон' && i > 0 && item.type === 'Сериал' && !item.title.match(/сезон\s*1\b|1-й\s*сезон/i)) {
          // Check if title has a number
          const numMatch = item.title.match(/\s+(\d+)$/);
          if (numMatch) {
            item.season = numMatch[1] + '-й сезон';
          } else {
            item.season = (i + 1) + '-й сезон';
          }
        } else {
          item.season = detected;
        }
      }
    }

    // Now link each item to all others
    for (const item of cluster.items) {
      const relatedList = cluster.items
        .filter(other => other.id !== item.id)
        .map(other => ({
          id: other.id,
          title: other.title,
          imageUrl: other.image_url || '',
          year: other.year || '',
          type: other.type || 'Сериал',
          relation: other.season || 'Связанная часть'
        }));

      updateStmt.run(item.season, JSON.stringify(relatedList), item.id);
      totalUpdated++;
    }

    // Check if this cluster contains user highlighted titles
    const isTargetCluster = cluster.items.some(it => {
      const t = it.title.toLowerCase();
      return t.includes('восхождение в тени') ||
             t.includes('адский рай') ||
             t.includes('триган') ||
             t.includes('время пыток') ||
             t.includes('раб спецотряда') ||
             t.includes('магическая битва') ||
             t.includes('золотое божество') ||
             t.includes('адский учитель нубэ') ||
             t.includes('судьба') ||
             t.includes('бакуган') ||
             t.includes('моя геройская');
    });

    if (isTargetCluster) {
      keyClustersToSyncRender.push(cluster);
    }
  }

  db.exec('COMMIT;');
  console.log(`3. Successfully updated ${totalUpdated} anime in SQLite with seasons and relations!`);

  // 4. Update initialCatalog.json
  const catalogPath = path.join(__dirname, '../client/src/data/initialCatalog.json');
  if (fs.existsSync(catalogPath)) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    let catalogUpdates = 0;
    for (const item of catalog) {
      const row = db.prepare('SELECT season, related_json FROM anime WHERE id = ?').get(item.id);
      if (row) {
        if (row.season) item.season = row.season;
        if (row.related_json && row.related_json !== '[]') {
          try {
            item.linkedAnime = JSON.parse(row.related_json);
            item.related_json = row.related_json;
            catalogUpdates++;
          } catch (e) {}
        }
      }
    }
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
    console.log(`4. Updated initialCatalog.json (${catalogUpdates} titles updated).`);
  }

  // 5. Save persistent accounts backup
  if (typeof db.saveAccountsBackup === 'function') {
    db.saveAccountsBackup();
    console.log('5. Saved clean backup to accounts_backup.json and permanent backup.');
  }

  // 6. Direct HTTP sync key clusters to Render
  console.log(`6. Syncing ${keyClustersToSyncRender.length} key franchise clusters to Render...`);
  for (const cluster of keyClustersToSyncRender) {
    for (const item of cluster.items) {
      try {
        const row = db.prepare('SELECT * FROM anime WHERE id = ?').get(item.id);
        if (!row) continue;
        const linked = JSON.parse(row.related_json || '[]');
        const res = await fetch(`https://anilex-backend.onrender.com/api/dev/anime/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title: row.title,
            originalTitle: row.original_title,
            season: row.season,
            linkedAnime: linked,
            related_json: row.related_json
          })
        });
        console.log(`Render sync ${item.id} (${item.title}): status ${res.status}`);
      } catch (err) {
        console.error(`Render sync error for ${item.id}:`, err.message);
      }
    }
  }

  console.log('All done!');
}

run();
