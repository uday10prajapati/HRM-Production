import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

// Compute repository root so uploads path is stable regardless of process.cwd()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Base uploads directory (configurable via UPLOADS_DIR env var). If UPLOADS_DIR is
// absolute it will be used as-is; otherwise it defaults to <repo>/storage/uploads
const UPLOADS_BASE = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(REPO_ROOT, 'storage', 'uploads');
// ensure base directory exists
try { fs.mkdirSync(UPLOADS_BASE, { recursive: true }); } catch (e) { /* ignore */ }

const router = express.Router();

// Ensure documents table exists (safety for environments without migrations run)
async function ensureDocumentsTable() {
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(64) NOT NULL,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // index to speed up counts/group by queries
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)`);
  } catch (err) {
    console.error('Failed to ensure documents table:', err?.message || err);
  }
}

ensureDocumentsTable().catch(err => console.error('ensureDocumentsTable failed:', err));

// storage configuration: files saved under UPLOADS_BASE/users/:id/ (public URL path exposed at /uploads/users/:id/:filename)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.params.id;
    const base = path.join(UPLOADS_BASE, 'users', String(userId));
    fs.mkdirSync(base, { recursive: true });
    cb(null, base);
  },
  filename: function (req, file, cb) {
    // keep original name prefixed with timestamp
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    // accept only PDFs
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  }
});

// Accept up to 3 files named contract, idProof, certificate
router.post('/:id/documents', upload.fields([
  { name: 'contract', maxCount: 1 },
  { name: 'idProof', maxCount: 1 },
  { name: 'certificate', maxCount: 1 }
]), async (req, res) => {
  const { id } = req.params;
  try {
    const files = req.files || {};
    const entries = [];

    const pushIfExists = (fieldName, typeName) => {
      const arr = files[fieldName];
      if (Array.isArray(arr) && arr.length > 0) {
        const f = arr[0];
  // store public URL path for serving: /uploads/users/:id/:filename
  const relPath = `/uploads/users/${String(id)}/${f.filename}`;
        entries.push({ type: typeName, filename: f.filename, path: relPath });
      }
    };

    pushIfExists('contract', 'contract');
    pushIfExists('idProof', 'id_proof');
    pushIfExists('certificate', 'certificate');

    // Insert metadata rows
    const client = await pool.connect();
    try {
      // Defensive: ensure documents.user_id column accepts UUID/text values.
      // Some older schemas may have user_id as integer; try to convert to TEXT so UUIDs work.
      try {
        const colQ = await client.query("SELECT data_type FROM information_schema.columns WHERE table_name='documents' AND column_name='user_id' LIMIT 1");
        const dtype = colQ.rows && colQ.rows[0] ? (colQ.rows[0].data_type || '').toString().toLowerCase() : null;
        if (dtype && (dtype.includes('int') || dtype === 'integer')) {
          try {
            await client.query('ALTER TABLE documents ALTER COLUMN user_id TYPE TEXT USING user_id::text');
            console.log('documentsRoute: converted documents.user_id to TEXT to accept UUIDs');
          } catch (convertErr) {
            console.warn('documentsRoute: failed to convert documents.user_id to TEXT:', convertErr?.message || convertErr);
          }
        }
      } catch (checkErr) {
        console.warn('documentsRoute: could not verify/convert documents.user_id column type:', checkErr?.message || checkErr);
      }

      await client.query('BEGIN');
      for (const e of entries) {
        await client.query(
          'INSERT INTO documents (user_id, type, filename, path) VALUES ($1, $2, $3, $4)',
          [id, e.type, e.filename, e.path]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error inserting document rows', err);
      return res.status(500).json({ success: false, message: 'Error saving document metadata', error: err.message });
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Files uploaded', uploaded: entries });
  } catch (err) {
    console.error('Upload error', err);
    res.status(500).json({ success: false, message: 'Upload failed', error: err.message });
  }
});

// GET documents for a user
router.get('/user/:id', async (req, res) => {
  const { id } = req.params;
  try {
  const result = await pool.query('SELECT id, user_id, type, filename, path, uploaded_at FROM documents WHERE user_id::text = $1 ORDER BY uploaded_at DESC', [id]);
    res.json({ success: true, documents: result.rows });
  } catch (err) {
    console.error('Error fetching documents for user', err);
    res.status(500).json({ success: false, message: 'Error fetching documents', error: err.message });
  }
});

// GET document counts grouped by user (admin helper)
router.get('/counts', async (req, res) => {
  try {
    // make sure table exists (safety if migrations haven't run yet)
    await ensureDocumentsTable();
    const q = await pool.query('SELECT user_id, COUNT(*) as count FROM documents GROUP BY user_id');
    res.json({ success: true, counts: q.rows });
  } catch (err) {
    console.error('Error fetching document counts', err?.message || err);
    // If the error indicates missing table, try to create it and retry once
    if (/relation "documents" does not exist/i.test(String(err?.message || ''))) {
      try {
        await ensureDocumentsTable();
        const q2 = await pool.query('SELECT user_id, COUNT(*) as count FROM documents GROUP BY user_id');
        return res.json({ success: true, counts: q2.rows });
      } catch (err2) {
        console.error('Retry after creating documents table failed', err2?.message || err2);
      }
    }
    res.status(500).json({ success: false, message: 'Error fetching document counts', error: err?.message || String(err) });
  }
});

// Update document metadata (type)
router.put('/:docId', async (req, res) => {
  const { docId } = req.params;
  const { type } = req.body;
  try {
    const result = await pool.query('UPDATE documents SET type=$1 WHERE id=$2 RETURNING *', [type, docId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, document: result.rows[0] });
  } catch (err) {
    console.error('Error updating document', err);
    res.status(500).json({ success: false, message: 'Error updating document', error: err.message });
  }
});

// Delete a document (remove file and DB row)
router.delete('/:docId', async (req, res) => {
  const { docId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM documents WHERE id=$1', [docId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Document not found' });
    const doc = result.rows[0];
    // remove file from disk
    // Stored paths are relative like 'uploads/users/:id/:filename' (public URL path)
    // Map them to actual filesystem path under UPLOADS_BASE (which is <repo>/storage/uploads)
    let absPath;
    if (path.isAbsolute(doc.path)) {
      absPath = doc.path;
    } else {
      // strip leading '/uploads/' or 'uploads/' then join with UPLOADS_BASE
      const p = doc.path.replace(/^\/|^\//, ''); // remove leading slash if any
      if (p.toLowerCase().startsWith('uploads' + path.posix.sep) || p.toLowerCase().startsWith('uploads/')) {
        const relativeInsideUploads = p.replace(/^uploads[\\/]/i, '');
        absPath = path.join(UPLOADS_BASE, relativeInsideUploads);
      } else {
        // fallback: resolve against repo root
        absPath = path.join(REPO_ROOT, doc.path);
      }
    }
    try {
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } catch (fsErr) {
      console.warn('Failed to remove file from disk', absPath, fsErr.message || fsErr);
    }
    // delete DB row
    await pool.query('DELETE FROM documents WHERE id=$1', [docId]);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    console.error('Error deleting document', err);
    res.status(500).json({ success: false, message: 'Error deleting document', error: err.message });
  }
});

export default router;