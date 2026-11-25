package com.chinapaw.stock;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/** High-priority data messages are handled without running the web page. */
public class JxcMessagingService extends FirebaseMessagingService {
    @Override public void onMessageReceived(RemoteMessage message) {
        Map<String,String> d=message.getData();
        String user=d.get("userId"),event=d.get("eventId");
        if(user==null||event==null)return;
        JxcUnreadNotifications.remote(this,user,event,d.getOrDefault("body","您有新的群消息或业务提交，请打开查看"));
    }
    @Override public void onNewToken(String token) {
        // The signed-in app rebinds the current token on each resume.
        getSharedPreferences("jxc-push",MODE_PRIVATE).edit().putString("token",token).apply();
    }
}
