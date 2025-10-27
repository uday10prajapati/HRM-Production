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

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radius of earth in KM
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const deg2rad = (deg) => {
        return deg * (Math.PI/180);
    };

    const handleViewLocation = (engineer) => {
        console.log('Selected engineer:', engineer);
        setSelectedEngineer(engineer);
    };

    // Fetch all engineers
    useEffect(() => {
        fetchEngineers();
    }, []);

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

    // Add default coordinates (you can change these to your desired default location)
    const defaultCenter = [21.1702, 72.8311]; // Default coordinates for Surat, Gujarat

    // Add function to get map center
    const getMapCenter = (locations) => {
        if (locations?.punch_in?.latitude && locations?.punch_in?.longitude) {
            return [locations.punch_in.latitude, locations.punch_in.longitude];
        }
        if (locations?.punch_out?.latitude && locations?.punch_out?.longitude) {
            return [locations.punch_out.latitude, locations.punch_out.longitude];
        }
        return defaultCenter;
    };

    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <div className="flex flex-1">
                <Sidebar />
                <main className="flex-1 p-6">
                    <div className="mb-6">
                        <h1 className="text-2xl font-semibold">Engineer Locations</h1>
                    </div>

                    {loading ? (
                        <div className="text-center py-4">Loading engineers...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {engineers.map(engineer => (
                                <div key={engineer.id} className="bg-white rounded-lg shadow p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-medium">{engineer.name}</h3>
                                            <p className="text-sm text-gray-500 capitalize">{engineer.role}</p>
                                        </div>
                                        <button
                                            onClick={() => handleViewLocation(engineer)}
                                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                                        >
                                            View Location
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedEngineer && (
                        <div className="mt-6">
                            <div className="bg-white rounded-lg shadow p-4">
                                <h2 className="text-xl font-medium mb-4">
                                    Location Details for {selectedEngineer.name}
                                </h2>
                                
                                {selectedEngineer.locations?.punch_in && selectedEngineer.locations?.punch_out && (
                                    <div className="mb-4 bg-blue-50 p-3 rounded">
                                        <p className="text-blue-800">
                                            Distance Traveled: {calculateDistance(
                                                selectedEngineer.locations.punch_in.latitude,
                                                selectedEngineer.locations.punch_in.longitude,
                                                selectedEngineer.locations.punch_out.latitude,
                                                selectedEngineer.locations.punch_out.longitude
                                            ).toFixed(2)} km
                                        </p>
                                    </div>
                                )}

                                <div className="h-96">
                                    <MapContainer 
                                        center={[
                                            selectedEngineer.locations.punch_in.latitude,
                                            selectedEngineer.locations.punch_in.longitude
                                        ]} 
                                        zoom={18} 
                                        style={{ height: '100%', width: '100%' }}
                                    >
                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        />
                                        
                                        {/* Punch In Marker (Blue) */}
                                        <Marker 
                                            position={[
                                                selectedEngineer.locations.punch_in.latitude,
                                                selectedEngineer.locations.punch_in.longitude
                                            ]}
                                            icon={blueIcon}
                                        >
                                            <Popup>
                                                <strong>Punch In Location</strong><br />
                                                Time: {new Date(selectedEngineer.locations.punch_in.created_at).toLocaleString()}<br />
                                                Lat: {selectedEngineer.locations.punch_in.latitude.toFixed(6)}<br />
                                                Lng: {selectedEngineer.locations.punch_in.longitude.toFixed(6)}
                                            </Popup>
                                        </Marker>

                                        {/* Punch Out Marker (Red) */}
                                        <Marker 
                                            position={[
                                                selectedEngineer.locations.punch_out.latitude,
                                                selectedEngineer.locations.punch_out.longitude
                                            ]}
                                            icon={redIcon}
                                        >
                                            <Popup>
                                                <strong>Punch Out Location</strong><br />
                                                Time: {new Date(selectedEngineer.locations.punch_out.created_at).toLocaleString()}<br />
                                                Lat: {selectedEngineer.locations.punch_out.latitude.toFixed(6)}<br />
                                                Lng: {selectedEngineer.locations.punch_out.longitude.toFixed(6)}
                                            </Popup>
                                        </Marker>

                                        {/* Line connecting the points */}
                                        <Polyline 
                                            positions={[
                                                [
                                                    selectedEngineer.locations.punch_in.latitude,
                                                    selectedEngineer.locations.punch_in.longitude
                                                ],
                                                [
                                                    selectedEngineer.locations.punch_out.latitude,
                                                    selectedEngineer.locations.punch_out.longitude
                                                ]
                                            ]}
                                            color="purple"
                                            weight={3}
                                            opacity={0.6}
                                            dashArray="10, 10"
                                        />
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
                    )}
                </main>
            </div>
        </div>
    );
}