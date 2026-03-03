import { Geolocation } from '@capacitor/geolocation';
import { App as CapacitorApp } from '@capacitor/app';
import axios from 'axios';
import { LOCATION_TRACKING_CONFIG } from './locationTrackingConfig';
import { Capacitor } from '@capacitor/core';
import { startNativeLocationTracking, stopNativeLocationTracking } from './nativeLocationTracking';

// Track app pause/resume state
let appIsPaused = false;

// Add debug tag for console logs
const DEBUG_TAG = '[LOCATION]';

/**
 * NOTE: @capacitor-community/background-geolocation plugin has compatibility issues with Capacitor bridge.
 * Using JavaScript interval-based tracking instead, which works reliably while app is running.
 * Background tracking when app is closed would require native WorkManager implementation.
 */

/**
 * Request location permissions (including background location on Android 12+)
 */
async function requestLocationPermissions() {
    try {
        console.log('🔐 Requesting location permissions...');
        
        // First request foreground location permissions
        const result = await Geolocation.requestPermissions({
            permissions: ['coarseLocation', 'fineLocation']
        });
        
        console.log('📍 Foreground location permission:', result);
        
        // For Android 12+, we may need to request background location separately
        try {
            if (Capacitor.getPlatform() === 'android') {
                console.log('📍 Location permissions requested on Android');
                if (result.location === 'granted' || result.location === 'prompt-only') {
                    console.log('✅ Location permission granted - tracking ready');
                }
            }
        } catch (bgError) {
            console.warn('Background location permission note:', bgError?.message);
        }
        
        return result;
    } catch (error) {
        console.error('Error requesting location permissions:', error);
        return null;
    }
}

/**
 * Start location tracking using JavaScript interval
 * This provides continuous location updates while the app is running
 */
async function startBackgroundGeolocation(userId) {
    console.log(DEBUG_TAG, '🟢 ===== STARTING LOCATION TRACKING =====');
    console.log(DEBUG_TAG, '📱 Platform:', Capacitor.getPlatform());
    console.log(DEBUG_TAG, '📍 Using JavaScript interval tracking (reliable while app is running)');
    
    // Request permissions
    const permResult = await requestLocationPermissions();
    if (!permResult || permResult.location !== 'granted') {
        console.warn(DEBUG_TAG, '⚠️ Location permission not granted - tracking may not work');
    } else {
        console.log(DEBUG_TAG, '✅ Location permission granted');
    }
    
    console.log(DEBUG_TAG, '✅ Location tracking initialized');
    return true;
}

/**
 * Stop location tracking
 */
async function stopBackgroundGeolocation() {
    try {
        console.log(DEBUG_TAG, '🔴 Stopping location tracking');
    } catch (error) {
        console.error('Error stopping location tracking:', error);
    }
}

/**
 * Location Tracking Service Configuration
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
 * Store location to backend with retry logic
 */
async function storeLocation(latitude, longitude, userId, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            console.log(`📡 Storing location (attempt ${attempt + 1}/${retries})...`);
            const response = await axios.post('/api/live_locations/upsert', {
                userId,
                latitude,
                longitude
            }, {
                timeout: 10000 // 10 second timeout per request
            });
            console.log('✅ Location stored:', response.data);
            return response.data;
        } catch (error) {
            console.warn(`⚠️ Location store attempt ${attempt + 1} failed:`, error.message);
            
            // If last attempt, log error permanently
            if (attempt === retries - 1) {
                console.error('❌ Failed to store location after', retries, 'attempts:', error);
            } else {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }
    // Don't throw - continue tracking even if storage fails
    return null;
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
        const BackgroundTaskModule = await import(/* @vite-ignore */ moduleName).catch(() => null);
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
 * Initialize app lifecycle listeners for proper background tracking
 * Ensures tracking continues even when app is paused/closed
 */
let lifecycleListenersInitialized = false;
async function initializeAppLifecycleListeners() {
    if (lifecycleListenersInitialized) return;
    
    try {
        if (!Capacitor.isNativePlatform()) {
            return;
        }

        console.log('🔄 Initializing app lifecycle listeners');

        // Listen for app pause (app goes to background)
        CapacitorApp.addListener('pause', async () => {
            console.log('⏸️ App paused - interval tracking paused (normal behavior)');
            appIsPaused = true;
        });

        // Listen for app resume (app comes back to foreground)
        CapacitorApp.addListener('resume', async () => {
            console.log('▶️ App resumed from background');
            appIsPaused = false;
            
            // Resume location tracking if it was active
            const isTrackingActive = localStorage.getItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_ACTIVE) === 'true';
            const userId = localStorage.getItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_USER_ID);
            
            if (isTrackingActive && userId && !locationTrackingInterval) {
                console.log('📍 Resuming location tracking after background...');
                await startLocationTracking(userId);
            }
        });

        // Listen for app will terminate
        CapacitorApp.addListener('appTerminate', async () => {
            console.log('🛑 App terminating - background geolocation will continue via plugin');
            // Note: Background geolocation plugin handles this with stopOnTerminate: false
        });

        lifecycleListenersInitialized = true;
        console.log('✅ App lifecycle listeners initialized');
    } catch (error) {
        console.warn('Failed to initialize lifecycle listeners:', error?.message);
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

    console.log('🟢 Starting background location tracking for user:', userId);

    // Initialize app lifecycle listeners (only once)
    await initializeAppLifecycleListeners();

    // Save tracking state to localStorage
    currentTrackingUserId = userId;
    localStorage.setItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_ACTIVE, 'true');
    localStorage.setItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_USER_ID, userId);

    // Try to start true background geolocation first (works even when app is closed)
    const bgStarted = await startBackgroundGeolocation(userId);

    // Also set up interval tracking as fallback
    if (!locationTrackingInterval) {
        // Fetch immediately
        const location = await getCurrentLocation();
        if (location) {
            if (shouldStoreLocation(location)) {
                await storeLocation(location.latitude, location.longitude, userId);
                lastStoredLocation = location;
                lastStoredTime = Date.now();
            }
        }

        // Set up AGGRESSIVE interval tracking (every 5 seconds)
        // This ensures frequent location updates while app is running
        locationTrackingInterval = setInterval(async () => {
            try {
                const userId = localStorage.getItem(LOCATION_TRACKING_CONFIG.STORAGE_KEYS.TRACKING_USER_ID);
                if (!userId) return; // Stop if tracking was cleared
                
                const location = await getCurrentLocation();

                if (location) {
                    // More aggressive storage - store after just 5 seconds regardless
                    const timeSinceLastStore = Date.now() - (lastStoredTime || 0);
                    
                    // Store if: moved 5+ meters OR 10 seconds passed
                    const shouldStore = !lastStoredLocation || 
                        (timeSinceLastStore >= 10000) ||
                        (calculateDistance(
                            lastStoredLocation.latitude,
                            lastStoredLocation.longitude,
                            location.latitude,
                            location.longitude
                        ) >= 5);
                    
                    if (shouldStore) {
                        console.log(`📍 Interval: Storing location (${timeSinceLastStore}ms elapsed)`);
                        const stored = await storeLocation(location.latitude, location.longitude, userId);
                        if (stored) {
                            lastStoredLocation = location;
                            lastStoredTime = Date.now();
                        }
                    }
                }
            } catch (error) {
                console.error('Error in location tracking interval:', error);
            }
        }, 5000); // Check every 5 seconds for continuous tracking

        console.log(DEBUG_TAG, '✅ Location tracking with 5-second interval established');
        
        // Start heartbeat to monitor tracking health
        startTrackingHeartbeat(userId);
    }

    // Start native background service for Android (tracks even when app is closed)
    if (Capacitor.getPlatform() === 'android') {
        try {
            console.log('🟢 Starting native Android background location service...');
            await startNativeLocationTracking(userId);
            console.log('✅ Native background service started - will track even when app is closed');
        } catch (error) {
            console.warn('⚠️ Could not start native service:', error?.message);
            console.log('App will use JavaScript interval tracking instead');
        }
    }

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

    // Stop background geolocation
    await stopBackgroundGeolocation();

    // Stop native Android service
    if (Capacitor.getPlatform() === 'android') {
        try {
            await stopNativeLocationTracking();
            console.log('✅ Native background service stopped');
        } catch (error) {
            console.warn('⚠️ Could not stop native service:', error?.message);
        }
    }

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
