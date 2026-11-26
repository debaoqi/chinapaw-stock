/* Standard Web Push covers Android installed web apps and iOS Home Screen apps. */
function webPushKeyBytes(key){return Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4)),c=>c.charCodeAt(0))}
async function bindWebPush(manual=false){
  if(PUSH_BINDING||!S.me||!S.token||!DB.cloud)return;
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  if(ios&&!standalone){PUSH_ERROR=L('苹果请用 Safari 添加到主屏幕，再从桌面图标打开并开启通知。','On iPhone, add to Home Screen in Safari, then open the icon and enable notifications.');if(manual)toast(PUSH_ERROR);return}
  if(!('Notification'in window)||!('PushManager'in window)||!navigator.serviceWorker){PUSH_ERROR=L('当前浏览器不支持后台推送，请升级系统并使用 Safari 或 Chrome 安装。','Background push is unsupported. Update the OS and install using Safari or Chrome.');if(manual)toast(PUSH_ERROR);return}
  // Permission requests must start synchronously in a real user gesture on iOS.
  let permission=Notification.permission;
  if(permission==='default'&&manual)permission=await Notification.requestPermission();
  if(permission!=='granted'){PUSH_STATUS='permission';PUSH_ERROR=L('系统通知未允许：请在手机设置中允许通知和图标角标。','Allow notifications and icon badges in system settings.');if(manual)toast(PUSH_ERROR);return}
  PUSH_BINDING=true;const user=S.me.id,session=S.token;
  try{
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      const r=await fetch(CFG.supabaseUrl+'/functions/v1/jxc-push?action=web-config',{headers:{apikey:CFG.supabaseAnonKey,Authorization:'Bearer '+CFG.supabaseAnonKey,'x-jxc-session':session}});
      const conf=await r.json();if(!r.ok||!conf.publicKey)throw Error(L('网页推送服务尚未配置','Web push service is not configured'));
      sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:webPushKeyBytes(conf.publicKey)});
    }
    if(!S.me||S.me.id!==user||S.token!==session)return;
    await rpc('jxc_register_web_push',{p_token:session,p_subscription:sub.toJSON()});
    if(!S.me||S.me.id!==user||S.token!==session){await rpc('jxc_unregister_web_push',{p_token:session,p_endpoint:sub.endpoint}).catch(()=>{});return}
    reg.active&&reg.active.postMessage({type:'jxc-user',userId:user});
    PUSH_STATUS='ready';PUSH_ERROR='';updateUnreadBadge(true);
    if(manual){toast(L('后台推送已连接，收到消息后显示系统通知与角标','Push connected. New messages show system notifications and badges'),false);pushSettings()}
  }catch(e){PUSH_STATUS='setup';PUSH_ERROR=L('连接失败：','Connection failed: ')+String(e.message||e);if(manual)toast(PUSH_ERROR)}finally{PUSH_BINDING=false}
}
async function revokeWebPush(session){try{const reg=await navigator.serviceWorker.ready;reg.active&&reg.active.postMessage({type:'jxc-user',userId:''});const sub=await reg.pushManager.getSubscription();if(sub&&session)await rpc('jxc_unregister_web_push',{p_token:session,p_endpoint:sub.endpoint});if(sub)await sub.unsubscribe()}catch(e){}}
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='jxc-push-arrived'&&S.me)Sync.run('push')});

async function openPushSystemSettings(){try{await NX().openNotificationSettings()}catch(e){toast(L('请在手机设置 → 应用 → 华宝进销存 → 通知中开启角标；旧 APK 请更新。','Open Settings → Apps → Huabao → Notifications and enable badges; update older APKs.'))}}

function testNoticeSound(){LS.set('soundOff',false);noticeUnlock();setTimeout(()=>{noticeAt=0;noticeSound();toast(L('已播放测试音；若仍无声，请检查手机静音、通知音量及勿扰模式。','Test sound played; if silent, check mute, notification volume and Do Not Disturb.'),false)},150)}
