package com.hrm.app;

import android.app.Service;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.Context;
import android.location.Location;
import android.location.LocationManager;
import android.location.LocationListener;
import android.os.IBinder;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import android.Manifest;
import android.content.pm.PackageManager;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.MediaType;
import okhttp3.Response;

import org.json.JSONObject;

import java.util.Timer;
import java.util.TimerTask;
import android.content.SharedPreferences;

/**
 * Background Location Tracking Service
 * Runs continuously and tracks location even when app is closed
 */
public class LocationTrackingService extends Service {
    private static final String TAG = "LocationTracking";
    private static final int NOTIFICATION_ID = 12345;
    private static final String CHANNEL_ID = "hrm_location_tracking";
    
    private LocationManager locationManager;
    private Timer locationTimer;
    private OkHttpClient httpClient;
    private String userId;
    private String apiUrl;
    private double lastLat = 0;
    private double lastLng = 0;
    private float lastAccuracy = Float.MAX_VALUE;
    private SharedPreferences prefs;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "🟢 LocationTrackingService started");
        
        // Get user ID and API URL from shared preferences or intent extras
        prefs = getSharedPreferences("HRM_PREFS", Context.MODE_PRIVATE);
        userId = prefs.getString("tracking_user_id", null);
        apiUrl = prefs.getString("api_base_url", "https://hrms.sandjglobaltech.com");
        
        // Save to prefs that tracking is active (for MainActivity on next start)
        prefs.edit().putBoolean("tracking_active", true).apply();
        
        // Ensure storage is enabled if tracking is active
        // (This handles app resume/restart scenarios)
        if (!prefs.contains("location_storage_enabled")) {
            prefs.edit().putBoolean("location_storage_enabled", true).apply();
            Log.d(TAG, "📍 Storage enabled by default for active tracking");
        }
        
        if (userId == null) {
            Log.w(TAG, "No userId found, stopping service");
            stopSelf();
            return START_NOT_STICKY;
        }
        
        Log.d(TAG, "Tracking for user: " + userId);
        
        // Start foreground service with notification
        startForegroundService();
        
        // Initialize location manager
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        httpClient = new OkHttpClient();
        
        // Start requesting location updates
        startLocationUpdates();
        
        return START_STICKY; // Restart if killed by system
    }

    private void startForegroundService() {
        // Create notification channel for Android 8+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "HRM Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Location tracking while working");
            
            NotificationManager notificationManager = 
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            notificationManager.createNotificationChannel(channel);
        }
        
        // Create notification
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("HRM Location Tracking")
            .setContentText("Recording your work location")
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
        
        startForeground(NOTIFICATION_ID, notification);
        Log.d(TAG, "✅ Foreground service started with notification");
    }

    private void startLocationUpdates() {
        // Timer to fetch location every 10 seconds
        locationTimer = new Timer();
        locationTimer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                updateLocation();
            }
        }, 0, 10000); // 10 second interval
        
        Log.d(TAG, "📍 Location updates scheduled every 10 seconds");
    }

    private void updateLocation() {
        try {
            // Check permissions
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                    != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "Location permission not granted");
                return;
            }
            
            // Get last known location
            Location location = null;
            try {
                location = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (location == null) {
                    location = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                }
            } catch (SecurityException e) {
                Log.e(TAG, "Security exception getting location: " + e.getMessage());
                return;
            }
            
            if (location != null) {
                double lat = location.getLatitude();
                double lng = location.getLongitude();
                float accuracy = location.getAccuracy();
                
                Log.d(TAG, "📍 Location: " + lat + ", " + lng + " (accuracy: " + accuracy + "m)");
                
                // Store location if moved significantly or at good accuracy
                if (shouldStoreLocation(lat, lng, accuracy)) {
                    storeLocation(lat, lng);
                    lastLat = lat;
                    lastLng = lng;
                    lastAccuracy = accuracy;
                }
            } else {
                Log.d(TAG, "⚠️ No location available");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error updating location: " + e.getMessage());
        }
    }

    private boolean shouldStoreLocation(double lat, double lng, float accuracy) {
        // Always store if first location
        if (lastLat == 0 && lastLng == 0) {
            return true;
        }
        
        // Calculate distance moved
        float[] results = new float[1];
        Location.distanceBetween(lastLat, lastLng, lat, lng, results);
        float distanceMeters = results[0];
        
        // Store if moved 10+ meters or accuracy improved to <20m
        return distanceMeters >= 10 || (accuracy < 20 && lastAccuracy >= 20);
    }

    private void storeLocation(double latitude, double longitude) {
        try {
            // Check if storage is enabled (based on punch state)
            boolean storageEnabled = prefs.getBoolean("location_storage_enabled", true);
            if (!storageEnabled) {
                Log.d(TAG, "⏭️ Storage disabled by user - skipping location store");
                return;
            }
            
            JSONObject body = new JSONObject();
            body.put("userId", userId);
            body.put("latitude", latitude);
            body.put("longitude", longitude);
            
            String url = apiUrl + "/api/live_locations/upsert";
            
            Request request = new Request.Builder()
                .url(url)
                .post(RequestBody.create(
                    body.toString(),
                    MediaType.parse("application/json")
                ))
                .addHeader("Content-Type", "application/json")
                .build();
            
            Response response = httpClient.newCall(request).execute();
            
            if (response.isSuccessful()) {
                Log.d(TAG, "✅ Location stored successfully");
            } else {
                Log.w(TAG, "⚠️ Failed to store location: " + response.code());
            }
            response.close();
        } catch (Exception e) {
            Log.e(TAG, "Error storing location: " + e.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "🔴 LocationTrackingService destroyed");
        
        if (locationTimer != null) {
            locationTimer.cancel();
        }
        
        if (httpClient != null) {
            httpClient.dispatcher().cancelAll();
        }
        
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
