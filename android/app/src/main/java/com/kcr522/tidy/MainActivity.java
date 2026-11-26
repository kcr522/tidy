package com.kcr522.tidy;

import android.content.Intent;
import android.os.Bundle;

import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Collections;

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
        pushShareShortcut();
    }

    /**
     * 공유 창 맨 위 "바로 공유" 줄에 "Tidy에 스크랩"이 뜨게 바로가기를 올려 둔다 (res/xml/shortcuts.xml).
     * X 앱은 공유를 누르면 자기 앱 목록을 먼저 보여 주고, "다른 앱으로 공유"를 눌러야 안드로이드 공유 창이 뜬다.
     * 그 창에서 Tidy 를 앱 목록 아래까지 찾지 않아도 맨 위에 보이게 한다.
     * 홈 화면에서 Tidy 아이콘을 꾹 누르면 나오는 메뉴에도 같은 이름으로 보이는데, 그걸 누르면 스크랩 화면이 열린다.
     */
    private void pushShareShortcut() {
        try {
            Intent open = new Intent(Intent.ACTION_VIEW).setClass(this, MainActivity.class).putExtra(WidgetRoutePlugin.EXTRA_ROUTE, "/scraps");
            ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(this, "scrap_share")
                .setShortLabel(getString(R.string.share_label))
                .setLongLabel(getString(R.string.share_label))
                .setIcon(IconCompat.createWithResource(this, R.mipmap.ic_launcher))
                .setIntent(open)
                .setCategories(Collections.singleton("com.kcr522.tidy.category.SCRAP_SHARE"))
                .setLongLived(true)
                .build();
            ShortcutManagerCompat.pushDynamicShortcut(this, shortcut);
        } catch (Exception ignored) {
            // 바로가기를 못 올려도 앱 목록의 "Tidy에 스크랩"으로 공유할 수 있다
        }
    }
}
