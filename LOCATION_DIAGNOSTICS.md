# Background Location Tracking - Diagnostic Testing Guide

## Enhanced Logging Deployed ✅

All location tracking code now includes detailed diagnostic logging with the `[LOCATION]` tag to help identify exactly where the problem is occurring.

---

## How to Test & Diagnose

### Step 1: Deploy to Andoid Device

```bash
# Open Android Studio
npx cap open android

# In Android Studio:
1. Click Build → Build Bundle(s) / APK(s) → Build APK(s)
2. Wait for build to complete
3. Run → Run 'app' (select device)
4. Or: adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 2: Open Browser DevTools

When app starts on device (connected via USB):
```bash
# In Chrome on your computer:
chrome://inspect/#devices

# Click "Inspect" on the app
```

This opens browser console where you'll see all `[LOCATION]` debug messages.

### Step 3: Test Location Tracking

**Action 1: Open App**
Look for console logs:
```
[LOCATION] 🚀 Initializing app on native platform...
[LOCATION] 🔧 Pre-initializing background geolocation plugin...
[init] ✅ Background geolocation plugin loaded and ready
[LOCATION] 🔐 Requesting initial location permissions on app startup...
[LOCATION] 📍 Initial permission result: {location: 'granted', ...}
[LOCATION] 📍 Attempting to resume background location tracking if needed...
[APP] ✅ App initialization complete
```

**If these logs don't appear**: Could indicate app not reaching this code (rare)

---

**Action 2: Navigate to Attendance & Punch In**
Look for console logs during punch in:

```
[LOCATION] 🟢 ===== STARTING BACKGROUND GEOLOCATION =====
[LOCATION] 1️⃣ Initializing background geolocation plugin...
[LOCATION] ✅ Background Geolocation already loaded
[LOCATION] 2️⃣ Plugin loaded successfully, requesting permissions...
[LOCATION] 🔐 Requesting location permissions...
[LOCATION] 📍 Foreground location permission: {location: 'granted'}
[LOCATION] ✅ Location permission granted
[LOCATION] 3️⃣ Configuring background geolocation with tracking settings...
[LOCATION] 📋 Plugin config: {interval: 5000, ...}
[LOCATION] 4️⃣ Calling BGGeo.configure()...
[LOCATION] ✅ Configure completed
[LOCATION] 5️⃣ Setting up event listeners...
[LOCATION] ✅ onLocation listener registered
[LOCATION] ✅ onError listener registered
[LOCATION] ✅ onMotionChange listener registered
[LOCATION] 6️⃣ Calling BGGeo.start()...
[LOCATION] ✅ Background geolocation started successfully
[LOCATION] 🟢 ===== BACKGROUND GEOLOCATION FULLY INITIALIZED =====
```

**If you see all these**: Background geolocation is properly initialized ✅

**If logs stop at step 4️⃣ "Calling BGGeo.configure()"**: 
- The plugin configuration is failing
- Look for error message: `[LOCATION] ❌ Configure failed: ...`
- Check the error message for details

**If logs stop at step 6️⃣ "Calling BGGeo.start()"**:
- The native service is not starting
- Look for error message: `[LOCATION] ❌ BGGeo.start() failed: ...`
- This suggests native setup issue

---

### Step 4: Watch for Location Updates While App is Open

Keep app open and wait. You should see:
```
[LOCATION] 📍 Interval: Storing location (5123ms elapsed)
✅ Location stored: {id: ..., latitude: ..., longitude: ...}

[LOCATION] 📍 Interval: Storing location (10245ms elapsed)
✅ Location stored: {id: ..., latitude: ..., longitude: ...}
```

**Every 5-10 seconds you should see new location stored messages**

If you DON'T see these, the JavaScript interval tracking failed to start. Check for error messages around `locationTrackingInterval = setInterval`.

---

### Step 5: Close App and Check Status Bar

After punch in with tracking running:
1. Close app (swipe away completely)
2. Check Android status bar
3. Look for a notification with "HRM Location Tracking Active"

**If notification IS visible**: ✅ Foreground service is running
**If notification NOT visible**: ❌ Service didn't start - native issue

---

### Step 6: Wait 5 Minutes with App Closed

1. App closed (swiped away)
2. Notification visible (or not)
3. Wait 5 minutes
4. Check database:

```sql
SELECT COUNT(*) as location_count,
       MAX(updated_at) as latest_time,
       MIN(updated_at) as earliest_time,
       MAX(latitude) as max_lat,
       MIN(latitude) as min_lat
FROM live_locations
WHERE user_id = '2ddfdfc9-43bb-41ef-aa5c-0215c54c0ecd'
  AND updated_at > NOW() - INTERVAL '6 minutes';
```

**Expected results:**
- `location_count`: 30-60 (1 per 5-10 seconds over 5 minutes)
- `latest_time`: Recent (within 1 minute of now)
- Latitude/longitude vary if you moved

**Actual results if broken:**
- `location_count`: 0-3
- `latest_time`: Only at punch in time
- No updates after app closed

---

### Step 7: Reopen App

When you reopen app:
```
[LOCATION] ▶️ App resumed from background
[LOCATION] 📍 Resuming location tracking after background...
[LOCATION] 🟢 ===== STARTING BACKGROUND GEOLOCATION =====
...
```

Then you should see interval logs again while app is open.

---

## Possible Outcomes & Solutions

### Outcome 1: All logs appear, location stored every 5s, DB has data ✅
**Status**: WORKING
**Action**: Problem is solved! Deploy to all users.

---

### Outcome 2: Logs show BGGeo.configure() fails ❌
```
[LOCATION] ❌ Configure failed: ...
```

**Diagnosis**: Plugin configuration parameters rejected
**Fix needed**: 
1. Check Android native logs:
   ```bash
   adb logcat | grep -i "background\|geolocation\|config"
   ```
2. Check if error mentions invalid parameter name
3. Might need to use different parameter names for this plugin version

---

### Outcome 3: Logs show BGGeo.start() fails ❌
```
[LOCATION] ❌ BGGeo.start() failed: ...
```

**Diagnosis**: Plugin won't start native service
**Fix needed**:
1. Check if permissions are actually granted:
   ```bash
   adb shell pm dumpsys package com.hrm.app | grep -i "permission"
   ```
2. Check native logs:
   ```bash
   adb logcat | grep -i "permission\|denied"
   ```
3. May need to manually grant permissions in Settings → Permissions

---

### Outcome 4: No logs at all - app startup failed
```
[LOCATION] 🚀 Initializing app... (NOT SEEN)
```

**Diagnosis**: JavaScript didn't run
**Causes**: App crash, javascript error
**Fix**:
1. Check for JS errors in console
2. Check Chrome DevTools console for red errors
3. App may have crashed - check logs

---

### Outcome 5: Logs appear but notification never shows
```
✅ Background geolocation started successfully
(but no notification in status bar)
```

**Diagnosis**: Foreground service not displaying notification
**Causes**:
- Notification permission not granted
- Android killed the service due to memory
- Notification settings blocked for this app
  
**Fix**:
1. Check notification permission in Android settings
2. Check battery optimization isn't killing background apps
3. May need to request notification permission explicitly

---

### Outcome 6: Location tracks fine while open, stops when closed
```
✅ Starts fine when app open
✅ Stores every 5 seconds
❌ Zero data while app closed
```

**Diagnosis**: JavaScript interval stops when app pauses (expected), but native plugin not running
**Causes**:
- Native plugin didn't actually start
- Native Android service being killed by system
- stopOnTerminate setting not working

**Fix Priority Fixes**:
1. Lower min battery - reduce interval to 30s or 60s
2. Lower accuracy requirement - change desiredAccuracy from 10 to 20
3. Reduce distance threshold - change from 10m to 20m (fewer updates = less battery = app survives)

---

## Android Manifest Verification

Verify that these permissions are properly declared:

```bash
adb shell grep -A 30 "permissions" /data/app/com.hrm.app-*/base.apk
```

Or check in Android Studio:
- Project → android → app → src → main → AndroidManifest.xml
- Should contain:
  - `ACCESS_COARSE_LOCATION`
  - `ACCESS_FINE_LOCATION`
  - `ACCESS_BACKGROUND_LOCATION`
  - `FOREGROUND_SERVICE`
  - `FOREGROUND_SERVICE_LOCATION`

---

## LiveLogcat Output Example

When tracking starts, you should see native logs:

```bash
adb logcat -s "BackgroundGeolocation"
```

Expected logs:
```
D/BackgroundGeolocation: Configuring location tracking
D/BackgroundGeolocation: Starting foreground service
D/BackgroundGeolocation: Service started with interval: 5000ms
D/BackgroundGeolocation: Location update received...
```

If you DON'T see these, the native plugin isn't properly initialized.

---

## Next Steps Based on Logs

### If everything works:
1. Deploy new APK to all users
2. Users punch in and location tracking should now work in background
3. Monitor database for continuous location data

### If diagnostics show failure:
1. Run full diagnostic test (this document)
2. Share console logs with developer
3. Share `adb logcat` output
4. Try alternative location plugin if current one is incompatible

---

## Current Build Status

- ✅ Enhanced logging added
- ✅ Build succeeded
- ✅ Synced to Android
- ⏳ Ready for testing

**Next action**: Deploy APK and run diagnostic test above

