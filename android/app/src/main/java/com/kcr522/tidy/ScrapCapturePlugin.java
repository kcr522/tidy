package com.kcr522.tidy;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Base64;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;

/**
 * 스크랩 링크를 앱 안 화면(WebView)으로 열고, 보이는 화면을 그대로 찍어 돌려준다.
 * 찍은 사진은 웹 쪽 사진 편집기에서 자른다.
 * 따로 라이브러리를 쓰지 않아 앱 크기는 거의 그대로다.
 */
@CapacitorPlugin(name = "ScrapCapture")
public class ScrapCapturePlugin extends Plugin {

    private static final int BRAND = Color.parseColor("#3182f6");

    private Dialog dialog;

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        // "capture": 저장 직후 캡처하러 들어온 경우, "view": 게시물·동영상을 앱 안에서 보려고 연 경우
        boolean viewMode = "view".equals(call.getString("mode"));
        if (TextUtils.isEmpty(url)) {
            call.reject("주소가 없어요");
            return;
        }
        Activity activity = getActivity();
        activity.runOnUiThread(() -> show(activity, call, url, viewMode));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void show(Activity activity, PluginCall call, String url, boolean viewMode) {
        if (dialog != null) dialog.dismiss();
        final boolean[] done = {false};
        // 동영상 전체 화면
        final View[] fullView = {null};
        final WebChromeClient.CustomViewCallback[] fullCb = {null};

        Dialog d = new Dialog(activity, android.R.style.Theme_DeviceDefault_Light_NoActionBar);
        dialog = d;
        float dp = activity.getResources().getDisplayMetrics().density;

        LinearLayout root = new LinearLayout(activity);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);

        // 위: 닫기 + 사이트 주소
        LinearLayout top = new LinearLayout(activity);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(px(dp, 4), px(dp, 4), px(dp, 12), px(dp, 4));
        Button close = new Button(activity, null, android.R.attr.borderlessButtonStyle);
        close.setText("✕");
        close.setTextSize(20);
        close.setTextColor(Color.parseColor("#4e5968"));
        close.setContentDescription("닫기");
        top.addView(close, new LinearLayout.LayoutParams(px(dp, 48), px(dp, 48)));
        TextView title = new TextView(activity);
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        title.setTextSize(14);
        title.setTextColor(Color.parseColor("#191f28"));
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setText(hostOf(url));
        top.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        root.addView(top, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        ProgressBar progress = new ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(dp, 3)));

        // 가운데: 사이트
        final FrameLayout frame = new FrameLayout(activity);
        WebView web = new WebView(activity);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                // instagram://, intent:// 같은 앱 주소는 무시하고 이 화면 안에 머문다
                return scheme == null || !(scheme.equals("http") || scheme.equals("https"));
            }

            @Override
            public void onPageFinished(WebView view, String u) {
                title.setText(TextUtils.isEmpty(view.getTitle()) ? hostOf(u) : view.getTitle());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                progress.setProgress(p);
                progress.setVisibility(p >= 100 ? View.INVISIBLE : View.VISIBLE);
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullView[0] != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullView[0] = view;
                fullCb[0] = callback;
                view.setBackgroundColor(Color.BLACK);
                frame.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            }

            @Override
            public void onHideCustomView() {
                if (fullView[0] == null) return;
                frame.removeView(fullView[0]);
                fullView[0] = null;
                if (fullCb[0] != null) fullCb[0].onCustomViewHidden();
                fullCb[0] = null;
            }
        });
        frame.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(frame, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        // 아래: 안내 + 캡처 버튼
        LinearLayout bottom = new LinearLayout(activity);
        bottom.setOrientation(LinearLayout.VERTICAL);
        bottom.setPadding(px(dp, 16), px(dp, 10), px(dp, 16), px(dp, 12));
        bottom.setBackgroundColor(Color.WHITE);
        TextView hint = new TextView(activity);
        hint.setText(viewMode
                ? "동영상도 여기서 바로 볼 수 있어요. 남기고 싶은 장면은 캡처하세요."
                : "남기고 싶은 부분이 보이게 움직인 뒤 눌러 주세요. 다음 화면에서 자를 수 있어요.");
        hint.setTextSize(13);
        hint.setTextColor(Color.parseColor("#8b95a1"));
        hint.setGravity(Gravity.CENTER);
        bottom.addView(hint);
        Button shoot = new Button(activity);
        shoot.setText("📸  이 화면 캡처하기");
        shoot.setTextSize(16);
        shoot.setTypeface(Typeface.DEFAULT_BOLD);
        shoot.setTextColor(Color.WHITE);
        shoot.setAllCaps(false);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(BRAND);
        bg.setCornerRadius(px(dp, 16));
        shoot.setBackground(bg);
        LinearLayout.LayoutParams shootLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(dp, 52));
        shootLp.topMargin = px(dp, 8);
        bottom.addView(shoot, shootLp);
        root.addView(bottom, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // 상태 표시줄·내비게이션 바에 가리지 않게
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int t, b;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                t = i.top;
                b = i.bottom;
            } else {
                t = insets.getSystemWindowInsetTop();
                b = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(0, t, 0, b);
            return insets;
        });

        d.setContentView(root);
        Window w = d.getWindow();
        if (w != null) {
            w.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            w.setStatusBarColor(Color.WHITE);
            w.setNavigationBarColor(Color.WHITE);
            if (Build.VERSION.SDK_INT >= 23) w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        // 뒤로 가기: 사이트 안에서 먼저 뒤로, 더 갈 곳이 없으면 닫기
        d.setOnKeyListener((di, keyCode, event) -> {
            if (keyCode == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
                if (fullView[0] != null) {
                    frame.removeView(fullView[0]);
                    fullView[0] = null;
                    WebChromeClient.CustomViewCallback cb = fullCb[0];
                    fullCb[0] = null;
                    if (cb != null) cb.onCustomViewHidden();
                } else if (web.canGoBack()) web.goBack();
                else d.cancel();
                return true;
            }
            return keyCode == KeyEvent.KEYCODE_BACK;
        });
        d.setOnDismissListener((di) -> {
            if (!done[0]) {
                done[0] = true;
                JSObject r = new JSObject();
                r.put("cancelled", true);
                call.resolve(r);
            }
            web.stopLoading();
            web.destroy();
            if (dialog == d) dialog = null;
        });
        close.setOnClickListener((v) -> d.cancel());

        shoot.setOnClickListener((v) -> {
            shoot.setEnabled(false);
            capture(d, web, (bitmap) -> {
                if (bitmap == null) {
                    shoot.setEnabled(true);
                    return;
                }
                String b64 = toBase64(bitmap);
                bitmap.recycle();
                done[0] = true;
                JSObject r = new JSObject();
                r.put("cancelled", false);
                r.put("image", b64);
                r.put("mime", "image/jpeg");
                r.put("pageUrl", web.getUrl());
                call.resolve(r);
                d.dismiss();
            });
        });

        d.show();
        web.loadUrl(url);
    }

    private interface BitmapCallback {
        void onBitmap(Bitmap b);
    }

    /** 화면에 보이는 그대로 찍는다. 동영상도 같이 찍히도록 PixelCopy(안드로이드 8+)를 먼저 쓴다 */
    private void capture(Dialog d, WebView web, BitmapCallback cb) {
        int w = web.getWidth();
        int h = web.getHeight();
        if (w <= 0 || h <= 0) {
            cb.onBitmap(null);
            return;
        }
        Window window = d.getWindow();
        if (Build.VERSION.SDK_INT >= 26 && window != null) {
            int[] loc = new int[2];
            web.getLocationInWindow(loc);
            Rect rect = new Rect(loc[0], loc[1], loc[0] + w, loc[1] + h);
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            try {
                PixelCopy.request(window, rect, bmp, (result) -> {
                    if (result == PixelCopy.SUCCESS) cb.onBitmap(bmp);
                    else {
                        bmp.recycle();
                        cb.onBitmap(drawCapture(web));
                    }
                }, new Handler(Looper.getMainLooper()));
                return;
            } catch (IllegalArgumentException e) {
                bmp.recycle();
            }
        }
        cb.onBitmap(drawCapture(web));
    }

    private Bitmap drawCapture(WebView web) {
        try {
            Bitmap bmp = Bitmap.createBitmap(web.getWidth(), web.getHeight(), Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bmp);
            c.drawColor(Color.WHITE);
            web.draw(c);
            return bmp;
        } catch (Throwable t) {
            return null;
        }
    }

    private static String toBase64(Bitmap b) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.JPEG, 90, out);
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    private static String hostOf(String url) {
        try {
            String h = Uri.parse(url).getHost();
            return h == null ? url : h;
        } catch (Exception e) {
            return url;
        }
    }

    private static int px(float density, int dp) {
        return Math.round(dp * density);
    }
}
