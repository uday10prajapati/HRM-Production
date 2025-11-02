import React from 'react';
import ModalWrapper from './ModalWrapper';

const PdfViewerModal = ({ pdfUrl, onClose }) => {
  return (
    <ModalWrapper>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="w-full h-[90vh] max-w-5xl bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold">Document Viewer</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="h-[calc(90vh-4rem)]">
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title="PDF Viewer"
            />
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
};

export default PdfViewerModal;