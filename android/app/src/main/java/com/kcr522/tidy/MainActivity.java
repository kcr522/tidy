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
        super.onCreate(savedInstanceState);
    }
}
