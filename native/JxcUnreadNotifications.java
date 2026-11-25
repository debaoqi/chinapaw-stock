package com.chinapaw.stock;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONArray;
import java.util.ArrayList;

/** Shared by the WebView bridge and FCM, including when the WebView process is absent. */
public final class JxcUnreadNotifications {
    private JxcUnreadNotifications() {}
    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences("jxc-push", Context.MODE_PRIVATE); }

    public static synchronized void setUser(Context c, String user) {
        if (!user.equals(prefs(c).getString("user", ""))) {
            prefs(c).edit().putString("user", user).putInt("unread", 0).putString("events", "[]").apply();
            show(c, 0, "", true);
        }
    }

    public static synchronized void remote(Context c, String user, String event, String text) {
        if (user.isEmpty() || !user.equals(prefs(c).getString("user", ""))) return;
        ArrayList<String> seen = new ArrayList<>();
        try { JSONArray a = new JSONArray(prefs(c).getString("events", "[]")); for (int i=0;i<a.length();i++) seen.add(a.getString(i)); } catch (Exception ignored) {}
        if (seen.contains(event)) return;
        seen.add(event); while (seen.size()>200) seen.remove(0);
        prefs(c).edit().putString("events", new JSONArray(seen).toString()).apply();
        show(c, prefs(c).getInt("unread", 0) + 1, text, false);
    }

    public static synchronized boolean show(Context c, int count, String text, boolean onlyOnce) {
        count=Math.max(0,count); prefs(c).edit().putInt("unread",count).apply();
        NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
        if(nm==null)return false;
        if(count==0){nm.cancel(1800);return true;}
        if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;
        String channel="jxc-unread-v1";
        if(Build.VERSION.SDK_INT>=26){NotificationChannel ch=new NotificationChannel(channel,"未读消息与业务提交",NotificationManager.IMPORTANCE_DEFAULT);ch.setShowBadge(true);nm.createNotificationChannel(ch);}
        Intent intent=c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());if(intent==null)return false;
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open=PendingIntent.getActivity(c,1800,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(c,channel):new Notification.Builder(c);
        b.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("华宝进销存 · 未读提醒")
            .setContentText(text.isEmpty()?count+" 条未读消息 / 业务通知":text).setNumber(count)
            .setContentIntent(open).setOnlyAlertOnce(onlyOnce).setAutoCancel(false)
            .setCategory(Notification.CATEGORY_MESSAGE).setVisibility(Notification.VISIBILITY_PRIVATE);
        nm.notify(1800,b.build());return true;
    }
}
