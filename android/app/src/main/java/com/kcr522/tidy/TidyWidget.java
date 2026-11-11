package com.kcr522.tidy;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * 갤럭시 홈 화면 위젯: 오늘 할 일과 지출.
 * 앱(웹 화면)이 TidyWidgetPlugin 으로 7일치 요약을 저장해 두면, 앱이 꺼져 있어도 날짜에 맞는 칸을 골라 그린다.
 * 그리는 규칙은 src/lib/widgetSummary.ts 의 widgetView 와 같다.
 */
public class TidyWidget extends AppWidgetProvider {
    static final String PREFS = "tidy_widget";
    static final String KEY = "summary";

    private static final int[] ITEM_IDS = {R.id.widget_item1, R.id.widget_item2, R.id.widget_item3, R.id.widget_item4};
    private static final String[] WEEKDAYS = {"일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context));
        scheduleMidnight(context);
    }

    /** 요약이 바뀌었을 때 (플러그인에서 부른다) */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TidyWidget.class));
        if (ids.length == 0) return;
        for (int id : ids) manager.updateAppWidget(id, build(context));
        scheduleMidnight(context);
    }

    private static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_tidy);

        Calendar now = Calendar.getInstance();
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(now.getTime());
        int month = now.get(Calendar.MONTH) + 1;
        v.setTextViewText(R.id.widget_date, month + "월 " + now.get(Calendar.DAY_OF_MONTH) + "일 " + WEEKDAYS[now.get(Calendar.DAY_OF_WEEK) - 1]);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        JSONObject day = null;
        JSONObject summary = null;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY, null);
            if (raw != null) {
                summary = new JSONObject(raw);
                day = summary.getJSONObject("days").optJSONObject(today);
            }
        } catch (Exception ignored) {
            day = null;
        }

        for (int id : ITEM_IDS) v.setViewVisibility(id, View.GONE);
        v.setViewVisibility(R.id.widget_more, View.GONE);

        if (summary == null || day == null) {
            // 7일 넘게 앱을 안 열었거나, 위젯을 처음 놓았다
            v.setViewVisibility(R.id.widget_progress_row, View.GONE);
            v.setViewVisibility(R.id.widget_money_row, View.GONE);
            v.setViewVisibility(R.id.widget_message, View.VISIBLE);
            v.setTextViewText(R.id.widget_message, "앱을 한 번 열면 새로 고쳐져요");
            return v;
        }

        boolean locked = summary.optBoolean("locked", false);
        int done = day.optInt("done", 0);
        int total = day.optInt("total", 0);
        v.setViewVisibility(R.id.widget_progress_row, View.VISIBLE);
        v.setTextViewText(R.id.widget_progress_label, "오늘 할 일 " + done + "/" + total);
        v.setProgressBar(R.id.widget_progress, Math.max(total, 1), done, false);

        int muted = context.getColor(R.color.widget_muted);
        JSONArray items = day.optJSONArray("items");
        int shown = items == null ? 0 : Math.min(items.length(), ITEM_IDS.length);
        if (locked) {
            v.setViewVisibility(R.id.widget_message, View.VISIBLE);
            v.setTextViewText(R.id.widget_message, "🔒 잠금 중이라 내용은 숨겼어요");
        } else if (total == 0) {
            v.setViewVisibility(R.id.widget_message, View.VISIBLE);
            v.setTextViewText(R.id.widget_message, "오늘 할 일이 없어요");
        } else {
            v.setViewVisibility(R.id.widget_message, View.GONE);
            for (int i = 0; i < shown; i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                boolean isDone = item.optInt("d", 0) == 1;
                String title = item.optString("t", "");
                SpannableString text = new SpannableString((isDone ? "✓  " : "○  ") + title);
                if (isDone) {
                    text.setSpan(new StrikethroughSpan(), 3, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                    text.setSpan(new ForegroundColorSpan(muted), 0, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                } else {
                    text.setSpan(new ForegroundColorSpan(muted), 0, 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                }
                v.setTextViewText(ITEM_IDS[i], text);
                v.setViewVisibility(ITEM_IDS[i], View.VISIBLE);
            }
            int more = total - (items == null ? 0 : items.length());
            if (more > 0) {
                v.setTextViewText(R.id.widget_more, "+" + more + "개 더");
                v.setViewVisibility(R.id.widget_more, View.VISIBLE);
            }
        }

        if (locked || day.isNull("spend")) {
            v.setViewVisibility(R.id.widget_money_row, View.GONE);
        } else {
            NumberFormat won = NumberFormat.getInstance(Locale.KOREA);
            long spend = day.optLong("spend", 0);
            long monthSpend = summary.optJSONObject("months") == null ? 0 : summary.optJSONObject("months").optLong(today.substring(0, 7), 0);
            v.setViewVisibility(R.id.widget_money_row, View.VISIBLE);
            v.setTextViewText(R.id.widget_money, "오늘 지출 " + won.format(spend) + "원 · " + month + "월 " + won.format(monthSpend) + "원");
        }
        return v;
    }

    /** 자정이 지나면 날짜와 오늘 칸을 바꿔 그린다 (정확하지 않아도 되는 알람이라 권한이 필요 없다) */
    private static void scheduleMidnight(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        int[] ids = AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, TidyWidget.class));
        Intent intent = new Intent(context, TidyWidget.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        PendingIntent pending = PendingIntent.getBroadcast(context, 1, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        if (ids.length == 0) {
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

    @Override
    public void onDisabled(Context context) {
        scheduleMidnight(context);
    }
}
