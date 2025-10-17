import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from './db.js';

const router = express.Router();

// storage configuration: files saved under backend/uploads/users/:id/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.params.id;
    const base = path.join(process.cwd(), 'backend', 'uploads', 'users', String(userId));
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
        // store relative path for serving: uploads/users/:id/:filename
        const relPath = path.join('uploads', 'users', String(id), f.filename);
        entries.push({ type: typeName, filename: f.filename, path: relPath });
      }
    };

    pushIfExists('contract', 'contract');
    pushIfExists('idProof', 'id_proof');
    pushIfExists('certificate', 'certificate');

    // Insert metadata rows
    const client = await pool.connect();
    try {
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
    const result = await pool.query('SELECT id, user_id, type, filename, path, uploaded_at FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC', [id]);
    res.json({ success: true, documents: result.rows });
  } catch (err) {
    console.error('Error fetching documents for user', err);
    res.status(500).json({ success: false, message: 'Error fetching documents', error: err.message });
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
    const absPath = path.isAbsolute(doc.path) ? doc.path : path.join(process.cwd(), 'backend', doc.path);
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
