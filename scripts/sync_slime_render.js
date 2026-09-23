const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'anime-friends-secret-key-2026-minimalism';
const tokenJust = jwt.sign({ id: 5, email: 'just9jeeet@gmail.com', nickname: 'Just' }, JWT_SECRET, { expiresIn: '30d' });

const slimeTitles = [
  {
    id: 7191,
    title: 'О моём перерождении в слизь',
    originalTitle: 'Tensei shitara Slime Datta Ken / That Time I Got Reincarnated as a Slime',
    imageUrl: 'https://shikimori.one/system/animes/original/37430.jpg?1711977107',
    type: 'Сериал',
    year: '2018',
    genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'Знакомьтесь! Сатору Миками, 37-летний рядовой служащий крупной финансовой компании. Погибнув от ножевого ранения грабителя, он перерождается в фэнтезийном мире в виде разумной слизи с уникальным навыком «Великий Мудрец» и «Хищник».',
    season: '1-й сезон'
  },
  {
    id: 7192,
    title: 'О моём перерождении в слизь 2',
    originalTitle: 'Tensei shitara Slime Datta Ken 2nd Season / That Time I Got Reincarnated as a Slime Season 2',
    imageUrl: 'https://shikimori.one/system/animes/original/39551.jpg?1711977070',
    type: 'Сериал',
    year: '2021',
    genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'После перерождения Сатору в новом мире в качестве слизи по имени Римуру Темпест, основанное им государство монстров процветает. Однако мирная жизнь рушится, когда на Темпест нападают враждебные королевства.',
    season: '2-й сезон'
  },
  {
    id: 7197,
    title: 'О моём перерождении в слизь 2. Часть 2',
    originalTitle: 'Tensei shitara Slime Datta Ken 2nd Season Part 2 / That Time I Got Reincarnated as a Slime Season 2 Part 2',
    imageUrl: 'https://shikimori.one/system/animes/original/41487.jpg?1711977051',
    type: 'Сериал',
    year: '2021',
    genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'Справившись с обрушившейся на страну трагедией, Римуру Темпест, пробудившийся как истинный Князь Тьмы, готовится заявить миру о правах монстров и столкнуться с коварным Клейманом на Вальпургиевом совете.',
    season: '2-й сезон часть 2'
  },
  {
    id: 7198,
    title: 'О моём перерождении в слизь: Алые узы',
    originalTitle: 'Tensei shitara Slime Datta Ken Movie: Guren no Kizuna-hen / That Time I Got Reincarnated as a Slime: Scarlet Bond',
    imageUrl: 'https://shikimori.one/system/animes/original/49877.jpg?1709524281',
    type: 'Фильм',
    year: '2022',
    genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'История разворачивается вокруг небольшого королевства Раджа к западу от Темпеста. Римуру и его союзники встречают Хииро — выжившего огра и названого брата Бенимару, чья верность королеве Тове ведет к масштабному конфликту.',
    season: 'Фильм 1'
  },
  {
    id: 7199,
    title: 'О моём перерождении в слизь: Мечта Колеуса',
    originalTitle: 'Tensei shitara Slime Datta Ken: Coleus no Yume / That Time I Got Reincarnated as a Slime: Visions of Coleus',
    imageUrl: 'https://shikimori.one/system/animes/original/54565.jpg?1716771883',
    type: 'ONA',
    year: '2023',
    genres: ['Экшен', 'Приключения', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'По просьбе Юки Кагурадзаки, Римуру отправляется в королевство Колеус, где назревает ожесточенная борьба за трон между принцами Сауроном и Асланом.',
    season: 'Спешл'
  },
  {
    id: 1446,
    title: 'О моём перерождении в слизь 3',
    originalTitle: 'Tensei shitara Slime Datta Ken 3rd Season',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/66/66732cd781462452350534',
    type: 'Сериал',
    year: '2024',
    genres: ['Экшен', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'Римуру Темпест одерживает победу в решающем поединке с Повелителем демонов Клейманом и официально занимает свое место в «Октаграмме». Впереди — переговоры со Священной империей Любелиос и Хината Сакагучи.',
    season: '3-й сезон'
  },
  {
    id: 650,
    title: 'О моём перерождении в слизь: Слёзы синего моря',
    originalTitle: 'Tensei shitara Slime Datta Ken Movie 2: Soukai no Namida-hen',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/6a/6a46479ee4c2c213407168',
    type: 'Фильм',
    year: '2026',
    genres: ['Экшен', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'В глубинах океана скрывается процветающее королевство Кайэн под покровительством Водяного дракона. Новые вызовы зовут Римуру и жителей Темпеста в морские просторы.',
    season: 'Фильм 2'
  },
  {
    id: 914,
    title: 'О моём перерождении в слизь 4',
    originalTitle: 'Tensei shitara Slime Datta Ken 4th Season',
    imageUrl: 'https://img.cdngos.com/v/250x350/anime/6a/6a3a42979381c559599569',
    type: 'Сериал',
    year: '2026',
    genres: ['Экшен', 'Комедия', 'Фэнтези', 'Сёнен'],
    description: 'Мечта повелителя демонов Римуру — создать союз между людьми и монстрами — становится всё ближе к осуществлению. Но на его пути встают Гранвилл Роззо и его внучка Марибел.',
    season: '4-й сезон'
  }
];

async function syncToRender() {
  console.log('--- Checking & Creating Missing Slime Titles on Render ---');
  for (const t of slimeTitles) {
    const chk = await fetch(`https://anilex-backend.onrender.com/api/anime/${t.id}`);
    if (chk.status === 404) {
      console.log(`Creating ${t.id} (${t.title}) on Render...`);
      const postRes = await fetch('https://anilex-backend.onrender.com/api/dev/anime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenJust },
        body: JSON.stringify(t)
      });
      const postData = await postRes.json();
      console.log(`Created: id ${postData.anime ? postData.anime.id : 'err'}`);
      if (postData.anime && postData.anime.id) {
        t.id = postData.anime.id;
      }
    } else {
      console.log(`Exists on Render: ${t.id} (${t.title})`);
    }
  }

  console.log('\n--- Interlinking all Slime Titles on Render ---');
  for (const t of slimeTitles) {
    t.linkedAnime = slimeTitles
      .filter(other => other.id !== t.id)
      .map(other => ({
        id: other.id,
        title: other.title,
        imageUrl: other.imageUrl,
        year: other.year,
        type: other.type,
        relation: other.season
      }));
    t.related_json = JSON.stringify(t.linkedAnime);

    const putRes = await fetch(`https://anilex-backend.onrender.com/api/dev/anime/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenJust },
      body: JSON.stringify(t)
    });
    console.log(`Updated relations on Render for ${t.id} (${t.title}): status ${putRes.status}`);
  }

  console.log('\n--- Verifying Search on Render ---');
  const searchRes = await fetch('https://anilex-backend.onrender.com/api/anime?search=' + encodeURIComponent('О моём перерождении в слизь'));
  const sData = await searchRes.json();
  console.log(`Search results on Render now (${sData.items ? sData.items.length : 0}):`);
  for (const it of (sData.items || [])) {
    console.log(` - ID ${it.id}: ${it.title} [${it.season || 'нет сезона'}] (type: ${it.type}, year: ${it.year})`);
  }
}

syncToRender().catch(console.error);
