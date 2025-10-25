import React from "react";
import ModalWrapper from "./ModalWrapper";

const EditUserModal = ({ formData, setFormData, onSubmit, onClose }) => (
  <ModalWrapper>
    <h3 className="text-xl font-semibold mb-4 text-gray-800">Edit User</h3>
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Full Name"
        className="w-full border px-3 py-2 rounded"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <input
        type="email"
        placeholder="Email"
        className="w-full border px-3 py-2 rounded"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />
      <select
        className="w-full border px-3 py-2 rounded"
        value={formData.role}
        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
        required
      >
        <option value="">Select Role</option>
        <option value="hr">HR</option>
        <option value="engineer">Engineer</option>
        <option value="employee">Employee</option>
      </select>
      <input
        type="number"
        placeholder="Leave Balance"
        className="w-full border px-3 py-2 rounded"
        value={formData.leave_balance}
        onChange={(e) =>
          setFormData({ ...formData, leave_balance: e.target.value })
        }
      />
      <input
        type="text"
        placeholder="Mobile number"
        className="w-full border px-3 py-2 rounded"
        value={formData.mobile_number || formData.mobile || ''}
        onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
      />

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </form>
  </ModalWrapper>
);

export default EditUserModal;
