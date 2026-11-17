package com.kcr522.tidy;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * '메모' 위젯: 최근 메모 네 개 (고정 먼저). 메모를 누르면 그 메모가, + 를 누르면 새 메모가 열린다.
 * 그리는 규칙은 src/lib/widgetSummary.ts 의 memoWidgetView 와 같다.
 */
public class MemoWidget extends TidyBaseWidget {
    private static final int[] ROW_IDS = {R.id.widget_item1, R.id.widget_item2, R.id.widget_item3, R.id.widget_item4};

    @Override
    String kind() {
        return "memo";
    }

    @Override
    RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_memo);
        JSONObject summary = WidgetData.summary(context);
        WidgetData.applyOpacity(v, summary, kind());
        v.setOnClickPendingIntent(R.id.widget_root, openRoute(context, "/memo", 300));
        v.setOnClickPendingIntent(R.id.widget_add, openRoute(context, "/memo?new=1", 301));

        for (int id : ROW_IDS) v.setViewVisibility(id, View.GONE);
        v.setViewVisibility(R.id.widget_message, View.VISIBLE);

        if (summary == null) {
            v.setTextViewText(R.id.widget_message, "앱을 한 번 열면 새로 고쳐져요");
            return v;
        }
        if (summary.optBoolean("locked", false)) {
            v.setTextViewText(R.id.widget_message, "🔒 잠금 중이라 숨겼어요");
            return v;
        }
        JSONArray memos = summary.optJSONArray("memos");
        if (memos == null || memos.length() == 0) {
            v.setTextViewText(R.id.widget_message, "아직 쓴 메모가 없어요. + 를 눌러 써 보세요");
            return v;
        }
        v.setViewVisibility(R.id.widget_message, View.GONE);

        int muted = context.getColor(R.color.widget_muted);
        String today = WidgetData.todayKey();
        int shown = Math.min(memos.length(), ROW_IDS.length);
        for (int i = 0; i < shown; i++) {
            JSONObject m = memos.optJSONObject(i);
            if (m == null) continue;
            v.setTextViewText(ROW_IDS[i], line(m, today, muted));
            v.setViewVisibility(ROW_IDS[i], View.VISIBLE);
            v.setOnClickPendingIntent(ROW_IDS[i], openRoute(context, "/memo?id=" + m.optLong("id", 0), 310 + i));
        }
        return v;
    }

    /** "● 📌 제목   오후 2:05" (점은 파일집 색) */
    private static CharSequence line(JSONObject m, String today, int muted) {
        SpannableStringBuilder s = new SpannableStringBuilder();
        int dot = muted;
        String c = m.optString("c", "");
        if (!c.isEmpty()) {
            try {
                dot = Color.parseColor(c);
            } catch (IllegalArgumentException ignored) {
                dot = muted;
            }
        }
        s.append("● ");
        s.setSpan(new ForegroundColorSpan(dot), 0, 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        if (m.optInt("p", 0) == 1) s.append("📌 ");
        s.append(m.optString("t", ""));
        int start = s.length();
        s.append("  ").append(when(m.optString("at", ""), today));
        s.setSpan(new ForegroundColorSpan(muted), start, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        s.setSpan(new RelativeSizeSpan(0.85f), start, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return s;
    }

    /** 오늘 쓴 것은 "오후 2:05", 아니면 "11/14" */
    private static String when(String iso, String today) {
        try {
            SimpleDateFormat in = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            in.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date d = in.parse(iso.length() >= 19 ? iso.substring(0, 19) : iso);
            if (d == null) return "";
            Calendar cal = Calendar.getInstance();
            cal.setTime(d);
            String key = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(d);
            if (key.equals(today)) {
                int h = cal.get(Calendar.HOUR_OF_DAY);
                int min = cal.get(Calendar.MINUTE);
                int h12 = h % 12 == 0 ? 12 : h % 12;
                return (h < 12 ? "오전 " : "오후 ") + h12 + ":" + (min < 10 ? "0" : "") + min;
            }
            return (cal.get(Calendar.MONTH) + 1) + "/" + cal.get(Calendar.DAY_OF_MONTH);
        } catch (Exception e) {
            return "";
        }
    }

    /** 앱을 열고 그 화면으로 간다 (WidgetRoutePlugin 이 받아 JS 에 넘긴다) */
    private static PendingIntent openRoute(Context context, String route, int code) {
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra(WidgetRoutePlugin.EXTRA_ROUTE, route);
        // 주소마다 다른 PendingIntent 가 되게 (같으면 앞의 것을 덮어쓴다)
        open.setData(Uri.parse("tidy-widget:" + route));
        return PendingIntent.getActivity(context, code, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
