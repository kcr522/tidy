package com.kcr522.tidy;

import android.content.Context;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * 갤럭시 홈 화면 '오늘' 위젯: 오늘 할 일과 지출.
 * 앱(웹 화면)이 TidyWidgetPlugin 으로 7일치 요약을 저장해 두면, 앱이 꺼져 있어도 날짜에 맞는 칸을 골라 그린다.
 * 그리는 규칙은 src/lib/widgetSummary.ts 의 widgetView 와 같다.
 */
public class TidyWidget extends TidyBaseWidget {
    private static final int[] ITEM_IDS = {R.id.widget_item1, R.id.widget_item2, R.id.widget_item3, R.id.widget_item4};

    @Override
    String kind() {
        return "today";
    }

    /** 할 일 한 줄: "○  제목" / 끝낸 것은 "✓  제목" 에 취소선 */
    static CharSequence todoLine(Context context, JSONObject item) {
        int muted = context.getColor(R.color.widget_muted);
        boolean isDone = item.optInt("d", 0) == 1;
        SpannableString text = new SpannableString((isDone ? "✓  " : "○  ") + item.optString("t", ""));
        if (isDone) {
            text.setSpan(new StrikethroughSpan(), 3, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            text.setSpan(new ForegroundColorSpan(muted), 0, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        } else {
            text.setSpan(new ForegroundColorSpan(muted), 0, 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        return text;
    }

    @Override
    RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_tidy);

        Calendar now = Calendar.getInstance();
        String today = WidgetData.todayKey();
        int month = now.get(Calendar.MONTH) + 1;
        v.setTextViewText(R.id.widget_date, month + "월 " + now.get(Calendar.DAY_OF_MONTH) + "일 " + WidgetData.WEEKDAYS[now.get(Calendar.DAY_OF_WEEK) - 1]);
        WidgetData.openAppOnTap(context, v);

        JSONObject summary = WidgetData.summary(context);
        JSONObject day = WidgetData.day(summary, today);
        WidgetData.applyOpacity(v, summary, kind());

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
                v.setTextViewText(ITEM_IDS[i], todoLine(context, item));
                v.setViewVisibility(ITEM_IDS[i], View.VISIBLE);
            }
            int more = total - shown;
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
}
