package com.kcr522.tidy;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 인스타그램·X 등에서 "공유 → Tidy"를 누르면 들어오는 글(링크)을 앱 화면(JS)에 넘겨준다.
 * - 앱이 꺼져 있다가 공유로 켜지면: 화면이 뜬 뒤 take()로 가져간다
 * - 앱이 켜져 있으면: "shared" 이벤트를 보내고, 화면이 take()로 가져간다
 */
@CapacitorPlugin(name = "ShareIntent")
public class ShareIntentPlugin extends Plugin {
    private JSObject pending;

    @Override
    public void load() {
        capture(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (capture(intent)) notifyListeners("shared", new JSObject(), true);
    }

    /** 공유로 들어온 글을 꺼내 간다 (한 번 꺼내면 비운다) */
    @PluginMethod
    public void take(PluginCall call) {
        JSObject out = pending != null ? pending : new JSObject();
        pending = null;
        call.resolve(out);
    }

    private boolean capture(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return false;
        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) return false;
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (text == null && subject == null) return false;
        JSObject data = new JSObject();
        data.put("text", text != null ? text.toString() : "");
        data.put("title", subject != null ? subject : "");
        pending = data;
        // 같은 공유를 두 번 처리하지 않게 (화면을 돌리거나 다시 열 때)
        intent.setAction(Intent.ACTION_MAIN);
        return true;
    }
}
