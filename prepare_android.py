"""Prepare a generated Capacitor Android project, matching the APK CI configuration."""
import base64,json,pathlib,re,shutil,os,xml.etree.ElementTree as ET
R=pathlib.Path(__file__).resolve().parent
dest=R/'android/app/src/main/java/com/chinapaw/stock';dest.mkdir(parents=True,exist_ok=True)
for name in ['AppUpdaterPlugin.java','JxcNativePlugin.java','JxcUnreadNotifications.java','JxcMessagingService.java']:shutil.copy2(R/'native'/name,dest/name)
(dest/'MainActivity.java').write_text('''package com.chinapaw.stock;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(JxcNativePlugin.class);
        super.onCreate(state);
    }
}
''','utf-8')
ANDROID='http://schemas.android.com/apk/res/android';ET.register_namespace('android',ANDROID)
p=R/'android/app/src/main/AndroidManifest.xml';tree=ET.parse(p);root=tree.getroot()
application=root.find('application')
if not any(e.get('{'+ANDROID+'}name')=='.JxcMessagingService' for e in application.findall('service')):
    service=ET.SubElement(application,'service',{'{'+ANDROID+'}name':'.JxcMessagingService','{'+ANDROID+'}exported':'false'})
    ET.SubElement(ET.SubElement(service,'intent-filter'),'action',{'{'+ANDROID+'}name':'com.google.firebase.MESSAGING_EVENT'})
permissions=['CAMERA','POST_NOTIFICATIONS','REQUEST_INSTALL_PACKAGES','ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION','RECORD_AUDIO','MODIFY_AUDIO_SETTINGS','ACCESS_WIFI_STATE','ACCESS_NETWORK_STATE','CHANGE_WIFI_MULTICAST_STATE']
existing={e.get('{'+ANDROID+'}name') for e in root.findall('uses-permission')}
for name in permissions:
    full='android.permission.'+name
    if full not in existing:ET.SubElement(root,'uses-permission',{'{'+ANDROID+'}name':full})
queries=root.find('queries')
if queries is None:queries=ET.SubElement(root,'queries')
actions={e.get('{'+ANDROID+'}name') for e in queries.findall('./intent/action')}
for action in ['android.intent.action.TTS_SERVICE','android.speech.action.RECOGNIZE_SPEECH']:
    if action not in actions:ET.SubElement(ET.SubElement(queries,'intent'),'action',{'{'+ANDROID+'}name':action})
ET.indent(tree,space='    ');tree.write(p,encoding='utf-8',xml_declaration=True)
p=R/'android/app/src/main/res/xml/file_paths.xml';p.parent.mkdir(parents=True,exist_ok=True)
p.write_text('''<?xml version="1.0" encoding="utf-8"?><paths xmlns:android="http://schemas.android.com/apk/res/android"><external-path name="my_images" path="."/><cache-path name="my_cache_images" path="."/></paths>''','utf-8')
v=json.loads((R/'www/version.json').read_text('utf-8'));p=R/'android/app/build.gradle';s=p.read_text('utf-8')
if 'com.google.firebase:firebase-messaging:' not in s:s=s.replace('dependencies {','dependencies {\n    implementation "com.google.firebase:firebase-messaging:25.1.2"',1)
native_build=max(v['minNative'],int(os.environ.get('JXC_NATIVE_BUILD',v['minNative'])))
s=re.sub(r'versionCode \d+',f"versionCode {native_build}",s);s=re.sub(r'versionName "[^"]+"',f'versionName "{v["version"]}"',s)
if 'jxc-test.keystore' not in s:s=s.replace('android {','''android {
    signingConfigs {
        debug {
            storeFile file("jxc-test.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }''',1)
p.write_text(s,'utf-8');(R/'android/app/jxc-test.keystore').write_bytes(base64.b64decode((R/'android-test-signing.b64').read_text()))
p=R/'android/build.gradle';s=p.read_text('utf-8')
if '// JXC build tools' not in s:
    s+='''
// JXC build tools: use the same SDK tools across the app and Capacitor libraries.
subprojects {
    afterEvaluate { p ->
        def androidExtension = p.extensions.findByName('android')
        if (androidExtension != null) androidExtension.buildToolsVersion = '36.0.0'
    }
}
'''
    p.write_text(s,'utf-8')
# Avoid nesting previously published APKs inside the new APK.
for name in ['ChinaPawStock.apk','ChinaPawStock-Admin.apk']:
    old=R/'android/app/src/main/assets/public/app'/name
    if old.exists():old.unlink()
print('Android prepared:',v['version'],'native build',v['minNative'])
