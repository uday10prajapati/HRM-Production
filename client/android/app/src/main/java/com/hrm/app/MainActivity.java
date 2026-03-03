package com.hrm.app;

import com.getcapacitor.BridgeActivity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final String PREFS_NAME = "HRM_PREFS";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "🟢 MainActivity started, checking for active location tracking");
        
        // Check if tracking was active
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean trackingActive = prefs.getBoolean("tracking_active", false);
        String userId = prefs.getString("tracking_user_id", null);
        
        if (trackingActive && userId != null) {
            Log.d(TAG, "📍 Resuming location tracking for user: " + userId);
            
            // Re-enable storage when resuming (in case it was disabled)
            prefs.edit().putBoolean("location_storage_enabled", true).apply();
            Log.d(TAG, "✅ Storage enabled for resumed tracking");
            
            // Start the location tracking service
            Intent serviceIntent = new Intent(this, LocationTrackingService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            Log.d(TAG, "✅ Location tracking service started");
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "app destroyed");
        super.onDestroy();
    }
}
