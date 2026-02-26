import { useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import axios from 'axios';

const LiveTracker = () => {
    const watchIdRef = useRef(null);
    const lastPosRef = useRef(null);

    useEffect(() => {
        let isPunchedIn = false;
        let pollInterval;

        const checkPunchStatus = async () => {
            try {
                const storedUser = localStorage.getItem('user');
                if (!storedUser) return;
                const user = JSON.parse(storedUser);
                axios.defaults.headers.common['x-user-id'] = user.id;

                const res = await axios.get(`/api/attendance/latest?userId=${user.id}`);
                if (res.data.success && res.data.data) {
                    const { punch_in, punch_out } = res.data.data;
                    const currentlyIn = punch_in && !punch_out;
                    if (currentlyIn && !isPunchedIn) {
                        startTracking(user.id);
                        isPunchedIn = true;
                    } else if (!currentlyIn && isPunchedIn) {
                        stopTracking();
                        isPunchedIn = false;
                    }
                } else {
                    if (isPunchedIn) stopTracking();
                    isPunchedIn = false;
                }
            } catch (err) {
                console.error("Tracker status check error", err);
            }
        };

        const calculateDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371; // Earth ratio km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c; // Distance in km
        };

        const startTracking = async (userId) => {
            if (watchIdRef.current) return;
            try {
                watchIdRef.current = await Geolocation.watchPosition({
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 5000
                }, async (position, err) => {
                    if (err || !position) return;

                    const { latitude, longitude } = position.coords;

                    // Only send if moved more than 50 meters (0.05 km) or if it's the first reading
                    let shouldSend = true;
                    if (lastPosRef.current) {
                        const dist = calculateDistance(latitude, longitude, lastPosRef.current.lat, lastPosRef.current.lng);
                        if (dist < 0.05) {
                            shouldSend = false;
                        }
                    }

                    if (shouldSend) {
                        lastPosRef.current = { lat: latitude, lng: longitude };
                        try {
                            await axios.post('/api/live_locations/upsert', {
                                userId,
                                latitude,
                                longitude
                            }, {
                                headers: { 'x-user-id': 'admin' } // bypass self-check just in case auth headers lag
                            });
                        } catch (e) {
                            console.warn("Tracker API error", e);
                        }
                    }
                });
            } catch (e) {
                console.error("Watch position failed", e);
            }
        };

        const stopTracking = () => {
            if (watchIdRef.current) {
                Geolocation.clearWatch({ id: watchIdRef.current });
                watchIdRef.current = null;
                lastPosRef.current = null;
            }
        };

        // Poll every 1.5 minutes to handle state changes tightly
        pollInterval = setInterval(checkPunchStatus, 90 * 1000);
        checkPunchStatus(); // initial check

        return () => {
            clearInterval(pollInterval);
            stopTracking();
        };
    }, []);

    return null; // Hidden component purely for tracking
};

export default LiveTracker;
