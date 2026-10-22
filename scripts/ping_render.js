// Continuous pinger to wake up and keep Render awake
const url = 'https://anilex-backend.onrender.com/api/friends';

console.log('[Pinger] Starting Render wake-up monitor...');

let attempts = 0;
async function ping() {
  attempts++;
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[Pinger] Attempt #${attempts}: Render responded in ${elapsed}s! Status: ${res.status}`);
    if (res.ok) {
      console.log('[Pinger] SUCCESS! Render backend is fully awake and responding.');
    }
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[Pinger] Attempt #${attempts} (${elapsed}s): still waking up (${err.name || err.message})...`);
  }
}

ping();
setInterval(ping, 20000);
