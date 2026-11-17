package com.kcr522.tidy;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** '습관' 위젯: 오늘 할 습관과 체크 (src/lib/widgetSummary.ts 의 habitWidgetView) */
public class HabitWidget extends TidyBaseWidget {
    private static final int[] ITEM_IDS = {R.id.widget_item1, R.id.widget_item2, R.id.widget_item3, R.id.widget_item4, R.id.widget_item5};

    @Override
    String kind() {
        return "habit";
    }

    @Override
    RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_habit);
        WidgetData.openAppOnTap(context, v);
        JSONObject summary = WidgetData.summary(context);
        JSONObject day = WidgetData.day(summary, WidgetData.todayKey());
        WidgetData.applyOpacity(v, summary, kind());

        for (int id : ITEM_IDS) v.setViewVisibility(id, View.GONE);
        v.setViewVisibility(R.id.widget_message, View.VISIBLE);
        v.setViewVisibility(R.id.widget_progress, View.GONE);
        if (summary == null || day == null) {
            v.setTextViewText(R.id.widget_count, "");
            v.setTextViewText(R.id.widget_message, "앱을 한 번 열면 새로 고쳐져요");
            return v;
        }
        int total = day.optInt("hbn", 0);
        int done = day.optInt("hbd", 0);
        v.setTextViewText(R.id.widget_count, done + "/" + total);
        if (total == 0) {
            v.setTextViewText(R.id.widget_message, "오늘 할 습관이 없어요");
            return v;
        }
        v.setViewVisibility(R.id.widget_message, View.GONE);
        v.setViewVisibility(R.id.widget_progress, View.VISIBLE);
        v.setProgressBar(R.id.widget_progress, total, done, false);

        boolean locked = summary.optBoolean("locked", false);
        int muted = context.getColor(R.color.widget_muted);
        int text = context.getColor(R.color.widget_text);
        JSONArray items = day.optJSONArray("hb");
        int shown = items == null ? 0 : Math.min(items.length(), ITEM_IDS.length);
        for (int i = 0; i < shown; i++) {
            JSONObject h = items.optJSONObject(i);
            if (h == null) continue;
            boolean isDone = h.optInt("d", 0) == 1;
            String title = locked ? "잠금 중" : h.optString("t", "");
            v.setTextViewText(ITEM_IDS[i], h.optString("e", "•") + "  " + title + (isDone ? "  ✓" : ""));
            v.setTextColor(ITEM_IDS[i], isDone ? muted : text);
            v.setViewVisibility(ITEM_IDS[i], View.VISIBLE);
        }
        return v;
    }
}
