import { registerPlugin, Capacitor } from '@capacitor/core';

/**
 * Simplified approach: Use localStorage to signal native app
 * The native service will check on each app start and resume if needed
 */

/**
 * Start background location tracking
 * Signal to native layer by saving to localStorage
 */
export async function startNativeLocationTracking(userId) {
    try {
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
            console.log('[NATIVE] 📱 Not on Android platform, skipping native service');
            return;
        }
        
        console.log('[NATIVE] 🟢 Signaling native Android to start background location service for user:', userId);
        
        // Save tracking state to localStorage
        // The MainActivity will read this and start the service
        localStorage.setItem('hrm_tracking_active', 'true');
        localStorage.setItem('hrm_tracking_user_id', userId);
        localStorage.setItem('hrm_tracking_api_url', 'https://hrms.sandjglobaltech.com');
        
        // Try to use plugin if available, but don't fail if not
        try {
            const LocationTrackingPlugin = registerPlugin('LocationTrackingPlugin');
            if (LocationTrackingPlugin && LocationTrackingPlugin.startTracking) {
                await LocationTrackingPlugin.startTracking({
                    userId,
                    apiBaseUrl: 'https://hrms.sandjglobaltech.com'
                });
                console.log('[NATIVE] ✅ Plugin method called successfully');
                return;
            }
        } catch (pluginError) {
            console.log('[NATIVE] 📝 Plugin not available, using localStorage method');
        }
        
        // Fallback: service will start on app initialization
        console.log('[NATIVE] ⚠️ Native service will start on next app initialization');
        
    } catch (error) {
        console.error('[NATIVE] ❌ Error signaling native tracking:', error?.message);
        // Don't throw - let JavaScript interval tracking handle it
    }
}

/**
 * Stop background location tracking
 */
export async function stopNativeLocationTracking() {
    try {
        console.log('[NATIVE] 🔴 Signaling native Android to stop location service');
        
        // Clear tracking state
        localStorage.removeItem('hrm_tracking_active');
        localStorage.removeItem('hrm_tracking_user_id');
        localStorage.removeItem('hrm_tracking_api_url');
        
        // Try to use plugin if available
        try {
            const LocationTrackingPlugin = registerPlugin('LocationTrackingPlugin');
            if (LocationTrackingPlugin && LocationTrackingPlugin.stopTracking) {
                await LocationTrackingPlugin.stopTracking();
                console.log('[NATIVE] ✅ Plugin stop method called successfully');
                return;
            }
        } catch (pluginError) {
            console.log('[NATIVE] 📝 Plugin not available, using localStorage method');
        }
        
        console.log('[NATIVE] ✅ Service will stop on app lifecycle');
        
    } catch (error) {
        console.error('[NATIVE] ❌ Error stopping native tracking:', error?.message);
    }
}

/**
 * Enable location storage (on punch-in)
 * Service continues running but starts storing location data
 */
export async function enableLocationStorage() {
    try {
        console.log('[NATIVE] 📍 Enabling location storage (punch-in)');
        
        // Try to use plugin if available
        try {
            const LocationTrackingPlugin = registerPlugin('LocationTrackingPlugin');
            if (LocationTrackingPlugin && LocationTrackingPlugin.setStorageEnabled) {
                await LocationTrackingPlugin.setStorageEnabled({ enabled: true });
                console.log('[NATIVE] ✅ Storage enabled successfully');
                return;
            }
        } catch (pluginError) {
            console.log('[NATIVE] 📝 Plugin not available for storage control');
        }
        
    } catch (error) {
        console.error('[NATIVE] ❌ Error enabling storage:', error?.message);
    }
}

/**
 * Disable location storage (on punch-out)
 * Service continues running but stops storing location data
 */
export async function disableLocationStorage() {
    try {
        console.log('[NATIVE] 🛑 Disabling location storage (punch-out)');
        
        // Try to use plugin if available
        try {
            const LocationTrackingPlugin = registerPlugin('LocationTrackingPlugin');
            if (LocationTrackingPlugin && LocationTrackingPlugin.setStorageEnabled) {
                await LocationTrackingPlugin.setStorageEnabled({ enabled: false });
                console.log('[NATIVE] ✅ Storage disabled successfully');
                return;
            }
        } catch (pluginError) {
            console.log('[NATIVE] 📝 Plugin not available for storage control');
        }
        
    } catch (error) {
        console.error('[NATIVE] ❌ Error disabling storage:', error?.message);
    }
}
