import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

// Custom icons
const punchInIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

const punchOutIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

export default function MapView() {
    const [engineers, setEngineers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEngineer, setSelectedEngineer] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [timelineData, setTimelineData] = useState([]);
    const [mapKey, setMapKey] = useState(0);

    const fetchEngineers = async () => {
        try {
            const res = await axios.get('/api/attendance/engineers');
            setEngineers(res.data);
        } catch (err) {
            console.error('Error fetching engineers:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTimeline = async (userId, date) => {
        try {
            const res = await axios.get(`/api/live_locations/timeline/${userId}`, {
                params: { date: date.toISOString().split('T')[0] },
            });
            console.log('Timeline API Response:', res.data);
            if (res.data.success && Array.isArray(res.data.timeline)) {
                setTimelineData(res.data.timeline);
            } else {
                setTimelineData([]);
            }
        } catch (err) {
            console.error('Timeline fetch error:', err);
            setTimelineData([]);
        }
    };

    useEffect(() => {
        fetchEngineers();
    }, []);

    const handleViewLocation = async (engineer) => {
        setSelectedEngineer(engineer);
        await fetchTimeline(engineer.id, selectedDate);
        setMapKey((prev) => prev + 1);
    };

    const startPoint = timelineData.find((p) => p.point_type === 'START');
    const endPoint = timelineData.find((p) => p.point_type === 'END');

    // Draw full route (all points, including movement)
    const path = timelineData.map((p) => [p.latitude, p.longitude]);

    const mapCenter = startPoint
        ? [startPoint.latitude, startPoint.longitude]
        : [21.1702, 72.8311]; // Default center (Surat)

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="flex">
                <Sidebar />
                <main className="flex-1 p-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-800">Engineer Tracking</h1>
                            <p className="mt-2 text-gray-600">Monitor engineer locations and routes</p>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <span className="text-lg font-medium text-blue-600">Loading engineers...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {engineers.map((engineer) => (
                                    <div
                                        key={engineer.id}
                                        className={`bg-white rounded-xl shadow-sm border transition-all ${
                                            selectedEngineer?.id === engineer.id
                                                ? 'border-blue-500 ring-2 ring-blue-200'
                                                : 'border-gray-100 hover:border-blue-200'
                                        }`}
                                    >
                                        <div className="p-6">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center">
                                                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                                                        <span className="text-xl font-semibold text-blue-600">
                                                            {engineer.name[0].toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="ml-4">
                                                        <h3 className="text-lg font-semibold text-gray-800">{engineer.name}</h3>
                                                        <p className="text-sm text-gray-500 capitalize">{engineer.role}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleViewLocation(engineer)}
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                        selectedEngineer?.id === engineer.id
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {selectedEngineer?.id === engineer.id ? 'Viewing' : 'View Location'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedEngineer && timelineData.length > 0 && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <h2 className="text-xl font-semibold text-gray-800">
                                        {selectedEngineer.name}'s Timeline
                                    </h2>
                                    <input
                                        type="date"
                                        value={selectedDate.toISOString().split('T')[0]}
                                        onChange={(e) => {
                                            const newDate = new Date(e.target.value);
                                            setSelectedDate(newDate);
                                            fetchTimeline(selectedEngineer.id, newDate);
                                        }}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="h-[600px] relative">
                                    <MapContainer key={mapKey} center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            attribution='&copy; OpenStreetMap contributors'
                                        />

                                        {/* Draw user's route */}
                                        {path.length > 1 && (
                                            <Polyline positions={path} color="blue" weight={3} />
                                        )}

                                        {/* Punch In (START) */}
                                        {startPoint && (
                                            <Marker position={[startPoint.latitude, startPoint.longitude]} icon={punchInIcon}>
                                                <Popup>
                                                    <div className="text-sm">
                                                        <strong>Punch In</strong><br />
                                                        {startPoint.updated_at}
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}

                                        {/* Punch Out (END) */}
                                        {endPoint && (
                                            <Marker position={[endPoint.latitude, endPoint.longitude]} icon={punchOutIcon}>
                                                <Popup>
                                                    <div className="text-sm">
                                                        <strong>Punch Out</strong><br />
                                                        {endPoint.updated_at}
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}
                                    </MapContainer>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
