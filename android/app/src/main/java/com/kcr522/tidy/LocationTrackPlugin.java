package com.kcr522.tidy;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;

/**
 * 오늘 이동 기록 (LocationTrackService) 을 웹 화면에서 켜고 끄고, 쌓인 위치를 가져간다.
 *
 * - status() → { on, granted, gps } : 기록을 켰는지 · 위치 권한 · 폰 위치(GPS)가 켜져 있는지
 * - start() : 권한을 묻고(처음 한 번) 기록을 시작한다 → { on, granted }
 * - stop() : 기록을 끈다 (알림도 사라진다)
 * - resume() : 켜 둔 상태인데 서비스가 멈춰 있으면 다시 시작 (앱을 열 때마다 부른다)
 * - take() → { points: [{ t, lat, lng, acc }] } : 쌓인 위치를 가져가고 파일을 비운다
 */
@CapacitorPlugin(
    name = "LocationTrack",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "notify", strings = { "android.permission.POST_NOTIFICATIONS" })
    }
)
public class LocationTrackPlugin extends Plugin {

    private boolean granted() {
        return getPermissionState("location") == PermissionState.GRANTED;
    }

    private boolean gpsOn() {
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return lm.isLocationEnabled();
        return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("on", LocationTrackService.isOn(getContext()));
        ret.put("granted", granted());
        ret.put("gps", gpsOn());
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!granted()) {
            requestPermissionForAlias("location", call, "locationDone");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void locationDone(PluginCall call) {
        if (!granted()) {
            JSObject ret = new JSObject();
            ret.put("on", false);
            ret.put("granted", false);
            call.resolve(ret);
            return;
        }
        begin(call);
    }

    private void begin(PluginCall call) {
        // Android 13+: 알림이 안 보여도 기록은 되지만, 켜져 있는 걸 알 수 있게 한 번 물어본다
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notify") != PermissionState.GRANTED && !call.getBoolean("askedNotify", false)) {
            call.getData().put("askedNotify", true);
            requestPermissionForAlias("notify", call, "notifyDone");
            return;
        }
        LocationTrackService.setOn(getContext(), true);
        boolean ok = launch();
        JSObject ret = new JSObject();
        ret.put("on", ok);
        ret.put("granted", true);
        if (!ok) LocationTrackService.setOn(getContext(), false);
        call.resolve(ret);
    }

    @PermissionCallback
    private void notifyDone(PluginCall call) {
        begin(call);
    }

    private boolean launch() {
        try {
            ContextCompat.startForegroundService(getContext(), new Intent(getContext(), LocationTrackService.class));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void resume(PluginCall call) {
        JSObject ret = new JSObject();
        boolean on = LocationTrackService.isOn(getContext()) && granted();
        if (on) on = launch();
        ret.put("on", on);
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        LocationTrackService.setOn(getContext(), false);
        getContext().stopService(new Intent(getContext(), LocationTrackService.class));
        call.resolve();
    }

    @PluginMethod
    public void take(PluginCall call) {
        JSArray points = new JSArray();
        synchronized (LocationTrackService.class) {
            File f = new File(getContext().getFilesDir(), LocationTrackService.FILE);
            if (f.exists()) {
                try (BufferedReader r = new BufferedReader(new FileReader(f))) {
                    String line;
                    while ((line = r.readLine()) != null) {
                        String[] p = line.split(",");
                        if (p.length < 3) continue;
                        try {
                            JSObject o = new JSObject();
                            o.put("t", Long.parseLong(p[0]));
                            o.put("lat", Double.parseDouble(p[1]));
                            o.put("lng", Double.parseDouble(p[2]));
                            o.put("acc", p.length > 3 ? Integer.parseInt(p[3]) : 0);
                            points.put(o);
                        } catch (NumberFormatException ignored) {
                            // 깨진 줄은 건너뛴다
                        }
                    }
                } catch (Exception ignored) {
                    // 못 읽으면 다음에
                }
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
        JSObject ret = new JSObject();
        ret.put("points", points);
        call.resolve(ret);
    }
}
