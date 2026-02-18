import React from "react";
import ModalWrapper from "./ModalWrapper";

const AddUserModal = ({ formData, setFormData, onSubmit, onClose, loading }) => {
  const onFileChange = (key, file) => setFormData({ ...formData, [key]: file });

  return (
    <ModalWrapper>
      <h3 className="text-xl font-semibold mb-2 text-gray-800">Add New User</h3>
      <p className="text-sm text-gray-500 mb-4">Create an account and optionally upload supporting documents (PDF).</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ... fields ... */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              placeholder="Full Name"
              className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="Email Address"
              className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              placeholder="Password"
              className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              className="w-full border px-3 py-2 rounded focus:outline-none"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              required
            >
              <option value="">Select Role</option>
              <option value="hr">HR</option>
              <option value="engineer">Engineer</option>
              <option value="employee">Employee</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile number</label>
            <input
              type="text"
              placeholder="Mobile number"
              className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={formData.mobile_number || formData.mobileNumber || ''}
              onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Leave balance</label>
            <input
              type="number"
              placeholder="Leave Balance"
              className="w-full border px-3 py-2 rounded focus:outline-none"
              value={formData.leave_balance}
              onChange={(e) => setFormData({ ...formData, leave_balance: e.target.value })}
            />
          </div>
        </div>

        {/* Documents section */}
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

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`px-4 py-2 rounded text-white text-sm ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Add user'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export default AddUserModal;
