package com.kcr522.tidy;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.BackgroundColorSpan;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;

/**
 * '달력' 위젯: 이번 달 달력. 위의 버튼(돈 · 일기 · 일정)을 누르면 그 달력으로 바뀐다.
 * 고른 모드는 위젯 한 장마다 따로 기억한다. 그리는 규칙은 src/lib/widgetSummary.ts 의 calendarWidgetView 와 같다.
 */
public class CalendarWidget extends TidyBaseWidget {
    static final String ACTION_MODE = "com.kcr522.tidy.WIDGET_CAL_MODE";
    private static final String[] MODES = {"money", "diary", "event"};
    private static final int[] MODE_IDS = {R.id.widget_mode_money, R.id.widget_mode_diary, R.id.widget_mode_event};
    private static final int[] WEEK_IDS = {R.id.widget_week1, R.id.widget_week2, R.id.widget_week3, R.id.widget_week4, R.id.widget_week5, R.id.widget_week6};
    private static final int[] CELL_IDS = {
        R.id.widget_c1, R.id.widget_c2, R.id.widget_c3, R.id.widget_c4, R.id.widget_c5, R.id.widget_c6, R.id.widget_c7,
        R.id.widget_c8, R.id.widget_c9, R.id.widget_c10, R.id.widget_c11, R.id.widget_c12, R.id.widget_c13, R.id.widget_c14,
        R.id.widget_c15, R.id.widget_c16, R.id.widget_c17, R.id.widget_c18, R.id.widget_c19, R.id.widget_c20, R.id.widget_c21,
        R.id.widget_c22, R.id.widget_c23, R.id.widget_c24, R.id.widget_c25, R.id.widget_c26, R.id.widget_c27, R.id.widget_c28,
        R.id.widget_c29, R.id.widget_c30, R.id.widget_c31, R.id.widget_c32, R.id.widget_c33, R.id.widget_c34, R.id.widget_c35,
        R.id.widget_c36, R.id.widget_c37, R.id.widget_c38, R.id.widget_c39, R.id.widget_c40, R.id.widget_c41, R.id.widget_c42,
    };

    @Override
    String kind() {
        return "calendar";
    }

    private static String modeOf(Context context, int id) {
        return context.getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE).getString("cal_mode_" + id, "money");
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_MODE.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            String mode = intent.getStringExtra("mode");
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID && mode != null) {
                context.getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE).edit().putString("cal_mode_" + id, mode).apply();
                AppWidgetManager.getInstance(context).updateAppWidget(id, build(context, id));
            }
            return;
        }
        super.onReceive(context, intent);
    }

    /** 홈 화면에서 크기를 바꾸면 글자 크기와 일정 줄 수를 다시 맞춘다 */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        manager.updateAppWidget(id, build(context, id));
    }

    /** 0 = 작게, 1 = 보통, 2 = 크게 (src/lib/widgetSummary.ts 의 calendarSizeOf: 300dp 미만, 450dp 미만, 그 이상) */
    private static int sizeOf(Context context, int id) {
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return 1;
        Bundle o = AppWidgetManager.getInstance(context).getAppWidgetOptions(id);
        // 세로 화면에서는 MAX_HEIGHT 가 실제 높이
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (h <= 0) return 1;
        return h < 300 ? 0 : h < 450 ? 1 : 2;
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        android.content.SharedPreferences.Editor edit = context.getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE).edit();
        for (int id : ids) edit.remove("cal_mode_" + id);
        edit.apply();
    }

    /** 달력 칸에 들어가는 짧은 금액 (src/lib/calendar.ts 의 cellWon) */
    static String cellWon(long amount) {
        long n = Math.abs(amount);
        if (n < 10_000) return String.format(Locale.KOREA, "%,d", n);
        if (n < 100_000) return trim(Math.round(n / 1000.0) / 10.0) + "만";
        long man = Math.round(n / 10_000.0);
        if (man < 10_000) return man + "만";
        double eok = n / 100_000_000.0;
        return (eok < 10 ? trim(Math.round(eok * 10) / 10.0) : String.valueOf(Math.round(eok))) + "억";
    }

    /** 칸이 좁아서 제목이 다음 줄로 넘어가지 않게 앞 몇 글자만 */
    private static String clip(String title, int max) {
        return title.codePointCount(0, title.length()) <= max ? title : title.substring(0, title.offsetByCodePoints(0, max));
    }

    private static String trim(double v) {
        return v == Math.floor(v) ? String.valueOf((long) v) : String.valueOf(v);
    }

    @Override
    RemoteViews build(Context context) {
        return build(context, AppWidgetManager.INVALID_APPWIDGET_ID);
    }

    @Override
    RemoteViews build(Context context, int appWidgetId) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_calendar);
        WidgetData.openAppOnTap(context, v);
        String mode = modeOf(context, appWidgetId);
        int size = sizeOf(context, appWidgetId);
        float daySp = size == 0 ? 11f : size == 1 ? 12f : 14f;
        // 작게 1개, 보통 2개, 크게 4개 (CAL_EVENT_LINES). 제목은 한 줄에 몇 글자만 (칸을 넘어 다음 줄로 가지 않게)
        int eventLines = size == 2 ? 4 : size + 1;
        float eventScale = 10f / daySp;
        int eventTint = context.getColor(R.color.widget_today);
        v.setTextViewTextSize(R.id.widget_title, TypedValue.COMPLEX_UNIT_SP, size == 2 ? 17f : 15f);
        JSONObject summary = WidgetData.summary(context);
        WidgetData.applyOpacity(v, summary, kind());

        int brand = context.getColor(R.color.widget_brand);
        int muted = context.getColor(R.color.widget_muted);
        int text = context.getColor(R.color.widget_text);
        int red = context.getColor(R.color.widget_over);
        int blue = context.getColor(R.color.widget_sat);

        // 위의 버튼: 누르면 그 모드로
        for (int i = 0; i < MODES.length; i++) {
            boolean on = MODES[i].equals(mode);
            v.setInt(MODE_IDS[i], "setBackgroundResource", on ? R.drawable.widget_chip_on : R.drawable.widget_chip_off);
            v.setTextColor(MODE_IDS[i], on ? 0xFFFFFFFF : muted);
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                Intent intent = new Intent(context, CalendarWidget.class);
                intent.setAction(ACTION_MODE);
                intent.setData(Uri.parse("tidy://widget/calendar/" + appWidgetId + "/" + MODES[i]));
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
                intent.putExtra("mode", MODES[i]);
                v.setOnClickPendingIntent(MODE_IDS[i], PendingIntent.getBroadcast(context, appWidgetId * 3 + i, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
            }
        }

        Calendar now = Calendar.getInstance();
        int year = now.get(Calendar.YEAR);
        int month = now.get(Calendar.MONTH) + 1;
        int today = now.get(Calendar.DAY_OF_MONTH);
        String ym = String.format(Locale.US, "%04d-%02d", year, month);
        v.setTextViewText(R.id.widget_title, month + "월");

        JSONObject cal = summary == null ? null : summary.optJSONObject("cal");
        JSONObject m = cal == null ? null : cal.optJSONObject(ym);
        boolean locked = summary != null && summary.optBoolean("locked", false);
        JSONObject spend = m == null ? null : m.optJSONObject("s");
        JSONObject events = m == null ? null : m.optJSONObject("e");
        JSONObject diaries = m == null ? null : m.optJSONObject("d");
        Set<Integer> holidays = new HashSet<>();
        JSONArray h = m == null ? null : m.optJSONArray("h");
        if (h != null) for (int i = 0; i < h.length(); i++) holidays.add(h.optInt(i));

        // 머리줄 요약
        String sum = "";
        if (m == null) sum = "앱을 한 번 열면 새로 고쳐져요";
        else if (locked) sum = "🔒 잠금 중이라 숨겼어요";
        else if ("money".equals(mode) && spend != null) {
            long total = 0;
            for (Iterator<String> it = spend.keys(); it.hasNext(); ) total += spend.optLong(it.next(), 0);
            sum = "지출 " + cellWon(total) + "원";
        } else if ("diary".equals(mode) && diaries != null) sum = "일기 " + diaries.length() + "일";
        else if ("event".equals(mode) && events != null) sum = "일정 있는 날 " + events.length() + "일";
        v.setTextViewText(R.id.widget_sum, sum);

        Calendar first = Calendar.getInstance();
        first.set(year, month - 1, 1);
        int lead = first.get(Calendar.DAY_OF_WEEK) - 1;
        int days = first.getActualMaximum(Calendar.DAY_OF_MONTH);
        int weeks = (lead + days + 6) / 7;
        for (int w = 0; w < WEEK_IDS.length; w++) v.setViewVisibility(WEEK_IDS[w], w < weeks ? View.VISIBLE : View.GONE);

        for (int i = 0; i < CELL_IDS.length; i++) {
            int day = i - lead + 1;
            int id = CELL_IDS[i];
            v.setInt(id, "setBackgroundResource", 0);
            v.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, daySp);
            v.setInt(id, "setMaxLines", 1 + eventLines);
            if (day < 1 || day > days) {
                v.setTextViewText(id, "");
                continue;
            }
            int weekday = i % 7;
            int dayColor = day == today ? brand : (weekday == 0 || holidays.contains(day)) ? red : weekday == 6 ? blue : text;
            SpannableStringBuilder b = new SpannableStringBuilder(String.valueOf(day));
            b.setSpan(new ForegroundColorSpan(dayColor), 0, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            b.setSpan(new StyleSpan(Typeface.BOLD), 0, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            String k = String.valueOf(day);
            if (m != null && !locked) {
                int start = b.length();
                if ("money".equals(mode) && spend != null && spend.has(k)) {
                    b.append("\n").append(cellWon(spend.optLong(k, 0)));
                    b.setSpan(new ForegroundColorSpan(red), start, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                    b.setSpan(new RelativeSizeSpan(0.82f), start, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                } else if ("event".equals(mode) && events != null && events.has(k)) {
                    // [일정 수, 제목…] → 크기만큼 줄. 넘치면 마지막 줄은 "+남은 수" (widgetSummary.ts 의 eventLines)
                    JSONArray e = events.optJSONArray(k);
                    int count = e == null ? 0 : e.optInt(0, 0);
                    int titles = e == null ? 0 : e.length() - 1;
                    boolean more = count > eventLines && eventLines >= 2;
                    int shown = Math.min(more ? eventLines - 1 : eventLines, titles);
                    for (int t = 0; t < shown; t++) {
                        b.append("\n");
                        int ls = b.length();
                        b.append(clip(e.optString(t + 1, ""), 4));
                        b.setSpan(new BackgroundColorSpan(eventTint), ls, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                    }
                    if (more) {
                        b.append("\n");
                        int ls = b.length();
                        b.append("+").append(String.valueOf(count - shown));
                        b.setSpan(new ForegroundColorSpan(muted), ls, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                    }
                    b.setSpan(new RelativeSizeSpan(eventScale), start, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                } else if ("diary".equals(mode) && diaries != null && diaries.has(k)) {
                    int color = brand;
                    try {
                        color = android.graphics.Color.parseColor(diaries.optString(k));
                    } catch (Exception ignored) {
                        color = brand;
                    }
                    b.append("\n●");
                    b.setSpan(new ForegroundColorSpan(color), start, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                }
            }
            v.setTextViewText(id, b);
            if (day == today) v.setInt(id, "setBackgroundResource", R.drawable.widget_today_bg);
        }
        return v;
    }
}
