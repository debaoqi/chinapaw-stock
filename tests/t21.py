# 全员检查：每个职位、中英文、320/360/412 宽度，所有页面和常用弹层：不能有超出屏幕、按钮 / 标签文字被截断的情况
import asyncio
from playwright.async_api import async_playwright
CODES=['111111','888888','222222','333333','777777','444444','555555','666666']
SHEETS=["soFin((DB.all('so').find(s=>s.status==='submitted')||{}).id)","soHead&&soGm((DB.all('so').find(s=>s.status==='submitted')||{}).id)","finPaySheet((DB.all('fin').find(f=>f.type==='pay'&&f.status==='approved')||{}).id)",
 "expNew()","pwAllSheet()","acctSheet('U2')","prodEdit('P1')","catSheet()","grpSheet()","chMore()","redeemSheet()","platformSheet()","resetSheet()","locHelp('x',true)","curSheet()",
 "shipSheet((DB.all('so').find(s=>s.status==='approved')||DB.all('so')[0]).id)","printDoc('so',DB.all('so')[0].id)","payReqSheet(apDocs()[0].id)","payGm((DB.all('fin').find(f=>f.type==='pay'&&f.status==='req')||{}).id)"]
CHECK="""(()=>{const W=innerWidth,bad=[];document.querySelectorAll('#screen *, #fixed *, #sheet *, nav *').forEach(e=>{if(!e.offsetParent||e.closest('.chips,iframe,#msgs,.bars'))return;const r=e.getBoundingClientRect();if(!r.width)return;
  if(r.right>W+1)bad.push('OUT '+(e.className||e.tagName)+':'+(e.innerText||'').slice(0,14));
  if(/BUTTON/.test(e.tagName)||/\\b(bigbtn|pill|badge|chip|rolebtn)\\b/.test(e.className||'')){if(e.scrollWidth>e.clientWidth+2)bad.push('CUT '+(e.className||e.tagName)+':'+(e.innerText||'').slice(0,14))}});return [...new Set(bad)].slice(0,6)})()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        out=[]
        for w in (320,360,412):
            ctx=await b.new_context(viewport={'width':w,'height':740},locale='zh-CN',timezone_id='Africa/Accra');pg=await ctx.new_page()
            await pg.route("**/translate.googleapis.com/**",lambda r:r.abort())
            await pg.goto('http://localhost:8765/?demo=1');await pg.wait_for_timeout(1200)
            for code in CODES:
                await pg.evaluate(f"logout();S.me=(({{pw,...u}})=>u)(DB.all('users').find(u=>u.code==='{code}'));S.view='home';render(true)");await pg.wait_for_timeout(150)
                for lang in ('zh','en'):
                    await pg.evaluate(f"setLang('{lang}',true)")
                    views=await pg.evaluate("Object.keys(V).filter(v=>!['login','chat_room'].includes(v)&&(!NEED[v]||can(NEED[v])))")
                    for v in views:
                        await pg.evaluate(f"closeSheet(true);S.form=null;S.hist=[];S.params={{ch:CH_ALL,id:(DB.all('so')[0]||{{}}).id}};S.view='{v}';try{{render(true)}}catch(e){{}}");await pg.wait_for_timeout(40)
                        await pg.evaluate("fitText()");r=await pg.evaluate(CHECK)
                        if r: out.append(f'{w} {code} {lang} {v}: {r}')
                    for s in SHEETS:
                        ok=await pg.evaluate(f"(()=>{{try{{closeSheet(true);{s};return !!document.querySelector('#sheet.on')}}catch(e){{return false}}}})()")
                        if not ok: continue
                        await pg.wait_for_timeout(380);r=await pg.evaluate(CHECK)
                        if r: out.append(f'{w} {code} {lang} SHEET {s[:28]}: {r}')
                    await pg.evaluate("closeSheet(true)")
            await ctx.close()
        print('\n'.join(out[:60]) or 'ALL FIT');print(len(out),'issues');await b.close()
asyncio.run(main())
