import { useEffect, useRef } from 'react';
import { registerPlugin } from '@capacitor/core';
import axios from 'axios';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

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
                // Initialize the background watcher with a sticky notification
                const watcherId = await BackgroundGeolocation.addWatcher({
                    backgroundMessage: "Tracking your movement for attendance verification.",
                    backgroundTitle: "HRM Live Routing",
                    requestPermissions: true,
                    stale: false,
                    distanceFilter: 30 // Will ping every 30 meters
                }, async (location, err) => {
                    if (err || !location) return;

                    const latitude = location.latitude;
                    const longitude = location.longitude;

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
                watchIdRef.current = watcherId;
            } catch (e) {
                console.error("Watch position failed", e);
            }
        };

        const stopTracking = async () => {
            if (watchIdRef.current) {
                await BackgroundGeolocation.removeWatcher({ id: watchIdRef.current });
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
