package com.kcr522.tidy;

import android.Manifest;
import android.content.ContentProviderOperation;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;

/**
 * 폰 캘린더(삼성 캘린더) 읽고 쓰기 (2026-11-17).
 * 안드로이드 CalendarContract 로 폰에 있는 캘린더를 본다. 삼성 캘린더 앱도 같은 곳에 저장해서,
 * 삼성 계정 · 내 휴대전화 · 폰에 로그인한 구글 계정 캘린더가 다 여기 있다.
 *
 * - permission() / requestPermission() → { granted }
 * - calendars() → { calendars: [{ id, name, account, accountType, color, writable }] }
 * - events({ ids, from, to }) → { events: [{ key, calendarId, title, startDate, endDate, startTime?, endTime?, allDay, memo, location }] }
 *   반복 일정은 Instances 로 날짜마다 따로 나온다. key = 일정 id + ":" + 시작 시각 (같은 일정은 늘 같은 key)
 * - tidyCalendar({ create }) → { id } : Tidy 가 쓰는 "Tidy" 캘린더 (이 폰에만, 없으면 만든다)
 * - tidyEvents({ id }) → { events: [{ eventId, key, hash }] }
 * - applyTidy({ id, insert, update, remove }) : Tidy 캘린더에 넣고 고치고 지우기 (한 번에)
 * - removeTidyCalendar() : Tidy 캘린더를 통째로 지운다
 *
 * Tidy 캘린더는 "로컬 계정" 캘린더라서 Tidy 가 주인(동기화 어댑터)으로 _SYNC_ID 와 SYNC_DATA1 을 쓸 수 있다.
 * 다른 캘린더(삼성 · 구글)의 일정은 읽기만 한다.
 */
@CapacitorPlugin(
    name = "DeviceCalendar",
    permissions = { @Permission(alias = "calendar", strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR }) }
)
public class DeviceCalendarPlugin extends Plugin {
    private static final String TIDY_ACCOUNT = "Tidy";
    private static final int TIDY_COLOR = 0xFF7C5CFF;

    private boolean granted() {
        return getPermissionState("calendar") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void permission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", granted());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (granted()) {
            permission(call);
            return;
        }
        requestPermissionForAlias("calendar", call, "permissionDone");
    }

    @PermissionCallback
    private void permissionDone(PluginCall call) {
        permission(call);
    }

    private boolean check(PluginCall call) {
        if (granted()) return true;
        call.reject("캘린더 권한이 없어요", "NO_PERMISSION");
        return false;
    }

    private static Uri asSyncAdapter(Uri uri) {
        return uri.buildUpon()
            .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
            .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME, TIDY_ACCOUNT)
            .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
            .build();
    }

    @PluginMethod
    public void calendars(PluginCall call) {
        if (!check(call)) return;
        String[] cols = {
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
            CalendarContract.Calendars.ACCOUNT_NAME,
            CalendarContract.Calendars.ACCOUNT_TYPE,
            CalendarContract.Calendars.CALENDAR_COLOR,
            CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL,
            CalendarContract.Calendars.VISIBLE,
        };
        JSArray list = new JSArray();
        try (Cursor c = getContext().getContentResolver().query(CalendarContract.Calendars.CONTENT_URI, cols, null, null, CalendarContract.Calendars._ID)) {
            while (c != null && c.moveToNext()) {
                JSObject o = new JSObject();
                o.put("id", String.valueOf(c.getLong(0)));
                o.put("name", c.isNull(1) ? "" : c.getString(1));
                o.put("account", c.isNull(2) ? "" : c.getString(2));
                o.put("accountType", c.isNull(3) ? "" : c.getString(3));
                o.put("color", String.format("#%06x", c.getInt(4) & 0xFFFFFF));
                o.put("writable", c.getInt(5) >= CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR);
                o.put("visible", c.getInt(6) == 1);
                list.put(o);
            }
        } catch (Exception e) {
            call.reject("캘린더 목록을 읽지 못했어요: " + e.getMessage());
            return;
        }
        JSObject ret = new JSObject();
        ret.put("calendars", list);
        call.resolve(ret);
    }

    private static SimpleDateFormat fmt(String p, TimeZone tz) {
        SimpleDateFormat f = new SimpleDateFormat(p, Locale.US);
        f.setTimeZone(tz);
        return f;
    }

    @PluginMethod
    public void events(PluginCall call) {
        if (!check(call)) return;
        JSArray ids = call.getArray("ids", new JSArray());
        long from = call.getLong("from", System.currentTimeMillis());
        long to = call.getLong("to", System.currentTimeMillis());
        ArrayList<String> idList = new ArrayList<>();
        StringBuilder where = new StringBuilder();
        try {
            for (int i = 0; i < ids.length(); i++) {
                String id = ids.getString(i);
                if (!id.matches("\\d+")) continue;
                idList.add(id);
                where.append(where.length() == 0 ? "" : ",").append("?");
            }
        } catch (Exception e) {
            call.reject("캘린더 번호가 이상해요");
            return;
        }
        JSArray list = new JSArray();
        if (!idList.isEmpty()) {
            Uri.Builder b = CalendarContract.Instances.CONTENT_URI.buildUpon();
            ContentUris.appendId(b, from);
            ContentUris.appendId(b, to);
            String[] cols = {
                CalendarContract.Instances.EVENT_ID,
                CalendarContract.Instances.CALENDAR_ID,
                CalendarContract.Instances.TITLE,
                CalendarContract.Instances.BEGIN,
                CalendarContract.Instances.END,
                CalendarContract.Instances.ALL_DAY,
                CalendarContract.Instances.DESCRIPTION,
                CalendarContract.Instances.EVENT_LOCATION,
            };
            String sel = CalendarContract.Instances.CALENDAR_ID + " IN (" + where + ") AND " + CalendarContract.Instances.STATUS + " IS NOT " + CalendarContract.Events.STATUS_CANCELED;
            // STATUS 가 null 인 일정도 있어서 IS NOT 로 거른다
            TimeZone utc = TimeZone.getTimeZone("UTC");
            TimeZone local = TimeZone.getDefault();
            SimpleDateFormat dayUtc = fmt("yyyy-MM-dd", utc);
            SimpleDateFormat dayLocal = fmt("yyyy-MM-dd", local);
            SimpleDateFormat time = fmt("HH:mm", local);
            try (Cursor c = getContext().getContentResolver().query(b.build(), cols, sel, idList.toArray(new String[0]), CalendarContract.Instances.BEGIN)) {
                while (c != null && c.moveToNext()) {
                    long begin = c.getLong(3);
                    long end = c.isNull(4) ? begin : c.getLong(4);
                    boolean allDay = c.getInt(5) == 1;
                    JSObject o = new JSObject();
                    o.put("key", c.getLong(0) + ":" + begin);
                    o.put("calendarId", String.valueOf(c.getLong(1)));
                    o.put("title", c.isNull(2) ? "" : c.getString(2));
                    o.put("allDay", allDay);
                    if (allDay) {
                        // 하루 종일 일정은 UTC 자정으로 저장되고 끝은 다음 날 0시 (그날은 빼야 한다)
                        o.put("startDate", dayUtc.format(begin));
                        o.put("endDate", dayUtc.format(Math.max(begin, end - 1)));
                    } else {
                        o.put("startDate", dayLocal.format(begin));
                        o.put("endDate", dayLocal.format(Math.max(begin, end - 1)));
                        o.put("startTime", time.format(begin));
                        o.put("endTime", time.format(end));
                    }
                    o.put("memo", c.isNull(6) ? "" : c.getString(6));
                    o.put("location", c.isNull(7) ? "" : c.getString(7));
                    list.put(o);
                }
            } catch (Exception e) {
                call.reject("일정을 읽지 못했어요: " + e.getMessage());
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("events", list);
        call.resolve(ret);
    }

    private long findTidyCalendar(ContentResolver cr) {
        String sel = CalendarContract.Calendars.ACCOUNT_NAME + " = ? AND " + CalendarContract.Calendars.ACCOUNT_TYPE + " = ?";
        try (Cursor c = cr.query(CalendarContract.Calendars.CONTENT_URI, new String[] { CalendarContract.Calendars._ID }, sel, new String[] { TIDY_ACCOUNT, CalendarContract.ACCOUNT_TYPE_LOCAL }, null)) {
            if (c != null && c.moveToFirst()) return c.getLong(0);
        }
        return -1;
    }

    @PluginMethod
    public void tidyCalendar(PluginCall call) {
        if (!check(call)) return;
        ContentResolver cr = getContext().getContentResolver();
        try {
            long id = findTidyCalendar(cr);
            if (id < 0 && call.getBoolean("create", true)) {
                ContentValues v = new ContentValues();
                v.put(CalendarContract.Calendars.ACCOUNT_NAME, TIDY_ACCOUNT);
                v.put(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL);
                v.put(CalendarContract.Calendars.NAME, "tidy");
                v.put(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, "Tidy");
                v.put(CalendarContract.Calendars.CALENDAR_COLOR, TIDY_COLOR);
                v.put(CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL, CalendarContract.Calendars.CAL_ACCESS_OWNER);
                v.put(CalendarContract.Calendars.OWNER_ACCOUNT, TIDY_ACCOUNT);
                v.put(CalendarContract.Calendars.VISIBLE, 1);
                v.put(CalendarContract.Calendars.SYNC_EVENTS, 1);
                v.put(CalendarContract.Calendars.CALENDAR_TIME_ZONE, TimeZone.getDefault().getID());
                Uri uri = cr.insert(asSyncAdapter(CalendarContract.Calendars.CONTENT_URI), v);
                id = uri == null ? -1 : ContentUris.parseId(uri);
            }
            JSObject ret = new JSObject();
            if (id >= 0) ret.put("id", String.valueOf(id));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Tidy 캘린더를 만들지 못했어요: " + e.getMessage());
        }
    }

    @PluginMethod
    public void tidyEvents(PluginCall call) {
        if (!check(call)) return;
        String id = call.getString("id", "");
        JSArray list = new JSArray();
        String[] cols = { CalendarContract.Events._ID, CalendarContract.Events._SYNC_ID, CalendarContract.Events.SYNC_DATA1 };
        try (Cursor c = getContext().getContentResolver().query(asSyncAdapter(CalendarContract.Events.CONTENT_URI), cols, CalendarContract.Events.CALENDAR_ID + " = ? AND " + CalendarContract.Events.DELETED + " = 0", new String[] { id }, null)) {
            while (c != null && c.moveToNext()) {
                JSObject o = new JSObject();
                o.put("eventId", String.valueOf(c.getLong(0)));
                o.put("key", c.isNull(1) ? "" : c.getString(1));
                o.put("hash", c.isNull(2) ? "" : c.getString(2));
                list.put(o);
            }
        } catch (Exception e) {
            call.reject("Tidy 캘린더를 읽지 못했어요: " + e.getMessage());
            return;
        }
        JSObject ret = new JSObject();
        ret.put("events", list);
        call.resolve(ret);
    }

    /** { key, hash, title, memo, startDate, endDate } → 하루 종일 일정 값 */
    private static ContentValues valuesOf(JSONObject o, long calendarId) throws Exception {
        TimeZone utc = TimeZone.getTimeZone("UTC");
        SimpleDateFormat day = fmt("yyyy-MM-dd", utc);
        long start = day.parse(o.getString("startDate")).getTime();
        long endDay = day.parse(o.getString("endDate")).getTime();
        Calendar cal = Calendar.getInstance(utc);
        cal.setTimeInMillis(Math.max(start, endDay));
        cal.add(Calendar.DAY_OF_MONTH, 1);
        ContentValues v = new ContentValues();
        v.put(CalendarContract.Events.CALENDAR_ID, calendarId);
        v.put(CalendarContract.Events.TITLE, o.optString("title", ""));
        v.put(CalendarContract.Events.DESCRIPTION, o.optString("memo", ""));
        v.put(CalendarContract.Events.DTSTART, start);
        v.put(CalendarContract.Events.DTEND, cal.getTimeInMillis());
        v.put(CalendarContract.Events.ALL_DAY, 1);
        v.put(CalendarContract.Events.EVENT_TIMEZONE, "UTC");
        v.put(CalendarContract.Events._SYNC_ID, o.getString("key"));
        v.put(CalendarContract.Events.SYNC_DATA1, o.optString("hash", ""));
        return v;
    }

    @PluginMethod
    public void applyTidy(PluginCall call) {
        if (!check(call)) return;
        long calendarId;
        try {
            calendarId = Long.parseLong(call.getString("id", ""));
        } catch (Exception e) {
            call.reject("Tidy 캘린더 번호가 없어요");
            return;
        }
        ArrayList<ContentProviderOperation> ops = new ArrayList<>();
        Uri events = asSyncAdapter(CalendarContract.Events.CONTENT_URI);
        try {
            JSONArray insert = call.getArray("insert", new JSArray());
            for (int i = 0; i < insert.length(); i++) ops.add(ContentProviderOperation.newInsert(events).withValues(valuesOf(insert.getJSONObject(i), calendarId)).build());
            JSONArray update = call.getArray("update", new JSArray());
            for (int i = 0; i < update.length(); i++) {
                JSONObject o = update.getJSONObject(i);
                Uri one = asSyncAdapter(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, Long.parseLong(o.getString("eventId"))));
                ops.add(ContentProviderOperation.newUpdate(one).withValues(valuesOf(o, calendarId)).build());
            }
            JSONArray remove = call.getArray("remove", new JSArray());
            for (int i = 0; i < remove.length(); i++) {
                Uri one = asSyncAdapter(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, Long.parseLong(remove.getString(i))));
                ops.add(ContentProviderOperation.newDelete(one).build());
            }
            if (!ops.isEmpty()) getContext().getContentResolver().applyBatch(CalendarContract.AUTHORITY, ops);
        } catch (Exception e) {
            call.reject("Tidy 캘린더에 넣지 못했어요: " + e.getMessage());
            return;
        }
        JSObject ret = new JSObject();
        ret.put("count", ops.size());
        call.resolve(ret);
    }

    @PluginMethod
    public void removeTidyCalendar(PluginCall call) {
        if (!check(call)) return;
        ContentResolver cr = getContext().getContentResolver();
        try {
            long id = findTidyCalendar(cr);
            if (id >= 0) cr.delete(asSyncAdapter(ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, id)), null, null);
            call.resolve();
        } catch (Exception e) {
            call.reject("Tidy 캘린더를 지우지 못했어요: " + e.getMessage());
        }
    }
}
