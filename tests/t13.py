import asyncio
from playwright.async_api import async_playwright
async def fillpw(pg,pw):
    await pg.evaluate("p=>{const r=roleOfCode(p);if(r){S.lgRole=r;S.lgPos=null;S.lgDept=deptOf(r).id;S.lgUid=(DB.all('users').find(u=>u.code===p)||{}).id||null;LS.set('lgRole',r)}}",pw)
    await pg.fill('#lgPw',pw)

async def as_(pg,pw):
    await pg.evaluate("logout();S.view='login';render(true)");await fillpw(pg,pw);await pg.click('button.bigbtn');await pg.wait_for_timeout(500)
    return await pg.evaluate("S.me?S.me.role+'/'+S.me.code:document.querySelector('#lgErr').textContent")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='zh-CN',timezone_id='Africa/Accra');errs=[]
        A=await ctx.new_page();A.on('pageerror',lambda e:errs.append(str(e)))
        await A.goto('http://localhost:8765/?demo=1');await A.wait_for_timeout(1200)
        print('buyer:',await as_(A,'222222'))
        await A.evaluate("go('me')");await A.wait_for_timeout(200);print('me has suppliers row:',await A.evaluate("$('#screen').innerText.includes('新增、修改、删除')"))
        await A.evaluate("go('m_partners')");await A.wait_for_timeout(200);print('buyer sections:',await A.evaluate("$$('#screen .sec-h').map(e=>e.textContent)"))
        busy=await A.evaluate("DB.all('partners').find(p=>p.type==='sup'&&ptBusy(p.id).length).id")
        await A.evaluate(f"ptDel('{busy}')");await A.wait_for_timeout(200);print('busy supplier:',await A.evaluate("$('#sheet').innerText.slice(0,80)"))
        await A.evaluate("closeSheet(true);newPartner('sup',id=>{S.newSup=id})");await A.fill('#npN','测试供应商');await A.click("text=保存");await A.wait_for_timeout(200)
        sid=await A.evaluate("S.newSup");await A.evaluate("render(false)");await A.wait_for_timeout(200)
        await A.evaluate(f"ptEdit('{sid}')");await A.wait_for_timeout(200);await A.click("#sheet button:has-text('删除')");await A.wait_for_timeout(200)
        await A.click("#sheet button:has-text('删除') >> nth=-1");await A.wait_for_timeout(300)
        print('deleted flag:',await A.evaluate(f"DB.get('partners','{sid}').del"),'| in list:',await A.evaluate("$('#screen').innerText.includes('测试供应商')"),'| in PO select:',await A.evaluate("partnerSel('sup','','').includes('测试供应商')"))
        print('can buyer delete a customer?',await A.evaluate("const c=DB.all('partners').find(p=>p.type==='cus');ptDel(c.id);DB.get('partners',c.id).del||false"))
        await A.evaluate("closeSheet(true);S.form=null;go('po_new')");await A.wait_for_timeout(300);print('PO form has manage button:',await A.evaluate("!!document.querySelector(\"#screen button[title]\")"))
        print('ERRORS' if errs else 'NO ERRORS',errs[:3]);await b.close()
asyncio.run(main())
