import asyncio
from playwright.async_api import async_playwright
async def login(pg,phone):
    await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1200)
    if await pg.evaluate("S.me&&S.me.phone")!=phone:
        await pg.evaluate("logout();S.view='login';render(true)")
        await pg.fill('#lgPhone',phone);await pg.fill('#lgPw','123456');await pg.click('button.bigbtn');await pg.wait_for_timeout(900)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='zh-CN',accept_downloads=True)
        errs=[]
        sales=await ctx.new_page();keeper=await ctx.new_page()
        for pg in (sales,keeper):
            pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append('CONSOLE '+m.text) if m.type=='error' else None)
        await login(sales,'0240000003')
        # keeper uses separate session storage? same localStorage -> sess shared. emulate by setting S.me directly in keeper page
        await keeper.goto('http://localhost:8765/');await keeper.wait_for_timeout(1000)
        await keeper.evaluate("S.me=(({pw,...u})=>u)(DB.get('users','U4'));LS.set('notesInit_U4',0);Alerts.first();tab('home')")
        q0=await keeper.evaluate("qtyOf('P1','W2')")
        # sales creates SO
        await sales.evaluate("S.form=null;go('so_new',{add:'P1'})");await sales.wait_for_timeout(300)
        await sales.select_option('select.inp >> nth=0','C1');await sales.select_option('select.inp >> nth=1','W2')
        await sales.evaluate("S.form.items[0].qty=25;render(false)");await sales.wait_for_timeout(200)
        await sales.click(".bbar button:has-text('提交') >> nth=-1");await sales.wait_for_timeout(900)
        so=await sales.evaluate("S.params.id");print('SO view',await sales.evaluate("S.view"),so)
        await keeper.wait_for_timeout(600)
        print('so status at keeper',await keeper.evaluate(f"(DB.get('so','{so}')||{{}}).status"),'notes',await keeper.evaluate("Alerts.list().slice(0,2).map(n=>n.zh)"));print('keeper banner:',await keeper.evaluate("document.querySelector('#banner').classList.contains('on')&&document.querySelector('#banner').innerText"))
        await keeper.screenshot(path='shots/f_banner.png')
        # keeper ships
        await keeper.evaluate(f"go('so_view',{{id:'{so}'}})");await keeper.wait_for_timeout(300)
        await keeper.click("text=确认发货");await keeper.wait_for_timeout(500)
        await keeper.fill('#shT','GT-1234-26');await keeper.screenshot(path='shots/f_ship.png')
        await keeper.click("text=确认出库，扣减库存");await keeper.wait_for_timeout(600)
        q1=await keeper.evaluate("qtyOf('P1','W2')");print('stock W2 P1',q0,'->',q1)
        print('so status',await keeper.evaluate(f"DB.get('so','{so}').status"))
        sh=await keeper.evaluate(f"DB.all('ships').find(s=>s.ref==='{so}').id");print('ship',sh)
        await keeper.evaluate(f"go('ship_view',{{id:'{sh}'}})");await keeper.wait_for_timeout(300)
        await keeper.click("text=更新状态");await keeper.wait_for_timeout(300)
        await keeper.click("#sheet .chip:has-text('已签收')");await keeper.fill('#suP','阿克拉');await keeper.click("#sheet >> text=保存");await keeper.wait_for_timeout(500)
        print('so after delivered',await keeper.evaluate(f"DB.get('so','{so}').status"))
        await keeper.screenshot(path='shots/f_shipview.png')
        await sales.wait_for_timeout(500);print('sales sees status',await sales.evaluate(f"DB.get('so','{so}').status"))
        # sales return
        await sales.evaluate(f"S.form=null;go('sr_new',{{so:'{so}'}})");await sales.wait_for_timeout(300)
        await sales.evaluate("S.form.lines[0].qty=5;S.form.reason='破损'");await sales.click("text=确认退货，恢复库存");await sales.wait_for_timeout(500)
        print('after return',await sales.evaluate("qtyOf('P1','W2')"))
        # purchase receive with batch & scan
        await keeper.evaluate("S.form=null;go('recv',{id:'po8'})");await keeper.wait_for_timeout(300)
        await keeper.evaluate("S.form.lines[0].exp='2027-02-28';recvScan()");await keeper.wait_for_timeout(300)
        bar=await keeper.evaluate("DB.get('products','P1').bar");await keeper.evaluate(f"_scanHit('{bar}')");await keeper.wait_for_timeout(300)
        await keeper.evaluate("_scanHit('0000')");await keeper.wait_for_timeout(200);await keeper.screenshot(path='shots/f_recvscan.png')
        await keeper.evaluate("closeSheet()");await keeper.wait_for_timeout(500);await keeper.screenshot(path='shots/f_recv.png')
        w1=await keeper.evaluate("qtyOf('P1','W1')")
        await keeper.click(".bbar button:has-text('确认入库')");await keeper.wait_for_timeout(600)
        print('po8',await keeper.evaluate("DB.get('po','po8').status"),'W1 P1',w1,'->',await keeper.evaluate("qtyOf('P1','W1')"),'batches',await keeper.evaluate("batchesOf('P1','W1').map(b=>b.batch+':'+b.q+':'+b.exp).join(' | ')"))
        # purchase return
        g=await keeper.evaluate("DB.all('grn').find(g=>g.po==='po8').id")
        await keeper.evaluate(f"S.form=null;go('pr_new',{{grn:'{g}'}})");await keeper.wait_for_timeout(300)
        await keeper.evaluate("S.form.lines[0].qty=10");await keeper.click("text=确认退货出库");await keeper.wait_for_timeout(400)
        print('after PR W1 P1',await keeper.evaluate("qtyOf('P1','W1')"),await keeper.evaluate("S.view"))
        # stocktake
        await keeper.evaluate("S.form=null;go('take')");await keeper.wait_for_timeout(200)
        await keeper.click("text=载入本仓商品");await keeper.wait_for_timeout(200)
        await keeper.evaluate("S.form.items.forEach((i,k)=>i.real=i.sys);S.form.items[1].real=S.form.items[1].sys-4;render(false)");await keeper.wait_for_timeout(200)
        await keeper.click(".bbar button:has-text('提交审核')");await keeper.wait_for_timeout(500)
        tk=await keeper.evaluate("S.params.id");pid=await keeper.evaluate(f"DB.get('counts','{tk}').items[1].pid")
        before=await keeper.evaluate(f"qtyOf('{pid}','W1')");print('take',tk,'pending stock unchanged',before)
        # admin approves (switch sales page to admin)
        await sales.evaluate("S.me=(({pw,...u})=>u)(DB.get('users','U1'));go('take_view',{id:'"+tk+"'})");await sales.wait_for_timeout(300)
        await sales.click(".bbar button:has-text('审核通过')");await sales.wait_for_timeout(500)
        print('after approve',await sales.evaluate(f"qtyOf('{pid}','W1')"),'expected',before-4)
        # offline order
        await ctx.set_offline(True);await sales.wait_for_timeout(300)
        await sales.evaluate("S.me=(({pw,...u})=>u)(DB.get('users','U3'));S.form=null;go('so_new',{add:'P8'})");await sales.wait_for_timeout(300)
        await sales.select_option('select.inp >> nth=0','C2');await sales.click(".bbar button:has-text('提交') >> nth=-1");await sales.wait_for_timeout(600)
        oid=await sales.evaluate("S.params.id");print('offline outbox',await sales.evaluate("DB.outbox.length"),'_q',await sales.evaluate(f"!!DB.get('so','{oid}')._q"))
        await sales.screenshot(path='shots/f_offline.png')
        await ctx.set_offline(False);await sales.wait_for_timeout(1500)
        print('online outbox',await sales.evaluate("DB.outbox.length"),'_q',await sales.evaluate(f"!!DB.get('so','{oid}')._q"))
        # check update (version.json build 1 == APP_BUILD)
        await sales.evaluate("checkUpdate(true)");await sales.wait_for_timeout(800);print('toast',await sales.evaluate("document.querySelector('#toast').innerText"))
        # export download
        async with sales.expect_download() as dl:
            await sales.evaluate("exportCSV('stock')")
        d=await dl.value;await d.save_as('shots/stock.csv');print('download',d.suggested_filename)
        # role checks
        await sales.evaluate("S.me=(({pw,...u})=>u)(DB.get('users','U5'));tab('home')");await sales.wait_for_timeout(300);await sales.screenshot(path='shots/f_viewer.png')
        print('viewer can so?',await sales.evaluate("can('so')"),'docs segs',await sales.evaluate("tab('docs');[...document.querySelectorAll('.seg button')].map(b=>b.textContent).join(',')"))
        print('\n'.join(errs) or 'NO ERRORS')
        await b.close()
asyncio.run(main())
