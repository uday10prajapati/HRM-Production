package com.hrm.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.view.Gravity;
import android.graphics.Color;
import android.graphics.Typeface;

public class GpsWarningDialogActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Centered floating dialog title
        setTitle("📍 GPS REQUIRED");
        
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(60, 60, 60, 60);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#121212")); // Premium dark mode
        
        TextView warningIcon = new TextView(this);
        warningIcon.setText("⚠️");
        warningIcon.setTextSize(55);
        warningIcon.setGravity(Gravity.CENTER);
        warningIcon.setPadding(0, 0, 0, 20);
        layout.addView(warningIcon);
        
        TextView titleText = new TextView(this);
        titleText.setText("🚨 CRITICAL WARNING!");
        titleText.setTextSize(22);
        titleText.setTextColor(Color.parseColor("#E53935")); // Sleek warning red
        titleText.setGravity(Gravity.CENTER);
        titleText.setTypeface(null, Typeface.BOLD);
        titleText.setPadding(0, 0, 0, 20);
        layout.addView(titleText);

        TextView message = new TextView(this);
        message.setText("GPS LOCATION SERVICES ARE DISABLED!\n\nYou must turn ON Location/GPS immediately in your phone settings to track your shift.\n\n⚠️ FAILURE TO ENABLE GPS WILL RESULT IN AUTOMATIC HALF-DAY FOR TODAY!");
        message.setTextSize(15);
        message.setTextColor(Color.WHITE);
        message.setGravity(Gravity.CENTER);
        message.setPadding(0, 10, 0, 40);
        layout.addView(message);
        
        Button btnSettings = new Button(this);
        btnSettings.setText("⚙️ ENABLE LOCATION NOW");
        btnSettings.setBackgroundColor(Color.parseColor("#4CAF50")); // Safe/action green!
        btnSettings.setTextColor(Color.WHITE);
        btnSettings.setTypeface(null, Typeface.BOLD);
        btnSettings.setPadding(20, 25, 20, 25);
        btnSettings.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    Intent intent = new Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {}
                finish();
            }
        });
        
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        btnParams.setMargins(0, 10, 0, 20);
        layout.addView(btnSettings, btnParams);
        
        Button btnClose = new Button(this);
        btnClose.setText("DISMISS WARNING");
        btnClose.setBackgroundColor(Color.parseColor("#37474F"));
        btnClose.setTextColor(Color.WHITE);
        btnClose.setPadding(20, 20, 20, 20);
        btnClose.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        layout.addView(btnClose, btnParams);
        
        setContentView(layout);
        
        // Prevent dismissal by clicking outside the window
        setFinishOnTouchOutside(false);
    }

    private android.content.BroadcastReceiver gpsRestoredReceiver = new android.content.BroadcastReceiver() {
        @Override
        public void onReceive(android.content.Context context, Intent intent) {
            finish();
        }
    };

    @Override
    protected void onStart() {
        super.onStart();
        registerReceiver(gpsRestoredReceiver, new android.content.IntentFilter("ACTION_GPS_RESTORED"));
    }

    @Override
    protected void onStop() {
        super.onStop();
        try {
            unregisterReceiver(gpsRestoredReceiver);
        } catch (Exception e) {}
    }
}
