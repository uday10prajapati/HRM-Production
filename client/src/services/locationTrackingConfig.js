/**
 * Location Tracking Configuration
 * Customizable settings for background location tracking service
 */

export const LOCATION_TRACKING_CONFIG = {
    // How often to fetch location (milliseconds)
    FETCH_INTERVAL: 60000, // 1 minute
    
    // Minimum distance moved to trigger location storage (meters)
    DISTANCE_THRESHOLD: 10, // 10 meters
    
    // Maximum time between storage events (milliseconds)
    TIME_THRESHOLD: 60000, // 1 minute
    
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
