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
        ctx=await b.new_context(viewport={'width':360,'height':780},locale='zh-CN',timezone_id='Africa/Accra');errs=[]
        await ctx.route("**/translate.googleapis.com/**",lambda r:r.fulfill(status=200,content_type='application/json',body='[[["Kumasi Main Store","库玛西总店",null,null,1]],null,"zh-CN"]'))
        A=await ctx.new_page();A.on('pageerror',lambda e:errs.append(str(e)))
        await A.goto('http://localhost:8765/');await A.wait_for_timeout(1500)
        print('blank: products',await A.evaluate("DB.all('products').length"),'partners',await A.evaluate("DB.all('partners').length"),'users',await A.evaluate("DB.all('users').map(u=>u.code).join(',')"),'stores',await A.evaluate("allWh().map(w=>nm(w.n))"))
        print('GM:',await as_(A,'666666'));print('setup checklist:',await A.evaluate("$('#screen').innerText.includes('开始使用')"),await A.evaluate("$$('#screen .box .li').length"))
        # store name auto english
        await A.evaluate("go('m_stores');storeEdit('W1')");await A.wait_for_timeout(200);await A.fill("#sheet input >> nth=0","");await A.type("#sheet input >> nth=0","库玛西总店");await A.wait_for_timeout(900)
        print('auto english:',await A.evaluate("$('#ewEn').value"));await A.evaluate("storeSave()");await A.wait_for_timeout(300);print('store saved:',await A.evaluate("DB.get('wh','W1').n"))
        # categories
        await A.evaluate("catSheet()");await A.wait_for_timeout(150);await A.evaluate("catEdit()");await A.wait_for_timeout(150);await A.fill("#sheet input >> nth=0","摩托车");await A.fill("#ecEn","Motorcycles");await A.evaluate("catSave()");await A.wait_for_timeout(300)
        await A.evaluate("catEdit()");await A.wait_for_timeout(150);await A.fill("#sheet input >> nth=0","手机");await A.fill("#ecEn","Phones");await A.evaluate("catSave()");await A.wait_for_timeout(300)
        print('categories:',await A.evaluate("catList().map(c=>c.k)"))
        await A.evaluate("closeSheet(true);tab('stock')");await A.wait_for_timeout(300);print('stock empty state:',await A.evaluate("$('#screen').innerText.includes('添加第一个商品')"))
        await A.evaluate("prodEdit()");await A.wait_for_timeout(200);await A.fill("#sheet input >> nth=0","本田摩托车 CG125");await A.fill("#epNen","Honda CG125");await A.click("#epCats .chip:has-text('摩托车')")
        await A.evaluate("S.ep.unit.zh='台';S.ep.cost=9000;S.ep.price=11500;S.ep.min=2;S.epOpen={W1:5}");print('auto code:',await A.evaluate("S.ep.code"));await A.evaluate("prodSave()");await A.wait_for_timeout(400)
        print('stock after add:',await A.evaluate("DB.all('products').map(p=>[nm(p.n),nm(p.cat),qtyOf(p.id)])"))
        await A.evaluate("prodEdit()");await A.wait_for_timeout(200);await A.fill("#sheet input >> nth=0","测试手机");await A.fill("#epNewCat","配件");await A.evaluate("S.ep.price=100");await A.evaluate("prodSave()");await A.wait_for_timeout(400)
        print('new category from product form:',await A.evaluate("catList().map(c=>c.k+':'+c.cnt)"))
        await A.evaluate("S.stC='摩托车';render(false)");await A.wait_for_timeout(200);print('filter 摩托车:',await A.evaluate("$$('#screen .wc h3').map(e=>e.textContent)"))
        # delete product with in-app confirm
        pid=await A.evaluate("DB.all('products').find(p=>nm(p.n)==='测试手机').id")
        await A.evaluate(f"S.stC='all';prodEdit('{pid}')");await A.wait_for_timeout(200);await A.click("#sheet button:has-text('删除')");await A.wait_for_timeout(200);await A.click("#sheet button:has-text('删除') >> nth=-1");await A.wait_for_timeout(300)
        print('after delete:',await A.evaluate("DB.all('products').map(p=>nm(p.n))"))
        await A.evaluate("catDel('配件')");await A.wait_for_timeout(150);await A.click("#sheet button:has-text('删除') >> nth=-1");await A.wait_for_timeout(200);print('cats after delete:',await A.evaluate("catList().map(c=>c.k)"))
        # partner auto english
        await A.evaluate("closeSheet(true);go('m_partners',{t:'sup'});ptEdit(null,'sup')");await A.wait_for_timeout(200);await A.type("#sheet input >> nth=0","库玛西总店");await A.wait_for_timeout(900);print('partner en:',await A.evaluate("$('#eptEn').value"))
        await A.evaluate("ptSave()");await A.wait_for_timeout(300)
        await A.evaluate("tab('home')");await A.wait_for_timeout(300);print('checklist progress:',await A.evaluate("($('#screen .badge.b-green')||{}).textContent"))
        # stats layout
        await A.evaluate("tab('fin')");await A.wait_for_timeout(300);print('fin tiles fit:',await A.evaluate("$$('#screen .stat .n').map(e=>e.scrollWidth<=e.clientWidth+1)"),'| 3rd spans:',await A.evaluate("getComputedStyle($$('#screen .stat')[2]).gridColumnStart"))
        # reset
        await A.evaluate("go('m_settings')");await A.wait_for_timeout(200);await A.evaluate("resetSheet()");await A.wait_for_timeout(150);await A.fill('#rsT','错的');await A.evaluate("doReset()");print('wrong confirm:',await A.evaluate("$('#rsE').textContent"))
        await A.fill('#rsT','清空');await A.evaluate("doReset()");await A.wait_for_timeout(500);print('after reset:',await A.evaluate("[DB.all('products').length,DB.all('partners').length,DB.all('moves').length,catList().length,allWh().map(w=>nm(w.n)).join(),DB.all('users').length]"))
        print('ERRORS' if errs else 'NO ERRORS',errs[:3]);await b.close()
asyncio.run(main())
