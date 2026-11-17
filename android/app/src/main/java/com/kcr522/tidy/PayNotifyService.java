package com.kcr522.tidy;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 결제 알림 읽기: 삼성 월렛·카드사·은행·간편결제 앱(그리고 카드 결제 문자)의 알림이 오면
 * 결제처럼 보이는 것만 이 기기 안(SharedPreferences)에 모아 둔다.
 * 가계부에 바로 넣지 않는다. 앱(JS)이 목록을 읽어 사용자가 확인한 것만 저장한다.
 * 그 밖의 앱 알림(카톡 대화 등)은 읽지도 저장하지도 않는다.
 */
public class PayNotifyService extends NotificationListenerService {
    static final String PREFS = "tidy_pay_notify";
    static final String KEY_PENDING = "pending";
    static final String KEY_RECENT = "recent";
    static final String KEY_ALERT = "alert";
    static final String CHANNEL = "tidy_pay_notify";
    static final int ALERT_ID = 7301;
    static final String ACTION_OPEN = "com.kcr522.tidy.OPEN_PAY_NOTIFY";
    private static final int MAX_PENDING = 60;
    private static final long RECENT_MS = 10 * 60 * 1000L;

    /** 금액: "6,100원", "₩6,100" */
    private static final Pattern MONEY = Pattern.compile("(\\d{1,3}(,\\d{3})+|\\d{3,9})\\s*원|[₩￦]\\s*\\d");
    private static final Pattern VERB = Pattern.compile("승인|결제|사용|출금|입금|이체|지급|구매|취소|환불");
    /** 광고·혜택 알림은 빼기 */
    private static final Pattern AD = Pattern.compile("\\(광고\\)|광고|이벤트|혜택|쿠폰|추첨|당첨|최대|프로모션|캐시백\\s*받|무료|가입");
    /** 카드사·은행·간편결제 앱 패키지 이름에 흔히 들어가는 낱말 */
    private static final Pattern FIN_PKG = Pattern.compile(
            "card|pay|bank|toss|wallet|kbstar|shinhan|woori|hana|nonghyup|ibk|kakaobank|kbank|smartbank|sbanking|spay",
            Pattern.CASE_INSENSITIVE);
    /** 문자·카톡 알림은 카드사·은행 이름이 있을 때만 */
    private static final Pattern FIN_NAME = Pattern.compile("카드|은행|뱅크|페이|월렛|토스|금고|우체국|pay|bank", Pattern.CASE_INSENSITIVE);
    private static final Set<String> MESSENGERS = new HashSet<>(Arrays.asList(
            "com.samsung.android.messaging",
            "com.google.android.apps.messaging",
            "com.android.mms",
            "com.kakao.talk"));

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            // 앱 화면에서 지우는 것(PayNotifyPlugin.remove)과 겹치지 않게
            synchronized (PayNotifyService.class) {
                handle(sbn);
            }
        } catch (Exception ignored) {
            // 알림 하나를 못 읽어도 다른 알림은 계속 받는다
        }
    }

    private void handle(StatusBarNotification sbn) throws Exception {
        String pkg = sbn.getPackageName();
        if (pkg == null || pkg.equals(getPackageName()) || sbn.isOngoing()) return;
        Notification n = sbn.getNotification();
        if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        Bundle ex = n.extras;
        if (ex == null) return;
        String title = str(ex.getCharSequence(Notification.EXTRA_TITLE));
        String text = str(ex.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (text.isEmpty()) text = str(ex.getCharSequence(Notification.EXTRA_TEXT));
        String all = title + "\n" + text;
        if (!isPayment(pkg, all)) return;

        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        String key = pkg + "|" + all.trim();

        // 같은 알림이 다시 올라오면(고쳐 쓰기) 한 번만
        JSONArray recent = new JSONArray(prefs.getString(KEY_RECENT, "[]"));
        JSONArray keep = new JSONArray();
        boolean seen = false;
        for (int i = 0; i < recent.length(); i++) {
            JSONObject r = recent.getJSONObject(i);
            if (now - r.optLong("t") > RECENT_MS) continue;
            if (key.equals(r.optString("k"))) seen = true;
            keep.put(r);
        }
        if (seen) return;
        keep.put(new JSONObject().put("k", key).put("t", now));

        JSONArray pending = new JSONArray(prefs.getString(KEY_PENDING, "[]"));
        JSONObject item = new JSONObject();
        item.put("id", sbn.getPostTime() + "-" + Integer.toHexString(key.hashCode()));
        item.put("pkg", pkg);
        item.put("app", appLabel(pkg));
        item.put("title", title);
        item.put("text", text);
        item.put("postedAt", sbn.getPostTime());
        pending.put(item);
        // 너무 많이 쌓이면 오래된 것부터 버린다
        JSONArray trimmed = new JSONArray();
        for (int i = Math.max(0, pending.length() - MAX_PENDING); i < pending.length(); i++) trimmed.put(pending.get(i));

        prefs.edit().putString(KEY_RECENT, keep.toString()).putString(KEY_PENDING, trimmed.toString()).apply();

        PayNotifyPlugin.emitPosted();
        if (prefs.getBoolean(KEY_ALERT, true)) showAlert(ctx, trimmed.length(), title, text);
    }

    static boolean isPayment(String pkg, String all) {
        boolean fin = FIN_PKG.matcher(pkg).find() || (MESSENGERS.contains(pkg) && FIN_NAME.matcher(all).find());
        return fin && MONEY.matcher(all).find() && VERB.matcher(all).find() && !AD.matcher(all).find();
    }

    private String appLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(info).toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static String str(CharSequence cs) {
        return cs == null ? "" : cs.toString().trim();
    }

    /** "가계부에 기록할까요?" 알림. 누르면 앱이 열리고 확인 화면이 뜬다 */
    static void showAlert(Context ctx, int count, String title, String text) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "결제 알림 기록", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("카드 결제 알림을 가계부에 기록할지 물어봐요");
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(ACTION_OPEN);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, ALERT_ID, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String body = (title + " " + text).replaceAll("\\s+", " ").trim();
        if (body.length() > 80) body = body.substring(0, 80) + "…";
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_tidy)
                .setContentTitle(count > 1 ? "결제 " + count + "건을 가계부에 기록할까요?" : "가계부에 기록할까요?")
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body + "\n눌러서 확인하고 저장해요"))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setOnlyAlertOnce(false)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try {
            nm.notify(ALERT_ID, b.build());
        } catch (SecurityException ignored) {
            // 알림 권한이 없으면 조용히 넘어간다 (앱을 열면 가계부 화면에서 보인다)
        }
    }

    static void cancelAlert(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(ALERT_ID);
    }
}
