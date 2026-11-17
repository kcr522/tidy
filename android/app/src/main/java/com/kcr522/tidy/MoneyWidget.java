package com.kcr522.tidy;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;

/** '가계부' 위젯: 이번 달 지출, 오늘 지출, 남은 예산 (src/lib/widgetSummary.ts 의 moneyWidgetView) */
public class MoneyWidget extends TidyBaseWidget {

    @Override
    String kind() {
        return "money";
    }

    @Override
    RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_money);
        WidgetData.openAppOnTap(context, v);
        String today = WidgetData.todayKey();
        v.setTextViewText(R.id.widget_title, (Calendar.getInstance().get(Calendar.MONTH) + 1) + "월 지출");
        JSONObject summary = WidgetData.summary(context);
        JSONObject day = WidgetData.day(summary, today);
        WidgetData.applyOpacity(v, summary, kind());

        boolean stale = summary == null || day == null;
        boolean locked = !stale && (summary.optBoolean("locked", false) || day.isNull("spend"));
        if (stale || locked) {
            v.setViewVisibility(R.id.widget_money_body, View.GONE);
            v.setViewVisibility(R.id.widget_message, View.VISIBLE);
            v.setTextViewText(R.id.widget_message, stale ? "앱을 한 번 열면 새로 고쳐져요" : "🔒 잠금 중이라 숨겼어요");
            return v;
        }
        v.setViewVisibility(R.id.widget_message, View.GONE);
        v.setViewVisibility(R.id.widget_money_body, View.VISIBLE);

        NumberFormat won = NumberFormat.getInstance(Locale.KOREA);
        JSONObject months = summary.optJSONObject("months");
        long month = months == null ? 0 : months.optLong(today.substring(0, 7), 0);
        v.setTextViewText(R.id.widget_month_amount, won.format(month) + "원");
        v.setTextViewText(R.id.widget_today_amount, "오늘 " + won.format(day.optLong("spend", 0)) + "원");

        long budget = summary.isNull("budget") ? 0 : summary.optLong("budget", 0);
        if (budget <= 0) {
            v.setViewVisibility(R.id.widget_budget_row, View.GONE);
            v.setTextViewText(R.id.widget_budget_label, "설정에서 한 달 예산을 정하면 남은 돈이 보여요");
            v.setTextColor(R.id.widget_budget_label, context.getColor(R.color.widget_muted));
            return v;
        }
        int pct = (int) Math.min(100, Math.round(month * 100.0 / budget));
        long left = budget - month;
        v.setViewVisibility(R.id.widget_budget_row, View.VISIBLE);
        v.setProgressBar(R.id.widget_progress, 100, pct, false);
        v.setTextViewText(R.id.widget_budget_pct, pct + "%");
        v.setTextViewText(R.id.widget_budget_label, left < 0 ? "예산 " + won.format(-left) + "원 넘었어요" : "예산 " + won.format(left) + "원 남음");
        v.setTextColor(R.id.widget_budget_label, context.getColor(left < 0 ? R.color.widget_over : R.color.widget_text));
        return v;
    }
}
