package com.kcr522.tidy;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 앱 안에서 바로 업데이트하기 (2026-11-12).
 * 새 APK 를 폰이 직접 내려받고, 안드로이드 설치 화면을 띄운다. 설치(덮어 깔기)는 사용자가 "업데이트"를 눌러야 된다.
 * 처음 한 번은 "이 앱에서 설치 허용" 설정 화면이 뜨고, 허용하고 돌아오면 바로 설치 화면으로 넘어간다.
 *
 * info() → { versionCode, versionName }
 * download({ url }) → { ok } 또는 { error }. 받는 동안 "progress" 이벤트 { percent, received, total }
 * install() → { status: 'installing' | 'permission' | 'missing' }
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private static final String FILE_NAME = "tidy-update.apk";
    /** 설치 허용 설정에 다녀오면 설치 화면을 띄운다 */
    private boolean waitingForPermission = false;

    private File apkFile() {
        return new File(getContext().getCacheDir(), FILE_NAME);
    }

    @SuppressWarnings("deprecation")
    private PackageInfo selfInfo() throws PackageManager.NameNotFoundException {
        PackageManager pm = getContext().getPackageManager();
        return pm.getPackageInfo(getContext().getPackageName(), 0);
    }

    @SuppressWarnings("deprecation")
    private static long codeOf(PackageInfo p) {
        return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
    }

    @PluginMethod
    public void info(PluginCall call) {
        try {
            PackageInfo p = selfInfo();
            JSObject ret = new JSObject();
            ret.put("versionCode", codeOf(p));
            ret.put("versionName", p.versionName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("버전을 읽지 못했어요");
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || !url.startsWith("https://")) {
            call.reject("주소가 맞지 않아요");
            return;
        }
        new Thread(() -> {
            File tmp = new File(getContext().getCacheDir(), FILE_NAME + ".part");
            HttpURLConnection conn = null;
            try {
                // 서버(/api/app-update)가 GitHub 의 진짜 파일 주소로 넘겨준다 (https → https 라서 따라간다)
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(60000);
                int code = conn.getResponseCode();
                if (code != 200) throw new Exception("파일을 받지 못했어요 (" + code + ")");
                long total = conn.getContentLengthLong();
                long received = 0;
                int lastPercent = -1;
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        received += n;
                        int percent = total > 0 ? (int) (received * 100 / total) : -1;
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            JSObject p = new JSObject();
                            p.put("percent", percent);
                            p.put("received", received);
                            p.put("total", total);
                            notifyListeners("progress", p);
                        }
                    }
                }
                if (total > 0 && received != total) throw new Exception("파일을 끝까지 받지 못했어요");
                checkApk(tmp);
                File dest = apkFile();
                if (dest.exists()) dest.delete();
                if (!tmp.renameTo(dest)) throw new Exception("파일을 저장하지 못했어요");
                JSObject ret = new JSObject();
                ret.put("ok", true);
                call.resolve(ret);
            } catch (Exception e) {
                tmp.delete();
                String msg = e.getMessage();
                if (e instanceof java.io.IOException) msg = "인터넷 연결을 확인해 주세요";
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("error", msg == null ? "내려받지 못했어요" : msg);
                call.resolve(ret);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    /** 받은 파일이 정말 Tidy 의 더 새 버전인지 확인한다 (다른 앱이나 깨진 파일이면 설치하지 않는다) */
    @SuppressWarnings("deprecation")
    private void checkApk(File f) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        PackageInfo p = pm.getPackageArchiveInfo(f.getAbsolutePath(), 0);
        if (p == null) throw new Exception("받은 파일이 앱 파일이 아니에요");
        if (!getContext().getPackageName().equals(p.packageName)) throw new Exception("Tidy 앱 파일이 아니에요");
        if (codeOf(p) <= codeOf(selfInfo())) throw new Exception("이미 최신 버전이에요");
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }

    @PluginMethod
    public void install(PluginCall call) {
        JSObject ret = new JSObject();
        if (!apkFile().exists()) {
            ret.put("status", "missing");
            call.resolve(ret);
            return;
        }
        if (!canInstall()) {
            // 처음 한 번: "이 출처의 앱 설치 허용" 화면. 허용하고 돌아오면 handleOnResume 에서 설치 화면을 띄운다
            waitingForPermission = true;
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            ret.put("status", "permission");
            call.resolve(ret);
            return;
        }
        openInstaller();
        ret.put("status", "installing");
        call.resolve(ret);
    }

    private void openInstaller() {
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apkFile());
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (!waitingForPermission) return;
        waitingForPermission = false;
        if (canInstall() && apkFile().exists()) openInstaller();
        else notifyListeners("permissionDenied", new JSObject());
    }
}
