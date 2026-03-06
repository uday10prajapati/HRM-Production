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
        
        if (locationListener != null) {
            Log.d(TAG, "Location listener already active");
            return START_STICKY;
        }

        // Initialize location manager
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        httpClient = new OkHttpClient();
        
        // Start requesting location updates
        startLocationUpdates();
        
        return START_STICKY; // Restart if killed by system
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.d(TAG, "⚠️ App removed from recents - service continues to run due to START_STICKY and stopWithTask=false");
        super.onTaskRemoved(rootIntent);
        
        // As a fallback for aggressive OEM battery managers, attempt an explicit restart
        Intent restartService = new Intent(getApplicationContext(), this.getClass());
        restartService.setPackage(getPackageName());
        PendingIntent restartServicePI = PendingIntent.getService(
                getApplicationContext(), 1, restartService,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);
        android.app.AlarmManager alarmService = (android.app.AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
        if (alarmService != null) {
            alarmService.set(android.app.AlarmManager.ELAPSED_REALTIME, android.os.SystemClock.elapsedRealtime() + 2000, restartServicePI);
        }
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

    private LocationListener locationListener;

    private void startLocationUpdates() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "Location permission not granted. Cannot start active updates.");
            return;
        }

        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (location != null) {
                    double lat = location.getLatitude();
                    double lng = location.getLongitude();
                    float accuracy = location.getAccuracy();
                    
                    Log.d(TAG, "📍 Active Location update: " + lat + ", " + lng + " (acc: " + accuracy + "m)");
                    if (shouldStoreLocation(lat, lng, accuracy)) {
                        new Thread(() -> {
                            storeLocation(lat, lng);
                        }).start();
                        lastLat = lat;
                        lastLng = lng;
                        lastAccuracy = accuracy;
                    }
                }
            }
            @Override public void onStatusChanged(String provider, int status, android.os.Bundle extras) {}
            @Override public void onProviderEnabled(String provider) {}
            @Override public void onProviderDisabled(String provider) {}
        };

        try {
            // Request updates every 10 seconds or 5 meters
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 10000, 5, locationListener, android.os.Looper.getMainLooper());
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 10000, 5, locationListener, android.os.Looper.getMainLooper());
            }
            Log.d(TAG, "📍 Active location updates registered (interval: 10s, distance: 5m)");
        } catch (SecurityException e) {
            Log.e(TAG, "Security exception requesting location updates: " + e.getMessage());
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
        
        if (locationManager != null && locationListener != null) {
            try {
                locationManager.removeUpdates(locationListener);
                Log.d(TAG, "📍 Location updates removed");
            } catch (SecurityException e) {
                Log.e(TAG, "Failed to remove location updates", e);
            }
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
