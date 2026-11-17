package com.kcr522.tidy;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

/** '일정' 위젯: 오늘부터 일주일 일정 (src/lib/widgetSummary.ts 의 eventWidgetView) */
public class EventWidget extends TidyBaseWidget {
    private static final int[] ROW_IDS = {R.id.widget_ev_row1, R.id.widget_ev_row2, R.id.widget_ev_row3, R.id.widget_ev_row4, R.id.widget_ev_row5};
    private static final int[] LABEL_IDS = {R.id.widget_ev_label1, R.id.widget_ev_label2, R.id.widget_ev_label3, R.id.widget_ev_label4, R.id.widget_ev_label5};
    private static final int[] TITLE_IDS = {R.id.widget_ev_title1, R.id.widget_ev_title2, R.id.widget_ev_title3, R.id.widget_ev_title4, R.id.widget_ev_title5};

    @Override
    String kind() {
        return "event";
    }

    /** "오늘", "내일", "11/19 수" */
    private static String label(String key, String today, String tomorrow) {
        if (key.equals(today)) return "오늘";
        if (key.equals(tomorrow)) return "내일";
        try {
            Date d = new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(key);
            Calendar c = Calendar.getInstance();
            c.setTime(d);
            return (c.get(Calendar.MONTH) + 1) + "/" + c.get(Calendar.DAY_OF_MONTH) + " " + WidgetData.WEEKDAYS[c.get(Calendar.DAY_OF_WEEK) - 1].substring(0, 1);
        } catch (Exception e) {
            return key.substring(5);
        }
    }

    @Override
    RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_event);
        WidgetData.openAppOnTap(context, v);
        String today = WidgetData.todayKey();
        Calendar t = Calendar.getInstance();
        t.add(Calendar.DAY_OF_MONTH, 1);
        String tomorrow = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(t.getTime());
        JSONObject summary = WidgetData.summary(context);
        JSONObject day = WidgetData.day(summary, today);
        WidgetData.applyOpacity(v, summary, kind());

        for (int id : ROW_IDS) v.setViewVisibility(id, View.GONE);
        v.setViewVisibility(R.id.widget_message, View.VISIBLE);
        if (summary == null || day == null) {
            v.setTextViewText(R.id.widget_count, "");
            v.setTextViewText(R.id.widget_message, "앱을 한 번 열면 새로 고쳐져요");
            return v;
        }
        v.setTextViewText(R.id.widget_count, "오늘 " + day.optInt("evn", 0) + "개");
        if (summary.optBoolean("locked", false)) {
            v.setTextViewText(R.id.widget_message, "🔒 잠금 중이라 숨겼어요");
            return v;
        }

        JSONObject days = summary.optJSONObject("days");
        List<String> keys = new ArrayList<>();
        for (Iterator<String> it = days.keys(); it.hasNext(); ) keys.add(it.next());
        Collections.sort(keys);
        int brand = context.getColor(R.color.widget_brand);
        int muted = context.getColor(R.color.widget_muted);
        int row = 0;
        for (String key : keys) {
            if (key.compareTo(today) < 0) continue;
            JSONArray ev = days.optJSONObject(key).optJSONArray("ev");
            if (ev == null) continue;
            for (int i = 0; i < ev.length() && row < ROW_IDS.length; i++) {
                JSONObject e = ev.optJSONObject(i);
                if (e == null) continue;
                // 여러 날 일정은 첫날과 오늘에만
                if (!key.equals(today) && e.optInt("f", 0) != 1) continue;
                v.setTextViewText(LABEL_IDS[row], label(key, today, tomorrow));
                v.setTextColor(LABEL_IDS[row], key.equals(today) ? brand : muted);
                v.setTextViewText(TITLE_IDS[row], e.optString("t", ""));
                v.setViewVisibility(ROW_IDS[row], View.VISIBLE);
                row++;
            }
        }
        if (row == 0) v.setTextViewText(R.id.widget_message, "일주일 안에 일정이 없어요");
        else v.setViewVisibility(R.id.widget_message, View.GONE);
        return v;
    }
}
