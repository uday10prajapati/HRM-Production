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

    // Helper function to calculate distance using Haversine formula
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Calculate total distance traveled
    let totalDistance = 0;
    if (timelineData.length > 1) {
        for (let i = 0; i < timelineData.length - 1; i++) {
            totalDistance += calculateDistance(
                timelineData[i].latitude,
                timelineData[i].longitude,
                timelineData[i + 1].latitude,
                timelineData[i + 1].longitude
            );
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50/50">
            <div className="fixed top-0 w-full z-50"><Navbar /></div>
            <div className="flex flex-1 pt-16 overflow-hidden">
                <div className="fixed left-0 h-full w-64 hidden md:block"><Sidebar /></div>

                <main className="flex-1 md:ml-64 p-4 sm:p-8 relative overflow-y-auto w-full custom-scrollbar">

                    {/* Background Pattern */}
                    <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none -z-10" />

                    <div className="max-w-7xl mx-auto space-y-8">
                        {/* Header Section */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-8">
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Engineer Tracking</h1>
                                <p className="text-sm font-medium text-slate-500 mt-2">Monitor operator live map locations and routes.</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl shadow-sm border border-slate-100">
                                <svg className="animate-spin h-10 w-10 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Compiling Database...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                                {engineers.map((engineer) => (
                                    <div
                                        key={engineer.id}
                                        onClick={() => handleViewLocation(engineer)}
                                        className={`cursor-pointer bg-white rounded-3xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border transition-all duration-300 group ${selectedEngineer?.id === engineer.id
                                            ? 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-md translate-y-[-2px]'
                                            : 'border-slate-100 hover:border-indigo-200 hover:shadow-md hover:translate-y-[-2px]'
                                            }`}
                                    >
                                        <div className="p-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${selectedEngineer?.id === engineer.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'}`}>
                                                        <span className="text-xl font-bold">
                                                            {engineer.name[0].toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-slate-900">{engineer.name}</h3>
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{engineer.role}</p>
                                                    </div>
                                                </div>

                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedEngineer?.id === engineer.id ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedEngineer && (
                            <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden mb-8 animate-[fadeIn_0.3s_ease-out]">
                                <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-slate-50/50">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-indigo-600">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900">
                                                Timeline Array
                                            </h2>
                                            {timelineData.length > 0 ? (
                                                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 mt-1 flex items-center gap-1.5 bg-emerald-50 w-fit px-2 py-0.5 rounded-md border border-emerald-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    Total Distance: {totalDistance.toFixed(2)} km
                                                </p>
                                            ) : (
                                                <p className="text-[11px] font-bold uppercase tracking-widest text-red-600 mt-1 flex items-center gap-1.5 bg-red-50 w-fit px-2 py-0.5 rounded-md border border-red-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                    Status: No travel today
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="relative shrink-0">
                                        <input
                                            type="date"
                                            value={selectedDate.toISOString().split('T')[0]}
                                            onChange={(e) => {
                                                const newDate = new Date(e.target.value);
                                                setSelectedDate(newDate);
                                                fetchTimeline(selectedEngineer.id, newDate);
                                            }}
                                            className="px-4 py-2.5 bg-white border border-slate-200 text-sm font-bold text-slate-700 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer shadow-sm w-full sm:w-auto"
                                        />
                                    </div>
                                </div>

                                <div className="h-[600px] relative bg-slate-100">
                                    {timelineData.length === 0 && (
                                        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-900/10 backdrop-blur-sm">
                                            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center max-w-sm animate-[fadeIn_0.2s_ease-out]">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex flex-col items-center justify-center mx-auto mb-4 border border-slate-100">
                                                    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-900">No Location Array</h3>
                                                <p className="text-sm font-medium text-slate-500 mt-2">Engineer has not recorded any map positioning signatures on this date.</p>
                                            </div>
                                        </div>
                                    )}
                                    <MapContainer key={mapKey} center={mapCenter} zoom={14} style={{ height: '100%', width: '100%', zIndex: 10 }}>
                                        <TileLayer
                                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                        />

                                        {/* Draw user's route */}
                                        {path.length > 1 && (
                                            <Polyline positions={path} color="#4f46e5" weight={4} opacity={0.8} />
                                        )}

                                        {/* Punch In (START) */}
                                        {startPoint && (
                                            <Marker position={[startPoint.latitude, startPoint.longitude]} icon={punchInIcon}>
                                                <Popup className="custom-popup">
                                                    <div className="text-center font-sans">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1">Punch In Location</p>
                                                        <p className="text-xs font-semibold text-slate-700">{startPoint.updated_at}</p>
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}

                                        {/* Punch Out (END) */}
                                        {endPoint && (
                                            <Marker position={[endPoint.latitude, endPoint.longitude]} icon={punchOutIcon}>
                                                <Popup className="custom-popup">
                                                    <div className="text-center font-sans">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">Punch Out Location</p>
                                                        <p className="text-xs font-semibold text-slate-700">{endPoint.updated_at}</p>
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}
                                    </MapContainer>
                                </div>
                            </div>
                        )}

                        {/* Detailed Activity Log */}
                        {selectedEngineer && timelineData.length > 0 && (
                            <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 p-6 sm:p-8 animate-[fadeIn_0.4s_ease-out] mb-8">
                                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Detailed Timeline Log
                                </h3>
                                <div className="relative border-l-2 border-slate-100 ml-3 md:ml-4 space-y-8">
                                    {timelineData.map((point, idx) => {
                                        let durationText = "";
                                        let highlight = false;
                                        if (idx < timelineData.length - 1) {
                                            const nextPoint = timelineData[idx + 1];
                                            const t1 = new Date(point.updated_at).getTime();
                                            const t2 = new Date(nextPoint.updated_at).getTime();
                                            const diffMins = Math.round((t2 - t1) / 60000);

                                            // The distance between the current recorded point and the next recorded point in the timeline
                                            const dist = calculateDistance(point.latitude, point.longitude, nextPoint.latitude, nextPoint.longitude);

                                            if (diffMins > 0) {
                                                if (dist < 0.05) { // 50 meters
                                                    durationText = `Stayed near this location for ~${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
                                                    highlight = diffMins > 10; // Highlight if they stayed more than 10 mins without moving much
                                                } else {
                                                    durationText = `Traveled ${dist.toFixed(2)} km in ~${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
                                                }
                                            }
                                        }

                                        return (
                                            <div key={idx} className="relative pl-6 sm:pl-8 group">
                                                {/* Timeline Dot */}
                                                <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 border-white ${point.point_type === 'START' ? 'bg-emerald-500' : point.point_type === 'END' ? 'bg-red-500' : 'bg-indigo-400'} shadow-sm group-hover:scale-125 transition-transform z-10`}></div>

                                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md ${point.point_type === 'START' ? 'bg-emerald-100 text-emerald-700' : point.point_type === 'END' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                                {point.point_type || 'POSITION UPDATE'}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-400">
                                                                {new Date(point.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] font-mono text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                                                            {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                                                        </div>
                                                    </div>

                                                    <p className="text-sm font-medium text-slate-600">
                                                        {point.point_type === 'START' && "Started Day / Punched In"}
                                                        {point.point_type === 'END' && "Ended Day / Punched Out"}
                                                        {!['START', 'END'].includes(point.point_type) && "Location recorded by device"}
                                                    </p>

                                                    {durationText && (
                                                        <div className={`mt-3 pt-3 border-t flex items-start gap-2 ${highlight ? 'border-amber-100' : 'border-slate-100'}`}>
                                                            <svg className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? 'text-amber-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                {highlight
                                                                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                                }
                                                            </svg>
                                                            <span className={`text-xs font-bold ${highlight ? 'text-amber-600' : 'text-slate-500'}`}>{durationText}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
