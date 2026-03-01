/**
 * Location Tracking Configuration
 * Customizable settings for background location tracking service
 */

export const LOCATION_TRACKING_CONFIG = {
    // How often to fetch location (milliseconds)
    FETCH_INTERVAL: 30000, // 30 seconds (was 60s)
    
    // Minimum distance moved to trigger location storage (meters)
    DISTANCE_THRESHOLD: 5, // 5 meters (was 10m)
    
    // Maximum time between storage events (milliseconds)
    TIME_THRESHOLD: 45000, // 45 seconds (was 60s)
    
    // Geolocation options
    GEOLOCATION_OPTIONS: {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
    },
    
    // Storage keys
    STORAGE_KEYS: {
        TRACKING_ACTIVE: 'locationTrackingActive',
        TRACKING_USER_ID: 'locationTrackingUserId'
    },
    
    // Messages
    MESSAGES: {
        TRACKING_STARTED: '📍 Location tracking started',
        TRACKING_STOPPED: '📍 Location tracking stopped',
        LOCATION_STORED_TIME: 'Location stored: Time threshold reached (1 minute)',
        LOCATION_STORED_DISTANCE: 'Location stored: Distance threshold reached'
    }
};

export default LOCATION_TRACKING_CONFIG;
