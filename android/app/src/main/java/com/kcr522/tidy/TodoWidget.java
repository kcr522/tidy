package com.kcr522.tidy;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** '할 일' 위젯: 오늘 할 일을 길게 (src/lib/widgetSummary.ts 의 todoWidgetView) */
public class TodoWidget extends TidyBaseWidget {
    private static final int[] ITEM_IDS = {R.id.widget_item1, R.id.widget_item2, R.id.widget_item3, R.id.widget_item4, R.id.widget_item5};

    @Override
    String kind() {
        return "todo";
    }

    @Override
    RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_todo);
        WidgetData.openAppOnTap(context, v);
        JSONObject summary = WidgetData.summary(context);
        JSONObject day = WidgetData.day(summary, WidgetData.todayKey());
        WidgetData.applyOpacity(v, summary, kind());

        for (int id : ITEM_IDS) v.setViewVisibility(id, View.GONE);
        v.setViewVisibility(R.id.widget_more, View.GONE);
        v.setViewVisibility(R.id.widget_message, View.VISIBLE);

        if (summary == null || day == null) {
            v.setTextViewText(R.id.widget_count, "");
            v.setTextViewText(R.id.widget_message, "앱을 한 번 열면 새로 고쳐져요");
            return v;
        }
        int total = day.optInt("total", 0);
        v.setTextViewText(R.id.widget_count, day.optInt("done", 0) + "/" + total);
        if (summary.optBoolean("locked", false)) {
            v.setTextViewText(R.id.widget_message, "🔒 잠금 중이라 숨겼어요");
            return v;
        }
        if (total == 0) {
            v.setTextViewText(R.id.widget_message, "오늘 할 일이 없어요 🎉");
            return v;
        }
        v.setViewVisibility(R.id.widget_message, View.GONE);
        JSONArray items = day.optJSONArray("items");
        int shown = items == null ? 0 : Math.min(items.length(), ITEM_IDS.length);
        for (int i = 0; i < shown; i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            v.setTextViewText(ITEM_IDS[i], TidyWidget.todoLine(context, item));
            v.setViewVisibility(ITEM_IDS[i], View.VISIBLE);
        }
        if (total > shown) {
            v.setTextViewText(R.id.widget_more, "+" + (total - shown) + "개 더");
            v.setViewVisibility(R.id.widget_more, View.VISIBLE);
        }
        return v;
    }
}
