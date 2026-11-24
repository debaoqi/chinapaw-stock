import asyncio
from playwright.async_api import async_playwright
V=['home','stock','docs','fin','logi','me','report','logi_svc','so_new','po_new','take','ship_new','recv_pick','msgs','m_users','m_stores','m_products','m_settings']
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        out=[]
        for w in (320,360,412):
            ctx=await b.new_context(viewport={'width':w,'height':760},locale='zh-CN',timezone_id='Africa/Accra');pg=await ctx.new_page()
            await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1000)
            await pg.fill('#lgPw','111111');await pg.click('button.bigbtn');await pg.wait_for_timeout(700)
            for lang in ('zh','en'):
                await pg.evaluate(f"setLang('{lang}',true)")
                for v in V:
                    await pg.evaluate(f"S.form=null;S.hist=[];S.view='{v}';render(true)");await pg.wait_for_timeout(100)
                    r=await pg.evaluate("(()=>{const bad=[];document.querySelectorAll('#screen *, #fixed *, nav *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>innerWidth+1&&!e.closest('.chips'))bad.push(e.className||e.tagName)});return [document.querySelector('#screen').scrollWidth>innerWidth,bad.slice(0,4)]})()")
                    if r[0] or r[1]: out.append(f'{w} {lang} {v} {r}')
            if w==320:
                await pg.evaluate("setLang('en',true);S.view='home';render(true)");await pg.wait_for_timeout(200);await pg.screenshot(path='shots/v2_w320.png')
            await ctx.close()
        print('\n'.join(out) or 'NO OVERFLOW');await b.close()
asyncio.run(main())
