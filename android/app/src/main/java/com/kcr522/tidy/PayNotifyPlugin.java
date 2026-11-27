package com.kcr522.tidy;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.Base64;
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

import java.io.ByteArrayOutputStream;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 결제 알림 → 가계부 (PayNotifyService 가 모아 둔 알림을 앱 화면(JS)에 넘겨준다)
 * - status(): 알림 접근 권한이 켜져 있는지, "기록할까요?" 알림을 띄울지
 * - openSettings(): 안드로이드 "알림 접근 허용" 화면 열기
 * - list() / remove(ids): 모아 둔 결제 알림 읽기 / 처리한 것 지우기
 * - apps(): 뺄 앱 고르기 목록 (결제 알림을 보낸 앱 + 폰에 깔린 카드·은행·페이·문자 앱, 아이콘 포함)
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

    /**
     * 설정 > 기록하지 않을 알림 > 앱 고르기 목록.
     * PayNotifyService 가 읽는 앱만 (카드·은행·페이 패키지 이름, 문자·카톡) — 그 밖의 앱은 원래 읽지 않으니 고를 필요가 없다.
     * 알림을 보낸 적 있는 앱은 seen(마지막 시각)·count 가 붙는다. 지운 앱이어도 알림을 보낸 적 있으면 남긴다.
     */
    @PluginMethod
    public void apps(PluginCall call) {
        getBridge().execute(() -> {
            try {
                PackageManager pm = getContext().getPackageManager();
                String me = getContext().getPackageName();
                Map<String, JSObject> out = new LinkedHashMap<>();
                Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
                List<ResolveInfo> found = pm.queryIntentActivities(launcher, 0);
                for (ResolveInfo r : found) {
                    String pkg = r.activityInfo == null ? null : r.activityInfo.packageName;
                    if (pkg == null || pkg.equals(me) || out.containsKey(pkg) || !PayNotifyService.isFinanceApp(pkg)) continue;
                    out.put(pkg, app(pm, pkg, r.loadLabel(pm), r.loadIcon(pm)));
                }
                JSONObject seen = new JSONObject(prefs().getString(PayNotifyService.KEY_SEEN, "{}"));
                for (Iterator<String> it = seen.keys(); it.hasNext(); ) {
                    String pkg = it.next();
                    JSONObject s = seen.optJSONObject(pkg);
                    if (s == null) continue;
                    JSObject a = out.get(pkg);
                    if (a == null) {
                        a = installed(pm, pkg);
                        if (a == null) {
                            a = new JSObject();
                            a.put("pkg", pkg);
                            a.put("name", s.optString("name", pkg));
                        }
                        out.put(pkg, a);
                    }
                    a.put("seen", s.optLong("t", 0));
                    a.put("count", s.optInt("n", 0));
                }
                JSArray list = new JSArray();
                for (JSObject a : out.values()) list.put(a);
                JSObject res = new JSObject();
                res.put("apps", list);
                call.resolve(res);
            } catch (Exception e) {
                call.reject("앱 목록을 읽지 못했어요");
            }
        });
    }

    private JSObject installed(PackageManager pm, String pkg) {
        try {
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return app(pm, pkg, pm.getApplicationLabel(info), pm.getApplicationIcon(info));
        } catch (Exception e) {
            return null;
        }
    }

    private static JSObject app(PackageManager pm, String pkg, CharSequence label, Drawable icon) {
        JSObject a = new JSObject();
        a.put("pkg", pkg);
        a.put("name", label == null ? pkg : label.toString());
        String png = iconPng(icon);
        if (png != null) a.put("icon", png);
        return a;
    }

    /** 앱 아이콘 → 작은 PNG data URL (96px, 한 개에 몇 KB) */
    private static String iconPng(Drawable d) {
        if (d == null) return null;
        try {
            int size = 96;
            Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bmp);
            d.setBounds(0, 0, size, size);
            d.draw(c);
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 100, buf);
            bmp.recycle();
            return "data:image/png;base64," + Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void takeOpen(PluginCall call) {
        JSObject out = new JSObject();
        out.put("open", openPending);
        openPending = false;
        call.resolve(out);
    }
}
