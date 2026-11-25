"""Voice bridge + real browser recording conversion/playback; production calls blocked."""
import threading,functools,http.server,pathlib,json
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'www')))
threading.Thread(target=srv.serve_forever,daemon=True).start()
with sync_playwright() as p:
    b=p.chromium.launch(channel='msedge',headless=True,args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(service_workers='block',locale='zh-CN');ctx.add_init_script("Object.defineProperty(window,'JXC_CONFIG',{value:{},writable:false})")
    ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('http://127.0.0.1:','data:','blob:')) else r.abort())
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(f'http://127.0.0.1:{srv.server_port}/index.html?demo=1');pg.wait_for_function("typeof DB!=='undefined'&&DB.all('users').length>0")
    pg.evaluate("S.me=DB.all('users').find(u=>u.role==='sales');clearInterval(Sync.timer);Sync.run=async()=>{};go('chat_room',{ch:CH_ALL});")
    # Generate an actual WebM/Opus recording from Web Audio, then convert it to PCM WAV.
    media=pg.evaluate("""async()=>{const ac=new AudioContext(),osc=ac.createOscillator(),dest=ac.createMediaStreamDestination();osc.connect(dest);osc.frequency.value=440;osc.start();const rec=new MediaRecorder(dest.stream,{mimeType:vMime()}),parts=[];rec.ondataavailable=e=>parts.push(e.data);const done=new Promise(r=>rec.onstop=r);rec.start();await new Promise(r=>setTimeout(r,1100));rec.stop();await done;osc.stop();await ac.close();const original=new Blob(parts,{type:rec.mimeType});const wav=await portableVoice(original);window.testVoice=await upVoice(wav);const info={original:original.type,portable:wav.type,size:wav.size,header:String.fromCharCode(...new Uint8Array(await wav.arrayBuffer()).slice(0,4))};DB.put('msg',{id:'audio-test',ch:CH_ALL,voice:testVoice,dur:1,by:S.me.id,t:Date.now()});await vPlay('audio-test');info.started=!!VAUD&&!VAUD.paused;return info}""")
    assert media['portable']=='audio/wav' and media['header']=='RIFF' and media['started'],media
    pg.wait_for_timeout(1400);assert pg.evaluate('VPLAY') is None
    # Native recognition does not rely on the absent Web Speech API inside Android WebView.
    pg.evaluate("""()=>{window.calls=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{JxcNative:{voiceCapabilities:async()=>({record:true,recognize:true,speak:true}),checkPerms:async()=>({microphone:'granted'}),recognizeSpeech:async()=>({text:'你好'}),speak:async o=>calls.push(['speak',o]),startVoice:async()=>calls.push(['record']),stopVoice:async o=>{calls.push(['stop',o]);return {data:testVoice,duration:1.2}}}}};msgTr=async()=>({src:'zh',tr:{en:'Hello'}})}""")
    pg.evaluate('speechTranslate()');pg.wait_for_selector('#spText');pg.fill('#spText','你好同事');pg.evaluate('sendSpeechText()');pg.wait_for_timeout(150)
    mid=pg.evaluate("DB.all('msg').find(m=>m.text==='你好同事').id")
    pg.evaluate('(id)=>msgSpeak(id,"en")',mid)
    assert pg.evaluate("calls.some(c=>c[0]==='speak'&&c[1].text==='Hello'&&c[1].lang==='en-US')")
    pg.evaluate("vStart({preventDefault(){},target:{setPointerCapture(){}},pointerId:1,clientY:200})");pg.wait_for_timeout(1200);pg.evaluate('vStop(false)');pg.wait_for_timeout(150)
    assert pg.evaluate("calls.some(c=>c[0]==='record')&&calls.some(c=>c[0]==='stop'&&!c[1].cancel)")
    # Releasing the pointer before the permission/start promise completes must not leave recording running.
    pg.evaluate("vStart({preventDefault(){},target:{setPointerCapture(){}},pointerId:2,clientY:200});vStop(false)");pg.wait_for_timeout(150)
    assert pg.evaluate('VREC') is None
    assert not errs,errs
    print(json.dumps({'realAudio':media,'nativeBridge':'record, recognize, translate, speak PASS','quickRelease':'PASS','pageErrors':errs},ensure_ascii=False,indent=2))
    b.close()
srv.shutdown()
