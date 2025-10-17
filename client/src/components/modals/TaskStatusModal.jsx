import React from "react";
import ModalWrapper from "./ModalWrapper";

const TaskStatusModal = ({ selectedUser, onClose }) => (
  <ModalWrapper>
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-3 mb-4">
        <h3 className="text-2xl font-semibold text-gray-800">Tasks for {selectedUser?.name}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl font-bold"
        >
          &times;
        </button>
      </div>

      {/* Task List */}
      {selectedUser?.tasks && selectedUser.tasks.length > 0 ? (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
          {selectedUser.tasks.map((task) => (
            <div
              key={task.id}
              className="p-4 border rounded-lg shadow-sm hover:shadow-md transition flex justify-between items-start bg-gray-50"
            >
              <div>
                <p className="font-semibold text-gray-800">{task.title}</p>
                <p className="text-gray-600 mt-1 text-sm">{task.description}</p>
              </div>
              <span
                className={`text-sm font-medium px-2 py-1 rounded-full ${
                  task.status?.toLowerCase() === "completed"
                    ? "bg-green-100 text-green-800"
                    : task.status?.toLowerCase() === "in progress"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {task.status || "Pending"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center mt-6">No tasks assigned.</p>
      )}

      {/* Footer */}
      <div className="flex justify-end mt-6">
        <button
          onClick={onClose}
          className="px-5 py-2 bg-gray-300 rounded hover:bg-gray-400 font-medium"
        >
          Close
        </button>
      </div>
    </div>
  </ModalWrapper>
);

export default TaskStatusModal;
