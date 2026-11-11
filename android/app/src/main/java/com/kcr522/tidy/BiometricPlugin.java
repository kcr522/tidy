package com.kcr522.tidy;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 앱 잠금을 지문으로 풀기 (2026-11-11).
 * 안드로이드의 BiometricPrompt 를 띄운다. 지문 자체는 앱이 보지 못하고, 기기가 "맞다/아니다"만 알려 준다.
 * 기기에 등록된 지문(또는 얼굴)이 있어야 쓸 수 있다.
 *
 * available() → { available, reason }
 *  reason: none(지문 센서 없음) / not-enrolled(등록된 지문 없음) / unavailable(잠시 못 씀)
 * authenticate({ title, subtitle, cancel }) → { ok } 또는 { cancelled } 또는 { error }
 */
@CapacitorPlugin(name = "Biometric")
public class BiometricPlugin extends Plugin {
    private static final int AUTH = BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @PluginMethod
    public void available(PluginCall call) {
        int r = BiometricManager.from(getContext()).canAuthenticate(AUTH);
        JSObject ret = new JSObject();
        ret.put("available", r == BiometricManager.BIOMETRIC_SUCCESS);
        String reason = "unavailable";
        if (r == BiometricManager.BIOMETRIC_SUCCESS) reason = "ok";
        else if (r == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE) reason = "none";
        else if (r == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) reason = "not-enrolled";
        ret.put("reason", reason);
        call.resolve(ret);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        String title = call.getString("title", "Tidy 잠금 풀기");
        String subtitle = call.getString("subtitle", "지문을 대 주세요");
        String cancel = call.getString("cancel", "비밀번호로 풀기");
        FragmentActivity activity = getActivity();
        activity.runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    call.resolve(ret);
                }

                @Override
                public void onAuthenticationError(int code, @NonNull CharSequence message) {
                    JSObject ret = new JSObject();
                    ret.put("ok", false);
                    boolean cancelled = code == BiometricPrompt.ERROR_USER_CANCELED || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON || code == BiometricPrompt.ERROR_CANCELED;
                    if (cancelled) ret.put("cancelled", true);
                    else ret.put("error", message.toString());
                    call.resolve(ret);
                }

                // 지문이 한 번 틀린 것 (창은 그대로 떠 있고 다시 댈 수 있다): 아무것도 안 한다
            });
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setNegativeButtonText(cancel)
                    .setAllowedAuthenticators(AUTH)
                    .build();
            try {
                prompt.authenticate(info);
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            }
        });
    }
}
