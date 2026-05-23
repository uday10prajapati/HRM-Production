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
        // Register custom capacitor plugin BEFORE the bridge initializes
        registerPlugin(LocationTrackingPlugin.class);
        
        super.onCreate(savedInstanceState);
        
        // Ensure log file is created immediately on launch
        initializeLogFile();
        
        Log.d(TAG, "🟢 MainActivity started, checking for active location tracking");
        
        // Request POST_NOTIFICATIONS runtime permission on Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }
        
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

    private void initializeLogFile() {
        try {
            java.io.File logFile = new java.io.File(getExternalFilesDir(null), "tracking_logs.txt");
            if (!logFile.exists()) {
                logFile.createNewFile();
            }
            java.io.FileWriter writer = new java.io.FileWriter(logFile, true);
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault());
            sdf.setTimeZone(java.util.TimeZone.getTimeZone("Asia/Kolkata"));
            String time = sdf.format(new java.util.Date());
            writer.write("[" + time + "] 📱 App launched. Log file initialized!\n");
            writer.close();
            Log.d(TAG, "📝 tracking_logs.txt initialized at: " + logFile.getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize log file", e);
        }
    }
}
