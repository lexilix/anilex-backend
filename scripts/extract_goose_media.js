const sharp = require('sharp');
const fs = require('fs');

async function extract() {
  const input = 'C:/Users/Admin/.gemini/antigravity/brain/5f10144b-21c4-44b3-b517-d2fda6a5af33/.user_uploaded/media_1792110450213_70847602.png';
  
  // Banner location on 470x379 screenshot:
  // "БАННЕР ПРОФИЛЯ" is around y = 88.
  // The purple rounded rectangle banner starts around x = 130, y = 97, width = 210, height = 62 (approx).
  // Avatar location:
  // "АВАТАРКА ПРОФИЛЯ" is around y = 170.
  // The square avatar is around x = 130, y = 170, width = 30, height = 30 (approx).

  // Let's create visual test crops to tune the exact pixel coordinates
  const meta = await sharp(input).metadata();
  console.log('Image dimensions:', meta.width, meta.height);
}

extract();
