import React from "react";
import ModalWrapper from "./ModalWrapper";

const GiveTaskModal = ({ selectedUser, taskData, setTaskData, onSubmit, onClose }) => (
  <ModalWrapper>
    <h3 className="text-xl font-semibold mb-4 text-gray-800">
      Assign Task to {selectedUser?.name}
    </h3>
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Task Title"
        className="w-full border px-3 py-2 rounded"
        value={taskData.title}
        onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
        required
      />
      <textarea
        placeholder="Task Description"
        className="w-full border px-3 py-2 rounded"
        rows="4"
        value={taskData.description}
        onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
        required
      />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Assign Task
        </button>
      </div>
    </form>
  </ModalWrapper>
);

export default GiveTaskModal;
