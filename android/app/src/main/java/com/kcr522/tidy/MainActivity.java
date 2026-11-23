package com.kcr522.tidy;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 이 앱 안에 있는 플러그인은 super.onCreate 전에 등록해야 한다
        registerPlugin(TidyWidgetPlugin.class);
        // 앱 안에서 스크랩 사이트를 열고 화면을 캡처하는 기능 (ScrapCapturePlugin)
        registerPlugin(ScrapCapturePlugin.class);
        // 구글 캘린더에 Tidy 일정을 넣을 때 쓰는 구글 계정 권한 (GoogleAuthPlugin)
        registerPlugin(GoogleAuthPlugin.class);
        // 앱 잠금을 지문으로 풀기 (BiometricPlugin)
        registerPlugin(BiometricPlugin.class);
        // 앱 안에서 새 버전 내려받아 설치하기 (AppUpdatePlugin)
        registerPlugin(AppUpdatePlugin.class);
        // 인스타그램·X 등에서 "공유 → Tidy" 로 들어온 링크 받기 (ShareIntentPlugin)
        registerPlugin(ShareIntentPlugin.class);
        // 홈 화면 위젯에서 누른 곳(메모 하나, 새 메모)으로 바로 가기 (WidgetRoutePlugin)
        registerPlugin(WidgetRoutePlugin.class);
        // 결제 알림을 읽어 가계부 후보로 넘겨주기 (PayNotifyPlugin, PayNotifyService)
        registerPlugin(PayNotifyPlugin.class);
        // 삼성 캘린더(폰 캘린더) 읽고 쓰기 (DeviceCalendarPlugin)
        registerPlugin(DeviceCalendarPlugin.class);
        // 오늘 이동 기록 켜고 끄기 · 쌓인 위치 가져가기 (LocationTrackPlugin, LocationTrackService)
        registerPlugin(LocationTrackPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
