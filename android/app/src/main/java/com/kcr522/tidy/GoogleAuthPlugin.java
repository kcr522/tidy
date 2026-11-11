package com.kcr522.tidy;

import android.app.Activity;
import android.app.PendingIntent;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;

import java.util.ArrayList;
import java.util.List;

/**
 * 구글 계정으로 권한을 받아 접근 토큰을 돌려준다 (구글 캘린더에 Tidy 일정을 넣을 때).
 * 구글 플레이 서비스의 AuthorizationClient 를 쓴다. 앱 패키지 이름과 서명 열쇠(SHA-1)를
 * 구글 클라우드의 "Android" OAuth 클라이언트에 등록해 두어야 한다. 앱 안에 비밀 값은 없다.
 *
 * authorize({ scopes, interactive })
 *  - 이미 허락했으면 창 없이 바로 토큰
 *  - 처음이면 interactive 일 때만 구글 계정 고르기/허락 창을 띄운다. 아니면 { needsConsent: true }
 */
@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {
    private ActivityResultLauncher<IntentSenderRequest> launcher;
    private PluginCall pending;

    @Override
    public void load() {
        // 앱이 시작될 때(onCreate) 등록해야 한다
        launcher = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), this::onConsent);
    }

    private AuthorizationClient client() {
        return Identity.getAuthorizationClient(getActivity());
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        List<Scope> scopes = new ArrayList<>();
        try {
            List<String> list = call.getArray("scopes").toList();
            for (String s : list) scopes.add(new Scope(s));
        } catch (Exception e) {
            call.reject("scopes 가 없어요");
            return;
        }
        boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));
        AuthorizationRequest request = AuthorizationRequest.builder().setRequestedScopes(scopes).build();
        client().authorize(request)
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    PendingIntent intent = result.getPendingIntent();
                    if (!interactive || intent == null) {
                        JSObject out = new JSObject();
                        out.put("needsConsent", true);
                        call.resolve(out);
                        return;
                    }
                    if (pending != null) pending.reject("다른 로그인 창이 열려 있어요");
                    pending = call;
                    launcher.launch(new IntentSenderRequest.Builder(intent.getIntentSender()).build());
                } else {
                    resolveToken(call, result);
                }
            })
            .addOnFailureListener(e -> call.reject(message(e), e));
    }

    private void onConsent(ActivityResult r) {
        PluginCall call = pending;
        pending = null;
        if (call == null) return;
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null) {
            JSObject out = new JSObject();
            out.put("cancelled", true);
            call.resolve(out);
            return;
        }
        try {
            resolveToken(call, client().getAuthorizationResultFromIntent(r.getData()));
        } catch (ApiException e) {
            call.reject(message(e), e);
        }
    }

    private void resolveToken(PluginCall call, AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null) {
            call.reject("토큰을 받지 못했어요");
            return;
        }
        JSObject out = new JSObject();
        out.put("accessToken", token);
        call.resolve(out);
    }

    private static String message(Exception e) {
        if (e instanceof ApiException) {
            int code = ((ApiException) e).getStatusCode();
            // 10 = DEVELOPER_ERROR: 구글 클라우드에 이 앱(패키지 이름, SHA-1)이 등록되지 않았다
            if (code == 10) return "구글 클라우드에 앱 등록이 아직 안 됐어요 (코드 10)";
            return "구글 로그인 오류 (코드 " + code + ")";
        }
        return e.getMessage() != null ? e.getMessage() : "구글 로그인 오류";
    }
}
