const fs = require('fs');
const path = require('path');

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(__dirname, '..', `backend_backup_${ts}`);
fs.mkdirSync(backupDir, { recursive: true });

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(path.join(__dirname, '..', 'server'), path.join(backupDir, 'server'));
copyDir(path.join(__dirname, '..', 'data'), path.join(backupDir, 'data'));

console.log(`Backend and data backup successfully created at: ${backupDir}`);
