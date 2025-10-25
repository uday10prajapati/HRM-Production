import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function MapView() {
  const q = useQuery();
  const navigate = useNavigate();
  const queryLat = q.get('lat');
  const queryLng = q.get('lng') || q.get('lon') || q.get('long');
  const userId = q.get('userId');
  const name = q.get('name') || '';

  const [lat, setLat] = useState(queryLat || null);
  const [lng, setLng] = useState(queryLng || null);
  const [when, setWhen] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    // If lat/lng not provided but userId is, fetch latest attendance record with coords
    if ((!queryLat || !queryLng) && userId) {
      (async () => {
        setLoading(true);
        try {
          // fetch latest live location for the user
          const params = { userId };
          // include x-user-id header fallback for auth
          let headers = {};
          try {
            const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
            if (raw) {
              const p = JSON.parse(raw);
              const u = p?.user ?? p?.data ?? p;
              const id = u?.id ?? u?.userId ?? null;
              if (id) headers['x-user-id'] = String(id);
            }
          } catch (e) {
            // ignore
          }

          const res = await axios.get('/api/live_locations/latest', { params, headers });
          const loc = res?.data?.location ?? null;
          if (!loc || loc.latitude == null || loc.longitude == null) {
            setLat(null); setLng(null); setWhen(null);
          } else {
            setLat(loc.latitude);
            setLng(loc.longitude);
            setWhen(loc.updated_at || null);
          }
        } catch (err) {
          console.error('MapView: failed to fetch live location', err?.response?.data ?? err);
          setLat(null); setLng(null); setWhen(null);
        } finally {
          setLoading(false);
        }
      })();
    }
    // if no explicit userId in query, fetch available users to let the operator pick one
    if (!userId) {
      (async () => {
        setLoadingUsers(true);
        try {
          // try to include x-user-id header for auth fallback
          let headers = {};
          try {
            const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
            if (raw) {
              const p = JSON.parse(raw);
              const u = p?.user ?? p?.data ?? p;
              const id = u?.id ?? u?.userId ?? null;
              if (id) headers['x-user-id'] = String(id);
            }
          } catch (e) {}
          const res = await axios.get('/api/users', { headers });
          const arr = res?.data?.users ?? [];
          // only include employees and engineers in this picker
          const filtered = (arr || []).filter(u => {
            const r = (u?.role || '').toString().toLowerCase();
            return r === 'employee' || r === 'engineer';
          });
          setUsers(filtered);
        } catch (err) {
          console.warn('MapView: failed to fetch users', err?.response?.data ?? err);
          setUsers([]);
        } finally {
          setLoadingUsers(false);
        }
      })();
    }
  }, [queryLat, queryLng, userId]);

  // removed live-tracking effect — MapView will fetch on demand when user clicks View

  async function fetchLatestForUser(uid) {
    setLoading(true);
    try {
      const params = { userId: uid };
      let headers = {};
      try {
        const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
        if (raw) {
          const p = JSON.parse(raw);
          const u = p?.user ?? p?.data ?? p;
          const id = u?.id ?? u?.userId ?? null;
          if (id) headers['x-user-id'] = String(id);
        }
      } catch (e) {}
      const res = await axios.get('/api/live_locations/latest', { params, headers });
      const loc = res?.data?.location ?? null;
      if (!loc || loc.latitude == null || loc.longitude == null) {
        setLat(null); setLng(null); setWhen(null);
        return null;
      }
      setLat(loc.latitude);
      setLng(loc.longitude);
      setWhen(loc.updated_at || null);
      return loc;
    } catch (err) {
      console.error('MapView: failed to fetch attendance records', err?.response?.data ?? err);
      setLat(null); setLng(null); setWhen(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  // removed live tracking function

  async function handleViewAndOpen(uid) {
    // enforce role restriction: only show for employee and engineer
    const allowedRoles = ['employee', 'engineer'];
    let user = (users || []).find(u => String(u.id) === String(uid));
    if (!user) {
      // try fetching users list as a fallback
      try {
        const headers = {};
        try {
          const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
          if (raw) {
            const p = JSON.parse(raw);
            const uu = p?.user ?? p?.data ?? p;
            const id = uu?.id ?? uu?.userId ?? null;
            if (id) headers['x-user-id'] = String(id);
          }
        } catch (e) {}
        const res = await axios.get('/api/users', { headers });
        const arr = res?.data?.users ?? [];
        user = arr.find(u => String(u.id) === String(uid));
      } catch (e) {
        console.warn('MapView: failed to fetch user for role check', e?.response?.data ?? e);
      }
    }

    const role = (user?.role || '').toString().toLowerCase();
    if (!allowedRoles.includes(role)) {
      alert('Location is only visible for users with role Employee or Engineer');
      return;
    }

    const latest = await fetchLatestForUser(uid);
    if (latest && latest.latitude != null && latest.longitude != null) {
      const lat = latest.latitude;
      const lng = latest.longitude;
      const googleLink = `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
      window.open(googleLink, '_blank');
    } else {
      alert('No coordinates available for this user');
    }
  }

  const hasCoords = lat != null && lng != null;
  const src = hasCoords ? `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&output=embed` : null;
  const googleLink = hasCoords ? `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}` : null;

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1 min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100 overflow-auto">
          <div className="bg-white rounded shadow p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-1">{name || 'Map'}</h2>
                <div className="text-sm text-gray-600">{userId ? `User: ${userId}` : ''}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Back</button>
              </div>
            </div>

            {/* If we don't have a specific user in the query, show a user pick list */}
            {!userId && (
              <div className="mt-4 mb-4 bg-gray-50 p-3 rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Select user to view on map</div>
                  <div className="text-xs text-gray-500">{loadingUsers ? 'Loading users...' : `${users.length} users`}</div>
                </div>
                {loadingUsers ? (
                  <div className="text-sm text-gray-600">Loading users...</div>
                ) : users.length === 0 ? (
                  <div className="text-sm text-gray-600">No users available.</div>
                ) : (
                  <div className="overflow-auto max-h-48">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500">
                          <th className="py-1 px-2">Name</th>
                          <th className="py-1 px-2">Email</th>
                          <th className="py-1 px-2">Role</th>
                          <th className="py-1 px-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => {
                          const role = (u.role || '').toString().toLowerCase();
                          const allowed = ['employee', 'engineer'].includes(role);
                          return (
                            <tr key={u.id} className="border-t">
                              <td className="py-1 px-2">{u.name}</td>
                              <td className="py-1 px-2">{u.email}</td>
                              <td className="py-1 px-2">{u.role}</td>
                              <td className="py-1 px-2">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleViewAndOpen(u.id)}
                                    className={`px-2 py-1 rounded text-xs ${allowed ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 cursor-not-allowed'}`}
                                    disabled={!allowed}
                                    title={allowed ? 'View latest location' : 'Location restricted to Employee/Engineer'}
                                  >
                                    View
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              {loading ? (
                <div className="text-sm text-gray-600">Loading location...</div>
              ) : !hasCoords ? null : (
                <>
                  <div className="mb-2 text-sm text-gray-700">Lat: <span className="font-mono">{lat}</span>, Lng: <span className="font-mono">{lng}</span></div>
                  {when && <div className="mb-2 text-xs text-gray-500">When: {when}</div>}
                  <div className="bg-white rounded shadow overflow-hidden" style={{height: '70vh'}}>
                    <iframe title="map" src={src} width="100%" height="100%" style={{border:0}} allowFullScreen loading="lazy"></iframe>
                  </div>
                  <div className="mt-3">
                    <a className="px-3 py-2 bg-blue-600 text-white rounded" href={googleLink} target="_blank" rel="noreferrer">Open in Google Maps</a>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
