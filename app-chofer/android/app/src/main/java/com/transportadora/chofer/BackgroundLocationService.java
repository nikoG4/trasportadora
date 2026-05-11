package com.transportadora.chofer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class BackgroundLocationService extends Service implements LocationListener {
    private static final String CHANNEL_ID = "driver_location_tracking";
    private static final int NOTIFICATION_ID = 77;
    private LocationManager locationManager;
    private String apiUrl = "";
    private String token = "";
    private String choferId = "";
    private String viajeId = "";
    private String vehiculoId = "";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            apiUrl = intent.getStringExtra("apiUrl") == null ? apiUrl : intent.getStringExtra("apiUrl");
            token = intent.getStringExtra("token") == null ? token : intent.getStringExtra("token");
            choferId = intent.getStringExtra("choferId") == null ? choferId : intent.getStringExtra("choferId");
            viajeId = intent.getStringExtra("viajeId") == null ? "" : intent.getStringExtra("viajeId");
            vehiculoId = intent.getStringExtra("vehiculoId") == null ? "" : intent.getStringExtra("vehiculoId");
        }
        startForeground(NOTIFICATION_ID, buildNotification());
        startLocationUpdates();
        return START_STICKY;
    }

    private Notification buildNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Ubicacion del chofer", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Comparte la ubicacion durante viajes y repartos");
            manager.createNotificationChannel(channel);
        }

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setContentTitle("Transportadora")
            .setContentText("Compartiendo ubicacion del chofer")
            .setSmallIcon(getApplicationInfo().icon)
            .setOngoing(true)
            .build();
    }

    private void startLocationUpdates() {
        try {
            if (locationManager == null) locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            locationManager.removeUpdates(this);
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 15000, 20, this);
            locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 30000, 50, this);
        } catch (SecurityException ignored) {
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null || apiUrl.isEmpty() || token.isEmpty() || choferId.isEmpty()) return;
        new Thread(() -> sendLocation(location)).start();
    }

    private void sendLocation(Location location) {
        String body = "{"
            + "\"idempotency_key\":\"bg-" + System.currentTimeMillis() + "\","
            + "\"chofer_id\":" + numberOrQuoted(choferId) + ","
            + "\"viaje_id\":" + nullableNumber(viajeId) + ","
            + "\"vehiculo_id\":" + nullableNumber(vehiculoId) + ","
            + "\"latitud\":" + location.getLatitude() + ","
            + "\"longitud\":" + location.getLongitude() + ","
            + "\"timestamp\":\"" + new java.util.Date().toInstant().toString() + "\""
            + "}";
        if (!post(body)) enqueue(body);
        flushQueue();
    }

    private boolean post(String body) {
        try {
            URL url = new URL(apiUrl.replaceAll("/+$", "") + "/tracking");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            try (OutputStream output = conn.getOutputStream()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            conn.disconnect();
            return code >= 200 && code < 300;
        } catch (Exception e) {
            return false;
        }
    }

    private void enqueue(String body) {
        SharedPreferences prefs = getSharedPreferences("background-location", MODE_PRIVATE);
        String queue = prefs.getString("queue", "");
        prefs.edit().putString("queue", queue + body + "\n").apply();
    }

    private void flushQueue() {
        SharedPreferences prefs = getSharedPreferences("background-location", MODE_PRIVATE);
        String queue = prefs.getString("queue", "");
        if (queue.isEmpty()) return;
        StringBuilder remaining = new StringBuilder();
        for (String item : queue.split("\n")) {
            if (item.trim().isEmpty()) continue;
            if (!post(item)) remaining.append(item).append('\n');
        }
        prefs.edit().putString("queue", remaining.toString()).apply();
    }

    private String nullableNumber(String value) {
        if (value == null || value.trim().isEmpty() || "null".equals(value)) return "null";
        return value;
    }

    private String numberOrQuoted(String value) {
        try {
            Double.parseDouble(value);
            return value;
        } catch (Exception e) {
            return "\"" + value.replace("\"", "") + "\"";
        }
    }

    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onDestroy() {
        if (locationManager != null) locationManager.removeUpdates(this);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
