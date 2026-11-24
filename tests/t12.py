import asyncio
from playwright.async_api import async_playwright
async def fillpw(pg,pw):
    await pg.evaluate("p=>{const r=roleOfCode(p);if(r){S.lgRole=r;S.lgPos=null;S.lgDept=deptOf(r).id;LS.set('lgRole',r)}}",pw)
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
        po=await A.evaluate("apDocs().find(p=>apOf(p).free>100).id");print('PO',po,'free',await A.evaluate(f"apOf(DB.get('po','{po}')).free"))
        print('acct:',await as_(A,'555555'))
        await A.evaluate(f"apSheet('{po}')");await A.wait_for_timeout(200)
        print('acct sees request button:',await A.evaluate("$('#sheet').innerText.includes('提交付款申请')"),'| no direct approve:',await A.evaluate("!$('#sheet').innerText.includes('审批，交出纳付款')"))
        await A.evaluate(f"payReqSheet('{po}')");await A.wait_for_timeout(200);await A.fill('#pqA','100');await A.evaluate(f"payReqSave('{po}','')")
        print('no reason ->',await A.evaluate("$('#pqE').textContent"))
        await A.fill('#pqN','合同约定预付');await A.click("#pqP .chip:has-text('预付款')");await A.evaluate(f"payReqSave('{po}','')");await A.wait_for_timeout(300)
        f=await A.evaluate("DB.all('fin').filter(f=>f.type==='pay').sort((a,b)=>b.u-a.u)[0]");print('request:',f['status'],f['amount'],f['purp'])
        fid=f['id']
        print('cashier:',await as_(A,'666666'))
        print('cashier can pay before GM?',await A.evaluate(f"finPaySheet('{fid}');!!$('#pyN')"),'| todo count',await A.evaluate("finTodo()"))
        await A.evaluate("closeSheet(true)")
        print('GM:',await as_(A,'111111'))
        print('GM home todo:',await A.evaluate("$('#screen').innerText.includes('付款申请待您审批')"))
        await A.evaluate("payReview()");await A.wait_for_timeout(200);print('review list rows:',await A.evaluate("$$('#sheet .li').length"))
        await A.evaluate(f"payGm('{fid}')");await A.wait_for_timeout(200);await A.evaluate(f"payGmDo('{fid}',false)");print('reject w/o reason ->',await A.evaluate("$('#pgE').textContent"))
        await A.fill('#pgN','先付 50 即可');await A.evaluate(f"payGmDo('{fid}',false)");await A.wait_for_timeout(200);print('status',await A.evaluate(f"DB.get('fin','{fid}').status"))
        print('acct:',await as_(A,'555555'));print('acct home shows rejected:',await A.evaluate("$('#screen').innerText.includes('被驳回')"))
        await A.evaluate(f"payReqSheet('{po}','{fid}')");await A.wait_for_timeout(200);print('shows GM comment:',await A.evaluate("$('#sheet').innerText.includes('先付 50 即可')"))
        await A.fill('#pqA','50');await A.evaluate(f"payReqSave('{po}','{fid}')");await A.wait_for_timeout(200);print('resubmitted:',await A.evaluate(f"[DB.get('fin','{fid}').status,DB.get('fin','{fid}').amount,DB.get('fin','{fid}').gby]"))
        print('GM:',await as_(A,'111111'));await A.evaluate(f"payGm('{fid}')");await A.wait_for_timeout(200);await A.fill('#pgN','同意');await A.evaluate(f"payGmDo('{fid}',true)");await A.wait_for_timeout(200)
        print('status',await A.evaluate(f"DB.get('fin','{fid}').status"))
        print('acct:',await as_(A,'555555'));print('acct cannot withdraw approved:',await A.evaluate(f"finVoid('{fid}','{po}');DB.get('fin','{fid}').status"))
        print('cashier:',await as_(A,'666666'));await A.evaluate(f"finPaySheet('{fid}')");await A.wait_for_timeout(200)
        await A.evaluate(f"finPay('{fid}')");print('pay w/o ref status:',await A.evaluate(f"DB.get('fin','{fid}').status"))
        await A.fill('#pyN','GCB-778812');await A.evaluate(f"finPay('{fid}')");await A.wait_for_timeout(200)
        r=await A.evaluate(f"DB.get('fin','{fid}')");print('paid:',r['status'],r['pref'],'| trail:',await A.evaluate(f"apSheet('{po}');$('#sheet').innerText.includes('总经理批准')&&$('#sheet').innerText.includes('出纳付款')&&$('#sheet').innerText.includes('会计申请')"))
        print('ERRORS' if errs else 'NO ERRORS',errs[:3]);await b.close()
asyncio.run(main())
