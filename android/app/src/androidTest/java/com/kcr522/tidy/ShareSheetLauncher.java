package com.kcr522.tidy;

import android.content.Context;
import android.content.Intent;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

/** X 앱의 "다른 앱으로 공유"처럼 링크 글을 안드로이드 공유 창으로 보낸다 (에뮬레이터 확인용) */
@RunWith(AndroidJUnit4.class)
public class ShareSheetLauncher {
    @Test
    public void openShareSheet() {
        Context ctx = InstrumentationRegistry.getInstrumentation().getContext();
        Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "https://x.com/jack/status/20?s=46&t=Tidy_share_check");
        ctx.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }
}
