import React from "react";

const ModalWrapper = ({ children }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-modalEntry">
      <div className="p-6 overflow-y-auto">{children}</div>
    </div>
  </div>
);

export default ModalWrapper;
