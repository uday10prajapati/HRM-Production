import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

// Create custom colored icons
const blueIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

export default function MapView() {
    const [engineers, setEngineers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEngineer, setSelectedEngineer] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [timelineData, setTimelineData] = useState(null);
    const [mapKey, setMapKey] = useState(0); // Add this for map re-rendering

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radius of earth in KM
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const deg2rad = (deg) => {
        return deg * (Math.PI / 180);
    };

    const fetchEngineers = async () => {
        try {
            const response = await axios.get('/api/attendance/engineers');
            console.log('Engineers data:', response.data);
            setEngineers(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch engineers:', error);
            setLoading(false);
        }
    };

    const fetchTimeline = async (userId, date) => {
        try {
            const response = await axios.get(
                `http://localhost:5000/api/live_locations/timeline/${userId}`,
                {
                    params: { date: date.toISOString().split('T')[0] }
                }
            );

            if (response.data.success) {
                setTimelineData(response.data.timeline);
            }
        } catch (err) {
            console.error('Failed to fetch timeline:', err);
        }
    };

    const handleViewLocation = async (engineer) => {
        try {
            setSelectedEngineer(engineer);
            await fetchTimeline(engineer.id, selectedDate);
            // Force map re-render when changing selection
            setMapKey(prev => prev + 1);
        } catch (error) {
            console.error('Error viewing location:', error);
        }
    };

    useEffect(() => {
        fetchEngineers();
    }, []);

    const defaultCenter = [21.1702, 72.8311]; // Default coordinates for Surat, Gujarat

    const getMapCenter = (locations) => {
        if (locations?.punch_in?.latitude && locations?.punch_in?.longitude) {
            return [locations.punch_in.latitude, locations.punch_in.longitude];
        }
        if (locations?.punch_out?.latitude && locations?.punch_out?.longitude) {
            return [locations.punch_out.latitude, locations.punch_out.longitude];
        }
        return defaultCenter;
    };

    const hasValidLocations = (engineer) => {
        return engineer?.locations?.punch_in && 
               engineer?.locations?.punch_out &&
               engineer.locations.punch_in.latitude != null &&
               engineer.locations.punch_in.longitude != null &&
               engineer.locations.punch_out.latitude != null &&
               engineer.locations.punch_out.longitude != null;
    };

    const renderMap = () => {
        if (!selectedEngineer || !timelineData) return null;

        const positions = timelineData.map(loc => ({
            position: [loc.latitude, loc.longitude],
            type: loc.location_type,
            time: loc.updated_at,
            icon: loc.location_type === 'PUNCH_IN' ? blueIcon :
                loc.location_type === 'PUNCH_OUT' ? redIcon :
                    new L.divIcon({
                        className: 'bg-yellow-500 w-2 h-2 rounded-full',
                        iconSize: [8, 8]
                    })
        }));

        // Calculate center point from positions
        const center = positions.length > 0
            ? [
                positions.reduce((sum, pos) => sum + pos.position[0], 0) / positions.length,
                positions.reduce((sum, pos) => sum + pos.position[1], 0) / positions.length
              ]
            : defaultCenter;

        return (
            <div className="mt-6">
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-medium">
                            {selectedEngineer.name}'s Timeline
                        </h2>
                        <div className="flex items-center gap-4">
                            <input
                                type="date"
                                value={selectedDate.toISOString().split('T')[0]}
                                onChange={(e) => {
                                    const newDate = new Date(e.target.value);
                                    setSelectedDate(newDate);
                                    fetchTimeline(selectedEngineer.id, newDate);
                                }}
                                className="border rounded px-2 py-1"
                            />
                        </div>
                    </div>

                    <div className="h-96">
                        <MapContainer
                            center={center}
                            zoom={12}
                            style={{ height: '100%', width: '100%' }}
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            />
                            {positions.map((pos, idx) => (
                                <Marker key={idx} position={pos.position} icon={pos.icon}>
                                    <Popup>
                                        <div className="text-sm">
                                            <strong>{pos.type === 'PUNCH_IN' ? 'Punch In' : 'Punch Out'}</strong><br />
                                            Time: {new Date(pos.time).toLocaleString()}<br />
                                            {idx > 0 && (
                                                <>
                                                    Distance from previous: {
                                                        calculateDistance(
                                                            positions[idx - 1].position[0],
                                                            positions[idx - 1].position[1],
                                                            pos.position[0],
                                                            pos.position[1]
                                                        ).toFixed(2)
                                                    } KM
                                                </>
                                            )}
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                            {positions.length > 1 && (
                                <Polyline
                                    positions={positions.map(p => p.position)}
                                    color="#007BFF"
                                    opacity={0.8}
                                    weight={4}
                                />
                            )}
                        </MapContainer>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="flex items-center">
                            <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
                            <span>Punch In</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
                            <span>Punch Out</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="flex">
                <Sidebar />
                <main className="flex-1 p-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Header Section */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-800">Engineer Tracking</h1>
                            <p className="mt-2 text-gray-600">Monitor engineer locations and movement patterns</p>
                        </div>

                        {/* Engineers Grid */}
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="flex items-center space-x-3 text-blue-600">
                                    <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                    </svg>
                                    <span className="text-lg font-medium">Loading engineers...</span>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {engineers.map(engineer => (
                                    <div key={engineer.id} 
                                         className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 
                                            ${selectedEngineer?.id === engineer.id 
                                                ? 'border-blue-500 ring-2 ring-blue-200' 
                                                : 'border-gray-100 hover:border-blue-200'}`}>
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
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                                        ${selectedEngineer?.id === engineer.id
                                                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                                >
                                                    {selectedEngineer?.id === engineer.id ? 'Viewing' : 'View Location'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Map Section */}
                        {selectedEngineer && timelineData && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 border-b border-gray-200">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <h2 className="text-xl font-semibold text-gray-800">
                                            {selectedEngineer.name}'s Movement Timeline
                                        </h2>
                                        <div className="flex items-center space-x-4">
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
                                    </div>
                                </div>

                                <div className="h-[600px] relative">
                                    <MapContainer
                                        key={mapKey} // Add key to force re-render
                                        center={[
                                            timelineData?.punch_in?.latitude || 20.5937,
                                            timelineData?.punch_in?.longitude || 78.9629
                                        ]}
                                        zoom={13}
                                        style={{ height: '100%', width: '100%' }}
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        />
                                        
                                        {/* Punch In Marker */}
                                        {timelineData?.punch_in && (
                                            <Marker
                                                position={[timelineData.punch_in.latitude, timelineData.punch_in.longitude]}
                                                icon={blueIcon}
                                            >
                                                <Popup>
                                                    <div className="text-sm">
                                                        <strong>Punch In</strong>
                                                        <br />
                                                        Time: {new Date(timelineData.punch_in.timestamp).toLocaleTimeString()}
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}

                                        {/* Punch Out Marker */}
                                        {timelineData?.punch_out && (
                                            <Marker
                                                position={[timelineData.punch_out.latitude, timelineData.punch_out.longitude]}
                                                icon={redIcon}
                                            >
                                                <Popup>
                                                    <div className="text-sm">
                                                        <strong>Punch Out</strong>
                                                        <br />
                                                        Time: {new Date(timelineData.punch_out.timestamp).toLocaleTimeString()}
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}

                                        {/* Route Line */}
                                        {timelineData?.punch_in && timelineData?.punch_out && (
                                            <Polyline
                                                positions={[
                                                    [timelineData.punch_in.latitude, timelineData.punch_in.longitude],
                                                    [timelineData.punch_out.latitude, timelineData.punch_out.longitude]
                                                ]}
                                                color="blue"
                                            />
                                        )}
                                    </MapContainer>
                                </div>

                                <div className="p-6 bg-gray-50 border-t border-gray-200">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                                            <span className="text-sm text-gray-600">Punch In</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                                            <span className="text-sm text-gray-600">Punch Out</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                                            <span className="text-sm text-gray-600">Checkpoints</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="h-0.5 w-8 bg-blue-500"></div>
                                            <span className="text-sm text-gray-600">Route</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Distance Information */}
                        {selectedEngineer && hasValidLocations(selectedEngineer) && (
                            <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-blue-900">Total Distance Covered</h3>
                                        <p className="text-sm text-blue-700 mt-1">
                                            From punch-in to punch-out location
                                        </p>
                                    </div>
                                    <div className="text-3xl font-bold text-blue-900">
                                        {calculateDistance(
                                            selectedEngineer.locations.punch_in.latitude,
                                            selectedEngineer.locations.punch_in.longitude,
                                            selectedEngineer.locations.punch_out.latitude,
                                            selectedEngineer.locations.punch_out.longitude
                                        ).toFixed(2)} km
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}