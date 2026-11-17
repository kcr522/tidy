package com.kcr522.tidy;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 홈 화면 위젯에서 누른 곳(예: 메모 하나, 새 메모)을 앱 화면(JS)에 넘겨준다 (src/platform/widgetRoute.ts).
 * - 앱이 꺼져 있다가 위젯으로 켜지면: 화면이 뜬 뒤 take()로 가져간다
 * - 앱이 켜져 있으면: "route" 이벤트를 보내고, 화면이 take()로 가져간다
 */
@CapacitorPlugin(name = "WidgetRoute")
public class WidgetRoutePlugin extends Plugin {
    /** 위젯이 앱을 열 때 Intent 에 넣는 화면 주소 (예: /memo?id=3) */
    static final String EXTRA_ROUTE = "com.kcr522.tidy.WIDGET_ROUTE";

    private String pending;

    @Override
    public void load() {
        capture(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (capture(intent)) notifyListeners("route", new JSObject(), true);
    }

    /** 들어온 화면 주소를 꺼내 간다 (한 번 꺼내면 비운다) */
    @PluginMethod
    public void take(PluginCall call) {
        JSObject out = new JSObject();
        if (pending != null) out.put("route", pending);
        pending = null;
        call.resolve(out);
    }

    private boolean capture(Intent intent) {
        if (intent == null) return false;
        String route = intent.getStringExtra(EXTRA_ROUTE);
        // 앱 안 주소만 받는다
        if (route == null || !route.startsWith("/")) return false;
        pending = route;
        // 화면을 돌리거나 다시 열 때 같은 곳으로 또 가지 않게
        intent.removeExtra(EXTRA_ROUTE);
        return true;
    }
}
