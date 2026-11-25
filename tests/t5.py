import asyncio
from playwright.async_api import async_playwright
async def fillpw(pg,pw):
    await pg.evaluate("p=>{const r=roleOfCode(p);if(r){S.lgRole=r;S.lgPos=null;S.lgDept=deptOf(r).id;LS.set('lgRole',r)}}",pw)
    await pg.fill('#lgPw',pw)

V=['work','chat','att_stats','exp','exp_stats','home','stock','docs','fin','logi','me','report','logi_svc','so_new','po_new','take','ship_new','recv_pick','msgs','m_users','m_stores','m_products','m_settings']
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        out=[]
        for w in (320,360,412):
            ctx=await b.new_context(viewport={'width':w,'height':760},locale='zh-CN',timezone_id='Africa/Accra');pg=await ctx.new_page()
            await pg.goto('http://localhost:8765/?demo=1');await pg.wait_for_timeout(1000)
            await fillpw(pg,'111111');await pg.click('button.bigbtn');await pg.wait_for_timeout(700)
            for lang in ('zh','en'):
                await pg.evaluate(f"setLang('{lang}',true)")
                for v in V+['chat_room','att']:
                    if v=='att':
                        await pg.evaluate("S.me=(({pw,...u})=>u)(DB.all('users').find(u=>u.role==='field'))")
                    await pg.evaluate(f"S.form=null;S.hist=[];S.view='{v}';S.params={{ch:CH_ALL}};render(true)");await pg.wait_for_timeout(100)
                    r=await pg.evaluate("(()=>{const bad=[];document.querySelectorAll('#screen *, #fixed *, nav *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>innerWidth+1&&!e.closest('.chips'))bad.push(e.className||e.tagName)});return [document.querySelector('#screen').scrollWidth>innerWidth,bad.slice(0,4)]})()")
                    if r[0] or r[1]: out.append(f'{w} {lang} {v} {r}')
            await pg.evaluate("S.me=(({pw,...u})=>u)(DB.get('users','U1'))")
            if w==320:
                await pg.evaluate("setLang('en',true);S.view='home';render(true)");await pg.wait_for_timeout(200);await pg.screenshot(path='shots/v2_w320.png')
            await ctx.close()
        print('\n'.join(out) or 'NO OVERFLOW');await b.close()
asyncio.run(main())
