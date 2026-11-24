# 每个部门密码登录 → 打开该部门可见的所有页面（中 / 英），检查报错与混语
import asyncio,sys
from playwright.async_api import async_playwright
async def fillpw(pg,pw):
    await pg.evaluate("p=>{const r=roleOfCode(p);if(r){S.lgRole=r;S.lgPos=null;S.lgDept=deptOf(r).id;LS.set('lgRole',r)}}",pw)
    await pg.fill('#lgPw',pw)

CODES=['111111','222222','333333','444444','555555','666666','444444-1']
VIEWS=['home','stock','docs','fin','logi','me','report','msgs','logi_svc','recv_pick','take','po_new','so_new','ship_new','pr_new','sr_new','mgmt','m_users','m_stores','m_products','m_partners','m_settings','m_backup','m_log']
ZH="(()=>{const w=document.createTreeWalker(document.querySelector('.phone'),NodeFilter.SHOW_TEXT);let n,o=[];while(n=w.nextNode()){if(n.parentElement.closest('[data-notr],script,style,#toast'))continue;if(/[\\u4e00-\\u9fff]/.test(n.nodeValue))o.push(n.nodeValue.trim().slice(0,30))}return o})()"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='zh-CN',timezone_id='Africa/Accra')
        pg=await ctx.new_page();errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append('CONSOLE '+m.text) if m.type=='error' and 'er-api' not in m.text and 'translate' not in m.text and 'Failed to load' not in m.text else None)
        await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1800)
        await pg.screenshot(path='shots/v2_login.png')
        for code in CODES:
            await pg.evaluate("logout();S.view='login';setLang('zh',true);render(true)");await pg.wait_for_timeout(200)
            await fillpw(pg,code);await pg.click('button.bigbtn');await pg.wait_for_timeout(700)
            role=await pg.evaluate('S.me&&S.me.role');tabs=await pg.evaluate("TABS().map(t=>t[0]).join(',')")
            print(code,role,'tabs:',tabs)
            await pg.screenshot(path=f'shots/v2_home_{code}.png')
            for lang in ['zh','en']:
                await pg.evaluate(f"setLang('{lang}',true)")
                for v in VIEWS:
                    ok=await pg.evaluate(f"!NEED['{v}']||can(NEED['{v}'])")
                    if not ok: continue
                    await pg.evaluate(f"S.form=null;S.hist=[];S.view='{v}';S.params={{}};render(true)");await pg.wait_for_timeout(60)
                    if await pg.evaluate("S.view")!=v: errs.append(f'{code} redirected from {v}')
                    if lang=='en':
                        t=await pg.evaluate(ZH)
                        if t: errs.append(f'ZH-IN-EN {code} {v}: {t[:5]}')
            # forbidden pages must bounce
            for v in VIEWS:
                if not await pg.evaluate(f"!NEED['{v}']||can(NEED['{v}'])"):
                    await pg.evaluate(f"S.view='{v}';render(true)")
                    if await pg.evaluate("S.view")==v: errs.append(f'{code} could open forbidden {v}')
        print('\n'.join(errs) or 'NO ERRORS');await b.close()
asyncio.run(main())
