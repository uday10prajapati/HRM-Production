package com.hrm.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.Context;
import android.util.Log;
import android.os.Build;

/**
 * Simple plugin to manage location tracking preferences and service
 */
@CapacitorPlugin(name = "LocationTrackingPlugin")
public class LocationTrackingPlugin extends Plugin {
    private static final String TAG = "LocationTrackingPlugin";
    private static final String PREFS_NAME = "HRM_PREFS";

    /**
     * Start background location tracking
     */
    @org.jetbrains.annotations.NotNull
    public void startTracking(PluginCall call) {
        String userId = call.getString("userId");
        String apiBaseUrl = call.getString("apiBaseUrl", "https://hrms.sandjglobaltech.com");
        
        if (userId == null || userId.isEmpty()) {
            call.reject("userId is required");
            return;
        }
        
        try {
            // Save tracking info to shared preferences
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("tracking_user_id", userId);
            editor.putString("api_base_url", apiBaseUrl);
            editor.putBoolean("tracking_active", true);
            editor.apply();
            
            Log.d(TAG, "📝 Tracking preferences saved: " + userId);
            
            // Start the foreground service
            Intent serviceIntent = new Intent(getContext(), LocationTrackingService.class);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
            
            Log.d(TAG, "✅ Location service started");
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Location tracking started");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Error starting tracking: " + e.getMessage());
            JSObject error = new JSObject();
            error.put("success", false);
            error.put("message", e.getMessage());
            call.resolve(error);
        }
    }

    /**
     * Stop background location tracking
     */
    @org.jetbrains.annotations.NotNull
    public void stopTracking(PluginCall call) {
        try {
            // Update shared preferences
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putBoolean("tracking_active", false);
            editor.apply();
            
            Log.d(TAG, "📝 Tracking preferences cleared");
            
            // Stop the service
            Intent serviceIntent = new Intent(getContext(), LocationTrackingService.class);
            getContext().stopService(serviceIntent);
            
            Log.d(TAG, "✅ Location service stopped");
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Location tracking stopped");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Error stopping tracking: " + e.getMessage());
            JSObject error = new JSObject();
            error.put("success", false);
            error.put("message", e.getMessage());
            call.resolve(error);
        }
    }
}
