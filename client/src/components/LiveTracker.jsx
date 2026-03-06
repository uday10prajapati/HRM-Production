import { useEffect } from 'react';
import axios from 'axios';
import { startLocationTracking, stopLocationTracking } from '../services/backgroundLocationService';

const LiveTracker = () => {
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
                        await startLocationTracking(user.id);
                        isPunchedIn = true;
                    } else if (!currentlyIn && isPunchedIn) {
                        await stopLocationTracking();
                        isPunchedIn = false;
                    }
                } else {
                    if (isPunchedIn) await stopLocationTracking();
                    isPunchedIn = false;
                }
            } catch (err) {
                console.error("Tracker status check error", err);
            }
        };

        // Poll every 1.5 minutes to handle state changes tightly
        pollInterval = setInterval(checkPunchStatus, 90 * 1000);
        checkPunchStatus(); // initial check

        return () => {
            clearInterval(pollInterval);
            // We DO NOT call stopTracking() here when the component unmounts,
            // because we want the Native Java Tracker to persist even when the app is closed.
        };
    }, []);

    return null; // Hidden component purely for tracking coordination
};

export default LiveTracker;
