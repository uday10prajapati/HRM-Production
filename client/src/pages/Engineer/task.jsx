import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_URL;
if (API_BASE_URL) axios.defaults.baseURL = API_BASE_URL;

const TaskPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingTask, setSavingTask] = useState(null);

  const fetchUser = useCallback(async (userId) => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await axios.get(`/api/users/${userId}`);
      setUserData(res.data.user || res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      navigate('/login');
      return;
    }
    const parsed = JSON.parse(stored);
    setUser(parsed);
    if (!parsed.role || parsed.role.toLowerCase() !== 'engineer') {
      navigate('/login');
      return;
    }
    const normalizedId = parsed.id || parsed._id || parsed.userId || null;
    if (!normalizedId) {
      setLoading(false);
      navigate('/login');
      return;
    }
    fetchUser(normalizedId);
  }, [navigate, fetchUser]);

  const toggleTaskStatus = async (taskId, newStatus) => {
    if (!user) return;
    setSavingTask(taskId);
    // optimistic update
    const optimistic = (userData.tasks || []).map((t) =>
      t.id === taskId || t.id === Number(taskId) ? { ...t, status: newStatus } : t
    );
    setUserData({ ...userData, tasks: optimistic });

    try {
      const res = await axios.put(`/api/users/tasks/${taskId}`, { status: newStatus });
      // Use server-returned authoritative user payload when available
      if (res.data && res.data.user) {
        setUserData(res.data.user);
      } else {
        const idToFetch = user.id || user._id || user.userId;
        await fetchUser(idToFetch);
      }
    } catch (err) {
      console.error(err);
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err.message;
  const idToFetch = user.id || user._id || user.userId;
  await fetchUser(idToFetch);
      alert(`Failed to update task: ${serverMsg}`);
    } finally {
      setSavingTask(null);
    }
  };

  if (!user) return null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">My Tasks</h1>
          <p className="text-sm text-gray-600">Tasks assigned by HR/Admin</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/engineer')} className="px-3 py-2 bg-gray-100 rounded">Back</button>
          <button onClick={() => fetchUser(user.id)} className="px-3 py-2 bg-indigo-600 text-white rounded">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : (!userData?.tasks || userData.tasks.length === 0) ? (
        <div className="text-gray-500">No tasks assigned.</div>
      ) : (
        <div className="space-y-3">
          {userData.tasks.map((task) => (
            <div key={task.id} className="p-3 bg-white rounded shadow flex items-start justify-between">
              <div>
                <div className="font-medium">{task.title}</div>
                <div className="text-sm text-gray-600">{task.description}</div>
                <div className="text-xs text-gray-500 mt-1">Assigned: {task.created_at}</div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                  task.status?.toLowerCase() === 'completed' ? 'bg-green-100 text-green-800' :
                  task.status?.toLowerCase() === 'in progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                }`}>{task.status ?? 'Pending'}</div>

                {task.status?.toLowerCase() === 'completed' ? (
                  <button disabled={savingTask === task.id} onClick={() => toggleTaskStatus(task.id, 'pending')} className="px-2 py-1 border rounded">Mark Incomplete</button>
                ) : (
                  <button disabled={savingTask === task.id} onClick={() => toggleTaskStatus(task.id, 'completed')} className="px-2 py-1 bg-green-600 text-white rounded">Mark Complete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskPage;
