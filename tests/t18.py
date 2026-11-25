import asyncio,json,urllib.parse
from playwright.async_api import async_playwright
D={('采购，今天怎么回事？','en'):('Purchasing, what happened today?','zh-CN'),('When will the order ship?','en'):('When will the order ship?','en'),('When will the order ship?','zh-CN'):('订单什么时候发货？','en'),('采购，今天怎么回事？','fr'):('Achats, que s’est-il passé aujourd’hui ?','zh-CN'),('When will the order ship?','fr'):('Quand la commande sera-t-elle expédiée ?','en')}
async def tr(route):
    q=urllib.parse.parse_qs(urllib.parse.urlparse(route.request.url).query);t=q['q'][0];tl=q['tl'][0]
    out,src=D.get((t,tl),(t,'zh-CN'))
    await route.fulfill(status=200,content_type='application/json',body=json.dumps([[[out,t,None,None,1]],None,src]))
async def lg(pg,pw):
    await pg.evaluate("logout();S.view='login';render(true)");await pg.wait_for_timeout(150)
    await pg.evaluate(f"S.lgRole=roleOfCode('{pw}');S.lgDept=deptOf(S.lgRole).id;S.lgPos=null");await pg.fill('#lgPw',pw);await pg.click('button.bigbtn');await pg.wait_for_timeout(600)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':360,'height':760},device_scale_factor=2,locale='zh-CN',timezone_id='Africa/Accra');await ctx.route("**/translate.googleapis.com/**",tr)
        pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8765/?demo=1');await pg.wait_for_timeout(1500)
        await lg(pg,'111111');await pg.evaluate("go('chat_room',{ch:CH_ALL})");await pg.wait_for_timeout(200)
        await pg.fill('#cIn','采购，今天怎么回事？');await pg.evaluate("chSend()");await pg.wait_for_timeout(900)
        m=await pg.evaluate("chMsgs(CH_ALL).slice(-1)[0]");print('stored:',m.get('src'),m.get('tr'))
        await lg(pg,'222222');await pg.evaluate("go('chat_room',{ch:CH_ALL})");await pg.wait_for_timeout(200)
        await pg.fill('#cIn','When will the order ship?');await pg.evaluate("chSend()");await pg.wait_for_timeout(900)
        m=await pg.evaluate("chMsgs(CH_ALL).slice(-1)[0]");print('stored:',m.get('src'),m.get('tr'))
        print('buyer (zh) sees:',await pg.evaluate("$('#msgs').innerText.split('\\n').filter(x=>x.trim()).slice(-6).join(' | ')"))
        await pg.screenshot(path='/tmp/g1.png')
        await pg.evaluate("setLang('fr',true);render(false)");await pg.wait_for_timeout(1200);print('french reader sees:',await pg.evaluate("$('#msgs').innerText.split('\\n').filter(x=>x.trim()).slice(-8).join(' | ')"))
        print('ERRORS' if errs else 'NO ERRORS',errs[:3]);await b.close()
asyncio.run(main())
