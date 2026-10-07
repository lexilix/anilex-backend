const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join('data', 'backups', 'backend_backup_' + ts);
fs.mkdirSync(backupDir, { recursive: true });

fs.copyFileSync('data/anime_ratings.db', path.join(backupDir, 'anime_ratings.db'));
if (fs.existsSync('data/accounts_backup.json')) {
  fs.copyFileSync('data/accounts_backup.json', path.join(backupDir, 'accounts_backup.json'));
}
fs.cpSync('server', path.join(backupDir, 'server'), { recursive: true });

console.log('Backup created successfully at:', backupDir);

const db = new DatabaseSync('data/anime_ratings.db');
const just = db.prepare("SELECT id FROM users WHERE nickname = 'Just'").get();
const row = db.prepare('SELECT count(*) as c FROM ratings WHERE user_id = ?').get(just.id);
console.log('User Just ratings count in DB:', row.c);
