import React, { useEffect, useState } from 'react';
import ModalWrapper from './ModalWrapper';
import axios from 'axios';

const DocumentsModal = ({ userId, onClose }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [newType, setNewType] = useState('');

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/documents/user/${userId}`);
      setDocs(res.data.documents || []);
    } catch (err) {
      console.error('Failed to load documents', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (userId) fetchDocs(); }, [userId]);

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      await axios.delete(`/api/documents/${docId}`);
      fetchDocs();
    } catch (err) {
      console.error('Failed to delete document', err);
      alert('Failed to delete document');
    }
  };

  const startEdit = (doc) => { setEditing(doc.id); setNewType(doc.type || ''); };
  const saveEdit = async () => {
    try {
      await axios.put(`/api/documents/${editing}`, { type: newType });
      setEditing(null);
      fetchDocs();
    } catch (err) {
      console.error('Failed to update document', err);
      alert('Failed to update');
    }
  };

  return (
    <ModalWrapper>
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Documents</h3>
          <button className="text-sm text-gray-500" onClick={onClose}>Close</button>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : docs.length === 0 ? (
          <div className="text-gray-500">No documents uploaded.</div>
        ) : (
          <div className="space-y-3">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between bg-white p-3 rounded shadow-sm">
                <div>
                  <a href={`/${d.path}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{d.filename}</a>
                  <div className="text-xs text-gray-400">Type: {d.type} • Uploaded: {new Date(d.uploaded_at).toLocaleString()}</div>
                </div>

                <div className="flex items-center gap-2">
                  {editing === d.id ? (
                    <>
                      <input value={newType} onChange={e => setNewType(e.target.value)} className="border px-2 py-1 rounded" />
                      <button onClick={saveEdit} className="px-2 py-1 bg-green-600 text-white rounded text-sm">Save</button>
                      <button onClick={() => setEditing(null)} className="px-2 py-1 border rounded text-sm">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(d)} className="px-2 py-1 border rounded text-sm">Edit</button>
                      <button onClick={() => handleDelete(d.id)} className="px-2 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

export default DocumentsModal;
