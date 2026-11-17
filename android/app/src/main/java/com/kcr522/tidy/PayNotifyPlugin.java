package com.kcr522.tidy;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * 결제 알림 → 가계부 (PayNotifyService 가 모아 둔 알림을 앱 화면(JS)에 넘겨준다)
 * - status(): 알림 접근 권한이 켜져 있는지, "기록할까요?" 알림을 띄울지
 * - openSettings(): 안드로이드 "알림 접근 허용" 화면 열기
 * - list() / remove(ids): 모아 둔 결제 알림 읽기 / 처리한 것 지우기
 * - takeOpen(): "기록할까요?" 알림을 눌러 앱을 열었는지 (한 번 꺼내면 비운다)
 * - 이벤트 "posted"(새 결제 알림), "open"(앱이 켜져 있을 때 알림을 누름)
 */
@CapacitorPlugin(name = "PayNotify")
public class PayNotifyPlugin extends Plugin {
    private static PayNotifyPlugin instance;
    private boolean openPending;

    @Override
    public void load() {
        instance = this;
        if (isOpenIntent(getActivity().getIntent())) openPending = true;
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (isOpenIntent(intent)) {
            openPending = true;
            notifyListeners("open", new JSObject(), true);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        super.handleOnDestroy();
    }

    private boolean isOpenIntent(Intent intent) {
        if (intent == null || !PayNotifyService.ACTION_OPEN.equals(intent.getAction())) return false;
        // 화면을 돌리거나 다시 열 때 또 처리하지 않게
        intent.setAction(Intent.ACTION_MAIN);
        return true;
    }

    /** 서비스에서 새 결제 알림을 모았을 때 (앱이 켜져 있으면 화면에 알린다) */
    static void emitPosted() {
        PayNotifyPlugin p = instance;
        if (p != null) p.notifyListeners("posted", new JSObject());
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PayNotifyService.PREFS, Context.MODE_PRIVATE);
    }

    private boolean granted() {
        String flat = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        if (flat == null) return false;
        String mine = new ComponentName(getContext(), PayNotifyService.class).flattenToString();
        for (String s : flat.split(":")) if (mine.equals(s)) return true;
        return false;
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject out = new JSObject();
        out.put("granted", granted());
        out.put("alert", prefs().getBoolean(PayNotifyService.KEY_ALERT, true));
        call.resolve(out);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            intent.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, new ComponentName(getContext(), PayNotifyService.class).flattenToString());
        } else {
            intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (Exception e) {
            // 상세 화면이 없는 폰: 목록 화면으로
            Intent list = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
            list.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(list);
        }
        call.resolve();
    }

    @PluginMethod
    public void setAlert(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        prefs().edit().putBoolean(PayNotifyService.KEY_ALERT, on).apply();
        if (!on) PayNotifyService.cancelAlert(getContext());
        call.resolve();
    }

    @PluginMethod
    public void list(PluginCall call) {
        try {
            JSObject out = new JSObject();
            out.put("items", new JSArray(prefs().getString(PayNotifyService.KEY_PENDING, "[]")));
            call.resolve(out);
        } catch (Exception e) {
            call.reject("결제 알림을 읽지 못했어요");
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        try {
            JSArray ids = call.getArray("ids", new JSArray());
            Set<String> drop = new HashSet<>();
            for (int i = 0; i < ids.length(); i++) drop.add(ids.getString(i));
            synchronized (PayNotifyService.class) {
                JSONArray pending = new JSONArray(prefs().getString(PayNotifyService.KEY_PENDING, "[]"));
                JSONArray keep = new JSONArray();
                for (int i = 0; i < pending.length(); i++) {
                    JSONObject o = pending.getJSONObject(i);
                    if (!drop.contains(o.optString("id"))) keep.put(o);
                }
                prefs().edit().putString(PayNotifyService.KEY_PENDING, keep.toString()).apply();
                if (keep.length() == 0) PayNotifyService.cancelAlert(getContext());
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("지우지 못했어요");
        }
    }

    @PluginMethod
    public void setFilter(PluginCall call) {
        String json = call.getString("filter", "");
        prefs().edit().putString(PayNotifyService.KEY_FILTER, json == null ? "" : json).apply();
        call.resolve();
    }

    @PluginMethod
    public void takeOpen(PluginCall call) {
        JSObject out = new JSObject();
        out.put("open", openPending);
        openPending = false;
        call.resolve(out);
    }
}
