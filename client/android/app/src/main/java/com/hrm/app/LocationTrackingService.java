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
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import okhttp3.Call;
import okhttp3.Callback;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.MediaType;
import okhttp3.Response;

import org.json.JSONObject;

import java.util.Timer;
import java.util.TimerTask;
import android.content.SharedPreferences;

import android.os.PowerManager;
import android.os.HandlerThread;
import android.os.Looper;

/**
 * Background Location Tracking Service
 * Runs continuously and tracks location even when app is closed
 */
public class LocationTrackingService extends Service {
    private static final String TAG = "LocationTracking";
    private static final int NOTIFICATION_ID = 12345;
    private static final String CHANNEL_ID = "hrm_location_tracking";
    
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private Timer locationTimer;
    private OkHttpClient httpClient;
    private String userId;
    private String apiUrl;
    private double lastLat = 0;
    private double lastLng = 0;
    private float lastAccuracy = Float.MAX_VALUE;
    private SharedPreferences prefs;

    private PowerManager.WakeLock wakeLock;
    private HandlerThread handlerThread;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "🟢 LocationTrackingService started");
        
        if (wakeLock == null) {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HRM::LocationTrackingWakeLock");
            wakeLock.acquire();
        }
        
        if (handlerThread == null) {
            handlerThread = new HandlerThread("LocationTrackerThread");
            handlerThread.start();
        }

        // Get user ID and API URL from shared preferences or intent extras
        prefs = getSharedPreferences("HRM_PREFS", Context.MODE_PRIVATE);
        userId = prefs.getString("tracking_user_id", null);
        apiUrl = prefs.getString("api_base_url", "https://hrms.sandjglobaltech.com");
        
        // Save to prefs that tracking is active (for MainActivity on next start)
        prefs.edit().putBoolean("tracking_active", true).apply();
        
        // Ensure storage is enabled if tracking is active
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
        
        if (locationCallback != null) {
            Log.d(TAG, "Location callback already active");
            return START_STICKY;
        }

        // Initialize location manager
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        httpClient = new OkHttpClient();
        
        // Start requesting location updates
        startLocationUpdates();
        
        return START_STICKY; // Restart if killed by system
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.d(TAG, "⚠️ App removed from recents - service continues to run due to START_STICKY and stopWithTask=false");
        super.onTaskRemoved(rootIntent);
        
        try {
            // As a fallback for aggressive OEM battery managers, attempt an explicit restart
            Intent restartService = new Intent(getApplicationContext(), this.getClass());
            restartService.setPackage(getPackageName());
            PendingIntent restartServicePI;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                restartServicePI = PendingIntent.getForegroundService(
                        getApplicationContext(), 1, restartService,
                        PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);
            } else {
                restartServicePI = PendingIntent.getService(
                        getApplicationContext(), 1, restartService,
                        PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);
            }
            
            android.app.AlarmManager alarmService = (android.app.AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmService != null) {
                alarmService.set(android.app.AlarmManager.ELAPSED_REALTIME, android.os.SystemClock.elapsedRealtime() + 2000, restartServicePI);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule restart alarm on task removed: " + e.getMessage());
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
            .setContentText("Recording your work location (Do not close)")
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            Log.d(TAG, "✅ Foreground service started with notification");
        } catch (Exception e) {
            Log.e(TAG, "🚨 Failed to start foreground service: " + e.getMessage());
            // Android 12+ throws ForegroundServiceStartNotAllowedException if started from background.
            // We log the error but allow the service to continue existing in a background state (if possible).
        }
    }

    private void startLocationUpdates() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "Location permission not granted. Cannot start active updates.");
            return;
        }

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                Location location = locationResult.getLastLocation();
                if (location != null) {
                    double lat = location.getLatitude();
                    double lng = location.getLongitude();
                    float accuracy = location.getAccuracy();
                    
                    Log.d(TAG, "📍 Active Location update: " + lat + ", " + lng + " (acc: " + accuracy + "m)");
                    if (shouldStoreLocation(lat, lng, accuracy)) {
                        storeLocation(lat, lng);
                        lastLat = lat;
                        lastLng = lng;
                        lastAccuracy = accuracy;
                    }
                }
            }
        };

        try {
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
                    .setMinUpdateIntervalMillis(5000)
                    .build();

            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, handlerThread.getLooper());
            Log.d(TAG, "📍 Active location updates registered using FusedLocationProviderClient");
        } catch (SecurityException e) {
            Log.e(TAG, "Security exception requesting location updates: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Exception requesting location updates: " + e.getMessage());
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
            boolean storageEnabled = prefs.getBoolean("location_storage_enabled", true);
            if (!storageEnabled) {
                Log.d(TAG, "⏭️ Storage disabled by user - skipping location store");
                return;
            }
            
            JSONObject body = new JSONObject();
            
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXX", Locale.US);
            sdf.setTimeZone(TimeZone.getTimeZone("Asia/Kolkata"));
            String isoTime = sdf.format(new Date());

            body.put("userId", userId);
            body.put("latitude", latitude);
            body.put("longitude", longitude);
            body.put("updated_at", isoTime);
            
            String safeApiUrl = apiUrl;
            if (safeApiUrl == null || safeApiUrl.isEmpty() || safeApiUrl.equals("null")) {
                safeApiUrl = prefs.getString("api_base_url", "https://hrms.sandjglobaltech.com");
            }
            if (safeApiUrl == null || safeApiUrl.isEmpty()) {
                safeApiUrl = "https://hrms.sandjglobaltech.com";
            }
            String url = safeApiUrl + "/api/live_locations/upsert";
            
            Request request = new Request.Builder()
                .url(url)
                .post(RequestBody.create(
                    body.toString(),
                    MediaType.parse("application/json")
                ))
                .addHeader("Content-Type", "application/json")
                .build();
            
            httpClient.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    Log.e(TAG, "🚨 Failed to post location point to Supabase: " + e.getMessage());
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    if (response.isSuccessful()) {
                        Log.d(TAG, "✅ Location stored successfully");
                    } else {
                        Log.w(TAG, "⚠️ Failed to store location: " + response.code());
                    }
                    response.close();
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error storing location: " + e.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "🔴 LocationTrackingService destroyed");
        
        if (fusedLocationClient != null && locationCallback != null) {
            try {
                fusedLocationClient.removeLocationUpdates(locationCallback);
                Log.d(TAG, "📍 Location updates removed");
            } catch (Exception e) {
                Log.e(TAG, "Failed to remove location updates", e);
            }
        }
        
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
        
        if (handlerThread != null) {
            handlerThread.quitSafely();
            handlerThread = null;
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
