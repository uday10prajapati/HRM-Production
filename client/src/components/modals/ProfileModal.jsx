import React from 'react';
import ModalWrapper from './ModalWrapper';

const ProfileModal = ({ user, userData, onClose }) => {
  const data = userData || user || {};

  return (
    <ModalWrapper>
      <div className="flex flex-col">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-2xl font-semibold text-gray-800">My Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-sm text-gray-500">Name</div>
            <div className="font-medium text-gray-800">{data.name || '-'}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Email</div>
            <div className="font-medium text-gray-800">{data.email || '-'}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Role</div>
            <div className="font-medium text-gray-800 capitalize">{(data.role || '-').toString()}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Leave Balance</div>
            <div className="font-medium text-gray-800">{data.leave_balance ?? '-'}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Attendance Status</div>
            <div className="font-medium text-gray-800">{data.attendance_status ?? '-'}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Tasks</div>
            {data.tasks && data.tasks.length > 0 ? (
              <ul className="mt-2 space-y-2 max-h-48 overflow-auto pr-2">
                {data.tasks.map((t) => (
                  <li key={t.id ?? t.title} className="p-3 bg-gray-50 rounded border">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-sm text-gray-600">{t.description}</div>
                    <div className="text-xs text-gray-500 mt-1">Status: {t.status ?? 'Pending'}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-500 mt-2">No tasks assigned.</div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
            Close
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export default ProfileModal;
