import React from "react";

const ModalWrapper = ({ children }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md relative">
      {children}
    </div>
  </div>
);

export default ModalWrapper;
