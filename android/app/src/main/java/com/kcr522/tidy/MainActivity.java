package com.kcr522.tidy;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 이 앱 안에 있는 플러그인은 super.onCreate 전에 등록해야 한다
        registerPlugin(TidyWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
