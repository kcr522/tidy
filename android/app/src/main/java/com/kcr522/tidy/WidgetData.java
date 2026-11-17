package com.kcr522.tidy;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * 홈 화면 위젯 다섯 종류가 함께 쓰는 것: 요약 읽기, 바탕 투명도, 앱 열기, 자정에 다시 그리기.
 * 요약 모양은 src/lib/widgetSummary.ts 의 WidgetSummary, 투명도는 src/lib/widgetSettings.ts.
 */
final class WidgetData {
    static final String PREFS = "tidy_widget";
    static final String KEY = "summary";
    /** 자정 알람이 보내는 신호 (TidyBaseWidget.onReceive 가 받아 모든 위젯을 다시 그린다) */
    static final String ACTION_MIDNIGHT = "com.kcr522.tidy.WIDGET_MIDNIGHT";

    static final String[] WEEKDAYS = {"일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"};

    private WidgetData() {}

    /** 위젯 종류 → 클래스 (웹의 WidgetKind 와 같은 이름) */
    static Class<? extends TidyBaseWidget> classOf(String kind) {
        if ("todo".equals(kind)) return TodoWidget.class;
        if ("money".equals(kind)) return MoneyWidget.class;
        if ("event".equals(kind)) return EventWidget.class;
        if ("habit".equals(kind)) return HabitWidget.class;
        return TidyWidget.class;
    }

    static TidyBaseWidget[] all() {
        return new TidyBaseWidget[] {new TidyWidget(), new TodoWidget(), new MoneyWidget(), new EventWidget(), new HabitWidget()};
    }

    static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
    }

    /** 저장된 요약. 없거나 깨졌으면 null */
    static JSONObject summary(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY, null);
            return raw == null ? null : new JSONObject(raw);
        } catch (Exception e) {
            return null;
        }
    }

    /** 오늘 칸. 요약이 없거나 7일이 지났으면 null */
    static JSONObject day(JSONObject summary, String key) {
        if (summary == null) return null;
        JSONObject days = summary.optJSONObject("days");
        return days == null ? null : days.optJSONObject(key);
    }

    /** 바탕만 투명하게 (글자는 그대로). 위젯 레이아웃마다 widget_bg_img 가 맨 아래 깔려 있다 */
    static void applyOpacity(RemoteViews v, JSONObject summary, String kind) {
        int pct = 100;
        if (summary != null) {
            JSONObject opacity = summary.optJSONObject("opacity");
            if (opacity != null) pct = Math.max(0, Math.min(100, opacity.optInt(kind, 100)));
        }
        v.setInt(R.id.widget_bg_img, "setImageAlpha", Math.round(pct * 255 / 100f));
    }

    /** 위젯을 누르면 앱을 연다 */
    static void openAppOnTap(Context context, RemoteViews v) {
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
    }

    /** 요약이 바뀌었을 때 (플러그인에서 부른다): 놓인 위젯을 모두 다시 그린다 */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (TidyBaseWidget w : all()) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, w.getClass()));
            for (int id : ids) manager.updateAppWidget(id, w.build(context));
        }
        scheduleMidnight(context);
    }

    private static boolean anyPlaced(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (TidyBaseWidget w : all()) {
            if (manager.getAppWidgetIds(new ComponentName(context, w.getClass())).length > 0) return true;
        }
        return false;
    }

    /** 자정이 지나면 날짜와 오늘 칸을 바꿔 그린다 (정확하지 않아도 되는 알람이라 권한이 필요 없다) */
    static void scheduleMidnight(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        Intent intent = new Intent(context, TidyWidget.class);
        intent.setAction(ACTION_MIDNIGHT);
        PendingIntent pending = PendingIntent.getBroadcast(context, 2, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        if (!anyPlaced(context)) {
            alarms.cancel(pending);
            return;
        }
        Calendar next = Calendar.getInstance();
        next.add(Calendar.DAY_OF_MONTH, 1);
        next.set(Calendar.HOUR_OF_DAY, 0);
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 5);
        next.set(Calendar.MILLISECOND, 0);
        alarms.set(AlarmManager.RTC, next.getTimeInMillis(), pending);
    }
}
