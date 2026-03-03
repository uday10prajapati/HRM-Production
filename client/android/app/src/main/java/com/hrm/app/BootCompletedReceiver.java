package com.hrm.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

/**
 * Restarts location tracking service when device boots
 */
public class BootCompletedReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "🟢 Device boot completed, checking if location tracking needs to restart");
            
            // Check if tracking was active before boot
            SharedPreferences prefs = context.getSharedPreferences("HRM_PREFS", Context.MODE_PRIVATE);
            boolean wasTracking = prefs.getBoolean("tracking_active", false);
            
            if (wasTracking) {
                Log.d(TAG, "📍 Resuming location tracking after device boot");
                
                Intent serviceIntent = new Intent(context, LocationTrackingService.class);
                try {
                    context.startForegroundService(serviceIntent);
                    Log.d(TAG, "✅ Location tracking service restarted");
                } catch (Exception e) {
                    Log.e(TAG, "Error starting service: " + e.getMessage());
                }
            }
        }
    }
}
