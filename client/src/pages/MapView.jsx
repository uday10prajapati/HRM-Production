import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toJpeg, toPng } from 'html-to-image';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Global cache for resolved addresses to prevent duplicate Nominatim API requests
const addressCache = {};

const formatAddress = (data) => {
    if (!data) return 'Unknown Area';
    const addrObj = data.address || {};
    const parts = [];

    // Pick specific fields first for detail
    if (addrObj.amenity || addrObj.shop || addrObj.building || addrObj.office || addrObj.tourism || addrObj.historic) {
        parts.push(addrObj.amenity || addrObj.shop || addrObj.building || addrObj.office || addrObj.tourism || addrObj.historic);
    }
    if (addrObj.house_number) {
        parts.push(addrObj.house_number);
    }
    if (addrObj.road) {
        parts.push(addrObj.road);
    }
    if (addrObj.neighbourhood || addrObj.suburb || addrObj.hamlet) {
        parts.push(addrObj.neighbourhood || addrObj.suburb || addrObj.hamlet);
    }
    if (addrObj.village || addrObj.town || addrObj.city_district || addrObj.city) {
        parts.push(addrObj.village || addrObj.town || addrObj.city_district || addrObj.city);
    }
    if (addrObj.county) {
        parts.push(addrObj.county);
    }
    if (addrObj.state_district) {
        parts.push(addrObj.state_district);
    }
    if (addrObj.state) {
        parts.push(addrObj.state);
    }

    if (parts.length < 2) {
        // Fallback to display name if details aren't populated (filtering out Zip and India)
        return data.display_name?.split(', ').filter(p => p !== 'India' && !/^\d{6}$/.test(p)).slice(0, 5).join(', ') || 'Unknown Area';
    }

    // Deduplicate array elements
    const uniqueParts = [...new Set(parts.map(p => p.trim()))];
    return uniqueParts.join(', ');
};


// Custom icons using inline SVG to avoid CORS issues
const punchInIcon = L.divIcon({
    html: `<div style="display: flex; flex-direction: column; align-items: center;">
             <svg width="28" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
               <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#3B82F6" stroke="#FFFFFF" stroke-width="1.5"/>
             </svg>
           </div>`,
    className: 'custom-leaflet-icon-blue',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36]
});

const punchOutIcon = L.divIcon({
    html: `<div style="display: flex; flex-direction: column; align-items: center;">
             <svg width="28" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
               <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#EF4444" stroke="#FFFFFF" stroke-width="1.5"/>
             </svg>
           </div>`,
    className: 'custom-leaflet-icon-red',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36]
});

const currentIcon = L.divIcon({
    html: `<div style="display: flex; flex-direction: column; align-items: center; position: relative;">
             <svg width="28" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
               <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#10B981" stroke="#FFFFFF" stroke-width="1.5"/>
             </svg>
           </div>`,
    className: 'custom-leaflet-icon-green',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36]
});

// Global queue to fetch addresses sequentially (1 request at a time) to prevent rate limiting
const geocodeQueue = [];
let isProcessingQueue = false;

const processGeocodeQueue = async () => {
    if (isProcessingQueue || geocodeQueue.length === 0) return;
    isProcessingQueue = true;

    while (geocodeQueue.length > 0) {
        const { lat, lon, callback } = geocodeQueue.shift();
        const cacheKey = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;

        if (addressCache[cacheKey]) {
            callback(addressCache[cacheKey]);
            continue;
        }

        try {
            const res = await axios.get(`/api/live_locations/geocode?lat=${lat}&lon=${lon}`);
            const formatted = formatAddress(res.data.data);
            addressCache[cacheKey] = formatted;
            callback(formatted);
        } catch (e) {
            callback('Address unavailable');
        }

        // Wait 1.2 seconds between geocoding requests to strictly respect Nominatim's rate limit
        await new Promise(r => setTimeout(r, 1200));
    }

    isProcessingQueue = false;
};

const queueGeocode = (lat, lon, callback, priority = false) => {
    const cacheKey = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
    if (addressCache[cacheKey]) {
        callback(addressCache[cacheKey]);
        return;
    }
    if (priority) {
        geocodeQueue.unshift({ lat, lon, callback });
    } else {
        geocodeQueue.push({ lat, lon, callback });
    }
    processGeocodeQueue();
};

const LocationName = ({ lat, lon, priority = false }) => {
    const [addr, setAddr] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        queueGeocode(lat, lon, (resolved) => {
            setAddr(resolved);
            setLoading(false);
        }, priority);
    }, [lat, lon, priority]);

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

    if (loading) {
        return (
            <div className="mt-2 text-xs text-slate-400 animate-pulse flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3 text-indigo-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Fetching address...</span>
            </div>
        );
    }

    if (addr) return (
        <div className="mt-2 text-xs font-bold text-slate-700 bg-slate-100 p-2.5 rounded-lg border border-slate-200 flex flex-col gap-2 shadow-sm text-left animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span>{addr}</span>
            </div>
            <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-wider mt-1 w-fit border-b border-dashed border-indigo-400 hover:border-indigo-600 pb-0.5"
            >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View on Google Maps
            </a>
        </div>
    );

    return null;
};

export default function MapView() {
    const [engineers, setEngineers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEngineer, setSelectedEngineer] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [timelineData, setTimelineData] = useState([]);
    const [mapKey, setMapKey] = useState(0);
    const [mapStyle, setMapStyle] = useState('satellite'); // default to satellite
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [isDownloadingImage, setIsDownloadingImage] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState('');

    const handleDownloadPdf = async () => {
        if (!selectedEngineer) {
            toast.warning("Please select an engineer first.");
            return;
        }
        if (timelineData.length === 0) {
            toast.info("No travel history found for this date.");
            return;
        }

        setIsDownloadingPdf(true);
        setDownloadProgress("Starting...");

        try {
            // Find start and end points
            const startPt = timelineData.find((p) => p.point_type === 'START') || timelineData[0];
            const endPt = timelineData.find((p) => p.point_type === 'END') || (timelineData.length > 1 ? timelineData[timelineData.length - 1] : null);

            // Fetch address for start point if not cached
            let startAddr = 'Unknown Area';
            if (startPt) {
                const cacheKey = `${Number(startPt.latitude).toFixed(4)},${Number(startPt.longitude).toFixed(4)}`;
                if (addressCache[cacheKey]) {
                    startAddr = addressCache[cacheKey];
                } else {
                    setDownloadProgress("Start Address...");
                    try {
                        const response = await axios.get(`/api/live_locations/geocode?lat=${startPt.latitude}&lon=${startPt.longitude}`);
                        startAddr = formatAddress(response.data.data);
                        addressCache[cacheKey] = startAddr;
                    } catch (e) {
                        startAddr = 'Address unavailable';
                    }
                    // small delay to respect OSM guidelines
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            // Fetch address for end point if not cached
            let endAddr = 'Unknown Area';
            if (endPt) {
                const cacheKey = `${Number(endPt.latitude).toFixed(4)},${Number(endPt.longitude).toFixed(4)}`;
                if (addressCache[cacheKey]) {
                    endAddr = addressCache[cacheKey];
                } else {
                    setDownloadProgress("End Address...");
                    try {
                        const response = await axios.get(`/api/live_locations/geocode?lat=${endPt.latitude}&lon=${endPt.longitude}`);
                        endAddr = formatAddress(response.data.data);
                        addressCache[cacheKey] = endAddr;
                    } catch (e) {
                        endAddr = 'Address unavailable';
                    }
                }
            }

            // Capture the travel map image using html-to-image
            let mapImgBase64 = null;
            const mapEl = document.getElementById('travel-map-container');
            if (mapEl) {
                setDownloadProgress("Capturing Map...");
                // Temporarily hide control buttons overlay for clean capture
                const controls = mapEl.querySelectorAll('.leaflet-control-container, .absolute.top-4.right-4');
                controls.forEach(el => el.style.display = 'none');

                try {
                    // Small delay to make sure Leaflet map tiles are fully redrawn
                    await new Promise(r => setTimeout(r, 150));
                    mapImgBase64 = await toJpeg(mapEl, {
                        quality: 0.85,
                        pixelRatio: 1.5,
                        backgroundColor: '#ffffff'
                    });
                } catch (err) {
                    console.error("Failed to capture map image:", err);
                } finally {
                    // Restore control elements display
                    controls.forEach(el => el.style.display = '');
                }
            }

            setDownloadProgress("Structuring PDF...");

            // Create PDF doc
            const doc = new jsPDF();

            // 1. Header
            doc.setFillColor(79, 70, 229); // Indigo-600
            doc.rect(0, 0, 210, 35, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text("ENGINEER TRAVEL HISTORY", 14, 18);

            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
            doc.text(`System: HRM Admin Portal`, 155, 28);

            let currentY = 45;

            // 2. Employee Details
            doc.setTextColor(15, 23, 42); // slate-900
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text("Employee Information", 14, currentY);
            currentY += 6;

            // Draw a light background rectangle for employee details
            doc.setFillColor(248, 250, 252); // slate-50
            doc.rect(14, currentY, 182, 25, 'F');
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.rect(14, currentY, 182, 25, 'D');

            doc.setTextColor(71, 85, 105); // slate-600
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Name:`, 18, currentY + 9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(`${selectedEngineer.name}`, 38, currentY + 9);

            doc.setFont(undefined, 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(`Role:`, 18, currentY + 17);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(`${selectedEngineer.role || 'ENGINEER'}`, 38, currentY + 17);

            doc.setFont(undefined, 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(`Date:`, 110, currentY + 9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(`${selectedDate.toLocaleDateString()}`, 135, currentY + 9);

            doc.setFont(undefined, 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(`Total Distance:`, 110, currentY + 17);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(16, 185, 129); // emerald-500
            doc.text(`${totalDistance.toFixed(2)} km`, 135, currentY + 17);

            currentY += 35;

            // 3. Start & End points Summary
            doc.setTextColor(15, 23, 42); // slate-900
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text("Key Milestones", 14, currentY);
            currentY += 6;

            const milestoneData = [
                [
                    { content: 'START MOVEMENT (Punch In)', styles: { fontStyle: 'bold', textColor: [16, 185, 129] } },
                    startPt ? new Date(startPt.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
                    startPt ? `${startPt.latitude.toFixed(4)}, ${startPt.longitude.toFixed(4)}` : 'N/A',
                    startAddr
                ]
            ];

            if (endPt) {
                milestoneData.push([
                    { content: 'END MOVEMENT (Punch Out)', styles: { fontStyle: 'bold', textColor: [239, 68, 68] } },
                    new Date(endPt.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    `${endPt.latitude.toFixed(4)}, ${endPt.longitude.toFixed(4)}`,
                    endAddr
                ]);
            }

            autoTable(doc, {
                startY: currentY,
                head: [['Milestone', 'Time', 'Coordinates', 'Physical Address']],
                body: milestoneData,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 50 },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 32 },
                    3: { cellWidth: 80 }
                },
                styles: { fontSize: 9 }
            });

            currentY = doc.lastAutoTable.finalY + 12;

            if (mapImgBase64) {
                // If map doesn't fit on page 1, push to page 2
                if (currentY + 105 > doc.internal.pageSize.height) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.setTextColor(15, 23, 42); // slate-900
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text("Visual Route Map", 14, currentY);
                currentY += 6;

                doc.addImage(mapImgBase64, 'JPEG', 14, currentY, 182, 90);
                currentY += 98; // 90 height + 8 margin
            }

            // 4. Detailed Timeline Log
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text("Detailed Path & Movement History", 14, currentY);
            currentY += 6;

            const tableBody = timelineData.map((point) => {
                const timeStr = new Date(point.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const typeStr = point.point_type || 'POSITION UPDATE';
                const coordStr = `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;

                // Show physical address only for START and END points, or if already cached
                let address = '';
                if (point === startPt) {
                    address = startAddr;
                } else if (point === endPt) {
                    address = endAddr;
                } else {
                    const cacheKey = `${Number(point.latitude).toFixed(4)},${Number(point.longitude).toFixed(4)}`;
                    address = addressCache[cacheKey] || '';
                }

                return [timeStr, typeStr, coordStr, address];
            });

            autoTable(doc, {
                startY: currentY,
                head: [['Time', 'Point Type', 'Coordinates', 'Address']],
                body: tableBody,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 92 }
                },
                styles: { fontSize: 8.5 }
            });

            // 5. Footer page number
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184); // slate-400
                doc.text(
                    `Page ${i} of ${pageCount}`,
                    doc.internal.pageSize.width / 2,
                    doc.internal.pageSize.height - 10,
                    { align: 'center' }
                );
            }

            // Save
            const dateStr = selectedDate.toISOString().split('T')[0];
            doc.save(`travel_history_${selectedEngineer.name.replace(/\s+/g, '_')}_${dateStr}.pdf`);
            toast.success("PDF Downloaded successfully!");
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast.error("An error occurred while generating the PDF.");
        } finally {
            setIsDownloadingPdf(false);
            setDownloadProgress('');
        }
    };

    const handleDownloadMapImage = async () => {
        if (!selectedEngineer) {
            toast.warning("Please select an engineer first.");
            return;
        }
        if (timelineData.length === 0) {
            toast.info("No travel history found for this date.");
            return;
        }

        setIsDownloadingImage(true);
        setDownloadProgress("Capturing Map...");

        const mapEl = document.getElementById('travel-map-container');
        if (!mapEl) {
            toast.error("Map container not found.");
            setIsDownloadingImage(false);
            return;
        }

        // Temporarily hide control buttons overlay for clean capture
        const controls = mapEl.querySelectorAll('.leaflet-control-container, .absolute.top-4.right-4');
        controls.forEach(el => el.style.display = 'none');

        try {
            await new Promise(r => setTimeout(r, 150));
            const dataUrl = await toPng(mapEl, {
                pixelRatio: 2.0,
                backgroundColor: '#ffffff'
            });

            // Convert to blob and download
            const link = document.createElement('a');
            const dateStr = selectedDate.toISOString().split('T')[0];
            link.download = `travel_map_${selectedEngineer.name.replace(/\s+/g, '_')}_${dateStr}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Map image downloaded successfully!");
        } catch (err) {
            console.error("Failed to capture map image:", err);
            toast.error("An error occurred while capturing the map image.");
        } finally {
            // Restore control elements display
            controls.forEach(el => el.style.display = '');
            setIsDownloadingImage(false);
            setDownloadProgress('');
        }
    };

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

    // Real-time Auto-Refresh (SWR-style): 
    // Automatically refetch the live timeline every 30 seconds if tracking today's route
    useEffect(() => {
        if (!selectedEngineer) return;

        // Fetch immediately
        fetchTimeline(selectedEngineer.id, selectedDate);

        // Only start the 30-second polling interval if the selected date is TODAY
        const isToday = selectedDate.toDateString() === new Date().toDateString();
        if (!isToday) return;

        console.log(`⏱️ Live Tracking: 30s auto-refresh started for ${selectedEngineer.name}`);
        const pollInterval = setInterval(() => {
            console.log(`🔄 Fetching live updates for ${selectedEngineer.name}...`);
            fetchTimeline(selectedEngineer.id, selectedDate);
        }, 30000); // 30 seconds

        return () => {
            console.log(`⏱️ Live Tracking: Stopped auto-refresh`);
            clearInterval(pollInterval);
        };
    }, [selectedEngineer, selectedDate]);

    const handleViewLocation = (engineer) => {
        setSelectedEngineer(engineer);
        setMapKey((prev) => prev + 1);
    };

    const startPoint = timelineData.find((p) => p.point_type === 'START');
    const endPoint = timelineData.find((p) => p.point_type === 'END');
    const currentPoint = timelineData.length > 0 ? timelineData[timelineData.length - 1] : null;
    const isSelectedDateToday = selectedDate.toDateString() === new Date().toDateString();

    const showCurrentPoint = currentPoint &&
        (!startPoint || startPoint.updated_at !== currentPoint.updated_at) &&
        (!endPoint || endPoint.updated_at !== currentPoint.updated_at);

    // Draw full route (all points, including movement)
    const path = timelineData.map((p) => [p.latitude, p.longitude]);

    const mapCenter = currentPoint
        ? [currentPoint.latitude, currentPoint.longitude]
        : startPoint
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

                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full sm:w-auto">
                                        <div className="relative">
                                            <input
                                                type="date"
                                                value={selectedDate.toISOString().split('T')[0]}
                                                onChange={(e) => {
                                                    const newDate = new Date(e.target.value);
                                                    setSelectedDate(newDate);
                                                    fetchTimeline(selectedEngineer.id, newDate);
                                                }}
                                                className="px-4 py-2.5 bg-white border border-slate-200 text-sm font-bold text-slate-700 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer shadow-sm w-full"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleDownloadMapImage}
                                            disabled={isDownloadingPdf || isDownloadingImage || timelineData.length === 0}
                                            className="inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-500/10 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 cursor-pointer"
                                        >
                                            {isDownloadingImage ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    <span className="truncate max-w-[150px]">{downloadProgress}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4.5 h-4.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    Download Map Image
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDownloadPdf}
                                            disabled={isDownloadingPdf || isDownloadingImage || timelineData.length === 0}
                                            className="inline-flex items-center justify-center px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-rose-500/10 hover:shadow-lg hover:shadow-rose-500/20 active:scale-95 cursor-pointer"
                                        >
                                            {isDownloadingPdf ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    <span className="truncate max-w-[150px]">{downloadProgress}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4.5 h-4.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    Download PDF
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div id="travel-map-container" className="h-[600px] relative bg-slate-100 rounded-3xl overflow-hidden">
                                    {/* Map Style Toggle */}
                                    <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200/80 flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setMapStyle('satellite')}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${mapStyle === 'satellite'
                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                                }`}
                                        >
                                            Satellite
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMapStyle('streets')}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${mapStyle === 'streets'
                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                                }`}
                                        >
                                            Streets
                                        </button>
                                    </div>
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
                                        {mapStyle === 'satellite' ? (
                                            <TileLayer
                                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                                attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                                                crossOrigin="anonymous"
                                            />
                                        ) : (
                                            <TileLayer
                                                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                                crossOrigin="anonymous"
                                            />
                                        )}

                                        {/* Draw user's route */}
                                        {path.length > 1 && (
                                            <Polyline positions={path} color={mapStyle === 'satellite' ? '#eab308' : '#4f46e5'} weight={4} opacity={0.8} />
                                        )}

                                        {/* Punch In (START) */}
                                        {startPoint && (
                                            <Marker position={[startPoint.latitude, startPoint.longitude]} icon={punchInIcon}>
                                                <Popup className="custom-popup">
                                                    <div className="text-center font-sans min-w-[160px]">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1">Punch In Location</p>
                                                        <p className="text-xs font-semibold text-slate-700">{startPoint.updated_at}</p>
                                                        <LocationName lat={startPoint.latitude} lon={startPoint.longitude} priority={true} />
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}

                                        {/* Punch Out (END) */}
                                        {endPoint && (
                                            <Marker position={[endPoint.latitude, endPoint.longitude]} icon={punchOutIcon}>
                                                <Popup className="custom-popup">
                                                    <div className="text-center font-sans min-w-[160px]">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">Punch Out Location</p>
                                                        <p className="text-xs font-semibold text-slate-700">{endPoint.updated_at}</p>
                                                        <LocationName lat={endPoint.latitude} lon={endPoint.longitude} priority={true} />
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        )}

                                        {/* Current / Live Location */}
                                        {showCurrentPoint && (
                                            <Marker position={[currentPoint.latitude, currentPoint.longitude]} icon={currentIcon}>
                                                <Popup className="custom-popup">
                                                    <div className="text-center font-sans min-w-[160px]">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
                                                            {isSelectedDateToday ? "Current / Live Location" : "Last Known Location"}
                                                        </p>
                                                        <p className="text-xs font-semibold text-slate-700">{currentPoint.updated_at}</p>
                                                        <LocationName lat={currentPoint.latitude} lon={currentPoint.longitude} priority={true} />
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

                                                    <LocationName lat={point.latitude} lon={point.longitude} priority={point.point_type === 'START' || point.point_type === 'END'} />

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
                        {(isDownloadingPdf || isDownloadingImage) && (
                            <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-md flex items-center justify-center animate-[fadeIn_0.3s_ease-out]">
                                <div className="bg-white/90 backdrop-blur-lg p-8 rounded-3xl border border-slate-100 shadow-2xl max-w-sm w-full text-center mx-4 flex flex-col items-center">
                                    <div className="relative w-20 h-20 mb-6">
                                        {/* Outer pulsing ring */}
                                        <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10 animate-ping"></div>
                                        {/* Inner spinning gradient ring */}
                                        <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 border-r-indigo-600 border-b-transparent border-l-transparent animate-spin"></div>
                                        {/* Center icon */}
                                        <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                {isDownloadingImage ? (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                ) : (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                )}
                                            </svg>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-extrabold text-slate-800 uppercase tracking-wider">
                                        {isDownloadingImage ? "Capturing Map Image" : "Generating PDF Report"}
                                    </h3>
                                    <p className="text-sm font-semibold text-slate-500 mt-2">
                                        {isDownloadingImage ? "Please wait while we capture and download the map view." : "Please wait while we structure your travel history data."}
                                    </p>
 
                                    {/* Progress Badge */}
                                    <div className="mt-5 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-100 uppercase tracking-widest animate-pulse">
                                        {downloadProgress}
                                    </div>
                                </div>
                            </div>
                        )}
                        <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                    </div>
                </main>
            </div>
        </div>
    );
}
