package com.kcr522.tidy;

import static org.junit.Assert.assertEquals;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * 실제 폰(또는 에뮬레이터)에서 도는 테스트.
 * 패키지 이름이 바뀌면 Google 로그인(OAuth 클라이언트)과 기존 앱 위 업데이트 설치가 깨지므로 확인한다.
 */
@RunWith(AndroidJUnit4.class)
public class AppPackageTest {

    // android/app/build.gradle 의 applicationId, Google Cloud OAuth 클라이언트에 등록한 이름
    private static final String TIDY_PACKAGE = "com.kcr522.tidy";

    @Test
    public void installedAppKeepsTidyPackageName() {
        Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();

        String packageName = app.getPackageName();

        assertEquals(TIDY_PACKAGE, packageName);
    }
}
