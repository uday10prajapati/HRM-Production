import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/documents');
      setDocuments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await axios.delete(`/api/documents/${documentId}`);
        fetchDocuments(); // Refresh list after deletion
      } catch (error) {
        console.error('Failed to delete document:', error);
        alert('Failed to delete document');
      }
    }
  };

  const handleReUpload = async (documentId) => {
    if (!selectedFile) return;

    try {
      setUploadingId(documentId);
      const formData = new FormData();
      formData.append('file', selectedFile);

      await axios.put(`/api/documents/${documentId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSelectedFile(null);
      fetchDocuments();
    } catch (error) {
      console.error('Failed to re-upload document:', error);
      alert('Failed to re-upload document');
    } finally {
      setUploadingId(null);
    }
  };

  const handleView = (doc) => {
    window.open(doc.file_url, '_blank');
  };

  const filteredDocuments = documents.filter(doc => 
    doc.user_id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
                <p className="mt-1 text-sm text-gray-500">
                  View and manage documents
                </p>
              </div>
              <input
                type="text"
                placeholder="Search by name or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">No documents found</h3>
                <p className="mt-1 text-sm text-gray-500">Upload documents to get started.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded-full 
                            ${doc.type === 'pdf' ? 'bg-red-100 text-red-800' : 
                              doc.type === 'docx' ? 'bg-blue-100 text-blue-800' : 
                              'bg-gray-100 text-gray-800'}`}>
                            {doc.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {doc.filename}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium space-x-3">
                          <button
                            onClick={() => handleView(doc)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
                          <div className="inline-block">
                            <input
                              type="file"
                              onChange={(e) => setSelectedFile(e.target.files[0])}
                              className="hidden"
                              id={`file-${doc.id}`}
                            />
                            <label
                              htmlFor={`file-${doc.id}`}
                              className="text-green-600 hover:text-green-900 cursor-pointer"
                            >
                              Replace
                            </label>
                            {selectedFile && uploadingId === doc.id && (
                              <button
                                onClick={() => handleReUpload(doc.id)}
                                className="ml-2 text-blue-600 hover:text-blue-900"
                              >
                                Save
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}