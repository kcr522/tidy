package com.kcr522.tidy;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.FileWriter;
import java.util.Locale;

/**
 * 오늘 이동 기록 (2026-11-21).
 * 알림창에 "오늘 이동 기록 중"을 띄워 둔 동안(포그라운드 서비스) 위치를 받아 파일에 한 줄씩 쌓는다.
 * 앱을 열면 LocationTrackPlugin.take() 가 쌓인 줄을 가져가 앱 DB(이 폰에만)에 넣고 파일을 비운다.
 *
 * - 구글 라이브러리 없이 안드로이드 기본 LocationManager 만 쓴다 (앱 크기 그대로)
 * - Android 12+ 는 FUSED 제공자(GPS · 와이파이 · 기지국을 알아서 섞어 배터리를 아낀다), 그 전은 GPS + 네트워크
 * - 2분마다, 또는 40m 넘게 움직였을 때만 받는다. 정확도가 200m 보다 나쁜 값은 버린다
 */
public class LocationTrackService extends Service {
    static final String PREFS = "tidy_location";
    static final String KEY_ON = "on";
    static final String FILE = "route_points.txt";
    private static final String CHANNEL = "tidy_route";
    private static final int NOTI_ID = 7311;
    private static final long MIN_TIME = 2 * 60 * 1000L;
    private static final float MIN_DISTANCE = 40f;
    private static final float MAX_ACCURACY = 200f;

    private LocationManager lm;
    private final LocationListener listener = new LocationListener() {
        @Override
        public void onLocationChanged(@NonNull Location loc) {
            save(LocationTrackService.this, loc);
        }

        @Override
        public void onProviderEnabled(@NonNull String provider) {}

        @Override
        public void onProviderDisabled(@NonNull String provider) {}

        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {}
    };

    static boolean isOn(Context ctx) {
        return ctx.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(KEY_ON, false);
    }

    static void setOn(Context ctx, boolean on) {
        SharedPreferences.Editor e = ctx.getSharedPreferences(PREFS, MODE_PRIVATE).edit();
        e.putBoolean(KEY_ON, on);
        e.apply();
    }

    /** 받은 위치 한 줄: 시각(ms),위도,경도,정확도(m) */
    static synchronized void save(Context ctx, Location loc) {
        if (loc == null) return;
        if (loc.hasAccuracy() && loc.getAccuracy() > MAX_ACCURACY) return;
        String line = String.format(Locale.US, "%d,%.6f,%.6f,%d\n", loc.getTime() > 0 ? loc.getTime() : System.currentTimeMillis(), loc.getLatitude(), loc.getLongitude(), loc.hasAccuracy() ? Math.round(loc.getAccuracy()) : 0);
        try (FileWriter w = new FileWriter(new File(ctx.getFilesDir(), FILE), true)) {
            w.write(line);
        } catch (Exception ignored) {
            // 저장 공간이 없으면 이번 위치는 건너뛴다
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 끈 뒤에 시스템이 다시 살린 경우
        if (!isOn(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            Notification n = notification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTI_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTI_ID, n);
            }
        } catch (Exception e) {
            // 위치 권한이 없거나 뒤에서 시작하려 한 경우: 앱을 다시 열면 다시 시작한다
            stopSelf();
            return START_NOT_STICKY;
        }
        listen();
        return START_STICKY;
    }

    private void listen() {
        if (lm != null) return;
        lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return;
        try {
            boolean fused = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && lm.hasProvider(LocationManager.FUSED_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.FUSED_PROVIDER, MIN_TIME, MIN_DISTANCE, listener, Looper.getMainLooper());
                fused = true;
            }
            if (!fused) {
                if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, MIN_TIME, MIN_DISTANCE, listener, Looper.getMainLooper());
                }
                if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, MIN_TIME, MIN_DISTANCE, listener, Looper.getMainLooper());
                }
            }
            // 켜자마자 한 점 (최근 10분 안의 마지막 위치가 있으면)
            Location last = null;
            for (String p : lm.getProviders(true)) {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (last == null || l.getTime() > last.getTime())) last = l;
            }
            if (last != null && System.currentTimeMillis() - last.getTime() < 10 * 60 * 1000L) save(this, last);
        } catch (SecurityException e) {
            stopSelf();
        }
    }

    private Notification notification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "이동 기록", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("오늘 다닌 길을 기록하는 동안 보여요");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, NOTI_ID, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_tidy)
                .setContentTitle("오늘 이동 기록 중")
                .setContentText("다닌 길은 이 폰에만 저장돼요. 끄려면 Tidy 설정에서")
                .setContentIntent(pi)
                .setOngoing(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    @Override
    public void onDestroy() {
        if (lm != null) {
            try {
                lm.removeUpdates(listener);
            } catch (Exception ignored) {
                // 이미 멈췄다
            }
            lm = null;
        }
        super.onDestroy();
    }
}
