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
    private static final String ALERT_CHANNEL_ID = "hrm_location_alerts";
    
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
    private long gpsDisabledStartTime = 0;
    private boolean isMarkedHalfDay = false;
    private boolean isDialogShown = false;

    private PowerManager.WakeLock wakeLock;
    private HandlerThread handlerThread;

    private void writeLogToFile(String message) {
        try {
            java.io.File logDir = getExternalFilesDir(null);
            if (logDir == null) return;
            
            java.io.File logFile = new java.io.File(logDir, "tracking_logs.txt");
            if (!logFile.exists()) {
                logFile.createNewFile();
            }
            
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US);
            String timeStamp = sdf.format(new Date());
            String logLine = "[" + timeStamp + "] " + message + "\n";
            
            java.io.FileWriter writer = new java.io.FileWriter(logFile, true);
            writer.append(logLine);
            writer.flush();
            writer.close();
            Log.d(TAG, "📝 Log written to file: " + message);
        } catch (Exception e) {
            Log.e(TAG, "Failed to write log to file: " + e.getMessage());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "🟢 LocationTrackingService started");
        writeLogToFile("🟢 LocationTrackingService onStartCommand triggered");
        
        if (wakeLock == null) {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HRM::LocationTrackingWakeLock");
            wakeLock.acquire();
            writeLogToFile("🔒 WakeLock acquired");
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
        
        writeLogToFile("⚙️ Preferences Loaded - UserID: " + userId + ", API: " + apiUrl + ", StorageEnabled: " + prefs.getBoolean("location_storage_enabled", true));
        
        if (userId == null) {
            Log.w(TAG, "No userId found, stopping service");
            writeLogToFile("❌ Stopping service: userId is null!");
            stopSelf();
            return START_NOT_STICKY;
        }
        
        Log.d(TAG, "Tracking for user: " + userId);
        
        // Start foreground service with notification
        startForegroundService();
        
        if (locationCallback != null) {
            Log.d(TAG, "Location callback already active");
            writeLogToFile("ℹ️ Location callback already active, skipping initialization");
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
            .setOngoing(false)
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
                    writeLogToFile("📍 Callback GPS: Lat=" + lat + ", Lng=" + lng + " (Acc: " + accuracy + "m)");
                    if (shouldStoreLocation(lat, lng, accuracy)) {
                        storeLocation(lat, lng);
                        lastLat = lat;
                        lastLng = lng;
                        lastAccuracy = accuracy;
                    }
                } else {
                    writeLogToFile("⚠️ Location callback received, but location was null!");
                }
            }
        };

        try {
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 30000)
                    .setMinUpdateIntervalMillis(30000)
                    .setMaxUpdateDelayMillis(35000)
                    .setWaitForAccurateLocation(false)
                    .build();

            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, handlerThread.getLooper());
            Log.d(TAG, "📍 Active location updates registered using FusedLocationProviderClient (30s interval)");
            
            // Start a fallback timer to forcefully pull the last location every 30 seconds
            // This counters aggressive OS Doze mode which might stop LocationCallback from firing
            if (locationTimer != null) {
                locationTimer.cancel();
            }
            locationTimer = new Timer();
            locationTimer.scheduleAtFixedRate(new TimerTask() {
                @Override
                public void run() {
                    // Monitor active GPS status, post warning notifications and report half-day if off > 2 mins
                    checkGpsStatusAndReport();
                    
                    try {
                        if (ContextCompat.checkSelfPermission(LocationTrackingService.this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                            fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
                                if (location != null) {
                                    double lat = location.getLatitude();
                                    double lng = location.getLongitude();
                                    float accuracy = location.getAccuracy();
                                    writeLogToFile("⏱️ Timer fallback GPS: Lat=" + lat + ", Lng=" + lng + " (Acc: " + accuracy + "m)");
                                    if (shouldStoreLocation(lat, lng, accuracy)) {
                                        storeLocation(lat, lng);
                                        lastLat = lat;
                                        lastLng = lng;
                                        lastAccuracy = accuracy;
                                    }
                                } else {
                                    writeLogToFile("⏱️ Timer fallback: getLastLocation() returned null");
                                }
                            }).addOnFailureListener(e -> {
                                writeLogToFile("⏱️ Timer fallback: getLastLocation() failed: " + e.getMessage());
                            });
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Timer fallback location fetch failed: " + e.getMessage());
                    }
                }
            }, 30000, 30000);
            
        } catch (SecurityException e) {
            Log.e(TAG, "Security exception requesting location updates: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Exception requesting location updates: " + e.getMessage());
        }
    }

    private long lastStoredTime = 0;

    private boolean shouldStoreLocation(double lat, double lng, float accuracy) {
        long now = System.currentTimeMillis();
        
        // Always store if first location
        if (lastLat == 0 && lastLng == 0) {
            lastStoredTime = now;
            return true;
        }
        
        // Force store if 30 seconds have passed (Heartbeat)
        if (now - lastStoredTime >= 30000) {
            lastStoredTime = now;
            return true;
        }
        
        // Calculate distance moved
        float[] results = new float[1];
        Location.distanceBetween(lastLat, lastLng, lat, lng, results);
        float distanceMeters = results[0];
        
        // Store if moved 10+ meters or accuracy improved to <20m
        if (distanceMeters >= 10 || (accuracy < 20 && lastAccuracy >= 20)) {
            lastStoredTime = now;
            return true;
        }
        
        return false;
    }

    private void storeLocation(double latitude, double longitude) {
        try {
            boolean storageEnabled = prefs.getBoolean("location_storage_enabled", true);
            if (!storageEnabled) {
                Log.d(TAG, "⏭️ Storage disabled by user - skipping location store");
                writeLogToFile("⏭️ Skipping server post: location_storage_enabled is false");
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
            
            writeLogToFile("📡 Posting point - Lat: " + latitude + ", Lng: " + longitude + " to " + url);
            
            Request request = new Request.Builder()
                .url(url)
                .post(RequestBody.create(
                    body.toString(),
                    MediaType.parse("application/json")
                ))
                .addHeader("Content-Type", "application/json")
                .addHeader("x-user-id", userId)
                .build();
            
            httpClient.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    Log.e(TAG, "🚨 Failed to post location point to Supabase: " + e.getMessage());
                    writeLogToFile("❌ Post failed: " + e.getMessage());
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    if (response.isSuccessful()) {
                        Log.d(TAG, "✅ Location stored successfully");
                        writeLogToFile("✅ Post success! Response Code: " + response.code());
                    } else {
                        Log.w(TAG, "⚠️ Failed to store location: " + response.code());
                        writeLogToFile("⚠️ Post rejected. Response Code: " + response.code() + ", Body: " + response.message());
                    }
                    response.close();
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error storing location: " + e.getMessage());
            writeLogToFile("💥 Crash inside storeLocation: " + e.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "🔴 LocationTrackingService destroyed");
        writeLogToFile("🔴 LocationTrackingService onDestroy triggered");
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.cancel(NOTIFICATION_ID); // Explicitly remove the ongoing tracking/GPS warning notification!
            writeLogToFile("🧹 Tracking notification explicitly cancelled in onDestroy.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel notifications on destroy: " + e.getMessage());
        }
        
        if (fusedLocationClient != null && locationCallback != null) {
            try {
                fusedLocationClient.removeLocationUpdates(locationCallback);
                Log.d(TAG, "📍 Location updates removed");
                writeLogToFile("📍 Location updates callback unregistered");
            } catch (Exception e) {
                Log.e(TAG, "Failed to remove location updates", e);
                writeLogToFile("⚠️ Failed to remove location updates: " + e.getMessage());
            }
        }
        
        if (locationTimer != null) {
            locationTimer.cancel();
            locationTimer = null;
            writeLogToFile("⏱️ Location fallback timer cancelled");
        }
        
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
            writeLogToFile("🔓 WakeLock released");
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

    private void updateNotificationGpsWarning(boolean gpsDisabled) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            
            String targetChannel = CHANNEL_ID;
            if (gpsDisabled) {
                targetChannel = ALERT_CHANNEL_ID;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    NotificationChannel alertChannel = new NotificationChannel(
                        ALERT_CHANNEL_ID,
                        "HRM Location Alerts",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    alertChannel.setDescription("High importance notifications for GPS status");
                    alertChannel.enableVibration(true);
                    alertChannel.setVibrationPattern(new long[]{0, 500, 200, 500});
                    nm.createNotificationChannel(alertChannel);
                }
            }

            String contentText = gpsDisabled 
                ? "🚨 GPS is OFF! Turn it ON immediately or Half-Day will be marked in 2 mins." 
                : "Recording your work location (Do not close)";
                
            Intent notificationIntent = new Intent(this, MainActivity.class);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, targetChannel)
                .setContentTitle(gpsDisabled ? "🚨 GPS TURNED OFF!" : "HRM Location Tracking")
                .setContentText(contentText)
                .setSmallIcon(android.R.drawable.ic_dialog_map)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(contentText))
                .setPriority(gpsDisabled ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_LOW);
                
            if (gpsDisabled) {
                builder.setColor(0xFFFF0000) // Red alert!
                       .setVibrate(new long[]{0, 500, 200, 500})
                       .setDefaults(Notification.DEFAULT_ALL); // Heads-up popup drop down!
                       
                // Display a floating Toast popup overlay even if the app is completely closed
                new android.os.Handler(android.os.Looper.getMainLooper()).post(new Runnable() {
                    @Override
                    public void run() {
                        android.widget.Toast.makeText(
                            getApplicationContext(),
                            "🚨 GPS is OFF! Turn it ON immediately or Half-Day will be marked in 2 mins.",
                            android.widget.Toast.LENGTH_LONG
                        ).show();
                    }
                });
            }
            
            nm.notify(NOTIFICATION_ID, builder.build());
        } catch (Exception e) {
            Log.e(TAG, "Error updating notification for GPS: " + e.getMessage());
        }
    }

    private void showGpsWarningDialog() {
        try {
            Intent dialogIntent = new Intent(this, GpsWarningDialogActivity.class);
            dialogIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
            startActivity(dialogIntent);
            writeLogToFile("📺 Centered Dialog Launched: GpsWarningDialogActivity");
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch warning dialog: " + e.getMessage());
            writeLogToFile("⚠️ Failed to launch centered warning dialog: " + e.getMessage());
        }
    }

    private void showHalfDayMarkedNotification() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel alertChannel = new NotificationChannel(
                    ALERT_CHANNEL_ID,
                    "HRM Location Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                );
                alertChannel.enableVibration(true);
                alertChannel.setVibrationPattern(new long[]{0, 500, 200, 500});
                nm.createNotificationChannel(alertChannel);
            }
            
            String warningText = "⚠️ ATTENDANCE MARKED AS HALF-DAY! Your GPS Location was disabled for more than 2 minutes during your shift.";
            
            Intent notificationIntent = new Intent(this, MainActivity.class);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle("🚨 ATTENDANCE PENALTY MARKED")
                .setContentText(warningText)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setOngoing(true)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(warningText))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setColor(0xFFFF0000)
                .setVibrate(new long[]{0, 1000, 500, 1000});
                
            nm.notify(99999, builder.build());
        } catch (Exception e) {
            Log.e(TAG, "Error posting half-day warning: " + e.getMessage());
        }
    }

    private void checkGpsStatusAndReport() {
        try {
            LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            boolean gpsEnabled = false;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    gpsEnabled = lm.isLocationEnabled();
                } else {
                    gpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || 
                                 lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
                }
            } catch (Exception ex) {}

            if (!gpsEnabled) {
                // GPS is disabled!
                updateNotificationGpsWarning(true);
                
                if (!isDialogShown) {
                    isDialogShown = true;
                    showGpsWarningDialog();
                }
                
                if (gpsDisabledStartTime == 0) {
                    gpsDisabledStartTime = System.currentTimeMillis();
                    writeLogToFile("🚨 GPS detected OFF! Started 2-minute half-day warning countdown.");
                } else if (gpsDisabledStartTime > 0 && !isMarkedHalfDay) {
                    long elapsed = System.currentTimeMillis() - gpsDisabledStartTime;
                    writeLogToFile("⏳ GPS OFF duration: " + (elapsed / 1000) + " seconds / 120 required.");
                    if (elapsed >= 120000) { // 2 minutes
                        writeLogToFile("💥 GPS OFF FOR >2 MINUTES! Marking engineer as half-day on server.");
                        reportHalfDayToServer();
                    }
                }
            } else {
                // GPS is enabled!
                updateNotificationGpsWarning(false);
                isDialogShown = false;
                
                // Instantly auto-dismiss the warning dialog if it is open!
                try {
                    sendBroadcast(new Intent("ACTION_GPS_RESTORED"));
                } catch (Exception ex) {}
                
                // Clear any penalty/warning notification if present
                try {
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    nm.cancel(99999);
                } catch (Exception ex) {}
                
                if (gpsDisabledStartTime != 0) {
                    writeLogToFile("✅ GPS turned back ON! Resetting half-day countdown.");
                    gpsDisabledStartTime = 0;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "checkGpsStatusAndReport error: " + e.getMessage());
        }
    }

    private void reportHalfDayToServer() {
        try {
            JSONObject body = new JSONObject();
            body.put("userId", userId);
            
            String safeApiUrl = apiUrl;
            if (safeApiUrl == null || safeApiUrl.isEmpty() || safeApiUrl.equals("null")) {
                safeApiUrl = prefs.getString("api_base_url", "https://hrms.sandjglobaltech.com");
            }
            if (safeApiUrl == null || safeApiUrl.isEmpty()) {
                safeApiUrl = "https://hrms.sandjglobaltech.com";
            }
            String url = safeApiUrl + "/api/attendance/mark-half-day";
            
            writeLogToFile("📡 Reporting half-day to: " + url);
            
            Request request = new Request.Builder()
                .url(url)
                .post(RequestBody.create(
                    MediaType.parse("application/json; charset=utf-8"),
                    body.toString()
                ))
                .build();
                
            httpClient.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    writeLogToFile("❌ Failed to report half-day: " + e.getMessage());
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    String resStr = response.body() != null ? response.body().string() : "";
                    writeLogToFile("✅ Server responded to half-day post: " + resStr);
                    boolean isSuccess = false;
                    try {
                        if (response.isSuccessful() && !resStr.isEmpty()) {
                            org.json.JSONObject json = new org.json.JSONObject(resStr);
                            isSuccess = json.optBoolean("success", false);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error: " + e.getMessage());
                    }
                    if (!isSuccess) {
                        writeLogToFile("⚠️ Server returned non-success response for half-day. Retrying in next interval...");
                        response.close();
                        return;
                    }
                    isMarkedHalfDay = true; // Mark as done to prevent spamming
                    
                    // Show the critical persistent warning notification that attendance was marked half-day!
                    showHalfDayMarkedNotification();
                    
                    // Automatically stop location tracking locally on the device!
                    // This kills the foreground service and turns off the tracking notification cleanly!
                    new android.os.Handler(android.os.Looper.getMainLooper()).post(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                SharedPreferences.Editor editor = prefs.edit();
                                editor.putBoolean("tracking_active", false);
                                editor.putBoolean("location_storage_enabled", false);
                                editor.apply();
                                
                                writeLogToFile("🛑 Automatically stopping location service locally due to half-day penalty.");
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                                    stopForeground(STOP_FOREGROUND_REMOVE);
                                } else {
                                    stopForeground(true);
                                }
                                stopSelf(); // Cleanly stops the foreground service and clears tracking notification!
                            } catch (Exception e) {
                                Log.e(TAG, "Error stopping service on half-day: " + e.getMessage());
                            }
                        }
                    });
                    
                    response.close();
                }
            });
        } catch (Exception e) {
            writeLogToFile("❌ Exception in reportHalfDayToServer: " + e.getMessage());
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
