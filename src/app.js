/* ================= 华宝进销存 · 用户端（移动端） ================= */
const V={};
const TABV={home:'home',stock:'stock',docs:'docs',logi:'logi',me:'me'};
const LIVE=new Set(['home','stock','product','docs','po_view','so_view','take_view','logi','ship_view','report','msgs','me','recv_pick']);
const whName=id=>nm((DB.get('wh',id)||{}).n)||id||'';
const ptName=id=>nm((DB.get('partners',id)||{}).n)||'—';
const P_=id=>DB.get('products',id)||{n:{zh:'已删除商品',en:'Deleted item'},unit:{zh:'',en:''}};
const pName=id=>nm(P_(id).n);
const unit=p=>nm(p.unit);
const userName=id=>{const u=DB.get('users',id);return u?nm(u.name):(S.me&&S.me.id===id?nm(S.me.name):'—')};
const thumb=(p,sz)=>`<div class="thumb"${sz?` style="width:${sz}px;height:${sz}px"`:''}>${p.photo?`<img src="${esc(p.photo)}" alt="">`:esc(nm(p.n).replace(/[^\p{L}\p{N}]/gu,'').slice(0,1))}</div>`;
const myWh=()=>(S.me&&S.me.wh)||'W1';
function hdr(title,right){return `<div class="hdr"><button class="icbtn" onclick="back()" aria-label="back">${ic('back')}</button><div class="ttl">${title}</div>${right||'<span class="sp"></span>'}</div>`}
function emptyBox(icon,txt){return `<div class="empty">${ic(icon)}<div>${txt}</div></div>`}
function sw(on,fn){return `<button class="sw ${on?'on':''}" onclick="${fn}" aria-label="switch"></button>`}

/* ---------- 导航（与 ChinaPaw 相同：历史栈 + 返回恢复滚动位置） ---------- */
function go(v,p={}){S.hist.push({view:S.view,params:S.params,top:$('#screen').scrollTop});S.view=v;S.params=p;render(true)}
function back(){if(sheetOn())return closeSheet();const p=S.hist.pop();if(!p)return tab('home');S.view=p.view;S.params=p.params;render(false);$('#screen').scrollTop=p.top||0}
function tab(v){S.hist=[];S.view=v;S.params={};render(true)}
function replace(v,p={}){S.view=v;S.params=p;render(true)}
/* 保存后跳到单据详情：如果上一页就是这张单据，就不重复入栈 */
function finish(v,p){const t=S.hist[S.hist.length-1];if(t&&t.view===v&&t.params&&t.params.id===p.id)S.hist.pop();replace(v,p)}
function render(top){
  if(!S.me&&S.view!=='login')S.view='login';
  const sc=$('#screen');let h='';try{h=(V[S.view]||V.home)()}catch(e){console.error(e);h=`<div class="pad"><div class="note-r">${esc(e.message)}</div></div>`}
  sc.innerHTML=`<div class="fade">${S.me?topBars():''}${h}</div>`;
  const fx=$('#fixed');fx.innerHTML='';sc.querySelectorAll('.bbar').forEach(e=>fx.appendChild(e));
  const isTab=!!TABV[S.view]&&!!S.me;sc.classList.toggle('nonav',!isTab);
  $('#navwrap').innerHTML=isTab?tnav():'';
  if(top)sc.scrollTop=0;
  syncUI();try{pwaBar()}catch(e){}fitText();
}
/* 标题一律一行：放不下时先缩小字号（最多到 65%），仍放不下才用省略号（与 ChinaPaw v4.3.2 相同） */
function fitText(){$$('#screen .hero,#screen .sc .t,#screen .stat .n,#screen .wtile .b,#screen .fit,#screen .ptitle').forEach(e=>{e.style.fontSize='';const cs=parseFloat(getComputedStyle(e).fontSize);let f=cs,i=0;
  e.style.whiteSpace='nowrap';e.style.overflow='hidden';while(e.scrollWidth>e.clientWidth+1&&f>cs*.65&&i<40){f-=.5;e.style.fontSize=f+'px';i++}})}
addEventListener('resize',()=>{clearTimeout(window._fz);window._fz=setTimeout(fitText,150)});
let _soft=0;
function softRender(){if(!S.me)return;const a=document.activeElement;
  if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))return;if(sheetOn()||!LIVE.has(S.view))return;
  clearTimeout(_soft);_soft=setTimeout(()=>{const t=$('#screen').scrollTop;render(false);$('#screen').scrollTop=t},120)}
function todoCount(){let n=0;
  if(can('so_ship'))n+=DB.all('so').filter(s=>s.status==='submitted').length;
  if(can('po_recv'))n+=DB.all('po').filter(p=>p.status==='ordered').length;
  if(S.me&&S.me.role==='admin')n+=DB.all('counts').filter(c=>c.status==='pending').length;return n}
function tnav(){const v=S.view;const it=(k,icon,label,extra)=>`<button class="${v===k?'on':''}" onclick="tab('${k}')" aria-label="${label}"><span class="ti">${ic(icon,22)}${extra||''}</span><span class="tl">${label}</span></button>`;
  const b=n=>n?`<span class="cnt">${n>99?'99+':n}</span>`:'';
  return `<nav class="tnav">${it('home','home',L('首页','Home'))}${it('stock','box',L('库存','Stock'))}${it('docs','doc',L('单据','Orders'),b(todoCount()))}${it('logi','truck',L('物流','Logistics'),b(DB.all('ships').filter(s=>s.status==='exception').length))}${it('me','user',L('我的','Me'),b(Alerts.unread()))}</nav>`}
function topBars(){let h='';
  if(!S.online)h+=`<div class="offbar">${ic('cloud',16)} ${L('网络未连接：可查看已缓存数据，开单会暂存本机，联网后自动提交','Offline: cached data available. New orders are saved on this phone and submitted when back online')}</div>`;
  else if(hasUpd())h+=`<div class="updbar" onclick="showUpd(UPD.remote,'web')">${ic('download',16)} ${L('有新版本','New version')} v${esc(UPD.remote.version)} · ${L('点此更新','tap to update')}</div>`;
  return h}
function syncUI(){const c=$('#syncChip');if(!c)return;const n=DB.outbox.length;
  c.className='syncchip'+(!S.online?' off':S.syncing?' busy':'');
  c.innerHTML=`<i></i>${!S.online?L('离线','Offline')+(n?' · '+n:''):S.syncing?L('同步中','Syncing'):n?n+L(' 待提交',' pending'):DB.cloud?L('已同步','Synced'):L('本机','Local')}`}
function syncSheet(){const n=DB.outbox.length;
  openSheet(`<div class="sh">${L('数据同步','Data sync')}</div>
   <div class="kv" style="margin-top:12px"><div><div class="l">${L('模式','Mode')}</div><div class="v">${DB.cloud?L('云端实时同步','Cloud real-time'):L('本机演示模式','Local demo mode')}</div></div>
   <div><div class="l">${L('网络','Network')}</div><div class="v ${S.online?'green':'red'}">${S.online?L('在线','Online'):L('离线','Offline')}</div></div>
   <div><div class="l">${L('最后同步','Last sync')}</div><div class="v">${DB.lastSync?fdate(DB.lastSync):'—'}</div></div>
   <div><div class="l">${L('待提交','Pending')}</div><div class="v">${n} ${L('条','item(s)')}</div></div></div>
   ${S.syncErr?`<div class="note-r" style="margin-top:12px">${esc(S.syncErr)}</div>`:''}
   <div class="note-g" style="margin-top:14px">${DB.cloud?L('新订单、库存变动每隔几秒自动刷新，不用手动下拉；断网时开单暂存本机，联网后自动提交。','New orders and stock changes refresh automatically every few seconds. Offline orders are saved here and submitted when back online.'):L('当前未连接云端：数据保存在本机，多个窗口之间实时同步。在 config.js 填写云端地址后即可多人共用。','Not connected to the cloud: data stays on this device and syncs live between windows. Fill in config.js to share with your team.')}</div>
   <button class="bigbtn" style="width:100%;margin-top:16px" onclick="closeSheet();Sync.run(true)">${ic('refresh')} ${L('立即同步','Sync now')}</button>`)}

/* ================= 消息提醒 ================= */
const pnL=(id,l)=>{const n=(DB.get('partners',id)||{}).n;return n&&typeof n==='object'?(n[l]||n.zh||n.en):(n||'')};
const prL=(p,l)=>p&&typeof p.n==='object'?(p.n[l]||p.n.zh||p.n.en):((p&&p.n)||'');
const unL=(p,l)=>p&&typeof p.unit==='object'?(p.unit[l]||''):((p&&p.unit)||'');
const Alerts={
  key(){return 'notes_'+(S.me?S.me.id:'x')},
  list(){return LS.get(this.key(),[])},save(a){LS.set(this.key(),a.slice(0,80))},
  unread(){return S.me?this.list().filter(n=>!n.read).length:0},
  prefs(){return Object.assign({order:true,low:true,ship:true,logi:true},LS.get('prefs_'+(S.me&&S.me.id),{}))},
  add(n,show,t){const a=this.list();if(n.key&&a.some(x=>x.key===n.key))return;n.id=uid('n');n.t=n.t||Date.now();a.unshift(n);this.save(a);if(show)banner(n)},
  scan(rows,show=true){if(!S.me)return;const pf=this.prefs();
    rows.forEach(({k,d})=>{if(d.by===S.me.id)return;const _add=this.add.bind(this);const self={add:(n,s)=>{n.t=show?Date.now():(d.u||d.t);_add(n,s)}};
      if(k==='so'&&d.status==='submitted'&&can('so_ship')&&pf.order)self.add({key:'so'+d.id+'s',ic:'cart',c:'var(--gold)',zh:`新订单 ${d.no} 待出库 · ${pnL(d.cus,'zh')}`,en:`New order ${d.no} to ship · ${pnL(d.cus,'en')}`,go:['so_view',{id:d.id}]},show);
      if(k==='so'&&d.status==='submitted'&&!can('so_ship')&&can('so')&&pf.order)self.add({key:'so'+d.id+'n',ic:'cart',c:'var(--gold)',zh:`同事提交了销售单 ${d.no}`,en:`Sales order ${d.no} submitted`,go:['so_view',{id:d.id}]},show);
      if(k==='so'&&d.status==='shipped'&&can('so')&&pf.ship)self.add({key:'so'+d.id+'x',ic:'out',c:'var(--blue)',zh:`销售单 ${d.no} 已出库发货`,en:`Order ${d.no} has shipped`,go:['so_view',{id:d.id}]},show);
      if(k==='po'&&d.status==='ordered'&&can('po_recv')&&pf.ship)self.add({key:'po'+d.id+'o',ic:'in',c:'var(--green)',zh:`采购单 ${d.no} 已下单，到货后请入库`,en:`PO ${d.no} ordered — receive on arrival`,go:['po_view',{id:d.id}]},show);
      if(k==='counts'&&d.status==='pending'&&S.me.role==='admin')self.add({key:'tk'+d.id,ic:'clip',c:'var(--purple)',zh:`盘点单 ${d.no} 待审核`,en:`Stock count ${d.no} awaiting review`,go:['take_view',{id:d.id}]},show);
      if(k==='counts'&&d.status!=='pending'&&d.by===S.me.id)self.add({key:'tk'+d.id+d.status,ic:'clip',c:'var(--purple)',zh:`盘点单 ${d.no} ${d.status==='approved'?'已审核通过':'被驳回'}`,en:`Stock count ${d.no} ${d.status}`,go:['take_view',{id:d.id}]},show);
      if(k==='ships'&&pf.logi&&can('logi'))self.add({key:'sh'+d.id+d.status,ic:'truck',c:d.status==='exception'?'var(--red)':'var(--blue)',zh:`物流 ${d.trackNo||d.no}：${SH_ST[d.status][0]}`,en:`Shipment ${d.trackNo||d.no}: ${SH_ST[d.status][1]}`,go:['ship_view',{id:d.id}]},show);
      if(k==='svc'&&d.status==='new'&&S.me.role==='admin')self.add({key:'bk'+d.id,ic:'calendar',c:'var(--orange)',zh:`新的物流预约 ${d.no}`,en:`New logistics booking ${d.no}`,go:['logi_svc',{}]},show);
    });
    if(rows.some(r=>r.k==='moves'))this.low(show)},
  low(show){if(!S.me||!this.prefs().low||!(can('po')||can('take')||S.me.role==='admin'))return;const day=fday(Date.now());
    DB.all('products').forEach(p=>{const q=qtyOf(p.id);const s=stStatus(p,q);if(s==='low'||s==='out')this.add({key:'low'+p.id+day,ic:'alert',c:'var(--red)',zh:`库存不足：${prL(p,'zh')} 仅剩 ${n2(q)} ${unL(p,'zh')}`,en:`Low stock: ${prL(p,'en')} — ${n2(q)} ${unL(p,'en')} left`,go:['product',{id:p.id}]},show)})},
  first(){if(LS.get('notesInit_'+S.me.id,0))return;const rows=[];KINDS.forEach(k=>DB.all(k).forEach(d=>rows.push({k,d})));this.scan(rows.filter(r=>r.k!=='ships'||r.d.status==='exception'||r.d.status==='delivering'),false);LS.set('notesInit_'+S.me.id,1)}
};
function banner(n){const b=$('#banner');if(!b)return;b.innerHTML=`<div class="qi" style="background:${n.c||'var(--gold)'};color:#fff">${ic(n.ic||'bell',18)}</div><div style="flex:1;min-width:0"><div class="b sm">${L('新消息','New')}</div><div class="sm one">${esc(L(n.zh,n.en))}</div></div>`;
  b.onclick=()=>{b.classList.remove('on');markRead(n.id);if(n.go)go(n.go[0],n.go[1])};b.classList.add('on');try{navigator.vibrate&&navigator.vibrate(40)}catch(e){}
  clearTimeout(b._t);b._t=setTimeout(()=>b.classList.remove('on'),4500)}
function markRead(id){const a=Alerts.list();a.forEach(n=>{if(!id||n.id===id)n.read=true});Alerts.save(a)}

/* ================= 登录 ================= */
V.login=()=>{const last=LS.get('lastPhone','');const rem=LS.get('remember',true);
  return `<div class="login-hero"><div class="row between"><div class="row gap6"><img class="logo" src="logo.svg" alt=""><b style="font-size:18px">${L('华宝进销存','ChinaPaw Stock')}</b></div>${langBtn()}</div>
   <div style="font-size:30px;font-weight:800;margin-top:26px;letter-spacing:-.5px;white-space:nowrap">${L('进销存，<span class="hl" style="background:var(--gold);color:#161616;padding:0 8px;border-radius:12px;display:inline-block;transform:rotate(-2deg)">很简单</span>！','Stock, <span style="background:var(--gold);color:#161616;padding:0 8px;border-radius:12px;display:inline-block;transform:rotate(-2deg)">simple</span>!')}</div>
   <div style="opacity:.85;margin-top:6px;font-size:13px;font-weight:600;letter-spacing:1px">${L('库存 · 采购 · 销售 · 物流 一手掌握','Stock · purchasing · sales · logistics')}</div></div>
  <div class="pad" style="padding-top:20px">
   <div class="fld"><label>${L('手机号','Phone number')}</label><input class="inp" id="lgPhone" inputmode="tel" autocomplete="username" value="${esc(rem?last:'')}" placeholder="${L('请输入手机号','Enter phone number')}"></div>
   <div class="fld"><label>${L('密码','Password')}</label><div class="row" style="position:relative"><input class="inp" id="lgPw" type="password" autocomplete="current-password" placeholder="${L('请输入密码','Enter password')}" onkeydown="if(event.key==='Enter')doLogin()"><button style="position:absolute;right:12px;color:var(--muted)" onclick="const i=$('#lgPw');i.type=i.type==='password'?'text':'password'">${ic('lock',18)}</button></div></div>
   <div class="row between" style="margin-top:14px"><span class="sm b">${L('记住手机号','Remember phone')}</span>${sw(rem,"LS.set('remember',!LS.get('remember',true));render(false)")}</div>
   <div class="row between" style="margin-top:12px"><span class="sm b">${L('自动登录（信任此设备）','Stay signed in (trust this device)')}</span>${sw(LS.get('trust',true),"LS.set('trust',!LS.get('trust',true));render(false)")}</div>
   <div id="lgErr" class="sm red" style="margin-top:10px;min-height:18px"></div>
   <button class="bigbtn" style="width:100%" onclick="doLogin()">${L('登录','Sign in')}</button>
   ${DB.cloud?`<div class="sm muted" style="margin-top:14px;text-align:center">${L('账号由管理员在后台创建；忘记密码请联系管理员重置','Accounts are created by your admin. Forgot your password? Ask your admin to reset it.')}</div>`:
   `<div class="sec-h" style="margin-top:22px;font-size:15px">${L('演示账号（密码 123456）','Demo accounts (password 123456)')}</div>
    <div class="demo">${DB.all('users').map(u=>`<button onclick="$('#lgPhone').value='${u.phone}';$('#lgPw').value='123456';doLogin()"><b>${esc(roleName(u.role))}</b>${esc(nm(u.name))} · <span data-notr>${u.phone}</span></button>`).join('')}</div>`}
   <div class="xs muted" style="text-align:center;margin-top:22px" data-notr>v${APP_VER} · build ${APP_BUILD} · ${DB.cloud?L('云端','Cloud'):L('本机演示','Local demo')}</div>
  </div>`};
async function doLogin(){const ph=$('#lgPhone').value.trim(),pw=$('#lgPw').value;const e=$('#lgErr');
  if(!ph||!pw){e.textContent=L('请输入手机号和密码','Enter phone and password');return}
  e.textContent='';try{await login(ph,pw,LS.get('trust',true));if(!LS.get('remember',true))LS.del('lastPhone');afterLogin()}catch(x){e.textContent=x.message}}
function afterLogin(){S.hist=[];S.view='home';Alerts.first();Alerts.low(false);render(true);Sync.run('boot');toast(L('欢迎，','Welcome, ')+nm(S.me.name))}
function doLogout(){openSheet(`<div class="sh">${L('退出登录？','Sign out?')}</div><div class="sm muted" style="margin-top:6px">${DB.outbox.length?L(`还有 ${DB.outbox.length} 条记录未提交，退出后会在下次登录时继续提交。`,`${DB.outbox.length} change(s) not yet submitted; they will be sent next time you sign in.`):L('退出后需要重新输入密码登录。','You will need your password to sign in again.')}</div>
  <div class="row gap" style="margin-top:18px"><button class="bigbtn ghost" onclick="closeSheet()">${L('取消','Cancel')}</button><button class="bigbtn red" onclick="closeSheet();logout();S.view='login';render(true)">${L('退出','Sign out')}</button></div>`)}

/* ================= 首页 ================= */
function greet(){const h=new Date().getHours();return h<12?L('上午好','Good morning'):h<18?L('下午好','Good afternoon'):L('晚上好','Good evening')}
V.home=()=>{const me=S.me;const today=dayStart();
  const soT=DB.all('so').filter(s=>s.status!=='draft'&&s.status!=='cancel'&&s.t>=today);const sales=soT.reduce((a,s)=>a+docTotal(s),0);
  const toShip=DB.all('so').filter(s=>s.status==='submitted').length;const low=DB.all('products').filter(p=>['low','out'].includes(stStatus(p))).length;
  const ships=DB.all('ships');const transit=ships.filter(s=>['picked','transit','customs'].includes(s.status)).length,deliv=ships.filter(s=>s.status==='delivering').length,exc=ships.filter(s=>s.status==='exception').length;
  const big=[];
  if(can('so'))big.push(`<div class="sc" style="background:var(--gold)" onclick="go('so_new')"><div class="ic">${ic('cart',19)}</div><div style="flex:1;min-width:0"><div class="t">${L('销售开单','New sale')}</div><div class="roles">${L('选客户 → 扫码加商品 → 自动算金额','Customer → scan items → auto total')}</div></div><div class="go">${ic('arrow',16)}</div></div>`);
  if(can('po_recv'))big.push(`<div class="sc" style="background:var(--green);color:#fff" onclick="go('recv_pick')"><div class="ic">${ic('in',19)}</div><div style="flex:1;min-width:0"><div class="t">${L('采购入库','Receive goods')}</div><div class="roles">${L('选订单 → 填数量 → 扫码核对','Pick PO → quantities → scan check')}</div></div><div class="go">${ic('arrow',16)}</div></div>`);
  else if(can('po'))big.push(`<div class="sc" style="background:var(--green);color:#fff" onclick="go('po_new')"><div class="ic">${ic('in',19)}</div><div style="flex:1;min-width:0"><div class="t">${L('采购下单','New purchase')}</div><div class="roles">${L('选供应商 → 加商品 → 提交下单','Supplier → items → place order')}</div></div><div class="go">${ic('arrow',16)}</div></div>`);
  if(!big.length)big.push(`<div class="sc" style="background:var(--green);color:#fff" onclick="tab('stock')"><div class="ic">${ic('box',19)}</div><div style="flex:1;min-width:0"><div class="t">${L('库存查询','Stock lookup')}</div><div class="roles">${L('名称 / 编码 / 条码搜索','Search by name / code / barcode')}</div></div><div class="go">${ic('arrow',16)}</div></div>`);
  const todo=[];
  if(can('so_ship')&&toShip)todo.push(['out',L(`${toShip} 张销售单待出库`,`${toShip} order(s) to ship`),"S.docSeg='so';S.docF='submitted';tab('docs')",'var(--gold)']);
  const poO=DB.all('po').filter(p=>p.status==='ordered').length;if(can('po_recv')&&poO)todo.push(['in',L(`${poO} 张采购单待入库`,`${poO} PO(s) to receive`),"go('recv_pick')",'var(--green)']);
  const tk=DB.all('counts').filter(c=>c.status==='pending').length;if(me.role==='admin'&&tk)todo.push(['clip',L(`${tk} 张盘点单待审核`,`${tk} stock count(s) to review`),"S.docSeg='take';tab('docs')",'var(--purple)']);
  const dr=DB.all('so').concat(DB.all('po')).filter(d=>d.status==='draft'&&d.by===me.id).length;if(dr)todo.push(['edit',L(`${dr} 张草稿未提交`,`${dr} draft(s) not submitted`),"S.docSeg='"+(can('so')?'so':'po')+"';S.docF='draft';tab('docs')",'#8A8478']);
  if(exc&&can('logi'))todo.push(['alert',L(`${exc} 票物流异常`,`${exc} shipment exception(s)`),"S.logiF='exception';tab('logi')",'var(--red)']);
  if(DB.outbox.length)todo.push(['cloud',L(`${DB.outbox.length} 条记录待提交`,`${DB.outbox.length} change(s) waiting to submit`),'syncSheet()','var(--orange)']);
  const mv=DB.all('moves').sort((a,b)=>b.t-a.t).slice(0,5);
  return `<div class="pad" style="padding-top:16px">
   <div class="row between"><div class="row gap6" style="min-width:0"><img class="logo" src="logo.svg" alt=""><b style="font-size:17px" class="one">${L('华宝进销存','ChinaPaw Stock')}</b></div>
    <div class="row" style="gap:8px"><button class="syncchip" id="syncChip" onclick="syncSheet()"></button>${langBtn()}<button class="icbtn" onclick="go('msgs')" aria-label="messages">${ic('bell')}${Alerts.unread()?'<span class="dot"></span>':''}</button></div></div>
   <div class="row gap6" style="margin-top:16px;white-space:nowrap;min-width:0"><span class="sm muted" style="flex:none">${greet()} · </span><b class="sm one" style="flex:none;max-width:40%">${esc(nm(me.name))}</b><span class="badge ${ROLES[me.role].c}">${roleName(me.role)}</span><span class="xs muted one">${esc(whName(me.wh))}</span></div>
   <h1 class="hero">${L('进销存，<span class="hl">很简单</span>！','Stock made <span class="hl">simple</span>!')}</h1>
   <div class="slogan">${L('库存 · 采购 · 销售 · 物流 一手掌握','STOCK · BUY · SELL · SHIP')}</div>
   <div style="display:flex;flex-direction:column;gap:12px;margin-top:18px">${big.join('')}
    <div class="wtiles"><div class="wtile" style="background:var(--tile)" onclick="scanLookup()"><div class="wti">${ic('scan')}</div><div style="min-width:0"><div class="b">${L('扫码查货','Scan & check')}</div><div class="wsub">${L('相机扫码 · 秒出库存','Camera scan · instant stock')}</div></div></div>
     ${can('take')?`<div class="wtile" style="background:var(--blue)" onclick="go('take')"><div class="wti">${ic('clip')}</div><div style="min-width:0"><div class="b">${L('库存盘点','Stock count')}</div><div class="wsub">${L('录实盘数 · 待审核','Enter counts · for review')}</div></div></div>`
     :`<div class="wtile" style="background:var(--blue)" onclick="go('report')"><div class="wti">${ic('chart')}</div><div style="min-width:0"><div class="b">${L('简易报表','Reports')}</div><div class="wsub">${L('销售额 · 排行 · 流水','Sales · ranking · log')}</div></div></div>`}</div>
    <div class="wcard" onclick="tab('logi')"><div class="qi">${ic('truck')}</div><div style="flex:1;min-width:0"><div class="b fit" style="font-size:16px;white-space:nowrap">${L('物流跟踪与服务','Logistics & services')}</div>
     <div class="sm muted one">${L(`在途 ${transit} · 派送中 ${deliv} · 异常 ${exc}`,`In transit ${transit} · Out for delivery ${deliv} · Exceptions ${exc}`)}</div><div class="xs b one" style="margin-top:2px">${L('运费估算 · 预约提货 · 承运商查询','Freight quote · booking · carrier tracking')}</div></div><div class="go">${ic('arrow',16)}</div></div>
   </div>
   <div class="stats"><div class="stat g" onclick="go('report')"><div class="n" data-notr><small style="font-size:11px;font-weight:700;opacity:.8">${CUR()} </small>${numK(sales)}</div><div class="l">${L('今日销售额','Sales today')}</div></div>
    <div class="stat" onclick="S.docSeg='so';S.docF='submitted';tab('docs')"><div class="n">${toShip}</div><div class="l">${L('待出库','To ship')}</div></div>
    <div class="stat ${low?'y':''}" onclick="S.stF='low';tab('stock')"><div class="n">${low}</div><div class="l">${L('库存不足','Low stock')}</div></div></div>
   ${todo.length?`<div class="sec-h">${L('待办','To do')}</div><div class="box" style="margin-top:0;padding:4px 16px">${todo.map(x=>`<div class="li" onclick="${x[2]}"><div class="qi" style="background:${x[3]};color:#fff">${ic(x[0],18)}</div><div class="b sm" style="flex:1">${x[1]}</div>${ic('chev',16)}</div>`).join('')}</div>`:''}
   <div class="sec-h">${L('最近出入库','Recent movements')}<a onclick="go('report')">${L('报表','Reports')} ›</a></div>
   <div class="box" style="margin-top:0;padding:4px 16px">${mv.map(mvRow).join('')||emptyBox('box',L('暂无流水','No movements'))}</div>
  </div>`};
function mvRow(m){const p=P_(m.pid);return `<div class="li" onclick="go('product',{id:'${m.pid}'})"><span class="badge ${(MV[m.type]||[0,0,'b-grey'])[2]}" style="min-width:64px;justify-content:center">${mvName(m.type)}</span>
  <div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted one">${esc(whName(m.wh))} · ${fdate(m.t)}</div></div><b class="${m.qty<0?'red':'green'}" data-notr>${m.qty>0?'+':''}${n2(m.qty)}</b></div>`}

/* ================= 库存 ================= */
S.stF='all';S.stW='all';S.stQ='';
V.stock=()=>{const sm=stockMap();const q=S.stQ.trim().toLowerCase();const W=S.stW;
  let list=DB.all('products').map(p=>{const qty=W==='all'?qtyOf(p.id):qtyOf(p.id,W);return {p,qty,s:stStatus(p,qty)}});
  const cnt={all:list.length,ok:0,low:0,over:0};list.forEach(x=>{if(x.s==='ok')cnt.ok++;else if(x.s==='over')cnt.over++;else cnt.low++});
  if(q)list=list.filter(({p})=>[p.n.zh,p.n.en,p.code,p.bar,nm(p.cat)].join(' ').toLowerCase().includes(q));
  if(S.stF!=='all')list=list.filter(x=>S.stF==='low'?(x.s==='low'||x.s==='out'):x.s===S.stF);
  const val=list.reduce((a,x)=>a+x.qty*(can('cost')?x.p.cost:x.p.price),0);
  return `<div class="pad" style="padding-top:16px"><div class="row between"><div class="ptitle">${L('库存','Stock')}</div><div class="row" style="gap:8px">${can('take')?`<button class="pill w" onclick="go('take')">${ic('clip',16)} ${L('盘点','Count')}</button>`:''}${langBtn()}</div></div>
   <div class="searchbar">${ic('search')}<input id="stQ" placeholder="${L('商品名称 / 编码 / 条码','Name / code / barcode')}" value="${esc(S.stQ)}" oninput="S.stQ=this.value;clearTimeout(window._sq);window._sq=setTimeout(()=>{render(false);const i=$('#stQ');i.focus();i.setSelectionRange(i.value.length,i.value.length)},300)"><button class="scan" onclick="scanLookup()" aria-label="scan">${ic('scan',18)}</button></div>
   <div class="chips">${[['all',L('全部仓库','All warehouses')]].concat(DB.all('wh').map(w=>[w.id,nm(w.n)])).map(([k,t])=>`<span class="chip ${S.stW===k?'on':''}" onclick="S.stW='${k}';render(false)">${esc(t)}</span>`).join('')}</div>
   <div class="seg">${[['all',L('全部','All'),cnt.all],['ok',L('正常','Normal'),cnt.ok],['low',L('不足','Low'),cnt.low],['over',L('积压','Overstock'),cnt.over]].map(([k,t,n])=>`<button class="${S.stF===k?'on':''}" onclick="S.stF='${k}';render(false)">${t} ${n}</button>`).join('')}</div>
   <div class="row between sm muted" style="margin:10px 2px"><span>${list.length} ${L('种商品','items')}</span><span>${can('cost')?L('库存成本','Stock cost'):L('库存货值','Stock value')} <b style="color:var(--ink)" data-notr>${money(val)}</b></span></div>
   ${list.map(({p,qty,s})=>`<div class="wc" onclick="go('product',{id:'${p.id}'})"><div class="top"><div class="row between" style="align-items:flex-start;gap:8px">
     <div class="row gap" style="min-width:0;align-items:flex-start">${thumb(p,42)}<div style="min-width:0"><h3><span class="tt">${esc(nm(p.n))}</span></h3><small data-notr>${esc(p.code)} · ${esc(p.bar)}</small></div></div>${stBadge(s)}</div>
     <div class="cols"><div><span class="l">${L('库存','Qty')}</span><span class="v ${s==='low'||s==='out'?'red':''}">${n2(qty)} ${esc(unit(p))}</span></div>
      <div><span class="l">${can('cost')?L('成本/售价','Cost/Price'):L('售价','Price')}</span><span class="v" data-notr>${can('cost')?n2(p.cost)+' / ':''}${n2(p.price)}</span></div>
      <div><span class="l">${L('仓库','WH')}</span><span class="v">${W==='all'?Object.values((sm[p.id]||{w:{}}).w).filter(x=>x.q>0).length+L(' 个',''):esc(whName(W))}</span></div></div></div></div>`).join('')||emptyBox('search',L('没有找到商品','No items found'))}
  </div>`};
V.product=()=>{const p=DB.get('products',S.params.id);if(!p)return hdr('')+emptyBox('box',L('商品不存在','Item not found'));
  const q=qtyOf(p.id),s=stStatus(p,q);const sm=stockMap()[p.id]||{w:{}};const bs=batchesOf(p.id);const soon=Date.now()+30*864e5;
  const mv=DB.all('moves').filter(m=>m.pid===p.id).sort((a,b)=>b.t-a.t).slice(0,10);
  const warn=s==='low'||s==='out'?`<div class="note-r" style="margin-top:12px">${ic('alert',16)} ${L(`库存预警：当前 ${n2(q)}，低于安全库存 ${p.min}，建议尽快补货。`,`Low stock: ${n2(q)} on hand, below safety stock ${p.min}. Reorder soon.`)}</div>`
    :s==='over'?`<div class="note-y" style="margin-top:12px">${L(`库存积压：当前 ${n2(q)}，高于上限 ${p.max}，建议促销或调拨。`,`Overstock: ${n2(q)} on hand, above max ${p.max}. Consider promotion or transfer.`)}</div>`:'';
  return hdr(L('库存详情','Item details'),can('po')||S.me.role==='admin'?`<button class="icbtn" onclick="editProduct('${p.id}')">${ic('edit')}</button>`:'')+`<div class="pad">
   <div class="box" style="margin-top:6px"><div class="row gap" style="align-items:flex-start">${thumb(p,64)}<div style="flex:1;min-width:0"><div class="b" style="font-size:19px;line-height:1.25">${esc(nm(p.n))}</div>
     <div class="xs muted" style="margin-top:3px" data-notr>${esc(p.code)} · ${esc(p.bar)}</div><div class="row gap6" style="margin-top:6px">${stBadge(s)}<span class="badge b-grey">${esc(nm(p.cat))}</span>${p.batch?`<span class="badge b-lime">${L('批次管理','Batch tracked')}</span>`:''}</div></div></div>
    <div class="row" style="margin-top:14px;align-items:baseline;gap:6px"><span style="font-size:34px;font-weight:800;letter-spacing:-1px" class="${s==='low'||s==='out'?'red':''}" data-notr>${n2(q)}</span><span class="muted">${esc(unit(p))}</span></div>
    <div class="kv" style="margin-top:10px">${can('cost')?`<div><div class="l">${L('成本价','Cost')}</div><div class="v" data-notr>${money(p.cost)}</div></div>`:''}<div><div class="l">${L('售价','Price')}</div><div class="v" data-notr>${money(p.price)}</div></div>
     <div><div class="l">${L('安全库存 / 上限','Min / Max')}</div><div class="v" data-notr>${p.min} / ${p.max||'—'}</div></div><div><div class="l">${L('供应商','Supplier')}</div><div class="v">${esc(ptName(p.sup))}</div></div></div>${warn}</div>
   <div class="box"><h4>${L('分仓库存','By warehouse')}</h4>${DB.all('wh').map(w=>{const x=(sm.w[w.id]||{q:0}).q;return `<div class="li" style="cursor:default"><div class="qi">${ic('wh',18)}</div><div style="flex:1">${esc(nm(w.n))}</div><b data-notr>${n2(x)}</b></div>`}).join('')}</div>
   ${p.batch?`<div class="box"><h4>${L('批次 / 效期','Batches / expiry')}</h4>${bs.filter(b=>b.q>0).map(b=>{const near=b.exp&&new Date(b.exp)<soon;return `<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm" data-notr>${esc(b.batch||'—')}</div><div class="xs muted">${esc(whName(b.wh))}</div></div><div style="text-align:right"><div class="b" data-notr>${n2(b.q)}</div><div class="xs ${near?'red b':'muted'}">${b.exp?L('效期 ','Exp ')+esc(b.exp):''}${near?L(' · 即将过期',' · expiring'):''}</div></div></div>`}).join('')||emptyBox('box',L('无批次','No batches'))}</div>`:''}
   <div class="box"><h4>${L('最近出入库','Recent movements')}</h4>${mv.map(m=>`<div class="li" onclick="openRef('${m.type}','${m.ref}')"><span class="badge ${(MV[m.type]||[0,0,'b-grey'])[2]}" style="min-width:64px;justify-content:center">${mvName(m.type)}</span><div style="flex:1;min-width:0"><div class="sm one">${esc(whName(m.wh))}${m.batch?' · <span data-notr>'+esc(m.batch)+'</span>':''}</div><div class="xs muted">${fdate(m.t)} · ${esc(userName(m.by))}</div></div><b class="${m.qty<0?'red':'green'}" data-notr>${m.qty>0?'+':''}${n2(m.qty)}</b></div>`).join('')||emptyBox('box',L('暂无流水','No movements'))}</div>
  </div>${can('so')||can('po')?`<div class="bbar">${can('po')?`<button class="bigbtn ${can('so')?'ghost':''}" onclick="go('po_new',{add:'${p.id}'})">${ic('in',18)} ${L('采购补货','Reorder')}</button>`:''}${can('so')?`<button class="bigbtn" onclick="go('so_new',{add:'${p.id}'})">${ic('cart',18)} ${L('开销售单','Sell')}</button>`:''}</div>`:''}`};
function openRef(type,ref){if(!ref)return;const m={po_in:['grn','po'],po_ret:['pr'],so_out:['so'],so_ret:['sr'],adj:['counts']}[type];if(!m)return;
  if(type==='po_in'){const g=DB.get('grn',ref);if(g)go('po_view',{id:g.po});return}if(type==='so_out')return go('so_view',{id:ref});
  if(type==='so_ret'){const r=DB.get('sr',ref);if(r)go('so_view',{id:r.so});return}if(type==='po_ret'){const r=DB.get('pr',ref);const g=r&&DB.get('grn',r.grn);if(g)go('po_view',{id:g.po});return}
  if(type==='adj')go('take_view',{id:ref})}
function editProduct(id){const p=DB.get('products',id);S.ep={...p};
  openSheet(`<div class="sh">${L('编辑商品','Edit item')}</div><div class="sm muted">${esc(nm(p.n))}</div>
   <div class="row gap" style="margin-top:12px"><div class="photos"><div class="ph" onclick="pickImage(800,u=>{S.ep.photo=u;$('#epPh').innerHTML='<img src=&quot;'+u+'&quot;>'},true)" id="epPh">${p.photo?`<img src="${esc(p.photo)}">`:ic('camera')}</div></div><div class="sm muted">${L('点击拍照或上传商品图片','Tap to take or upload a photo')}</div></div>
   <div class="kv" style="margin-top:6px">${[['price',L('售价','Price')],['cost',L('成本价','Cost')],['min',L('安全库存','Min stock')],['max',L('库存上限','Max stock')]].filter(x=>x[0]!=='cost'||can('cost')).map(([k,t])=>`<div class="fld" style="margin:0"><label>${t}</label><input class="inp" type="number" inputmode="decimal" value="${esc(p[k])}" oninput="S.ep.${k}=+this.value"></div>`).join('')}</div>
   <button class="bigbtn" style="width:100%;margin-top:18px" onclick="DB.put('products',S.ep);closeSheet();toast(L('已保存','Saved'));render(false)">${L('保存','Save')}</button>`)}

/* ---------- 扫码（相机 BarcodeDetector；不支持时手动输入） ---------- */
let _scan=null;
function _scanStop(){if(_scan){clearInterval(_scan.t);try{_scan.st&&_scan.st.getTracks().forEach(t=>t.stop())}catch(e){}_scan=null}}
async function openScan(title,onCode,cont){_scanStop();
  const demo=!DB.cloud?`<div class="xs muted" style="margin-top:12px">${L('没有实物条码？点下面的示例条码试试：','No barcode at hand? Try a sample:')}</div><div class="chips wrap" style="margin-top:6px">${DB.all('products').slice(0,6).map(p=>`<span class="chip sm" data-notr onclick="_scanHit('${p.bar}')">${p.bar}</span>`).join('')}</div>`:'';
  openSheet(`<div class="row between"><div class="sh">${title}</div><button class="icbtn" onclick="closeSheet()">${ic('x')}</button></div>
   <div class="scanv"><video id="scv" playsinline muted></video><div class="frame"></div><div class="laser"></div></div><div id="scMsg" class="sm muted" style="margin-top:8px;text-align:center">${L('正在打开相机…','Opening camera…')}</div>
   <div class="row gap" style="margin-top:10px"><input class="inp" id="scIn" inputmode="numeric" placeholder="${L('或手动输入条码 / 编码','Or type barcode / code')}" onkeydown="if(event.key==='Enter')_scanHit(this.value)"><button class="pill g" onclick="_scanHit($('#scIn').value)">${L('确定','OK')}</button></div><div id="scLog"></div>${demo}`);
  window._scanHit=c=>{c=String(c||'').trim();if(!c)return;const now=Date.now();if(_scan&&_scan.last===c&&now-_scan.lt<1500)return;if(_scan){_scan.last=c;_scan.lt=now}
    try{navigator.vibrate&&navigator.vibrate(60)}catch(e){}const ok=onCode(c);if(!cont&&ok!==false){closeSheet()}else{const i=$('#scIn');if(i)i.value=''}};
  _scan={last:'',lt:0};const msg=t=>{const m=$('#scMsg');if(m)m.textContent=t};
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){msg(L('此设备不支持相机扫码，请手动输入条码','Camera scanning not supported here — type the barcode'));return}
  try{const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});if(!_scan){st.getTracks().forEach(t=>t.stop());return}_scan.st=st;const v=$('#scv');v.srcObject=st;await v.play();
    let fm=['ean_13','ean_8','code_128','code_39','upc_a','qr_code'];try{const sup=await BarcodeDetector.getSupportedFormats();fm=fm.filter(f=>sup.includes(f))}catch(e){}
    const det=new BarcodeDetector({formats:fm});msg(L('将条码放入框内','Point the barcode at the frame'));
    _scan.t=setInterval(async()=>{if(!_scan||v.readyState<2)return;try{const r=await det.detect(v);if(r&&r[0])_scanHit(r[0].rawValue)}catch(e){}},250)}
  catch(e){msg(L('无法打开相机：请允许相机权限，或手动输入','Cannot open camera — allow permission or type the code'))}}
const findByCode=c=>DB.all('products').find(p=>p.bar===c||p.code.toLowerCase()===c.toLowerCase());
function scanLookup(){openScan(L('扫码查商品','Scan to look up'),c=>{const p=findByCode(c);if(!p){toast(L('未找到商品：','Not found: ')+c);return false}setTimeout(()=>quickProduct(p.id),320)})}
function quickProduct(id){const p=DB.get('products',id);const q=qtyOf(id),s=stStatus(p,q);
  openSheet(`<div class="row gap">${thumb(p,56)}<div style="min-width:0;flex:1"><div class="sh one">${esc(nm(p.n))}</div><div class="xs muted" data-notr>${esc(p.code)} · ${esc(p.bar)}</div></div>${stBadge(s)}</div>
   <div class="stats"><div class="stat g"><div class="n" data-notr>${n2(q)}</div><div class="l">${L('总库存','Total qty')} · ${esc(unit(p))}</div></div><div class="stat"><div class="n" data-notr>${n2(p.price)}</div><div class="l">${L('售价','Price')}</div></div><div class="stat"><div class="n" data-notr>${n2(qtyOf(id,myWh()))}</div><div class="l one">${esc(whName(myWh()))}</div></div></div>
   <div class="row gap" style="margin-top:16px"><button class="bigbtn ghost" onclick="closeSheet();go('product',{id:'${id}'})">${L('查看详情','Details')}</button>${can('so')?`<button class="bigbtn" onclick="closeSheet();go('so_new',{add:'${id}'})">${L('开销售单','Sell')}</button>`:''}</div>`)}

/* ---------- 商品选择器（搜索 / 扫码添加） ---------- */
function pickProduct(cb,wh){const listH=q=>{q=(q||'').toLowerCase();return DB.all('products').filter(p=>!q||[p.n.zh,p.n.en,p.code,p.bar].join(' ').toLowerCase().includes(q)).map(p=>`<div class="li" onclick="closeSheet();(${cb})('${p.id}')">${thumb(p,40)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted one"><span data-notr>${esc(p.code)}</span> · ${L('库存','Qty')} ${n2(wh?qtyOf(p.id,wh):qtyOf(p.id))} ${esc(unit(p))}</div></div><span class="b sm" data-notr>${n2(p.price)}</span></div>`).join('')||emptyBox('search',L('没有找到','Nothing found'))};
  window._ppL=listH;openSheet(`<div class="sh">${L('选择商品','Choose item')}</div><div class="searchbar">${ic('search')}<input id="ppQ" placeholder="${L('名称 / 编码 / 条码','Name / code / barcode')}" oninput="$('#ppList').innerHTML=_ppL(this.value)"><button class="scan" onclick="openScan(L('扫码添加','Scan to add'),c=>{const p=findByCode(c);if(!p){toast(L('未找到商品：','Not found: ')+c);return false}(${cb})(p.id)})">${ic('scan',18)}</button></div><div id="ppList" style="margin-top:6px">${listH('')}</div>`)}
function partnerSel(type,val,onch){const l=DB.all('partners').filter(p=>p.type===type);return `<select class="inp" onchange="${onch}">${!val?`<option value="">${L('请选择','Please choose')}</option>`:''}${l.map(p=>`<option value="${p.id}" ${p.id===val?'selected':''}>${esc(nm(p.n))}</option>`).join('')}</select>`}
function whSel(val,onch){return `<select class="inp" onchange="${onch}">${DB.all('wh').map(w=>`<option value="${w.id}" ${w.id===val?'selected':''}>${esc(nm(w.n))}</option>`).join('')}</select>`}
function newPartner(type,after){openSheet(`<div class="sh">${type==='cus'?L('新增客户','New customer'):L('新增供应商','New supplier')}</div>
  <div class="fld"><label>${L('名称','Name')}</label><input class="inp" id="npN"></div><div class="fld"><label>${L('电话','Phone')}</label><input class="inp" id="npP" inputmode="tel"></div><div class="fld"><label>${L('城市','City')}</label><input class="inp" id="npC"></div>
  <button class="bigbtn" style="width:100%;margin-top:18px" onclick="const n=$('#npN').value.trim();if(!n)return toast(L('请填写名称','Enter a name'));const d=DB.put('partners',{type:'${type}',n,phone:$('#npP').value,city:$('#npC').value});closeSheet();(${after})(d.id)">${L('保存','Save')}</button>`)}

/* ---------- 明细编辑（采购单 / 销售单共用） ---------- */
function itemsEditor(kind){const F=S.form;const so=kind==='so';
  return F.items.map((it,i)=>{const p=P_(it.pid);const av=qtyOf(it.pid,F.wh);const short=so&&it.qty>av;
    return `<div class="box" style="margin-top:10px;padding:12px 14px"><div class="row gap">${thumb(p,40)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs ${short?'red b':'muted'}" id="av${i}">${L('可用库存','Available')} ${n2(av)} ${esc(unit(p))}${short?L(' · 库存不够',' · not enough'):''}</div></div><button class="icbtn" style="width:32px;height:32px;box-shadow:none;background:var(--soft)" onclick="S.form.items.splice(${i},1);render(false)">${ic('x',16)}</button></div>
     <div class="row between" style="margin-top:10px;gap:8px"><div class="qty"><button onclick="fQty(${i},-1)">−</button><input type="number" inputmode="decimal" value="${it.qty}" oninput="fSet(${i},'qty',this.value)"><button onclick="fQty(${i},1)">+</button></div>
      <div class="row" style="gap:6px;min-width:0"><span class="xs muted">${L('单价','Price')}</span><input class="inp" style="width:86px;padding:7px 10px;font-size:14px;font-weight:700" type="number" inputmode="decimal" value="${it.price}" oninput="fSet(${i},'price',this.value)"></div>
      <b id="lt${i}" class="sm" data-notr style="min-width:64px;text-align:right">${n2(lineTotal(it))}</b></div></div>`}).join('')
   +`<div class="row gap" style="margin-top:10px"><button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="pickProduct('fAdd','${F.wh}')">${ic('search',18)} ${L('搜索添加','Add item')}</button><button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="openScan(L('扫码添加商品','Scan to add'),c=>{const p=findByCode(c);if(!p){toast(L('未找到商品：','Not found: ')+c);return false}fAdd(p.id,true)},true)">${ic('scan',18)} ${L('扫码添加','Scan to add')}</button></div>`}
function fAdd(pid,silent){const F=S.form;const p=DB.get('products',pid);const ex=F.items.find(i=>i.pid===pid);if(ex)ex.qty=+ex.qty+1;else F.items.push({pid,qty:1,price:F.kind==='po'?p.cost:p.price});
  if(silent){toast(L('已添加：','Added: ')+nm(p.n));const l=$('#scLog');if(l)l.innerHTML=`<div class="note-g" style="margin-top:8px">${L('已添加','Added')} ${esc(nm(p.n))} × ${(F.items.find(i=>i.pid===pid)||{}).qty}</div>`}
  if(!silent||!sheetOn())render(false);else S.formDirty=true}
function fQty(i,d){const it=S.form.items[i];it.qty=Math.max(0,(+it.qty||0)+d);render(false)}
function fSet(i,k,v){const it=S.form.items[i];it[k]=v===''?'':+v;const lt=$('#lt'+i);if(lt)lt.textContent=n2(lineTotal(it));const t=$('#ftotal');if(t)t.textContent=money(docTotal(S.form))}
document.addEventListener('transitionend',e=>{if(e.target.id==='sheet'&&!sheetOn()&&S.formDirty){S.formDirty=false;render(false)}});

/* ================= 单据中心 ================= */
S.docSeg=null;S.docF='all';
V.docs=()=>{const segs=[];if(can('po')||can('po_recv')||S.me.role==='viewer')segs.push(['po',L('采购','Purchase')]);if(can('so')||can('so_ship')||S.me.role==='viewer')segs.push(['so',L('销售','Sales')]);
  if(can('po_ret')||can('so_ret')||S.me.role==='viewer')segs.push(['ret',L('退货','Returns')]);if(can('take')||S.me.role==='admin'||S.me.role==='viewer')segs.push(['take',L('盘点','Counts')]);
  if(!segs.some(s=>s[0]===S.docSeg))S.docSeg=(can('so_ship')&&!can('po_recv'))?'so':segs[0][0];const seg=S.docSeg;
  let body='',add='';
  if(seg==='po'){const st=['all','draft','ordered','received','done'];if(!st.includes(S.docF))S.docF='all';
    const l=DB.all('po').filter(d=>S.docF==='all'||d.status===S.docF).sort((a,b)=>b.t-a.t);
    add=can('po')?`<button class="pill g" onclick="go('po_new')">${ic('plus',16)} ${L('新建采购单','New PO')}</button>`:can('po_recv')?`<button class="pill g" onclick="go('recv_pick')">${ic('in',16)} ${L('采购入库','Receive')}</button>`:'';
    body=`<div class="chips">${st.map(k=>`<span class="chip ${S.docF===k?'on':''}" onclick="S.docF='${k}';render(false)">${k==='all'?L('全部','All'):L(PO_ST[k][0],PO_ST[k][1])} <span class="n">${k==='all'?DB.all('po').length:DB.all('po').filter(d=>d.status===k).length}</span></span>`).join('')}</div><div style="margin-top:12px">${l.map(d=>docCard('po',d)).join('')||emptyBox('doc',L('暂无采购单','No purchase orders'))}</div>`}
  else if(seg==='so'){const st=['all','draft','submitted','shipped','done'];if(!st.includes(S.docF))S.docF='all';
    const l=DB.all('so').filter(d=>S.docF==='all'||d.status===S.docF).sort((a,b)=>b.t-a.t).slice(0,80);
    add=can('so')?`<button class="pill g" onclick="go('so_new')">${ic('plus',16)} ${L('销售开单','New sale')}</button>`:'';
    body=`<div class="chips">${st.map(k=>`<span class="chip ${S.docF===k?'on':''}" onclick="S.docF='${k}';render(false)">${k==='all'?L('全部','All'):L(SO_ST[k][0],SO_ST[k][1])} <span class="n">${k==='all'?DB.all('so').length:DB.all('so').filter(d=>d.status===k).length}</span></span>`).join('')}</div><div style="margin-top:12px">${l.map(d=>docCard('so',d)).join('')||emptyBox('doc',L('暂无销售单','No sales orders'))}</div>`}
  else if(seg==='ret'){const l=DB.all('pr').map(d=>({k:'pr',d})).concat(DB.all('sr').map(d=>({k:'sr',d}))).sort((a,b)=>b.d.t-a.d.t);
    body=`<div class="row gap" style="margin-top:12px">${can('po_ret')?`<button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="go('pr_new')">${ic('ret',18)} ${L('采购退货','Return to supplier')}</button>`:''}${can('so_ret')?`<button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="go('sr_new')">${ic('ret',18)} ${L('销售退货','Customer return')}</button>`:''}</div>
     <div style="margin-top:12px">${l.map(({k,d})=>{const src=k==='pr'?DB.get('grn',d.grn):DB.get('so',d.so);const qty=(d.items||[]).reduce((a,i)=>a+(+i.qty||0),0);
       return `<div class="wc" onclick="${k==='pr'?(src?`go('po_view',{id:'${src.po}'})`:''):`go('so_view',{id:'${d.so}'})`}"><div class="top"><div class="row between"><h3><span class="tt" data-notr>${esc(d.no)}</span></h3><span class="badge ${k==='pr'?'b-orange':'b-purple'}">${k==='pr'?L('采购退货','Purchase return'):L('销售退货','Sales return')}</span></div>
        <small>${k==='pr'?esc(ptName((DB.get('po',(src||{}).po)||{}).sup)):esc(ptName((src||{}).cus))} · ${esc(nm(d.reason)||'')}</small>
        <div class="cols"><div><span class="l">${L('数量','Qty')}</span><span class="v" data-notr>${n2(qty)}</span></div><div><span class="l">${L('仓库','WH')}</span><span class="v">${esc(whName(d.wh))}</span></div><div><span class="l">${L('日期','Date')}</span><span class="v">${fdate(d.t,false)}</span></div></div></div></div>`}).join('')||emptyBox('ret',L('暂无退货单','No returns'))}</div>`}
  else{const l=DB.all('counts').sort((a,b)=>b.t-a.t);add=can('take')?`<button class="pill g" onclick="go('take')">${ic('plus',16)} ${L('新建盘点','New count')}</button>`:'';
    body=`<div style="margin-top:12px">${l.map(d=>{const df=(d.items||[]).filter(i=>i.real!==i.sys);return `<div class="wc" onclick="go('take_view',{id:'${d.id}'})"><div class="top"><div class="row between"><h3><span class="tt" data-notr>${esc(d.no)}</span></h3>${stB(TK_ST,d.status)}</div><small>${esc(whName(d.wh))} · ${esc(userName(d.by))}</small>
     <div class="cols"><div><span class="l">${L('商品','Items')}</span><span class="v">${(d.items||[]).length}</span></div><div><span class="l">${L('差异','Diffs')}</span><span class="v ${df.length?'red':''}">${df.length}</span></div><div><span class="l">${L('日期','Date')}</span><span class="v">${fdate(d.t,false)}</span></div></div></div></div>`}).join('')||emptyBox('clip',L('暂无盘点单','No stock counts'))}</div>`}
  return `<div class="pad" style="padding-top:16px"><div class="row between"><div class="ptitle">${L('单据','Orders')}</div><div class="row" style="gap:8px">${add}</div></div>
   <div class="seg">${segs.map(([k,t])=>`<button class="${seg===k?'on':''}" onclick="S.docSeg='${k}';S.docF='all';render(false)">${t}</button>`).join('')}</div>${body}</div>`};
function docCard(k,d){const M=k==='po'?PO_ST:SO_ST;const party=k==='po'?ptName(d.sup):ptName(d.cus);const pend=d._q;
  return `<div class="wc" onclick="go('${k}_view',{id:'${d.id}'})"><div class="top"><div class="row between" style="gap:8px"><h3><span class="tt" data-notr>${esc(d.no)}</span>${pend?`<span class="badge b-orange">${ic('cloud',11)}${L('待同步','Pending sync')}</span>`:''}</h3>${stB(M,d.status)}</div>
   <small>${esc(party)} · ${esc(whName(d.wh))}</small>
   <div class="cols"><div><span class="l">${L('金额','Total')}</span><span class="v" data-notr>${n2(docTotal(d))}</span></div><div><span class="l">${L('商品','Items')}</span><span class="v">${d.items.length} ${L('种','')}</span></div><div><span class="l">${L('日期','Date')}</span><span class="v">${fdate(d.t,false)}</span></div></div></div></div>`}

/* ---------- 采购订单 ---------- */
V.po_new=()=>{if(!S.form||S.form.kind!=='po'||S.form._v!==S.params.id+'|'+S.params.add){const ex=S.params.id&&DB.get('po',S.params.id);
    S.form=ex?{...JSON.parse(JSON.stringify(ex)),kind:'po'}:{kind:'po',sup:'',wh:myWh(),items:[],note:''};S.form._v=S.params.id+'|'+S.params.add;
    if(S.params.add&&!S.form.items.some(i=>i.pid===S.params.add)){const p=DB.get('products',S.params.add);S.form.items.push({pid:p.id,qty:Math.max(1,(p.max||p.min*2)-qtyOf(p.id)),price:p.cost});if(!S.form.sup)S.form.sup=p.sup||''}}
  const F=S.form;
  return hdr(F.id?L('编辑采购单','Edit PO'):L('新建采购单','New purchase order'))+`<div class="pad">
   <div class="fld"><label>${L('供应商','Supplier')}</label><div class="row gap">${partnerSel('sup',F.sup,"S.form.sup=this.value")}<button class="icbtn" onclick="newPartner('sup',id=>{S.form.sup=id;render(false)})">${ic('plus')}</button></div></div>
   <div class="fld"><label>${L('入库仓库','Receiving warehouse')}</label>${whSel(F.wh,"S.form.wh=this.value;render(false)")}</div>
   <div class="sec-h" style="margin-bottom:0">${L('采购商品','Items')} <span class="sm muted">${F.items.length}</span></div>${itemsEditor('po')}
   <div class="fld"><label>${L('备注','Note')}</label><textarea class="inp" oninput="S.form.note=this.value">${esc(nm(F.note))}</textarea></div></div>
  <div class="bbar"><div class="total"><span class="l">${L('合计','Total')}</span><span class="v" id="ftotal" data-notr>${money(docTotal(F))}</span></div><button class="bigbtn ghost" onclick="savePO('draft')">${L('存草稿','Save draft')}</button><button class="bigbtn" onclick="savePO('ordered')">${L('提交下单','Place order')}</button></div>`};
function savePO(st){const F=S.form;if(!F.sup)return toast(L('请选择供应商','Choose a supplier'));const items=F.items.filter(i=>+i.qty>0);if(!items.length)return toast(L('请添加商品','Add at least one item'));
  const d=DB.put('po',{...F,kind:undefined,_v:undefined,items:items.map(i=>({...i,qty:+i.qty,price:+i.price,recv:+i.recv||0})),status:st,no:F.no||genNo('PO'),t:F.t||Date.now()});S.form=null;
  toast(st==='draft'?L('草稿已保存','Draft saved'):S.online?L('已下单','Order placed'):L('已暂存本机，联网后自动提交','Saved offline — will submit when online'));finish('po_view',{id:d.id})}
function steps(flow,cur,M){const i=flow.indexOf(cur);return `<div class="steps">${flow.map((s,k)=>`<div class="st ${k<=i?'ok':''}"><b>${k<i?'✓':k+1}</b>${L(M[s][0],M[s][1])}</div>`).join('')}</div>`}
V.po_view=()=>{const d=DB.get('po',S.params.id);if(!d)return hdr('')+emptyBox('doc',L('单据不存在','Not found'));
  const grns=DB.all('grn').filter(g=>g.po===d.id);const shs=DB.all('ships').filter(s=>s.ref===d.id);const acts=[];
  if(d.status==='draft'&&can('po')){acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('po_new',{id:'${d.id}'})">${L('编辑','Edit')}</button>`,`<button class="bigbtn" onclick="setSt('po','${d.id}','ordered')">${L('提交下单','Place order')}</button>`)}
  if(d.status==='ordered'&&can('po_recv'))acts.push(`<button class="bigbtn" onclick="S.form=null;go('recv',{id:'${d.id}'})">${ic('in',18)} ${L('采购入库','Receive')}</button>`);
  if(d.status==='received'&&can('po'))acts.push(`<button class="bigbtn" onclick="setSt('po','${d.id}','done')">${L('完成订单','Complete')}</button>`);
  if(['received','done'].includes(d.status)&&can('po_ret')&&grns.length)acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('pr_new',{grn:'${grns[0].id}'})">${ic('ret',18)} ${L('采购退货','Return')}</button>`);
  if(d.status==='ordered'&&can('po')&&!acts.length)acts.push(`<button class="bigbtn ghost" onclick="setSt('po','${d.id}','cancel')">${L('取消订单','Cancel order')}</button>`);
  return hdr(L('采购单','Purchase order'),`<button class="icbtn" onclick="copyText('${d.no}')">${ic('copy')}</button>`)+`<div class="pad">
   <div class="box" style="margin-top:6px"><div class="row between"><div class="b" style="font-size:18px" data-notr>${esc(d.no)}</div>${stB(PO_ST,d.status)}</div>${d.status!=='cancel'?steps(['draft','ordered','received','done'],d.status,PO_ST):''}
    <div class="kv" style="margin-top:14px"><div><div class="l">${L('供应商','Supplier')}</div><div class="v">${esc(ptName(d.sup))}</div></div><div><div class="l">${L('入库仓库','Warehouse')}</div><div class="v">${esc(whName(d.wh))}</div></div>
    <div><div class="l">${L('制单人','Created by')}</div><div class="v">${esc(userName(d.by))}</div></div><div><div class="l">${L('日期','Date')}</div><div class="v">${fdate(d.t)}</div></div></div>
    ${nm(d.note)?`<div class="note-y" style="margin-top:12px">${esc(nm(d.note))}</div>`:''}${d._q?`<div class="note-y" style="margin-top:12px">${ic('cloud',15)} ${L('暂存本机，联网后自动提交','Saved on this phone — submits when online')}</div>`:''}</div>
   <div class="box"><h4>${L('商品明细','Items')}<span class="sm muted">${L('已入库 / 订购','Received / ordered')}</span></h4>${d.items.map(it=>{const p=P_(it.pid);return `<div class="li" onclick="go('product',{id:'${it.pid}'})">${thumb(p,38)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted" data-notr>${n2(it.qty)} × ${n2(it.price)} = ${n2(lineTotal(it))}</div></div><b class="${(+it.recv||0)>=it.qty?'green':''}" data-notr>${n2(+it.recv||0)}/${n2(it.qty)}</b></div>`}).join('')}
    <div class="row between" style="margin-top:10px"><span class="muted">${L('合计','Total')}</span><b style="font-size:18px" data-notr>${money(docTotal(d))}</b></div></div>
   ${grns.length?`<div class="box"><h4>${L('入库记录','Receipts')}</h4>${grns.map(g=>`<div class="li" style="cursor:default"><div class="qi" style="background:var(--lime);color:var(--green)">${ic('in',18)}</div><div style="flex:1;min-width:0"><div class="b sm" data-notr>${esc(g.no)}</div><div class="xs muted">${fdate(g.t)} · ${esc(userName(g.by))}</div></div><b data-notr>${n2(g.items.reduce((a,i)=>a+i.qty,0))}</b></div>`).join('')}</div>`:''}
   ${shipBox(shs,'in','po',d.id)}</div>${acts.length?`<div class="bbar">${acts.join('')}</div>`:''}`};
function setSt(k,id,st){const d=DB.get(k,id);DB.put(k,{...d,status:st});toast(L('已更新','Updated'));render(false)}
function shipBox(shs,dir,refKind,ref){if(!can('logi')&&!shs.length)return '';
  return `<div class="box"><h4>${L('物流跟踪','Logistics')}${can('logi')?`<a class="sm green b" style="cursor:pointer" onclick="S.form=null;go('ship_new',{dir:'${dir}',refKind:'${refKind}',ref:'${ref}'})">+ ${L('添加物流','Add shipment')}</a>`:''}</h4>${shs.map(shipRow).join('')||`<div class="sm muted">${L('还没有物流信息','No shipment yet')}</div>`}</div>`}
function shipRow(s){const c=carrier(s.carrier);return `<div class="li" onclick="go('ship_view',{id:'${s.id}'})"><div class="qi" style="background:${s.status==='exception'?'#FCE9E5':'var(--lime)'};color:${s.status==='exception'?'var(--red)':'var(--green)'}">${ic(MODES[s.mode||c.mode][2],18)}</div><div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(c))} · <span data-notr>${esc(s.trackNo||s.no)}</span></div><div class="xs muted one">${esc(nm(s.from))} → ${esc(nm(s.to))}</div></div>${stB(SH_ST,s.status)}</div>`}

/* ---------- 采购入库：选订单 → 填数量 → 扫码核对 → 确认入库 ---------- */
V.recv_pick=()=>{const l=DB.all('po').filter(p=>p.status==='ordered').sort((a,b)=>a.t-b.t);
  return hdr(L('采购入库','Receive goods'))+`<div class="pad"><div class="note-g" style="margin-top:4px">${L('第 1 步：选择要入库的采购订单','Step 1: choose the purchase order to receive')}</div><div style="margin-top:12px">${l.map(d=>`<div class="wc" onclick="S.form=null;go('recv',{id:'${d.id}'})"><div class="top"><div class="row between"><h3><span class="tt" data-notr>${esc(d.no)}</span></h3>${stB(PO_ST,d.status)}</div><small>${esc(ptName(d.sup))} · ${esc(whName(d.wh))}</small>
   <div class="cols"><div><span class="l">${L('商品','Items')}</span><span class="v">${d.items.length}</span></div><div><span class="l">${L('未入库','Remaining')}</span><span class="v" data-notr>${n2(d.items.reduce((a,i)=>a+Math.max(0,i.qty-(+i.recv||0)),0))}</span></div><div><span class="l">${L('下单','Ordered')}</span><span class="v">${fdate(d.t,false)}</span></div></div></div></div>`).join('')||emptyBox('in',L('没有待入库的采购单','No orders waiting to be received'))}</div></div>`};
V.recv=()=>{const d=DB.get('po',S.params.id);if(!d)return hdr('');
  if(!S.form||S.form.kind!=='recv'||S.form.po!==d.id)S.form={kind:'recv',po:d.id,wh:d.wh,chk:{},lines:d.items.map(it=>{const p=P_(it.pid);const rem=Math.max(0,it.qty-(+it.recv||0));return {pid:it.pid,qty:rem,rem,batch:p.batch?'B'+fday(Date.now()).replace(/-/g,'').slice(2):'',exp:''}})};
  const F=S.form;const total=F.lines.length,ok=F.lines.filter(l=>(F.chk[l.pid]||0)>0).length;
  return hdr(L('确认入库','Receive')+' · <span data-notr>'+esc(d.no)+'</span>')+`<div class="pad">
   <div class="note-g" style="margin-top:4px">${L('第 2 步：核对实到数量（默认为未入库数量），可扫码逐件核对','Step 2: check quantities (defaults to remaining). Scan items to verify.')}</div>
   <div class="row between" style="margin-top:12px"><div class="sm">${L('已扫码核对','Scan-checked')} <b>${ok}/${total}</b></div><button class="pill g" onclick="recvScan()">${ic('scan',16)} ${L('扫码核对','Scan check')}</button></div>
   <div class="fld"><label>${L('入库仓库','Warehouse')}</label>${whSel(F.wh,"S.form.wh=this.value")}</div>
   ${F.lines.map((l,i)=>{const p=P_(l.pid);const c=F.chk[l.pid]||0;return `<div class="box" style="margin-top:10px;padding:12px 14px;${c?'border:2px solid var(--green)':''}"><div class="row gap">${thumb(p,40)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted"><span data-notr>${esc(p.bar)}</span> · ${L('未入库','Remaining')} ${n2(l.rem)} ${esc(unit(p))}</div></div>${c?`<span class="badge b-green">✓ ${c}</span>`:''}</div>
    <div class="row between" style="margin-top:10px"><span class="sm muted">${L('实到数量','Received qty')}</span><div class="qty"><button onclick="S.form.lines[${i}].qty=Math.max(0,S.form.lines[${i}].qty-1);render(false)">−</button><input type="number" inputmode="decimal" value="${l.qty}" oninput="S.form.lines[${i}].qty=+this.value"><button onclick="S.form.lines[${i}].qty++;render(false)">+</button></div></div>
    ${p.batch?`<div class="row gap" style="margin-top:8px"><input class="inp" style="padding:9px 12px;font-size:14px" placeholder="${L('批次号','Batch no.')}" value="${esc(l.batch)}" oninput="S.form.lines[${i}].batch=this.value"><input class="inp" style="padding:9px 12px;font-size:14px" type="date" value="${esc(l.exp)}" oninput="S.form.lines[${i}].exp=this.value" title="${L('有效期','Expiry')}"></div>`:''}</div>`}).join('')}</div>
  <div class="bbar"><button class="bigbtn" onclick="doRecv()">${ic('check',18)} ${L('确认入库','Confirm receipt')}</button></div>`};
function recvScan(){openScan(L('扫码核对','Scan check'),c=>{const F=S.form;const p=findByCode(c);const l=p&&F.lines.find(x=>x.pid===p.id);
  if(!l){toast(L('不在此订单中：','Not in this order: ')+c);const g=$('#scLog');if(g)g.innerHTML=`<div class="note-r" style="margin-top:8px">${L('不在此订单中','Not in this order')}: <span data-notr>${esc(c)}</span></div>`;return false}
  F.chk[p.id]=(F.chk[p.id]||0)+1;S.formDirty=true;const g=$('#scLog');if(g)g.innerHTML=`<div class="note-g" style="margin-top:8px">✓ ${esc(nm(p.n))} · ${L('已核对','checked')} ${F.chk[p.id]} ${L('次','x')}</div>`},true)}
function doRecv(){const F=S.form;const d=DB.get('po',F.po);const lines=F.lines.filter(l=>+l.qty>0);if(!lines.length)return toast(L('请填写实到数量','Enter received quantities'));
  for(const l of lines){if(P_(l.pid).batch&&!l.exp)return toast(L('请填写有效期：','Enter expiry for: ')+pName(l.pid))}
  const over=lines.find(l=>+l.qty>l.rem);
  const go2=()=>{const g=DB.put('grn',{no:genNo('GR'),po:d.id,wh:F.wh,t:Date.now(),items:lines.map(l=>({pid:l.pid,qty:+l.qty,batch:l.batch||'',exp:l.exp||''}))});
    lines.forEach(l=>addMove({pid:l.pid,wh:F.wh,qty:+l.qty,type:'po_in',ref:g.id,batch:l.batch||'',exp:l.exp||''}));
    const items=d.items.map(it=>{const l=lines.find(x=>x.pid===it.pid);return l?{...it,recv:(+it.recv||0)+(+l.qty)}:it});
    const all=items.every(it=>(+it.recv||0)>=it.qty);DB.put('po',{...d,items,status:all?'received':'ordered'});S.form=null;Alerts.low(false);
    closeSheet(true);toast(all?L('已全部入库','Fully received'):L('已部分入库','Partly received'));finish('po_view',{id:d.id})};
  if(over)openSheet(`<div class="sh">${L('超出订购数量','More than ordered')}</div><div class="sm muted" style="margin-top:6px">${esc(pName(over.pid))}: ${L('实到','received')} ${over.qty} &gt; ${L('未入库','remaining')} ${over.rem}</div><div class="row gap" style="margin-top:18px"><button class="bigbtn ghost" onclick="closeSheet()">${L('返回修改','Go back')}</button><button class="bigbtn" onclick="window._rcv()">${L('仍然入库','Receive anyway')}</button></div>`);
  window._rcv=go2;if(!over)go2()}

/* ---------- 采购退货：选入库单 → 填退货数量 → 确认出库 ---------- */
V.pr_new=()=>{const gid=S.params.grn;if(!gid){const l=DB.all('grn').sort((a,b)=>b.t-a.t);return hdr(L('采购退货','Return to supplier'))+`<div class="pad"><div class="note-g" style="margin-top:4px">${L('选择要退货的入库单','Choose the receipt to return from')}</div><div style="margin-top:12px">${l.map(g=>{const po=DB.get('po',g.po)||{};return `<div class="wc" onclick="S.form=null;S.params.grn='${g.id}';render(true)"><div class="top"><div class="row between"><h3><span class="tt" data-notr>${esc(g.no)}</span></h3><span class="badge b-green">${L('已入库','Received')}</span></div><small>${esc(ptName(po.sup))} · <span data-notr>${esc(po.no||'')}</span></small><div class="cols"><div><span class="l">${L('商品','Items')}</span><span class="v">${g.items.length}</span></div><div><span class="l">${L('仓库','WH')}</span><span class="v">${esc(whName(g.wh))}</span></div><div><span class="l">${L('日期','Date')}</span><span class="v">${fdate(g.t,false)}</span></div></div></div></div>`}).join('')||emptyBox('in',L('暂无入库单','No receipts'))}</div></div>`}
  const g=DB.get('grn',gid);const po=DB.get('po',g.po)||{};
  if(!S.form||S.form.kind!=='pr'||S.form.grn!==gid)S.form={kind:'pr',grn:gid,reason:'',lines:g.items.map((it,i)=>{const rem=it.qty-(+it.ret||0);const st=batchesOf(it.pid,g.wh).filter(b=>(b.batch||'')===(it.batch||'')).reduce((a,b)=>a+b.q,0);return {i,pid:it.pid,batch:it.batch,max:Math.max(0,Math.min(rem,it.batch?st:qtyOf(it.pid,g.wh))),qty:0}})};
  const F=S.form;
  return hdr(L('采购退货','Return to supplier'))+`<div class="pad"><div class="box" style="margin-top:6px"><div class="b" data-notr>${esc(g.no)}</div><div class="sm muted">${esc(ptName(po.sup))} · ${esc(whName(g.wh))} · ${fdate(g.t)}</div></div>
   ${F.lines.map((l,k)=>{const p=P_(l.pid);return `<div class="box" style="margin-top:10px;padding:12px 14px"><div class="row gap">${thumb(p,40)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted">${l.batch?'<span data-notr>'+esc(l.batch)+'</span> · ':''}${L('最多可退','Max')} ${n2(l.max)} ${esc(unit(p))}</div></div>
    <div class="qty"><button onclick="S.form.lines[${k}].qty=Math.max(0,S.form.lines[${k}].qty-1);render(false)">−</button><input type="number" value="${l.qty}" oninput="S.form.lines[${k}].qty=+this.value"><button onclick="S.form.lines[${k}].qty=Math.min(${l.max},S.form.lines[${k}].qty+1);render(false)">+</button></div></div></div>`}).join('')}
   <div class="fld"><label>${L('退货原因','Reason')}</label><input class="inp" value="${esc(F.reason)}" oninput="S.form.reason=this.value" placeholder="${L('如：质量问题、型号不符','e.g. quality issue, wrong model')}"></div></div>
  <div class="bbar"><button class="bigbtn" onclick="doPR()">${ic('out',18)} ${L('确认退货出库','Confirm return')}</button></div>`};
function doPR(){const F=S.form;const g=DB.get('grn',F.grn);const lines=F.lines.filter(l=>+l.qty>0);if(!lines.length)return toast(L('请填写退货数量','Enter return quantities'));
  const bad=lines.find(l=>+l.qty>l.max);if(bad)return toast(L('超过可退数量：','Exceeds max: ')+pName(bad.pid));
  const r=DB.put('pr',{no:genNo('PR'),grn:g.id,wh:g.wh,t:Date.now(),reason:F.reason,items:lines.map(l=>({pid:l.pid,qty:+l.qty,batch:l.batch||''}))});
  lines.forEach(l=>addMove({pid:l.pid,wh:g.wh,qty:-l.qty,type:'po_ret',ref:r.id,batch:l.batch||''}));
  DB.put('grn',{...g,items:g.items.map((it,i)=>{const l=lines.find(x=>x.i===i);return l?{...it,ret:(+it.ret||0)+(+l.qty)}:it})});S.form=null;Alerts.low(false);
  toast(L('已退货出库','Return completed'));finish('po_view',{id:g.po})}

/* ---------- 销售开单 ---------- */
V.so_new=()=>{if(!S.form||S.form.kind!=='so'||S.form._v!==S.params.id+'|'+S.params.add){const ex=S.params.id&&DB.get('so',S.params.id);
    S.form=ex?{...JSON.parse(JSON.stringify(ex)),kind:'so'}:{kind:'so',cus:'',wh:myWh(),items:[],addr:'',note:''};S.form._v=S.params.id+'|'+S.params.add;
    if(S.params.add&&!S.form.items.some(i=>i.pid===S.params.add)){const p=DB.get('products',S.params.add);S.form.items.push({pid:p.id,qty:1,price:p.price})}}
  const F=S.form;
  return hdr(F.id?L('编辑销售单','Edit order'):L('销售开单','New sale'))+`<div class="pad">
   ${!S.online?`<div class="note-y" style="margin-top:4px">${L('当前离线：开单会暂存本机，联网后自动提交','Offline: the order is saved on this phone and submitted when online')}</div>`:''}
   <div class="fld"><label>${L('客户','Customer')}</label><div class="row gap">${partnerSel('cus',F.cus,"S.form.cus=this.value")}<button class="icbtn" onclick="newPartner('cus',id=>{S.form.cus=id;render(false)})">${ic('plus')}</button></div></div>
   <div class="fld"><label>${L('出货仓库','Ship from')}</label>${whSel(F.wh,"S.form.wh=this.value;render(false)")}</div>
   <div class="sec-h" style="margin-bottom:0">${L('商品','Items')} <span class="sm muted">${F.items.length}</span></div>${itemsEditor('so')}
   <div class="fld"><label>${L('送货地址','Delivery address')}</label><input class="inp" value="${esc(nm(F.addr))}" oninput="S.form.addr=this.value" placeholder="${L('客户自提可不填','Leave empty for pickup')}"></div>
   <div class="fld"><label>${L('备注','Note')}</label><textarea class="inp" oninput="S.form.note=this.value">${esc(nm(F.note))}</textarea></div></div>
  <div class="bbar"><div class="total"><span class="l">${L('合计','Total')}</span><span class="v" id="ftotal" data-notr>${money(docTotal(F))}</span></div><button class="bigbtn ghost" onclick="saveSO('draft')">${L('保存','Save')}</button><button class="bigbtn" onclick="saveSO('submitted')">${L('提交','Submit')}</button></div>`};
function saveSO(st){const F=S.form;if(!F.cus)return toast(L('请选择客户','Choose a customer'));const items=F.items.filter(i=>+i.qty>0);if(!items.length)return toast(L('请添加商品','Add at least one item'));
  const d=DB.put('so',{...F,kind:undefined,_v:undefined,items:items.map(i=>({...i,qty:+i.qty,price:+i.price})),status:st,no:F.no||genNo('SO'),t:F.t||Date.now()});S.form=null;
  toast(st==='draft'?L('已保存草稿','Draft saved'):S.online?L('已提交，库管将安排出库','Submitted — the warehouse will ship it'):L('已暂存本机，联网后自动提交','Saved offline — will submit when online'));finish('so_view',{id:d.id})}
V.so_view=()=>{const d=DB.get('so',S.params.id);if(!d)return hdr('')+emptyBox('doc',L('单据不存在','Not found'));const shs=DB.all('ships').filter(s=>s.ref===d.id);const rets=DB.all('sr').filter(r=>r.so===d.id);const acts=[];
  if(d.status==='draft'&&can('so'))acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('so_new',{id:'${d.id}'})">${L('编辑','Edit')}</button>`,`<button class="bigbtn" onclick="setSt('so','${d.id}','submitted')">${L('提交','Submit')}</button>`);
  if(d.status==='submitted'&&can('so_ship'))acts.push(`<button class="bigbtn" onclick="shipSheet('${d.id}')">${ic('out',18)} ${L('确认发货','Confirm shipment')}</button>`);
  if(d.status==='submitted'&&can('so')&&!can('so_ship'))acts.push(`<button class="bigbtn ghost" onclick="setSt('so','${d.id}','draft')">${L('撤回修改','Withdraw')}</button>`);
  if(d.status==='shipped'&&(can('so')||can('so_ship')))acts.push(`<button class="bigbtn" onclick="setSt('so','${d.id}','done')">${L('确认完成','Mark complete')}</button>`);
  if(['shipped','done'].includes(d.status)&&can('so_ret'))acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('sr_new',{so:'${d.id}'})">${ic('ret',18)} ${L('退货','Return')}</button>`);
  return hdr(L('销售单','Sales order'),`<button class="icbtn" onclick="copyText('${d.no}')">${ic('copy')}</button>`)+`<div class="pad">
   <div class="box" style="margin-top:6px"><div class="row between"><div class="b" style="font-size:18px" data-notr>${esc(d.no)}</div>${stB(SO_ST,d.status)}</div>${d.status!=='cancel'?steps(['draft','submitted','shipped','done'],d.status,SO_ST):''}
    <div class="kv" style="margin-top:14px"><div><div class="l">${L('客户','Customer')}</div><div class="v">${esc(ptName(d.cus))}</div></div><div><div class="l">${L('出货仓库','Warehouse')}</div><div class="v">${esc(whName(d.wh))}</div></div>
    <div><div class="l">${L('销售员','Sales rep')}</div><div class="v">${esc(userName(d.by))}</div></div><div><div class="l">${L('日期','Date')}</div><div class="v">${fdate(d.t)}</div></div>
    ${nm(d.addr)?`<div style="grid-column:1/3"><div class="l">${L('送货地址','Delivery address')}</div><div class="v">${esc(nm(d.addr))}</div></div>`:''}</div>
    ${d._q?`<div class="note-y" style="margin-top:12px">${ic('cloud',15)} ${L('暂存本机，联网后自动提交','Saved on this phone — submits when online')}</div>`:''}</div>
   <div class="box"><h4>${L('商品明细','Items')}</h4>${d.items.map(it=>{const p=P_(it.pid);return `<div class="li" onclick="go('product',{id:'${it.pid}'})">${thumb(p,38)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted" data-notr>${n2(it.qty)} ${esc(unit(p))} × ${n2(it.price)}${it.ret?` · <span class="red">${L('已退','returned')} ${n2(it.ret)}</span>`:''}</div></div><b data-notr>${n2(lineTotal(it))}</b></div>`}).join('')}
    <div class="row between" style="margin-top:10px"><span class="muted">${L('合计','Total')}</span><b style="font-size:20px" data-notr>${money(docTotal(d))}</b></div></div>
   ${rets.length?`<div class="box"><h4>${L('退货记录','Returns')}</h4>${rets.map(r=>`<div class="li" style="cursor:default"><div class="qi" style="background:var(--lilac);color:var(--purple)">${ic('ret',18)}</div><div style="flex:1;min-width:0"><div class="b sm" data-notr>${esc(r.no)}</div><div class="xs muted">${fdate(r.t)} · ${esc(nm(r.reason)||'')}</div></div><b data-notr>${n2(r.items.reduce((a,i)=>a+i.qty,0))}</b></div>`).join('')}</div>`:''}
   ${d.status!=='draft'?shipBox(shs,'out','so',d.id):''}</div>${acts.length?`<div class="bbar">${acts.join('')}</div>`:''}`};
/* 销售出库：确认发货 → 按先到期先出扣减库存，可同时登记物流 */
function shipSheet(id){const d=DB.get('so',id);const chk=d.items.map(it=>({it,av:qtyOf(it.pid,d.wh)}));const short=chk.filter(x=>x.av<x.it.qty);
  openSheet(`<div class="sh">${L('确认发货','Confirm shipment')}</div><div class="sm muted" data-notr>${esc(d.no)} · ${esc(ptName(d.cus))}</div>
   <div style="margin-top:10px">${chk.map(x=>`<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm one">${esc(pName(x.it.pid))}</div><div class="xs ${x.av<x.it.qty?'red b':'muted'}">${L('库存','Stock')} ${n2(x.av)}</div></div><b data-notr>-${n2(x.it.qty)}</b></div>`).join('')}</div>
   ${short.length?`<div class="note-r" style="margin-top:10px">${L('库存不足，无法发货。请先调拨或修改数量。','Not enough stock to ship. Transfer stock or change quantities.')}</div>`:`
   <div class="row between" style="margin-top:14px"><span class="b sm">${L('同时登记物流','Add logistics info')}</span>${sw(true,"this.classList.toggle('on');$('#shF').style.display=this.classList.contains('on')?'':'none'")}</div>
   <div id="shF"><div class="row gap" style="margin-top:10px"><select class="inp" id="shC">${CARRIERS.map(c=>`<option value="${c.id}">${esc(nm(c))}</option>`).join('')}</select><input class="inp" id="shT" placeholder="${L('运单号 / 车牌','Tracking no. / plate')}"></div>
   <input class="inp" id="shD" style="margin-top:8px" placeholder="${L('司机 / 联系电话（可选）','Driver / phone (optional)')}"></div>
   <button class="bigbtn" style="width:100%;margin-top:16px" onclick="doShip('${id}')">${ic('check',18)} ${L('确认出库，扣减库存','Ship & deduct stock')}</button>`}`)}
function doShip(id){const d=DB.get('so',id);const plan=[];for(const it of d.items){const a=allocate(it.pid,d.wh,+it.qty);if(!a)return toast(L('库存不足：','Not enough stock: ')+pName(it.pid));plan.push([it,a])}
  plan.forEach(([it,a])=>a.forEach(b=>addMove({pid:it.pid,wh:d.wh,qty:-b.qty,type:'so_out',ref:d.id,batch:b.batch||'',exp:b.exp||''})));
  DB.put('so',{...d,status:'shipped',st:Date.now(),items:d.items.map(i=>({...i,shipped:i.qty}))});
  const on=$('#shF')&&$('#shF').style.display!=='none';if(on){const c=$('#shC').value;DB.put('ships',{no:genNo('SH'),dir:'out',ref:d.id,refKind:'so',carrier:c,mode:carrier(c).mode,trackNo:$('#shT').value.trim(),driver:$('#shD').value.trim(),
    from:whName(d.wh),to:nm(d.addr)||ptName(d.cus),eta:fday(Date.now()+864e5),cost:0,status:'picked',t:Date.now(),ev:[{t:Date.now(),st:'picked',place:whName(d.wh),note:''}]})}
  Alerts.low(false);closeSheet(true);toast(L('已出库，库存已扣减','Shipped — stock deducted'));render(false)}

/* ---------- 销售退货：原单退货 → 恢复库存 ---------- */
V.sr_new=()=>{const sid=S.params.so;if(!sid){const l=DB.all('so').filter(s=>['shipped','done'].includes(s.status)).sort((a,b)=>b.t-a.t).slice(0,40);
    return hdr(L('销售退货','Customer return'))+`<div class="pad"><div class="note-g" style="margin-top:4px">${L('选择原销售单','Choose the original sales order')}</div><div style="margin-top:12px">${l.map(d=>docCard('so',d).replace(`go('so_view',{id:'${d.id}'})`,`S.form=null;S.params.so='${d.id}';render(true)`)).join('')||emptyBox('doc',L('暂无可退货的销售单','No shipped orders'))}</div></div>`}
  const d=DB.get('so',sid);if(!S.form||S.form.kind!=='sr'||S.form.so!==sid)S.form={kind:'sr',so:sid,reason:'',lines:d.items.map((it,i)=>({i,pid:it.pid,max:Math.max(0,(+it.shipped||it.qty)-(+it.ret||0)),qty:0}))};const F=S.form;
  return hdr(L('销售退货','Customer return'))+`<div class="pad"><div class="box" style="margin-top:6px"><div class="b" data-notr>${esc(d.no)}</div><div class="sm muted">${esc(ptName(d.cus))} · ${L('退回','Return to')} ${esc(whName(d.wh))}</div></div>
   ${F.lines.map((l,k)=>{const p=P_(l.pid);return `<div class="box" style="margin-top:10px;padding:12px 14px"><div class="row gap">${thumb(p,40)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted">${L('最多可退','Max')} ${n2(l.max)} ${esc(unit(p))}</div></div>
    <div class="qty"><button onclick="S.form.lines[${k}].qty=Math.max(0,S.form.lines[${k}].qty-1);render(false)">−</button><input type="number" value="${l.qty}" oninput="S.form.lines[${k}].qty=+this.value"><button onclick="S.form.lines[${k}].qty=Math.min(${l.max},S.form.lines[${k}].qty+1);render(false)">+</button></div></div></div>`}).join('')}
   <div class="fld"><label>${L('退货原因','Reason')}</label><input class="inp" value="${esc(F.reason)}" oninput="S.form.reason=this.value" placeholder="${L('如：破损、客户多订','e.g. damaged, over-ordered')}"></div></div>
  <div class="bbar"><button class="bigbtn" onclick="doSR()">${ic('in',18)} ${L('确认退货，恢复库存','Confirm & restock')}</button></div>`};
function doSR(){const F=S.form;const d=DB.get('so',F.so);const lines=F.lines.filter(l=>+l.qty>0);if(!lines.length)return toast(L('请填写退货数量','Enter return quantities'));
  const bad=lines.find(l=>+l.qty>l.max);if(bad)return toast(L('超过可退数量：','Exceeds max: ')+pName(bad.pid));
  const r=DB.put('sr',{no:genNo('SR'),so:d.id,wh:d.wh,t:Date.now(),reason:F.reason,items:lines.map(l=>({pid:l.pid,qty:+l.qty}))});
  lines.forEach(l=>{const om=DB.all('moves').filter(m=>m.ref===d.id&&m.pid===l.pid&&m.type==='so_out').sort((a,b)=>b.t-a.t)[0]||{};addMove({pid:l.pid,wh:d.wh,qty:+l.qty,type:'so_ret',ref:r.id,batch:om.batch||'',exp:om.exp||''})});
  DB.put('so',{...d,items:d.items.map((it,i)=>{const l=lines.find(x=>x.i===i);return l?{...it,ret:(+it.ret||0)+(+l.qty)}:it})});S.form=null;
  toast(L('已退货，库存已恢复','Returned — stock restored'));finish('so_view',{id:d.id})}

/* ---------- 简易盘点：录入实盘数 → 生成差异记录（不立即改账，待审核） ---------- */
V.take=()=>{if(!S.form||S.form.kind!=='take')S.form={kind:'take',wh:myWh(),items:[],note:''};const F=S.form;
  const diffs=F.items.filter(i=>i.real!==''&&+i.real!==i.sys);
  return hdr(L('库存盘点','Stock count'))+`<div class="pad"><div class="note-y" style="margin-top:4px">${L('录入实际盘点数量，系统自动算出差异。提交后不会立即改库存，管理员审核通过后才生成调整。','Enter the counted quantities; differences are calculated automatically. Stock only changes after an admin approves.')}</div>
   <div class="fld"><label>${L('盘点仓库','Warehouse')}</label>${whSel(F.wh,"S.form.wh=this.value;S.form.items.forEach(i=>i.sys=qtyOf(i.pid,this.value));render(false)")}</div>
   <div class="row gap" style="margin-top:12px"><button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="S.form.items=DB.all('products').filter(p=>qtyOf(p.id,S.form.wh)!==0).map(p=>({pid:p.id,sys:qtyOf(p.id,S.form.wh),real:''}));render(false)">${ic('grid',18)} ${L('载入本仓商品','Load all items')}</button><button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="openScan(L('扫码盘点','Scan to count'),c=>{const p=findByCode(c);if(!p){toast(L('未找到商品：','Not found: ')+c);return false}tkAdd(p.id)},true)">${ic('scan',18)} ${L('扫码盘点','Scan')}</button></div>
   ${F.items.map((it,i)=>{const p=P_(it.pid);const df=it.real===''?null:+it.real-it.sys;return `<div class="box" style="margin-top:10px;padding:12px 14px"><div class="row gap"><div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted">${L('账面','Book')} ${n2(it.sys)} ${esc(unit(p))}</div></div>
    <input class="inp" style="width:92px;padding:8px 10px;text-align:center;font-weight:800" type="number" inputmode="decimal" placeholder="${L('实盘','Count')}" value="${it.real}" oninput="tkSet(${i},this.value)"><b id="tkd${i}" style="min-width:54px;text-align:right" class="${df>0?'green':df<0?'red':'muted'}" data-notr>${df==null?'—':(df>0?'+':'')+n2(df)}</b></div></div>`}).join('')||emptyBox('clip',L('点“载入本仓商品”或扫码开始盘点','Load items or scan to start'))}
   <div class="fld"><label>${L('备注','Note')}</label><input class="inp" value="${esc(F.note)}" oninput="S.form.note=this.value"></div></div>
  <div class="bbar"><div class="total"><span class="l">${L('差异','Differences')}</span><span class="v" id="tkN">${diffs.length}</span></div><button class="bigbtn" onclick="saveTake()">${L('提交审核','Submit for review')}</button></div>`};
function tkAdd(pid){const F=S.form;let it=F.items.find(i=>i.pid===pid);if(!it){it={pid,sys:qtyOf(pid,F.wh),real:0};F.items.unshift(it)}it.real=(+it.real||0)+1;S.formDirty=true;
  const g=$('#scLog');if(g)g.innerHTML=`<div class="note-g" style="margin-top:8px">${esc(pName(pid))} · ${L('实盘','counted')} ${it.real}</div>`}
function tkSet(i,v){const it=S.form.items[i];it.real=v===''?'':+v;const df=it.real===''?null:it.real-it.sys;const e=$('#tkd'+i);if(e){e.textContent=df==null?'—':(df>0?'+':'')+n2(df);e.className=df>0?'green':df<0?'red':'muted'}
  const n=$('#tkN');if(n)n.textContent=S.form.items.filter(x=>x.real!==''&&+x.real!==x.sys).length}
function saveTake(){const F=S.form;const items=F.items.filter(i=>i.real!=='');if(!items.length)return toast(L('请至少录入一个实盘数','Enter at least one count'));
  const d=DB.put('counts',{no:genNo('ST'),wh:F.wh,status:'pending',t:Date.now(),note:F.note,items:items.map(i=>({pid:i.pid,sys:i.sys,real:+i.real}))});S.form=null;
  toast(L('已提交，等待管理员审核','Submitted for admin review'));finish('take_view',{id:d.id})}
V.take_view=()=>{const d=DB.get('counts',S.params.id);if(!d)return hdr('');const df=d.items.filter(i=>i.real!==i.sys);const val=df.reduce((a,i)=>a+(i.real-i.sys)*(P_(i.pid).cost||0),0);
  return hdr(L('盘点单','Stock count'))+`<div class="pad"><div class="box" style="margin-top:6px"><div class="row between"><div class="b" style="font-size:18px" data-notr>${esc(d.no)}</div>${stB(TK_ST,d.status)}</div>
   <div class="kv" style="margin-top:12px"><div><div class="l">${L('仓库','Warehouse')}</div><div class="v">${esc(whName(d.wh))}</div></div><div><div class="l">${L('盘点人','Counted by')}</div><div class="v">${esc(userName(d.by))}</div></div>
   <div><div class="l">${L('差异项','Differences')}</div><div class="v ${df.length?'red':''}">${df.length} / ${d.items.length}</div></div>${can('cost')?`<div><div class="l">${L('差异金额','Diff value')}</div><div class="v ${val<0?'red':'green'}" data-notr>${money(val)}</div></div>`:''}</div>
   ${d.status==='pending'?`<div class="note-y" style="margin-top:12px">${L('差异记录尚未改动库存，审核通过后自动生成盘点调整。','Stock not yet changed. An adjustment is posted when approved.')}</div>`:''}${d.rv?`<div class="xs muted" style="margin-top:10px">${L('审核','Reviewed')}: ${esc(userName(d.rv))} · ${fdate(d.rt)} ${d.rr?'· '+esc(d.rr):''}</div>`:''}</div>
   <div class="box"><h4>${L('明细','Lines')}<span class="sm muted">${L('账面 → 实盘','Book → Count')}</span></h4>${d.items.map(i=>{const x=i.real-i.sys;return `<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm one">${esc(pName(i.pid))}</div><div class="xs muted" data-notr>${n2(i.sys)} → ${n2(i.real)}</div></div><b class="${x>0?'green':x<0?'red':'muted'}" data-notr>${x>0?'+':''}${n2(x)}</b></div>`}).join('')||emptyBox('clip',L('暂无明细','No lines'))}</div></div>
   ${d.status==='pending'&&S.me.role==='admin'?`<div class="bbar"><button class="bigbtn ghost" onclick="tkReview('${d.id}',false)">${L('驳回','Reject')}</button><button class="bigbtn" onclick="tkReview('${d.id}',true)">${L('审核通过','Approve')}</button></div>`:''}`};
function tkReview(id,ok){const d=DB.get('counts',id);
  if(ok){d.items.forEach(i=>{const x=i.real-i.sys;if(!x)return;const p=P_(i.pid);let batch='';if(p.batch){const b=batchesOf(i.pid,d.wh).filter(b=>b.q>0);batch=x<0?(b[0]||{}).batch||'':(b[b.length-1]||{}).batch||''}addMove({pid:i.pid,wh:d.wh,qty:x,type:'adj',ref:d.id,batch})});
    DB.put('counts',{...d,status:'approved',rv:S.me.id,rt:Date.now()});toast(L('已审核，库存已调整','Approved — stock adjusted'));Alerts.low(false);render(false)}
  else openSheet(`<div class="sh">${L('驳回原因','Reason for rejection')}</div><input class="inp" id="rjR" style="margin-top:10px" placeholder="${L('如：请复盘第 3 排货架','e.g. please recount aisle 3')}"><button class="bigbtn red" style="width:100%;margin-top:16px" onclick="DB.put('counts',{...DB.get('counts','${id}'),status:'rejected',rv:S.me.id,rt:Date.now(),rr:$('#rjR').value});closeSheet();toast(L('已驳回','Rejected'));render(false)">${L('确认驳回','Reject')}</button>`)}

/* ================= 物流 ================= */
S.logiF='all';S.logiD='all';
V.logi=()=>{const all=DB.all('ships');const F={all:()=>true,transit:s=>['pending','picked','transit','customs'].includes(s.status),delivering:s=>s.status==='delivering',delivered:s=>s.status==='delivered',exception:s=>s.status==='exception'};
  const l=all.filter(F[S.logiF]).filter(s=>S.logiD==='all'||s.dir===S.logiD).sort((a,b)=>b.u-a.u);
  const mon=new Date();mon.setDate(1);mon.setHours(0,0,0,0);const fee=all.filter(s=>s.t>=+mon).reduce((a,s)=>a+(+s.cost||0),0);const today=fday(Date.now());
  return `<div class="pad" style="padding-top:16px"><div class="row between"><div class="ptitle">${L('物流','Logistics')}</div><div class="row" style="gap:8px"><button class="pill" onclick="go('logi_svc')">${ic('star',16)} ${L('物流服务','Services')}</button>${langBtn()}</div></div>
   <div class="stats"><div class="stat g"><div class="n">${all.filter(F.transit).length}</div><div class="l">${L('在途','In transit')}</div></div><div class="stat ${all.filter(F.exception).length?'y':''}"><div class="n">${all.filter(F.exception).length}</div><div class="l">${L('异常','Exceptions')}</div></div><div class="stat"><div class="n" data-notr><small style="font-size:11px;font-weight:700;opacity:.7">${CUR()} </small>${numK(fee)}</div><div class="l">${L('本月运费','Freight this month')}</div></div></div>
   <div class="searchbar"><span>${ic('search')}</span><input placeholder="${L('输入运单号 / 柜号查询','Tracking or container number')}" onkeydown="if(event.key==='Enter')trackFind(this.value)"><button class="scan" onclick="trackFind(this.previousElementSibling.value)">${ic('arrow',16)}</button></div>
   <div class="seg">${[['all',L('全部','All')],['transit',L('在途','Transit')],['delivering',L('派送','Delivery')],['delivered',L('签收','Done')],['exception',L('异常','Issue')]].map(([k,t])=>`<button class="${S.logiF===k?'on':''}" onclick="S.logiF='${k}';render(false)">${t}</button>`).join('')}</div>
   <div class="chips">${[['all',L('全部方向','All')],['out',L('发货（销售）','Outbound')],['in',L('到货（采购）','Inbound')]].map(([k,t])=>`<span class="chip sm ${S.logiD===k?'on':''}" onclick="S.logiD='${k}';render(false)">${t}</span>`).join('')}</div>
   <div style="margin-top:12px">${l.map(s=>{const c=carrier(s.carrier);const late=s.eta&&s.eta<today&&s.status!=='delivered';const ref=s.ref?(DB.get(s.refKind||'so',s.ref)||{}).no:'';
    return `<div class="wc" onclick="go('ship_view',{id:'${s.id}'})"><div class="top"><div class="row between" style="gap:8px"><h3><span class="qi" style="display:inline-grid;place-items:center;width:26px;height:26px;border-radius:8px;background:var(--soft)">${ic(MODES[s.mode||c.mode][2],15)}</span><span class="tt">${esc(nm(c))}</span><span class="tag">${s.dir==='in'?L('到货','In'):L('发货','Out')}</span></h3>${stB(SH_ST,s.status)}</div>
     <small><span data-notr>${esc(s.trackNo||s.no)}</span>${ref?' · <span data-notr>'+esc(ref)+'</span>':''}</small><div class="sm b one" style="margin-top:4px">${esc(nm(s.from))} → ${esc(nm(s.to))}</div>
     <div class="cols"><div><span class="l">${L('预计','ETA')}</span><span class="v ${late?'red':''}">${s.eta?fdate(new Date(s.eta).getTime(),false):'—'}</span></div><div><span class="l">${L('最新','Latest')}</span><span class="v">${s.ev&&s.ev.length?esc(nm(s.ev[s.ev.length-1].place)||'—'):'—'}</span></div><div><span class="l">${L('运费','Cost')}</span><span class="v" data-notr>${n2(s.cost||0)}</span></div></div></div></div>`}).join('')||emptyBox('truck',L('暂无物流记录','No shipments'))}</div></div>
  ${can('logi')?`<div style="position:sticky;bottom:84px;display:flex;justify-content:flex-end;padding:0 20px;pointer-events:none"><button class="pill g" style="pointer-events:auto;padding:14px 18px;box-shadow:0 8px 20px rgba(11,122,75,.35)" onclick="S.form=null;go('ship_new')">${ic('plus',16)} ${L('登记物流','New shipment')}</button></div>`:''}`};
function trackFind(q){q=(q||'').trim();if(!q)return;const s=DB.all('ships').find(x=>[x.trackNo,x.container,x.no].join(' ').toLowerCase().includes(q.toLowerCase()));
  if(s)return go('ship_view',{id:s.id});openSheet(`<div class="sh">${L('本系统内未找到','Not found in this system')}</div><div class="sm muted" style="margin-top:6px">${L('可以到承运商官网查询：','Look it up on the carrier website:')} <b data-notr>${esc(q)}</b></div>
  <div style="margin-top:10px">${CARRIERS.filter(c=>c.url).map(c=>`<div class="li" onclick="openExt('${c.url.replace('{no}',encodeURIComponent(q))}')"><div class="qi">${ic(MODES[c.mode][2],18)}</div><div class="b sm" style="flex:1">${esc(nm(c))}</div>${ic('link',16)}</div>`).join('')}</div>`)}
V.ship_view=()=>{const s=DB.get('ships',S.params.id);if(!s)return hdr('');const c=carrier(s.carrier);const url=trackUrl(s);const ref=s.ref&&DB.get(s.refKind||'so',s.ref);
  const flowI=SH_FLOW.indexOf(s.status);const ev=(s.ev||[]).slice().reverse();const tel=(String(nm(s.driver)||'').match(/[\d +]{7,}/)||[''])[0].trim();
  const col=s.status==='exception'?'var(--red)':s.status==='delivered'?'#161616':'var(--green)';
  return hdr(L('物流详情','Shipment'),url?`<button class="icbtn" onclick="openExt('${url}')">${ic('link')}</button>`:'')+`<div class="pad">
   <div class="box" style="margin-top:6px;background:${col};color:#fff"><div class="row between"><div class="row gap6">${ic(MODES[s.mode||c.mode][2])}<b>${esc(nm(c))}</b></div><span class="badge" style="background:#fff;color:${col==='#161616'?'#161616':col}">${L(SH_ST[s.status][0],SH_ST[s.status][1])}</span></div>
    <div style="font-size:22px;font-weight:800;margin-top:10px;letter-spacing:.3px" data-notr onclick="copyText('${esc(s.trackNo||s.no)}')">${esc(s.trackNo||s.no)} <span style="opacity:.7">${ic('copy',16)}</span></div>
    <div class="sm" style="opacity:.9;margin-top:4px">${esc(nm(s.from))} → ${esc(nm(s.to))}</div>
    ${s.status!=='exception'?`<div class="steps" style="margin-top:14px">${SH_FLOW.filter(x=>x!=='customs'||s.mode==='sea'||s.mode==='air').map((x,k,arr)=>{const ok=SH_FLOW.indexOf(x)<=flowI;return `<div class="st ${ok?'ok':''}" style="color:#fff;opacity:${ok?1:.6}"><b style="background:${ok?'#fff':'rgba(255,255,255,.3)'};color:${col}">${ok?'✓':''}</b>${L(SH_ST[x][0],SH_ST[x][1])}</div>`}).join('')}</div>`:`<div class="sm b" style="margin-top:10px">${ic('alert',15)} ${esc(nm((s.ev||[]).slice(-1)[0]?.note)||'')}</div>`}</div>
   <div class="box"><div class="kv"><div><div class="l">${L('方向','Direction')}</div><div class="v">${s.dir==='in'?L('到货（采购）','Inbound'):L('发货（销售）','Outbound')}</div></div><div><div class="l">${L('运输方式','Mode')}</div><div class="v">${L(MODES[s.mode||c.mode][0],MODES[s.mode||c.mode][1])}</div></div>
    <div><div class="l">${L('预计到达','ETA')}</div><div class="v">${esc(s.eta||'—')}</div></div><div><div class="l">${L('运费','Freight')}</div><div class="v" data-notr>${money(s.cost||0)}</div></div>
    ${s.container?`<div style="grid-column:1/3"><div class="l">${L('柜号 / 柜型','Container')}</div><div class="v" data-notr>${esc(s.container)}</div></div>`:''}
    ${nm(s.driver)?`<div style="grid-column:1/3"><div class="l">${L('司机 / 联系人','Driver / contact')}</div><div class="v">${esc(nm(s.driver))}</div></div>`:''}
    ${ref?`<div style="grid-column:1/3" onclick="go('${s.refKind||'so'}_view',{id:'${ref.id}'})"><div class="l">${L('关联单据','Linked order')}</div><div class="v green" data-notr>${esc(ref.no)} ›</div></div>`:''}</div></div>
   <div class="box"><h4>${L('物流轨迹','Tracking history')}</h4><div class="tl">${ev.map((e,i)=>`<div class="ev ${i===0?'cur':''}"><div class="t1">${L(SH_ST[e.st][0],SH_ST[e.st][1])} · ${esc(nm(e.place))}</div><div class="t2">${fdate(e.t)}${nm(e.note)?' · '+esc(nm(e.note)):''}</div>${(e.ph||[]).length?`<div class="photos">${e.ph.map(u=>`<div class="ph" onclick="openExt('${esc(u)}')"><img src="${esc(u)}"></div>`).join('')}</div>`:''}</div>`).join('')||`<div class="sm muted">${L('暂无轨迹','No events yet')}</div>`}</div></div>
   ${s.status==='exception'&&(s.mode==='sea'||s.mode==='air')?`<div class="note-y" style="margin-top:14px">${L('清关异常常见原因：缺少原产地证、商业发票与装箱单不一致、税号（TIN）未登记。可在“物流服务 → 清关资料清单”核对。','Common customs issues: missing certificate of origin, invoice and packing list mismatch, TIN not registered. See Services → Customs checklist.')}</div>`:''}
  </div><div class="bbar">${tel?`<button class="bigbtn ghost" onclick="location.href='tel:${tel.replace(/\s/g,'')}'">${ic('phone',18)} ${L('联系司机','Call')}</button>`:url?`<button class="bigbtn ghost" onclick="openExt('${url}')">${ic('link',18)} ${L('官网查询','Carrier site')}</button>`:''}${can('logi')&&s.status!=='delivered'?`<button class="bigbtn" onclick="shipUpd('${s.id}')">${L('更新状态','Update status')}</button>`:''}</div>`};
function shipUpd(id){const s=DB.get('ships',id);S.su={st:SH_FLOW[Math.min(SH_FLOW.length-1,Math.max(0,SH_FLOW.indexOf(s.status)+1))]||'transit',ph:[]};
  const draw=()=>`<div class="sh">${L('更新物流状态','Update status')}</div><div class="chips wrap" style="margin-top:12px">${Object.keys(SH_ST).map(k=>`<span class="chip ${S.su.st===k?'on':''}" onclick="S.su.st='${k}';this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${L(SH_ST[k][0],SH_ST[k][1])}</span>`).join('')}</div>
   <div class="fld"><label>${L('当前位置','Location')}</label><input class="inp" id="suP" placeholder="${L('如：特马港 / N1 公路','e.g. Tema Port / N1 Highway')}"></div><div class="fld"><label>${L('说明','Note')}</label><input class="inp" id="suN"></div>
   <div class="fld"><label>${L('照片（签收单、货物照片）','Photos (proof of delivery, cargo)')}</label><div class="photos" id="suPh">${phH()}</div></div>
   <button class="bigbtn" style="width:100%;margin-top:16px" onclick="doShipUpd('${id}')">${L('保存','Save')}</button>`;
  window.phH=()=>S.su.ph.map((u,i)=>`<div class="ph"><img src="${esc(u)}"><span class="x" onclick="S.su.ph.splice(${i},1);$('#suPh').innerHTML=phH()">×</span></div>`).join('')+`<div class="ph" onclick="pickImage(1000,u=>{S.su.ph.push(u);$('#suPh').innerHTML=phH()},true)">${ic('camera')}</div>`;
  openSheet(draw())}
function doShipUpd(id){const s=DB.get('ships',id);const e={t:Date.now(),st:S.su.st,place:$('#suP').value.trim(),note:$('#suN').value.trim(),ph:S.su.ph};
  DB.put('ships',{...s,status:e.st,ev:[...(s.ev||[]),e]});
  if(e.st==='delivered'&&s.refKind==='so'){const so=DB.get('so',s.ref);if(so&&so.status==='shipped')DB.put('so',{...so,status:'done'})}
  closeSheet();toast(L('已更新物流状态','Status updated'));render(false)}
V.ship_new=()=>{if(!S.form||S.form.kind!=='ship'){const p=S.params;const ref=p.ref&&DB.get(p.refKind,p.ref);
    S.form={kind:'ship',dir:p.dir||'out',refKind:p.refKind||'',ref:p.ref||'',carrier:p.dir==='in'?'cosco':'own',mode:p.dir==='in'?'sea':'road',trackNo:'',container:'',from:'',to:'',eta:fday(Date.now()+(p.dir==='in'?20:1)*864e5),cost:'',driver:''};
    if(ref){if(p.refKind==='so'){S.form.from=whName(ref.wh);S.form.to=nm(ref.addr)||ptName(ref.cus)}else{S.form.from=nm((DB.get('partners',ref.sup)||{}).city);S.form.to=whName(ref.wh)}}}
  const F=S.form;const refs=F.dir==='out'?DB.all('so').filter(s=>['submitted','shipped'].includes(s.status)):DB.all('po').filter(p=>['ordered','received'].includes(p.status));
  const fld=(k,t,ph,type)=>`<div class="fld"><label>${t}</label><input class="inp" ${type?`type="${type}"`:''} value="${esc(F[k])}" placeholder="${ph||''}" oninput="S.form.${k}=this.value"></div>`;
  return hdr(L('登记物流','New shipment'))+`<div class="pad"><div class="seg">${[['out',L('发货（销售）','Outbound')],['in',L('到货（采购）','Inbound')]].map(([k,t])=>`<button class="${F.dir===k?'on':''}" onclick="S.form.dir='${k}';S.form.ref='';S.form.refKind='${k==='out'?'so':'po'}';render(false)">${t}</button>`).join('')}</div>
   <div class="fld"><label>${L('关联单据（可选）','Linked order (optional)')}</label><select class="inp" onchange="S.form.ref=this.value;S.form.refKind='${F.dir==='out'?'so':'po'}'"><option value="">${L('不关联','None')}</option>${refs.map(r=>`<option value="${r.id}" ${r.id===F.ref?'selected':''}>${esc(r.no)} · ${esc(ptName(r.cus||r.sup))}</option>`).join('')}</select></div>
   <div class="fld"><label>${L('承运商','Carrier')}</label><select class="inp" onchange="S.form.carrier=this.value;S.form.mode=carrier(this.value).mode;render(false)">${CARRIERS.map(c=>`<option value="${c.id}" ${c.id===F.carrier?'selected':''}>${esc(nm(c))}</option>`).join('')}</select></div>
   <div class="chips wrap" style="margin-top:10px">${Object.keys(MODES).map(k=>`<span class="chip sm ${F.mode===k?'on':''}" onclick="S.form.mode='${k}';render(false)">${ic(MODES[k][2],14)} ${L(MODES[k][0],MODES[k][1])}</span>`).join('')}</div>
   ${fld('trackNo',F.mode==='road'?L('车牌 / 单号','Plate / ref no.'):L('运单号 / 提单号','Tracking / B/L no.'),'')}${F.mode==='sea'?fld('container',L('柜号 / 柜型','Container no. / type'),'MSKU1234567 / 40HQ'):''}
   <div class="row gap">${fld('from',L('起运地','From'))}${fld('to',L('目的地','To'))}</div><div class="row gap">${fld('eta',L('预计到达','ETA'),'','date')}${fld('cost',L('运费','Freight'),'0','number')}</div>
   ${fld('driver',L('司机 / 联系人电话','Driver / contact phone'))}</div>
  <div class="bbar"><button class="bigbtn" onclick="saveShip()">${L('保存','Save')}</button></div>`};
function saveShip(){const F=S.form;if(!F.trackNo&&F.mode!=='road')return toast(L('请填写运单号','Enter a tracking number'));if(!F.from||!F.to)return toast(L('请填写起运地和目的地','Enter origin and destination'));
  const d=DB.put('ships',{no:genNo('SH'),dir:F.dir,ref:F.ref,refKind:F.ref?F.refKind:'',carrier:F.carrier,mode:F.mode,trackNo:F.trackNo.trim(),container:F.container,from:F.from,to:F.to,eta:F.eta,cost:+F.cost||0,driver:F.driver,status:'pending',t:Date.now(),ev:[{t:Date.now(),st:'pending',place:F.from,note:''}]});
  S.form=null;toast(L('已登记','Saved'));finish('ship_view',{id:d.id})}
/* 物流服务：运费估算 / 预约提货送货 / 承运商查询 / 清关资料 */
V.logi_svc=()=>{const st=(DB.get('settings','app')||{}).rates||{};S.fc=S.fc||{mode:'sea',kg:1000,cbm:2};const bk=DB.all('svc').sort((a,b)=>b.t-a.t);
  const BK={new:['待处理','New','b-gold'],confirmed:['已安排','Scheduled','b-blue'],done:['已完成','Done','b-green'],cancel:['已取消','Cancelled','b-grey']};
  return hdr(L('物流服务','Logistics services'))+`<div class="pad">
   <div class="box" style="margin-top:6px;background:var(--green);color:#fff"><div class="row gap"><div class="qi" style="width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,.2);display:grid;place-items:center">${ic('calc')}</div><div><div class="b" style="font-size:17px">${L('运费估算','Freight estimate')}</div><div class="xs" style="opacity:.85">${L('按计费重量估算，仅供参考','By chargeable weight · for reference')}</div></div></div>
    <div class="chips wrap" style="margin-top:12px">${Object.keys(MODES).map(k=>`<span class="chip sm ${S.fc.mode===k?'on':''}" style="${S.fc.mode===k?'background:#fff;color:#161616':'background:rgba(255,255,255,.18);color:#fff'}" onclick="S.fc.mode='${k}';render(false)">${L(MODES[k][0],MODES[k][1])}</span>`).join('')}</div>
    <div class="row gap" style="margin-top:10px"><div style="flex:1"><div class="xs" style="opacity:.85;margin-bottom:4px">${L('重量 kg','Weight kg')}</div><input class="inp" type="number" value="${S.fc.kg}" oninput="S.fc.kg=+this.value;fcCalc()"></div><div style="flex:1"><div class="xs" style="opacity:.85;margin-bottom:4px">${L('体积 m³','Volume m³')}</div><input class="inp" type="number" value="${S.fc.cbm}" oninput="S.fc.cbm=+this.value;fcCalc()"></div></div>
    <div id="fcOut" style="margin-top:12px">${fcHTML(st)}</div></div>
   <div class="sec-h">${L('预约物流','Book logistics')}<a onclick="bookSheet()">+ ${L('新预约','New')}</a></div>
   <div class="box" style="margin-top:0;padding:4px 16px">${bk.map(b=>`<div class="li" onclick="${S.me.role==='admin'?`bookAdmin('${b.id}')`:''}"><div class="qi">${ic(b.type==='customs'?'shield':'calendar',18)}</div><div style="flex:1;min-width:0"><div class="b sm one">${{pickup:L('上门提货','Pickup'),delivery:L('送货上门','Delivery'),customs:L('代理报关','Customs clearance')}[b.type]} · ${esc(nm(b.from))} → ${esc(nm(b.to))}</div><div class="xs muted one">${esc(b.date||'')} · ${n2(b.weight||0)} kg · ${esc(userName(b.by))}</div></div><span class="badge ${BK[b.status][2]}">${L(BK[b.status][0],BK[b.status][1])}</span></div>`).join('')||`<div class="sm muted" style="padding:12px 0">${L('还没有预约','No bookings yet')}</div>`}</div>
   <div class="sec-h">${L('承运商官网查询','Carrier tracking sites')}</div>
   <div class="box" style="margin-top:0;padding:4px 16px">${CARRIERS.filter(c=>c.url).map(c=>`<div class="li" onclick="const n=prompt('${L('输入运单号 / 柜号','Enter tracking / container no.')}');if(n)openExt('${c.url}'.replace('{no}',encodeURIComponent(n.trim())))"><div class="qi">${ic(MODES[c.mode][2],18)}</div><div style="flex:1;min-width:0"><div class="b sm">${esc(nm(c))}</div><div class="xs muted">${L(MODES[c.mode][0],MODES[c.mode][1])}</div></div>${ic('link',16)}</div>`).join('')}</div>
   <div class="sec-h">${L('进口清关资料清单','Import customs checklist')}</div>
   <div class="box" style="margin-top:0">${[[L('提单 / 空运单','Bill of lading / air waybill')],[L('商业发票','Commercial invoice')],[L('装箱单（与发票一致）','Packing list (matching invoice)')],[L('原产地证','Certificate of origin')],[L('进口申报（ICUMS 系统）','Import declaration (ICUMS)')],[L('纳税人识别号 TIN','Taxpayer ID (TIN)')],[L('货物保险单（如有）','Insurance certificate (if any)')]].map((x,i)=>`<label class="li" style="cursor:pointer"><input type="checkbox" ${LS.get('cc'+i,false)?'checked':''} onchange="LS.set('cc${i}',this.checked)" style="width:20px;height:20px;accent-color:#0B7A4B"><span class="sm b" style="flex:1">${x[0]}</span></label>`).join('')}
    <div class="xs muted" style="margin-top:8px">${L('以加纳海关最新要求为准；常用口岸：特马港、塔科拉迪港、科托卡国际机场。','Follow the latest Ghana customs rules. Main entry points: Tema Port, Takoradi Port, Kotoka International Airport.')}</div></div>
  </div>`};
function fcHTML(st){const f=S.fc;const r=(st||((DB.get('settings','app')||{}).rates)||{})[f.mode]||[1,1,3];const fac={sea:1000,air:167,road:333,express:200}[f.mode];
  const cw=Math.max(f.kg||0,(f.cbm||0)*fac);const lo=cw*r[0]*.9,hi=cw*r[0]*1.15;
  return `<div class="row between"><div><div class="xs" style="opacity:.85">${L('计费重量','Chargeable weight')}</div><div class="b" data-notr>${n2(cw)} kg</div></div><div style="text-align:right"><div class="xs" style="opacity:.85">${L('预估运费','Estimated cost')}</div><div class="b" style="font-size:19px" data-notr>${moneyK(lo)} – ${moneyK(hi)}</div></div></div><div class="xs" style="opacity:.85;margin-top:6px">${L(`预计时效 ${r[1]}–${r[2]} 天 · 以承运商报价为准`,`Transit ${r[1]}–${r[2]} days · carrier quote prevails`)}</div>`}
function fcCalc(){const o=$('#fcOut');if(o)o.innerHTML=fcHTML()}
function bookSheet(){S.bk={type:'pickup',mode:'road'};openSheet(`<div class="sh">${L('预约物流','Book logistics')}</div>
  <div class="chips wrap" style="margin-top:12px">${[['pickup',L('上门提货','Pickup')],['delivery',L('送货上门','Delivery')],['customs',L('代理报关','Customs')]].map(([k,t],i)=>`<span class="chip ${i?'':'on'}" onclick="S.bk.type='${k}';this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${t}</span>`).join('')}</div>
  <div class="row gap"><div class="fld" style="flex:1"><label>${L('起点','From')}</label><input class="inp" id="bkF" value="${esc(whName(myWh()))}"></div><div class="fld" style="flex:1"><label>${L('终点','To')}</label><input class="inp" id="bkT"></div></div>
  <div class="row gap"><div class="fld" style="flex:1"><label>${L('日期','Date')}</label><input class="inp" id="bkD" type="date" value="${fday(Date.now()+864e5)}"></div><div class="fld" style="flex:1"><label>${L('重量 kg','Weight kg')}</label><input class="inp" id="bkW" type="number"></div></div>
  <div class="fld"><label>${L('需求说明','Details')}</label><input class="inp" id="bkN" placeholder="${L('车型、装卸、联系人等','Vehicle, loading, contact…')}"></div>
  <button class="bigbtn" style="width:100%;margin-top:16px" onclick="if(!$('#bkT').value.trim())return toast(L('请填写终点','Enter destination'));DB.put('svc',{no:genNo('BK'),type:S.bk.type,mode:'road',from:$('#bkF').value,to:$('#bkT').value,date:$('#bkD').value,weight:+$('#bkW').value||0,note:$('#bkN').value,status:'new',t:Date.now()});closeSheet();toast(L('已提交预约，管理员会尽快安排','Booking sent — the admin will schedule it'));render(false)">${L('提交预约','Submit booking')}</button>`)}
function bookAdmin(id){const b=DB.get('svc',id);openSheet(`<div class="sh">${L('处理预约','Handle booking')}</div><div class="sm muted" data-notr>${esc(b.no)}</div><div class="sm" style="margin-top:8px">${esc(nm(b.from))} → ${esc(nm(b.to))} · ${esc(b.date)}<br>${esc(nm(b.note)||'')}</div>
  <div class="row gap" style="margin-top:16px">${[['confirmed',L('已安排','Scheduled')],['done',L('已完成','Done')],['cancel',L('取消','Cancel')]].map(([k,t])=>`<button class="bigbtn ${k==='cancel'?'ghost':''}" style="height:46px;font-size:14px" onclick="DB.put('svc',{...DB.get('svc','${id}'),status:'${k}'});closeSheet();render(false)">${t}</button>`).join('')}</div>`)}

/* ================= 报表 ================= */
S.rpR='today';S.rpK='val';
V.report=()=>{const now=Date.now();const from=S.rpR==='today'?dayStart():S.rpR==='week'?dayStart()-((new Date().getDay()+6)%7)*864e5:+new Date(new Date().getFullYear(),new Date().getMonth(),1);
  const so=DB.all('so').filter(s=>s.status!=='draft'&&s.status!=='cancel'&&s.t>=from);const sales=so.reduce((a,s)=>a+docTotal(s),0);
  const mv=DB.all('moves').filter(m=>m.t>=from);const outN=new Set(mv.filter(m=>m.type==='so_out'||m.type==='po_ret').map(m=>m.ref)).size,inN=new Set(mv.filter(m=>m.type==='po_in'||m.type==='so_ret').map(m=>m.ref)).size;
  const gp=so.reduce((a,s)=>a+s.items.reduce((b,i)=>b+(i.price-(P_(i.pid).cost||0))*i.qty,0),0);
  const days=[...Array(7)].map((_,i)=>{const d0=dayStart()-(6-i)*864e5;const v=DB.all('so').filter(s=>s.status!=='draft'&&s.status!=='cancel'&&s.t>=d0&&s.t<d0+864e5).reduce((a,s)=>a+docTotal(s),0);return {d0,v}});
  const mx=Math.max(1,...days.map(d=>d.v));
  const rank=DB.all('products').map(p=>{const q=qtyOf(p.id);return {p,q,v:q*(can('cost')?p.cost:p.price)}}).sort((a,b)=>S.rpK==='val'?b.v-a.v:b.q-a.q).slice(0,20);const rmx=Math.max(1,...rank.map(r=>S.rpK==='val'?r.v:r.q));
  const last=DB.all('moves').sort((a,b)=>b.t-a.t).slice(0,10);
  return hdr(L('简易报表','Reports'),`<button class="icbtn" onclick="exportSheet()">${ic('download')}</button>`)+`<div class="pad">
   <div class="seg">${[['today',L('今日','Today')],['week',L('本周','This week')],['month',L('本月','This month')]].map(([k,t])=>`<button class="${S.rpR===k?'on':''}" onclick="S.rpR='${k}';render(false)">${t}</button>`).join('')}</div>
   <div class="stats"><div class="stat g"><div class="n" data-notr><small style="font-size:11px;font-weight:700;opacity:.8">${CUR()} </small>${numK(sales)}</div><div class="l">${L('销售额','Sales')}</div></div><div class="stat"><div class="n">${outN}</div><div class="l">${L('出库笔数','Outbound')}</div></div><div class="stat"><div class="n">${inN}</div><div class="l">${L('入库笔数','Inbound')}</div></div></div>
   ${can('cost')?`<div class="row between sm" style="margin:10px 4px 0"><span class="muted">${L('毛利（估算）','Gross profit (est.)')}</span><b data-notr>${money(gp)}</b></div>`:''}
   <div class="box"><h4>${L('近 7 天销售额','Sales, last 7 days')}<span class="sm muted" data-notr>${moneyK(days.reduce((a,d)=>a+d.v,0))}</span></h4><div class="bars">${days.map((d,i)=>`<div class="bc"><span class="bv" data-notr>${d.v?moneyK(d.v).replace(CUR()+' ',''):''}</span><div class="bar ${i===6?'on':''}" style="height:${Math.max(3,d.v/mx*88)}%"></div><span class="bl">${i===6?L('今天','Today'):S.lang==='zh'?(new Date(d.d0).getMonth()+1)+'/'+new Date(d.d0).getDate():new Date(d.d0).getDate()+' '+MON[new Date(d.d0).getMonth()]}</span></div>`).join('')}</div></div>
   <div class="box"><h4>${L('商品库存排行 前 20','Top 20 by stock')}<span class="seg" style="margin:0;padding:3px;background:var(--soft)">${[['val',L('金额','Value')],['qty',L('数量','Qty')]].map(([k,t])=>`<button style="padding:5px 10px;font-size:12px" class="${S.rpK===k?'on':''}" onclick="S.rpK='${k}';render(false)">${t}</button>`).join('')}</span></h4>
    ${rank.map((r,i)=>`<div class="rank" onclick="go('product',{id:'${r.p.id}'})" style="cursor:pointer"><span class="no ${i<3?'t':''}">${i+1}</span><div style="flex:1;min-width:0"><div class="row between"><span class="sm b one">${esc(nm(r.p.n))}</span><span class="sm b" data-notr>${S.rpK==='val'?moneyK(r.v):n2(r.q)}</span></div><div class="meter"><i style="width:${(S.rpK==='val'?r.v:r.q)/rmx*100}%"></i></div></div></div>`).join('')}</div>
   <div class="box"><h4>${L('最近 10 条出入库流水','Last 10 movements')}</h4>${last.map(mvRow).join('')}</div></div>`};
function exportSheet(){openSheet(`<div class="sh">${L('导出下载','Export')}</div><div class="sm muted">${L('CSV 文件可用 Excel / WPS 打开','CSV files open in Excel or WPS')}</div>
  <div style="margin-top:10px">${[['stock',L('库存表（含分仓、状态）','Stock list (by warehouse, status)')],['moves',L('出入库流水（全部）','All stock movements')],['so',L('销售单汇总','Sales orders')],['ships',L('物流记录','Shipments')]].map(([k,t])=>`<div class="li" onclick="exportCSV('${k}')"><div class="qi">${ic('download',18)}</div><div class="b sm" style="flex:1">${t}</div>${ic('chev',16)}</div>`).join('')}</div>`)}
function exportCSV(k){const d=fday(Date.now());let rows;
  if(k==='stock'){const ws=DB.all('wh');rows=[[L('编码','Code'),L('条码','Barcode'),L('商品','Item'),L('单位','Unit'),...ws.map(w=>nm(w.n)),L('合计','Total'),L('状态','Status'),L('售价','Price')].concat(can('cost')?[L('成本','Cost')]:[])]
    .concat(DB.all('products').map(p=>{const q=qtyOf(p.id);return [p.code,p.bar,nm(p.n),unit(p),...ws.map(w=>qtyOf(p.id,w.id)),q,L(ST_NAME[stStatus(p,q)][0],ST_NAME[stStatus(p,q)][1]),p.price].concat(can('cost')?[p.cost]:[])}))}
  else if(k==='moves')rows=[[L('时间','Time'),L('类型','Type'),L('商品','Item'),L('仓库','Warehouse'),L('数量','Qty'),L('批次','Batch'),L('效期','Expiry'),L('操作人','By')]].concat(DB.all('moves').sort((a,b)=>b.t-a.t).map(m=>[fday(m.t)+' '+new Date(m.t).toTimeString().slice(0,5),mvName(m.type),pName(m.pid),whName(m.wh),m.qty,m.batch||'',m.exp||'',userName(m.by)]));
  else if(k==='so')rows=[[L('单号','No.'),L('日期','Date'),L('客户','Customer'),L('仓库','Warehouse'),L('状态','Status'),L('金额','Total')]].concat(DB.all('so').sort((a,b)=>b.t-a.t).map(s=>[s.no,fday(s.t),ptName(s.cus),whName(s.wh),L(SO_ST[s.status][0],SO_ST[s.status][1]),docTotal(s)]));
  else rows=[[L('单号','No.'),L('方向','Direction'),L('承运商','Carrier'),L('运单号','Tracking'),L('起运地','From'),L('目的地','To'),L('状态','Status'),L('预计到达','ETA'),L('运费','Cost')]].concat(DB.all('ships').map(s=>[s.no,s.dir,nm(carrier(s.carrier)),s.trackNo,nm(s.from),nm(s.to),L(SH_ST[s.status][0],SH_ST[s.status][1]),s.eta,s.cost]));
  closeSheet();downloadFile(`${L('华宝进销存','ChinaPawStock')}_${k}_${d}.csv`,csv(rows))}

/* ================= 消息 ================= */
V.msgs=()=>{const a=Alerts.list();return hdr(L('消息','Messages'),a.some(n=>!n.read)?`<button class="pill w" onclick="markRead();render(false)">${L('全部已读','Read all')}</button>`:'')+`<div class="pad">
  <div class="xs muted" style="margin:4px 2px 10px">${L('新订单、库存不足、待出库、物流动态会在这里提醒，可在“我的 → 消息提醒”中开关。','New orders, low stock, shipping tasks and logistics updates appear here. Turn them on or off in Me → Notifications.')}</div>
  <div class="box" style="margin-top:0;padding:4px 16px">${a.map(n=>`<div class="li" onclick="markRead('${n.id}');${n.go?`go('${n.go[0]}',${JSON.stringify(n.go[1]).replace(/"/g,"'")})`:'render(false)'}"><div class="qi" style="background:${n.c};color:#fff">${ic(n.ic||'bell',18)}</div><div style="flex:1;min-width:0"><div class="sm ${n.read?'':'b'}">${esc(L(n.zh,n.en))}</div><div class="xs muted">${ago(n.t)}</div></div>${n.read?'':'<span style="width:8px;height:8px;border-radius:50%;background:var(--red);flex:none"></span>'}</div>`).join('')||emptyBox('bell',L('暂无消息','No messages'))}</div></div>`};

/* ================= 我的 / 设置 ================= */
V.me=()=>{const me=S.me;const pf=Alerts.prefs();const row=(icon,t,sub,fn,right)=>`<div class="li" onclick="${fn||''}"><div class="qi">${ic(icon,18)}</div><div style="flex:1;min-width:0"><div class="b sm">${t}</div>${sub?`<div class="xs muted one">${sub}</div>`:''}</div>${right==null?ic('chev',16):right}</div>`;
  const tg=k=>sw(pf[k],`const p=Alerts.prefs();p.${k}=!p.${k};LS.set('prefs_'+S.me.id,p);render(false)`);
  const sess=LS.get(SK,{});
  return `<div class="pad" style="padding-top:16px"><div class="row between"><div class="ptitle">${L('我的','Me')}</div>${langBtn()}</div>
   <div class="box" style="display:flex;gap:14px;align-items:center"><div class="av lg">${esc(nm(me.name).slice(0,1))}</div><div style="min-width:0;flex:1"><div class="b" style="font-size:20px">${esc(nm(me.name))}</div><div class="row gap6" style="margin-top:4px"><span class="badge ${ROLES[me.role].c}">${roleName(me.role)}</span><span class="xs muted" data-notr>${esc(me.phone)}</span></div><div class="xs muted" style="margin-top:4px">${L('默认仓库','Default warehouse')}: ${esc(whName(me.wh))}</div></div></div>
   <div class="sec-h">${L('账号','Account')}</div><div class="box" style="margin-top:0;padding:4px 16px">
    ${row('user',L('个人资料','Profile'),esc(nm(me.name)),'profileSheet()')}${row('lock',L('修改密码','Change password'),'','pwdSheet()')}${row('wh',L('默认仓库','Default warehouse'),esc(whName(me.wh)),'whSheet()')}
    ${row('shield',L('自动登录（信任此设备）','Stay signed in on this device'),L('关闭后每次打开都需输入密码','Off: password needed every time'),'',sw(!!sess.trust,"const s=LS.get(SK,{});s.trust=!s.trust;LS.set(SK,s);render(false)"))}</div>
   <div class="sec-h">${L('消息提醒','Notifications')}</div><div class="box" style="margin-top:0;padding:4px 16px">
    ${row('cart',L('新订单','New orders'),'','',tg('order'))}${row('alert',L('库存不足','Low stock'),'','',tg('low'))}${row('out',L('待出库 / 待入库任务','Shipping & receiving tasks'),'','',tg('ship'))}${row('truck',L('物流动态','Logistics updates'),'','',tg('logi'))}
    ${row('bell',L('消息列表','Message list'),Alerts.unread()?L(`${Alerts.unread()} 条未读`,`${Alerts.unread()} unread`):'',"go('msgs')")}</div>
   <div class="sec-h">${L('数据同步','Data sync')}</div><div class="box" style="margin-top:0;padding:4px 16px">
    ${row('cloud',DB.cloud?L('云端实时同步','Cloud real-time sync'):L('本机演示模式','Local demo mode'),L('最后同步：','Last sync: ')+(DB.lastSync?fdate(DB.lastSync):'—')+(DB.outbox.length?L(` · ${DB.outbox.length} 条待提交`,` · ${DB.outbox.length} pending`):''),'syncSheet()',`<span class="syncchip" id="syncChip"></span>`)}
    ${row('refresh',L('立即同步','Sync now'),'','Sync.run(true)')}${row('chart',L('简易报表','Reports'),'',"go('report')")}
    ${!DB.cloud&&me.role==='admin'?row('trash',L('重置演示数据','Reset demo data'),L('恢复为初始示例','Restore sample data'),'resetDemo()'):''}</div>
   <div class="sec-h">${L('应用','App')}</div><div class="box" style="margin-top:0;padding:4px 16px">
    ${row('globe',L('语言','Language'),`<span data-notr>${S.lang==='zh'?'中文 → English':'English → 中文'}</span>`,`setLang('${S.lang==='zh'?'en':'zh'}')`)}
    ${!isNative()&&!isStandalone()?row('home',L('安装到手机桌面','Install on home screen'),L('像应用一样从桌面打开','Open from your home screen like an app'),'pwaInstall()'):''}
    ${!isNative()?row('download',L('下载安卓安装包','Download Android app'),L('支持应用内一键更新','APK with in-app updates'),'doApk()'):''}
    ${row('refresh',L('检查更新','Check for updates'),`<span data-notr>v${APP_VER} · build ${APP_BUILD}</span>`,'checkUpdate(true)',hasUpd()?'<span style="width:9px;height:9px;border-radius:50%;background:var(--red)"></span>':null)}
    ${row('info',L('关于','About'),L('与华宝招聘同一套架构','Built on the ChinaPaw stack'),'aboutSheet()')}</div>
   <button class="bigbtn ghost" style="width:100%;margin-top:18px;color:var(--red)" onclick="doLogout()">${ic('logout',18)} ${L('退出登录','Sign out')}</button>
   <div class="xs muted" style="text-align:center;margin-top:14px" data-notr>v${APP_VER} · build ${APP_BUILD}</div></div>`};
function profileSheet(){openSheet(`<div class="sh">${L('个人资料','Profile')}</div><div class="fld"><label>${L('姓名','Name')}</label><input class="inp" id="pfN" value="${esc(nm(S.me.name))}"></div><div class="fld"><label>${L('手机号','Phone')}</label><input class="inp" value="${esc(S.me.phone)}" disabled></div>
  <div class="xs muted" style="margin-top:8px">${L('手机号与角色由管理员修改','Phone and role are managed by your admin')}</div><button class="bigbtn" style="width:100%;margin-top:16px" onclick="saveProfile({name:$('#pfN').value.trim()})">${L('保存','Save')}</button>`)}
function saveProfile(ch){if(ch.name==='')return toast(L('请填写姓名','Enter your name'));Object.assign(S.me,ch);const s=LS.get(SK,{});s.me=S.me;LS.set(SK,s);
  if(DB.cloud)rpc('jxc_update_me',{p_token:S.token,p_name:S.me.name,p_wh:S.me.wh}).catch(e=>toast(e.message));else{const u=DB.get('users',S.me.id);if(u)DB.put('users',{...u,...ch})}
  closeSheet();toast(L('已保存','Saved'));render(false)}
function whSheet(){openSheet(`<div class="sh">${L('默认仓库','Default warehouse')}</div><div style="margin-top:8px">${DB.all('wh').map(w=>`<div class="li" onclick="saveProfile({wh:'${w.id}'})"><div class="qi">${ic('wh',18)}</div><div class="b sm" style="flex:1">${esc(nm(w.n))}</div>${w.id===S.me.wh?ic('check'):''}</div>`).join('')}</div>`)}
function pwdSheet(){openSheet(`<div class="sh">${L('修改密码','Change password')}</div><div class="fld"><label>${L('原密码','Current password')}</label><input class="inp" id="pw0" type="password"></div><div class="fld"><label>${L('新密码（至少 6 位）','New password (min 6)')}</label><input class="inp" id="pw1" type="password"></div><div class="fld"><label>${L('再输一次','Repeat new password')}</label><input class="inp" id="pw2" type="password"></div>
  <div id="pwE" class="sm red" style="margin-top:8px"></div><button class="bigbtn" style="width:100%;margin-top:12px" onclick="doPw()">${L('确认修改','Change')}</button>`)}
async function doPw(){const a=$('#pw0').value,b=$('#pw1').value,c=$('#pw2').value,e=$('#pwE');if(b.length<6)return e.textContent=L('新密码至少 6 位','At least 6 characters');if(b!==c)return e.textContent=L('两次输入不一致','Passwords do not match');
  try{await changePw(a,b);closeSheet();toast(L('密码已修改','Password changed'))}catch(x){e.textContent=x.message}}
function aboutSheet(){openSheet(`<div class="row gap"><img src="logo.svg" class="logo" style="width:56px;height:56px;border-radius:16px"><div><div class="sh">${L('华宝进销存','ChinaPaw Stock')}</div><div class="sm muted" data-notr>v${APP_VER} · build ${APP_BUILD}</div></div></div>
  <div class="sm" style="margin-top:14px;line-height:1.75">${L('移动端进销存：库存查询、扫码、盘点、采购、销售、退货、物流跟踪与服务、实时同步、离线开单、消息提醒和简易报表。','Mobile inventory: stock lookup, scanning, counts, purchasing, sales, returns, logistics tracking & services, live sync, offline orders, alerts and reports.')}</div>
  <div class="note-g" style="margin-top:12px">${L('网页版、手机桌面版和安卓安装包共用同一份网页，改一次全部更新。','Web, home-screen (PWA) and Android app share one web page — update once, everywhere updates.')}</div>`)}
async function resetDemo(){if(!confirm(L('确定恢复为初始演示数据？本机的修改会被清除。','Restore the sample data? Changes on this device will be lost.')))return;await seedDemo();Object.keys(localStorage).filter(k=>k.startsWith('jxc_notes')||k.startsWith('jxc_notesInit')).forEach(k=>localStorage.removeItem(k));bc('reset');Alerts.first();toast(L('已恢复演示数据','Sample data restored'));tab('home')}

/* ---------- 安装到手机桌面（PWA，与 ChinaPaw 相同的引导） ---------- */
let deferredPrompt=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e});
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function pwaInstall(){if(deferredPrompt){deferredPrompt.prompt();deferredPrompt.userChoice.finally(()=>deferredPrompt=null);return}
  const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  openSheet(`<div class="row gap"><img src="icon-192.png" style="width:40px;height:40px;border-radius:11px"><div class="sh">${L('安装到手机桌面','Install on home screen')}</div></div>
   <div class="box">${ios?`<div class="sm" style="line-height:1.9">1. ${L('用 Safari 打开本页','Open this page in Safari')}<br>2. ${L('点底部“分享”按钮','Tap the Share button')}<br>3. ${L('选择“添加到主屏幕” → “添加”','Choose “Add to Home Screen” → “Add”')}</div>`
    :`<div class="sm" style="line-height:1.9">1. ${L('用 Chrome 打开本页','Open this page in Chrome')}<br>2. ${L('点右上角 ⋮ 菜单','Tap the ⋮ menu')}<br>3. ${L('选择“安装应用”或“添加到主屏幕”','Choose “Install app” or “Add to Home screen”')}</div>`}</div>
   <div class="note-g" style="margin-top:12px">${L('安装后有新版本会自动更新，不需要重新安装。','Once installed, new versions update automatically.')}</div>
   ${!ios?`<button class="bigbtn dark" style="width:100%;margin-top:14px" onclick="closeSheet();doApk()">${ic('download',18)} ${L('或者下载安卓安装包','Or download the Android APK')}</button>`:''}`)}
function pwaBar(){const sc=$('#screen');let el=$('#pwaBar');const show=S.view==='login'&&!isNative()&&!isStandalone()&&/Android|iPhone|iPad/i.test(navigator.userAgent)&&!LS.get('pwaHide',false);
  if(!show){if(el)el.remove();return}if(!el){el=document.createElement('div');el.id='pwaBar';sc.appendChild(el)}el.style.bottom='calc(16px + env(safe-area-inset-bottom))';
  el.innerHTML=`<button onclick="pwaInstall()">${ic('download',16)} ${L('安装到手机桌面','Install on home screen')}</button>`}

/* ---------- 下拉刷新（兜底） ---------- */
(function(){let y0=null,dy=0;const sc=()=>$('#screen');
  document.addEventListener('touchstart',e=>{const s=sc();if(!s||!S.me||sheetOn())return;if(s.scrollTop<=0&&s.contains(e.target))y0=e.touches[0].clientY;else y0=null},{passive:true});
  document.addEventListener('touchmove',e=>{if(y0==null)return;dy=e.touches[0].clientY-y0;const p=$('#ptr');if(dy>10&&p){p.style.height=Math.min(56,dy/2)+'px';p.textContent=dy>110?L('松开刷新','Release to refresh'):L('下拉刷新','Pull to refresh')}},{passive:true});
  document.addEventListener('touchend',()=>{const p=$('#ptr');if(y0!=null&&dy>110){if(p)p.textContent=L('正在刷新…','Refreshing…');Sync.run(true).then(()=>{if(p)p.style.height='0'})}else if(p)p.style.height='0';y0=null;dy=0})})();

/* ================= 启动 ================= */
async function boot(){
  S.lang=LS.get('lang',null)||detectLang();setLang(S.lang);DB.load();
  if(!DB.cloud&&!LS.get('seeded',0))await seedDemo();
  S.online=navigator.onLine;
  if(restoreSession()){S.view='home';Alerts.first()}else S.view='login';
  render(true);Sync.start();if(S.me)Sync.run('boot');
  /* 更新完成后，告诉用户更新了什么（只显示一次） */
  const from=LS.get('updFrom',null);if(from&&from!==APP_VER){LS.set('updFrom',null);setTimeout(async()=>{let v=null;try{v=await (await fetch('version.json?t='+Date.now(),{cache:'no-store'})).json()}catch(e){}
    openSheet(`<div class="sh">✓ ${L('已更新到','Updated to')} v${APP_VER}</div>${v&&v.version===APP_VER?updNotes(v):''}<button class="bigbtn" style="width:100%;margin-top:18px" onclick="closeSheet()">${L('好的','OK')}</button>`)},600)}
  /* 何时检查更新：启动后、回到前台、每 30 分钟 */
  if(location.protocol==='https:'){setTimeout(()=>checkUpdate(false),2500);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkUpdate(false)});setInterval(()=>checkUpdate(false),30*60e3)}
}
/* 屏幕顶部插入下拉刷新提示 */
const _r0=render;render=function(top){_r0(top);const f=$('#screen .fade');if(f&&S.me&&!$('#ptr')){const p=document.createElement('div');p.id='ptr';p.className='ptr';f.prepend(p)}};
/* Android 返回键（App 内） */
(function(){const C=window.Capacitor;if(!C||!C.isNativePlatform||!C.isNativePlatform())return;const A=C.Plugins&&C.Plugins.App;if(!A)return;
  A.addListener('backButton',()=>{if(sheetOn())return closeSheet();if(S.hist.length)return back();if(S.view!=='home'&&S.me)return tab('home');A.exitApp()});
  A.addListener('resume',()=>{Sync.run();checkUpdate(false)})})();
if(!isNative()&&'serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
boot();
