#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DEST = path.join(REPO_ROOT, 'storage', 'uploads');
const CANDIDATES = [
  path.join(REPO_ROOT, 'backend', 'uploads'),
  path.join(REPO_ROOT, 'backend', 'backend', 'uploads'),
  path.join(REPO_ROOT, 'uploads')
];

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch (e) { /* ignore */ }
}

function moveRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;
  let moved = 0;
  const items = fs.readdirSync(src, { withFileTypes: true });
  for (const it of items) {
    const s = path.join(src, it.name);
    const d = path.join(dest, it.name);
    if (it.isDirectory()) {
      ensureDir(d);
      moved += moveRecursive(s, d);
      // remove empty dir
      try { fs.rmdirSync(s); } catch (e) { /* ignore */ }
    } else {
      try {
        // try rename first
        try {
          fs.renameSync(s, d);
        } catch (e) {
          // fallback to copy+unlink
          fs.copyFileSync(s, d);
          fs.unlinkSync(s);
        }
        moved++;
      } catch (err) {
        console.warn('Failed to move', s, '->', d, err.message || err);
      }
    }
  }
  return moved;
}

function main() {
  ensureDir(DEST);
  let totalMoved = 0;
  for (const src of CANDIDATES) {
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      if (path.resolve(src) === path.resolve(DEST)) {
        console.log('Source equals destination, skipping:', src);
        continue;
      }
      console.log('Found uploads at:', src);
      const moved = moveRecursive(src, DEST);
      console.log(`Moved ${moved} files from ${src} -> ${DEST}`);
      totalMoved += moved;
      // attempt to remove now-empty source dirs (upwards)
      try { fs.rmdirSync(src, { recursive: true }); } catch (e) { /* ignore */ }
    }
  }

  if (totalMoved === 0) {
    console.log('No files moved. Either no legacy uploads folders found or they were already empty.');
  } else {
    console.log(`Total files moved: ${totalMoved}`);
    console.log('All moved files are now under:', DEST);
    console.log('\nIf your DB has document.path values referencing old locations, consider running the following SQL to normalize them:');
    console.log("-- Example SQL (run in psql)\nUPDATE documents SET path = regexp_replace(path, '^(.*/)?uploads/', '/uploads/');\n");
    console.log('Restart the backend after moving files so the server serves the new locations.');
  }
}

main();
