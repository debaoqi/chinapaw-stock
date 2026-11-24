/* ================= 华宝进销存 · 用户端（移动端） ================= */
const V={};
const WEB=document.body.classList.contains('web'),ADMIN=document.body.classList.contains('admin');const LOGO=window.LOGO_DATA||'logo.svg';
/* 每个页面需要的权限：没有权限直接回首页，部门之间不能越界 */
const NEED={docs:'_docs',stock:'stock',product:'stock',po_new:'po',recv_pick:'po_recv',recv:'po_recv',pr_new:'pr',sr_new:'sr',so_new:'so',take:'take',fin:'fin',report:'report',logi:'logi',ship_view:'logi',ship_new:'logi',logi_svc:'logi',
  mgmt:'mgmt',m_users:'mgmt',m_stores:'mgmt',m_products:'mgmt',m_partners:'_pt',m_settings:'mgmt',m_backup:'mgmt',m_log:'mgmt'};
const LIVE=new Set(['home','stock','product','docs','po_view','so_view','take_view','logi','ship_view','report','msgs','me','recv_pick','fin','mgmt','m_users','m_stores','m_products','m_log']);
const whName=id=>nm((DB.get('wh',id)||{}).n)||id||'';
const ptName=id=>nmP((DB.get('partners',id)||{}).n)||'—';
const P_=id=>DB.get('products',id)||{n:{zh:'已删除商品',en:'Deleted item'},unit:{zh:'',en:''}};
const pName=id=>nm(P_(id).n);
const unit=p=>nm(p.unit);
const userName=id=>{const u=DB.get('users',id);return u?nmP(u.name):(S.me&&S.me.id===id?nmP(S.me.name):'—')};
const thumb=(p,sz)=>`<div class="thumb"${sz?` style="width:${sz}px;height:${sz}px"`:''}>${p.thumb||p.photo?`<img src="${esc(p.thumb||p.photo)}" alt="" loading="lazy" decoding="async">`:esc(nm(p.n).replace(/[^\p{L}\p{N}]/gu,'').slice(0,1))}</div>`;
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
function render(top,soft){
  if(!S.me&&S.view!=='login')S.view='login';
  if(!S.me&&sheetOn())closeSheet(true);
  if(S.me&&V[S.view]&&NEED[S.view]&&!can(NEED[S.view])){S.view='home';S.hist=[]}
  const sc=$('#screen');let h='';try{h=(V[S.view]||V.home)()}catch(e){console.error(e);h=`<div class="pad"><div class="note-r">${esc(e.message)}</div></div>`}
  /* soft = 后台数据更新后的刷新：不播放淡入动画、保持滚动位置（避免闪动） */
  sc.innerHTML=`<div class="${soft?'':'fade'}">${S.me?topBars():''}${h}</div>`;S.rv=DB.ver;
  const fx=$('#fixed');fx.innerHTML='';sc.querySelectorAll('.bbar').forEach(e=>fx.appendChild(e));
  const isTab=TABS().some(t=>t[0]===S.view)&&!!S.me;sc.classList.toggle('nonav',!isTab);
  $('#navwrap').innerHTML=S.me&&(isTab||WEB)?tnav():'';document.body.classList.toggle('authed',!!S.me);
  if(top)sc.scrollTop=0;
  syncUI();try{pwaBar()}catch(e){}fitText();requestAnimationFrame(fitText);
}
/* 标题一律一行：放不下时先缩小字号（最多到 65%），仍放不下才用省略号（与 ChinaPaw v4.3.2 相同） */
function fitText(){$$('#screen .hero,#screen .sc .t,#screen .stat .n,#screen .wtile .b,#screen .fit,#screen .ptitle').forEach(e=>{e.style.fontSize='';const cs=parseFloat(getComputedStyle(e).fontSize);let f=cs,i=0;
  e.style.whiteSpace='nowrap';e.style.overflow='hidden';while(e.scrollWidth>e.clientWidth+1&&f>cs*.5&&i<60){f-=.5;e.style.fontSize=f+'px';i++}})}
addEventListener('resize',()=>{clearTimeout(window._fz);window._fz=setTimeout(fitText,150)});
let _soft=0;
/* 后台刷新：只有数据真的变化（或翻译、汇率更新）时才重画；正在输入或打开弹层时不打断 */
function softRender(force){if(!S.me&&!(force&&S.view==='login'))return;if(!force&&S.rv===DB.ver)return;const a=document.activeElement;
  if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&$('#screen').contains(a))return;if(sheetOn()||!(LIVE.has(S.view)||S.view==='login'))return;
  clearTimeout(_soft);_soft=setTimeout(()=>{const t=$('#screen').scrollTop;render(false,true);$('#screen').scrollTop=t},120)}
function todoCount(){let n=0;
  if(can('so_ship'))n+=DB.all('so').filter(s=>s.status==='submitted').length;
  if(can('po_recv'))n+=DB.all('po').filter(p=>p.status==='ordered').length;
  if(S.me&&S.me.role==='gm')n+=DB.all('counts').filter(c=>c.status==='pending').length;
  if(can('pr_exec'))n+=DB.all('pr').filter(r=>r.status==='pending').length;if(can('sr_exec'))n+=DB.all('sr').filter(r=>r.status==='pending').length;return n}
/* 底部导航：按部门显示各自的功能（网页版显示在左侧） */
function TABS(){const t=[['home','home',L('首页','Home')]];
  if(can('stock'))t.push(['stock','box',L('库存','Stock')]);
  if(can('po')||can('so')||can('po_recv')||can('so_ship')||can('take'))t.push(['docs','doc',L('单据','Orders')]);
  if(can('fin'))t.push(['fin','calc',L('财务','Finance')]);
  if(can('logi'))t.push(['logi','truck',L('物流','Logistics')]);
  t.push(['me','user',L('我的','Me')]);return t}
function tnav(){const v=S.view;const b=n=>n?`<span class="cnt">${n>99?'99+':n}</span>`:'';
  const cnt={docs:todoCount(),fin:finTodo(),logi:DB.all('ships').filter(s=>s.status==='exception').length,me:Alerts.unread()};
  let h=TABS().map(([k,icon,label])=>`<button class="${v===k?'on':''}" onclick="tab('${k}')" aria-label="${esc(label)}"><span class="ti">${ic(icon,22)}${b(cnt[k])}</span><span class="tl">${label}</span></button>`).join('');
  if(WEB){h=`<div class="wbrand"><img class="logo" src="${LOGO}" alt=""><b class="one">${BRAND()}</b></div>`+h+
    [can('report')?['report','chart',L('简易报表','Reports')]:null,['msgs','bell',L('消息','Messages')],can('mgmt')?['mgmt','gear',L('后台管理','Management')]:null].filter(Boolean).map(([k,icon,label])=>`<button class="${v===k||(k==='mgmt'&&v.startsWith('m_'))?'on':''}" onclick="tab('${k}')"><span class="ti">${ic(icon,22)}${k==='msgs'?b(Alerts.unread()):''}</span><span class="tl">${label}</span></button>`).join('')+
    `<div class="wfoot"><div class="row gap6">${ctryBtn()}${langBtn()}${curBtn()}</div><div class="xs" style="margin-top:8px;opacity:.7">${esc(nmP(S.me.name))} · ${esc(userTitle(S.me))}</div></div>`}
  return `<nav class="tnav">${h}</nav>`}
function topBars(){let h='';
  if(!S.online)h+=`<div class="offbar">${ic('cloud',16)} ${L('网络未连接：可查看已缓存数据，开单会暂存本机，联网后自动提交','Offline: cached data available. New orders are saved on this phone and submitted when back online')}</div>`;
  else if(hasUpd())h+=`<div class="updbar" onclick="showUpd(UPD.remote,'web')">${ic('download',16)} ${L('有新版本','New version')} v${esc(UPD.remote.version)} · ${L('点此更新','tap to update')}</div>`;
  return h}
function syncUI(){const c=$('#syncChip');if(!c)return;const n=DB.outbox.length;
  c.className='syncchip'+(!S.online?' off':S.syncing?' busy':'');
  c.innerHTML=`<i></i>${!S.online?L('离线','Offline')+(n?' · '+n:''):S.syncing?L('同步中','Syncing'):n?n+L(' 待提交',' pending'):DB.cloud?L('已同步','Synced'):L('本机','Local')}`}
function syncSheet(){const n=DB.outbox.length;
  openSheet(`<div class="sh">${L('自动同步','Automatic sync')}</div>
   <div class="kv" style="margin-top:12px"><div><div class="l">${L('网络','Network')}</div><div class="v ${S.online?'green':'red'}">${S.online?L('在线','Online'):L('离线','Offline')}</div></div>
   <div><div class="l">${L('待上传','Waiting to upload')}</div><div class="v">${n} ${L('条','item(s)')}</div></div></div>
   <div class="note-g" style="margin-top:14px">${L('数据自动保存、实时同步，不需要手动操作。没有网络时先保存在手机上，联网后自动上传。','Data saves and syncs automatically. Without a network it is kept on the phone and uploads when you are back online.')}</div>`);if(n&&S.online)Sync.run()}

/* ================= 消息提醒 ================= */
const pnL=(id,l)=>{const n=(DB.get('partners',id)||{}).n;return n&&typeof n==='object'?(n[l]||n.zh||n.en):(n||'')};
const prL=(p,l)=>p&&typeof p.n==='object'?(p.n[l]||p.n.zh||p.n.en):((p&&p.n)||'');
const unL=(p,l)=>p&&typeof p.unit==='object'?(p.unit[l]||''):((p&&p.unit)||'');
const Alerts={
  key(){return 'notes_'+(S.me?S.me.id:'x')},
  list(){return LS.get(this.key(),[])},save(a){LS.set(this.key(),a.slice(0,80))},
  unread(){return S.me?this.list().filter(n=>!n.read).length:0},
  prefs(){return Object.assign({order:true,low:true,ship:true,logi:true,fin:true},LS.get('prefs_'+(S.me&&S.me.id),{}))},
  add(n,show,t){const a=this.list();if(n.key&&a.some(x=>x.key===n.key))return;n.id=uid('n');n.t=n.t||Date.now();a.unshift(n);this.save(a);if(show)banner(n)},
  scan(rows,show=true){if(!S.me)return;const pf=this.prefs();
    rows.forEach(({k,d})=>{if(d.by===S.me.id)return;const _add=this.add.bind(this);const self={add:(n,s)=>{n.t=show?Date.now():(d.u||d.t);_add(n,s)}};
      if(k==='so'&&d.status==='submitted'&&can('so_ship')&&pf.order)self.add({key:'so'+d.id+'s',ic:'cart',c:'var(--gold)',zh:`新订单 ${d.no} 待出库 · ${pnL(d.cus,'zh')}`,en:`New order ${d.no} to ship · ${pnL(d.cus,'en')}`,go:['so_view',{id:d.id}]},show);
      if(k==='so'&&d.status==='submitted'&&!can('so_ship')&&can('so')&&pf.order)self.add({key:'so'+d.id+'n',ic:'cart',c:'var(--gold)',zh:`同事提交了销售单 ${d.no}`,en:`Sales order ${d.no} submitted`,go:['so_view',{id:d.id}]},show);
      if(k==='so'&&d.status==='shipped'&&can('so')&&pf.ship)self.add({key:'so'+d.id+'x',ic:'out',c:'var(--blue)',zh:`销售单 ${d.no} 已出库发货`,en:`Order ${d.no} has shipped`,go:['so_view',{id:d.id}]},show);
      if(k==='po'&&d.status==='ordered'&&can('po_recv')&&pf.ship)self.add({key:'po'+d.id+'o',ic:'in',c:'var(--green)',zh:`采购单 ${d.no} 已下单，到货后请入库`,en:`PO ${d.no} ordered — receive on arrival`,go:['po_view',{id:d.id}]},show);
      if(k==='counts'&&d.status==='pending'&&S.me.role==='gm')self.add({key:'tk'+d.id,ic:'clip',c:'var(--purple)',zh:`盘点单 ${d.no} 待审核`,en:`Stock count ${d.no} awaiting review`,go:['take_view',{id:d.id}]},show);
      if(k==='counts'&&d.status!=='pending'&&d.by===S.me.id)self.add({key:'tk'+d.id+d.status,ic:'clip',c:'var(--purple)',zh:`盘点单 ${d.no} ${d.status==='approved'?'已审核通过':'被驳回'}`,en:`Stock count ${d.no} ${d.status}`,go:['take_view',{id:d.id}]},show);
      if(k==='ships'&&pf.logi&&can('logi'))self.add({key:'sh'+d.id+d.status,ic:'truck',c:d.status==='exception'?'var(--red)':'var(--blue)',zh:`物流 ${d.trackNo||d.no}：${SH_ST[d.status][0]}`,en:`Shipment ${d.trackNo||d.no}: ${SH_ST[d.status][1]}`,go:['ship_view',{id:d.id}]},show);
      if(k==='pr'&&d.status==='pending'&&can('pr_exec'))self.add({key:'pr'+d.id,ic:'out',c:'var(--orange)',zh:`采购退货 ${d.no} 待出库`,en:`Supplier return ${d.no} to ship out`,go:['docs',{}]},show);
      if(k==='sr'&&d.status==='pending'&&can('sr_exec'))self.add({key:'sr'+d.id,ic:'in',c:'var(--purple)',zh:`销售退货 ${d.no} 待收货`,en:`Customer return ${d.no} to receive`,go:['docs',{}]},show);
      if(k==='fin'&&d.type==='rcv'&&d.status==='recorded'&&can('fin_verify')&&S.me.role!=='gm'&&pf.fin)self.add({key:'fr'+d.id,ic:'check',c:'var(--purple)',zh:`出纳登记了一笔收款，待核对`,en:`A receipt was recorded — please verify`,go:['fin',{}]},show);
      if(k==='fin'&&d.type==='pay'&&d.status==='approved'&&can('fin_pay')&&S.me.role!=='gm'&&pf.fin)self.add({key:'fp'+d.id+(d.gt||''),ic:'out',c:'var(--orange)',zh:`总经理已批准一笔付款，待支付`,en:`The GM approved a payment — please pay`,go:['fin',{}]},show);
      if(k==='fin'&&d.type==='pay'&&d.status==='req'&&S.me.role==='gm')self.add({key:'fq'+d.id+(d.at||''),ic:'calc',c:'var(--gold)',zh:`会计提交了付款申请，待您审批`,en:`The accountant requested a payment — please review`,go:['fin',{seg:'ap'}]},show);
      if(k==='fin'&&d.type==='pay'&&['approved','rejected'].includes(d.status)&&S.me.role==='acct'&&d.gby)self.add({key:'fg'+d.id+(d.gt||''),ic:d.status==='approved'?'check':'x',c:d.status==='approved'?'var(--green)':'var(--red)',zh:d.status==='approved'?`总经理批准了付款申请`:`总经理驳回了付款申请`,en:d.status==='approved'?`The GM approved a payment request`:`The GM rejected a payment request`,go:['fin',{seg:'ap'}]},show);
      if(k==='svc'&&d.status==='new'&&S.me.role==='gm')self.add({key:'bk'+d.id,ic:'calendar',c:'var(--orange)',zh:`新的物流预约 ${d.no}`,en:`New logistics booking ${d.no}`,go:['logi_svc',{}]},show);
    });
    if(rows.some(r=>r.k==='moves'))this.low(show)},
  low(show){if(!S.me||!this.prefs().low||!(can('po')||can('take')))return;const day=fday(Date.now());
    DB.all('products').forEach(p=>{const q=qtyOf(p.id);const s=stStatus(p,q);if(s==='low'||s==='out')this.add({key:'low'+p.id+day,ic:'alert',c:'var(--red)',zh:`库存不足：${prL(p,'zh')} 仅剩 ${n2(q)} ${unL(p,'zh')}`,en:`Low stock: ${prL(p,'en')} — ${n2(q)} ${unL(p,'en')} left`,go:['product',{id:p.id}]},show)})},
  first(){if(LS.get('notesInit_'+S.me.id,0))return;const rows=[];KINDS.forEach(k=>DB.all(k).forEach(d=>rows.push({k,d})));this.scan(rows.filter(r=>r.k!=='ships'||r.d.status==='exception'||r.d.status==='delivering'),false);LS.set('notesInit_'+S.me.id,1)}
};
function banner(n){const b=$('#banner');if(!b)return;b.innerHTML=`<div class="qi" style="background:${n.c||'var(--gold)'};color:#fff">${ic(n.ic||'bell',18)}</div><div style="flex:1;min-width:0"><div class="b sm">${L('新消息','New')}</div><div class="sm one">${esc(L(n.zh,n.en))}</div></div>`;
  b.onclick=()=>{b.classList.remove('on');markRead(n.id);if(n.go)go(n.go[0],n.go[1])};b.classList.add('on');try{navigator.vibrate&&navigator.vibrate(40)}catch(e){}
  clearTimeout(b._t);b._t=setTimeout(()=>b.classList.remove('on'),4500)}
function markRead(id){const a=Alerts.list();a.forEach(n=>{if(!id||n.id===id)n.read=true});Alerts.save(a)}

/* ================= 登录：只输入密码（不需要手机号），系统按密码识别部门与账号 ================= */
const ROLE_COLOR={gm:'#161616',buyer:'#2367B0',sales:'#F2B705',keeper:'#0B7A4B',acct:'#7B4FA0',cashier:'#E87A2B'};
/* 登录：① 部门 → ② 职位（本部门的基本职位 + 后台新增的职位）→ ③ 密码 */
const lgTitle=()=>{const p=S.lgPos&&posById(S.lgPos);return p?nm(p.n):roleName(S.lgRole)};
const lgOpts=d=>[...d.roles.map(r=>({r,p:null,n:roleName(r)})),...positions().filter(p=>!p.del&&p.dept===d.id&&d.roles.includes(p.role)).map(p=>({r:p.role,p:p.id,n:nm(p.n)}))];
function lgDept(id){S.lgDept=id;LS.set('lgDept',id);const o=lgOpts(DEPTS.find(d=>d.id===id));if(o.length===1){S.lgRole=o[0].r;S.lgPos=null}else if(!o.some(x=>x.r===S.lgRole&&(x.p||null)===(S.lgPos||null))){S.lgRole=null;S.lgPos=null}LS.set('lgRole',S.lgRole);LS.set('lgPos',S.lgPos);render(false);setTimeout(()=>{if(S.lgRole){const i=$('#lgPw');i&&i.focus()}},50)}
function lgPick(b,r,p){S.lgRole=r;S.lgPos=p;LS.set('lgRole',r);LS.set('lgPos',p);$$('#lgPos .chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('#lgLab').textContent=L('③ 输入','③ Enter the ')+lgTitle()+L('密码',' password');$('#lgPw').focus()}
V.login=()=>{if(S.lgRole===undefined){S.lgRole=LS.get('lgRole',null);S.lgPos=LS.get('lgPos',null);S.lgDept=LS.get('lgDept',null)||(S.lgRole?deptOf(S.lgRole).id:null)}
  if(S.lgPos&&!posById(S.lgPos))S.lgPos=null;const dd=DEPTS.find(d=>d.id===S.lgDept);
  if(DB.cloud&&!S._posF){S._posF=1;rpc('jxc_positions',{}).then(l=>{if(Array.isArray(l)&&JSON.stringify(l)!==JSON.stringify(LS.get('pos',[]))){LS.set('pos',l);if(S.view==='login')render(false)}}).catch(()=>{})}
  return `<div class="login-hero"><div class="row between"><div class="row gap6" style="min-width:0"><img class="logo" src="${LOGO}" alt=""><b style="font-size:18px" class="one">${BRAND()}</b></div><div class="row" style="gap:8px">${ctryBtn()}${langBtn()}</div></div></div>
  <div class="pad" style="padding-top:20px">
   <div class="fld"><label>${L('① 选择部门','① Choose your department')}</label><div class="rolegrid">${DEPTS.map(d=>`<button class="rolebtn ${S.lgDept===d.id?'on':''}" style="--rc:${ROLE_COLOR[d.roles[0]]}" onclick="lgDept('${d.id}')">${esc(deptName(d))}</button>`).join('')}</div></div>
   ${dd?`<div class="fld"><label>${L('② 选择职位','② Choose your position')}</label><div class="chips wrap" id="lgPos">${lgOpts(dd).map(o=>`<span class="chip ${S.lgRole===o.r&&(S.lgPos||null)===o.p?'on':''}" onclick="lgPick(this,'${o.r}',${o.p?`'${o.p}'`:'null'})">${esc(o.n)}</span>`).join('')}</div></div>`:''}
   <div class="fld"><label id="lgLab">${S.lgRole?L('③ 输入','③ Enter the ')+lgTitle()+L('密码',' password'):L('③ 输入密码','③ Enter your password')}</label><div class="row" style="position:relative"><input class="inp" id="lgPw" type="password" inputmode="text" autocomplete="current-password" style="font-size:20px;letter-spacing:3px;text-align:center" placeholder="••••••" onkeydown="if(event.key==='Enter')doLogin()"><button style="position:absolute;right:12px;color:var(--muted)" onclick="const i=$('#lgPw');i.type=i.type==='password'?'text':'password'" aria-label="show">${ic('lock',18)}</button></div></div>
   <div class="row between" style="margin-top:14px"><span class="sm b">${L('自动登录（信任此设备）','Stay signed in (trust this device)')}</span>${sw(LS.get('trust',true),"LS.set('trust',!LS.get('trust',true));render(false)")}</div>
   <div id="lgErr" class="sm red" style="margin-top:10px;min-height:18px"></div>
   <button class="bigbtn" style="width:100%" onclick="doLogin()">${L('登录','Sign in')}</button>
   <div class="xs muted" style="text-align:center;margin-top:22px" data-notr>v${APP_VER} · build ${APP_BUILD} · ${flagE(S.country)} ${esc(C().iso)}</div>
  </div>`};
async function doLogin(){const pw=$('#lgPw').value;const e=$('#lgErr');if(!S.lgDept){e.textContent=L('请先选择部门','Choose your department first');return}if(!S.lgRole){e.textContent=L('请选择职位','Choose your position');return}if(!pw){e.textContent=L('请输入密码','Enter your password');return}
  e.textContent='';try{await login(pw,LS.get('trust',true),S.lgRole);afterLogin()}catch(x){e.textContent=x.message;$('#lgPw').select()}}
function afterLogin(){
  S.hist=[];S.view=/mgmt/.test(location.hash)&&can('mgmt')?'mgmt':'home';Alerts.first();Alerts.low(false);render(true);Sync.run('boot');toast(L('欢迎，','Welcome, ')+nmP(S.me.name)+' · '+userTitle(S.me),false)}
function doLogout(){openSheet(`<div class="sh">${L('退出登录？','Sign out?')}</div><div class="sm muted" style="margin-top:6px">${DB.outbox.length?L(`还有 ${DB.outbox.length} 条记录未提交，下次登录后继续提交。`,`${DB.outbox.length} change(s) not yet submitted; they will be sent next time you sign in.`):L('退出后需要重新输入密码登录。','You will need your password to sign in again.')}</div>
  <div class="row gap" style="margin-top:18px"><button class="bigbtn ghost" onclick="closeSheet()">${L('取消','Cancel')}</button><button class="bigbtn red" onclick="closeSheet();logout();S.view='login';render(true)">${L('退出','Sign out')}</button></div>`)}

/* ================= 首页 ================= */
function greet(){const h=new Date().getHours();return h<12?L('上午好','Good morning'):h<18?L('下午好','Good afternoon'):L('晚上好','Good evening')}
const bigCard=(bg,fg,icon,t,sub,fn)=>`<div class="sc" style="background:${bg};color:${fg}" onclick="${fn}"><div class="ic">${ic(icon,19)}</div><div style="flex:1;min-width:0"><div class="t">${t}</div><div class="roles">${sub}</div></div><div class="go">${ic('arrow',16)}</div></div>`;
const tile=(bg,icon,t,sub,fn)=>`<div class="wtile" style="background:${bg}" onclick="${fn}"><div class="wti">${ic(icon)}</div><div style="min-width:0"><div class="b">${t}</div><div class="wsub">${sub}</div></div></div>`;
const statT=(cls,val,label,fn,cur)=>`<div class="stat ${cls}" onclick="${fn||''}"><div class="n" data-notr>${val}</div><div class="l">${label}</div></div>`;
V.home=()=>{const me=S.me,r=me.role;const today=dayStart();
  const soT=DB.all('so').filter(s=>s.status!=='draft'&&s.status!=='cancel'&&s.t>=today);const sales=soT.reduce((a,s)=>a+docTotal(s),0);
  const toShip=DB.all('so').filter(s=>s.status==='submitted').length,toRecv=DB.all('po').filter(p=>p.status==='ordered').length;
  const low=DB.all('products').filter(p=>['low','out'].includes(stStatus(p))).length;
  const ships=DB.all('ships');const transit=ships.filter(s=>['picked','transit','customs'].includes(s.status)).length,deliv=ships.filter(s=>s.status==='delivering').length,exc=ships.filter(s=>s.status==='exception').length;
  const F=finSum();const big=[],tiles=[];let stats='';
  if(r==='gm'||r==='sales'){if(can('so'))big.push(bigCard('var(--gold)','#161616','cart',L('销售开单','New sale'),L('选客户 → 扫码加商品 → 自动算金额','Customer → scan items → auto total'),"go('so_new')"))}
  if(r==='buyer')big.push(bigCard('var(--green)','#fff','in',L('采购下单','New purchase'),L('选供应商 → 加商品 → 提交下单','Supplier → items → place order'),"go('po_new')"));
  if(r==='keeper'){big.push(bigCard('var(--green)','#fff','in',L('采购入库','Receive goods'),L('选订单 → 填数量 → 扫码核对','Pick PO → quantities → scan check'),"go('recv_pick')"));
    big.push(bigCard('var(--gold)','#161616','out',L('销售出库','Ship orders'),L(`${toShip} 张待出库 · 确认发货扣库存`,`${toShip} to ship · confirm & deduct`),"S.docSeg='so';S.docF='submitted';tab('docs')"))}
  if(r==='acct'){big.push(bigCard('var(--purple)','#fff','calc',L('财务对账','Accounts'),L('应收 · 应付 · 收款核对 · 付款申请','Receivables · payables · checks · payment requests'),"S.finSeg='ar';tab('fin')"));
    big.push(bigCard('var(--green)','#fff','chart',L('利润报表','Profit report'),L('销售额 · 成本 · 毛利','Sales · cost · gross profit'),"go('report')"))}
  if(r==='cashier'){big.push(bigCard('var(--green)','#fff','in',L('登记收款','Record receipt'),L('现金 / 银行 / 手机钱包','Cash / bank / mobile money'),"S.finSeg='ar';tab('fin')"));
    big.push(bigCard('var(--orange)','#fff','out',L('执行付款','Make payments'),L(`${F.apprN} 笔总经理已批准待付`,`${F.apprN} approved by GM, waiting`),"S.finSeg='ap';tab('fin')"))}
  if(can('stock'))tiles.push(tile('var(--tile)','scan',L('扫码查货','Scan & check'),L('相机扫码 · 秒出库存','Camera scan · instant stock'),'scanLookup()'));
  if(can('take'))tiles.push(tile('var(--blue)','clip',L('库存盘点','Stock count'),L('录实盘数 · 待审核','Enter counts · for review'),"go('take')"));
  if(r==='buyer')tiles.push(tile('var(--blue)','ret',L('采购退货','Return to supplier'),L('提交后由仓库出库','Warehouse ships it out'),"go('pr_new')"));
  if(r==='sales')tiles.push(tile('var(--blue)','ret',L('销售退货','Customer return'),L('提交后由仓库收货','Warehouse receives it'),"go('sr_new')"));
  if(r==='cashier'){tiles.push(tile('var(--blue)','doc',L('资金日记账','Cash book'),L('收付款流水 · 余额','Receipts, payments, balance'),"S.finSeg='book';tab('fin')"))}
  if(r==='gm')tiles.push(tile('var(--blue)','chart',L('经营报表','Reports'),L('销售 · 利润 · 排行','Sales · profit · ranking'),"go('report')"));
  if(tiles.length%2)tiles.push(can('report')?tile('var(--purple)','chart',L('简易报表','Reports'),L('销售额 · 排行 · 流水','Sales · ranking · log'),"go('report')"):tile('var(--purple)','bell',L('消息','Messages'),L('提醒与待办','Alerts & tasks'),"go('msgs')"));
  if(r==='gm'||r==='sales')stats=statT('g',numK(sales),L('今日销售额','Sales today'),"go('report')",1)+statT('',toShip,L('待出库','To ship'),"S.docSeg='so';S.docF='submitted';tab('docs')")+statT(low?'y':'',low,L('库存不足','Low stock'),"S.stF='low';tab('stock')");
  else if(r==='buyer')stats=statT('g',DB.all('po').filter(p=>p.status==='ordered').length,L('在途采购','Open POs'),"S.docSeg='po';S.docF='ordered';tab('docs')")+statT('',transit,L('物流在途','In transit'),"tab('logi')")+statT(low?'y':'',low,L('库存不足','Low stock'),"S.stF='low';tab('stock')");
  else if(r==='keeper')stats=statT('g',toRecv,L('待入库','To receive'),"go('recv_pick')")+statT('',toShip,L('待出库','To ship'),"S.docSeg='so';S.docF='submitted';tab('docs')")+statT(low?'y':'',low,L('库存不足','Low stock'),"S.stF='low';tab('stock')");
  else if(r==='acct')stats=statT('g',numK(F.arBal),L('应收余额','Receivable'),"S.finSeg='ar';tab('fin')",1)+statT('',numK(F.apBal),L('应付余额','Payable'),"S.finSeg='ap';tab('fin')")+statT(F.unverN?'y':'',F.unverN,L('待核对收款','To verify'),"S.finSeg='book';tab('fin')");
  else stats=statT('g',numK(F.rcvToday),L('今日收款','Received today'),"S.finSeg='book';tab('fin')",1)+statT(F.apprN?'y':'',F.apprN,L('待付款','To pay'),"S.finSeg='ap';tab('fin')")+statT('',numK(F.payMonth),L('本月付款','Paid this month'),"S.finSeg='book';tab('fin')");
  const todo=[];
  if(can('so_ship')&&toShip&&r!=='keeper')todo.push(['out',L(`${toShip} 张销售单待出库`,`${toShip} order(s) to ship`),"S.docSeg='so';S.docF='submitted';tab('docs')",'var(--gold)']);
  if(can('po_recv')&&toRecv&&r!=='keeper')todo.push(['in',L(`${toRecv} 张采购单待入库`,`${toRecv} PO(s) to receive`),"go('recv_pick')",'var(--green)']);
  const prP=DB.all('pr').filter(x=>x.status==='pending').length,srP=DB.all('sr').filter(x=>x.status==='pending').length;
  if(can('pr_exec')&&prP)todo.push(['out',L(`${prP} 张采购退货待出库`,`${prP} supplier return(s) to ship out`),"S.docSeg='ret';tab('docs')",'var(--orange)']);
  if(can('sr_exec')&&srP)todo.push(['in',L(`${srP} 张销售退货待收货`,`${srP} customer return(s) to receive`),"S.docSeg='ret';tab('docs')",'var(--purple)']);
  const tk=DB.all('counts').filter(c=>c.status==='pending').length;if(r==='gm'&&tk)todo.push(['clip',L(`${tk} 张盘点单待审核`,`${tk} stock count(s) to review`),"S.docSeg='take';tab('docs')",'var(--purple)']);
  if(can('fin_verify')&&F.unverN)todo.push(['check',L(`${F.unverN} 笔收款待核对`,`${F.unverN} receipt(s) to verify`),"S.finSeg='book';tab('fin')",'var(--purple)']);
  if(r==='gm'&&F.reqN)todo.unshift(['calc',L(`${F.reqN} 笔付款申请待您审批`,`${F.reqN} payment request(s) to review`),"payReview()",'var(--gold)']);
  if(r==='acct'&&F.rejN)todo.push(['x',L(`${F.rejN} 笔付款申请被驳回，待处理`,`${F.rejN} rejected payment request(s)`),"S.finSeg='ap';tab('fin')",'var(--red)']);
  if(can('fin_pay')&&F.apprN)todo.push(['out',L(`${F.apprN} 笔付款总经理已批准，待支付`,`${F.apprN} GM-approved payment(s) to pay`),"S.finSeg='ap';tab('fin')",'var(--orange)']);
  const dr=DB.all('so').concat(DB.all('po')).filter(d=>d.status==='draft'&&d.by===me.id).length;if(dr)todo.push(['edit',L(`${dr} 张草稿未提交`,`${dr} draft(s) not submitted`),"S.docSeg='"+(can('so')?'so':'po')+"';S.docF='draft';tab('docs')",'#8A8478']);
  if(exc&&can('logi'))todo.push(['alert',L(`${exc} 票物流异常`,`${exc} shipment exception(s)`),"S.logiF='exception';tab('logi')",'var(--red)']);
  if(DB.outbox.length)todo.push(['cloud',L(`${DB.outbox.length} 条记录待提交`,`${DB.outbox.length} change(s) waiting to submit`),'syncSheet()','var(--orange)']);
  const mv=can('stock')?DB.all('moves').sort((a,b)=>b.t-a.t).slice(0,5):[];
  return `<div class="pad" style="padding-top:16px">
   ${WEB?'':`<div class="row between"><div class="row gap6" style="min-width:0"><img class="logo" src="${LOGO}" alt=""><b style="font-size:17px" class="one">${BRAND()}</b></div>
    <div class="row" style="gap:6px">${ctryBtn()}${langBtn()}<button class="icbtn" onclick="go('msgs')" aria-label="messages">${ic('bell')}${Alerts.unread()?'<span class="dot"></span>':''}</button></div></div>`}
   <div class="row gap6" style="margin-top:16px;white-space:nowrap;min-width:0"><span class="sm muted" style="flex:none">${greet()} · </span><b class="sm one" style="flex:none;max-width:40%">${esc(nmP(me.name))}</b><span class="badge ${ROLES[r].c}">${esc(userTitle(me))}</span><span class="xs muted one">${esc(whName(me.wh))}</span></div>
   ${r==='gm'?deptBoard(F,{sales,toShip,toRecv,low,transit,exc,tk}):''}
   <div style="display:flex;flex-direction:column;gap:12px;margin-top:18px">${big.join('')}${tiles.length?`<div class="wtiles">${tiles.join('')}</div>`:''}
    ${can('logi')?`<div class="wcard" onclick="tab('logi')"><div class="qi">${ic('truck')}</div><div style="flex:1;min-width:0"><div class="b fit" style="font-size:16px;white-space:nowrap">${L('物流跟踪与服务','Logistics & services')}</div>
     <div class="sm muted one">${L(`在途 ${transit} · 派送中 ${deliv} · 异常 ${exc}`,`In transit ${transit} · Out for delivery ${deliv} · Exceptions ${exc}`)}</div><div class="xs b one" style="margin-top:2px">${L('运费估算 · 预约提货 · 承运商查询','Freight quote · booking · carrier tracking')}</div></div><div class="go">${ic('arrow',16)}</div></div>`:''}
   </div>
   <div class="stats">${stats}</div>
   ${todo.length?`<div class="sec-h">${L('待办','To do')}</div><div class="box" style="margin-top:0;padding:4px 16px">${todo.map(x=>`<div class="li" onclick="${x[2]}"><div class="qi" style="background:${x[3]};color:#fff">${ic(x[0],18)}</div><div class="b sm" style="flex:1">${x[1]}</div>${ic('chev',16)}</div>`).join('')}</div>`:''}
   ${mv.length?`<div class="sec-h">${L('最近出入库','Recent movements')}${can('report')?`<a onclick="go('report')">${L('报表','Reports')} ›</a>`:''}</div><div class="box" style="margin-top:0;padding:4px 16px">${mv.map(mvRow).join('')}</div>`:''}
  </div>`};
/* 总经理：各部门进展一目了然 */
function deptBoard(F,x){const card=(role,lines,fn)=>`<div class="box" style="margin:0;padding:12px 14px;cursor:pointer" onclick="${fn}"><div class="row between"><span class="badge ${ROLES[role].c}">${roleName(role)}</span>${ic('chev',14)}</div>${lines.map(l=>`<div class="row between" style="margin-top:7px;gap:6px"><span class="xs muted one">${l[0]}</span><b class="sm ${l[2]||''}" data-notr style="white-space:nowrap">${l[1]}</b></div>`).join('')}</div>`;
  const mon=+new Date(new Date().getFullYear(),new Date().getMonth(),1);const poM=DB.all('po').filter(p=>p.t>=mon&&p.status!=='draft'&&p.status!=='cancel').reduce((a,p)=>a+docTotal(p),0);
  return `<div class="sec-h"><span>${L('各部门进展','Department progress')} <span class="xs muted" style="font-weight:600">${L('金额单位','in')} <span data-notr>${esc(CUR())}</span></span></span><a onclick="go('report')">${L('报表','Reports')} ›</a></div><div class="dgrid">
   ${card('buyer',[[L('本月采购额','Purchases, month'),numK(poM)],[L('在途采购单','Open POs'),x.toRecv],[L('库存不足','Low stock'),x.low,x.low?'red':'']],"S.docSeg='po';S.docF='all';tab('docs')")}
   ${card('sales',[[L('今日销售额','Sales today'),numK(x.sales)],[L('待出库','To ship'),x.toShip],[L('销售草稿','Drafts'),DB.all('so').filter(s=>s.status==='draft').length]],"S.docSeg='so';S.docF='all';tab('docs')")}
   ${card('keeper',[[L('待入库 / 待出库','To receive / ship'),x.toRecv+' / '+x.toShip],[L('待审盘点','Counts to review'),x.tk,x.tk?'red':''],[L('物流异常','Exceptions'),x.exc,x.exc?'red':'']],"tab('stock')")}
   ${card('acct',[[L('应收余额','Receivable'),numK(F.arBal)],[L('应付余额','Payable'),numK(F.apBal)],[L('待核对收款','To verify'),F.unverN,F.unverN?'red':'']],"S.finSeg='ar';tab('fin')")}
   ${card('cashier',[[L('今日收款','Received today'),numK(F.rcvToday)],[L('待付款','To pay'),F.apprN,F.apprN?'red':''],[L('资金余额','Cash balance'),numK(F.cash)]],"S.finSeg='book';tab('fin')")}
  </div>`}
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
   <div class="chips">${[['all',L('全部门店','All stores')]].concat(activeWh().map(w=>[w.id,nm(w.n)])).map(([k,t])=>`<span class="chip ${S.stW===k?'on':''}" onclick="S.stW='${k}';render(false)">${esc(t)}</span>`).join('')}</div>
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
  return hdr(L('库存详情','Item details'),can('po')||S.me.role==='gm'?`<button class="icbtn" onclick="editProduct('${p.id}')">${ic('edit')}</button>`:'')+`<div class="pad">
   <div class="box" style="margin-top:6px"><div class="row gap" style="align-items:flex-start">${thumb(p,64)}<div style="flex:1;min-width:0"><div class="b" style="font-size:19px;line-height:1.25">${esc(nm(p.n))}</div>
     <div class="xs muted" style="margin-top:3px" data-notr>${esc(p.code)} · ${esc(p.bar)}</div><div class="row gap6" style="margin-top:6px">${stBadge(s)}<span class="badge b-grey">${esc(nm(p.cat))}</span>${p.batch?`<span class="badge b-lime">${L('批次管理','Batch tracked')}</span>`:''}</div></div></div>
    <div class="row" style="margin-top:14px;align-items:baseline;gap:6px"><span style="font-size:34px;font-weight:800;letter-spacing:-1px" class="${s==='low'||s==='out'?'red':''}" data-notr>${n2(q)}</span><span class="muted">${esc(unit(p))}</span></div>
    <div class="kv" style="margin-top:10px">${can('cost')?`<div><div class="l">${L('成本价','Cost')}</div><div class="v" data-notr>${money(p.cost)}</div></div>`:''}<div><div class="l">${L('售价','Price')}</div><div class="v" data-notr>${money(p.price)}</div></div>
     <div><div class="l">${L('安全库存 / 上限','Min / Max')}</div><div class="v" data-notr>${p.min} / ${p.max||'—'}</div></div><div><div class="l">${L('供应商','Supplier')}</div><div class="v">${esc(ptName(p.sup))}</div></div></div>${warn}</div>
   <div class="box"><h4>${L('各门店库存','By store')}</h4>${activeWh().map(w=>{const x=(sm.w[w.id]||{q:0}).q;return `<div class="li" style="cursor:default"><div class="qi">${ic('wh',18)}</div><div style="flex:1">${esc(nm(w.n))}</div><b data-notr>${n2(x)}</b></div>`}).join('')}</div>
   ${p.batch?`<div class="box"><h4>${L('批次 / 效期','Batches / expiry')}</h4>${bs.filter(b=>b.q>0).map(b=>{const near=b.exp&&new Date(b.exp)<soon;return `<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm" data-notr>${esc(b.batch||'—')}</div><div class="xs muted">${esc(whName(b.wh))}</div></div><div style="text-align:right"><div class="b" data-notr>${n2(b.q)}</div><div class="xs ${near?'red b':'muted'}">${b.exp?L('效期 ','Exp ')+esc(b.exp):''}${near?L(' · 即将过期',' · expiring'):''}</div></div></div>`}).join('')||emptyBox('box',L('无批次','No batches'))}</div>`:''}
   <div class="box"><h4>${L('最近出入库','Recent movements')}</h4>${mv.map(m=>`<div class="li" onclick="openRef('${m.type}','${m.ref}')"><span class="badge ${(MV[m.type]||[0,0,'b-grey'])[2]}" style="min-width:64px;justify-content:center">${mvName(m.type)}</span><div style="flex:1;min-width:0"><div class="sm one">${esc(whName(m.wh))}${m.batch?' · <span data-notr>'+esc(m.batch)+'</span>':''}</div><div class="xs muted">${fdate(m.t)} · ${esc(userName(m.by))}</div></div><b class="${m.qty<0?'red':'green'}" data-notr>${m.qty>0?'+':''}${n2(m.qty)}</b></div>`).join('')||emptyBox('box',L('暂无流水','No movements'))}</div>
  </div>${can('so')||can('po')?`<div class="bbar">${can('po')?`<button class="bigbtn ${can('so')?'ghost':''}" onclick="go('po_new',{add:'${p.id}'})">${ic('in',18)} ${L('采购补货','Reorder')}</button>`:''}${can('so')?`<button class="bigbtn" onclick="go('so_new',{add:'${p.id}'})">${ic('cart',18)} ${L('开销售单','Sell')}</button>`:''}</div>`:''}`};
function openRef(type,ref){if(!ref)return;const m={po_in:['grn','po'],po_ret:['pr'],so_out:['so'],so_ret:['sr'],adj:['counts']}[type];if(!m)return;
  if(type==='po_in'){const g=DB.get('grn',ref);if(g)go('po_view',{id:g.po});return}if(type==='so_out')return go('so_view',{id:ref});
  if(type==='so_ret'){const r=DB.get('sr',ref);if(r)go('so_view',{id:r.so});return}if(type==='po_ret'){const r=DB.get('pr',ref);const g=r&&DB.get('grn',r.grn);if(g)go('po_view',{id:g.po});return}
  if(type==='adj')go('take_view',{id:ref})}
function editProduct(id){const p=DB.get('products',id);S.ep={...p};
  openSheet(`<div class="sh">${L('编辑商品','Edit item')}</div><div class="sm muted">${esc(nm(p.n))}</div>
   <div class="row gap" style="margin-top:12px"><div class="photos"><div class="ph" onclick="pickImage2(800,(u,t)=>{S.ep.photo=u;S.ep.thumb=t;$('#epPh').innerHTML='<img src=&quot;'+t+'&quot;>'},true)" id="epPh">${p.photo?`<img src="${esc(p.photo)}">`:ic('camera')}</div></div><div class="sm muted">${L('点击拍照或上传商品图片','Tap to take or upload a photo')}</div></div>
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
function partnerSel(type,val,onch){const l=DB.all('partners').filter(p=>p.type===type&&(!p.del||p.id===val));return `<select class="inp" onchange="${onch}">${!val?`<option value="">${L('请选择','Please choose')}</option>`:''}${l.map(p=>`<option value="${p.id}" ${p.id===val?'selected':''}>${esc(nmP(p.n))}</option>`).join('')}</select>`}
function whSel(val,onch){return `<select class="inp" onchange="${onch}">${activeWh().map(w=>`<option value="${w.id}" ${w.id===val?'selected':''}>${esc(nm(w.n))}</option>`).join('')}</select>`}
function newPartner(type,after){openSheet(`<div class="sh">${type==='cus'?L('新增客户','New customer'):L('新增供应商','New supplier')}</div>
  <div class="fld"><label>${L('名称','Name')}</label><input class="inp" id="npN"></div><div class="fld"><label>${L('电话','Phone')}</label><input class="inp" id="npP" inputmode="tel"></div><div class="fld"><label>${L('城市','City')}</label><input class="inp" id="npC"></div>
  <button class="bigbtn" style="width:100%;margin-top:18px" onclick="const n=$('#npN').value.trim();if(!n)return toast(L('请填写名称','Enter a name'));const d=DB.put('partners',{type:'${type}',n,phone:$('#npP').value,city:$('#npC').value});closeSheet();(${after})(d.id)">${L('保存','Save')}</button>`)}

/* ---------- 明细编辑（采购单 / 销售单共用） ---------- */
function itemsEditor(kind){const F=S.form;const so=kind==='so';
  return F.items.map((it,i)=>{const p=P_(it.pid);const av=qtyOf(it.pid,F.wh);const short=so&&it.qty>av;
    return `<div class="box" style="margin-top:10px;padding:12px 14px"><div class="row gap">${thumb(p,40)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs ${short?'red b':'muted'}" id="av${i}">${L('可用库存','Available')} ${n2(av)} ${esc(unit(p))}${short?L(' · 库存不够',' · not enough'):''}</div></div><button class="icbtn" style="width:32px;height:32px;box-shadow:none;background:var(--soft)" onclick="S.form.items.splice(${i},1);render(false)">${ic('x',16)}</button></div>
     <div class="row between" style="margin-top:10px;gap:8px"><div class="qty"><button onclick="fQty(${i},-1)">−</button><input type="number" inputmode="decimal" value="${it.qty}" oninput="fSet(${i},'qty',this.value)"><button onclick="fQty(${i},1)">+</button></div>
      <div class="row" style="gap:6px;min-width:0"><span class="xs muted">${L('单价','Price')} <span data-notr>${baseIso()}</span></span><input class="inp" style="width:86px;padding:7px 10px;font-size:14px;font-weight:700" type="number" inputmode="decimal" value="${it.price}" oninput="fSet(${i},'price',this.value)"></div>
      <b id="lt${i}" class="sm" data-notr style="min-width:64px;text-align:right">${n2(lineTotal(it))}</b></div></div>`}).join('')
   +`<div class="row gap" style="margin-top:10px"><button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="pickProduct('fAdd','${F.wh}')">${ic('search',18)} ${L('搜索添加','Add item')}</button><button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="openScan(L('扫码添加商品','Scan to add'),c=>{const p=findByCode(c);if(!p){toast(L('未找到商品：','Not found: ')+c);return false}fAdd(p.id,true)},true)">${ic('scan',18)} ${L('扫码添加','Scan to add')}</button></div>`}
function fAdd(pid,silent){const F=S.form;const p=DB.get('products',pid);const ex=F.items.find(i=>i.pid===pid);if(ex)ex.qty=+ex.qty+1;else F.items.push({pid,qty:1,price:F.kind==='po'?p.cost:p.price});
  if(silent){toast(L('已添加：','Added: ')+nm(p.n));const l=$('#scLog');if(l)l.innerHTML=`<div class="note-g" style="margin-top:8px">${L('已添加','Added')} ${esc(nm(p.n))} × ${(F.items.find(i=>i.pid===pid)||{}).qty}</div>`}
  if(!silent||!sheetOn())render(false);else S.formDirty=true}
function fQty(i,d){const it=S.form.items[i];it.qty=Math.max(0,(+it.qty||0)+d);render(false)}
function fSet(i,k,v){const it=S.form.items[i];it[k]=v===''?'':+v;const lt=$('#lt'+i);if(lt)lt.textContent=n2(lineTotal(it));const t=$('#ftotal');if(t)t.textContent=moneyBase(docTotal(S.form))}
document.addEventListener('transitionend',e=>{if(e.target.id==='sheet'&&!sheetOn()&&S.formDirty){S.formDirty=false;render(false)}});

/* ================= 单据中心 ================= */
S.docSeg=null;S.docF='all';
V.docs=()=>{const segs=[];if(can('po')||can('po_recv'))segs.push(['po',L('采购','Purchase')]);if(can('so')||can('so_ship'))segs.push(['so',L('销售','Sales')]);
  if(can('pr')||can('sr')||can('pr_exec')||can('sr_exec'))segs.push(['ret',L('退货','Returns')]);if(can('take'))segs.push(['take',L('盘点','Counts')]);
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
  else if(seg==='ret'){const l=DB.all('pr').map(d=>({k:'pr',d})).concat(DB.all('sr').map(d=>({k:'sr',d}))).sort((a,b)=>(a.d.status==='pending'?0:1)-(b.d.status==='pending'?0:1)||b.d.t-a.d.t);
    body=`<div class="row gap" style="margin-top:12px">${can('pr')?`<button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="S.form=null;go('pr_new')">${ic('ret',18)} ${L('采购退货','Return to supplier')}</button>`:''}${can('sr')?`<button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="S.form=null;go('sr_new')">${ic('ret',18)} ${L('销售退货','Customer return')}</button>`:''}</div>
     <div style="margin-top:12px">${l.map(({k,d})=>retCard(k,d)).join('')||emptyBox('ret',L('暂无退货单','No returns'))}</div>`}
  else{const l=DB.all('counts').sort((a,b)=>b.t-a.t);add=can('take')?`<button class="pill g" onclick="go('take')">${ic('plus',16)} ${L('新建盘点','New count')}</button>`:'';
    body=`<div style="margin-top:12px">${l.map(d=>{const df=(d.items||[]).filter(i=>i.real!==i.sys);return `<div class="wc" onclick="go('take_view',{id:'${d.id}'})"><div class="top"><div class="row between"><h3><span class="tt" data-notr>${esc(d.no)}</span></h3>${stB(TK_ST,d.status)}</div><small>${esc(whName(d.wh))} · ${esc(userName(d.by))}</small>
     <div class="cols"><div><span class="l">${L('商品','Items')}</span><span class="v">${(d.items||[]).length}</span></div><div><span class="l">${L('差异','Diffs')}</span><span class="v ${df.length?'red':''}">${df.length}</span></div><div><span class="l">${L('日期','Date')}</span><span class="v">${fdate(d.t,false)}</span></div></div></div></div>`}).join('')||emptyBox('clip',L('暂无盘点单','No stock counts'))}</div>`}
  return `<div class="pad" style="padding-top:16px"><div class="row between"><div class="ptitle">${L('单据','Orders')}</div><div class="row" style="gap:8px">${add}</div></div>
   <div class="seg">${segs.map(([k,t])=>`<button class="${seg===k?'on':''}" onclick="S.docSeg='${k}';S.docF='all';render(false)">${t}</button>`).join('')}</div>${body}</div>`};
function docCard(k,d){const M=k==='po'?PO_ST:SO_ST;const party=k==='po'?ptName(d.sup):ptName(d.cus);const pend=d._q;
  return `<div class="wc" onclick="go('${k}_view',{id:'${d.id}'})"><div class="top"><div class="row between" style="gap:8px"><h3><span class="tt" data-notr>${esc(d.no)}</span>${pend?`<span class="badge b-orange">${ic('cloud',11)}${L('待同步','Pending sync')}</span>`:''}</h3>${stB(M,d.status)}</div>
   <small>${esc(party)} · ${esc(whName(d.wh))}</small>
   <div class="cols"><div><span class="l">${L('金额','Total')}</span><span class="v" data-notr>${moneyK(docTotal(d))}</span></div><div><span class="l">${L('商品','Items')}</span><span class="v">${d.items.length} ${L('种','')}</span></div><div><span class="l">${L('日期','Date')}</span><span class="v">${fdate(d.t,false)}</span></div></div></div></div>`}

/* ---------- 采购订单 ---------- */
V.po_new=()=>{if(!S.form||S.form.kind!=='po'||S.form._v!==S.params.id+'|'+S.params.add){const ex=S.params.id&&DB.get('po',S.params.id);
    S.form=ex?{...JSON.parse(JSON.stringify(ex)),kind:'po'}:{kind:'po',sup:'',wh:myWh(),items:[],note:''};S.form._v=S.params.id+'|'+S.params.add;
    if(S.params.add&&!S.form.items.some(i=>i.pid===S.params.add)){const p=DB.get('products',S.params.add);S.form.items.push({pid:p.id,qty:Math.max(1,(p.max||p.min*2)-qtyOf(p.id)),price:p.cost});if(!S.form.sup)S.form.sup=p.sup||''}}
  const F=S.form;
  return hdr(F.id?L('编辑采购单','Edit PO'):L('新建采购单','New purchase order'))+`<div class="pad">
   <div class="fld"><label>${L('供应商','Supplier')}</label><div class="row gap">${partnerSel('sup',F.sup,"S.form.sup=this.value")}<button class="icbtn" onclick="newPartner('sup',id=>{S.form.sup=id;render(false)})">${ic('plus')}</button><button class="icbtn" title="${L('管理 / 删除','Manage / delete')}" onclick="go('m_partners',{t:'sup'})">${ic('edit')}</button></div></div>
   <div class="fld"><label>${L('入库仓库','Receiving warehouse')}</label>${whSel(F.wh,"S.form.wh=this.value;render(false)")}</div>
   <div class="sec-h" style="margin-bottom:0">${L('采购商品','Items')} <span class="sm muted">${F.items.length}</span></div>${itemsEditor('po')}
   <div class="fld"><label>${L('备注','Note')}</label><textarea class="inp" oninput="S.form.note=this.value">${esc(nm(F.note))}</textarea></div></div>
  <div class="bbar"><div class="total"><span class="l">${L('合计','Total')}</span><span class="v" id="ftotal" data-notr>${moneyBase(docTotal(F))}</span></div><button class="bigbtn ghost" onclick="savePO('draft')">${L('存草稿','Save draft')}</button><button class="bigbtn" onclick="savePO('ordered')">${L('提交下单','Place order')}</button></div>`};
function savePO(st){const F=S.form;if(!F.sup)return toast(L('请选择供应商','Choose a supplier'));const items=F.items.filter(i=>+i.qty>0);if(!items.length)return toast(L('请添加商品','Add at least one item'));
  const d=DB.put('po',{...F,kind:undefined,_v:undefined,items:items.map(i=>({...i,qty:+i.qty,price:+i.price,recv:+i.recv||0})),status:st,no:F.no||genNo('PO'),t:F.t||Date.now()});S.form=null;
  toast(st==='draft'?L('草稿已保存','Draft saved'):S.online?L('已下单','Order placed'):L('已暂存本机，联网后自动提交','Saved offline — will submit when online'));finish('po_view',{id:d.id})}
function steps(flow,cur,M){const i=flow.indexOf(cur);return `<div class="steps">${flow.map((s,k)=>`<div class="st ${k<=i?'ok':''}"><b>${k<i?'✓':k+1}</b>${L(M[s][0],M[s][1])}</div>`).join('')}</div>`}
V.po_view=()=>{const d=DB.get('po',S.params.id);if(!d)return hdr('')+emptyBox('doc',L('单据不存在','Not found'));
  const grns=DB.all('grn').filter(g=>g.po===d.id);const shs=DB.all('ships').filter(s=>s.ref===d.id);const acts=[];
  if(d.status==='draft'&&can('po')){acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('po_new',{id:'${d.id}'})">${L('编辑','Edit')}</button>`,`<button class="bigbtn" onclick="setSt('po','${d.id}','ordered')">${L('提交下单','Place order')}</button>`)}
  if(d.status==='ordered'&&can('po_recv'))acts.push(`<button class="bigbtn" onclick="S.form=null;go('recv',{id:'${d.id}'})">${ic('in',18)} ${L('采购入库','Receive')}</button>`);
  if(d.status==='received'&&can('po'))acts.push(`<button class="bigbtn" onclick="setSt('po','${d.id}','done')">${L('完成订单','Complete')}</button>`);
  if(['received','done'].includes(d.status)&&can('pr')&&grns.length)acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('pr_new',{grn:'${grns[0].id}'})">${ic('ret',18)} ${L('采购退货','Return')}</button>`);
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

/* ---------- 退货：采购主管 / 销售经理提交退货单 → 仓库主管确认出库 / 收货后才改库存（各司其职） ---------- */
const RT_ST={pending:['待仓库处理','Waiting for warehouse','b-gold'],done:['已完成','Completed','b-green'],cancel:['已取消','Cancelled','b-grey']};
function retCard(k,d){const src=k==='pr'?DB.get('grn',d.grn):DB.get('so',d.so);const party=k==='pr'?ptName((DB.get('po',(src||{}).po)||{}).sup):ptName((src||{}).cus);const qty=(d.items||[]).reduce((a,i)=>a+(+i.qty||0),0);
  return `<div class="wc" onclick="retSheet('${k}','${d.id}')"><div class="top"><div class="row between" style="gap:8px"><h3><span class="tt" data-notr>${esc(d.no)}</span><span class="tag">${k==='pr'?L('采购退货','To supplier'):L('销售退货','From customer')}</span></h3>${stB(RT_ST,d.status||'done')}</div>
   <small>${esc(party)} · ${esc(nm(d.reason)||'')}</small><div class="cols"><div><span class="l">${L('数量','Qty')}</span><span class="v" data-notr>${n2(qty)}</span></div><div><span class="l">${L('门店','Store')}</span><span class="v">${esc(whName(d.wh))}</span></div><div><span class="l">${L('日期','Date')}</span><span class="v">${fdate(d.t,false)}</span></div></div></div></div>`}
function retSheet(k,id){const d=DB.get(k,id);const ex=k==='pr'?can('pr_exec'):can('sr_exec');const pend=(d.status||'done')==='pending';
  openSheet(`<div class="row between"><div class="sh" data-notr>${esc(d.no)}</div>${stB(RT_ST,d.status||'done')}</div><div class="sm muted">${k==='pr'?L('采购退货：仓库确认后出库，库存减少','Supplier return: stock goes down when the warehouse ships it'):L('销售退货：仓库收货后入库，库存增加','Customer return: stock goes up when the warehouse receives it')}</div>
   <div class="box" style="padding:6px 16px">${d.items.map(i=>`<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm one">${esc(pName(i.pid))}</div>${i.batch?`<div class="xs muted" data-notr>${esc(i.batch)}</div>`:''}</div><b data-notr>${k==='pr'?'-':'+'}${n2(i.qty)}</b></div>`).join('')}</div>
   <div class="kv" style="margin-top:12px"><div><div class="l">${L('提交人','Requested by')}</div><div class="v">${esc(userName(d.by))}</div></div><div><div class="l">${L('门店','Store')}</div><div class="v">${esc(whName(d.wh))}</div></div>${d.xby?`<div><div class="l">${L('仓库处理','Handled by')}</div><div class="v">${esc(userName(d.xby))} · ${fdate(d.xt,false)}</div></div>`:''}</div>
   ${pend&&ex?`<button class="bigbtn" style="width:100%;margin-top:16px" onclick="retExec('${k}','${id}')">${k==='pr'?ic('out',18)+' '+L('确认退货出库','Ship out to supplier'):ic('in',18)+' '+L('确认收货入库','Receive into stock')}</button>`:''}
   ${pend&&!ex?`<div class="note-y" style="margin-top:14px">${L('等待仓库主管处理','Waiting for the warehouse manager')}</div>`:''}`)}
function retExec(k,id){const d=DB.get(k,id);if(!d||d.status!=='pending')return;
  if(k==='pr'){for(const i of d.items){const have=i.batch?batchesOf(i.pid,d.wh).filter(b=>(b.batch||'')===(i.batch||'')).reduce((a,b)=>a+b.q,0):qtyOf(i.pid,d.wh);if(have<i.qty)return toast(L('库存不足：','Not enough stock: ')+pName(i.pid))}
    d.items.forEach(i=>addMove({pid:i.pid,wh:d.wh,qty:-i.qty,type:'po_ret',ref:d.id,batch:i.batch||''}));const g=DB.get('grn',d.grn);
    if(g)DB.put('grn',{...g,items:g.items.map((it,n)=>{const x=d.items.find(y=>y.i===n);return x?{...it,ret:(+it.ret||0)+(+x.qty)}:it})})}
  else{const so=DB.get('so',d.so);d.items.forEach(i=>{const om=DB.all('moves').filter(m=>m.ref===d.so&&m.pid===i.pid&&m.type==='so_out').sort((a,b)=>b.t-a.t)[0]||{};addMove({pid:i.pid,wh:d.wh,qty:+i.qty,type:'so_ret',ref:d.id,batch:om.batch||'',exp:om.exp||''})});
    if(so)DB.put('so',{...so,items:so.items.map((it,n)=>{const x=d.items.find(y=>y.i===n);return x?{...it,ret:(+it.ret||0)+(+x.qty)}:it})})}
  DB.put(k,{...d,status:'done',xby:S.me.id,xt:Date.now()});Alerts.low(false);closeSheet(true);toast(k==='pr'?L('已退货出库','Shipped out to supplier'):L('已收货，库存已恢复','Received — stock restored'),false);render(false)}
/* 已提交未处理的退货数量也要扣掉，避免重复退 */
const pendRet=(k,ref,i)=>DB.all(k).filter(r=>(r.status||'done')==='pending'&&(k==='pr'?r.grn:r.so)===ref).reduce((a,r)=>a+r.items.filter(x=>x.i===i).reduce((b,x)=>b+x.qty,0),0);
V.pr_new=()=>{const gid=S.params.grn;if(!gid){const l=DB.all('grn').sort((a,b)=>b.t-a.t);return hdr(L('采购退货','Return to supplier'))+`<div class="pad"><div class="note-g" style="margin-top:4px">${L('选择要退货的入库单','Choose the receipt to return from')}</div><div style="margin-top:12px">${l.map(g=>{const po=DB.get('po',g.po)||{};return `<div class="wc" onclick="S.form=null;S.params.grn='${g.id}';render(true)"><div class="top"><div class="row between"><h3><span class="tt" data-notr>${esc(g.no)}</span></h3><span class="badge b-green">${L('已入库','Received')}</span></div><small>${esc(ptName(po.sup))} · <span data-notr>${esc(po.no||'')}</span></small><div class="cols"><div><span class="l">${L('商品','Items')}</span><span class="v">${g.items.length}</span></div><div><span class="l">${L('门店','Store')}</span><span class="v">${esc(whName(g.wh))}</span></div><div><span class="l">${L('日期','Date')}</span><span class="v">${fdate(g.t,false)}</span></div></div></div></div>`}).join('')||emptyBox('in',L('暂无入库单','No receipts'))}</div></div>`}
  const g=DB.get('grn',gid);const po=DB.get('po',g.po)||{};
  if(!S.form||S.form.kind!=='pr'||S.form.grn!==gid)S.form={kind:'pr',grn:gid,reason:'',lines:g.items.map((it,i)=>({i,pid:it.pid,batch:it.batch,max:Math.max(0,it.qty-(+it.ret||0)-pendRet('pr',gid,i)),qty:0}))};
  const F=S.form;
  return hdr(L('采购退货','Return to supplier'))+`<div class="pad"><div class="box" style="margin-top:6px"><div class="b" data-notr>${esc(g.no)}</div><div class="sm muted">${esc(ptName(po.sup))} · ${esc(whName(g.wh))} · ${fdate(g.t)}</div></div>
   <div class="note-y" style="margin-top:12px">${L('提交后由仓库主管确认出库，库存才会减少。','After you submit, the warehouse manager ships it out and stock goes down.')}</div>
   ${F.lines.map((l,k)=>{const p=P_(l.pid);return `<div class="box" style="margin-top:10px;padding:12px 14px"><div class="row gap">${thumb(p,40)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted">${l.batch?'<span data-notr>'+esc(l.batch)+'</span> · ':''}${L('最多可退','Max')} ${n2(l.max)} ${esc(unit(p))}</div></div>
    <div class="qty"><button onclick="S.form.lines[${k}].qty=Math.max(0,S.form.lines[${k}].qty-1);render(false)">−</button><input type="number" value="${l.qty}" oninput="S.form.lines[${k}].qty=+this.value"><button onclick="S.form.lines[${k}].qty=Math.min(${l.max},S.form.lines[${k}].qty+1);render(false)">+</button></div></div></div>`}).join('')}
   <div class="fld"><label>${L('退货原因','Reason')}</label><input class="inp" value="${esc(F.reason)}" oninput="S.form.reason=this.value" placeholder="${L('如：质量问题、型号不符','e.g. quality issue, wrong model')}"></div></div>
  <div class="bbar"><button class="bigbtn" onclick="doPR()">${L('提交退货单','Submit return')}</button></div>`};
function doPR(){const F=S.form;const g=DB.get('grn',F.grn);const lines=F.lines.filter(l=>+l.qty>0);if(!lines.length)return toast(L('请填写退货数量','Enter return quantities'));
  const bad=lines.find(l=>+l.qty>l.max);if(bad)return toast(L('超过可退数量：','Exceeds max: ')+pName(bad.pid));
  DB.put('pr',{no:genNo('PR'),grn:g.id,wh:g.wh,t:Date.now(),reason:F.reason,status:'pending',items:lines.map(l=>({i:l.i,pid:l.pid,qty:+l.qty,batch:l.batch||''}))});S.form=null;
  toast(L('已提交，等待仓库出库','Submitted — waiting for the warehouse'),false);finish('po_view',{id:g.po})}
V.sr_new=()=>{const sid=S.params.so;if(!sid){const l=DB.all('so').filter(s=>['shipped','done'].includes(s.status)).sort((a,b)=>b.t-a.t).slice(0,40);
    return hdr(L('销售退货','Customer return'))+`<div class="pad"><div class="note-g" style="margin-top:4px">${L('选择原销售单','Choose the original sales order')}</div><div style="margin-top:12px">${l.map(d=>docCard('so',d).replace(`go('so_view',{id:'${d.id}'})`,`S.form=null;S.params.so='${d.id}';render(true)`)).join('')||emptyBox('doc',L('暂无可退货的销售单','No shipped orders'))}</div></div>`}
  const d=DB.get('so',sid);if(!S.form||S.form.kind!=='sr'||S.form.so!==sid)S.form={kind:'sr',so:sid,reason:'',lines:d.items.map((it,i)=>({i,pid:it.pid,max:Math.max(0,(+it.shipped||it.qty)-(+it.ret||0)-pendRet('sr',sid,i)),qty:0}))};const F=S.form;
  return hdr(L('销售退货','Customer return'))+`<div class="pad"><div class="box" style="margin-top:6px"><div class="b" data-notr>${esc(d.no)}</div><div class="sm muted">${esc(ptName(d.cus))} · ${L('退回','Return to')} ${esc(whName(d.wh))}</div></div>
   <div class="note-y" style="margin-top:12px">${L('提交后由仓库主管确认收货，库存才会恢复。','After you submit, the warehouse manager receives the goods and stock goes back up.')}</div>
   ${F.lines.map((l,k)=>{const p=P_(l.pid);return `<div class="box" style="margin-top:10px;padding:12px 14px"><div class="row gap">${thumb(p,40)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted">${L('最多可退','Max')} ${n2(l.max)} ${esc(unit(p))}</div></div>
    <div class="qty"><button onclick="S.form.lines[${k}].qty=Math.max(0,S.form.lines[${k}].qty-1);render(false)">−</button><input type="number" value="${l.qty}" oninput="S.form.lines[${k}].qty=+this.value"><button onclick="S.form.lines[${k}].qty=Math.min(${l.max},S.form.lines[${k}].qty+1);render(false)">+</button></div></div></div>`}).join('')}
   <div class="fld"><label>${L('退货原因','Reason')}</label><input class="inp" value="${esc(F.reason)}" oninput="S.form.reason=this.value" placeholder="${L('如：破损、客户多订','e.g. damaged, over-ordered')}"></div></div>
  <div class="bbar"><button class="bigbtn" onclick="doSR()">${L('提交退货单','Submit return')}</button></div>`};
function doSR(){const F=S.form;const d=DB.get('so',F.so);const lines=F.lines.filter(l=>+l.qty>0);if(!lines.length)return toast(L('请填写退货数量','Enter return quantities'));
  const bad=lines.find(l=>+l.qty>l.max);if(bad)return toast(L('超过可退数量：','Exceeds max: ')+pName(bad.pid));
  DB.put('sr',{no:genNo('SR'),so:d.id,wh:d.wh,t:Date.now(),reason:F.reason,status:'pending',items:lines.map(l=>({i:l.i,pid:l.pid,qty:+l.qty}))});S.form=null;
  toast(L('已提交，等待仓库收货','Submitted — waiting for the warehouse'),false);finish('so_view',{id:d.id})}

/* ---------- 销售开单 ---------- */
V.so_new=()=>{if(!S.form||S.form.kind!=='so'||S.form._v!==S.params.id+'|'+S.params.add){const ex=S.params.id&&DB.get('so',S.params.id);
    S.form=ex?{...JSON.parse(JSON.stringify(ex)),kind:'so'}:{kind:'so',cus:'',wh:myWh(),items:[],addr:'',note:''};S.form._v=S.params.id+'|'+S.params.add;
    if(S.params.add&&!S.form.items.some(i=>i.pid===S.params.add)){const p=DB.get('products',S.params.add);S.form.items.push({pid:p.id,qty:1,price:p.price})}}
  const F=S.form;
  return hdr(F.id?L('编辑销售单','Edit order'):L('销售开单','New sale'))+`<div class="pad">
   ${!S.online?`<div class="note-y" style="margin-top:4px">${L('当前离线：开单会暂存本机，联网后自动提交','Offline: the order is saved on this phone and submitted when online')}</div>`:''}
   <div class="fld"><label>${L('客户','Customer')}</label><div class="row gap">${partnerSel('cus',F.cus,"S.form.cus=this.value")}<button class="icbtn" onclick="newPartner('cus',id=>{S.form.cus=id;render(false)})">${ic('plus')}</button><button class="icbtn" title="${L('管理 / 删除','Manage / delete')}" onclick="go('m_partners',{t:'cus'})">${ic('edit')}</button></div></div>
   <div class="fld"><label>${L('出货门店','Ship from store')}</label>${whSel(F.wh,"S.form.wh=this.value;render(false)")}</div>
   <div class="sec-h" style="margin-bottom:0">${L('商品','Items')} <span class="sm muted">${F.items.length}</span></div>${itemsEditor('so')}
   <div class="fld"><label>${L('送货地址','Delivery address')}</label><input class="inp" value="${esc(nm(F.addr))}" oninput="S.form.addr=this.value" placeholder="${L('客户自提可不填','Leave empty for pickup')}"></div>
   <div class="fld"><label>${L('备注','Note')}</label><textarea class="inp" oninput="S.form.note=this.value">${esc(nm(F.note))}</textarea></div></div>
  <div class="bbar"><div class="total"><span class="l">${L('合计','Total')}</span><span class="v" id="ftotal" data-notr>${moneyBase(docTotal(F))}</span></div><button class="bigbtn ghost" onclick="saveSO('draft')">${L('保存','Save')}</button><button class="bigbtn" onclick="saveSO('submitted')">${L('提交','Submit')}</button></div>`};
function saveSO(st){const F=S.form;if(!F.cus)return toast(L('请选择客户','Choose a customer'));const items=F.items.filter(i=>+i.qty>0);if(!items.length)return toast(L('请添加商品','Add at least one item'));
  const d=DB.put('so',{...F,kind:undefined,_v:undefined,items:items.map(i=>({...i,qty:+i.qty,price:+i.price})),status:st,no:F.no||genNo('SO'),t:F.t||Date.now()});S.form=null;
  toast(st==='draft'?L('已保存草稿','Draft saved'):S.online?L('已提交，库管将安排出库','Submitted — the warehouse will ship it'):L('已暂存本机，联网后自动提交','Saved offline — will submit when online'));finish('so_view',{id:d.id})}
V.so_view=()=>{const d=DB.get('so',S.params.id);if(!d)return hdr('')+emptyBox('doc',L('单据不存在','Not found'));const shs=DB.all('ships').filter(s=>s.ref===d.id);const rets=DB.all('sr').filter(r=>r.so===d.id);const acts=[];
  if(d.status==='draft'&&can('so'))acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('so_new',{id:'${d.id}'})">${L('编辑','Edit')}</button>`,`<button class="bigbtn" onclick="setSt('so','${d.id}','submitted')">${L('提交','Submit')}</button>`);
  if(d.status==='submitted'&&can('so_ship'))acts.push(`<button class="bigbtn" onclick="shipSheet('${d.id}')">${ic('out',18)} ${L('确认发货','Confirm shipment')}</button>`);
  if(d.status==='submitted'&&can('so')&&!can('so_ship'))acts.push(`<button class="bigbtn ghost" onclick="setSt('so','${d.id}','draft')">${L('撤回修改','Withdraw')}</button>`);
  if(d.status==='shipped'&&(can('so')||can('so_ship')))acts.push(`<button class="bigbtn" onclick="setSt('so','${d.id}','done')">${L('确认完成','Mark complete')}</button>`);
  if(['shipped','done'].includes(d.status)&&can('sr'))acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('sr_new',{so:'${d.id}'})">${ic('ret',18)} ${L('退货','Return')}</button>`);
  return hdr(L('销售单','Sales order'),`<button class="icbtn" onclick="copyText('${d.no}')">${ic('copy')}</button>`)+`<div class="pad">
   <div class="box" style="margin-top:6px"><div class="row between"><div class="b" style="font-size:18px" data-notr>${esc(d.no)}</div>${stB(SO_ST,d.status)}</div>${d.status!=='cancel'?steps(['draft','submitted','shipped','done'],d.status,SO_ST):''}
    <div class="kv" style="margin-top:14px"><div><div class="l">${L('客户','Customer')}</div><div class="v">${esc(ptName(d.cus))}</div></div><div><div class="l">${L('出货仓库','Warehouse')}</div><div class="v">${esc(whName(d.wh))}</div></div>
    <div><div class="l">${L('销售员','Sales rep')}</div><div class="v">${esc(userName(d.by))}</div></div><div><div class="l">${L('日期','Date')}</div><div class="v">${fdate(d.t)}</div></div>
    ${nm(d.addr)?`<div style="grid-column:1/3"><div class="l">${L('送货地址','Delivery address')}</div><div class="v">${esc(nm(d.addr))}</div></div>`:''}</div>
    ${d._q?`<div class="note-y" style="margin-top:12px">${ic('cloud',15)} ${L('暂存本机，联网后自动提交','Saved on this phone — submits when online')}</div>`:''}</div>
   <div class="box"><h4>${L('商品明细','Items')}</h4>${d.items.map(it=>{const p=P_(it.pid);return `<div class="li" onclick="go('product',{id:'${it.pid}'})">${thumb(p,38)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted" data-notr>${n2(it.qty)} ${esc(unit(p))} × ${n2(it.price)}${it.ret?` · <span class="red">${L('已退','returned')} ${n2(it.ret)}</span>`:''}</div></div><b data-notr>${n2(lineTotal(it))}</b></div>`}).join('')}
    <div class="row between" style="margin-top:10px"><span class="muted">${L('合计','Total')}</span><b style="font-size:20px" data-notr>${money(docTotal(d))}</b></div></div>
   ${rets.length?`<div class="box"><h4>${L('退货记录','Returns')}</h4>${rets.map(r=>`<div class="li" onclick="retSheet('sr','${r.id}')"><div class="qi" style="background:var(--lilac);color:var(--purple)">${ic('ret',18)}</div><div style="flex:1;min-width:0"><div class="b sm" data-notr>${esc(r.no)}</div><div class="xs muted">${fdate(r.t)} · ${esc(nm(r.reason)||'')}</div></div><b data-notr>${n2(r.items.reduce((a,i)=>a+i.qty,0))}</b></div>`).join('')}</div>`:''}
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
   ${d.status==='pending'&&S.me.role==='gm'?`<div class="bbar"><button class="bigbtn ghost" onclick="tkReview('${d.id}',false)">${L('驳回','Reject')}</button><button class="bigbtn" onclick="tkReview('${d.id}',true)">${L('审核通过','Approve')}</button></div>`:''}`};
function tkReview(id,ok){const d=DB.get('counts',id);
  if(ok){d.items.forEach(i=>{const x=i.real-i.sys;if(!x)return;const p=P_(i.pid);let batch='';if(p.batch){const b=batchesOf(i.pid,d.wh).filter(b=>b.q>0);batch=x<0?(b[0]||{}).batch||'':(b[b.length-1]||{}).batch||''}addMove({pid:i.pid,wh:d.wh,qty:x,type:'adj',ref:d.id,batch})});
    DB.put('counts',{...d,status:'approved',rv:S.me.id,rt:Date.now()});toast(L('已审核，库存已调整','Approved — stock adjusted'));Alerts.low(false);render(false)}
  else openSheet(`<div class="sh">${L('驳回原因','Reason for rejection')}</div><input class="inp" id="rjR" style="margin-top:10px" placeholder="${L('如：请复盘第 3 排货架','e.g. please recount aisle 3')}"><button class="bigbtn red" style="width:100%;margin-top:16px" onclick="DB.put('counts',{...DB.get('counts','${id}'),status:'rejected',rv:S.me.id,rt:Date.now(),rr:$('#rjR').value});closeSheet();toast(L('已驳回','Rejected'));render(false)">${L('确认驳回','Reject')}</button>`)}

/* ================= 财务：会计记账审核，出纳收付款（职责分离） =================
   应收 = 销售单金额 − 已完成退货；出纳登记收款 → 会计核对
   应付 = 采购单金额 − 已完成退货；会计审批付款 → 出纳执行付款 */
const PM={cash:['现金','Cash','cash'],bank:['银行转账','Bank','wh'],momo:['手机钱包','Mobile money','phone']};
const pmName=k=>L((PM[k]||PM.cash)[0],(PM[k]||PM.cash)[1]);
const FN_ST={recorded:['待核对','To verify','b-gold'],verified:['已核对','Verified','b-green'],req:['待总经理审批','Awaiting GM','b-gold'],rejected:['总经理驳回','Rejected by GM','b-red'],approved:['已批准待付','Approved, to pay','b-blue'],paid:['已付款','Paid','b-green'],void:['已作废','Void','b-grey']};
const soNet=s=>docTotal(s)-(s.items||[]).reduce((a,i)=>a+(+i.ret||0)*(+i.price||0),0);
const poNet=p=>{const grs=DB.all('grn').filter(g=>g.po===p.id).map(g=>g.id);const ret=DB.all('pr').filter(r=>grs.includes(r.grn)&&(r.status||'done')==='done').reduce((a,r)=>a+r.items.reduce((b,i)=>{const it=p.items.find(x=>x.pid===i.pid)||{};return b+i.qty*(+it.price||0)},0),0);return docTotal(p)-ret};
function arOf(s){const fs=DB.all('fin').filter(f=>f.type==='rcv'&&f.ref===s.id&&f.status!=='void');const got=fs.reduce((a,f)=>a+(+f.amount||0),0);const tot=soNet(s);return {tot,got,bal:Math.max(0,tot-got),fs}}
function apOf(p){const fs=DB.all('fin').filter(f=>f.type==='pay'&&f.ref===p.id&&f.status!=='void');const paid=fs.filter(f=>f.status==='paid').reduce((a,f)=>a+(+f.amount||0),0);
  const sum=st=>fs.filter(f=>f.status===st).reduce((a,f)=>a+(+f.amount||0),0);const appr=sum('approved'),req=sum('req'),tot=poNet(p);
  return {tot,paid,appr,req,bal:Math.max(0,tot-paid),free:Math.max(0,tot-paid-appr-req),fs}}
const arDocs=()=>DB.all('so').filter(s=>['submitted','shipped','done'].includes(s.status));
const apDocs=()=>DB.all('po').filter(p=>['ordered','received','done'].includes(p.status));
function finSum(){const t0=dayStart(),m0=+new Date(new Date().getFullYear(),new Date().getMonth(),1);const fin=DB.all('fin').filter(f=>f.status!=='void');
  const rc=fin.filter(f=>f.type==='rcv'),pd=fin.filter(f=>f.type==='pay'&&f.status==='paid');
  return {arBal:arDocs().reduce((a,s)=>a+arOf(s).bal,0),apBal:apDocs().reduce((a,p)=>a+apOf(p).bal,0),unverN:rc.filter(f=>f.status==='recorded').length,apprN:fin.filter(f=>f.type==='pay'&&f.status==='approved').length,reqN:fin.filter(f=>f.type==='pay'&&f.status==='req').length,rejN:fin.filter(f=>f.type==='pay'&&f.status==='rejected').length,
    rcvToday:rc.filter(f=>f.t>=t0).reduce((a,f)=>a+f.amount,0),payMonth:pd.filter(f=>(f.pt||f.t)>=m0).reduce((a,f)=>a+f.amount,0),cash:rc.reduce((a,f)=>a+f.amount,0)-pd.reduce((a,f)=>a+f.amount,0)}}
function finTodo(){if(!S.me||!can('fin'))return 0;const F=finSum();return (can('fin_verify')&&S.me.role!=='gm'?F.unverN:0)+(can('fin_pay')&&S.me.role!=='gm'?F.apprN:0)+(S.me.role==='gm'?F.reqN:0)+(S.me.role==='acct'?F.rejN:0)}
S.finSeg='ar';S.finF='open';
V.fin=()=>{if(S.params&&S.params.seg){S.finSeg=S.params.seg;S.params={}}const seg=S.finSeg||'ar';const F=finSum();let body='';
  if(seg==='ar'){const l=arDocs().map(s=>({s,x:arOf(s)})).filter(o=>S.finF==='all'||o.x.bal>0.005).sort((a,b)=>b.s.t-a.s.t).slice(0,120);
    body=`<div class="chips">${[['open',L('未收清','Outstanding')],['all',L('全部','All')]].map(([k,t])=>`<span class="chip ${S.finF===k?'on':''}" onclick="S.finF='${k}';render(false)">${t}</span>`).join('')}</div>
     <div style="margin-top:12px">${l.map(({s,x})=>`<div class="wc" onclick="arSheet('${s.id}')"><div class="top"><div class="row between" style="gap:8px"><h3><span class="tt" data-notr>${esc(s.no)}</span></h3>${x.bal<=0.005?`<span class="badge b-green">${L('已收清','Paid')}</span>`:x.got>0?`<span class="badge b-gold">${L('部分收款','Part paid')}</span>`:`<span class="badge b-red">${L('未收款','Unpaid')}</span>`}</div>
      <small>${esc(ptName(s.cus))} · ${L(SO_ST[s.status][0],SO_ST[s.status][1])}</small>
      <div class="cols"><div><span class="l">${L('应收','Due')}</span><span class="v" data-notr>${numK(x.tot)}</span></div><div><span class="l">${L('已收','Received')}</span><span class="v" data-notr>${numK(x.got)}</span></div><div><span class="l">${L('余额','Balance')}</span><span class="v ${x.bal>0?'red':''}" data-notr>${numK(x.bal)}</span></div></div></div></div>`).join('')||emptyBox('calc',L('没有未收清的销售单','Nothing outstanding'))}</div>`}
  else if(seg==='ap'){const l=apDocs().map(p=>({p,x:apOf(p)})).filter(o=>S.finF==='all'||o.x.bal>0.005).sort((a,b)=>(b.x.req+b.x.appr>0)-(a.x.req+a.x.appr>0)||b.p.t-a.p.t);
    body=(S.me.role==='gm'&&F.reqN?`<div class="note-y" style="margin-bottom:12px;cursor:pointer" onclick="payReview()">${ic('calc',16)} ${L(`${F.reqN} 笔付款申请待您审批，点此审批`,`${F.reqN} payment request(s) to review — tap here`)}</div>`:'')+`<div class="chips">${[['open',L('未付清','Outstanding')],['all',L('全部','All')]].map(([k,t])=>`<span class="chip ${S.finF===k?'on':''}" onclick="S.finF='${k}';render(false)">${t}</span>`).join('')}</div>
     <div style="margin-top:12px">${l.map(({p,x})=>`<div class="wc" onclick="apSheet('${p.id}')"><div class="top"><div class="row between" style="gap:8px"><h3><span class="tt" data-notr>${esc(p.no)}</span></h3>${x.req>0?`<span class="badge b-gold">${L('待总经理审批','Awaiting GM')}</span>`:x.appr>0?`<span class="badge b-blue">${L('已批准待付','Approved')}</span>`:x.bal<=0.005?`<span class="badge b-green">${L('已付清','Paid')}</span>`:`<span class="badge b-red">${L('未付款','Unpaid')}</span>`}</div>
      <small>${esc(ptName(p.sup))} · ${L(PO_ST[p.status][0],PO_ST[p.status][1])}</small>
      <div class="cols"><div><span class="l">${L('应付','Due')}</span><span class="v" data-notr>${numK(x.tot)}</span></div><div><span class="l">${L('已付','Paid')}</span><span class="v" data-notr>${numK(x.paid)}</span></div><div><span class="l">${L('余额','Balance')}</span><span class="v ${x.bal>0?'red':''}" data-notr>${numK(x.bal)}</span></div></div></div></div>`).join('')||emptyBox('calc',L('没有未付清的采购单','Nothing outstanding'))}</div>`}
  else{const fin=DB.all('fin').filter(f=>f.status!=='void'&&(f.type==='rcv'||f.status==='paid')).sort((a,b)=>(b.pt||b.t)-(a.pt||a.t));const bal={cash:0,bank:0,momo:0};
    fin.forEach(f=>{bal[f.method]=(bal[f.method]||0)+(f.type==='rcv'?1:-1)*f.amount});
    body=`<div class="stats">${Object.keys(PM).map(k=>statT(k==='cash'?'g':'',numK(bal[k]||0),pmName(k),'',1)).join('')}</div>
     <div class="row between" style="margin:14px 2px 6px"><b>${L('收付款流水','Receipts & payments')}</b><button class="pill w" onclick="exportFin()">${ic('download',16)} Excel</button></div>
     <div class="box" style="margin-top:0;padding:4px 16px">${fin.slice(0,150).map(f=>{const d=DB.get(f.refKind,f.ref)||{};return `<div class="li" onclick="${f.refKind==='open'?'':f.type==='rcv'?`arSheet('${f.ref}')`:`apSheet('${f.ref}')`}"><div class="qi" style="background:${f.type==='rcv'?'var(--lime)':'#FCE9E5'};color:${f.type==='rcv'?'var(--green)':'var(--red)'}">${ic(f.type==='rcv'?'in':'out',18)}</div>
      <div style="flex:1;min-width:0"><div class="b sm one">${f.refKind==='open'?L('期初资金','Opening balance'):(f.type==='rcv'?L('收款','Receipt'):L('付款','Payment'))+' · <span data-notr>'+esc(d.no||'')+'</span> · '+esc(ptName(d.cus||d.sup))}</div><div class="xs muted one">${pmName(f.method)} · ${fdate(f.pt||f.t)} · ${stB(FN_ST,f.status)}</div></div>
      <b class="${f.type==='rcv'?'green':'red'}" data-notr style="white-space:nowrap">${f.type==='rcv'?'+':'−'}${money(f.amount)}</b></div>`}).join('')||emptyBox('calc',L('暂无收付款','No entries yet'))}</div>`}
  return `<div class="pad" style="padding-top:16px"><div class="row between"><div class="ptitle">${L('财务','Finance')}</div><div class="row" style="gap:8px">${curBtn()}</div></div>
   <div class="stats">${statT('g',numK(F.arBal),L('应收余额','Receivable'),"S.finSeg='ar';render(false)",1)}${statT('',numK(F.apBal),L('应付余额','Payable'),"S.finSeg='ap';render(false)")}${statT(F.unverN||F.apprN?'y':'',can('fin_pay')&&S.me.role==='cashier'?F.apprN:F.unverN,can('fin_pay')&&S.me.role==='cashier'?L('待付款','To pay'):L('待核对收款','To verify'),"S.finSeg='"+(S.me.role==='cashier'?'ap':'book')+"';render(false)")}</div>
   <div class="xs muted" style="margin:10px 2px 0">${L('金额单位','Amounts in')} <b data-notr>${esc(CUR())} ${dispIso()}</b></div><div class="seg">${[['ar',L('应收','Receivable')],['ap',L('应付','Payable')],['book',L('资金日记账','Cash book')]].map(([k,t])=>`<button class="${seg===k?'on':''}" onclick="S.finSeg='${k}';S.finF='open';render(false)">${t}</button>`).join('')}</div>${body}</div>`};
function arSheet(id){const s=DB.get('so',id);const x=arOf(s);
  openSheet(`<div class="row between"><div class="sh" data-notr>${esc(s.no)}</div>${stB(SO_ST,s.status)}</div><div class="sm muted">${esc(ptName(s.cus))} · ${fdate(s.t)}</div>
   <div class="kv" style="margin-top:12px"><div><div class="l">${L('应收','Due')}</div><div class="v" data-notr>${money(x.tot)}</div></div><div><div class="l">${L('余额','Balance')}</div><div class="v ${x.bal>0?'red':'green'}" data-notr>${money(x.bal)}</div></div><div><div class="l">${L('已收','Received')}</div><div class="v" data-notr>${money(x.got)}</div></div></div>
   <div class="box" style="padding:6px 16px">${x.fs.map(f=>`<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm">${pmName(f.method)} · <span data-notr>${money(f.amount)}</span></div><div class="xs muted">${fdate(f.t)} · ${L('出纳','Cashier')} ${esc(userName(f.by))}${f.vby?' · '+L('会计','Accountant')+' '+esc(userName(f.vby)):''}${nm(f.note)?' · '+esc(nm(f.note)):''}</div></div>
     ${f.status==='recorded'&&can('fin_verify')?`<button class="pill g" onclick="finVerify('${f.id}','${id}')">${L('核对','Verify')}</button>`:stB(FN_ST,f.status)}</div>`).join('')||`<div class="sm muted" style="padding:10px 0">${L('还没有收款记录','No receipts yet')}</div>`}</div>
   ${can('fin_receive')&&x.bal>0.005?`<div class="sec-h" style="margin-top:16px">${L('登记收款','Record receipt')}</div><div class="row gap"><input class="inp" id="rcA" type="number" inputmode="decimal" value="${(+x.bal).toFixed(2)}" style="background:var(--card)"><span class="b" data-notr>${esc(baseIso())}</span></div>
     <div class="chips wrap" style="margin-top:10px">${Object.keys(PM).map((k,i)=>`<span class="chip ${i?'':'on'}" data-m="${k}" onclick="this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${pmName(k)}</span>`).join('')}</div>
     <input class="inp" id="rcN" style="margin-top:10px;background:var(--card)" placeholder="${L('备注 / 流水号（可选）','Note / reference (optional)')}">
     <button class="bigbtn" style="width:100%;margin-top:14px" onclick="finRecv('${id}')">${ic('check',18)} ${L('确认收款','Confirm receipt')}</button>`:''}
   ${!can('fin_receive')&&x.bal>0.005&&can('fin')?`<div class="note-y" style="margin-top:12px">${L('收款由出纳登记，会计负责核对。','The cashier records receipts; the accountant verifies them.')}</div>`:''}`)}
function finRecv(id){const s=DB.get('so',id);const x=arOf(s);const amt=+$('#rcA').value;if(!(amt>0))return toast(L('请输入收款金额','Enter an amount'));if(amt>x.bal+0.005)return toast(L('超过未收余额','More than the balance'));
  const m=($('#sheet .chip.on')||{}).dataset.m||'cash';DB.put('fin',{type:'rcv',ref:id,refKind:'so',amount:amt,method:m,note:$('#rcN').value.trim(),status:'recorded',t:Date.now()});
  toast(L('已登记收款，等待会计核对','Receipt recorded — waiting for the accountant'),false);arSheet(id);softRender(true)}
function finVerify(fid,so){const f=DB.get('fin',fid);DB.put('fin',{...f,status:'verified',vby:S.me.id,vt:Date.now()});toast(L('已核对','Verified'),false);arSheet(so);softRender(true)}
/* ===== 付款审批流程：会计提交付款申请 → 总经理审批（批准 / 驳回）→ 出纳按批准金额付款 ===== */
const PAY_PURP={dep:['预付款 / 定金','Deposit / advance'],goods:['货款','Goods payment'],final:['尾款','Final payment'],freight:['运费 / 清关','Freight / clearance'],other:['其他','Other']};
const purpName=k=>{const p=PAY_PURP[k]||PAY_PURP.other;return L(p[0],p[1])};
/* 每笔付款的过程记录：谁申请、谁批准 / 驳回、谁付款 */
function payTrail(f){const st=(ic_,c,t,who,at,note)=>`<div class="row" style="gap:8px;align-items:flex-start;margin-top:6px"><span style="color:${c};flex:none">${ic(ic_,14)}</span><div class="xs" style="flex:1;min-width:0"><b>${t}</b> · ${esc(userName(who))} · ${fdate(at)}${note?`<div class="muted">${esc(note)}</div>`:''}</div></div>`;
  let h=st('doc','var(--purple)',L('会计申请','Requested by accountant'),f.by,f.at||f.t,[purpName(f.purp),f.due?L('希望 ','wanted by ')+fday(f.due):'',nm(f.note)].filter(Boolean).join(' · '));
  if(f.gby)h+=st(f.status==='rejected'?'x':'check',f.status==='rejected'?'var(--red)':'var(--green)',f.status==='rejected'?L('总经理驳回','Rejected by GM'):L('总经理批准','Approved by GM'),f.gby,f.gt,f.gnote);
  if(f.pby)h+=st('out','var(--orange)',L('出纳付款','Paid by cashier'),f.pby,f.pt,[pmName(f.method),f.pref].filter(Boolean).join(' · '));
  if(f.status==='void')h+=`<div class="xs muted" style="margin-top:6px">${L('已撤回作废','Withdrawn')}</div>`;return h}
function apSheet(id){const p=DB.get('po',id);const x=apOf(p);const me=S.me.role;
  const acts=f=>{let b='';
    if(f.status==='req'&&me==='gm')b+=`<button class="pill g" onclick="payGm('${f.id}')">${L('审批','Review')}</button>`;
    if(f.status==='approved'&&can('fin_pay'))b+=`<button class="pill g" onclick="finPaySheet('${f.id}')">${L('付款','Pay')}</button>`;
    if(f.status==='approved'&&me==='gm')b+=`<button class="pill w" style="margin-left:6px" onclick="payUnapprove('${f.id}')">${L('撤销批准','Undo approval')}</button>`;
    if(['req','rejected'].includes(f.status)&&(me==='acct'||me==='gm'))b+=`${f.status==='rejected'?`<button class="pill g" onclick="payReqSheet('${id}','${f.id}')">${L('修改后重新提交','Edit & resubmit')}</button>`:''}<button class="pill w" style="margin-left:6px" onclick="finVoid('${f.id}','${id}')">${L('撤回','Withdraw')}</button>`;
    return b||stB(FN_ST,f.status)};
  openSheet(`<div class="row between"><div class="sh" data-notr>${esc(p.no)}</div>${stB(PO_ST,p.status)}</div><div class="sm muted">${esc(ptName(p.sup))} · ${fdate(p.t)}</div>
   <div class="kv" style="margin-top:12px"><div><div class="l">${L('应付','Due')}</div><div class="v" data-notr>${money(x.tot)}</div></div><div><div class="l">${L('已付','Paid')}</div><div class="v" data-notr>${money(x.paid)}</div></div><div><div class="l">${L('审批中 / 已批准待付','In review / approved')}</div><div class="v" data-notr>${money(x.req)} / ${money(x.appr)}</div></div><div><div class="l">${L('余额','Balance')}</div><div class="v ${x.bal>0?'red':'green'}" data-notr>${money(x.bal)}</div></div></div>
   <div class="xs muted" style="margin-top:6px">${L('流程：会计申请 → 总经理批准 → 出纳付款','Flow: accountant requests → GM approves → cashier pays')}</div>
   <div class="box" style="padding:6px 16px">${x.fs.slice().sort((a,b)=>b.t-a.t).map(f=>`<div class="li" style="cursor:default;align-items:flex-start"><div style="flex:1;min-width:0"><div class="row" style="gap:8px"><b class="sm" data-notr>${money(f.amount)}</b>${stB(FN_ST,f.status)}</div>${payTrail(f)}</div><div style="flex:none;display:flex;flex-direction:column;gap:6px;align-items:flex-end">${acts(f)}</div></div>`).join('')||`<div class="sm muted" style="padding:10px 0">${L('还没有付款申请','No payment requests yet')}</div>`}</div>
   ${(me==='acct'||me==='gm')&&x.free>0.005?`<button class="bigbtn" style="width:100%;margin-top:14px" onclick="payReqSheet('${id}')">${ic('plus',18)} ${L('提交付款申请（交总经理审批）','Request payment (for GM approval)')}</button>`:''}
   ${me!=='acct'&&me!=='gm'&&x.free>0.005?`<div class="note-y" style="margin-top:12px">${L('付款流程：会计提交申请 → 总经理批准 → 出纳付款。','Flow: the accountant requests, the GM approves, then the cashier pays.')}</div>`:''}`)}
/* 会计：填写付款申请（金额、用途、希望付款日期、付款方式、说明） */
function payReqSheet(po,fid){const p=DB.get('po',po),x=apOf(p),f=fid?DB.get('fin',fid):null;const max=x.free+(f?0:0);
  S.pq={purp:f?f.purp||'goods':'goods',method:f?f.method||'bank':'bank'};
  openSheet(`<div class="sh">${f?L('修改付款申请','Edit payment request'):L('付款申请','Payment request')}</div><div class="sm muted"><span data-notr>${esc(p.no)}</span> · ${esc(ptName(p.sup))}</div>
   ${f&&f.gnote?`<div class="note-r" style="margin-top:10px">${L('总经理驳回意见：','GM comment: ')}${esc(f.gnote)}</div>`:''}
   <div class="kv" style="margin-top:12px"><div><div class="l">${L('应付总额','Total due')}</div><div class="v" data-notr>${money(x.tot)}</div></div><div><div class="l">${L('可申请金额','Can request')}</div><div class="v" data-notr>${money(max)}</div></div></div>
   <div class="fld"><label>${L('申请金额','Amount')} (${esc(baseIso())})</label><input class="inp" id="pqA" type="number" inputmode="decimal" value="${(+(f?f.amount:max)).toFixed(2)}" style="background:var(--card)"></div>
   <div class="fld"><label>${L('用途','Purpose')}</label><div class="chips wrap" id="pqP">${Object.keys(PAY_PURP).map(k=>`<span class="chip ${S.pq.purp===k?'on':''}" onclick="S.pq.purp='${k}';$$('#pqP .chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${purpName(k)}</span>`).join('')}</div></div>
   <div class="fld"><label>${L('建议付款方式','Suggested method')}</label><div class="chips wrap" id="pqM">${Object.keys(PM).map(k=>`<span class="chip ${S.pq.method===k?'on':''}" onclick="S.pq.method='${k}';$$('#pqM .chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${pmName(k)}</span>`).join('')}</div></div>
   <div class="fld"><label>${L('希望付款日期','Pay by')}</label><input class="inp" id="pqD" type="date" value="${f&&f.due?new Date(f.due).toISOString().slice(0,10):new Date(Date.now()+864e5).toISOString().slice(0,10)}" style="background:var(--card)"></div>
   <div class="fld"><label>${L('申请说明（必填，例如：合同约定发货前付 50%）','Reason (required, e.g. 50% before shipment per contract)')}</label><input class="inp" id="pqN" value="${esc(f?nm(f.note):'')}" style="background:var(--card)"></div>
   <div class="sm red" id="pqE" style="margin-top:8px"></div>
   <button class="bigbtn" style="width:100%;margin-top:12px" onclick="payReqSave('${po}','${fid||''}')">${L('提交给总经理审批','Send to the GM for approval')}</button>`);
}
function payReqSave(po,fid){const x=apOf(DB.get('po',po)),f=fid?DB.get('fin',fid):null,e=$('#pqE');const amt=+$('#pqA').value,note=$('#pqN').value.trim(),due=$('#pqD').value;
  if(!(amt>0))return e.textContent=L('请输入金额','Enter an amount');if(amt>x.free+0.005)return e.textContent=L('超过可申请金额','More than can be requested');
  if(note.length<2)return e.textContent=L('请填写申请说明','Enter a reason');
  const d={...(f||{type:'pay',ref:po,refKind:'po'}),amount:+amt.toFixed(2),purp:S.pq.purp,method:S.pq.method,due:due?+new Date(due):0,note,status:'req',at:Date.now(),t:f?f.t:Date.now()};
  delete d.gby;delete d.gt;delete d.gnote;DB.put('fin',d);closeSheet(true);toast(L('已提交，等待总经理审批','Sent — waiting for the GM'),false);apSheet(po);softRender(true)}
/* 总经理：逐笔审批，可批准或驳回（驳回需写原因） */
function payGm(fid){const f=DB.get('fin',fid),p=DB.get('po',f.ref),x=apOf(p);if(S.me.role!=='gm')return;
  const after=Math.max(0,x.bal-f.amount);const sup=DB.all('po').filter(o=>o.sup===p.sup).map(o=>apOf(o)).reduce((a,y)=>a+y.bal,0);
  openSheet(`<div class="sh">${L('审批付款申请','Review payment request')}</div><div class="sm muted"><span data-notr>${esc(p.no)}</span> · ${esc(ptName(p.sup))}</div>
   <div style="font-size:30px;font-weight:800;margin-top:12px" data-notr>${moneyBase(f.amount)}</div>
   <div class="kv" style="margin-top:12px"><div><div class="l">${L('采购单应付','PO total')}</div><div class="v" data-notr>${money(x.tot)}</div></div><div><div class="l">${L('已付','Paid')}</div><div class="v" data-notr>${money(x.paid)}</div></div>
    <div><div class="l">${L('本次付后余额','Balance after this')}</div><div class="v" data-notr>${money(after)}</div></div><div><div class="l">${L('该供应商欠款合计','Owed to this supplier')}</div><div class="v" data-notr>${money(sup)}</div></div>
    <div><div class="l">${L('采购单状态','PO status')}</div><div class="v">${L(PO_ST[p.status][0],PO_ST[p.status][1])}</div></div><div><div class="l">${L('现金余额','Cash on hand')}</div><div class="v" data-notr>${money(finSum().cash)}</div></div></div>
   <div class="box" style="padding:10px 14px">${payTrail(f)}</div>
   <div class="fld"><label>${L('审批意见（驳回时必填）','Comment (required to reject)')}</label><input class="inp" id="pgN" style="background:var(--card)"></div>
   <div class="sm red" id="pgE" style="margin-top:8px"></div>
   <div class="row gap" style="margin-top:12px"><button class="bigbtn dark" style="flex:1" onclick="payGmDo('${fid}',false)">${ic('x',18)} ${L('驳回','Reject')}</button><button class="bigbtn" style="flex:1" onclick="payGmDo('${fid}',true)">${ic('check',18)} ${L('批准付款','Approve')}</button></div>`)}
function payGmDo(fid,ok){const f=DB.get('fin',fid),n=$('#pgN').value.trim();if(!f||f.status!=='req')return toast(L('这笔申请已处理','Already handled'));
  if(!ok&&n.length<2)return $('#pgE').textContent=L('驳回请写明原因','Give a reason for rejecting');
  DB.put('fin',{...f,status:ok?'approved':'rejected',gby:S.me.id,gt:Date.now(),gnote:n});closeSheet(true);
  toast(ok?L('已批准，出纳会收到付款通知','Approved — the cashier has been notified'):L('已驳回，会计会收到通知','Rejected — the accountant has been notified'),false);apSheet(f.ref);softRender(true)}
function payUnapprove(fid){const f=DB.get('fin',fid);if(S.me.role!=='gm'||f.status!=='approved')return;DB.put('fin',{...f,status:'req',gby:null,gt:null,gnote:''});toast(L('已撤销批准，回到待审批','Approval undone'),false);apSheet(f.ref);softRender(true)}
/* 总经理：所有待审批的付款申请 */
function payReview(){const l=DB.all('fin').filter(f=>f.type==='pay'&&f.status==='req').sort((a,b)=>(a.due||a.t)-(b.due||b.t));
  openSheet(`<div class="sh">${L('付款申请待审批','Payment requests to review')}</div>
   <div class="box" style="padding:4px 16px">${l.map(f=>{const p=DB.get('po',f.ref)||{};return `<div class="li" onclick="payGm('${f.id}')"><div class="qi" style="background:#FFF4D6;color:#8a6200">${ic('calc',18)}</div><div style="flex:1;min-width:0"><div class="b sm one"><span data-notr>${esc(p.no||'')}</span> · ${esc(ptName(p.sup))}</div><div class="xs muted one">${purpName(f.purp)} · ${esc(userName(f.by))} · ${f.due?L('希望 ','by ')+fday(f.due):fdate(f.t)}</div></div><b data-notr style="white-space:nowrap">${money(f.amount)}</b></div>`}).join('')||`<div class="sm muted" style="padding:12px 0">${L('没有待审批的付款','Nothing to review')}</div>`}</div>`)}
function finVoid(fid,po){const f=DB.get('fin',fid);if(!['req','rejected'].includes(f.status))return toast(L('已批准的付款只能由总经理撤销','Only the GM can undo an approved payment'));DB.put('fin',{...f,status:'void'});toast(L('已撤回','Withdrawn'),false);apSheet(po);softRender(true)}
/* 出纳：只能按总经理批准的金额付款 */
function finPaySheet(fid){const f=DB.get('fin',fid);const p=DB.get('po',f.ref);if(f.status!=='approved')return toast(L('需要总经理批准后才能付款','Needs GM approval first'));
  openSheet(`<div class="sh">${L('执行付款','Make payment')}</div><div class="sm muted"><span data-notr>${esc(p.no)}</span> · ${esc(ptName(p.sup))}</div>
   <div style="font-size:30px;font-weight:800;margin-top:12px" data-notr>${moneyBase(f.amount)}</div>
   <div class="box" style="padding:10px 14px">${payTrail(f)}</div>
   <div class="chips wrap" style="margin-top:12px">${Object.keys(PM).map(k=>`<span class="chip ${k===(f.method||'bank')?'on':''}" data-m="${k}" onclick="this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${pmName(k)}</span>`).join('')}</div>
   <input class="inp" id="pyN" style="margin-top:10px;background:var(--card)" placeholder="${L('银行流水号 / 收据号（必填）','Bank or receipt reference (required)')}">
   <button class="bigbtn" style="width:100%;margin-top:14px" onclick="finPay('${fid}')">${ic('check',18)} ${L('确认已付款','Confirm paid')}</button>`)}
function finPay(fid){const f=DB.get('fin',fid);if(f.status!=='approved')return toast(L('需要总经理批准后才能付款','Needs GM approval first'));const ref=$('#pyN').value.trim();if(ref.length<2)return toast(L('请填写流水号 / 收据号','Enter the reference'));
  const m=($('#sheet .chip.on')||{}).dataset.m||'bank';DB.put('fin',{...f,status:'paid',method:m,pby:S.me.id,pt:Date.now(),pref:ref});
  toast(L('已付款','Paid'),false);apSheet(f.ref);softRender(true)}
function exportFin(){const fin=DB.all('fin').filter(f=>f.status!=='void'&&(f.type==='rcv'||f.status==='paid')).sort((a,b)=>(a.pt||a.t)-(b.pt||b.t));let bal=0;
  exportXlsx(L('资金日记账','CashBook'),[{name:L('资金日记账','Cash book'),title:L('资金日记账','Cash book'),money:[5,6,7],
   head:[L('日期','Date'),L('类型','Type'),L('单号','Ref'),L('往来单位','Party'),L('方式','Method'),L('收入','In'),L('支出','Out'),L('余额','Balance'),L('状态','Status'),L('经手人','By')],
   rows:fin.map(f=>{const d=f.refKind==='open'?{}:(DB.get(f.refKind,f.ref)||{});const v=+conv(f.amount).toFixed(2);bal+=f.type==='rcv'?v:-v;return [fday(f.pt||f.t),f.refKind==='open'?L('期初资金','Opening balance'):f.type==='rcv'?L('收款','Receipt'):L('付款','Payment'),d.no||'',ptName(d.cus||d.sup),pmName(f.method),f.type==='rcv'?v:null,f.type==='pay'?v:null,+bal.toFixed(2),L(FN_ST[f.status][0],FN_ST[f.status][1]),userName(f.pby||f.by)]}),
   total:[L('合计','Total'),'','','','',+fin.filter(f=>f.type==='rcv').reduce((a,f)=>a+conv(f.amount),0).toFixed(2),+fin.filter(f=>f.type==='pay').reduce((a,f)=>a+conv(f.amount),0).toFixed(2),+bal.toFixed(2),'','']}])}

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
  const F=S.form;if(!F.costManual&&(+F.kg||+F.cbm))F.cost=frCost(F.mode,F.kg,F.cbm).cost;const refs=F.dir==='out'?DB.all('so').filter(s=>['submitted','shipped'].includes(s.status)):DB.all('po').filter(p=>['ordered','received'].includes(p.status));
  const fld=(k,t,ph,type)=>`<div class="fld"><label>${t}</label><input class="inp" ${type?`type="${type}"`:''} value="${esc(F[k])}" placeholder="${ph||''}" oninput="S.form.${k}=this.value"></div>`;
  return hdr(L('登记物流','New shipment'))+`<div class="pad"><div class="seg">${[['out',L('发货（销售）','Outbound')],['in',L('到货（采购）','Inbound')]].map(([k,t])=>`<button class="${F.dir===k?'on':''}" onclick="S.form.dir='${k}';S.form.ref='';S.form.refKind='${k==='out'?'so':'po'}';render(false)">${t}</button>`).join('')}</div>
   <div class="fld"><label>${L('关联单据（可选）','Linked order (optional)')}</label><select class="inp" onchange="S.form.ref=this.value;S.form.refKind='${F.dir==='out'?'so':'po'}'"><option value="">${L('不关联','None')}</option>${refs.map(r=>`<option value="${r.id}" ${r.id===F.ref?'selected':''}>${esc(r.no)} · ${esc(ptName(r.cus||r.sup))}</option>`).join('')}</select></div>
   <div class="fld"><label>${L('承运商','Carrier')}</label><select class="inp" onchange="S.form.carrier=this.value;S.form.mode=carrier(this.value).mode;render(false)">${CARRIERS.map(c=>`<option value="${c.id}" ${c.id===F.carrier?'selected':''}>${esc(nm(c))}</option>`).join('')}</select></div>
   <div class="chips wrap" style="margin-top:10px">${Object.keys(MODES).map(k=>`<span class="chip sm ${F.mode===k?'on':''}" onclick="S.form.mode='${k}';if(!S.form.costManual&&(+S.form.kg||+S.form.cbm))S.form.cost=frCost('${k}',S.form.kg,S.form.cbm).cost;render(false)">${ic(MODES[k][2],14)} ${L(MODES[k][0],MODES[k][1])}</span>`).join('')}</div>
   ${fld('trackNo',F.mode==='road'?L('车牌 / 单号','Plate / ref no.'):L('运单号 / 提单号','Tracking / B/L no.'),'')}${F.mode==='sea'?fld('container',L('柜号 / 柜型','Container no. / type'),'MSKU1234567 / 40HQ'):''}
   <div class="row gap">${fld('from',L('起运地','From'))}${fld('to',L('目的地','To'))}</div><div class="row gap">${fld('eta',L('预计到达','ETA'),'','date')}</div>
   <div class="row gap"><div class="fld"><label>${L('重量（公斤）','Weight (kg)')}</label><input class="inp" type="number" inputmode="decimal" value="${esc(F.kg||'')}" oninput="S.form.kg=this.value;shipCost()"></div><div class="fld"><label>${L('体积（立方米）','Volume (m³)')}</label><input class="inp" type="number" inputmode="decimal" value="${esc(F.cbm||'')}" oninput="S.form.cbm=this.value;shipCost()"></div></div>
   <div class="fld"><label>${L('运费','Freight')} (${esc(CUR())}) <span class="xs muted" id="shCostHint" data-notr>${shCostHint()}</span></label><input class="inp" id="shCost" type="number" inputmode="decimal" value="${esc(F.cost)}" placeholder="0" oninput="S.form.cost=this.value;S.form.costManual=true"></div>
   ${fld('driver',L('司机 / 联系人电话','Driver / contact phone'))}</div>
  <div class="bbar"><button class="bigbtn" onclick="saveShip()">${L('保存','Save')}</button></div>`};
function saveShip(){const F=S.form;if(!F.trackNo&&F.mode!=='road')return toast(L('请填写运单号','Enter a tracking number'));if(!F.from||!F.to)return toast(L('请填写起运地和目的地','Enter origin and destination'));
  const d=DB.put('ships',{no:genNo('SH'),kg:+F.kg||0,cbm:+F.cbm||0,dir:F.dir,ref:F.ref,refKind:F.ref?F.refKind:'',carrier:F.carrier,mode:F.mode,trackNo:F.trackNo.trim(),container:F.container,from:F.from,to:F.to,eta:F.eta,cost:+F.cost||0,driver:F.driver,status:'pending',t:Date.now(),ev:[{t:Date.now(),st:'pending',place:F.from,note:''}]});
  S.form=null;toast(L('已登记','Saved'));finish('ship_view',{id:d.id})}
/* 物流服务：运费估算 / 预约提货送货 / 承运商查询 / 清关资料 */
V.logi_svc=()=>{S.fc=S.fc||{mode:'sea',kg:1000,cbm:2};const bk=DB.all('svc').sort((a,b)=>b.t-a.t);
  const BK={new:['待处理','New','b-gold'],confirmed:['已安排','Scheduled','b-blue'],done:['已完成','Done','b-green'],cancel:['已取消','Cancelled','b-grey']};
  return hdr(L('物流服务','Logistics services'))+`<div class="pad">
   <div class="box" style="margin-top:6px;background:var(--green);color:#fff"><div class="row gap"><div class="qi" style="width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,.2);display:grid;place-items:center">${ic('calc')}</div><div><div class="b" style="font-size:17px">${L('运费估算','Freight estimate')}</div><div class="xs" style="opacity:.85">${L('重量或体积 × 单价','Weight or volume × unit price')}</div></div></div>
    <div class="chips wrap" style="margin-top:12px">${Object.keys(MODES).map(k=>`<span class="chip sm ${S.fc.mode===k?'on':''}" style="${S.fc.mode===k?'background:#fff;color:#161616':'background:rgba(255,255,255,.18);color:#fff'}" onclick="S.fc.mode='${k}';render(false)">${L(MODES[k][0],MODES[k][1])}</span>`).join('')}</div>
    <div class="row gap" style="margin-top:10px"><div style="flex:1"><div class="xs" style="opacity:.85;margin-bottom:4px">${L('重量（公斤）','Weight (kg)')}</div><input class="inp" type="number" value="${S.fc.kg}" oninput="S.fc.kg=+this.value;fcCalc()"></div><div style="flex:1"><div class="xs" style="opacity:.85;margin-bottom:4px">${L('体积（立方米）','Volume (m³)')}</div><input class="inp" type="number" value="${S.fc.cbm}" oninput="S.fc.cbm=+this.value;fcCalc()"></div></div>
    <div id="fcOut" style="margin-top:12px">${fcHTML()}</div></div>
   <div class="sec-h">${L('预约物流','Book logistics')}<a onclick="bookSheet()">+ ${L('新预约','New')}</a></div>
   <div class="box" style="margin-top:0;padding:4px 16px">${bk.map(b=>`<div class="li" onclick="${S.me.role==='gm'?`bookAdmin('${b.id}')`:''}"><div class="qi">${ic(b.type==='customs'?'shield':'calendar',18)}</div><div style="flex:1;min-width:0"><div class="b sm one">${{pickup:L('上门提货','Pickup'),delivery:L('送货上门','Delivery'),customs:L('代理报关','Customs clearance')}[b.type]} · ${esc(nm(b.from))} → ${esc(nm(b.to))}</div><div class="xs muted one">${esc(b.date||'')} · ${n2(b.weight||0)} kg · ${esc(userName(b.by))}</div></div><span class="badge ${BK[b.status][2]}">${L(BK[b.status][0],BK[b.status][1])}</span></div>`).join('')||`<div class="sm muted" style="padding:12px 0">${L('还没有预约','No bookings yet')}</div>`}</div>
   <div class="sec-h">${L('承运商官网查询','Carrier tracking sites')}</div>
   <div class="box" style="margin-top:0;padding:4px 16px">${CARRIERS.filter(c=>c.url).map(c=>`<div class="li" onclick="const n=prompt('${L('输入运单号 / 柜号','Enter tracking / container no.')}');if(n)openExt('${c.url}'.replace('{no}',encodeURIComponent(n.trim())))"><div class="qi">${ic(MODES[c.mode][2],18)}</div><div style="flex:1;min-width:0"><div class="b sm">${esc(nm(c))}</div><div class="xs muted">${L(MODES[c.mode][0],MODES[c.mode][1])}</div></div>${ic('link',16)}</div>`).join('')}</div>
   <div class="sec-h">${L('进口清关资料清单','Import customs checklist')}</div>
   <div class="box" style="margin-top:0">${[[L('提单 / 空运单','Bill of lading / air waybill')],[L('商业发票','Commercial invoice')],[L('装箱单（与发票一致）','Packing list (matching invoice)')],[L('原产地证','Certificate of origin')],[L('进口申报（ICUMS 系统）','Import declaration (ICUMS)')],[L('纳税人识别号 TIN','Taxpayer ID (TIN)')],[L('货物保险单（如有）','Insurance certificate (if any)')]].map((x,i)=>`<label class="li" style="cursor:pointer"><input type="checkbox" ${LS.get('cc'+i,false)?'checked':''} onchange="LS.set('cc${i}',this.checked)" style="width:20px;height:20px;accent-color:#0B7A4B"><span class="sm b" style="flex:1">${x[0]}</span></label>`).join('')}
    <div class="xs muted" style="margin-top:8px">${L('以加纳海关最新要求为准；常用口岸：特马港、塔科拉迪港、科托卡国际机场。','Follow the latest Ghana customs rules. Main entry points: Tema Port, Takoradi Port, Kotoka International Airport.')}</div></div>
  </div>`};
function fcHTML(){const f=S.fc,x=frCost(f.mode,f.kg,f.cbm),r=frRate(f.mode);
  return `<div class="row between"><div><div class="xs" style="opacity:.85">${L('计费量','Chargeable')}${x.byVol?' · '+L('按体积','by volume'):''}</div><div class="b" data-notr>${n2(x.q)} ${frUnitName(x.unit)} × ${money(x.p)}</div></div><div style="text-align:right"><div class="xs" style="opacity:.85">${L('运费','Freight')}</div><div class="b" style="font-size:20px" data-notr>${money(x.cost)}</div></div></div><div class="xs" style="opacity:.85;margin-top:6px">${L(`时效 ${r.d1}–${r.d2} 天 · 单价在后台“系统设置 → 运费价格”修改`,`Transit ${r.d1}–${r.d2} days · prices are set in Settings → Freight rates`)}</div>`}
/* 登记物流：填了重量 / 体积就按运价自动算运费（手动改过运费后不再覆盖） */
function shCostHint(){const F=S.form;if(!F||!(+F.kg||+F.cbm))return L('填重量或体积可自动计算','enter weight or volume to calculate');const x=frCost(F.mode,F.kg,F.cbm);return `= ${n2(x.q)} ${frUnitName(x.unit)} × ${money(x.p)}`}
function shipCost(){const F=S.form;if(!(+F.kg||+F.cbm))return;const x=frCost(F.mode,F.kg,F.cbm);if(!F.costManual){F.cost=x.cost;const i=$('#shCost');if(i)i.value=x.cost}const h=$('#shCostHint');if(h)h.textContent=shCostHint()}
function fcCalc(){const o=$('#fcOut');if(o)o.innerHTML=fcHTML()}
function bookSheet(){S.bk={type:'pickup',mode:'road'};openSheet(`<div class="sh">${L('预约物流','Book logistics')}</div>
  <div class="chips wrap" style="margin-top:12px">${[['pickup',L('上门提货','Pickup')],['delivery',L('送货上门','Delivery')],['customs',L('代理报关','Customs')]].map(([k,t],i)=>`<span class="chip ${i?'':'on'}" onclick="S.bk.type='${k}';this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${t}</span>`).join('')}</div>
  <div class="row gap"><div class="fld" style="flex:1"><label>${L('起点','From')}</label><input class="inp" id="bkF" value="${esc(whName(myWh()))}"></div><div class="fld" style="flex:1"><label>${L('终点','To')}</label><input class="inp" id="bkT"></div></div>
  <div class="row gap"><div class="fld" style="flex:1"><label>${L('日期','Date')}</label><input class="inp" id="bkD" type="date" value="${fday(Date.now()+864e5)}"></div><div class="fld" style="flex:1"><label>${L('重量（公斤）','Weight (kg)')}</label><input class="inp" id="bkW" type="number"></div></div>
  <div class="fld"><label>${L('需求说明','Details')}</label><input class="inp" id="bkN" placeholder="${L('车型、装卸、联系人等','Vehicle, loading, contact…')}"></div>
  <button class="bigbtn" style="width:100%;margin-top:16px" onclick="if(!$('#bkT').value.trim())return toast(L('请填写终点','Enter destination'));DB.put('svc',{no:genNo('BK'),type:S.bk.type,mode:'road',from:$('#bkF').value,to:$('#bkT').value,date:$('#bkD').value,weight:+$('#bkW').value||0,note:$('#bkN').value,status:'new',t:Date.now()});closeSheet();toast(L('已提交预约，管理员会尽快安排','Booking sent — the admin will schedule it'));render(false)">${L('提交预约','Submit booking')}</button>`)}
function bookAdmin(id){const b=DB.get('svc',id);openSheet(`<div class="sh">${L('处理预约','Handle booking')}</div><div class="sm muted" data-notr>${esc(b.no)}</div><div class="sm" style="margin-top:8px">${esc(nm(b.from))} → ${esc(nm(b.to))} · ${esc(b.date)}<br>${esc(nm(b.note)||'')}</div>
  <div class="row gap" style="margin-top:16px">${[['confirmed',L('已安排','Scheduled')],['done',L('已完成','Done')],['cancel',L('取消','Cancel')]].map(([k,t])=>`<button class="bigbtn ${k==='cancel'?'ghost':''}" style="height:46px;font-size:14px" onclick="DB.put('svc',{...DB.get('svc','${id}'),status:'${k}'});closeSheet();render(false)">${t}</button>`).join('')}</div>`)}

/* ================= 报表（各部门只看自己范围内的数据） ================= */
S.rpR='today';S.rpK='val';
V.report=()=>{const from=S.rpR==='today'?dayStart():S.rpR==='week'?dayStart()-((new Date().getDay()+6)%7)*864e5:+new Date(new Date().getFullYear(),new Date().getMonth(),1);
  const r=S.me.role;const seeSales=['gm','sales','acct'].includes(r),seeStock=can('stock'),seeProfit=can('profit'),seeBuy=['gm','buyer','acct'].includes(r);
  const so=DB.all('so').filter(s=>s.status!=='draft'&&s.status!=='cancel'&&s.t>=from);const sales=so.reduce((a,s)=>a+docTotal(s),0);
  const mv=DB.all('moves').filter(m=>m.t>=from);const outN=new Set(mv.filter(m=>m.type==='so_out'||m.type==='po_ret').map(m=>m.ref)).size,inN=new Set(mv.filter(m=>m.type==='po_in'||m.type==='so_ret').map(m=>m.ref)).size;
  const cogs=mv.filter(m=>m.type==='so_out').reduce((a,m)=>a+(-m.qty)*(P_(m.pid).cost||0),0)-mv.filter(m=>m.type==='so_ret').reduce((a,m)=>a+m.qty*(P_(m.pid).cost||0),0);
  const freight=DB.all('ships').filter(s=>s.t>=from).reduce((a,s)=>a+(+s.cost||0),0);
  const buys=DB.all('po').filter(p=>p.status!=='draft'&&p.status!=='cancel'&&p.t>=from).reduce((a,p)=>a+docTotal(p),0);
  const days=[...Array(7)].map((_,i)=>{const d0=dayStart()-(6-i)*864e5;const v=DB.all('so').filter(s=>s.status!=='draft'&&s.status!=='cancel'&&s.t>=d0&&s.t<d0+864e5).reduce((a,s)=>a+docTotal(s),0);return {d0,v}});
  const mx=Math.max(1,...days.map(d=>d.v));
  const rank=DB.all('products').map(p=>{const q=qtyOf(p.id);return {p,q,v:q*(can('cost')?p.cost:p.price)}}).sort((a,b)=>S.rpK==='val'?b.v-a.v:b.q-a.q).slice(0,20);const rmx=Math.max(1,...rank.map(x=>S.rpK==='val'?x.v:x.q));
  const last=DB.all('moves').sort((a,b)=>b.t-a.t).slice(0,10);
  return hdr(L('简易报表','Reports'),`<button class="icbtn" onclick="exportSheet()">${ic('download')}</button>`)+`<div class="pad">
   <div class="seg">${[['today',L('今日','Today')],['week',L('本周','This week')],['month',L('本月','This month')]].map(([k,t])=>`<button class="${S.rpR===k?'on':''}" onclick="S.rpR='${k}';render(false)">${t}</button>`).join('')}</div>
   <div class="stats">${seeSales?statT('g',numK(sales),L('销售额','Sales'),'',1):seeBuy?statT('g',numK(buys),L('采购额','Purchases'),'',1):''}${statT('',outN,L('出库笔数','Outbound'))}${statT('',inN,L('入库笔数','Inbound'))}</div>
   ${seeProfit?`<div class="box"><h4>${L('利润（估算）','Profit (estimate)')}<span class="sm muted" data-notr>${esc(CUR())}</span></h4><div class="kv">
     <div><div class="l">${L('销售收入','Revenue')}</div><div class="v" data-notr>${money(sales)}</div></div><div><div class="l">${L('销售成本','Cost of goods')}</div><div class="v" data-notr>${money(cogs)}</div></div>
     <div><div class="l">${L('毛利','Gross profit')}</div><div class="v ${sales-cogs<0?'red':'green'}" data-notr>${money(sales-cogs)}</div></div><div><div class="l">${L('毛利率','Margin')}</div><div class="v" data-notr>${sales?((sales-cogs)/sales*100).toFixed(1):'0.0'}%</div></div>
     <div><div class="l">${L('物流运费','Freight')}</div><div class="v" data-notr>${money(freight)}</div></div><div><div class="l">${L('扣运费后','After freight')}</div><div class="v" data-notr>${money(sales-cogs-freight)}</div></div></div>
     </div>`:''}
   ${seeSales?`<div class="box"><h4>${L('近 7 天销售额','Sales, last 7 days')}<span class="sm muted" data-notr>${moneyK(days.reduce((a,d)=>a+d.v,0))}</span></h4><div class="bars">${days.map((d,i)=>`<div class="bc"><span class="bv" data-notr>${d.v?numK(d.v):''}</span><div class="bar ${i===6?'on':''}" style="height:${Math.max(3,d.v/mx*88)}%"></div><span class="bl">${i===6?L('今天','Today'):(new Date(d.d0).getMonth()+1)+'/'+new Date(d.d0).getDate()}</span></div>`).join('')}</div></div>`:''}
   ${seeStock?`<div class="box"><h4>${L('商品库存排行 前 20','Top 20 by stock')}<span class="seg" style="margin:0;padding:3px;background:var(--soft)">${[['val',L('金额','Value')],['qty',L('数量','Qty')]].map(([k,t])=>`<button style="padding:5px 10px;font-size:12px" class="${S.rpK===k?'on':''}" onclick="S.rpK='${k}';render(false)">${t}</button>`).join('')}</span></h4>
    ${rank.map((x,i)=>`<div class="rank" onclick="go('product',{id:'${x.p.id}'})" style="cursor:pointer"><span class="no ${i<3?'t':''}">${i+1}</span><div style="flex:1;min-width:0"><div class="row between"><span class="sm b one">${esc(nm(x.p.n))}</span><span class="sm b" data-notr>${S.rpK==='val'?moneyK(x.v):n2(x.q)}</span></div><div class="meter"><i style="width:${(S.rpK==='val'?x.v:x.q)/rmx*100}%"></i></div></div></div>`).join('')}</div>
   <div class="box"><h4>${L('最近 10 条出入库流水','Last 10 movements')}</h4>${last.map(mvRow).join('')}</div>`:''}</div>`};
function exportSheet(){const r=S.me.role;const opts=[];
  if(can('stock'))opts.push(['stock',L('库存表（各门店、状态）','Stock list (by store, status)')],['moves',L('出入库流水','Stock movements')]);
  if(['gm','sales','acct'].includes(r))opts.push(['so',L('销售单汇总','Sales orders')]);if(['gm','buyer','acct'].includes(r))opts.push(['po',L('采购单汇总','Purchase orders')]);
  if(can('fin'))opts.push(['fin',L('资金日记账','Cash book')],['ar',L('应收账款','Receivables')],['ap',L('应付账款','Payables')]);if(can('logi'))opts.push(['ships',L('物流记录','Shipments')]);
  openSheet(`<div class="sh">${L('导出 Excel 报表','Export Excel report')}</div><div class="sm muted">${L('带边框和表头，可直接打印；金额按当前显示货币','Bordered with headers, print-ready; amounts in the currency shown')} (<span data-notr>${dispIso()}</span>)</div>
   <div style="margin-top:10px">${opts.map(([k,t])=>`<div class="li" onclick="exportReport('${k}')"><div class="qi">${ic('download',18)}</div><div class="b sm" style="flex:1">${t}</div>${ic('chev',16)}</div>`).join('')}</div>`)}
function exportReport(k){closeSheet();const ws=activeWh();const cv=v=>+conv(v).toFixed(2);
  if(k==='fin')return exportFin();
  if(k==='stock'){const rows=DB.all('products').map(p=>{const q=qtyOf(p.id);const s=stStatus(p,q);return [p.code,p.bar,nm(p.n),unit(p),...ws.map(w=>qtyOf(p.id,w.id)),q,L(ST_NAME[s][0],ST_NAME[s][1]),cv(p.price)].concat(can('cost')?[cv(p.cost),cv(q*p.cost)]:[])});
    const head=[L('编码','Code'),L('条码','Barcode'),L('商品','Item'),L('单位','Unit'),...ws.map(w=>nm(w.n)),L('合计','Total'),L('状态','Status'),L('售价','Price')].concat(can('cost')?[L('成本价','Cost'),L('库存成本','Stock value')]:[]);
    const mi=[head.length-(can('cost')?3:1)].concat(can('cost')?[head.length-2,head.length-1]:[]);
    return exportXlsx(L('库存表','Stock'),[{name:L('库存表','Stock'),title:L('库存表','Stock list'),head,rows,money:mi,total:can('cost')?head.map((h,i)=>i===0?L('合计','Total'):i===head.length-1?+rows.reduce((a,r)=>a+r[i],0).toFixed(2):null):null}])}
  if(k==='moves')return exportXlsx(L('出入库流水','Movements'),[{name:L('流水','Movements'),title:L('出入库流水','Stock movements'),head:[L('时间','Time'),L('类型','Type'),L('商品','Item'),L('门店','Store'),L('数量','Qty'),L('批次','Batch'),L('效期','Expiry'),L('经手人','By')],
    rows:DB.all('moves').sort((a,b)=>b.t-a.t).map(m=>[fday(m.t)+' '+new Date(m.t).toTimeString().slice(0,5),mvName(m.type),pName(m.pid),whName(m.wh),m.qty,m.batch||'',m.exp||'',userName(m.by)])}]);
  if(k==='so'){const l=DB.all('so').sort((a,b)=>b.t-a.t);return exportXlsx(L('销售单','Sales'),[{name:L('销售单','Sales'),title:L('销售单汇总','Sales orders'),money:[5],head:[L('单号','No.'),L('日期','Date'),L('客户','Customer'),L('门店','Store'),L('状态','Status'),L('金额','Total')],
    rows:l.map(s=>[s.no,fday(s.t),ptName(s.cus),whName(s.wh),L(SO_ST[s.status][0],SO_ST[s.status][1]),cv(docTotal(s))]),total:[L('合计','Total'),'','','','',+l.filter(s=>s.status!=='draft'&&s.status!=='cancel').reduce((a,s)=>a+cv(docTotal(s)),0).toFixed(2)]}])}
  if(k==='po'){const l=DB.all('po').sort((a,b)=>b.t-a.t);return exportXlsx(L('采购单','Purchases'),[{name:L('采购单','Purchases'),title:L('采购单汇总','Purchase orders'),money:[5],head:[L('单号','No.'),L('日期','Date'),L('供应商','Supplier'),L('门店','Store'),L('状态','Status'),L('金额','Total')],
    rows:l.map(p=>[p.no,fday(p.t),ptName(p.sup),whName(p.wh),L(PO_ST[p.status][0],PO_ST[p.status][1]),cv(docTotal(p))]),total:[L('合计','Total'),'','','','',+l.filter(p=>p.status!=='draft'&&p.status!=='cancel').reduce((a,p)=>a+cv(docTotal(p)),0).toFixed(2)]}])}
  if(k==='ar'){const l=arDocs().map(s=>({s,x:arOf(s)}));return exportXlsx(L('应收账款','Receivables'),[{name:L('应收','Receivables'),title:L('应收账款','Receivables'),money:[4,5,6],head:[L('单号','No.'),L('日期','Date'),L('客户','Customer'),L('状态','Status'),L('应收','Due'),L('已收','Received'),L('余额','Balance')],
    rows:l.map(({s,x})=>[s.no,fday(s.t),ptName(s.cus),L(SO_ST[s.status][0],SO_ST[s.status][1]),cv(x.tot),cv(x.got),cv(x.bal)]),total:[L('合计','Total'),'','','',+l.reduce((a,o)=>a+cv(o.x.tot),0).toFixed(2),+l.reduce((a,o)=>a+cv(o.x.got),0).toFixed(2),+l.reduce((a,o)=>a+cv(o.x.bal),0).toFixed(2)]}])}
  if(k==='ap'){const l=apDocs().map(p=>({p,x:apOf(p)}));return exportXlsx(L('应付账款','Payables'),[{name:L('应付','Payables'),title:L('应付账款','Payables'),money:[4,5,6,7],head:[L('单号','No.'),L('日期','Date'),L('供应商','Supplier'),L('状态','Status'),L('应付','Due'),L('已付','Paid'),L('已审批待付','Approved'),L('余额','Balance')],
    rows:l.map(({p,x})=>[p.no,fday(p.t),ptName(p.sup),L(PO_ST[p.status][0],PO_ST[p.status][1]),cv(x.tot),cv(x.paid),cv(x.appr),cv(x.bal)]),total:[L('合计','Total'),'','','',+l.reduce((a,o)=>a+cv(o.x.tot),0).toFixed(2),+l.reduce((a,o)=>a+cv(o.x.paid),0).toFixed(2),+l.reduce((a,o)=>a+cv(o.x.appr),0).toFixed(2),+l.reduce((a,o)=>a+cv(o.x.bal),0).toFixed(2)]}])}
  if(k==='ships')return exportXlsx(L('物流记录','Shipments'),[{name:L('物流','Shipments'),title:L('物流记录','Shipments'),money:[8],head:[L('单号','No.'),L('方向','Direction'),L('承运商','Carrier'),L('运单号','Tracking'),L('起运地','From'),L('目的地','To'),L('状态','Status'),L('预计到达','ETA'),L('运费','Cost')],
    rows:DB.all('ships').map(s=>[s.no,s.dir==='in'?L('到货','In'):L('发货','Out'),nm(carrier(s.carrier)),s.trackNo,nm(s.from),nm(s.to),L(SH_ST[s.status][0],SH_ST[s.status][1]),s.eta,cv(s.cost||0)])}])}

/* ================= 消息 ================= */
V.msgs=()=>{const a=Alerts.list();return hdr(L('消息','Messages'),a.some(n=>!n.read)?`<button class="pill w" onclick="markRead();render(false)">${L('全部已读','Read all')}</button>`:'')+`<div class="pad">
  <div class="xs muted" style="margin:4px 2px 10px">${L('新订单、库存不足、待出库、物流动态会在这里提醒，可在“我的 → 消息提醒”中开关。','New orders, low stock, shipping tasks and logistics updates appear here. Turn them on or off in Me → Notifications.')}</div>
  <div class="box" style="margin-top:0;padding:4px 16px">${a.map(n=>`<div class="li" onclick="markRead('${n.id}');${n.go?`go('${n.go[0]}',${JSON.stringify(n.go[1]).replace(/"/g,"'")})`:'render(false)'}"><div class="qi" style="background:${n.c};color:#fff">${ic(n.ic||'bell',18)}</div><div style="flex:1;min-width:0"><div class="sm ${n.read?'':'b'}">${esc(L(n.zh,n.en))}</div><div class="xs muted">${ago(n.t)}</div></div>${n.read?'':'<span style="width:8px;height:8px;border-radius:50%;background:var(--red);flex:none"></span>'}</div>`).join('')||emptyBox('bell',L('暂无消息','No messages'))}</div></div>`};

/* ================= 我的 / 设置 ================= */
const meRow=(icon,t,sub,fn,right)=>`<div class="li" onclick="${fn||''}"><div class="qi">${ic(icon,18)}</div><div style="flex:1;min-width:0"><div class="b sm">${t}</div>${sub?`<div class="xs muted one">${sub}</div>`:''}</div>${right==null?ic('chev',16):right}</div>`;
V.me=()=>{const me=S.me;const pf=Alerts.prefs();const row=meRow;const P=plan();
  const tg=k=>sw(pf[k],`const p=Alerts.prefs();p.${k}=!p.${k};LS.set('prefs_'+S.me.id,p);render(false)`);const sess=LS.get(SK,{});
  return `<div class="pad" style="padding-top:16px"><div class="row between"><div class="ptitle">${L('我的','Me')}</div><div class="row" style="gap:6px">${ctryBtn()}${langBtn()}</div></div>
   <div class="box" style="display:flex;gap:14px;align-items:center"><div class="av lg">${esc(nmP(me.name).slice(0,1))}</div><div style="min-width:0;flex:1"><div class="b" style="font-size:20px">${esc(nmP(me.name))}</div><div class="row gap6" style="margin-top:4px"><span class="badge ${ROLES[me.role].c}">${userTitle(me)}</span></div><div class="xs muted" style="margin-top:4px">${L('默认门店','Default store')}: ${esc(whName(me.wh))}</div></div></div>
   ${!can('mgmt')&&can('_pt')?`<div class="box" style="padding:4px 16px">${row('user',can('po')?L('供应商','Suppliers'):L('客户','Customers'),L('新增、修改、删除','Add, edit, delete'),"go('m_partners')")}</div>`:''}${can('mgmt')?`<div class="sec-h">${L('后台管理','Management')}</div><div class="box" style="margin-top:0;padding:4px 16px">
    ${row('users',L('账号与密码','Accounts & passwords'),L('各部门密码、新增账号、停用登录','Department passwords, new accounts, disable sign-in'),"go('m_users')")}
    ${row('wh',L('门店与 VIP','Stores & VIP'),(P.vip?L(`VIP · ${P.limit} 个门店名额`,`VIP · ${P.limit} store slots`):L('1 个门店（新增门店需开通码）','1 store (new stores need an activation code)'))+L(` · 已用 ${Math.min(allWh().length,P.limit)}`,` · ${Math.min(allWh().length,P.limit)} in use`),"go('m_stores')")}
    ${row('gear',L('更多后台功能','More management'),L('商品资料、往来单位、系统设置、备份、日志','Products, partners, settings, backup, log'),"go('mgmt')")}</div>`:''}
   <div class="sec-h">${L('账号','Account')}</div><div class="box" style="margin-top:0;padding:4px 16px">
    ${row('user',L('个人资料','Profile'),esc(nmP(me.name)),'profileSheet()')}${row('lock',L('修改我的密码','Change my password'),L('密码全公司唯一，用来识别你的账号','Passwords are unique and identify your account'),'pwdSheet()')}${row('wh',L('默认门店','Default store'),esc(whName(me.wh)),'whSheet()')}
    ${row('shield',L('自动登录（信任此设备）','Stay signed in on this device'),L('关闭后每次打开都需输入密码','Off: password needed every time'),'',sw(!!sess.trust,"const s=LS.get(SK,{});s.trust=!s.trust;LS.set(SK,s);render(false)"))}</div>
   <div class="sec-h">${L('国家 · 语言 · 货币','Country · language · currency')}</div><div class="box" style="margin-top:0;padding:4px 16px">
    ${row('pin',L('国家','Country'),`<span data-notr>${flagE(S.country)} ${esc(S.lang==='zh'?C().zh:C().en)}</span> · ${L('非洲 54 国可选','54 African countries')}`,'countrySheet()')}
    ${row('globe',L('语言','Language'),`<span data-notr>${esc(LN[S.lang]||S.lang)}</span> · ${L('自动匹配手机语言','follows your phone')}`,'langSheet()')}
    ${row('calc',L('结算货币','Settlement currency'),`<span data-notr>${esc(CUR())} ${baseIso()}</span> · ${L('只用本国货币结算','local currency only')}`,'curSheet()')}</div>
   <div class="sec-h">${L('消息提醒','Notifications')}</div><div class="box" style="margin-top:0;padding:4px 16px">
    ${can('so')||can('so_ship')?row('cart',L('新订单','New orders'),'','',tg('order')):''}${can('stock')?row('alert',L('库存不足','Low stock'),'','',tg('low')):''}${can('po_recv')||can('so_ship')||can('po')?row('out',L('待出库 / 待入库任务','Shipping & receiving tasks'),'','',tg('ship')):''}${can('logi')?row('truck',L('物流动态','Logistics updates'),'','',tg('logi')):''}${can('fin')?row('calc',L('收付款提醒','Payment alerts'),'','',tg('fin')):''}
    ${row('bell',L('消息列表','Message list'),Alerts.unread()?L(`${Alerts.unread()} 条未读`,`${Alerts.unread()} unread`):'',"go('msgs')")}</div>
   ${can('report')?`<div class="sec-h">${L('报表','Reports')}</div><div class="box" style="margin-top:0;padding:4px 16px">${row('chart',L('简易报表','Reports'),'',"go('report')")}</div>`:''}
   <div class="sec-h">${L('应用','App')}</div><div class="box" style="margin-top:0;padding:4px 16px">
    ${!isNative()&&!isStandalone()&&!WEB?row('home',L('安装到手机桌面','Install on home screen'),L('像应用一样从桌面打开','Open from your home screen like an app'),'pwaInstall()'):''}
    ${!isNative()?row('download',L('下载安卓安装包','Download Android app'),L('支持应用内一键更新','APK with in-app updates'),'doApk()'):''}
    ${row('refresh',L('检查更新','Check for updates'),`<span data-notr>v${APP_VER} · build ${APP_BUILD}</span>`,'checkUpdate(true)',hasUpd()?'<span style="width:9px;height:9px;border-radius:50%;background:var(--red)"></span>':null)}
    ${row('info',L('关于','About'),L('与华宝招聘同一套架构','Built on the ChinaPaw stack'),'aboutSheet()')}</div>
   <button class="bigbtn ghost" style="width:100%;margin-top:18px;color:var(--red)" onclick="doLogout()">${ic('logout',18)} ${L('退出登录','Sign out')}</button>
   <div class="xs muted" style="text-align:center;margin-top:14px" data-notr>v${APP_VER} · build ${APP_BUILD}</div></div>`};
function langSheet(){const ls=langsOf(S.country);openSheet(`<div class="sh">${L('语言','Language')}</div><div class="xs muted">${L('英语、中文和所在国家的官方语言','English, Chinese and the official languages of your country')}</div><div style="margin-top:8px">${ls.map(l=>`<div class="li" onclick="closeSheet();setLang('${l}')"><b data-notr style="flex:1">${esc(LN[l]||l)}</b>${S.lang===l?ic('check'):''}</div>`).join('')}</div>`)}
function profileSheet(){openSheet(`<div class="sh">${L('个人资料','Profile')}</div><div class="fld"><label>${L('姓名','Name')}</label><input class="inp" id="pfN" value="${esc(nmP(S.me.name))}"></div><div class="fld"><label>${L('账号代码','Account code')}</label><input class="inp" value="${esc(S.me.code||'')}" disabled data-notr></div>
  <div class="xs muted" style="margin-top:8px">${L('部门和账号代码由总经理在后台管理','Department and account code are managed by the general manager')}</div><button class="bigbtn" style="width:100%;margin-top:16px" onclick="saveProfile({name:$('#pfN').value.trim()})">${L('保存','Save')}</button>`)}
function saveProfile(ch){if(ch.name==='')return toast(L('请填写姓名','Enter your name'));Object.assign(S.me,ch);const s=LS.get(SK,{});s.me=S.me;LS.set(SK,s);
  if(DB.cloud)rpc('jxc_update_me',{p_token:S.token,p_name:nmP(S.me.name),p_wh:S.me.wh}).catch(e=>toast(e.message));else{const u=DB.get('users',S.me.id);if(u)DB.put('users',{...u,...ch})}
  closeSheet();toast(L('已保存','Saved'),false);render(false)}
function whSheet(){openSheet(`<div class="sh">${L('默认门店','Default store')}</div><div style="margin-top:8px">${activeWh().map(w=>`<div class="li" onclick="saveProfile({wh:'${w.id}'})"><div class="qi">${ic('wh',18)}</div><div class="b sm" style="flex:1">${esc(nm(w.n))}</div>${w.id===S.me.wh?ic('check'):''}</div>`).join('')}</div>`)}
function pwdSheet(){openSheet(`<div class="sh">${L('修改我的密码','Change my password')}</div><div class="fld"><label>${L('原密码','Current password')}</label><input class="inp" id="pw0" type="password"></div><div class="fld"><label>${L('新密码（至少 6 位，不能与其他账号相同）','New password (min 6, not used by any other account)')}</label><input class="inp" id="pw1" type="password"></div><div class="fld"><label>${L('再输一次','Repeat new password')}</label><input class="inp" id="pw2" type="password"></div>
  <div id="pwE" class="sm red" style="margin-top:8px"></div><button class="bigbtn" style="width:100%;margin-top:12px" onclick="doPw()">${L('确认修改','Change')}</button>`)}
async function doPw(){const a=$('#pw0').value,b=$('#pw1').value,c=$('#pw2').value,e=$('#pwE');if(b.length<6)return e.textContent=L('新密码至少 6 位','At least 6 characters');if(b!==c)return e.textContent=L('两次输入不一致','Passwords do not match');
  try{await changePw(a,b);closeSheet();toast(L('密码已修改，下次用新密码登录','Password changed — use it next time'),false)}catch(x){e.textContent=x.message}}
function aboutSheet(){openSheet(`<div class="row gap"><img src="${LOGO}" class="logo" style="width:56px;height:56px;border-radius:16px"><div><div class="sh">${BRAND()}</div><div class="sm muted" data-notr>v${APP_VER} · build ${APP_BUILD}</div></div></div>

`)}

/* ================= 后台管理（总经理） ================= */
V.mgmt=()=>hdr(L('后台管理','Management'))+`<div class="pad"><div class="box" style="margin-top:6px;padding:4px 16px">
  ${meRow('users',L('账号与密码','Accounts & passwords'),L('各部门密码、新增账号、停用登录','Department passwords, new accounts, disable sign-in'),"go('m_users')")}
  ${meRow('wh',L('门店与 VIP','Stores & VIP'),L('免费版 1 个门店，VIP 可关联 3 个或更多','Free: 1 store · VIP: 3 or more'),"go('m_stores')")}
  ${meRow('box',L('商品资料','Products'),L('新增、修改、图片、批量导入','Add, edit, photos, bulk import'),"go('m_products')")}
  ${meRow('user',L('往来单位','Customers & suppliers'),'',"go('m_partners')")}
  ${meRow('gear',L('系统设置','Settings'),L('公司名称、记账货币、运费参数','Company, ledger currency, freight rates'),"go('m_settings')")}
  ${meRow('download',L('数据备份','Backup'),L('下载 / 上传恢复','Download / restore'),"go('m_backup')")}
  ${meRow('doc',L('操作日志','Activity log'),'',"go('m_log')")}</div></div>`;
V.m_users=()=>{const us=DB.all('users');const ps=positions().filter(p=>!p.del);
  return hdr(L('账号与密码','Accounts & passwords'),`<button class="icbtn" onclick="acctSheet()">${ic('plus')}</button>`)+`<div class="pad">
   <div class="note-g" style="margin-top:4px">${L('账号按部门管理：总经办、采购部、销售部、仓储部、财务部。新增账号时先选部门、再选职位，账号代码自动生成，初始密码就是账号代码。每个部门都可以新增职位。','Accounts are organised by department. When adding an account choose the department, then the position; the code is generated and is also the starting password. Each department can add its own positions.')}</div>
   ${DEPTS.map(d=>{const l=us.filter(u=>d.roles.includes(u.role)).sort((a,b)=>String(a.code).localeCompare(String(b.code)));const dp=ps.filter(p=>p.dept===d.id);
    return `<div class="sec-h" style="margin-top:18px"><span class="row gap6"><span class="badge ${ROLES[d.roles[0]].c}">${deptName(d)}</span><span class="xs muted">${l.length} ${L('人','')}</span></span><a onclick="acctSheet(null,'${d.id}')">+ ${L('新增账号','Add account')}</a></div>
    <div class="chips wrap" style="margin:0 0 8px">${d.roles.map(r=>`<span class="chip" style="cursor:default;font-size:12px;padding:5px 10px">${roleName(r)}</span>`).join('')}${dp.map(p=>`<span class="chip" style="font-size:12px;padding:5px 10px" onclick="S.eu=null;posSheet('${d.id}','${p.id}')">${esc(nm(p.n))} ${ic('edit',12)}</span>`).join('')}${d.roles.includes('gm')&&S.me.role!=='gm'?'':`<span class="chip" style="font-size:12px;padding:5px 10px;border:1.5px dashed var(--muted);background:transparent" onclick="S.eu=null;posSheet('${d.id}')">+ ${L('新增职位','New position')}</span>`}</div>
    <div class="box" style="margin-top:0;padding:4px 16px">${l.map(u=>`<div class="li" onclick="acctSheet('${u.id}')"><div class="av" style="width:36px;height:36px;font-size:14px;${u.active===false?'background:#D6D3CC':''}">${esc(nmP(u.name).slice(0,1))}</div><div style="flex:1;min-width:0"><div class="b sm one">${esc(nmP(u.name))} <span class="xs muted" style="font-weight:600">${esc(userTitle(u))}</span>${u.admin&&u.role!=='gm'?` <span class="badge b-dark" style="padding:1px 7px">${L('后台','Backend')}</span>`:''}</div><div class="xs muted"><span data-notr>${esc(u.code)}</span> · ${esc(whName(u.wh))}${u.active===false?` · <b class="red">${L('已停用登录','Sign-in disabled')}</b>`:''}</div></div><button class="pill w" style="box-shadow:0 1px 3px rgba(0,0,0,.08)" onclick="event.stopPropagation();acctSheet('${u.id}')">${ic('edit',14)} ${L('重新编辑','Edit')}</button></div>`).join('')||`<div class="sm muted" style="padding:10px 0">${L('暂无账号','No accounts')}</div>`}</div>`}).join('')}</div>`};
/* 新增 / 重新编辑账号：先选部门，再选职位（基本职位或本部门新增的职位），账号代码自动生成 */
function acctSheet(id,dept){const u=id?{...DB.get('users',id)}:{code:'',name:'',wh:activeWh()[0].id,active:true,role:'',pos:null};
  if(S.me.role!=='gm'&&u.role==='gm')return toast(L('总经理账号只能由总经理修改','Only the general manager can edit GM accounts'));
  S.eu=u;S.euDept=id?deptOf(u.role).id:(dept||'');S.euCodeTouched=false;S.euSelf=id===S.me.id;acctDraw()}
function acctPick(role,pos){if(S.euSelf)return;S.eu.role=role;S.eu.pos=pos||null;if(!S.eu.id&&!S.euCodeTouched)S.eu.code=nextCode(role);acctDraw()}
function acctDraw(){const u=S.eu,id=u.id,self=S.euSelf;const depts=DEPTS.filter(d=>S.me.role==='gm'||!d.roles.includes('gm'));const d=DEPTS.find(x=>x.id===S.euDept);
  const chip=(on,txt,fn,extra='')=>`<span class="chip ${on?'on':''}" ${self?'style="opacity:.5;pointer-events:none"':`onclick="${fn}"`}${extra}>${txt}</span>`;
  const pos=d?[...d.roles.map(r=>({role:r,pos:null,n:roleName(r)})),...positions().filter(p=>!p.del&&p.dept===d.id&&d.roles.includes(p.role)).map(p=>({role:p.role,pos:p.id,n:nm(p.n)}))]:[];
  openSheet(`<div class="sh">${id?L('重新编辑','Edit account'):L('新增岗位账号','New post account')}</div>
   <div class="fld"><label>${L('① 部门','① Department')}${self?` <span class="xs muted">${L('（不能修改自己的部门和职位）','(you cannot change your own)')}</span>`:''}</label><div class="chips wrap">${depts.map(x=>chip(S.euDept===x.id,deptName(x),`S.euDept='${x.id}';acctDraw()`)).join('')}</div></div>
   ${d?`<div class="fld"><label>${L('② 职位','② Position')}</label><div class="chips wrap" id="euRoles">${pos.map(p=>chip(u.role===p.role&&(u.pos||null)===p.pos,esc(p.n),`acctPick('${p.role}',${p.pos?`'${p.pos}'`:'null'})`,` data-r="${p.role}"`)).join('')}${self?'':`<span class="chip" style="border:1.5px dashed var(--muted);background:transparent" onclick="posSheet('${d.id}')">+ ${L('新增职位','New position')}</span>`}</div></div>`:''}
   <div class="fld"><label>${L('账号代码（自动生成，可修改）','Account code (automatic, can be changed)')}</label><input class="inp" style="background:var(--card);letter-spacing:2px" value="${esc(u.code)}" data-notr ${id?'disabled':''} oninput="S.eu.code=this.value.trim();S.euCodeTouched=true" placeholder="${L('先选部门和职位','Choose a department and position first')}"></div>
   <div class="fld"><label>${L('姓名','Name')}</label><input class="inp" style="background:var(--card)" value="${esc(nmP(u.name))}" oninput="S.eu.name=this.value"></div>
   <div class="fld"><label>${L('门店','Store')}</label><select class="inp" style="background:var(--card)" onchange="S.eu.wh=this.value">${activeWh().map(w=>`<option value="${w.id}" ${w.id===u.wh?'selected':''}>${esc(nm(w.n))}</option>`).join('')}</select></div>
   <div class="fld"><label>${id?L('重设密码（留空不改）','Reset password (leave empty to keep)'):L('初始密码（留空 = 账号代码）','Starting password (empty = account code)')}</label><input class="inp" style="background:var(--card)" id="euPw" type="text" autocomplete="new-password"></div>
   ${self?'':`<div class="row between" style="margin-top:14px"><span class="sm b">${L('允许登录','Allow sign-in')}</span>${sw(u.active!==false,"S.eu.active=!(S.eu.active!==false);this.classList.toggle('on')")}</div>`}
   ${S.me.role==='gm'&&!self?`<div class="row between" style="margin-top:14px"><div><div class="sm b">${L('授权使用后台','Allow backend access')}</div><div class="xs muted">${L('可管理账号密码、门店、商品资料等（不能授权他人、不能改总经理账号）','Can manage accounts, stores, products… (cannot grant access or edit GM accounts)')}</div></div>${sw(!!u.admin,"S.eu.admin=!S.eu.admin;this.classList.toggle('on')")}</div>`:''}
   <div class="sm red" id="euE" style="margin-top:8px"></div><button class="bigbtn" style="width:100%;margin-top:12px" onclick="acctSave()">${L('保存','Save')}</button>`)}
/* 在部门里新增职位：起个名字，选择权限参照本部门的哪个基本职位 */
function posSheet(dept,pid){const d=DEPTS.find(x=>x.id===dept);const p=pid?JSON.parse(JSON.stringify(posById(pid))):{id:'P'+Date.now().toString(36),dept,role:d.roles[0],n:{zh:'',en:''}};S.ep2=p;const back=!!S.eu;
  openSheet(`<div class="sh">${pid?L('修改职位','Edit position'):L('新增职位','New position')} · ${deptName(d)}</div>
   <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('职位名称（中文）','Name (Chinese)')}</label><input class="inp" style="background:var(--card)" value="${esc(p.n.zh)}" placeholder="${L('如：采购员','e.g. Buyer')}" oninput="S.ep2.n.zh=this.value"></div><div class="fld" style="flex:1;min-width:0"><label>${L('英文名称','Name (English)')}</label><input class="inp" style="background:var(--card)" value="${esc(p.n.en)}" oninput="S.ep2.n.en=this.value"></div></div>
   ${d.roles.length>1?`<div class="fld"><label>${L('权限与哪个职位相同','Same permissions as')}</label><div class="chips wrap" id="ep2R">${d.roles.map(r=>`<span class="chip ${p.role===r?'on':''}" onclick="S.ep2.role='${r}';$$('#ep2R .chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${roleName(r)}</span>`).join('')}</div></div>`:`<div class="xs muted" style="margin-top:10px">${L('权限与“','Same permissions as “')}${roleName(d.roles[0])}${L('”相同','”')}</div>`}
   <div class="sm red" id="ep2E" style="margin-top:8px"></div>
   <button class="bigbtn" style="width:100%;margin-top:12px" onclick="posSave(${back})">${L('保存职位','Save position')}</button>
   ${pid?`<button class="bigbtn dark" style="width:100%;margin-top:10px" onclick="posDel('${pid}')">${ic('trash',18)} ${L('删除职位','Delete position')}</button>`:''}`)}
function posSave(back){const p=S.ep2;if(!p.n.zh.trim()&&!p.n.en.trim())return $('#ep2E').textContent=L('请填写职位名称','Enter a name');p.n.zh=p.n.zh.trim()||p.n.en.trim();p.n.en=p.n.en.trim()||p.n.zh;
  if(DEPTS.find(x=>x.id===p.dept).roles.includes('gm')&&S.me.role!=='gm')return $('#ep2E').textContent=L('总经办的职位只能由总经理设置','Only the GM can set positions in the GM office');
  const s=DB.get('settings','app')||{id:'app'};const l=(s.positions||[]).filter(x=>x.id!==p.id);l.push(p);DB.put('settings',{...s,positions:l});toast(L('职位已保存','Position saved'),false);
  if(back&&S.eu&&!S.euSelf){S.euDept=p.dept;acctPick(p.role,p.id)}else{closeSheet(true);render(false)}}
function posDel(pid){const n=DB.all('users').filter(u=>u.pos===pid).length;if(n)return toast(L(`还有 ${n} 个账号使用这个职位，请先改成其他职位`,`${n} account(s) still use this position — change them first`));
  const s=DB.get('settings','app')||{id:'app'};DB.put('settings',{...s,positions:(s.positions||[]).filter(x=>x.id!==pid)});closeSheet(true);toast(L('已删除','Deleted'),false);render(false)}
async function acctSave(){const u=S.eu,e=$('#euE');if(!nmP(u.name))return e.textContent=L('请填写姓名','Enter a name');if(!u.role)return e.textContent=L('请选择部门和职位','Choose a department and position');if(!u.id&&!roleOfCode(u.code))return e.textContent=L('账号代码格式：6 位数字，或“6 位数字-序号”，如 444444-1','Code: 6 digits, or 6 digits-number such as 444444-1');
  try{await saveAccount(u,$('#euPw').value.trim());closeSheet();toast(L('已保存','Saved'),false);render(false)}catch(x){e.textContent=x.message}}
V.m_stores=()=>{const P=plan(),all=allWh(),act=activeWh();const free=P.limit-Math.min(all.length,P.limit);
  return hdr(L('门店与 VIP','Stores & VIP'))+`<div class="pad">
   <div class="box" style="margin-top:6px;background:${P.vip?'var(--gold)':'var(--card)'}"><div class="row between"><div><div class="b" style="font-size:20px">${P.vip?L('VIP 会员','VIP member'):L('基础版','Basic')}</div>
     <div class="sm">${L(`门店名额 ${P.limit} 个 · 已用 ${Math.min(all.length,P.limit)} 个`,`${P.limit} store slot(s) · ${Math.min(all.length,P.limit)} in use`)}</div></div>${ic('star',28)}</div>
    <div class="sm" style="margin-top:10px;line-height:1.7">${L('初始可关联 1 个门店。每新增 1 个门店需要 1 个开通码：付款开通 VIP 后由平台提供开通码，在“新增门店”里输入即可。','You start with 1 store. Each additional store needs 1 activation code, provided by the platform after you pay for VIP. Enter it under “Add store”.')}</div></div>
   <div class="sec-h">${L('门店','Stores')}<a onclick="storeEdit()">+ ${L('新增门店','Add store')}</a></div>
   <div class="box" style="margin-top:0;padding:4px 16px">${all.map(w=>{const on=act.some(x=>x.id===w.id);return `<div class="li" onclick="storeEdit('${w.id}')"><div class="qi" style="${on?'':'opacity:.5'}">${ic('wh',18)}</div><div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(w.n))}</div><div class="xs muted">${esc(nm(w.city))}</div></div>${on?`<span class="badge b-green">${L('使用中','In use')}</span>`:`<span class="badge b-grey">${L('需开通码','Needs code')}</span>`}</div>`}).join('')}</div>
   ${free>0?`<div class="note-g" style="margin-top:12px">${L(`还有 ${free} 个门店名额可用`,`${free} store slot(s) available`)}</div>`:''}
   <div style="text-align:center;margin-top:26px"><a class="xs muted" style="cursor:pointer;text-decoration:underline" onclick="platformSheet()">${L('平台运营方：生成开通码 / 调整名额','Platform operator: make codes / adjust slots')}</a></div></div>`};
/* 新增门店：名额用完时先输入开通码 */
function storeEdit(id){const P=plan();if(!id&&allWh().length>=P.limit)return redeemSheet();
  const w=id?JSON.parse(JSON.stringify(DB.get('wh',id))):{id:'W'+(Math.max(0,...allWh().map(x=>+String(x.id).replace(/\D/g,'')||0))+1),n:{zh:'',en:''},city:{zh:'',en:''}};if(typeof w.n!=='object')w.n={zh:w.n,en:w.n};if(typeof w.city!=='object')w.city={zh:w.city||'',en:w.city||''};S.ew=w;
  openSheet(`<div class="sh">${id?L('修改门店','Edit store'):L('新增门店','New store')}</div>
   <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('中文名称','Name (Chinese)')}</label><input class="inp" style="background:var(--card)" value="${esc(w.n.zh)}" oninput="S.ew.n.zh=this.value"></div><div class="fld" style="flex:1;min-width:0"><label>${L('英文名称','Name (English)')}</label><input class="inp" style="background:var(--card)" value="${esc(w.n.en)}" oninput="S.ew.n.en=this.value"></div></div>
   <div class="fld"><label>${L('城市','City')}</label><input class="inp" style="background:var(--card)" value="${esc(nm(w.city))}" oninput="S.ew.city={zh:this.value,en:this.value}"></div>
   <button class="bigbtn" style="width:100%;margin-top:16px" onclick="const w=S.ew;if(!w.n.zh&&!w.n.en)return toast(L('请填写名称','Enter a name'));w.n.zh=w.n.zh||w.n.en;w.n.en=w.n.en||w.n.zh;DB.put('wh',w);closeSheet();toast(L('已保存','Saved'),false);render(false)">${L('保存','Save')}</button>`)}
function redeemSheet(){openSheet(`<div class="sh">${L('新增门店需要开通码','A new store needs an activation code')}</div>
   <div class="sm" style="margin-top:8px;line-height:1.7">${L('门店名额已用完。付款开通 VIP 后，平台会给您一个开通码；每个开通码可新增 1 个门店。','All store slots are in use. After you pay for VIP the platform gives you an activation code; each code adds 1 store.')}</div>
   <div class="fld"><label>${L('开通码','Activation code')}</label><input class="inp" id="rdC" style="background:var(--card);letter-spacing:3px;text-transform:uppercase;font-weight:800" data-notr placeholder="MD········" onkeydown="if(event.key==='Enter')doRedeem()"></div>
   <div class="sm red" id="rdE" style="margin-top:8px"></div><button class="bigbtn" style="width:100%;margin-top:12px" onclick="doRedeem()">${L('开通，继续新增门店','Activate and add the store')}</button>`)}
async function doRedeem(){const e=$('#rdE');try{const p=await redeemCode($('#rdC').value);toast(L(`已开通，门店名额 ${p.limit} 个`,`Activated — ${p.limit} store slots`),false);closeSheet(true);render(false);setTimeout(()=>storeEdit(),350)}catch(x){e.textContent=x.message}}
/* 平台运营方：用平台密码生成开通码（付款后发给客户），或调整名额 */
function platformSheet(){const P=plan();S.pl={limit:P.limit};
  openSheet(`<div class="sh">${L('平台运营方','Platform operator')}</div><div class="xs muted">${L('仅软件运营方使用','For the software operator only')}</div>
   <div class="fld"><label>${L('平台密码','Platform password')}</label><input class="inp" id="plPw" type="password" style="background:var(--card)"></div>
   <div class="box" style="padding:12px 14px"><h4>${L('生成门店开通码','Make store activation codes')}</h4><div class="row gap"><span class="sm">${L('数量','How many')}</span><input class="inp" id="plN" type="number" value="1" min="1" max="50" style="width:90px;background:var(--soft)"><button class="pill g" onclick="doGen()">${L('生成','Make')}</button></div><div id="plCodes" style="margin-top:8px"></div></div>
   <div class="box" style="padding:12px 14px"><h4>${L('直接调整门店名额','Set store slots directly')}</h4><div class="row between"><span class="sm">${L('名额','Slots')}</span><div class="qty"><button onclick="S.pl.limit=Math.max(1,S.pl.limit-1);$('#plL').textContent=S.pl.limit">−</button><b id="plL" style="width:44px;text-align:center">${S.pl.limit}</b><button onclick="S.pl.limit=Math.min(99,S.pl.limit+1);$('#plL').textContent=S.pl.limit">+</button></div></div><button class="bigbtn dark" style="width:100%;margin-top:10px;height:46px;font-size:14px" onclick="planSave()">${L('保存名额','Save slots')}</button></div>
   <div class="sm red" id="plE" style="margin-top:8px"></div>`)}
async function doGen(){const e=$('#plE');e.textContent='';try{const cs=await genCodes($('#plPw').value,$('#plN').value);$('#plCodes').innerHTML=(cs||[]).map(c=>`<div class="li" style="cursor:default"><b data-notr style="flex:1;letter-spacing:2px">${esc(c)}</b><button class="pill w" onclick="copyText('${esc(c)}')">${ic('copy',14)}</button></div>`).join('')}catch(x){e.textContent=x.message}}
async function planSave(){const pw=$('#plPw').value,e=$('#plE');const p={limit:Math.max(1,S.pl.limit)};
  try{if(DB.cloud){await rpc('jxc_set_plan',{p_token:S.token,p_platform_pw:pw,p_plan:p});await Sync.run(true)}
    else{if(await pwHash('platform',pw)!==PLATFORM_HASH)throw new Error(L('平台密码不正确','Wrong platform password'));const s=DB.get('settings','app')||{id:'app'};DB.put('settings',{...s,plan:p})}
    closeSheet(true);toast(L(`门店名额已改为 ${p.limit} 个`,`Store slots set to ${p.limit}`),false);render(false)}catch(x){e.textContent=x.message}}
const PLATFORM_HASH='157178e1e887f00e4da8fddb9940426bcba316c81c26a1d2b902b1b35955fca6';/* = 演示平台密码 888888；正式使用请改为你自己的密码摘要 */
V.m_products=()=>{const q=(S.pq||'').toLowerCase();const l=DB.all('products').filter(p=>!q||[p.n.zh,p.n.en,p.code,p.bar].join(' ').toLowerCase().includes(q));
  return hdr(L('商品资料','Products'),`<button class="icbtn" onclick="prodEdit()">${ic('plus')}</button>`)+`<div class="pad"><div class="row gap" style="margin-top:4px"><button class="bigbtn ghost" style="height:44px;font-size:14px" onclick="prodImport()">${ic('upload',18)} ${L('批量导入','Bulk import')}</button><button class="bigbtn ghost" style="height:44px;font-size:14px" onclick="exportReport('stock')">${ic('download',18)} Excel</button></div>
   <div class="searchbar">${ic('search')}<input placeholder="${L('搜索','Search')}" value="${esc(S.pq||'')}" oninput="S.pq=this.value;clearTimeout(window._q);window._q=setTimeout(()=>{render(false);const i=$('#screen .searchbar input');i.focus();i.setSelectionRange(i.value.length,i.value.length)},300)"></div>
   <div style="margin-top:12px">${l.map(p=>`<div class="wc" onclick="prodEdit('${p.id}')"><div class="top"><div class="row gap">${thumb(p,42)}<div style="flex:1;min-width:0"><h3><span class="tt">${esc(nm(p.n))}</span></h3><small data-notr>${esc(p.code)} · ${esc(p.bar)}</small></div>${ic('edit',16)}</div>
    <div class="cols"><div><span class="l">${L('成本','Cost')}</span><span class="v" data-notr>${moneyBase(p.cost)}</span></div><div><span class="l">${L('售价','Price')}</span><span class="v" data-notr>${moneyBase(p.price)}</span></div><div><span class="l">${L('安全','Min')}</span><span class="v" data-notr>${p.min}</span></div></div></div></div>`).join('')}</div></div>`};
function prodEdit(id){const p=id?JSON.parse(JSON.stringify(DB.get('products',id))):{n:{zh:'',en:''},unit:{zh:'',en:''},cat:{zh:'',en:''},code:'',bar:'',cost:0,price:0,min:0,max:0,batch:false,sup:''};
  ['n','unit','cat'].forEach(k=>{if(typeof p[k]!=='object'||!p[k])p[k]={zh:p[k]||'',en:p[k]||''}});S.ep=p;
  const f=(k,t,sub,type)=>`<div class="fld" style="flex:1;margin-top:10px;min-width:0"><label>${t}</label><input class="inp" style="background:var(--card)" ${type?`type="${type}"`:''} value="${esc(sub?p[k][sub]:p[k])}" oninput="S.ep.${k}${sub?'.'+sub:''}=${type==='number'?'+this.value':'this.value'}"></div>`;
  openSheet(`<div class="sh">${id?L('修改商品','Edit product'):L('新增商品','New product')}</div>
   <div class="row gap" style="margin-top:8px"><div class="photos"><div class="ph" id="epPh" onclick="pickImage2(800,(u,t)=>{S.ep.photo=u;S.ep.thumb=t;$('#epPh').innerHTML='<img src=&quot;'+t+'&quot;>'},true)">${p.photo?`<img src="${esc(p.photo)}">`:ic('camera')}</div></div><span class="sm muted">${L('拍照或上传商品图片（自动压缩）','Take or upload a photo (auto-compressed)')}</span></div>
   <div class="row gap">${f('n',L('中文名称','Name (Chinese)'),'zh')}${f('n',L('英文名称','Name (English)'),'en')}</div>
   <div class="row gap">${f('code',L('商品编码','Item code'))}${f('bar',L('条码','Barcode'))}</div>
   <div class="row gap">${f('unit',L('单位（中）','Unit (zh)'),'zh')}${f('unit',L('单位（英）','Unit (en)'),'en')}</div>
   <div class="row gap">${f('cat',L('分类（中）','Category (zh)'),'zh')}${f('cat',L('分类（英）','Category (en)'),'en')}</div>
   <div class="row gap">${f('cost',L('成本价','Cost')+' '+baseIso(),'','number')}${f('price',L('售价','Price')+' '+baseIso(),'','number')}</div>
   <div class="row gap">${f('min',L('安全库存','Min stock'),'','number')}${f('max',L('库存上限','Max stock'),'','number')}</div>
   <label class="row gap" style="margin-top:12px"><input type="checkbox" ${p.batch?'checked':''} onchange="S.ep.batch=this.checked" style="width:20px;height:20px;accent-color:#0B7A4B"><span class="sm b">${L('按批次 / 效期管理','Track batches / expiry')}</span></label>
   <div class="row gap" style="margin-top:18px">${id?`<button class="bigbtn ghost" style="color:var(--red)" onclick="if(confirm(L('删除后历史流水保留，确定删除？','History is kept. Delete this product?'))){DB.put('products',{...DB.get('products','${id}'),del:true});closeSheet();render(false)}">${L('删除','Delete')}</button>`:''}<button class="bigbtn" onclick="prodSave()">${L('保存','Save')}</button></div>`)}
function prodSave(){const p=S.ep;if(!p.n.zh&&!p.n.en)return toast(L('请填写名称','Enter a name'));if(!p.code)return toast(L('请填写商品编码','Enter an item code'));
  if(DB.all('products').some(x=>x.id!==p.id&&(x.code===p.code||(p.bar&&x.bar===p.bar))))return toast(L('编码或条码重复','Code or barcode already used'));
  p.n.zh=p.n.zh||p.n.en;p.n.en=p.n.en||p.n.zh;p.unit.en=p.unit.en||p.unit.zh;p.cat.en=p.cat.en||p.cat.zh;DB.put('products',p);closeSheet();toast(L('已保存','Saved'),false);render(false)}
function prodImport(){openSheet(`<div class="sh">${L('批量导入商品','Bulk import products')}</div><div class="sm muted" style="margin-top:6px;line-height:1.7">${L('上传 CSV 文件，列顺序：','Upload a CSV file with columns: ')}<b data-notr>code, barcode, name_zh, name_en, unit, cost, price, min, max</b>${L('。编码相同的商品会被更新。','. Matching codes are updated.')}</div>
  <button class="bigbtn" style="width:100%;margin-top:16px" onclick="upCSV()">${ic('upload',18)} ${L('选择 CSV 文件','Choose CSV file')}</button>
  <button class="bigbtn ghost" style="width:100%;margin-top:10px" onclick="downloadFile('products_template.csv','code,barcode,name_zh,name_en,unit,cost,price,min,max\\nHX-2001,6920000000000,示例商品,Sample item,pc,10,15,20,200','text/csv')">${ic('download',18)} ${L('下载模板','Download template')}</button>`)}
function upCSV(){const i=document.createElement('input');i.type='file';i.accept='.csv,text/csv';i.onchange=async()=>{const f=i.files[0];if(!f)return;const t=(await f.text()).replace(/^﻿/,'');
  const rows=t.split(/\r?\n/).map(l=>l.split(',').map(x=>x.trim().replace(/^"|"$/g,''))).filter(r=>r[0]&&r[0]!=='code');let n=0;
  rows.forEach(r=>{const ex=DB.all('products').find(p=>p.code===r[0]);DB.put('products',{...(ex||{batch:false,cat:{zh:'',en:''}}),code:r[0],bar:r[1]||'',n:{zh:r[2]||r[3],en:r[3]||r[2]},unit:{zh:r[4]||'',en:r[4]||''},cost:+r[5]||0,price:+r[6]||0,min:+r[7]||0,max:+r[8]||0},{quiet:n<rows.length-1});n++});
  closeSheet();toast(L(`已导入 ${n} 个商品`,`${n} products imported`),false);render(false)};i.click()}
/* 往来单位：新增 / 修改 / 删除。采购主管管供应商、销售经理管客户、总经理（或被授权的人）管全部 */
const ptTypes=()=>can('mgmt')?['cus','sup']:[can('so')?'cus':'',can('po')?'sup':''].filter(Boolean);
V.m_partners=()=>{const ts=ptTypes();const t0=S.params&&S.params.t;const q=(S.ptq||'').toLowerCase();
  return hdr(L('往来单位','Customers & suppliers'),`<button class="icbtn" onclick="ptEdit(null,'${t0||ts[0]}')">${ic('plus')}</button>`)+`<div class="pad">
   <input class="inp" placeholder="${L('搜索名称 / 电话','Search name / phone')}" value="${esc(S.ptq||'')}" oninput="S.ptq=this.value;clearTimeout(S._ptt);S._ptt=setTimeout(()=>{render(false);const i=$('#screen input');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)" style="margin-top:6px">
   ${ts.filter(t=>!t0||t===t0).map(t=>{const l=DB.all('partners').filter(p=>p.type===t&&!p.del&&(!q||(nmP(p.n)+' '+(p.phone||'')).toLowerCase().includes(q)));
   return `<div class="sec-h">${t==='cus'?L('客户','Customers'):L('供应商','Suppliers')} · ${l.length}</div><div class="box" style="margin-top:0;padding:4px 16px">${l.map(p=>`<div class="li" onclick="ptEdit('${p.id}')"><div class="qi">${ic(t==='cus'?'cart':'in',18)}</div><div style="flex:1;min-width:0"><div class="b sm one">${esc(nmP(p.n))}</div><div class="xs muted one">${esc(nm(p.city))} · <span data-notr>${esc(p.phone||'')}</span></div></div><button class="icbtn" style="width:36px;height:36px;color:var(--red)" onclick="event.stopPropagation();ptDel('${p.id}')">${ic('trash',16)}</button></div>`).join('')||`<div class="sm muted" style="padding:10px 0">${L('暂无','None')}</div>`}</div>`}).join('')}</div>`};
function ptEdit(id,type){const ts=ptTypes();const p=id?JSON.parse(JSON.stringify(DB.get('partners',id))):{type:type||ts[0],n:{zh:'',en:''},phone:'',city:{zh:'',en:''}};if(typeof p.n!=='object')p.n={zh:p.n,en:p.n};if(typeof p.city!=='object')p.city={zh:p.city||'',en:p.city||''};S.ept=p;
  openSheet(`<div class="sh">${id?L('修改往来单位','Edit partner'):L('新增往来单位','New partner')}</div>${ts.length>1&&!id?`<div class="seg">${[['cus',L('客户','Customer')],['sup',L('供应商','Supplier')]].map(([k,t])=>`<button class="${p.type===k?'on':''}" onclick="S.ept.type='${k}';this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('on'));this.classList.add('on')">${t}</button>`).join('')}</div>`:`<div class="xs muted">${p.type==='cus'?L('客户','Customer'):L('供应商','Supplier')}</div>`}
   <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('中文名称','Name (Chinese)')}</label><input class="inp" style="background:var(--card)" value="${esc(p.n.zh)}" oninput="S.ept.n.zh=this.value"></div><div class="fld" style="flex:1;min-width:0"><label>${L('英文名称','Name (English)')}</label><input class="inp" style="background:var(--card)" value="${esc(p.n.en)}" oninput="S.ept.n.en=this.value"></div></div>
   <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('电话','Phone')}</label><input class="inp" style="background:var(--card)" value="${esc(p.phone)}" oninput="S.ept.phone=this.value"></div><div class="fld" style="flex:1;min-width:0"><label>${L('城市','City')}</label><input class="inp" style="background:var(--card)" value="${esc(nm(p.city))}" oninput="S.ept.city={zh:this.value,en:this.value}"></div></div>
   <button class="bigbtn" style="width:100%;margin-top:16px" onclick="const p=S.ept;if(!p.n.zh&&!p.n.en)return toast(L('请填写名称','Enter a name'));p.n.zh=p.n.zh||p.n.en;p.n.en=p.n.en||p.n.zh;DB.put('partners',p);closeSheet();render(false)">${L('保存','Save')}</button>
   ${id?`<button class="bigbtn dark" style="width:100%;margin-top:10px;background:#fff;color:var(--red);border:1.5px solid var(--red)" onclick="ptDel('${id}')">${ic('trash',18)} ${L('删除','Delete')}</button>`:''}`)}
/* 有未结清的应收 / 应付或未完成的单据时不能删除；删除后历史单据仍显示名称，新单据里不再出现 */
function ptBusy(id){const p=DB.get('partners',id);const r=[];
  if(p.type==='sup'){const ps=DB.all('po').filter(o=>o.sup===id&&o.status!=='cancel');if(ps.some(o=>['draft','ordered'].includes(o.status)))r.push(L('有未完成的采购单','open purchase orders'));if(ps.reduce((a,o)=>a+apOf(o).bal,0)>0.005)r.push(L('还有未付清的货款','unpaid balance'))}
  else{const ss=DB.all('so').filter(o=>o.cus===id&&o.status!=='cancel');if(ss.some(o=>['draft','submitted'].includes(o.status)))r.push(L('有未完成的销售单','open sales orders'));if(ss.reduce((a,o)=>a+arOf(o).bal,0)>0.005)r.push(L('还有未收清的货款','unpaid balance'))}
  return r}
function ptDel(id){const p=DB.get('partners',id);if(!p)return;if(!ptTypes().includes(p.type))return toast(L('没有权限','No permission'));const b=ptBusy(id);
  if(b.length)return openSheet(`<div class="sh">${L('暂时不能删除','Cannot delete yet')}</div><div class="sm" style="margin-top:8px;line-height:1.7"><b>${esc(nmP(p.n))}</b>：${b.join('、')}。${L('请先结清或取消后再删除。','Settle or cancel them first.')}</div><button class="bigbtn" style="width:100%;margin-top:16px" onclick="closeSheet()">${L('知道了','OK')}</button>`);
  openSheet(`<div class="sh">${L('删除往来单位？','Delete this partner?')}</div><div class="sm" style="margin-top:8px;line-height:1.7"><b>${esc(nmP(p.n))}</b><br>${L('删除后，新开单据里不再出现；以前的单据和报表仍保留它的名称。','It will no longer appear for new documents; past documents and reports keep its name.')}</div>
   <div class="row gap" style="margin-top:16px"><button class="bigbtn dark" style="flex:1" onclick="closeSheet()">${L('取消','Cancel')}</button><button class="bigbtn" style="flex:1;background:var(--red);color:#fff" onclick="DB.put('partners',{...DB.get('partners','${id}'),del:true,dt:Date.now()});closeSheet(true);toast(L('已删除','Deleted'),false);render(false)">${ic('trash',18)} ${L('删除','Delete')}</button></div>`)}
V.m_settings=()=>{const s=DB.get('settings','app')||{id:'app',co:{zh:'',en:''}};const isos=[...new Map(Object.values(AF).map(c=>[c.iso,c])).values()].sort((x,y)=>x.iso.localeCompare(y.iso));
  return hdr(L('系统设置','Settings'))+`<div class="pad"><div class="box" style="margin-top:6px"><h4>${L('公司','Company')}</h4>
   <div class="fld"><label>${L('公司名称（中）','Company (Chinese)')}</label><input class="inp" style="background:var(--soft)" id="stCz" value="${esc((s.co||{}).zh||'')}"></div><div class="fld"><label>${L('公司名称（英）','Company (English)')}</label><input class="inp" style="background:var(--soft)" id="stCe" value="${esc((s.co||{}).en||'')}"></div>
   <div class="fld"><label>${L('结算货币（只用本国货币，全部单据和报表都用它）','Settlement currency (local currency only, used everywhere)')}</label><select class="inp" style="background:var(--soft)" id="stB">${isos.map(c=>`<option value="${c.iso}" ${c.iso===baseIso()?'selected':''}>${esc(c.sym)} ${c.iso} · ${esc(S.lang==='zh'?c.zh:c.en)}</option>`).join('')}</select></div>
   <div class="xs muted" style="margin-top:6px">${L('更改结算货币不会换算已有金额，请在开始使用前设定。','Changing it does not convert existing amounts — set it before you start.')}</div>
   <button class="bigbtn" style="width:100%;margin-top:14px" onclick="DB.put('settings',{...(DB.get('settings','app')||{id:'app'}),base:$('#stB').value,co:{zh:$('#stCz').value,en:$('#stCe').value}});toast(L('已保存','Saved'),false);render(false)">${L('保存','Save')}</button></div>
   <div class="box"><h4>${L('运费价格','Freight rates')}<span class="xs muted">${L('单价单位：','Prices in ')}<span data-notr>${esc(CUR())} ${baseIso()}</span></span></h4>
    ${Object.keys(MODES).map(k=>{const r=frRate(k);return `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">
     <div class="row gap" style="align-items:center"><b style="width:40px;flex:none" class="sm">${L(MODES[k][0],MODES[k][1])}</b>
      <input class="inp" style="flex:1;min-width:0;padding:8px 10px;background:var(--soft)" type="number" inputmode="decimal" min="0" value="${r.p}" aria-label="${L('单价','Unit price')}" onchange="setRate('${k}',0,this.value)">
      <select class="inp" style="width:108px;flex:none;padding:8px 6px;background:var(--soft)" onchange="setRate('${k}',3,this.value)">${Object.keys(FR_UNIT).map(u=>`<option value="${u}" ${r.unit===u?'selected':''}>${L('每','per ')}${frUnitName(u)}</option>`).join('')}</select></div>
     <div class="row gap xs muted" style="margin:6px 0 0 48px;align-items:center">${L('时效','Transit')}<input class="inp" style="width:56px;padding:6px;background:var(--soft);text-align:center" type="number" min="0" value="${r.d1}" onchange="setRate('${k}',1,this.value)">–<input class="inp" style="width:56px;padding:6px;background:var(--soft);text-align:center" type="number" min="0" value="${r.d2}" onchange="setRate('${k}',2,this.value)">${L('天','days')}</div></div>`}).join('')}
    <div class="xs muted" style="margin-top:8px;line-height:1.6">${L('运费 = 计费量 × 单价。计费量取实际重量与体积重量中较大的：按立方米计时 1 立方米 = 1000 公斤；按公斤计时体积重量 = 体积 × 换算系数（海运 1000、空运 167、陆运 333、快递 200）。','Freight = chargeable quantity × unit price. The larger of actual weight and volume weight is charged: per m³, 1 m³ = 1000 kg; per kg, volume weight = volume × factor (sea 1000, air 167, road 333, express 200).')}</div>
    <div class="box" style="margin:12px 0 0;background:var(--soft);padding:12px"><b class="sm">${L('试算','Try it')}</b><div class="row gap" style="margin-top:8px"><div style="flex:1"><div class="xs muted">${L('重量（公斤）','Weight (kg)')}</div><input class="inp" id="frKg" type="number" inputmode="decimal" value="${S.frKg||500}" style="background:var(--card)" oninput="S.frKg=this.value;frTry()"></div><div style="flex:1"><div class="xs muted">${L('体积（立方米）','Volume (m³)')}</div><input class="inp" id="frCbm" type="number" inputmode="decimal" value="${S.frCbm||2}" style="background:var(--card)" oninput="S.frCbm=this.value;frTry()"></div></div><div id="frOut" style="margin-top:8px">${Object.keys(MODES).map(k=>frLine(k,S.frKg||500,S.frCbm||2)).join('')}</div></div></div></div>`};

function setRate(k,i,v){const s=JSON.parse(JSON.stringify(DB.get('settings','app')||{id:'app'}));s.rates=s.rates||{};const r=frRate(k);s.rates[k]=[r.p,r.d1,r.d2,r.unit];s.rates[k][i]=i===3?v:Math.max(0,+v||0);DB.put('settings',s);toast(L('已保存','Saved'),false);frTry()}
const frLine=(k,kg,cbm)=>{const x=frCost(k,kg,cbm);return `<div style="margin-top:8px"><div class="row between sm"><b>${L(MODES[k][0],MODES[k][1])}</b><b data-notr style="white-space:nowrap">${money(x.cost)}</b></div><div class="xs muted" data-notr>${n2(x.q)} ${frUnitName(x.unit)} × ${money(x.p)}${x.byVol?' · '+L('按体积计费','charged by volume'):''}</div></div>`};
function frTry(){const o=$('#frOut');if(o)o.innerHTML=Object.keys(MODES).map(k=>frLine(k,S.frKg||500,S.frCbm||2)).join('')}
V.m_backup=()=>hdr(L('数据备份','Backup'))+`<div class="pad">
  <div class="box" style="margin-top:6px"><h4>${ic('download')} ${L('下载备份','Download backup')}</h4><div class="sm muted" style="line-height:1.7">${L('导出全部商品、流水、单据、财务、物流为一个文件（不含密码）。','Exports all products, movements, orders, finance and shipments as one file (no passwords).')}</div><button class="bigbtn" style="margin-top:14px;width:100%" onclick="bkDown()">${L('下载备份文件','Download backup file')}</button></div>
  <div class="box"><h4>${ic('upload')} ${L('上传恢复','Restore from file')}</h4><div class="sm muted" style="line-height:1.7">${L('上传之前下载的备份文件，按“较新者优先”合并，不会删除现有数据。','Upload a backup file. Records merge (newer wins); nothing is deleted.')}</div><button class="bigbtn dark" style="margin-top:14px;width:100%" onclick="bkUp()">${L('选择备份文件','Choose backup file')}</button></div>
  <div class="box"><h4>${ic('star')} ${L('演示数据','Sample data')}</h4><div class="sm muted" style="line-height:1.7">${DB.cloud?L('把演示商品、门店和往来单位写入云端（不会改账号）。','Push sample products, stores and partners to the cloud (accounts untouched).'):L('恢复为初始演示数据（本机）。','Restore the initial sample data (this device).')}</div><button class="bigbtn ghost" style="margin-top:14px;width:100%" onclick="bkDemo()">${DB.cloud?L('导入演示数据','Import sample data'):L('重置演示数据','Reset sample data')}</button></div></div>`;
function bkDown(){const o={app:'jxc',ver:APP_VER,at:new Date().toISOString(),data:{}};KINDS.forEach(k=>o.data[k]=(DB.d[k]||[]).map(d=>{const x={...d};delete x.pw;delete x._q;return x}));downloadFile(`jxc_backup_${fday(Date.now())}.json`,JSON.stringify(o),'application/json')}
function bkUp(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{try{const o=JSON.parse(await i.files[0].text());if(o.app!=='jxc')throw new Error('format');let n=0;
  KINDS.filter(k=>k!=='users').forEach(k=>(o.data[k]||[]).forEach(d=>{const ex=DB.get(k,d.id);if(!ex||(ex.u||0)<(d.u||0)){DB.put(k,{...d},{quiet:true});n++}}));DB.save();bc('reset');Sync.run();toast(L(`已恢复 ${n} 条记录`,`${n} records restored`),false);render(false)}catch(e){toast(L('文件格式不正确','Invalid backup file'))}};i.click()}
async function bkDemo(){if(!confirm(L('确定？','Are you sure?')))return;if(!DB.cloud){await seedDemo();Object.keys(localStorage).filter(k=>k.startsWith('jxc_notes')).forEach(k=>localStorage.removeItem(k));bc('reset');
    const u=DB.get('users',S.me.id)||DB.all('users').find(x=>x.role==='gm');if(u){S.me={...u};delete S.me.pw;const s=LS.get(SK,{});s.me=S.me;LS.set(SK,s)}toast(L('已恢复演示数据','Sample data restored'),false);tab('home');return}
  const keep={...DB.d};await seedDemo();const add=[];['settings','wh','products','partners','moves','po','grn','so','sr','counts','ships','svc','fin'].forEach(k=>DB.d[k].forEach(d=>add.push({k,d})));
  KINDS.forEach(k=>DB.d[k]=keep[k]);add.forEach(r=>DB.put(r.k,r.d,{quiet:true}));Sync.run(true)}
S.lgK='all';
V.m_log=()=>{const K={so:L('销售单','Sales order'),po:L('采购单','PO'),grn:L('入库单','Receipt'),pr:L('采购退货','Supplier return'),sr:L('销售退货','Customer return'),counts:L('盘点单','Count'),fin:L('财务','Finance'),ships:L('物流','Shipment'),products:L('商品','Product'),users:L('账号','Account'),partners:L('往来单位','Partner'),moves:L('库存流水','Movement')};
  let rows=[];Object.keys(K).forEach(k=>{if(S.lgK!=='all'&&S.lgK!==k)return;(DB.d[k]||[]).forEach(d=>rows.push({k,d}))});rows=rows.sort((a,b)=>(b.d.u||0)-(a.d.u||0)).slice(0,150);
  return hdr(L('操作日志','Activity log'))+`<div class="pad"><div class="chips">${[['all',L('全部','All')]].concat(Object.entries(K)).map(([k,t])=>`<span class="chip sm ${S.lgK===k?'on':''}" onclick="S.lgK='${k}';render(false)">${t}</span>`).join('')}</div>
   <div class="box" style="padding:4px 16px">${rows.map(({k,d})=>`<div class="li" style="cursor:default"><span class="badge b-grey" style="min-width:70px;justify-content:center">${K[k]}</span><div style="flex:1;min-width:0"><div class="sm b one" data-notr>${esc(d.no||(k==='moves'?pName(d.pid)+' '+(d.qty>0?'+':'')+n2(d.qty):k==='fin'?money(d.amount):nm(d.n||d.name)||d.id))}</div><div class="xs muted">${fdate(d.u)} · ${esc(userName(d.by))}${d.status?' · '+esc(d.status):''}</div></div></div>`).join('')}</div></div>`};

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
  await cloudProbe();DB.load();
  /* v1.1：账号改为按部门密码登录，本机演示数据需要重建一次 */
  if(!DB.cloud&&!LS.get('seeded3',0)){await seedDemo();LS.set('seeded3',1);LS.del(SK);Object.keys(localStorage).filter(k=>k.startsWith('jxc_notes')).forEach(k=>localStorage.removeItem(k))}
  /* 国家：手动选过就用手动的，否则按时区 / 手机语言自动识别；语言：手动选过的优先，否则匹配手机语言 */
  const cs=LS.get('country',null);S.country=cs&&cs.manual&&AF[cs.code]?cs.code:detectCountry();
  const lm=LS.get('lang',null),ls=langsOf(S.country);S.lang=lm&&ls.includes(lm)?lm:pickLang(S.country);
  await setLang(S.lang,true);
  /* 首次使用某种语言：先把界面文字翻好再显示（最多等 4 秒），不会先出英文再变外文 */
  if(!['zh','en'].includes(S.lang))await Promise.race([ensureLang(S.lang),new Promise(r=>setTimeout(r,4000))]);
  S.online=navigator.onLine;
  if(restoreSession()){S.view=/mgmt/.test(location.hash)&&can('mgmt')?'mgmt':'home';Alerts.first()}else S.view='login';
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
