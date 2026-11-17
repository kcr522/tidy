package com.kcr522.tidy;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** 홈 화면 위젯 공통: 그리는 것(build)만 종류마다 다르다 */
public abstract class TidyBaseWidget extends AppWidgetProvider {

    /** 웹의 WidgetKind ('today', 'todo', 'money', 'event', 'habit') */
    abstract String kind();

    /** 지금 날짜와 저장된 요약으로 위젯 한 장을 그린다 */
    abstract RemoteViews build(Context context);

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context));
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
