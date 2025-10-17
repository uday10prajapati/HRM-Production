import React from "react";
import ModalWrapper from "./ModalWrapper";

const DeleteUserModal = ({ selectedUser, onDelete, onClose }) => (
  <ModalWrapper>
    <h3 className="text-xl font-semibold mb-4 text-gray-800">Delete User</h3>
    <p className="text-gray-600 mb-6">
      Are you sure you want to delete <span className="font-bold">{selectedUser?.name}</span>?
    </p>
    <div className="flex justify-end gap-2">
      <button
        className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        onClick={onClose}
      >
        Cancel
      </button>
      <button
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  </ModalWrapper>
);

export default DeleteUserModal;
