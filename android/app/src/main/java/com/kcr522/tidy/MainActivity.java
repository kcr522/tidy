package com.kcr522.tidy;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 안에서 스크랩 사이트를 열고 화면을 캡처하는 기능 (ScrapCapturePlugin)
        registerPlugin(ScrapCapturePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
