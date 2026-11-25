package com.chinapaw.stock;

import android.Manifest;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import android.media.MediaRecorder;
import android.media.AudioRecord;
import android.media.AudioFormat;
import android.media.MediaRecorder.AudioSource;
import android.os.ParcelFileDescriptor;
import android.speech.SpeechRecognizer;
import android.speech.RecognitionListener;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.annotation.ActivityCallback;
import java.io.File;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Locale;
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
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class JxcNativePlugin extends Plugin {

    private MediaRecorder voiceRecorder;
    private volatile boolean liveRecording;
    private AudioRecord pcmRecorder;
    private SpeechRecognizer liveRecognizer;
    private ParcelFileDescriptor[] speechPipe;
    private Thread pcmWorker;
    private ByteArrayOutputStream pcmBytes;
    private volatile String liveText = "";
    private volatile String liveFinal = "";
    private volatile String liveError = "";
    private File voiceFile;
    private long voiceStarted;
    private TextToSpeech speech;
    private boolean speechReady;
    private PluginCall speechPending;

    @PluginMethod
    public void voiceCapabilities(PluginCall call) {
        JSObject o = new JSObject(); o.put("live", Build.VERSION.SDK_INT >= 33 && SpeechRecognizer.isRecognitionAvailable(getContext())); o.put("record", true); o.put("recognize", true); o.put("speak", true); o.put("camera", true); o.put("notifications", true); o.put("push", true); call.resolve(o);
    }

    @PluginMethod
    public synchronized void startVoice(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) { call.reject("请允许麦克风权限", "DENIED"); return; }
        if (voiceRecorder != null || liveRecording) { call.reject("正在录音"); return; }
        if (Build.VERSION.SDK_INT >= 33 && call.getBoolean("transcribe", false)) { startPcmVoice(call); return; }
        try {
            voiceFile = File.createTempFile("jxc-voice-", ".m4a", getContext().getCacheDir());
            voiceRecorder = new MediaRecorder();
            voiceRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            voiceRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            voiceRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            voiceRecorder.setAudioSamplingRate(44100);
            voiceRecorder.setAudioEncodingBitRate(64000);
            voiceRecorder.setOutputFile(voiceFile.getAbsolutePath());
            voiceRecorder.setMaxDuration(65000);
            voiceRecorder.prepare(); voiceRecorder.start(); voiceStarted = System.currentTimeMillis(); call.resolve();
        } catch (Exception e) { releaseVoice(); call.reject("录音失败: " + e.getMessage()); }
    }

    private synchronized void releaseVoice() {
        if (voiceRecorder != null) { try { voiceRecorder.release(); } catch (Exception ignored) { } voiceRecorder = null; }
        if (voiceFile != null) { voiceFile.delete(); voiceFile = null; }
    }

    @PluginMethod
    public synchronized void stopVoice(PluginCall call) {
        if (liveRecording) { stopPcmVoice(call); return; }
        if (voiceRecorder == null) { call.reject("没有正在进行的录音"); return; }
        try {
            voiceRecorder.stop();
            JSObject o = new JSObject(); o.put("duration", (System.currentTimeMillis() - voiceStarted) / 1000.0);
            if (!call.getBoolean("cancel", false)) {
                try (FileInputStream in = new FileInputStream(voiceFile); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192]; int count;
                    while ((count = in.read(buffer)) != -1) bytes.write(buffer, 0, count);
                    o.put("data", "data:audio/mp4;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
                }
            }
            call.resolve(o);
        } catch (Exception e) { if (call.getBoolean("cancel", false)) call.resolve(); else call.reject("录音未完成，请重试"); }
        finally { releaseVoice(); }
    }

    @PluginMethod
    public void voiceTranscript(PluginCall call) {
        JSObject out=new JSObject();out.put("text",liveText);out.put("error",liveError);call.resolve(out);
    }

    // One microphone owner: feed the exact recorded PCM to Android 13+ recognition.
    // Starting MediaRecorder and SpeechRecognizer on separate microphone sessions silences one on many phones.
    private void startPcmVoice(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                liveText="";liveFinal="";liveError="";pcmBytes=new ByteArrayOutputStream();speechPipe=ParcelFileDescriptor.createPipe();
                liveRecognizer=SpeechRecognizer.createSpeechRecognizer(getContext());
                liveRecognizer.setRecognitionListener(new RecognitionListener() {
                    public void onReadyForSpeech(Bundle b) {} public void onBeginningOfSpeech() {} public void onRmsChanged(float r) {}
                    public void onBufferReceived(byte[] b) {} public void onEndOfSpeech() {} public void onEvent(int t,Bundle b) {}
                    public void onError(int e) { liveError="Recognition error "+e; }
                    private void text(Bundle b) { ArrayList<String> a=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(a!=null&&!a.isEmpty())liveText=liveFinal+a.get(0); }
                    public void onResults(Bundle b) { text(b); } public void onPartialResults(Bundle b) { text(b); }
                    public void onSegmentResults(Bundle b) { text(b);liveFinal=liveText+" "; }
                });
                Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,call.getString("lang","zh-CN"));i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);
                i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE,speechPipe[0]);
                i.putExtra(RecognizerIntent.EXTRA_SEGMENTED_SESSION,RecognizerIntent.EXTRA_AUDIO_SOURCE);
                i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT,1);
                i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING,AudioFormat.ENCODING_PCM_16BIT);
                i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE,16000);
                liveRecognizer.startListening(i);
                int size=Math.max(6400,AudioRecord.getMinBufferSize(16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT));
                pcmRecorder=new AudioRecord(AudioSource.MIC,16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,size);
                if(pcmRecorder.getState()!=AudioRecord.STATE_INITIALIZED)throw new Exception("Microphone unavailable");
                liveRecording=true;voiceStarted=System.currentTimeMillis();pcmRecorder.startRecording();
                pcmWorker=new Thread(() -> {
                    try(FileOutputStream pipe=new FileOutputStream(speechPipe[1].getFileDescriptor())) {
                        byte[] b=new byte[3200];while(liveRecording) { int n=pcmRecorder.read(b,0,b.length);if(n>0){pcmBytes.write(b,0,n);try{pipe.write(b,0,n);}catch(Exception e){liveError="Recognition service stopped";}}else break; }
                    }catch(Exception e){liveError=e.getMessage();}
                },"jxc-speech-pcm");pcmWorker.start();call.resolve();
            }catch(Exception e){releasePcmVoice();call.reject("实时语音启动失败："+e.getMessage());}
        });
    }

    private void releasePcmVoice() {
        liveRecording=false;
        if(pcmRecorder!=null){try{pcmRecorder.stop();}catch(Exception ignored){}try{if(pcmWorker!=null)pcmWorker.join(1500);}catch(Exception ignored){}pcmRecorder.release();pcmRecorder=null;}
        if(speechPipe!=null){for(ParcelFileDescriptor p:speechPipe)try{p.close();}catch(Exception ignored){}speechPipe=null;}
        if(liveRecognizer!=null){getActivity().runOnUiThread(()->{if(liveRecognizer!=null){liveRecognizer.destroy();liveRecognizer=null;}});}
    }

    private void stopPcmVoice(PluginCall call) {
        liveRecording=false;
        try{if(pcmRecorder!=null)pcmRecorder.stop();}catch(Exception ignored){}
        new Thread(()->{
            try{if(pcmWorker!=null)pcmWorker.join(1800);Thread.sleep(900);
                JSObject out=new JSObject();out.put("text",liveText);out.put("recognitionError",liveError);
                if(!call.getBoolean("cancel",false)){
                    byte[] pcm=pcmBytes.toByteArray();ByteBuffer w=ByteBuffer.allocate(44+pcm.length).order(ByteOrder.LITTLE_ENDIAN);
                    w.put(new byte[]{82,73,70,70});w.putInt(36+pcm.length);w.put(new byte[]{87,65,86,69,102,109,116,32});w.putInt(16);w.putShort((short)1);w.putShort((short)1);w.putInt(16000);w.putInt(32000);w.putShort((short)2);w.putShort((short)16);w.put(new byte[]{100,97,116,97});w.putInt(pcm.length);w.put(pcm);
                    out.put("data","data:audio/wav;base64,"+Base64.encodeToString(w.array(),Base64.NO_WRAP));
                }call.resolve(out);
            }catch(Exception e){call.reject("录音保存失败："+e.getMessage());}finally{releasePcmVoice();}
        },"jxc-speech-finish").start();
    }

    @PluginMethod
    public void recognizeSpeech(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("lang", "zh-CN"));
                i.putExtra(RecognizerIntent.EXTRA_PROMPT, "说话后确认文字 / Speak, then confirm the text");
                startActivityForResult(call, i, "speechResult");
            } catch (Exception e) { call.reject("手机未安装语音识别服务，请使用键盘语音输入", "UNAVAILABLE"); }
        });
    }

    @ActivityCallback
    private void speechResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject o = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { o.put("cancelled", true); call.resolve(o); return; }
        ArrayList<String> texts = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        o.put("text", texts == null || texts.isEmpty() ? "" : texts.get(0)); call.resolve(o);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (speechReady && speech != null) { speakNow(call); return; }
            if (speechPending != null) { call.reject("语音引擎正在启动，请稍后重试"); return; }
            speechPending = call;
            if (speech != null) speech.shutdown();
            speech = new TextToSpeech(getContext(), status -> getActivity().runOnUiThread(() -> {
                PluginCall pending = speechPending; speechPending = null;
                speechReady = status == TextToSpeech.SUCCESS;
                if (pending == null) return;
                if (speechReady) speakNow(pending); else pending.reject("语音引擎不可用，请检查系统文字转语音设置");
            }));
        });
    }

    private void speakNow(PluginCall call) {
        int language = speech.setLanguage(Locale.forLanguageTag(call.getString("lang", "zh-CN")));
        if (language < 0) { call.reject("缺少此语言的语音包，请在系统文字转语音设置中下载"); return; }
        if (speech.speak(call.getString("text", ""), TextToSpeech.QUEUE_FLUSH, null, "jxc-" + System.nanoTime()) == TextToSpeech.ERROR) call.reject("朗读失败");
        else call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        releaseVoice();
        releasePcmVoice();
        // Pending camera output survives activity recreation; callback cleans it after delivery.
        if (speech != null) { speech.stop(); speech.shutdown(); speech = null; }
        if (speechPending != null) { speechPending.reject("App 已关闭"); speechPending = null; }
        super.handleOnDestroy();
    }

    private File checkinPhoto;

    @PluginMethod
    public void capturePhoto(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) { call.reject("请允许相机权限", "DENIED"); return; }
        if (checkinPhoto != null) { call.reject("相机正在使用中"); return; }
        getActivity().runOnUiThread(() -> {
            try {
                checkinPhoto = File.createTempFile("jxc-checkin-", ".jpg", getContext().getCacheDir());
                getContext().getSharedPreferences("jxc-camera",Context.MODE_PRIVATE).edit().putString("pending",checkinPhoto.getAbsolutePath()).apply();
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", checkinPhoto);
                Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
                intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivityForResult(call, intent, "checkinPhotoResult");
            } catch (Exception e) { clearCheckinPhoto(); call.reject("无法打开系统相机: " + e.getMessage()); }
        });
    }

    private void clearCheckinPhoto() { if (checkinPhoto != null) { checkinPhoto.delete(); checkinPhoto = null; } getContext().getSharedPreferences("jxc-camera",Context.MODE_PRIVATE).edit().remove("pending").apply(); }

    @ActivityCallback
    private void checkinPhotoResult(PluginCall call, ActivityResult result) {
        if (call == null) { clearCheckinPhoto(); return; }
        if(checkinPhoto==null){String path=getContext().getSharedPreferences("jxc-camera",Context.MODE_PRIVATE).getString("pending","");if(!path.isEmpty()){File restored=new File(path);try{if(restored.getCanonicalPath().startsWith(getContext().getCacheDir().getCanonicalPath()+File.separator))checkinPhoto=restored;}catch(Exception ignored){}}}
        try {
            JSObject out = new JSObject();
            if (result.getResultCode() != Activity.RESULT_OK || checkinPhoto == null || checkinPhoto.length() == 0) { out.put("cancelled", true); call.resolve(out); return; }
            try (FileInputStream in = new FileInputStream(checkinPhoto); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = in.read(buffer)) != -1) bytes.write(buffer, 0, count);
                out.put("data", "data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
            }
            call.resolve(out);
        } catch (Exception e) { call.reject("照片读取失败，请重新拍摄"); }
        finally { clearCheckinPhoto(); }
    }

    @PluginMethod
    public void registerPush(PluginCall call) {
        try {
            if (FirebaseApp.getApps(getContext()).isEmpty() && FirebaseApp.initializeApp(getContext()) == null) { call.reject("后台推送尚未启用，请联系管理员", "NOT_CONFIGURED"); return; }
            FirebaseMessaging.getInstance().setAutoInitEnabled(true);
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (!task.isSuccessful()) { call.reject("推送注册失败，请检查 Google Play 服务和网络"); return; }
                JSObject o=new JSObject();o.put("token",task.getResult());call.resolve(o);
            });
        } catch(Exception e) { call.reject("后台推送配置不可用", "NOT_CONFIGURED"); }
    }

    @PluginMethod
    public void setPushUser(PluginCall call) { JxcUnreadNotifications.setUser(getContext(),call.getString("userId",""));call.resolve(); }

    @PluginMethod
    public void setUnreadBadge(PluginCall call) {
        int count=Math.max(0,call.getInt("count",0));
        if(JxcUnreadNotifications.show(getContext(),count,call.getString("text",""),true))call.resolve();
        else call.reject("请允许通知权限后显示未读角标","DENIED");
    }

    private WebView printView;

    private JSObject permStates() {
        JSObject o = new JSObject();
        o.put("location", getPermissionState("location").toString());
        o.put("camera", getPermissionState("camera").toString());
        o.put("microphone", getPermissionState("microphone").toString());
        o.put("notifications", Build.VERSION.SDK_INT < 33 ? "granted" : getPermissionState("notifications").toString());
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
                if ((k.equals("location") || k.equals("camera") || (k.equals("microphone") || (k.equals("notifications") && Build.VERSION.SDK_INT >= 33))) && getPermissionState(k) != PermissionState.GRANTED) want.add(k);
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
