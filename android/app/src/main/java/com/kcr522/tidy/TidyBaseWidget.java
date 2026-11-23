package com.kcr522.tidy;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.widget.RemoteViews;

/** 홈 화면 위젯 공통: 그리는 것(build)만 종류마다 다르다 */
public abstract class TidyBaseWidget extends AppWidgetProvider {

    /** 웹의 WidgetKind ('today', 'todo', 'money', 'event', 'habit') */
    abstract String kind();

    /** 지금 날짜와 저장된 요약으로 위젯 한 장을 그린다 */
    abstract RemoteViews build(Context context);

    /** 위젯 한 장마다 다르게 그릴 때 (달력 위젯의 모드) 덮어쓴다. 기본은 홈 화면에서 고른 크기에 맞춰 글자를 키우고 줄인다 */
    RemoteViews build(Context context, int appWidgetId) {
        RemoteViews v = build(context);
        applySize(v, scaleOf(context, appWidgetId));
        return v;
    }

    /** 처음 놓을 때의 칸 수 (xml 의 targetCellWidth/Height). 이보다 크게 늘리면 글자가 커진다 */
    int baseCellsW() {
        return 2;
    }

    int baseCellsH() {
        return 2;
    }

    /** 위젯 안 글자들의 기본 크기 (sp). 없는 id 는 RemoteViews 가 그냥 건너뛴다 */
    private static final int[] TEXT_IDS = {
        R.id.widget_title, R.id.widget_count, R.id.widget_message, R.id.widget_more, R.id.widget_date, R.id.widget_brand,
        R.id.widget_progress_label, R.id.widget_money, R.id.widget_month_amount, R.id.widget_today_amount,
        R.id.widget_budget_pct, R.id.widget_budget_label,
    };
    private static final float[] TEXT_SP = {15, 12, 13, 12, 15, 12, 13, 13, 24, 13, 12, 13};
    private static final int[] ITEM_IDS = {R.id.widget_item1, R.id.widget_item2, R.id.widget_item3, R.id.widget_item4, R.id.widget_item5};
    private static final int[] EV_LABEL_IDS = {R.id.widget_ev_label1, R.id.widget_ev_label2, R.id.widget_ev_label3, R.id.widget_ev_label4, R.id.widget_ev_label5};
    private static final int[] EV_TITLE_IDS = {R.id.widget_ev_title1, R.id.widget_ev_title2, R.id.widget_ev_title3, R.id.widget_ev_title4, R.id.widget_ev_title5};

    /** 목록 한 줄 글자 크기 (sp). '오늘' 위젯만 14 */
    float itemSp() {
        return 13;
    }

    /** 한 칸을 90dp 로 보고, 처음 칸 수보다 가로 · 세로 모두 크게 늘린 만큼 글자를 키운다 (0.85 ~ 1.6배). 세로로만 늘리면 줄이 더 보인다 */
    float scaleOf(Context context, int id) {
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return 1f;
        Bundle o = AppWidgetManager.getInstance(context).getAppWidgetOptions(id);
        if (o == null) return 1f;
        // 세로 화면 기준: 가로는 MIN_WIDTH, 세로는 MAX_HEIGHT 가 실제 크기
        int w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (w <= 0 || h <= 0) return 1f;
        float s = Math.min(w / (90f * baseCellsW()), h / (90f * baseCellsH()));
        if (s < 1f) s = Math.max(0.85f, s);
        else s = Math.min(1.6f, s);
        return Math.round(s * 20) / 20f;
    }

    void applySize(RemoteViews v, float scale) {
        if (scale == 1f) return;
        for (int id : ITEM_IDS) v.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, itemSp() * scale);
        for (int i = 0; i < TEXT_IDS.length; i++) v.setTextViewTextSize(TEXT_IDS[i], TypedValue.COMPLEX_UNIT_SP, TEXT_SP[i] * scale);
        for (int id : EV_TITLE_IDS) v.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, 14 * scale);
        for (int id : EV_LABEL_IDS) {
            v.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, 13 * scale);
            if (Build.VERSION.SDK_INT >= 31) v.setViewLayoutWidth(id, 52 * scale, TypedValue.COMPLEX_UNIT_DIP);
        }
        // 메모 위젯의 + 버튼은 동그라미 크기가 정해져 있어서, 동그라미를 같이 키울 수 있는 안드로이드 12 이상에서만 키운다
        if (Build.VERSION.SDK_INT >= 31) {
            v.setTextViewTextSize(R.id.widget_add, TypedValue.COMPLEX_UNIT_SP, 20 * scale);
            v.setViewLayoutWidth(R.id.widget_add, 30 * scale, TypedValue.COMPLEX_UNIT_DIP);
            v.setViewLayoutHeight(R.id.widget_add, 30 * scale, TypedValue.COMPLEX_UNIT_DIP);
        }
    }

    /** 홈 화면에서 위젯 모서리를 끌어 크기를 바꾸면 그 크기에 맞춰 다시 그린다 */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        manager.updateAppWidget(id, build(context, id));
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context, id));
        WidgetData.scheduleMidnight(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (WidgetData.ACTION_MIDNIGHT.equals(intent.getAction())) {
            WidgetData.refreshAll(context);
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetData.scheduleMidnight(context);
    }
}
