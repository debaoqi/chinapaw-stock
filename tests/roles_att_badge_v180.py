"""Offline tests: independent chairman/GM, all-staff photos, unread badge clearing."""
import pathlib,functools,http.server,threading,json
from playwright.sync_api import sync_playwright
R=pathlib.Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(R/'www')))
threading.Thread(target=srv.serve_forever,daemon=True).start()
with sync_playwright() as p:
    b=p.chromium.launch(channel='msedge',headless=True)
    c=b.new_context(service_workers='block',locale='zh-CN');c.add_init_script("Object.defineProperty(window,'JXC_CONFIG',{value:{},writable:false})")
    c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('http://127.0.0.1:','data:')) else r.abort())
    pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.goto(f'http://127.0.0.1:{srv.server_port}/index.html?demo=1');pg.wait_for_function("typeof DB!=='undefined'&&DB.all('users').length>=11")
    pg.evaluate("""()=>{clearInterval(Sync.timer);Sync.run=async()=>{};window.calls=[];window.photoData='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6dV8AAAAASUVORK5CYII=';
      window.Capacitor={isNativePlatform:()=>true,Plugins:{JxcNative:{voiceCapabilities:async()=>({camera:true,notifications:true}),checkPerms:async()=>({camera:'granted',microphone:'granted',location:'granted',notifications:'granted'}),capturePhoto:async()=>{calls.push(['camera',S.me.role]);return {data:photoData}},setUnreadBadge:async x=>calls.push(['badge',x.count])}}};
      getPos=async()=>({lat:5.6,lng:-0.18,acc:5});revGeo=async()=> 'Test address';wmImg=async()=>photoData;upImg=async x=>x;
      window.asRole=r=>{S.me={...DB.all('users').find(u=>u.role===r)};closeSheet(true);S.view='work';S.params={};S.hist=[];render(false)};
    }""")
    checked=[]
    for role in ['chair','gm','ops','buyer','clerk','sales','field','keeper','acct','cashier']:
        pg.evaluate('(r)=>asRole(r)',role)
        allowed=pg.evaluate("own('att')&&can('att')")
        assert allowed==(role!='chair'),role
        if role=='chair':
            pg.evaluate("attGo('in')");assert not pg.evaluate("calls.some(c=>c[0]==='camera'&&c[1]==='chair')")
        else:
            pg.evaluate("attGo('in')");pg.wait_for_selector('#attPh')
            pg.click('#attPh');pg.wait_for_function('!!S.att.photo');pg.evaluate('attSave()')
            assert pg.evaluate("DB.all('att').some(a=>a.by===S.me.id&&!!a.photo)"),role
            checked.append(role)
    assert pg.evaluate("DB.all('users').find(u=>u.code==='111111').role")=='chair'
    assert pg.evaluate("DB.all('users').find(u=>u.code==='111112').role")=='gm'
    # Message and voice-message counts update the same native badge, then clear on read.
    pg.evaluate("asRole('sales');LS.set(Alerts.key(),[]);DB.d.msg=[];LS.set('rd_'+meId(),{});S.chId=CH_ALL;S.view='work';DB.put('msg',{id:'badge-chat',ch:CH_ALL,by:'U4',t:Date.now(),text:'hello'});DB.put('msg',{id:'badge-voice',ch:CH_ALL,by:'U4',t:Date.now()+1,voice:'data:audio/wav;base64,x',dur:1});updateUnreadBadge(true)")
    pg.wait_for_function("calls.some(c=>c[0]==='badge'&&c[1]===2)")
    pg.evaluate('chMarkRead(CH_ALL)');pg.wait_for_function("calls[calls.length-1][0]==='badge'&&calls[calls.length-1][1]===0")
    pg.evaluate("Alerts.add({key:'submission',zh:'待审批',en:'Review'},false);updateUnreadBadge(true)")
    pg.wait_for_function("calls[calls.length-1][0]==='badge'&&calls[calls.length-1][1]===1")
    pg.evaluate('markRead()');pg.wait_for_function("calls[calls.length-1][0]==='badge'&&calls[calls.length-1][1]===0")
    pg.evaluate("acceptCloudUsers(DB.all('users').map(u=>u.id===S.me.id?{...u,role:'ops'}:u))")
    assert pg.evaluate('S.me.role')=='ops'
    registered=pg.evaluate("""async()=>{DB.cloud=true;S.token='test-session';const n=NX();n.voiceCapabilities=async()=>({camera:true,notifications:true,push:true});n.registerPush=async()=>({token:'test-device-token-12345678901234567890'});n.setPushUser=async x=>calls.push(['pushUser',x.userId]);rpc=async(fn,args)=>{calls.push(['rpc',fn]);return null};await bindPushRegistration();const ready=PUSH_STATUS==='ready';await revokePushRegistration(S.token);DB.cloud=false;return {ready,cleared:calls.some(c=>c[0]==='pushUser'&&c[1]===''),unregistered:calls.some(c=>c[0]==='rpc'&&c[1]==='jxc_unregister_push')}}""")
    assert registered=={'ready':True,'cleared':True,'unregistered':True},registered
    assert not errors,errors
    print(json.dumps({'roles':'chairman and GM separate','photoCheckInRoles':checked,'badge':'text, voice, submissions and read clearing PASS','pushRegistration':registered,'errors':errors},ensure_ascii=False,indent=2))
    b.close()
srv.shutdown()
