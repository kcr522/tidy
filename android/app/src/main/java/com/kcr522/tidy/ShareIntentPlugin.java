package com.kcr522.tidy;

import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;

/**
 * 다른 앱의 "공유"로 들어온 것을 앱 화면(JS)에 넘겨준다.
 * - "Tidy에 스크랩"(MainActivity): 인스타그램·X 등의 링크(글)
 * - "Tidy 메모"(MemoShare 별칭): 삼성 노트 등에서 보낸 글 · 사진 · 파일 → 새 메모 (사용자 요청 2026-11-17)
 *   파일은 앱 임시 폴더에 복사해 경로만 넘긴다 (큰 파일을 글자로 바꿔 넘기면 느리고 멈출 수 있어서)
 * - 앱이 꺼져 있다가 공유로 켜지면: 화면이 뜬 뒤 take()로 가져간다
 * - 앱이 켜져 있으면: "shared" 이벤트를 보내고, 화면이 take()로 가져간다
 */
@CapacitorPlugin(name = "ShareIntent")
public class ShareIntentPlugin extends Plugin {
    /** 공유받은 파일 하나 최대 크기 (메모 첨부 한도와 같게) */
    private static final long MAX_FILE_BYTES = 50L * 1024 * 1024;
    private static final int MAX_FILES = 10;

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

    /** 공유로 들어온 것을 꺼내 간다 (한 번 꺼내면 비운다) */
    @PluginMethod
    public void take(PluginCall call) {
        JSObject out = pending != null ? pending : new JSObject();
        pending = null;
        call.resolve(out);
    }

    private boolean capture(Intent intent) {
        if (intent == null) return false;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return false;
        ComponentName comp = intent.getComponent();
        boolean memo = comp != null && comp.getClassName().endsWith(".MemoShare");
        String type = intent.getType();
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);

        JSObject data = new JSObject();
        data.put("text", text != null ? text.toString() : "");
        data.put("title", subject != null ? subject : "");
        if (memo) {
            data.put("target", "memo");
            data.put("files", copyStreams(intent, action));
        } else if (type == null || !type.startsWith("text/") || (text == null && subject == null)) {
            return false;
        }
        pending = data;
        // 같은 공유를 두 번 처리하지 않게 (화면을 돌리거나 다시 열 때)
        intent.setAction(Intent.ACTION_MAIN);
        return true;
    }

    @SuppressWarnings("deprecation")
    private JSArray copyStreams(Intent intent, String action) {
        ArrayList<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> list = Build.VERSION.SDK_INT >= 33 ? intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class) : intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) uris.addAll(list);
        } else {
            Uri one = Build.VERSION.SDK_INT >= 33 ? intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class) : intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (one != null) uris.add(one);
        }
        JSArray out = new JSArray();
        File dir = new File(getContext().getCacheDir(), "shared");
        if (!dir.exists()) dir.mkdirs();
        // 지난번 공유 파일은 지운다
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) f.delete();
        ContentResolver cr = getContext().getContentResolver();
        int n = 0;
        for (Uri uri : uris) {
            if (n >= MAX_FILES) break;
            try {
                String name = displayName(cr, uri);
                String type = cr.getType(uri);
                File dest = new File(dir, (n + 1) + "-" + name.replaceAll("[\\\\/:*?\"<>|]", "_"));
                long size = 0;
                boolean tooBig = false;
                try (InputStream in = cr.openInputStream(uri); OutputStream os = new FileOutputStream(dest)) {
                    if (in == null) continue;
                    byte[] buf = new byte[64 * 1024];
                    int r;
                    while ((r = in.read(buf)) > 0) {
                        size += r;
                        if (size > MAX_FILE_BYTES) {
                            tooBig = true;
                            break;
                        }
                        os.write(buf, 0, r);
                    }
                }
                JSObject f = new JSObject();
                f.put("name", name);
                f.put("type", type != null ? type : "application/octet-stream");
                if (tooBig) {
                    dest.delete();
                    f.put("tooBig", true);
                } else {
                    f.put("path", dest.getAbsolutePath());
                    f.put("size", size);
                }
                out.put(f);
                n++;
            } catch (Exception ignored) {
                // 못 읽은 파일은 건너뛴다
            }
        }
        return out;
    }

    private static String displayName(ContentResolver cr, Uri uri) {
        try (Cursor c = cr.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                String s = c.getString(0);
                if (s != null && !s.isEmpty()) return s;
            }
        } catch (Exception ignored) {
            // 이름을 못 알아내면 아래로
        }
        String last = uri.getLastPathSegment();
        return last != null && !last.isEmpty() ? last : "공유받은 파일";
    }
}
