package com.chinapaw.stock;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.Settings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 华宝进销存 手机原生能力：
 *  - 权限：定位 / 相机 / 麦克风（系统弹窗，只问一次）
 *  - 定位：直接用安卓系统定位（GPS + 网络），比网页定位更稳
 *  - 打印：调用安卓系统打印（自动搜索同一 WiFi 下的打印机）
 *  - 搜索 WiFi 打印机（IPP / RAW 9100 / LPD）
 */
@CapacitorPlugin(
    name = "JxcNative",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class JxcNativePlugin extends Plugin {

    private WebView printView;

    private JSObject permStates() {
        JSObject o = new JSObject();
        o.put("location", getPermissionState("location").toString());
        o.put("camera", getPermissionState("camera").toString());
        o.put("microphone", getPermissionState("microphone").toString());
        return o;
    }

    @PluginMethod
    public void checkPerms(PluginCall call) { call.resolve(permStates()); }

    @PluginMethod
    public void requestPerms(PluginCall call) {
        JSArray arr = call.getArray("list");
        List<String> want = new ArrayList<>();
        try {
            if (arr != null) for (Object x : arr.toList()) {
                String k = String.valueOf(x);
                if ((k.equals("location") || k.equals("camera") || k.equals("microphone")) && getPermissionState(k) != PermissionState.GRANTED) want.add(k);
            }
        } catch (Exception e) { /* ignore */ }
        if (want.isEmpty()) { call.resolve(permStates()); return; }
        requestPermissionForAliases(want.toArray(new String[0]), call, "permsDone");
    }

    @PermissionCallback
    private void permsDone(PluginCall call) { call.resolve(permStates()); }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /* ---------------- 定位 ---------------- */
    @PluginMethod
    public void getLocation(final PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) { call.reject("定位权限未允许", "DENIED"); return; }
        final LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) { call.reject("no location service", "FAIL"); return; }
        boolean gps = false, net = false;
        try { gps = lm.isProviderEnabled(LocationManager.GPS_PROVIDER); } catch (Exception e) { }
        try { net = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER); } catch (Exception e) { }
        if (!gps && !net) { call.reject("位置信息开关已关闭", "OFF"); return; }
        final int timeout = call.getInt("timeout", 20000);
        final Handler h = new Handler(Looper.getMainLooper());
        final boolean[] done = { false };
        final List<LocationListener> ls = new ArrayList<>();
        final Location[] best = { null };
        // 先用最近一次的位置作为备用（2 分钟内的直接用）
        try {
            for (String p : new String[] { LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER }) {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (best[0] == null || l.getTime() > best[0].getTime())) best[0] = l;
            }
        } catch (SecurityException e) { call.reject("定位权限未允许", "DENIED"); return; }
        if (best[0] != null && System.currentTimeMillis() - best[0].getTime() < 120000 && best[0].getAccuracy() < 100) { call.resolve(locObj(best[0])); return; }
        final Runnable finish = () -> {
            if (done[0]) return;
            done[0] = true;
            for (LocationListener l : ls) { try { lm.removeUpdates(l); } catch (Exception e) { } }
            if (best[0] != null) call.resolve(locObj(best[0]));
            else call.reject("暂时没有定到位置", "TIMEOUT");
        };
        LocationListener listener = new LocationListener() {
            @Override public void onLocationChanged(Location l) {
                if (best[0] == null || l.getAccuracy() <= best[0].getAccuracy() || System.currentTimeMillis() - best[0].getTime() > 120000) best[0] = l;
                if (l.getAccuracy() <= 50) h.post(finish);
            }
            @Override public void onStatusChanged(String p, int s, Bundle b) { }
            @Override public void onProviderEnabled(String p) { }
            @Override public void onProviderDisabled(String p) { }
        };
        ls.add(listener);
        try {
            if (gps) lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, listener, Looper.getMainLooper());
            if (net) lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0, 0, listener, Looper.getMainLooper());
        } catch (SecurityException e) { call.reject("定位权限未允许", "DENIED"); return; }
        // 网络定位先到时，过 6 秒还没有更准的 GPS 就用它；最长等 timeout
        h.postDelayed(() -> { if (best[0] != null) finish.run(); }, 6000);
        h.postDelayed(finish, timeout);
    }

    private JSObject locObj(Location l) {
        JSObject o = new JSObject();
        o.put("lat", l.getLatitude());
        o.put("lng", l.getLongitude());
        o.put("acc", l.getAccuracy());
        o.put("t", l.getTime());
        return o;
    }

    /* ---------------- 打印：安卓系统打印，会自动列出同一 WiFi 的打印机 ---------------- */
    @PluginMethod
    public void printHtml(final PluginCall call) {
        final String html = call.getString("html", "");
        final String name = call.getString("name", "document");
        getActivity().runOnUiThread(() -> {
            try {
                final WebView wv = new WebView(getActivity());
                printView = wv;
                wv.getSettings().setJavaScriptEnabled(false);
                wv.setWebViewClient(new WebViewClient() {
                    @Override public void onPageFinished(WebView view, String url) {
                        try {
                            PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                            PrintDocumentAdapter ad = view.createPrintDocumentAdapter(name);
                            pm.print(name, ad, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                            call.resolve();
                        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
                    }
                });
                wv.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    /* ---------------- 搜索 WiFi 打印机（mDNS / Bonjour） ---------------- */
    @PluginMethod
    public void findPrinters(final PluginCall call) {
        final NsdManager nsd = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
        if (nsd == null) { call.reject("NSD not available"); return; }
        final int timeout = call.getInt("timeout", 6000);
        final Map<String, JSObject> found = new LinkedHashMap<>();
        final List<NsdManager.DiscoveryListener> listeners = new ArrayList<>();
        WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        WifiManager.MulticastLock lock = null;
        try { if (wm != null) { lock = wm.createMulticastLock("jxc-printers"); lock.setReferenceCounted(false); lock.acquire(); } } catch (Exception e) { lock = null; }
        final WifiManager.MulticastLock flock = lock;
        String[][] types = { { "_ipp._tcp.", "IPP" }, { "_ipps._tcp.", "IPPS" }, { "_pdl-datastream._tcp.", "RAW 9100" }, { "_printer._tcp.", "LPD" } };
        for (String[] t : types) {
            final String label = t[1];
            NsdManager.DiscoveryListener dl = new NsdManager.DiscoveryListener() {
                @Override public void onDiscoveryStarted(String s) { }
                @Override public void onDiscoveryStopped(String s) { }
                @Override public void onStartDiscoveryFailed(String s, int e) { }
                @Override public void onStopDiscoveryFailed(String s, int e) { }
                @Override public void onServiceFound(NsdServiceInfo si) {
                    synchronized (found) {
                        String n = si.getServiceName();
                        JSObject o = found.get(n);
                        if (o == null) { o = new JSObject(); o.put("name", n); o.put("type", label); found.put(n, o); }
                        else if (!o.getString("type", "").contains(label)) o.put("type", o.getString("type", "") + " / " + label);
                    }
                }
                @Override public void onServiceLost(NsdServiceInfo si) { }
            };
            try { nsd.discoverServices(t[0], NsdManager.PROTOCOL_DNS_SD, dl); listeners.add(dl); } catch (Exception e) { }
        }
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            for (NsdManager.DiscoveryListener dl : listeners) { try { nsd.stopServiceDiscovery(dl); } catch (Exception e) { } }
            try { if (flock != null) flock.release(); } catch (Exception e) { }
            JSArray arr = new JSArray();
            synchronized (found) { for (JSObject o : found.values()) arr.put(o); }
            JSObject r = new JSObject();
            r.put("printers", arr);
            call.resolve(r);
        }, timeout);
    }
}
