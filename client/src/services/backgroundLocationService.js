import { Geolocation } from '@capacitor/geolocation';
import axios from 'axios';
import { LOCATION_TRACKING_CONFIG } from './locationTrackingConfig';
import { Capacitor } from '@capacitor/core';

/**
 * Background Location Tracking Service
 * - Fetches location every ~1 minute
 * - Stores location if moved 10+ meters OR after 1 minute
 * - Runs continuously in background (even when app is closed)
 * - Automatically starts on punch in, stops on punch out
 */

let locationTrackingInterval = null;
let trackingHeartbeatInterval = null;
let lastStoredLocation = null;
let lastStoredTime = null;
let currentTrackingUserId = null;
const INTERVAL_MS = LOCATION_TRACKING_CONFIG.FETCH_INTERVAL;
const DISTANCE_THRESHOLD = LOCATION_TRACKING_CONFIG.DISTANCE_THRESHOLD;
const TIME_THRESHOLD = LOCATION_TRACKING_CONFIG.TIME_THRESHOLD;
const HEARTBEAT_INTERVAL = 10000; // Check every 10 seconds if tracking is still running

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

/**
 * Fetch current location from device
 */
async function getCurrentLocation() {
    try {
        const permission = await Geolocation.checkPermissions();
        if (permission.location !== 'granted') {
            console.warn('Location permission not granted');
            return null;
        }

        const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 5000
        });

        return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error getting current location:', error);
        return null;
    }
}

/**
 * Store location to backend
 */
async function storeLocation(latitude, longitude, userId) {
    try {
        const response = await axios.post('/api/live-locations/upsert', {
            userId,
            latitude,
            longitude
        });
        console.log('Location stored:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error storing location:', error);
        // Don't throw - continue tracking even if storage fails
        return null;
    }
}

/**
 * Check if location should be stored based on distance or time
 */
function shouldStoreLocation(currentLocation) {
    if (!lastStoredLocation) {
        return true; // Always store the first location
    }

    const now = Date.now();
    const timeSinceLastStore = now - (lastStoredTime || 0);

    // Store if 1 minute has passed
    if (timeSinceLastStore >= TIME_THRESHOLD) {
        console.log('Location stored: Time threshold reached (1 minute)');
        return true;
    }

    // Store if moved 10+ meters
    const distance = calculateDistance(
        lastStoredLocation.latitude,
        lastStoredLocation.longitude,
        currentLocation.latitude,
        currentLocation.longitude
    );

    if (distance >= DISTANCE_THRESHOLD) {
        console.log(`Location stored: Distance threshold reached (${distance.toFixed(2)}m)`);
        return true;
    }

    console.log(`Location check: ${distance.toFixed(2)}m moved, ${(timeSinceLastStore / 1000).toFixed(0)}s elapsed`);
    return false;
}

/**
 * Heartbeat check to ensure tracking stays active
 * This prevents tracking from dying if the app is backgrounded/force-closed
 */
function startTrackingHeartbeat(userId) {
    if (trackingHeartbeatInterval) {
        clearInterval(trackingHeartbeatInterval);
    }

    trackingHeartbeatInterval = setInterval(async () => {
        try {
            const storageUserId = localStorage.getItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_USER_ID);
            const isActive = localStorage.getItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_ACTIVE) === 'true';

            // If tracking should be active but interval is gone, restart it
            if (isActive && storageUserId && !locationTrackingInterval) {
                console.log('⚠️ Tracking stopped unexpectedly! Restarting...');
                await startLocationTracking(storageUserId);
            }
        } catch (error) {
            console.error('Heartbeat error:', error);
        }
    }, HEARTBEAT_INTERVAL);
}

function stopTrackingHeartbeat() {
    if (trackingHeartbeatInterval) {
        clearInterval(trackingHeartbeatInterval);
        trackingHeartbeatInterval = null;
    }
}

/**
 * Background task for tracking location (only on native platforms)
 */
async function backgroundLocationTask(userId) {
    // Only register background task on native platforms
    if (!Capacitor.isNativePlatform()) {
        console.log('Background task not available on web platform');
        return;
    }

    try {
        // Dynamically import BackgroundTask only on native platforms
        // Use variable for module name so Vite doesn't try to resolve it statically
        const moduleName = '@capacitor/background-task';
        const BackgroundTaskModule = await import(moduleName).catch(() => null);
        const BackgroundTask = BackgroundTaskModule?.BackgroundTask;
        
        if (!BackgroundTask) {
            console.warn('BackgroundTask not available - location tracking will stop when app closes');
            return;
        }

        const taskId = await BackgroundTask.beforeExit(async () => {
            try {
                const location = await getCurrentLocation();

                if (location && shouldStoreLocation(location)) {
                    await storeLocation(location.latitude, location.longitude, userId);
                    lastStoredLocation = location;
                    lastStoredTime = Date.now();
                }

                // Finish the background task
                BackgroundTask.finish({ taskId });
            } catch (error) {
                console.error('Background task error:', error);
                if (BackgroundTask && typeof BackgroundTask.finish === 'function') {
                    BackgroundTask.finish({ taskId });
                }
            }
        });
    } catch (error) {
        console.warn('Failed to register background task:', error?.message);
        // Continue tracking anyway - web/browser tracking will still work
    }
}

/**
 * Start background location tracking
 */
export async function startLocationTracking(userId) {
    // Only start on native platforms
    if (!Capacitor.isNativePlatform()) {
        console.log('Location tracking is only available on native mobile app');
        return;
    }

    if (locationTrackingInterval) {
        console.warn('Location tracking already running');
        return;
    }

    console.log('🟢 Starting background location tracking for user:', userId);

    // Save tracking state to localStorage
    currentTrackingUserId = userId;
    localStorage.setItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_ACTIVE, 'true');
    localStorage.setItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_USER_ID, userId);

    // Fetch immediately
    const location = await getCurrentLocation();
    if (location) {
        if (shouldStoreLocation(location)) {
            await storeLocation(location.latitude, location.longitude, userId);
            lastStoredLocation = location;
            lastStoredTime = Date.now();
        }
    }

    // Set up interval tracking
    locationTrackingInterval = setInterval(async () => {
        try {
            const location = await getCurrentLocation();

            if (location) {
                if (shouldStoreLocation(location)) {
                    await storeLocation(location.latitude, location.longitude, userId);
                    lastStoredLocation = location;
                    lastStoredTime = Date.now();
                }
            }
        } catch (error) {
            console.error('Error in location tracking interval:', error);
        }
    }, INTERVAL_MS);

    // Start heartbeat to monitor tracking health
    startTrackingHeartbeat(userId);

    // Also register background task for when app is in background
    await backgroundLocationTask(userId);
}

/**
 * Stop background location tracking
 */
export async function stopLocationTracking() {
    if (locationTrackingInterval) {
        clearInterval(locationTrackingInterval);
        locationTrackingInterval = null;
        console.log('🔴 Location tracking stopped');
    }

    stopTrackingHeartbeat();

    // Clear tracking state
    localStorage.removeItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_ACTIVE);
    localStorage.removeItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_USER_ID);

    // Reset variables
    currentTrackingUserId = null;
    lastStoredLocation = null;
    lastStoredTime = null;
}

/**
 * Check if location tracking is currently active
 */
export function isLocationTrackingActive() {
    return localStorage.getItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_ACTIVE) === 'true';
}

/**
 * Resume tracking if app was closed during active tracking
 */
export async function resumeLocationTrackingIfNeeded() {
    // Only on native platforms
    if (!Capacitor.isNativePlatform()) {
        return;
    }

    const trackingActive = localStorage.getItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_ACTIVE) === 'true';
    const userId = localStorage.getItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_USER_ID);

    if (trackingActive && userId) {
        console.log('📍 Resuming location tracking after app restart');
        await startLocationTracking(userId);
    }
}

export default {
    startLocationTracking,
    stopLocationTracking,
    isLocationTrackingActive,
    resumeLocationTrackingIfNeeded
};
