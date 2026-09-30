const localtunnel = require('localtunnel');

let tunnelInstance = null;

async function startTunnel() {
  try {
    console.log('[Tunnel] Starting persistent localtunnel on port 3001...');
    tunnelInstance = await localtunnel({
      port: 3001,
      subdomain: 'anilex-backend-live'
    });

    console.log('[Tunnel] Successfully connected: ' + tunnelInstance.url);

    tunnelInstance.on('close', () => {
      console.warn('[Tunnel] Tunnel closed. Reconnecting in 3 seconds...');
      setTimeout(startTunnel, 3000);
    });

    tunnelInstance.on('error', (err) => {
      console.error('[Tunnel] Tunnel error: ' + err.message + '. Reconnecting in 3 seconds...');
      try { tunnelInstance.close(); } catch (e) {}
      setTimeout(startTunnel, 3000);
    });
  } catch (err) {
    console.error('[Tunnel] Failed to start tunnel: ' + err.message + '. Retrying in 5 seconds...');
    setTimeout(startTunnel, 5000);
  }
}

// Keep event loop alive
setInterval(() => {}, 60000);

startTunnel();
