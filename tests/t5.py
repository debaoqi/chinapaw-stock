import asyncio
from playwright.async_api import async_playwright
V=['home','stock','docs','logi','me','report','logi_svc','so_new','po_new','take','ship_new','recv_pick','msgs']
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        out=[]
        for w in (320,360,412):
            ctx=await b.new_context(viewport={'width':w,'height':760},locale='zh-CN');pg=await ctx.new_page()
            await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1000)
            await pg.fill('#lgPhone','0240000001');await pg.fill('#lgPw','123456');await pg.click('button.bigbtn');await pg.wait_for_timeout(700)
            for lang in ('zh','en'):
                await pg.evaluate(f"setLang('{lang}')")
                for v in V:
                    await pg.evaluate(f"S.form=null;go('{v}')");await pg.wait_for_timeout(120)
                    r=await pg.evaluate("(()=>{const s=document.querySelector('#screen');const bad=[];document.querySelectorAll('#screen *, #fixed *, nav *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>innerWidth+1&&!e.closest('.chips,.tabsx'))bad.push(e.className||e.tagName)});return [s.scrollWidth>s.clientWidth,bad.slice(0,4)]})()")
                    if r[0] or r[1]: out.append(f'{w} {lang} {v} {r}')
            if w==320: await pg.evaluate("setLang('en');tab('home')");await pg.wait_for_timeout(200);await pg.screenshot(path='shots/w320.png')
            await ctx.close()
        print('\n'.join(out) or 'NO OVERFLOW');await b.close()
asyncio.run(main())
