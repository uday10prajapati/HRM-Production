import React, { useEffect, useState } from 'react';
import ModalWrapper from './ModalWrapper';
import axios from 'axios';
import PdfViewerModal from './PdfViewerModal';

const DocumentsModal = ({ userId, onClose }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [newType, setNewType] = useState('');
  const [isPdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState(null);
  const [formData, setFormData] = useState({
    contractFile: null,
    idProofFile: null,
    certificateFile: null
  });

  // ✅ Added logs and defensive check
// Update the fetchDocs function:

const fetchDocs = async () => {
  if (!userId) {
    console.warn("⚠️ No userId provided to DocumentsModal.");
    setLoading(false);
    return;
  }

  console.log("📥 Fetching documents for user:", userId);
  setLoading(true);
  try {
    const res = await axios.get(`/api/documents/user/${userId}`);
    console.log("✅ Documents API response:", res.data);
    
    // Handle both array or wrapped object response
    if (Array.isArray(res.data)) {
      setDocs(res.data);
    } else if (res.data.documents) {
      setDocs(res.data.documents);
    } else {
      console.warn("⚠️ Unexpected response format:", res.data);
      setDocs([]);
    }
  } catch (err) {
    console.error('❌ Failed to load documents:', err);
    setDocs([]); 
    alert('Failed to load documents. Please try again.');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    console.log("📂 DocumentsModal mounted. userId =", userId);
    if (userId) fetchDocs();
  }, [userId]);

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      await axios.delete(`/api/documents/${docId}`);
      console.log("🗑️ Document deleted:", docId);
      fetchDocs();
    } catch (err) {
      console.error('❌ Failed to delete document', err);
      alert('Failed to delete document');
    }
  };

  const startEdit = (doc) => {
    setEditing(doc.id);
    setNewType(doc.type || '');
  };

  const saveEdit = async () => {
    try {
      await axios.put(`/api/documents/${editing}`, { type: newType });
      console.log("✏️ Updated document type for:", editing);
      setEditing(null);
      fetchDocs();
    } catch (err) {
      console.error('❌ Failed to update document', err);
      alert('Failed to update');
    }
  };

  const handleViewPdf = async (path) => {
    try {
      if (!path) {
        console.error('❌ Invalid PDF path:', path);
        alert('Invalid file path');
        return;
      }

      // Extract userId and filename from path
      const match = path.match(/\/users\/([^/]+)\/([^/]+)$/);
      if (!match) {
        console.error('❌ Invalid path format:', path);
        alert('Invalid file path format');
        return;
      }

      const [, pathUserId, filename] = match;
      const baseUrl = axios.defaults.baseURL || '';
      const pdfUrl = `${baseUrl}/api/documents/view/documents/uploads/users/${pathUserId}/${filename}`;

      console.log("🔗 Checking PDF URL:", pdfUrl);
      const response = await axios.head(pdfUrl);
      if (response.status === 200) {
        console.log('✅ Opening PDF:', pdfUrl);
        setSelectedPdfUrl(pdfUrl);
        setPdfModalOpen(true);
      } else {
        throw new Error('PDF not found');
      }
    } catch (err) {
      console.error('❌ Failed to open PDF:', err);
      alert('Failed to open PDF document');
    }
  };

  const onFileChange = (fieldName, file) => {
    if (file && file.size > 10 * 1024 * 1024) {
      alert('File size should not exceed 10MB');
      return;
    }
    setFormData(prev => ({
      ...prev,
      [fieldName]: file
    }));
  };

  return (
    <ModalWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Documents</h3>
            <p className="mt-1 text-gray-600">Manage user documents and files</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-2">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Supporting documents (optional)</h4>
          <p className="text-xs text-gray-400 mb-3">PDF only. Max 10MB per file.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Contract */}
            <label className="flex flex-col bg-white border-dashed border-2 border-gray-200 rounded p-3 items-start cursor-pointer hover:border-indigo-300">
              <span className="text-sm font-medium text-gray-700">Contract</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => onFileChange('contractFile', e.target.files[0])}
                className="mt-2 w-full"
              />
              {formData.contractFile && (
                <span className="mt-2 inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-sm">
                  {formData.contractFile.name}
                </span>
              )}
            </label>

            {/* ID Proof */}
            <label className="flex flex-col bg-white border-dashed border-2 border-gray-200 rounded p-3 items-start cursor-pointer hover:border-indigo-300">
              <span className="text-sm font-medium text-gray-700">ID Proof</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => onFileChange('idProofFile', e.target.files[0])}
                className="mt-2 w-full"
              />
              {formData.idProofFile && (
                <span className="mt-2 inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-sm">
                  {formData.idProofFile.name}
                </span>
              )}
            </label>

            {/* Certificate */}
            <label className="flex flex-col bg-white border-dashed border-2 border-gray-200 rounded p-3 items-start cursor-pointer hover:border-indigo-300">
              <span className="text-sm font-medium text-gray-700">Certificate</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => onFileChange('certificateFile', e.target.files[0])}
                className="mt-2 w-full"
              />
              {formData.certificateFile && (
                <span className="mt-2 inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-sm">
                  {formData.certificateFile.name}
                </span>
              )}
            </label>
          </div>
        </div>

        {/* ✅ Improved loading behavior */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
            <svg className="animate-spin h-8 w-8 text-blue-600 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <p>Loading documents...</p>
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by uploading documents</p>
          </div>
        ) : (
          <div className="space-y-4">
            {docs.map(d => (
              <div key={d.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <button
                      onClick={() => handleViewPdf(d.path)}
                      className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {d.filename}
                    </button>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded-full">{d.type || 'No type'}</span>
                      <span>•</span>
                      <span>{new Date(d.uploaded_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {editing === d.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={newType}
                        onChange={e => setNewType(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter type"
                      />
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(d)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isPdfModalOpen && (
          <PdfViewerModal
            pdfUrl={selectedPdfUrl}
            onClose={() => {
              setPdfModalOpen(false);
              setSelectedPdfUrl(null);
            }}
          />
        )}
      </div>
    </ModalWrapper>
  );
};

export default DocumentsModal;
