# Background Location Tracking Implementation

## Overview
Automatic GPS location tracking that:
- ✅ Fetches location every **~1 minute**
- ✅ Stores location when **moved 10+ meters** OR **after 1 minute**
- ✅ Runs **continuously in background** (even when app is closed)
- ✅ **Automatically starts on Punch In**
- ✅ **Automatically stops on Punch Out**
- ✅ **Cannot be manually disabled** by user

---

## How It Works

### 1. **Punch In** → Tracking Starts 🟢
When an engineer punches in:
1. Location permission is requested
2. Current GPS position is captured and stored
3. **Background tracking service starts**
4. Toast notification: "📍 Location tracking started"
5. Location is fetched every 1 minute
6. Location is stored if:
   - Moved 10+ meters from last stored position, OR
   - 1 minute has passed since last storage

### 2. **During Work** → Continuous Tracking
- Service runs in **foreground** while app is open
- Service runs in **background** when app is closed
- Uses Capacitor's `BackgroundTask` API for background execution
- Geolocation API captures accurate GPS coordinates

### 3. **Punch Out** → Tracking Stops 🔴
When an engineer punches out:
1. Final location is captured with punch out
2. **Background tracking service stops**
3. All tracking state is cleared
4. Toast notification: "📍 Location tracking stopped"

### 4. **App Restart** → Auto-Resume
If the app is closed during an active work session:
1. Tracking state is saved in localStorage
2. When app restarts, tracking automatically resumes
3. No user action required
4. Console log: "📍 Resuming location tracking after app restart"

---

## Technical Architecture

### Files Created/Modified

#### 1. **New Files**
```
client/src/services/
├── backgroundLocationService.js    (Main tracking service)
└── locationTrackingConfig.js       (Configuration constants)
```

#### 2. **Modified Files**
```
client/src/
├── App.jsx                         (Added auto-resume on startup)
└── engineer/EAttandance.jsx        (Added punch in/out integration)
```

#### 3. **Backend (Already Exists)**
```
backend/liveLocationsRoute.js       (Stores locations - POST /api/live-locations/upsert)
```

---

## Configuration

Edit `locationTrackingConfig.js` to customize:

```javascript
export const LOCATION_TRACKING_CONFIG = {
    FETCH_INTERVAL: 60000,           // Fetch location every 1 minute
    DISTANCE_THRESHOLD: 10,           // Store if moved 10 meters
    TIME_THRESHOLD: 60000,            // Store after 1 minute
    GEOLOCATION_OPTIONS: {
        enableHighAccuracy: true,     // Use GPS (not WiFi)
        timeout: 15000,               // Wait max 15 seconds for GPS
        maximumAge: 5000              // Use cached location if < 5s old
    }
};
```

---

## Tracking Flow

```
PUNCH IN EVENT
    ↓
User confirms punch in → Get GPS location
    ↓
POST /api/attendance/punch { latitude, longitude }
    ↓
✅ Punch recorded
    ↓
START BACKGROUND TRACKING
    ├─ Save tracking state to localStorage
    ├─ Set interval: Fetch location every 1 min
    └─ Register BackgroundTask for when app closed
    
DURING WORK (App Open or Closed)
    ├─ Every 1 minute: Get GPS coordinates
    ├─ Calculate distance from last stored location
    ├─ IF distance > 10m OR time > 1min:
    │   └─ POST /api/live-locations/upsert { latitude, longitude }
    └─ Continue until punch out
    
PUNCH OUT EVENT
    ↓
User confirms punch out → Get GPS location
    ↓
POST /api/attendance/punch { latitude, longitude }
    ↓
✅ Punch recorded
    ↓
STOP BACKGROUND TRACKING
    ├─ Clear interval
    ├─ Clear localStorage tracking state
    └─ Reset all variables

APP CLOSED/REOPENED DURING WORK
    ↓
ON APP STARTUP: resumeLocationTrackingIfNeeded()
    ├─ Check localStorage for tracking state
    ├─ IF tracking was active:
    │   └─ Auto-restart tracking service
    └─ Continue as normal
```

---

## API Endpoints Used

### Punch Recording
```
POST /api/attendance/punch
Body: {
    userId, punch_type, latitude, longitude, 
    notes, delay_time, is_half_day
}
```

### Location Storage  
```
POST /api/live-locations/upsert
Body: {
    userId, latitude, longitude
}
Response: { success: true, location: {...} }
```

---

## Storage & Privacy

- ✅ Locations stored in `live_locations` table
- ✅ User can view their tracking history 
- ✅ Admin/HR can monitor engineer locations
- ✅ Location data tied to punch in/out times
- ✅ Automatic cleanup on punch out (tracking stops)

---

## Features Implemented

| Feature | Status | Details |
|---------|--------|---------|
| Auto-start on punch in | ✅ | Tracking starts immediately after successful punch in |
| Auto-stop on punch out | ✅ | Tracking stops when user punches out |
| Fetch every ~1 min | ✅ | 60,000ms interval (configurable) |
| Store on movement | ✅ | 10+ meter threshold |
| Store on time | ✅ | After 1 minute threshold |
| Background tracking | ✅ | Uses Capacitor BackgroundTask API |
| Resume on app restart | ✅ | Automatic via localStorage & useEffect |
| No manual disable | ✅ | Cannot be turned off by user during work |
| Distance calculation | ✅ | Haversine formula (accurate to 1 meter) |
| Error handling | ✅ | Continues tracking even if one request fails |

---

## Testing

### Test Punch In/Out with Tracking:
1. Open app and navigate to Attendance tab
2. Click "Punch In" button
3. Accept location permission
4. Verify toast: "📍 Location tracking started"
5. Move 10+ meters and wait 1 minute
6. Check database: `SELECT * FROM live_locations WHERE user_id = ?`
7. Click "Punch Out" button
8. Verify toast: "📍 Location tracking stopped"
9. Verify tracking data saved properly

### Test App Restart During Work:
1. Punch In (tracking starts)
2. Close app completely
3. Reopen app
4. Verify console: "📍 Resuming location tracking after app restart"
5. Walk around and verify locations still being stored
6. Punch Out to stop tracking

---

## Dependencies

- `@capacitor/geolocation` - GPS access
- `@capacitor/background-task` - Background execution
- `axios` - API requests
- localStorage - Persistent state

---

## Future Improvements

- [ ] Add geofencing (store location only in work area)
- [ ] Battery optimization (reduce frequency on low battery)
- [ ] Offline queueing (store locally before sync)
- [ ] Real-time map visualization
- [ ] Location history analytics
- [ ] Anomaly detection (impossible speeds)

---

## Troubleshooting

### Tracking not starting?
- ✓ Check location permission granted
- ✓ Verify GPS is enabled on device
- ✓ Check console for errors
- ✓ Verify `resumeLocationTrackingIfNeeded()` called on app start

### Location data not saving?
- ✓ Check backend endpoint `/api/live-locations/upsert`
- ✓ Verify network connectivity
- ✓ Check browser console for API errors
- ✓ Verify user ID is being sent correctly

### Tracking continues after punch out?
- ✓ Check `stopLocationTracking()` is being called
- ✓ Verify interval is cleared properly
- ✓ Restart app if stuck

---

## Code Summary

### Main Service Functions

```javascript
// Start tracking (called on punch in)
await startLocationTracking(userId);

// Stop tracking (called on punch out)
await stopLocationTracking();

// Check if currently tracking
const isTracking = isLocationTrackingActive();

// Auto-resume on app restart
await resumeLocationTrackingIfNeeded();
```

All called automatically - user has no manual control.
