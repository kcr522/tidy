package com.kcr522.tidy;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 웹 화면 → 홈 화면 위젯 다리 (src/platform/widget.ts) */
@CapacitorPlugin(name = "TidyWidget")
public class TidyWidgetPlugin extends Plugin {

    /** 요약(JSON)을 저장하고 위젯을 다시 그린다 */
    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("data가 없어요");
            return;
        }
        Context context = getContext();
        context.getSharedPreferences(TidyWidget.PREFS, Context.MODE_PRIVATE).edit().putString(TidyWidget.KEY, data).apply();
        TidyWidget.refreshAll(context);
        call.resolve();
    }

    /** 런처에 "홈 화면에 위젯 추가" 창을 띄워 달라고 한다 (안드로이드 8 이상, 지원하는 런처만) */
    @PluginMethod
    public void pin(PluginCall call) {
        JSObject result = new JSObject();
        boolean ok = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager manager = getContext().getSystemService(AppWidgetManager.class);
            if (manager != null && manager.isRequestPinAppWidgetSupported()) {
                ok = manager.requestPinAppWidget(new ComponentName(getContext(), TidyWidget.class), null, null);
            }
        }
        result.put("ok", ok);
        call.resolve(result);
    }
}
