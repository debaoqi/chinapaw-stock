import asyncio
from playwright.async_api import async_playwright
async def run(b,grant):
    kw=dict(viewport={'width':360,'height':760},locale='zh-CN',timezone_id='Africa/Accra')
    if grant: kw.update(geolocation={'latitude':6.6885,'longitude':-1.6244,'accuracy':10},permissions=['geolocation'])
    ctx=await b.new_context(**kw);await ctx.route("**/nominatim.openstreetmap.org/**",lambda r:r.fulfill(status=200,content_type='application/json',body='{"display_name":"Adum, Kumasi, Ghana"}'))
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8765/?demo=1');await pg.wait_for_timeout(1500)
    await pg.evaluate("S.lgDept='gmo';S.lgRole='gm';S.lgPos=null;S.lgUid='U1'");await pg.fill('#lgPw','111111');await pg.click('button.bigbtn');await pg.wait_for_timeout(700)
    print('关于 row gone:',not await pg.evaluate("tab('me');$('#screen').innerText.includes('关于')"))
    await pg.evaluate("go('chat_room',{ch:CH_ALL})");await pg.wait_for_timeout(200);await pg.evaluate("chLoc()");await pg.wait_for_timeout(1800)
    if grant:
        m=await pg.evaluate("chMsgs(CH_ALL).slice(-1)[0].loc");print('sent:',m);print('bubble:',await pg.evaluate("$('#msgs').innerText.split('\\n').slice(-4).join(' | ')"))
    else:
        print('help sheet:',await pg.evaluate("$('#sheet').innerText.replace(/\\n/g,' / ').slice(0,160)"))
        await pg.fill('#locA','Adum, Kumasi');await pg.click("#sheet button:has-text('发送这个地址')");await pg.wait_for_timeout(300);print('manual sent:',await pg.evaluate("chMsgs(CH_ALL).slice(-1)[0].loc"))
    print('ERRORS' if errs else 'NO ERRORS',errs[:2]);await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        await run(b,True);await run(b,False);await b.close()
asyncio.run(main())
