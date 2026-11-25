import asyncio,json,urllib.parse
from playwright.async_api import async_playwright
SR_MOCK="""(()=>{class FakeSR{constructor(){this.lang='';}start(){this._t=setTimeout(()=>{this.onresult&&this.onresult({resultIndex:0,results:[Object.assign([{transcript:'明天上午十点送货'}],{isFinal:true})]})},500)}stop(){setTimeout(()=>this.onend&&this.onend(),50)}}window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR})();"""
async def tr(route):
    q=urllib.parse.parse_qs(urllib.parse.urlparse(route.request.url).query);t=q['q'][0];tl=q['tl'][0]
    out={'en':'Deliver at 10 am tomorrow'}.get(tl,t)
    await route.fulfill(status=200,content_type='application/json',body=json.dumps([[[out,t,None,None,1]],None,'zh-CN']))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
        ctx=await b.new_context(viewport={'width':360,'height':760},device_scale_factor=2,locale='zh-CN',timezone_id='Africa/Accra',permissions=['microphone'])
        await ctx.add_init_script(SR_MOCK);await ctx.route("**/translate.googleapis.com/**",tr)
        pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        # blank start: everyone 666666, person picker when a position has 2 people
        await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1500)
        print('blank-start passwords are 666666:',await pg.evaluate("(async()=>{for(const u of DB.all('users'))if(u.pw!==await pwHash(u.id,'666666'))return false;return true})()"))
        await pg.evaluate("S.lgDept='gmo';S.lgRole='gm';S.lgPos=null");await pg.fill('#lgPw','666666');await pg.click('button.bigbtn');await pg.wait_for_timeout(700)
        await pg.evaluate("acctSheet(null,'whs');acctPick('keeper',null)");await pg.wait_for_timeout(150);await pg.fill("#sheet input >> nth=1",'第二库管');await pg.evaluate("acctSave()");await pg.wait_for_timeout(300)
        print('new account default pw 666666:',await pg.evaluate("(async()=>{const u=DB.all('users').find(u=>nmP(u.name)==='第二库管');return u.pw===await pwHash(u.id,'666666')})()"))
        await pg.screenshot(path='/tmp/h0.png');await pg.evaluate("logout();S.view='login';S.lgRole=undefined;LS.del('lgUid');render(true)");await pg.wait_for_timeout(200)
        await pg.click(".rolebtn:has-text('仓储部')");await pg.wait_for_timeout(300)
        print('people chips:',await pg.evaluate("$$('#lgPpl .chip').map(c=>c.textContent)"),'| label:',await pg.evaluate("$('#lgLab').textContent"))
        await pg.fill('#lgPw','666666');await pg.click('button.bigbtn');await pg.wait_for_timeout(300);print('without choosing:',await pg.evaluate("$('#lgErr').textContent"))
        await pg.click("#lgPpl .chip:has-text('第二库管')");await pg.fill('#lgPw','666666');await pg.click('button.bigbtn');await pg.wait_for_timeout(700);print('signed in as:',await pg.evaluate("nmP(S.me.name)"))
        # voice
        await pg.evaluate("go('chat_room',{ch:CH_ALL})");await pg.wait_for_timeout(300);await pg.screenshot(path='/tmp/h1.png')
        await pg.evaluate("vMode(true)");await pg.wait_for_timeout(100);bb=await pg.locator('#cVoiceBtn').bounding_box()
        await pg.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2);await pg.mouse.down();await pg.wait_for_timeout(2300)
        print('overlay while recording:',await pg.evaluate("($('#vOv')||{}).innerText"))
        await pg.mouse.up();await pg.wait_for_timeout(2500)
        m=await pg.evaluate("chMsgs(CH_ALL).slice(-1)[0]");print('voice msg:',str(m.get('voice'))[:22],'dur',m.get('dur'),'| text:',m.get('text'),'| tr:',m.get('tr'))
        print('bubble:',await pg.evaluate("$('#msgs').innerText.replace(/\\n/g,' | ').slice(-90)"))
        await pg.evaluate(f"vPlay('{m['id']}')");await pg.wait_for_timeout(300);print('playing:',await pg.evaluate("!!VAUD&&VPLAY"));await pg.screenshot(path='/tmp/h2.png')
        # cancel by sliding up
        n0=await pg.evaluate("chMsgs(CH_ALL).length");await pg.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2);await pg.mouse.down();await pg.wait_for_timeout(1500);await pg.mouse.move(bb['x']+bb['width']/2,bb['y']-120,steps=5);await pg.mouse.up();await pg.wait_for_timeout(1500)
        print('slide-up cancel sent nothing:',await pg.evaluate("chMsgs(CH_ALL).length")==n0)
        await pg.evaluate("vMode(false)");await pg.wait_for_timeout(100);print('placeholder:',await pg.evaluate("$('#cIn').placeholder"),'| input height',await pg.evaluate("$('#cIn').offsetHeight"))
        print('ERRORS' if errs else 'NO ERRORS',errs[:3]);await b.close()
asyncio.run(main())
