/* ================= 华宝进销存 · 用户端（移动端） ================= */
const V={};
const WEB=document.body.classList.contains('web'),ADMIN=document.body.classList.contains('admin');const LOGO=window.LOGO_DATA||'logo.svg';
/* 每个页面需要的权限：没有权限直接回首页，部门之间不能越界 */
const NEED={grns:'_docs',grn_view:'_docs',printers:null,docs:'_docs',stock:'stock',product:'stock',po_new:'po',recv_pick:'_recv',recv:'po_prepare',pr_new:'pr',sr_new:'sr',so_new:'so',take:'take',fin:'fin',report:'report',logi:'logi',ship_view:'logi',ship_new:'logi',logi_svc:'logi',
  att:'att',att_stats:'att_view',exp_stats:'_exps',mgmt:'mgmt',m_users:'mgmt',m_stores:'mgmt',m_products:'mgmt',m_partners:'_pt',m_settings:'mgmt',m_backup:'mgmt',m_log:'mgmt'};
const LIVE=new Set(['printers','chat','work','att','att_stats','exp','exp_stats','home','stock','product','docs','po_view','so_view','take_view','logi','ship_view','report','msgs','me','grn_view','grns','recv_pick','fin','mgmt','m_users','m_stores','m_products','m_log']);
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
  if(VREC&&S.view==='chat_room'&&S.chId===VREC.ch){chatPaint();return}
  if(!S.me&&S.view!=='login')S.view='login';
  if(!S.me&&sheetOn())closeSheet(true);
  if(S.me&&V[S.view]&&NEED[S.view]&&!can(NEED[S.view])){S.view='home';S.hist=[]}
  document.body.classList.toggle('chat-ui',['chat','chat_room','chat_leave'].includes(S.view));document.body.classList.toggle('chat-room-ui',S.view==='chat_room');const sc=$('#screen');let h='';try{h=(V[S.view]||V.home)()}catch(e){console.error(e);h=`<div class="pad"><div class="note-r">${esc(e.message)}</div></div>`}
  /* soft = 后台数据更新后的刷新：不播放淡入动画、保持滚动位置（避免闪动） */
  sc.innerHTML=`<div class="${soft?'':'fade'}">${S.me?topBars():''}${h}<div class="scroll-end-space" aria-hidden="true"></div></div>`;S.rv=DB.ver;
  const fx=$('#fixed');fx.innerHTML='';sc.querySelectorAll('.bbar').forEach(e=>fx.appendChild(e));if(['chat','chat_room','chat_leave'].includes(S.view)){const header=sc.querySelector('.chat-home-head')||sc.querySelector('.hdr');if(header){header.classList.add('chat-fixed-header');fx.appendChild(header)}}
  const isTab=TABS().some(t=>t[0]===S.view)&&!!S.me;sc.classList.toggle('nonav',!isTab);
  $('#navwrap').innerHTML=S.me&&(isTab||WEB)?tnav():'';document.body.classList.toggle('authed',!!S.me);
  if(top)sc.scrollTop=0;
  if(window.languageServiceStatus&&S.me&&['work','chat','chat_room'].includes(S.view))languageServiceStatus().catch(()=>{});syncUI();updateUnreadBadge();try{pwaBar()}catch(e){}fitText();measureBottomSpace();requestAnimationFrame(()=>{fitText();measureBottomSpace()});
}
let bottomSpaceObserver=null;
function measureBottomSpace(){const sc=$('#screen');if(!sc?.getBoundingClientRect)return;const rect=sc.getBoundingClientRect();let overlap=0;const bars=document.querySelectorAll('#navwrap .tnav,#fixed .bbar');bars.forEach(bar=>{const r=bar.getBoundingClientRect();if(r.height&&r.top>rect.top+rect.height/2&&r.left<rect.right&&r.right>rect.left)overlap=Math.max(overlap,rect.bottom-r.top)});sc.style.setProperty('--bottom-ui-height',Math.ceil(Math.max(0,overlap))+'px');if(window.ResizeObserver){if(!bottomSpaceObserver)bottomSpaceObserver=new ResizeObserver(()=>measureBottomSpaceValue());bottomSpaceObserver.disconnect();bars.forEach(bar=>bottomSpaceObserver.observe(bar))}}
function measureBottomSpaceValue(){const sc=$('#screen');if(!sc?.getBoundingClientRect)return;const rect=sc.getBoundingClientRect();let overlap=0;document.querySelectorAll('#navwrap .tnav,#fixed .bbar').forEach(bar=>{const r=bar.getBoundingClientRect();if(r.height&&r.top>rect.top+rect.height/2&&r.left<rect.right&&r.right>rect.left)overlap=Math.max(overlap,rect.bottom-r.top)});sc.style.setProperty('--bottom-ui-height',Math.ceil(Math.max(0,overlap))+'px')}
addEventListener('resize',()=>requestAnimationFrame(measureBottomSpaceValue));
/* 标题一律一行：放不下时先缩小字号（最多到 65%），仍放不下才用省略号（与 ChinaPaw v4.3.2 相同） */
function fitText(){decorateActions();$$('#screen .hero,#screen .sc .t,#screen .stat .n,#screen .wtile .b,#screen .fit,#screen .ptitle,.seg button,.rolebtn,.badge').forEach(e=>{if(!e.offsetParent)return;e.style.fontSize='';const cs=parseFloat(getComputedStyle(e).fontSize);let f=cs,i=0;
  e.style.whiteSpace='nowrap';e.style.overflow='hidden';while(e.scrollWidth>e.clientWidth+1&&f>Math.max(12,cs*.75)&&i<20){f-=.5;e.style.fontSize=f+'px';i++}})}
function decorateActions(){document.querySelectorAll('#screen [onclick],#sheet [onclick]').forEach(e=>{if(/^(BUTTON|INPUT|SELECT|TEXTAREA|IMG|CANVAS)$/.test(e.tagName)||(e.tagName==='A'&&e.hasAttribute('href'))||e.querySelector('button,input,select,textarea,[onclick]'))return;if(!e.hasAttribute('role')){e.classList.add(e.matches('.wtile,.box,.sc,.wc,.stat,.av')?'action-card':'action-control');e.setAttribute('role','button');e.setAttribute('tabindex','0')}})}
document.addEventListener('keydown',e=>{const t=e.target;if(!t?.matches?.('.action-control[role="button"],.action-card[role="button"]')||!['Enter',' '].includes(e.key))return;e.preventDefault();t.click()});
addEventListener('resize',()=>{clearTimeout(window._fz);window._fz=setTimeout(fitText,150)});
let _soft=0;
/* 后台刷新：只有数据真的变化（或翻译、汇率更新）时才重画；正在输入或打开弹层时不打断 */
function softRender(force){if(S.me&&S.view==='chat_room'){if(!force&&S.rv===DB.ver)return;chatPaint();S.rv=DB.ver;return}if(!S.me&&!(force&&S.view==='login'))return;if(!force&&S.rv===DB.ver)return;const a=document.activeElement;
  if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&$('#screen').contains(a))return;if(sheetOn()||!(LIVE.has(S.view)||S.view==='login'))return;
  clearTimeout(_soft);_soft=setTimeout(()=>{const t=$('#screen').scrollTop;render(false,true);$('#screen').scrollTop=t},120)}
let BADGE_TIMER=0,BADGE_LAST='';
function updateUnreadBadge(force=false){clearTimeout(BADGE_TIMER);BADGE_TIMER=setTimeout(async()=>{const user=S.me&&S.me.id,count=S.me?chatUnread()+Alerts.unread():0;const stamp=(user||'')+':'+count;if(!force&&stamp===BADGE_LAST)return;
  if(!isNative()&&navigator.serviceWorker)navigator.serviceWorker.ready.then(r=>r.active&&r.active.postMessage({type:'jxc-badge',userId:user||'',count})).catch(()=>{});
  if(navigator.setAppBadge){try{if(count)await navigator.setAppBadge(count);else await navigator.clearAppBadge()}catch(e){}}
  if(isNative()&&NX()){const caps=await voiceCaps();if(caps.notifications){if((S.me&&S.me.id||'')!==(user||''))return;try{await NX().setUnreadBadge({count,text:L(`${count} 条未读消息 / 业务通知`,`${count} unread messages / business notices`)});BADGE_LAST=stamp}catch(e){/* Permission is managed in Me → Phone permissions. */}}}else BADGE_LAST=stamp;
},80)}
let PUSH_DEVICE_TOKEN='',PUSH_BINDING=false,PUSH_STATUS='idle',PUSH_ERROR='';
async function bindPushRegistration(manual=false){if(PUSH_BINDING||!S.me||!DB.cloud||!S.token)return;if(!isNative()||!NX())return bindWebPush(manual);PUSH_BINDING=true;const user=S.me.id,session=S.token;
  try{if(manual)await nativePerms(['notifications']);const caps=await voiceCaps();if(!caps.push){PUSH_STATUS='update';if(manual)toast(L('请安装新版 APP 以启用后台推送','Install the latest app for background push'));return}
    const result=await NX().registerPush();if(!result.token)throw new Error('No FCM token');if(!S.me||S.me.id!==user||S.token!==session)return;
    await rpc('jxc_register_push',{p_token:session,p_device_token:result.token});if(!S.me||S.me.id!==user||S.token!==session){await rpc('jxc_unregister_push',{p_token:session,p_device_token:result.token}).catch(()=>{});return}
    PUSH_DEVICE_TOKEN=result.token;await NX().setPushUser({userId:user});
    if(NX().notificationStatus){try{const status=await NX().notificationStatus();if(!status.enabled||!status.channelEnabled||!status.badgeEnabled){PUSH_STATUS='permission';PUSH_ERROR=L('推送已注册，但系统通知或图标角标被关闭，请打开手机通知设置。','Push registered, but notifications or badges are disabled in system settings.');if(manual)toast(PUSH_ERROR);return}}catch(e){/* Older APKs do not expose diagnostics. */}}
    PUSH_ERROR='';PUSH_STATUS='ready';updateUnreadBadge(true);if(manual)toast(L('后台推送已连接，请允许系统通知','Background push connected; allow system notifications'),false);
  }catch(e){PUSH_STATUS='setup';PUSH_ERROR=String(e.message||e);if(manual)toast(L('后台推送未就绪：','Background push not ready: ')+String(e.message||e))}finally{PUSH_BINDING=false}}
async function revokePushRegistration(session){if(!isNative())await revokeWebPush(session);const token=PUSH_DEVICE_TOKEN;PUSH_DEVICE_TOKEN='';PUSH_STATUS='idle';try{const caps=await voiceCaps();if(caps.push)await NX().setPushUser({userId:''})}catch(e){}if(session&&token)await rpc('jxc_unregister_push',{p_token:session,p_device_token:token}).catch(()=>{})}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&S.me){bindPushRegistration();updateUnreadBadge(true)}});
function todoCount(){let n=0;
  if(can('so_ship'))n+=DB.all('so').filter(s=>s.status==='approved').length;
  if(own('so_fin'))n+=DB.all('so').filter(s=>s.status==='submitted').length;
  if(S.me&&S.me.role==='gm')n+=DB.all('so').filter(s=>s.status==='credit_gm').length;
  if(own('tk_fin'))n+=DB.all('counts').filter(c=>c.status==='pending').length;if(can('tk_final'))n+=DB.all('counts').filter(c=>c.status==='fin_ok').length;
  n+=DB.all('grn').filter(g=>grnCanAct(g)).length;

  if(can('pr_exec'))n+=DB.all('pr').filter(r=>r.status==='pending').length;if(can('sr_exec'))n+=DB.all('sr').filter(r=>r.status==='pending').length;return n}
/* 底部导航：按部门显示各自的功能（网页版显示在左侧） */
/* 底部导航：每个职位最多 5 个，“消息”固定在中间；其余功能都在“工作台” */
function TABS(){if(!S.me)return [];const r=S.me.role;const P={chair:['report','chart',L('报表','Reports')],gm:['fin','calc',L('财务','Finance')],ops:['report','chart',L('报表','Reports')],buyer:['stock','box',L('库存','Stock')],sales:['docs','doc',L('单据','Orders')],
   field:['att','pin',L('打卡','Check-in')],keeper:['stock','box',L('库存','Stock')],acct:['fin','calc',L('财务','Finance')],cashier:['fin','calc',L('财务','Finance')]}[r]||['docs','doc',L('单据','Orders')];
  return [['home','home',L('首页','Home')],['work','grid',L('工作台','Work')],['chat','messages-square',L('消息','Chat')],P,['me','user',L('我的','Me')]]}
function tnav(){const v=S.view;const b=n=>n?`<span class="cnt">${n>99?'99+':n}</span>`:'';
  const cnt={docs:todoCount(),fin:finTodo(),work:todoCount()+expTodo(),chat:chatUnread(),me:Alerts.unread()};
  let h=TABS().map(([k,icon,label])=>`<button class="${v===k?'on':''} ${k==='chat'?'nav-chat':''}" onclick="tab('${k}')" aria-label="${esc(label)}"><span class="ti">${ic(icon,22)}${b(cnt[k])}</span><span class="tl">${label}</span></button>`).join('');
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
  list(){return LS.get(this.key(),[])},save(a){LS.set(this.key(),a.slice(0,80));updateUnreadBadge()},
  unread(){return S.me?this.list().filter(n=>!n.read).length:0},
  prefs(){return Object.assign({order:true,low:true,ship:true,logi:true,fin:true},LS.get('prefs_'+(S.me&&S.me.id),{}))},
  add(n,show,t){const a=this.list();if(n.key&&a.some(x=>x.key===n.key))return;n.id=uid('n');n.t=n.t||Date.now();a.unshift(n);this.save(a);if(show)banner(n)},
  scan(rows,show=true){if(!S.me)return;const pf=this.prefs();
    rows.forEach(({k,d})=>{const _add=this.add.bind(this);const self={add:(n,s)=>{n.t=show?Date.now():(d.u||d.t);_add(n,s)}};if(d.by===S.me.id&&!(k==='grn'&&grnCanAct(d))&&!(k==='exp'&&expAct(d))&&!(k==='fin'&&payCanReview(d))&&!(k==='so'&&(d.status==='submitted'&&own('so_fin')||d.status==='credit_gm'&&['chair','gm'].includes(S.me.role)||d.status==='approved'&&can('so_ship'))))return;
      if(k==='att'&&can('att_view')&&d.by!==S.me.id)self.add({key:'at'+d.id,ic:'pin',c:'var(--gold)',zh:`${userName(d.by)} ${ATT_T[d.type][0]} · ${d.addr||''}`,en:`${userName(d.by)} ${ATT_T[d.type][1]} · ${d.addr||''}`,go:['att_stats',{}]},show&&d.type!=='visit');
      if(k==='msg'){if(show&&!d.rc&&(!d.mem||d.mem.includes(S.me.id))&&!(S.view==='chat_room'&&S.chId===d.ch)&&Date.now()-d.t<60e3){const c=chGet(d.ch);const at=(d.at||[]).includes(S.me.id)||(d.at||[]).includes('all');
        const txt=(c&&c.type!=='dm'?chName(c)+' · ':'')+userName(d.by)+'：'+(d.voice?L('[语音]','[Voice]'):d.img?L('[图片]','[Photo]'):d.loc?L('[位置]','[Location]'):d.text);banner({ic:'chat',c:at?'var(--red)':'var(--green)',zh:(at?'[有人@你] ':'')+txt,en:(at?'[Mentioned] ':'')+txt,go:['chat_room',{ch:d.ch}]})}return};
      if(k==='exp'&&expAct(d))self.add({key:'ex'+d.id+d.status,ic:'calc',c:'var(--purple)',zh:`费用 ${money(d.amt)} 待您处理`,en:`Expense ${money(d.amt)} needs action`,go:['exp',{}]},show);
      if(k==='grn'&&grnCanAct(d))self.add({key:'gr'+d.id+d.status,ic:'in',c:'var(--purple)',zh:`入库单 ${d.no} 待您处理 · 批号 ${d.batch||d.no}`,en:`Receipt ${d.no} needs your review`,go:['grn_view',{id:d.id}]},show);
      if(k==='so'&&d.status==='submitted'&&own('so_fin'))self.add({key:'so'+d.id+'f'+(d.u||''),ic:'calc',c:'var(--purple)',zh:`销售单 ${d.no} 待财务审核（${d.pay==='credit'?'赊账':'现款'}）· ${pnL(d.cus,'zh')}`,en:`Order ${d.no} needs finance review (${d.pay==='credit'?'credit':'cash'})`,go:['so_view',{id:d.id}]},show);
      if(k==='so'&&d.status==='credit_gm'&&['chair','gm'].includes(S.me.role))self.add({key:'so'+d.id+'g',ic:'calc',c:'var(--red)',zh:`赊账销售单 ${d.no} 待您审批 · ${pnL(d.cus,'zh')}`,en:`Credit order ${d.no} needs your approval`,go:['so_view',{id:d.id}]},show);
      if(k==='so'&&d.status==='rejected'&&d.by===S.me.id)self.add({key:'so'+d.id+'r'+(d.u||''),ic:'x',c:'var(--red)',zh:`销售单 ${d.no} 被驳回：${d.rj||''}`,en:`Order ${d.no} rejected: ${d.rj||''}`,go:['so_view',{id:d.id}]},show);
      if(k==='so'&&d.status==='approved'&&can('so_ship')&&pf.order)self.add({key:'so'+d.id+'s',ic:'cart',c:'var(--gold)',zh:`销售单 ${d.no} 已审核，待出库 · ${pnL(d.cus,'zh')}`,en:`Order ${d.no} approved — ready to ship · ${pnL(d.cus,'en')}`,go:['so_view',{id:d.id}]},show);
      if(k==='so'&&d.status==='approved'&&d.by===S.me.id&&pf.order)self.add({key:'so'+d.id+'ok',ic:'check',c:'var(--green)',zh:`销售单 ${d.no} 已审核通过，仓库将出库`,en:`Order ${d.no} approved — the warehouse will ship`,go:['so_view',{id:d.id}]},show);
      if(false)self.add({key:'so'+d.id+'n',ic:'cart',c:'var(--gold)',zh:`同事提交了销售单 ${d.no}`,en:`Sales order ${d.no} submitted`,go:['so_view',{id:d.id}]},show);
      if(k==='so'&&d.status==='shipped'&&can('so')&&pf.ship)self.add({key:'so'+d.id+'x',ic:'out',c:'var(--blue)',zh:`销售单 ${d.no} 已出库发货`,en:`Order ${d.no} has shipped`,go:['so_view',{id:d.id}]},show);
      if(k==='po'&&d.status==='ordered'&&can('po_prepare')&&pf.ship)self.add({key:'po'+d.id+'o',ic:'in',c:'var(--green)',zh:`采购单 ${d.no} 已下单，到货后请入库`,en:`PO ${d.no} ordered — receive on arrival`,go:['po_view',{id:d.id}]},show);
      if(k==='counts'&&d.status==='fin_ok'&&can('tk_final'))self.add({key:'tk'+d.id+'f',ic:'clip',c:'var(--purple)',zh:`盘点单 ${d.no} 财务已复核，待终审`,en:`Stock count ${d.no} awaiting final approval`,go:['take_view',{id:d.id}]},show);
      if(k==='counts'&&d.status==='pending'&&own('tk_fin'))self.add({key:'tk'+d.id,ic:'clip',c:'var(--purple)',zh:`盘点单 ${d.no} 待审核`,en:`Stock count ${d.no} awaiting review`,go:['take_view',{id:d.id}]},show);
      if(k==='counts'&&['approved','rejected'].includes(d.status)&&d.by===S.me.id)self.add({key:'tk'+d.id+d.status,ic:'clip',c:'var(--purple)',zh:`盘点单 ${d.no} ${d.status==='approved'?'已审核通过':'被驳回'}`,en:`Stock count ${d.no} ${d.status}`,go:['take_view',{id:d.id}]},show);
      if(k==='ships'&&pf.logi&&can('logi'))self.add({key:'sh'+d.id+d.status,ic:'truck',c:d.status==='exception'?'var(--red)':'var(--blue)',zh:`物流 ${d.trackNo||d.no}：${SH_ST[d.status][0]}`,en:`Shipment ${d.trackNo||d.no}: ${SH_ST[d.status][1]}`,go:['ship_view',{id:d.id}]},show);
      if(k==='pr'&&d.status==='pending'&&can('pr_exec'))self.add({key:'pr'+d.id,ic:'out',c:'var(--orange)',zh:`采购退货 ${d.no} 待出库`,en:`Supplier return ${d.no} to ship out`,go:['docs',{}]},show);
      if(k==='sr'&&d.status==='pending'&&can('sr_exec'))self.add({key:'sr'+d.id,ic:'in',c:'var(--purple)',zh:`销售退货 ${d.no} 待收货`,en:`Customer return ${d.no} to receive`,go:['docs',{}]},show);
      if(k==='fin'&&d.type==='rcv'&&d.status==='recorded'&&can('fin_verify')&&S.me.role!=='gm'&&pf.fin)self.add({key:'fr'+d.id,ic:'check',c:'var(--purple)',zh:`出纳登记了一笔收款，待核对`,en:`A receipt was recorded — please verify`,go:['fin',{}]},show);
      if(k==='fin'&&d.type==='pay'&&d.status==='approved'&&can('fin_pay')&&S.me.role!=='gm'&&pf.fin)self.add({key:'fp'+d.id+(d.gt||''),ic:'out',c:'var(--orange)',zh:`总经理已批准一笔付款，待支付`,en:`The GM approved a payment — please pay`,go:['fin',{}]},show);
      if(k==='fin'&&payCanReview(d))self.add({key:'fq'+d.id+(d.at||''),ic:'calc',c:'var(--gold)',zh:`付款申请待您审批（每笔先运营经理，超过复审门槛再总经理）`,en:`The accountant requested a payment — please review`,go:['fin',{seg:'ap'}]},show);
      if(k==='fin'&&d.type==='pay'&&['approved','rejected'].includes(d.status)&&S.me.role==='acct'&&d.gby)self.add({key:'fg'+d.id+(d.gt||''),ic:d.status==='approved'?'check':'x',c:d.status==='approved'?'var(--green)':'var(--red)',zh:d.status==='approved'?`总经理批准了付款申请`:`总经理驳回了付款申请`,en:d.status==='approved'?`The GM approved a payment request`:`The GM rejected a payment request`,go:['fin',{seg:'ap'}]},show);
      if(k==='svc'&&d.status==='new'&&S.me.role==='gm')self.add({key:'bk'+d.id,ic:'calendar',c:'var(--orange)',zh:`新的物流预约 ${d.no}`,en:`New logistics booking ${d.no}`,go:['logi_svc',{}]},show);
    });
    if(rows.some(r=>r.k==='moves'))this.low(show)},
  low(show){if(!S.me||!this.prefs().low||!(can('po')||can('take')))return;const day=fday(Date.now());
    DB.all('products').forEach(p=>{const q=qtyOf(p.id);const s=stStatus(p,q);if(s==='low'||s==='out')this.add({key:'low'+p.id+day,ic:'alert',c:'var(--red)',zh:`库存不足：${prL(p,'zh')} 仅剩 ${n2(q)} ${unL(p,'zh')}`,en:`Low stock: ${prL(p,'en')} — ${n2(q)} ${unL(p,'en')} left`,go:['product',{id:p.id}]},show)})},
  first(){if(LS.get('notesInit_'+S.me.id,0))return;const rows=[];KINDS.forEach(k=>DB.all(k).forEach(d=>rows.push({k,d})));this.scan(rows.filter(r=>r.k!=='ships'||r.d.status==='exception'||r.d.status==='delivering'),false);LS.set('notesInit_'+S.me.id,1)}
};
function banner(n){noticeSound();const b=$('#banner');if(!b)return;b.innerHTML=`<div class="qi" style="background:${n.c||'var(--gold)'};color:#fff">${ic(n.ic||'bell',18)}</div><div style="flex:1;min-width:0"><div class="b sm">${L('新消息','New')}</div><div class="sm one">${esc(L(n.zh,n.en))}</div></div>`;
  b.onclick=()=>{b.classList.remove('on');markRead(n.id);if(n.go)go(n.go[0],n.go[1])};b.classList.add('on');try{navigator.vibrate&&navigator.vibrate(40)}catch(e){}
  clearTimeout(b._t);b._t=setTimeout(()=>b.classList.remove('on'),4500)}
function markRead(id){const a=Alerts.list();a.forEach(n=>{if(!id||n.id===id)n.read=true});Alerts.save(a)}

/* ================= 登录：只输入密码（不需要手机号），系统按密码识别部门与账号 ================= */
const ROLE_COLOR={chair:'#161616',gm:'#161616',ops:'#3D4A5C',buyer:'#2367B0',sales:'#F2B705',field:'#C98E00',keeper:'#0B7A4B',acct:'#7B4FA0',cashier:'#E87A2B'};
/* 登录：① 部门 → ② 职位（本部门的基本职位 + 后台新增的职位）→ ③ 密码 */
const lgTitle=()=>{const p=S.lgPos&&posById(S.lgPos);return p?nm(p.n):roleName(S.lgRole)};
const lgOpts=d=>[...d.roles.map(r=>({r,p:null,n:roleName(r)})),...positions().filter(p=>!p.del&&p.dept===d.id&&d.roles.includes(p.role)).map(p=>({r:p.role,p:p.id,n:nm(p.n)}))];
function lgDept(id){S.lgDept=id;LS.set('lgDept',id);const o=lgOpts(DEPTS.find(d=>d.id===id));if(o.length===1){S.lgRole=o[0].r;S.lgPos=null}else if(!o.some(x=>x.r===S.lgRole&&(x.p||null)===(S.lgPos||null))){S.lgRole=null;S.lgPos=null}LS.set('lgRole',S.lgRole);LS.set('lgPos',S.lgPos);render(false);setTimeout(()=>{if(S.lgRole){const i=$('#lgPw');i&&i.focus()}},50)}
function lgPick(b,r,p){S.lgRole=r;S.lgPos=p;LS.set('lgRole',r);LS.set('lgPos',p);const pp=lgPeople();if(!pp.some(u=>u.id===S.lgUid))S.lgUid=pp.length===1?pp[0].id:(pp.find(u=>u.id===LS.get('lgUid',''))||{}).id||null;render(false);setTimeout(()=>{const i=$('#lgPw');if(i&&(pp.length<2||S.lgUid))i.focus()},50)}
/* 同一职位的人员（登录时选择）：云端从 jxc_staff 取（只有姓名和职位），本机从账号列表取 */
function lgPeople(){if(!S.lgRole)return [];const all=DB.cloud?LS.get('staff',[]):DB.all('users').map(u=>({id:u.id,name:u.name,role:u.role,pos:u.pos||null,active:u.active!==false}));
  const pv=S.lgPos||null;return all.filter(u=>u.active!==false&&u.role===S.lgRole&&(pv?u.pos===pv:!(u.pos&&posById(u.pos))))}
V.login=()=>{if(S.lgRole===undefined){S.lgRole=LS.get('lgRole',null);S.lgPos=LS.get('lgPos',null);S.lgDept=LS.get('lgDept',null)||(S.lgRole?deptOf(S.lgRole).id:null)}
  if(S.lgPos&&!posById(S.lgPos))S.lgPos=null;const dd=DEPTS.find(d=>d.id===S.lgDept);
  if(DB.cloud&&!S._stF){S._stF=1;rpc('jxc_staff',{}).then(l=>{if(Array.isArray(l)&&JSON.stringify(l)!==JSON.stringify(LS.get('staff',[]))){LS.set('staff',l);if(S.view==='login')render(false)}}).catch(()=>{})}
  if(S.lgUid===undefined)S.lgUid=LS.get('lgUid',null);const ppl=lgPeople();if(ppl.length===1)S.lgUid=ppl[0].id;
  if(DB.cloud&&!S._posF){S._posF=1;rpc('jxc_positions',{}).then(l=>{if(Array.isArray(l)&&JSON.stringify(l)!==JSON.stringify(LS.get('pos',[]))){LS.set('pos',l);if(S.view==='login')render(false)}}).catch(()=>{})}
  return `<div class="login-hero"><div class="row between"><div class="row gap6" style="min-width:0"><img class="logo" src="${LOGO}" alt=""><b style="font-size:18px" class="one">${BRAND()}</b></div><div class="row" style="gap:8px">${ctryBtn()}${langBtn()}</div></div></div>
  <div class="pad" style="padding-top:20px">
   <div class="fld"><label>${L('① 选择部门','① Choose your department')}</label><div class="rolegrid">${DEPTS.map(d=>`<button class="rolebtn ${S.lgDept===d.id?'on':''}" style="--rc:${ROLE_COLOR[d.roles[0]]}" onclick="lgDept('${d.id}')">${esc(deptName(d))}</button>`).join('')}</div></div>
   ${dd?`<div class="fld"><label>${L('② 选择职位','② Choose your position')}</label><div class="chips wrap" id="lgPos">${lgOpts(dd).map(o=>`<span class="chip ${S.lgRole===o.r&&(S.lgPos||null)===o.p?'on':''}" onclick="lgPick(this,'${o.r}',${o.p?`'${o.p}'`:'null'})">${esc(o.n)}</span>`).join('')}</div></div>`:''}
   ${ppl.length>1?`<div class="fld"><label>${L('③ 选择人员','③ Choose your name')}</label><div class="chips wrap" id="lgPpl">${ppl.map(u=>`<span class="chip ${S.lgUid===u.id?'on':''}" onclick="S.lgUid='${u.id}';LS.set('lgUid','${u.id}');$$('#lgPpl .chip').forEach(x=>x.classList.remove('on'));this.classList.add('on');$('#lgPw').focus()">${esc(nmP(u.name))}</span>`).join('')}</div></div>`:''}
   <div class="fld"><label id="lgLab">${(ppl.length>1?L('④ ','④ '):L('③ ','③ '))+(S.lgRole?L('输入','Enter the ')+lgTitle()+L('密码',' password'):L('输入密码','Enter your password'))}</label><div class="row" style="position:relative"><input class="inp" id="lgPw" type="password" inputmode="text" autocomplete="current-password" style="font-size:20px;letter-spacing:3px;text-align:center" placeholder="••••••" onkeydown="if(event.key==='Enter')doLogin()"><button style="position:absolute;right:12px;color:var(--muted)" onclick="const i=$('#lgPw');i.type=i.type==='password'?'text':'password'" aria-label="show">${ic('lock',18)}</button></div></div>
   <div class="row between" style="margin-top:14px"><span class="sm b">${L('自动登录（信任此设备）','Stay signed in (trust this device)')}</span>${sw(LS.get('trust',true),"LS.set('trust',!LS.get('trust',true));render(false)")}</div>
   <div id="lgErr" class="sm red" style="margin-top:10px;min-height:18px"></div>
   <button class="bigbtn" style="width:100%" onclick="doLogin()">${L('登录','Sign in')}</button>
   <div class="xs muted" style="text-align:center;margin-top:22px" data-notr>v${APP_VER} · build ${APP_BUILD} · ${flagE(S.country)} ${esc(C().iso)}</div>
  </div>`};
async function doLogin(){const pw=$('#lgPw').value;const e=$('#lgErr');const ppl=lgPeople();if(ppl.length>1&&!ppl.some(u=>u.id===S.lgUid)){e.textContent=L('请选择人员','Choose your name');return}if(!S.lgDept){e.textContent=L('请先选择部门','Choose your department first');return}if(!S.lgRole){e.textContent=L('请选择职位','Choose your position');return}if(!pw){e.textContent=L('请输入密码','Enter your password');return}
  e.textContent='';try{await login(pw,LS.get('trust',true),S.lgRole,ppl.length>1?S.lgUid:(ppl[0]||{}).id||null);afterLogin()}catch(x){e.textContent=x.message;$('#lgPw').select()}}
function afterLogin(){purgeRestrictedCache();setTimeout(()=>{permAsk(false);bindPushRegistration()},1500);
  S.hist=[];S.view=/mgmt/.test(location.hash)&&can('mgmt')?'mgmt':'home';Alerts.first();Alerts.low(false);render(true);Sync.run('boot');toast(L('欢迎，','Welcome, ')+nmP(S.me.name)+' · '+userTitle(S.me),false)}
function doLogout(){openSheet(`<div class="sh">${L('退出登录？','Sign out?')}</div><div class="sm muted" style="margin-top:6px">${DB.outbox.length?L(`还有 ${DB.outbox.length} 条记录未提交，下次登录后继续提交。`,`${DB.outbox.length} change(s) not yet submitted; they will be sent next time you sign in.`):L('退出后需要重新输入密码登录。','You will need your password to sign in again.')}</div>
  <div class="row gap" style="margin-top:18px"><button class="bigbtn ghost" onclick="closeSheet()">${L('取消','Cancel')}</button><button class="bigbtn red" onclick="closeSheet();logout();S.view='login';render(true)">${L('退出','Sign out')}</button></div>`)}


/* ================= 手机原生能力（安卓 App）：权限、定位、打印、搜索打印机 ================= */
function NX(){try{const P=window.Capacitor&&window.Capacitor.Plugins;return P&&P.JxcNative||null}catch(e){return null}}
/* 申请权限：App 里弹系统的“允许”对话框（只问一次，以后不再问）；网页里由浏览器在第一次使用时询问 */
async function nativePerms(list){const n=NX();if(!n)return {};const st=await n.checkPerms();const need=list.filter(k=>st[k]!=='granted');if(!need.length)return st;return await n.requestPerms({list:need})}
async function permAsk(force){const n=NX();if(!n||!S.me)return;const k='permAsked_v180';if(!force&&LS.get(k,0))return;LS.set(k,1);
  try{const st=await n.checkPerms();const need=['location','camera','microphone','notifications'].filter(x=>st[x]!=='granted');if(!need.length)return;
    openSheet(`<div class="sh">${L('允许 3 个手机权限','Allow 3 phone permissions')}</div><div class="sm" style="margin-top:8px;line-height:1.8">${L('接下来手机会依次弹出窗口，请都点“允许 / 仅在使用中允许”：<br>· <b>位置信息</b>：考勤打卡、发送位置<br>· <b>相机</b>：打卡拍现场照片、拍商品图<br>· <b>麦克风</b>：发语音消息<br>只需要允许这一次，以后使用时不会再问。','Your phone will now ask three times — tap “Allow / While using the app” each time:<br>· <b>Location</b>: check-in, share location<br>· <b>Camera</b>: check-in photo, product photos<br>· <b>Microphone</b>: voice messages<br>You only need to do this once.')}</div>
     <button class="bigbtn" style="width:100%;margin-top:14px" onclick="closeSheet(true);nativePerms(['location','camera','microphone','notifications']).then(()=>updateUnreadBadge(true)).then(()=>toast(L('已设置好','All set'),false)).catch(()=>{})">${ic('check',18)} ${L('好的，开始','OK, go')}</button>`)}catch(e){}}
function pushSettings(){openSheet(`<div class="sh">${L('未读提醒与后台推送','Unread alerts & background push')}</div><div class="note-g">${L('群消息、语音和业务提交会显示未读提示；读完后清除。','Chat, voice and business submissions show an unread badge; reading clears it.')}</div><div class="sm" style="margin-top:12px">${PUSH_STATUS==='ready'?L('后台推送已连接','Background push connected'):esc(PUSH_ERROR||L('尚未连接，请点击下方按钮允许系统通知。','Not connected. Tap below to allow notifications.'))}</div><button class="bigbtn" style="margin-top:12px" onclick="bindPushRegistration(true)">${L('开启通知并连接推送','Allow notifications & connect push')}</button><button class="pill" style="margin-top:12px" onclick="testNoticeSound()">${L('开启提示音并测试','Enable & test sound')}</button>${isNative()?`<button class="pill" style="margin-top:12px" onclick="openPushSystemSettings()">${L('打开系统通知与角标设置','System notification & badge settings')}</button>`:''}<div class="xs muted" style="margin-top:12px">${L('图标显示红点或数字取决于手机桌面；系统强行停止 App 后需重新打开。','Your launcher controls dots/numbers; reopen the app after a system force-stop.')}</div>`)}
function permSheet(){const n=NX();if(!n){openSheet(`<div class="sh">${L('手机权限','Phone permissions')}</div><div class="sm" style="margin-top:8px;line-height:1.8">${isNative()?L('您的安装包是旧版，请安装最新版：新版打开后会自动申请定位、相机、麦克风权限。','This is an old app build — install the latest APK; it asks for location, camera and microphone automatically.')+`<button class="bigbtn" style="width:100%;margin-top:12px" onclick="closeSheet(true);checkUpdate(true)">${ic('refresh',18)} ${L('检查更新','Check for updates')}</button>`:L('网页版在第一次用到时由浏览器询问，点“允许”即可。<br>如果之前点了“拒绝”：Chrome 点地址栏左边的图标 → 权限，把位置、相机、麦克风改成“允许”，再刷新页面。<br>微信里打开的网页不支持定位和录音，请点“…”选“在浏览器打开”。','The browser asks the first time each feature is used — tap Allow.<br>If you tapped Block before: tap the icon left of the address → Permissions → allow Location, Camera and Microphone, then reload.<br>Pages opened inside WeChat cannot use location or recording — open them in Chrome.')}</div>`);return}
  n.checkPerms().then(st=>{const lab={location:[L('位置信息','Location'),L('考勤打卡、发送位置','Check-in, share location')],camera:[L('相机','Camera'),L('打卡拍照、商品图片','Check-in photos, product photos')],notifications:[L('通知与图标未读提示','Notifications & badge'),L('群消息、语音与业务提交提醒','Group chat, voice and submission alerts')],microphone:[L('麦克风','Microphone'),L('语音消息','Voice messages')]};
    openSheet(`<div class="sh">${L('手机权限','Phone permissions')}</div><div class="box" style="padding:4px 16px;margin-top:10px">${Object.keys(lab).map(k=>`<div class="li"><div style="flex:1;min-width:0"><div class="b sm">${lab[k][0]}</div><div class="xs muted">${lab[k][1]}</div></div>${st[k]==='granted'?`<span class="badge b-green">${L('已允许','Allowed')}</span>`:`<button class="pill g" onclick="nativePerms(['${k}']).then(r=>{if(r&&r['${k}']!=='granted')NX().openAppSettings();permSheet()})">${L('允许','Allow')}</button>`}</div>`).join('')}</div>
     <div class="xs muted" style="margin-top:10px;line-height:1.6">${L('如果点“允许”没有弹窗（之前选过“不再询问”），会直接打开本 App 的权限页面，把对应项改成“允许”即可。','If no prompt appears (you chose “Don’t ask again” before), the app’s permission page opens — switch the item to Allow.')}</div>
     <div class="row gap" style="margin-top:12px"><button class="bigbtn ghost" style="flex:1;height:48px" onclick="NX().openAppSettings()">${L('权限页面','Permission page')}</button><button class="bigbtn ghost" style="flex:1;height:48px" onclick="NX().openLocationSettings()">${L('GPS 开关','GPS switch')}</button></div>`)}).catch(()=>{})}
function micHelp(){const n=NX();openSheet(`<div class="sh">${L('麦克风没有打开','Microphone is not allowed')}</div>
  <div class="sm" style="margin-top:8px;line-height:1.8">${n?L('点下面“打开麦克风权限”，在“权限 → 麦克风”里选“仅在使用中允许”，返回后就能发语音。','Tap below → Permissions → Microphone → “Allow while using the app”, then come back.'):isNative()?L('您的安装包是旧版，请安装最新版（会自动申请麦克风权限）。','Old app build — install the latest APK (it asks for the microphone automatically).'):L('Chrome：点地址栏左边的图标 → 权限 → 麦克风 → 允许，然后刷新。微信里打开的网页不能录音，请用 Chrome 打开。','Chrome: tap the icon left of the address → Permissions → Microphone → Allow, then reload. Pages inside WeChat cannot record — use Chrome.')}</div>
  <div class="note-g" style="margin-top:10px">${L('不想开权限也可以：点输入框，用手机键盘上的 🎤 语音输入，说完自动变成文字，同样会自动翻译。这个不需要本软件的任何权限。','No permission needed alternative: tap the text box and use the 🎤 on your phone keyboard — speech becomes text and is translated as usual.')}</div>
  ${n?`<button class="bigbtn" style="width:100%;margin-top:12px" onclick="nativePerms(['microphone']).then(r=>{if(r&&r.microphone!=='granted')NX().openAppSettings();else closeSheet(true)})">${ic('mic',18)} ${L('打开麦克风权限','Allow microphone')}</button>`:''}`)}
V.printers=()=>{const n=NX();const P=S.prn||{};
  return hdr(L('打印机','Printers'))+`<div class="pad">
   <div class="box"><div class="b">${L('WiFi 网络打印机','WiFi network printers')}</div><div class="sm muted" style="margin-top:6px;line-height:1.7">${L('打印机和手机连同一个 WiFi 即可，不用装驱动。打印单据时，系统会自动搜索网络里的打印机，选中后打印；选过一次以后会默认用它。','Put the printer and phone on the same WiFi — no driver needed. When you print, the system searches the network automatically; pick the printer once and it becomes the default.')}</div>
    ${n?`<button class="bigbtn" style="width:100%;margin-top:12px;height:48px" onclick="prnScan()">${ic('refresh',18)} ${P.busy?L('正在搜索…','Searching…'):L('搜索 WiFi 打印机','Search WiFi printers')}</button>
     ${P.list?`<div style="margin-top:10px">${P.list.length?P.list.map(p=>`<div class="li"><div class="qi">${ic('print',18)}</div><div style="flex:1;min-width:0"><div class="b sm one">${esc(p.name)}</div><div class="xs muted one" data-notr>${esc(p.type||'')}${p.host?' · '+esc(p.host):''}</div></div><span class="badge b-green">${L('已找到','Found')}</span></div>`).join(''):`<div class="note-r">${L('没有找到。请确认打印机已开机、已连上 WiFi，并和手机在同一个 WiFi。','Nothing found. Check the printer is on, connected to WiFi, and on the same network as this phone.')}</div>`}</div>`:''}
     <button class="bigbtn ghost" style="width:100%;margin-top:10px;height:48px" onclick="prnTest()">${ic('print',18)} ${L('打印测试页','Print a test page')}</button>`
    :`<button class="bigbtn ghost" style="width:100%;margin-top:12px;height:48px" onclick="prnTest()">${ic('print',18)} ${L('打印测试页','Print a test page')}</button>`}</div>
   <div class="sec-h">${L('第一次使用','First-time setup')}</div><div class="box sm" style="line-height:1.9">
    ${L('1. 打印机连上公司 WiFi（打印机面板上的 WiFi 设置，或用 WPS 按钮）。<br>2. 手机连同一个 WiFi。<br>3. 安卓手机：“设置 → 连接的设备 → 打印”，打开“默认打印服务”（或安装 Mopria Print Service / 打印机品牌插件，如 HP、Canon、Epson）。<br>4. 回到这里点“打印测试页”，在弹出的页面顶部选您的打印机。','1. Connect the printer to the office WiFi (printer panel WiFi setup, or the WPS button).<br>2. Connect the phone to the same WiFi.<br>3. Android: Settings → Connected devices → Printing → turn on “Default Print Service” (or install Mopria Print Service / the HP, Canon or Epson plugin).<br>4. Come back and tap “Print a test page”, then choose your printer at the top.')}</div></div>`};
async function prnScan(){const n=NX();if(!n)return;S.prn={busy:true,list:(S.prn||{}).list};render(false);try{const r=await n.findPrinters({timeout:6000});S.prn={list:(r&&r.printers)||[]}}catch(e){S.prn={list:[]};toast(String(e&&e.message||e))}render(false)}
function prnTest(){const co=(DB.get('settings','app')||{}).co||{};window._pvH=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${L('打印测试页','Test page')}</title><style>body{font-family:sans-serif;padding:30px}h1{font-size:22px}</style></head><body><h1>${esc(nm(co)||BRAND())}</h1><p>${L('打印机连接正常。','The printer works.')} / Printer test OK</p><p>${new Date().toLocaleString()}</p></body></html>`;pvPrint()}

/* ================= 首页 ================= */
function greet(){const h=new Date().getHours();return h<12?L('上午好','Good morning'):h<18?L('下午好','Good afternoon'):L('晚上好','Good evening')}
const bigCard=(bg,fg,icon,t,sub,fn)=>`<div class="sc" style="background:${bg};color:${fg}" onclick="${fn}"><div class="ic">${ic(icon,19)}</div><div style="flex:1;min-width:0"><div class="t">${t}</div><div class="roles">${sub}</div></div><div class="go">${ic('arrow',16)}</div></div>`;
const tile=(bg,icon,t,sub,fn)=>`<div class="wtile" style="background:${bg}" onclick="${fn}"><div class="wti">${ic(icon)}</div><div style="min-width:0"><div class="b">${t}</div><div class="wsub">${sub}</div></div></div>`;
const statT=(cls,val,label,fn,cur)=>`<div class="stat ${cls}" onclick="${fn||''}"><div class="n" data-notr>${val}</div><div class="l">${label}</div></div>`;
V.home=()=>{const me=S.me,r=me.role;const today=dayStart();
  const sales=confirmedRevenue(today);
  const toShip=DB.all('so').filter(s=>s.status==='approved').length,toRecv=DB.all('po').filter(p=>p.status==='ordered').length;
  const low=DB.all('products').filter(p=>['low','out'].includes(stStatus(p))).length;
  const ships=DB.all('ships');const transit=ships.filter(s=>['picked','transit','customs'].includes(s.status)).length,deliv=ships.filter(s=>s.status==='delivering').length,exc=ships.filter(s=>s.status==='exception').length;
  const F=finSum();const big=[],tiles=[];let stats='';
  if(['chair','gm','sales'].includes(r)){if(can('so'))big.push(bigCard('var(--gold)','#161616','cart',L('销售开单','New sale'),L('选客户 → 扫码加商品 → 自动算金额','Customer → scan items → auto total'),"go('so_new')"))}
  if(r==='buyer')big.push(bigCard('var(--green)','#fff','in',L('采购下单','New purchase'),L('选供应商 → 加商品 → 提交下单','Supplier → items → place order'),"go('po_new')"));
  if(r==='keeper'){big.push(bigCard('var(--green)','#fff','in',L('采购入库','Receive goods'),L('选订单 → 填数量 → 扫码核对','Pick PO → quantities → scan check'),"go('recv_pick')"));
    big.push(bigCard('var(--gold)','#161616','out',L('销售出库','Ship orders'),L(`${toShip} 张待出库 · 确认发货扣库存`,`${toShip} to ship · confirm & deduct`),"S.docSeg='so';S.docF='approved';tab('docs')"))}
  if(r==='acct'){big.push(bigCard('var(--purple)','#fff','calc',L('财务对账','Accounts'),L('应收 · 应付 · 收款核对 · 付款申请','Receivables · payables · checks · payment requests'),"S.finSeg='ar';tab('fin')"));
    big.push(bigCard('var(--green)','#fff','chart',L('利润报表','Profit report'),L('销售额 · 成本 · 毛利','Sales · cost · gross profit'),"go('report')"))}
  if(r==='cashier'){big.push(bigCard('var(--green)','#fff','in',L('登记收款','Record receipt'),L('现金 / 银行 / 手机钱包','Cash / bank / mobile money'),"S.finSeg='ar';tab('fin')"));
    big.push(bigCard('var(--orange)','#fff','out',L('执行付款','Make payments'),L(`${F.apprN} 笔总经理已批准待付`,`${F.apprN} approved by GM, waiting`),"S.finSeg='ap';tab('fin')"))}
  if(can('_docs'))tiles.push(tile('var(--purple)','in',L('入库信息 / 审批','Receipts / approvals'),L('批号 · 财务审批 · 内勤确认','Batch · finance · clerk'),"go('grns')"));
  if(can('po_prepare')&&r!=='keeper')tiles.push(tile('var(--green)','in',L('登记采购到货','Register arrival'),L('提交财务审批','Submit to finance'),"go('recv_pick')"));
  if(can('stock'))tiles.push(tile('var(--tile)','scan',L('扫码查货','Scan & check'),L('相机扫码 · 秒出库存','Camera scan · instant stock'),'scanLookup()'));
  if(can('take'))tiles.push(tile('var(--blue)','clip',L('库存盘点','Stock count'),L('录实盘数 · 待审核','Enter counts · for review'),"go('take')"));
  if(r==='buyer')tiles.push(tile('var(--blue)','ret',L('采购退货','Return to supplier'),L('提交后由仓库出库','Warehouse ships it out'),"go('pr_new')"));
  if(r==='sales')tiles.push(tile('var(--blue)','ret',L('销售退货','Customer return'),L('提交后由仓库收货','Warehouse receives it'),"go('sr_new')"));
  if(r==='cashier'){tiles.push(tile('var(--blue)','doc',L('资金日记账','Cash book'),L('收付款流水 · 余额','Receipts, payments, balance'),"S.finSeg='book';tab('fin')"))}
  if(['chair','gm'].includes(r))tiles.push(tile('var(--blue)','chart',L('经营报表','Reports'),L('销售 · 利润 · 排行','Sales · profit · ranking'),"go('report')"));
  if(tiles.length%2)tiles.push(can('report')?tile('var(--purple)','chart',L('简易报表','Reports'),L('销售额 · 排行 · 流水','Sales · ranking · log'),"go('report')"):tile('var(--purple)','bell',L('消息','Messages'),L('提醒与待办','Alerts & tasks'),"go('msgs')"));
  if(['chair','gm','sales'].includes(r))stats=statT('g',numK(sales),L('今日出库货值','Goods shipped today'),"go('report')",1)+statT('',toShip,L('待出库','To ship'),"S.docSeg='so';S.docF='approved';tab('docs')")+statT(low?'y':'',low,L('库存不足','Low stock'),"S.stF='low';tab('stock')");
  else if(r==='buyer')stats=statT('g',DB.all('po').filter(p=>p.status==='ordered').length,L('在途采购','Open POs'),"S.docSeg='po';S.docF='ordered';tab('docs')")+statT('',transit,L('物流在途','In transit'),"tab('logi')")+statT(low?'y':'',low,L('库存不足','Low stock'),"S.stF='low';tab('stock')");
  else if(r==='keeper')stats=statT('g',toRecv,L('待入库','To receive'),"go('recv_pick')")+statT('',toShip,L('待出库','To ship'),"S.docSeg='so';S.docF='approved';tab('docs')")+statT(low?'y':'',low,L('库存不足','Low stock'),"S.stF='low';tab('stock')");
  else if(r==='acct')stats=statT('g',numK(F.arBal),L('应收余额','Receivable'),"S.finSeg='ar';tab('fin')",1)+statT('',numK(F.apBal),L('应付余额','Payable'),"S.finSeg='ap';tab('fin')")+statT(F.unverN?'y':'',F.unverN,L('待核对收款','To verify'),"S.finSeg='book';tab('fin')");
  else stats=statT('g',numK(F.rcvToday),L('今日收款','Received today'),"S.finSeg='book';tab('fin')",1)+statT(F.apprN?'y':'',F.apprN,L('待付款','To pay'),"S.finSeg='ap';tab('fin')")+statT('',numK(F.payMonth),L('本月付款','Paid this month'),"S.finSeg='book';tab('fin')");
  const todo=[];const grTodo=DB.all('grn').filter(g=>grnCanAct(g)).length;if(grTodo)todo.unshift(['in',L(`${grTodo} 张入库单待您处理`,`${grTodo} receipt(s) need action`),"go('grns')",'var(--purple)']);
  if(own('att')&&!attTodayDone()&&new Date().getHours()<20)todo.unshift(['pin',L('今天还没有上班打卡','You have not checked in today'),S.me.role==='field'?"tab('att')":"go('att')",'#0E7C86']);
  if(can('so_ship')&&toShip&&r!=='keeper')todo.push(['out',L(`${toShip} 张销售单待出库`,`${toShip} order(s) to ship`),"S.docSeg='so';S.docF='approved';tab('docs')",'var(--gold)']);
  if(can('po_recv')&&toRecv&&r!=='keeper')todo.push(['in',L(`${toRecv} 张采购单待入库`,`${toRecv} PO(s) to receive`),"go('recv_pick')",'var(--green)']);
  const prP=DB.all('pr').filter(x=>x.status==='pending').length,srP=DB.all('sr').filter(x=>x.status==='pending').length;
  if(can('pr_exec')&&prP)todo.push(['out',L(`${prP} 张采购退货待出库`,`${prP} supplier return(s) to ship out`),"S.docSeg='ret';tab('docs')",'var(--orange)']);
  if(can('sr_exec')&&srP)todo.push(['in',L(`${srP} 张销售退货待收货`,`${srP} customer return(s) to receive`),"S.docSeg='ret';tab('docs')",'var(--purple)']);
  const tk=DB.all('counts').filter(c=>(c.status==='pending'&&own('tk_fin'))||(c.status==='fin_ok'&&can('tk_final'))).length;if(tk)todo.push(['clip',L(`${tk} 张盘点单待审核`,`${tk} stock count(s) to review`),"S.docSeg='take';tab('docs')",'var(--purple)']);
  const sf=DB.all('so').filter(s=>s.status==='submitted').length;if(own('so_fin')&&sf)todo.unshift(['calc',L(`${sf} 张销售单待财务审核（收款 / 赊账）`,`${sf} sales order(s) for finance review`),"S.docSeg='so';S.docF='submitted';tab('docs')",'var(--purple)']);
  const sg=DB.all('so').filter(s=>s.status==='credit_gm').length;if(r==='gm'&&sg)todo.unshift(['calc',L(`${sg} 张赊账销售单待您审批`,`${sg} credit order(s) need your approval`),"S.docSeg='so';S.docF='credit_gm';tab('docs')",'var(--red)']);
  if(can('fin_verify')&&F.unverN)todo.push(['check',L(`${F.unverN} 笔收款待核对`,`${F.unverN} receipt(s) to verify`),"S.finSeg='book';tab('fin')",'var(--purple)']);
  if(['gm','ops'].includes(r)&&F.reqN)todo.unshift(['calc',L(`${F.reqN} 笔付款申请待您审批`,`${F.reqN} payment request(s) to review`),"payReview()",'var(--gold)']);
  if(r==='acct'&&F.rejN)todo.push(['x',L(`${F.rejN} 笔付款申请被驳回，待处理`,`${F.rejN} rejected payment request(s)`),"S.finSeg='ap';tab('fin')",'var(--red)']);
  if(can('fin_pay')&&F.apprN)todo.push(['out',L(`${F.apprN} 笔付款总经理已批准，待支付`,`${F.apprN} GM-approved payment(s) to pay`),"S.finSeg='ap';tab('fin')",'var(--orange)']);
  const dr=DB.all('so').concat(DB.all('po')).filter(d=>d.status==='draft'&&d.by===me.id).length;if(dr)todo.push(['edit',L(`${dr} 张草稿未提交`,`${dr} draft(s) not submitted`),"S.docSeg='"+(can('so')?'so':'po')+"';S.docF='draft';tab('docs')",'#8A8478']);
  if(exc&&can('logi'))todo.push(['alert',L(`${exc} 票物流异常`,`${exc} shipment exception(s)`),"S.logiF='exception';tab('logi')",'var(--red)']);
  if(DB.outbox.length)todo.push(['cloud',L(`${DB.outbox.length} 条记录待提交`,`${DB.outbox.length} change(s) waiting to submit`),'syncSheet()','var(--orange)']);
  const mv=can('stock')?DB.all('moves').sort((a,b)=>b.t-a.t).slice(0,5):[];
  return `<div class="pad" style="padding-top:16px">
   ${WEB?'':`<div class="row between"><div class="row gap6" style="min-width:0"><img class="logo" src="${LOGO}" alt=""><b style="font-size:17px" class="one">${BRAND()}</b></div>
    <div class="row" style="gap:6px">${ctryBtn()}${langBtn()}<button class="icbtn" onclick="go('msgs')" aria-label="messages">${ic('bell')}${Alerts.unread()?'<span class="dot"></span>':''}</button></div></div>`}
   <div class="row gap6" style="margin-top:16px;flex-wrap:wrap;row-gap:6px;min-width:0"><span class="sm muted" style="flex:none">${greet()} · </span>${nmP(me.name)===userTitle(me)?'':`<b class="sm one" style="flex:none;max-width:40%">${esc(nmP(me.name))}</b>`}<span class="badge ${ROLES[r].c}" style="flex:none;max-width:100%">${esc(userTitle(me))}</span><span class="xs muted one">${esc(whName(me.wh))}</span></div>
   ${can('mgmt')?setupBox():''}${!DB.all('products').length&&r!=='gm'?startBox():''}
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
/* ===== 企业沟通：全公司群 + 自建群 + 私聊（只有成员能收到），消息自动翻译成每个人手机的语言 ===== */
const CH_ALL='C_all';
const meId=()=>S.me&&S.me.id;
function chList(){const me=meId();const l=DB.all('chat').filter(c=>!c.mem||c.mem.includes(me));if(!l.some(c=>c.id===CH_ALL))l.unshift({id:CH_ALL,type:'all',mem:null,t:0});return l}
function chGet(id){return id===CH_ALL?(DB.get('chat',CH_ALL)||{id:CH_ALL,type:'all',mem:null,t:0}):DB.get('chat',id)}
function chName(c){if(!c)return '';if(c.type==='all')return (nm((DB.get('settings','app')||{}).co)||L('全公司','Company'))+L(' · 全员群',' · everyone');
  if(c.type==='dm'){const o=(c.mem||[]).find(x=>x!==meId())||meId();return userName(o)}return nm(c.n)||L('群聊','Group')}
function chMsgs(id){return DB.all('msg').filter(m=>m.ch===id).sort((a,b)=>a.t-b.t)}
const chRead=()=>LS.get('rd_'+meId(),{});
function chUnreadOf(id){const r=chRead()[id]||0;return DB.all('msg').filter(m=>m.ch===id&&m.by!==meId()&&m.t>r&&!m.rc).length}
function chatUnread(){if(!S.me)return 0;return chList().reduce((a,c)=>a+chUnreadOf(c.id),0)}
function chMarkRead(id){const r=chRead();const last=chMsgs(id).slice(-1)[0];r[id]=Math.max(r[id]||0,last?last.t:Date.now());LS.set('rd_'+meId(),r);if(document.visibilityState==='visible'&&S.view==='chat_room'){const rid='rd_'+meId()+'_'+id,old=DB.get('read',rid);if(last&&(!old||old.lastT<last.t))DB.put('read',{id:rid,ch:id,userId:meId(),lastT:last.t,readAt:Date.now()},{quiet:true})}updateUnreadBadge()}
function chMemNames(c){return c.mem?c.mem.map(u=>userName(u)).join('、'):L('全体同事','Everyone')}
const avatar=(uid,sz=36)=>{const u=DB.get('users',uid)||(S.me?.id===uid?S.me:{}),profile=DB.get('profile',uid)||{},n=nmP(u.name)||'?';return `<div class="av" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz*.4)}px;flex:none;overflow:hidden;background:${ROLE_COLOR[u.role]||'#F2B900'};color:#fff">${profile.photo?`<img src="${esc(profile.photo)}" style="width:100%;height:100%;object-fit:cover" alt="${esc(n)}">`:esc(profile.emoji||n.slice(0,1))}</div>`};
/* 翻译：按阅读者的语言显示译文（缓存，不重复请求） */
const CTRC=new Map(Object.entries(LS.get('ctr',{})));let _trSave=0;
/* 双语：每条消息都显示“原文 + 中文 / 英文”，读者手机若是第三种语言再加一行。发送时翻译一次并保存在消息里，所有人看到同一份译文 */
const gtxT=(text,tl)=>fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='+encodeURIComponent(tl)+'&dt=t&q='+encodeURIComponent(text)).then(r=>r.json()).then(j=>({src:String(j[2]||'').toLowerCase().split('-')[0],out:(j[0]||[]).map(x=>x[0]).join('').trim()}));
const isZh=t=>/[\u4e00-\u9fff]/.test(t);
const messageTranslationJobs=new Map();
async function msgTr(text){const user=meId();if(window.languageTranslate){try{const result=await languageTranslate(text);if(result)return {...result,forUser:user}}catch(e){return {src:'',tr:{},error:String(e.message||e),forUser:user}}}const tr={};let src='';
  try{const e=await Promise.race([gtxT(text,'en'),new Promise((_,j)=>setTimeout(()=>j(Error('Translation timeout')),6000))]);if(meId()!==user)return {src:'',tr:{},forUser:user};src=e.src||(isZh(text)?'zh':'');if(src!=='en')tr.en=e.out;
    if(src!=='zh'){const z=await Promise.race([gtxT(text,'zh-CN'),new Promise((_,j)=>setTimeout(()=>j(Error('Translation timeout')),6000))]);tr.zh=z.out}}catch(e){return {src,tr,error:L('翻译暂未完成，请重试','Translation incomplete; retry'),forUser:user}}
  return {src,tr,forUser:user}}
function applyMessageTranslation(id,text,result){if(result.forUser&&result.forUser!==meId())return false;const m=DB.get('msg',id);if(!m||m.rc||m.voice||(m.text||S.localVoiceText?.[id]?.text)!==text)return false;if(!Object.keys(result.tr||{}).length)return false;
 if(m.by===meId())DB.put('msg',{...m,src:result.src,tr:result.tr});else{S.localVoiceText=S.localVoiceText||{};S.localVoiceText[id]={...(S.localVoiceText[id]||{}),src:result.src,tr:result.tr}}return true}
async function translateMessage(id,text){if(DB.get('msg',id)?.voice)return;const user=meId(),key=user+':'+id;if(messageTranslationJobs.has(key))return messageTranslationJobs.get(key);S.translationBusy=S.translationBusy||{};S.translationErrors=S.translationErrors||{};S.translationBusy[key]=true;delete S.translationErrors[key];
 const work=(async()=>{try{const result=await msgTr(text);if(meId()!==user)return;applyMessageTranslation(id,text,result);if(result.error)S.translationErrors[key]=result.error;return result}catch(e){if(meId()===user)S.translationErrors[key]=L('翻译未完成，请重试','Translation incomplete; retry')}finally{delete S.translationBusy[key];messageTranslationJobs.delete(key);if(meId()===user)chatPaint()}})();messageTranslationJobs.set(key,work);return work}
/* 某条消息在某种语言下的译文：先用消息里保存的，没有就在本机翻译（缓存） */
function trOf(m,lg){if(m.tr&&m.tr[lg])return m.tr[lg];const r=chTr(m.text,lg);return r}
function msgLangs(m){const src=m.src||(isZh(m.text)?'zh':'');const want=['zh','en'];if(S.lang&&!want.includes(S.lang))want.push(S.lang);return want.filter(l=>l!==src)}
function chTr(text,lang){if(!text)return null;const lg=lang||S.lang,key=meId()+'|'+lg+'|'+text;if(CTRC.has(key))return CTRC.get(key);CTRC.set(key,null);languageTranslate(text).then(r=>{if(!r){CTRC.delete(key);return}const value=r.tr?.[lg]||'';CTRC.set(key,value===text?'':value);chatPaint()}).catch(()=>CTRC.delete(key));return null}
V.chat=()=>{const l=chList().map(c=>({c,last:chMsgs(c.id).slice(-1)[0],n:chUnreadOf(c.id)})).sort((a,b)=>(b.c.id===CH_ALL)-(a.c.id===CH_ALL)||((b.last||{}).t||b.c.t||0)-((a.last||{}).t||a.c.t||0));
  const prev=m=>!m?L('还没有消息','No messages yet'):m.rc?L('撤回了一条消息','recalled a message'):(m.by===meId()?'':userName(m.by)+'：')+(m.voice?L('[语音]','[Voice]'):m.img?L('[图片]','[Photo]'):m.loc?L('[位置] ','[Location] ')+esc(m.loc.addr||''):esc(m.text||''));
  const others=DB.all('users').filter(u=>u.id!==meId()&&u.active!==false);
  return `<div class="pad" style="padding-top:16px"><div class="row between"><div class="ptitle">${L('消息','Chat')}</div><div class="row gap6"><button class="pill w" onclick="grpSheet()">${ic('users',16)} ${L('发起群聊','New group')}</button></div></div>
   <div class="box" style="margin-top:12px;padding:4px 16px">${l.map(({c,last,n})=>`<div class="li" onclick="go('chat_room',{ch:'${c.id}'})">${c.type==='dm'?avatar((c.mem||[]).find(x=>x!==meId())||meId(),44):`<div class="av" style="width:44px;height:44px;flex:none;background:${c.type==='all'?'var(--green)':'var(--blue)'};color:#fff">${ic(c.type==='all'?'home':'users',20)}</div>`}
     <div style="flex:1;min-width:0"><div class="row between" style="gap:8px"><b class="sm one">${esc(chName(c))}</b><span class="xs muted" style="flex:none">${last?ftime(last.t):''}</span></div><div class="row between" style="gap:8px"><span class="xs muted one">${prev(last)}</span>${n?`<span class="badge b-red" style="flex:none">${n>99?'99+':n}</span>`:''}</div></div></div>`).join('')}</div>
   <div class="sec-h">${L('同事（点击私聊）','Colleagues (tap to message)')}</div>
   <div class="box" style="margin-top:0;padding:4px 16px">${DEPTS.map(d=>{const us=others.filter(u=>d.roles.includes(u.role));return us.length?`<div class="xs muted b" style="padding:10px 0 2px">${esc(deptName(d))}</div>`+us.map(u=>`<div class="li" onclick="openDm('${u.id}')">${avatar(u.id,36)}<div style="flex:1;min-width:0">${personLine(u)}</div>${ic('chat',18)}</div>`).join(''):''}).join('')||`<div class="sm muted" style="padding:12px 0">${L('还没有同事账号','No colleagues yet')}</div>`}</div></div>`};
const gmap=(lat,lng)=>`https://www.google.com/maps?q=${(+lat).toFixed(6)},${(+lng).toFixed(6)}`;const gmapQ=q=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
const ftime=t=>{const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?pad2(d.getHours())+':'+pad2(d.getMinutes()):(d.getMonth()+1)+'/'+d.getDate()};
function openDm(uid){const id='D_'+[meId(),uid].sort().join('_');if(!DB.get('chat',id))DB.put('chat',{id,type:'dm',mem:[meId(),uid].sort(),t:Date.now()});go('chat_room',{ch:id})}
function grpSheet(id){const c=id?chGet(id):null;S.grp={id:id||null,n:c?{...(c.n||{zh:'',en:''})}:{zh:'',en:''},mem:c?[...c.mem]:[meId()]};const us=DB.all('users').filter(u=>u.active!==false);
  openSheet(`<div class="sh">${id?L('群设置','Group settings'):L('发起群聊','New group')}</div>
   <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('群名称','Group name')}</label><input class="inp" style="background:var(--card)" value="${esc(S.grp.n.zh)}" data-zh2en="#grEn" placeholder="${L('如：销售部、库马西门店','e.g. Sales team')}" oninput="S.grp.n.zh=this.value"></div>
    <div class="fld" style="flex:1;min-width:0"><label>${L('英文名称','English name')}</label><input class="inp" id="grEn" data-auto="1" style="background:var(--card)" value="${esc(S.grp.n.en)}" placeholder="${L('自动生成，可修改','Auto-filled, editable')}" oninput="S.grp.n.en=this.value"></div></div>
   <div class="fld"><label>${L('成员','Members')} <span id="grN" class="muted">${S.grp.mem.length}</span></label><div class="chips wrap" style="margin-bottom:6px">${DEPTS.map(d=>`<span class="chip" onclick="us_dept('${d.id}')">+ ${esc(deptName(d))}</span>`).join('')}</div>
    <div class="box" style="padding:4px 14px;max-height:40vh;overflow:auto">${us.map(u=>`<label class="li" style="cursor:pointer">${avatar(u.id,32)}<span class="sm" style="flex:1">${esc(nmP(u.name))} <span class="xs muted">${esc(userTitle(u))}</span></span><input type="checkbox" class="grc" value="${u.id}" ${S.grp.mem.includes(u.id)?'checked':''} ${u.id===meId()?'disabled':''} onchange="grpMem()" style="width:20px;height:20px;accent-color:#0B7A4B"></label>`).join('')}</div></div>
   <button class="bigbtn" style="width:100%;margin-top:14px" onclick="grpSave()">${id?L('保存','Save'):L('创建群聊','Create group')}</button>
   ${id?`<button class="bigbtn dark" style="width:100%;margin-top:10px" onclick="grpLeave('${id}')">${L('退出群聊','Leave group')}</button>`:''}`)}
function us_dept(d){const dd=DEPTS.find(x=>x.id===d);$$('.grc').forEach(c=>{const u=DB.get('users',c.value);if(u&&dd.roles.includes(u.role))c.checked=true});grpMem()}
function grpMem(){S.grp.mem=[meId(),...$$('.grc').filter(c=>c.checked&&c.value!==meId()).map(c=>c.value)];$('#grN').textContent=S.grp.mem.length}
async function grpSave(){const g=S.grp;if(g.mem.length<2)return toast(L('至少选择 1 位同事','Choose at least one colleague'));if(!g.n.zh.trim()&&!g.n.en.trim())g.n={zh:g.mem.slice(0,3).map(u=>userName(u)).join('、'),en:''};await fillEn(g.n);
  const old=g.id&&chGet(g.id);const d=DB.put('chat',{...(old||{}),id:g.id||undefined,type:'grp',n:g.n,mem:g.mem,owner:(old&&old.owner)||meId(),t:(old&&old.t)||Date.now()});closeSheet(true);if(g.id)render(false);else go('chat_room',{ch:d.id})}
function grpLeave(id){const c=chGet(id);confirmSheet(L('退出群聊？','Leave this group?'),esc(chName(c)),L('退出','Leave'),()=>{DB.put('chat',{...c,mem:c.mem.filter(x=>x!==meId())});closeSheet(true);tab('chat')})}
/* 聊天窗口 */
const EMO='😀 😂 🤣 😊 😍 😘 😎 🤔 😅 😭 😡 👍 👎 👏 🙏 💪 🤝 👌 ✌️ 🎉 🔥 ❤️ 💯 ✅ ❌ ⚠️ 📦 🚚 💰 📈 📉 ⏰ ☎️ 📍 🛵 📱 🔧 🏠 ☕ 🌙'.split(' ');
V.chat_room=()=>{const c=chGet(S.params.ch);if(!c)return hdr(L('消息','Chat'))+emptyBox('chat',L('会话不存在','Chat not found'));chMarkRead(c.id);S.chId=c.id;
  const info=`<button class="icbtn chat-more-button" onclick="chatRoomActions('${esc(c.id)}')" aria-label="${L('聊天设置','Chat options')}">${ic('ellipsis',24)}</button>`;
  return hdr(`${esc(chName(c))}${c.mem&&c.type==='grp'?` <span class="xs muted">(${c.mem.length})</span>`:''}`,info)+`<div class="pad chat-messages-pad"><div id="msgs">${chatMsgsHTML(c)}</div></div>
   <div class="bbar chatbar" style="flex-direction:column;align-items:stretch;gap:8px;padding-top:8px">
    <div id="cReply" style="display:${S.cReply?'flex':'none'}" class="row between xs muted"><span class="one">${S.cReply?L('回复 ','Reply to ')+esc(userName(S.cReply.by))+'：'+esc(S.cReply.text||L('[图片]','[Photo]')):''}</span><a onclick="S.cReply=null;$('#cReply').style.display='none'">✕</a></div>
    <div id="cEmo" style="display:none;flex-wrap:wrap;gap:4px;max-height:150px;overflow:auto">${EMO.map(e=>`<span style="font-size:24px;padding:4px;cursor:pointer" onclick="chIns('${e}')">${e}</span>`).join('')}</div>
    <div class="row" style="gap:6px;align-items:flex-end">
     <button class="icbtn" id="cMic" style="flex:none;width:42px;height:42px" onclick="vMode(!S.cVoice)" aria-label="${S.cVoice?L('键盘','Keyboard'):L('语音','Voice')}">${ic(S.cVoice?'keyboard':'volume-2',26)}</button>
     <div id="cTxtRow" style="display:${S.cVoice?'none':'flex'};flex:1;min-width:0"><input id="cIn" type="text" class="inp" autocomplete="off" style="flex:1;min-width:0;height:40px;padding:0 8px;font-size:16px;line-height:40px;text-align:center;box-sizing:border-box;background:var(--card)" placeholder="${L('输入消息','Message')}" value="${esc(S.cDraft||'')}" oninput="S.cDraft=this.value;chAt(this);chBtns()"></div>
     <button id="cVoiceBtn" class="inp" style="display:${S.cVoice?'flex':'none'};flex:1;min-width:0;height:42px;padding:0 12px;align-items:center;justify-content:center;text-align:center;line-height:normal;font-weight:800;background:var(--card);touch-action:none;user-select:none;-webkit-user-select:none" onpointerdown="vStart(event)" onpointermove="vMove(event)" onpointerup="vStop(false)" onpointercancel="vStop(true)" onlostpointercapture="if(VREC)vStop(true)" oncontextmenu="return false">${L('按住说话','Hold to talk')}</button>
     <button class="icbtn" aria-label="${L('表情','Emoji')}" style="flex:none;width:42px;height:42px" onclick="const e=$('#cEmo');e.style.display=e.style.display==='none'?'flex':'none'">${ic('smile',26)}</button>
     <button class="icbtn" id="cPlus" aria-label="${L('附件','Attachments')}" style="flex:none;width:42px;height:42px;display:${(S.cDraft||'').trim()&&!S.cVoice?'none':'flex'}" onclick="chMore()">${ic('circle-plus',26)}</button>
     <button class="icbtn" id="cSend" style="flex:none;width:42px;height:42px;background:var(--green);color:#fff;display:${(S.cDraft||'').trim()&&!S.cVoice?'flex':'none'}" onclick="chSend()">${L('发送','Send')}</button></div></div>`};
let chatMessagePress=null;
function chatMessageHold(id,event){if(event.button&&event.button!==0)return;chatMessageEnd();chatMessagePress={x:event.clientX,y:event.clientY,timer:setTimeout(()=>{chatMessagePress=null;msgMenu(id)},550)}}
function chatMessageMove(event){if(chatMessagePress&&Math.hypot(event.clientX-chatMessagePress.x,event.clientY-chatMessagePress.y)>10)chatMessageEnd()}
function chatMessageEnd(){if(chatMessagePress)clearTimeout(chatMessagePress.timer);chatMessagePress=null}
function chatRoomActions(id){const c=chGet(id);if(!c)return;openSheet(`<div class="sh">${esc(chName(c))}</div><div class="action-stack">${c.type==='grp'?`<button class="bigbtn ghost" onclick="closeSheet(true);grpSheet('${esc(c.id)}')">${L('群聊设置','Group settings')}</button>`:''}<button class="bigbtn ghost" onclick="languageSettings()">${L('文字翻译设置','Text translation')}</button>${id===CH_ALL?'':`<button class="bigbtn ghost" onclick="closeSheet(true);tab('chat');chatHide('${esc(id)}')">${L('隐藏此聊天','Hide this chat')}</button>`}</div>`)}
function chatVoiceWidth(duration){const seconds=Math.max(1,Math.min(60,Number(duration)||1));return Math.round(88+(seconds-1)*2.4)}
function chatMsgsHTML(c){const ms=chMsgs(c.id).slice(-300);let last=0;
  return ms.map(m=>{if(S.localVoiceText&&S.localVoiceText[m.id])m={...m,...S.localVoiceText[m.id]};if(m.voice)m={...m,text:'',tr:{},vt:false};const mine=m.by===meId();let h='';if(m.t-last>5*60e3)h+=`<div class="xs muted" style="text-align:center;margin:14px 0 6px">${fdate(m.t)}</div>`;last=m.t;
    if(m.rc)return h+`<div class="xs muted" style="text-align:center;margin:8px 0">${mine?L('你','You'):esc(userName(m.by))} ${L('撤回了一条消息','recalled a message')}</div>`;
    const trs=m.text?msgLangs(m).map(l=>[l,trOf(m,l)]).filter(x=>x[1]&&x[1]!==m.text):[];const body=(m.reply?`<div class="xs" style="opacity:.7;border-left:3px solid currentColor;padding-left:6px;margin-bottom:4px">${esc(userName(m.reply.by))}：${esc((m.reply.text||L('[图片]','[Photo]')).slice(0,40))}</div>`:'')+
      (m.img?`<img src="${esc(m.thumb||m.img)}" style="max-width:180px;max-height:220px;border-radius:12px;display:block" loading="lazy" onclick="event.stopPropagation();viewImg('${esc(m.img)}')">`:'')+
      (m.voice?`<button type="button" class="chat-audio-button ${mine?'outgoing':'incoming'} ${VPLAY===m.id?'playing':''}" aria-label="${L('播放或暂停原声','Play or pause recording')}" onclick="event.stopPropagation();vPlay('${m.id}')" ><b data-notr>${m.dur||1}″</b>${ic(VPLAY===m.id?'pause':'volume-2',20)}</button>`:'')+
      (m.loc?(()=>{const u=m.loc.url||(m.loc.lat!=null?gmap(m.loc.lat,m.loc.lng):gmapQ(m.loc.addr||''));return `<div onclick="event.stopPropagation();openExt('${esc(u)}')" style="cursor:pointer;min-width:200px"><b>${ic('pin',14)} ${L('位置','Location')}</b><div class="xs" style="margin-top:2px">${esc(m.loc.addr||(m.loc.lat.toFixed(5)+', '+m.loc.lng.toFixed(5)))}</div>
       <div class="xs" style="margin-top:6px;text-decoration:underline;word-break:break-all;opacity:.9">${esc(u)}</div><div class="xs b" style="margin-top:4px">${L('点击用谷歌地图打开','Tap to open in Google Maps')}</div></div>`})():'')+
      (m.text?`<div style="white-space:pre-wrap;word-break:break-word">${esc(m.text).replace(/@(\S+)/g,'<b>@$1</b>')}</div>`:'')+
      trs.map(([l,t])=>`<div style="margin-top:6px;padding-top:6px;border-top:1px dashed ${mine?'rgba(255,255,255,.45)':'var(--line)'};font-size:14px;opacity:.92;white-space:pre-wrap;word-break:break-word"><span style="font-size:10px;font-weight:800;padding:1px 5px;border-radius:5px;margin-right:5px;background:${mine?'rgba(255,255,255,.22)':'var(--soft)'}" data-notr>${l==='zh'?'中':l==='en'?'EN':esc(l.toUpperCase())}</span>${esc(t)} <button class="pill" style="padding:2px 8px" onclick="event.stopPropagation();msgSpeak('${m.id}','${l}')">${ic('play',12)} ${L('朗读','Listen')}</button></div>`).join('')+(m.text&&S.translationBusy?.[meId()+':'+m.id]?`<div class="voice-status">${L('正在翻译…','Translating…')}</div>`:m.text&&S.translationErrors?.[meId()+':'+m.id]?`<div class="voice-status">${L('翻译未完成，原文已保留','Translation incomplete; original retained')}</div><div class="voice-actions"><button class="pill" onclick="event.stopPropagation();msgRetranslate('${m.id}')">${L('重试翻译','Retry translation')}</button></div>`:'');
    return h+`<div class="row chat-message ${mine?'is-mine':''}">${avatar(m.by,40)}<div class="chat-message-content">${mine||c.type==='dm'?'':`<div class="xs muted" style="margin:0 0 2px 4px">${esc(userName(m.by))}</div>`}
      <div class="chat-bubble${m.voice?' chat-voice-bubble':''}" ${m.voice?`style="width:${chatVoiceWidth(m.dur)}px"`:''} role="button" tabindex="0" aria-label="${L('长按打开消息菜单','Hold for message options')}" onpointerdown="chatMessageHold('${m.id}',event)" onpointermove="chatMessageMove(event)" onpointerup="chatMessageEnd()" onpointercancel="chatMessageEnd()" oncontextmenu="event.preventDefault();chatMessageEnd();msgMenu('${m.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();msgMenu('${m.id}')}">${body}</div>${readReceiptHTML(m,c)}</div></div>`}).join('')||`<div class="sm muted" style="text-align:center;margin-top:40px">${L('说点什么吧','Say hello')}</div>`}
function chatPaint(){if(S.view!=='chat_room')return;const box=$('#msgs'),sc=$('#screen');if(!box)return;const c=chGet(S.chId);if(!c)return;
  const atBottom=sc.scrollHeight-sc.scrollTop-sc.clientHeight<120;const html=chatMsgsHTML(c);if(box._chatHTML!==html){box.innerHTML=html;box._chatHTML=html;decorateActions()}chMarkRead(c.id);updateUnreadBadge();if(atBottom)sc.scrollTop=sc.scrollHeight}
function chBtns(){const has=!!(($('#cIn')||{}).value||'').trim();const p=$('#cPlus'),s=$('#cSend');if(p)p.style.display=has?'none':'flex';if(s)s.style.display=has?'flex':'none'}
function chIns(t){const i=$('#cIn');const p=i.selectionStart||i.value.length;i.value=i.value.slice(0,p)+t+i.value.slice(p);S.cDraft=i.value;chBtns();i.focus()}
function chAt(i){const c=chGet(S.chId);if(!c||c.type==='dm'||!i.value.endsWith('@'))return;const us=(c.mem||DB.all('users').map(u=>u.id)).filter(u=>u!==meId());
  openSheet(`<div class="sh">${L('选择要提醒的人','Mention someone')}</div><div class="box" style="padding:4px 14px">${(c.mem?'':`<div class="li" onclick="chAtPick('all')"><div class="av" style="width:32px;height:32px;background:var(--green);color:#fff">@</div><span class="b sm">${L('所有人','Everyone')}</span></div>`)+us.map(u=>`<div class="li" onclick="chAtPick('${u}')">${avatar(u,32)}<span class="sm">${esc(userName(u))}</span></div>`).join('')}</div>`)}
function chAtPick(u){closeSheet(true);const i=$('#cIn');i.value=i.value+(u==='all'?L('所有人','all'):userName(u))+' ';S.cDraft=i.value;S.cAt=[...(S.cAt||[]),u];i.focus()}
function chPost(o,ch=S.chId){const c=chGet(ch);if(!c)return;if(c.id===CH_ALL&&!DB.get('chat',CH_ALL))DB.put('chat',{id:CH_ALL,type:'all',mem:null,t:Date.now()});
  DB.put('msg',{ch:c.id,mem:c.mem||null,t:Date.now(),lg:S.lang,...o});DB.put('chat',{...(DB.get('chat',c.id)||c),lt:Date.now()},{quiet:true});
  S.cReply=null;const r=$('#cReply');if(r)r.style.display='none';chatPaint();const sc=$('#screen');sc.scrollTop=sc.scrollHeight}
function chSend(){const i=$('#cIn');const t=(i.value||'').trim();if(!t)return;const rp=S.cReply?{id:S.cReply.id,by:S.cReply.by,text:(S.cReply.text||'').slice(0,80)}:null;
  const id=uid('ms');chPost({id,text:t,reply:rp,at:S.cAt||[]});i.value='';S.cDraft='';S.cAt=[];i.style.height='42px';chBtns();i.focus();
  translateMessage(id,t)}
function chMore(){openSheet(`<div class="sh">${L('发送','Send')}</div><div class="wtiles" style="margin-top:12px">
   <div class="wtile" style="background:var(--blue)" onclick="closeSheet(true);pickImage2(1280,(u,t)=>chPost({img:u,thumb:t}),false)"><div class="wti">${ic('image')}</div><div class="b">${L('相册图片','Photo')}</div></div>
   <div class="wtile" style="background:var(--green)" onclick="closeSheet(true);pickImage2(1280,(u,t)=>chPost({img:u,thumb:t}),true)"><div class="wti">${ic('camera')}</div><div class="b">${L('拍照','Camera')}</div></div>
   <div class="wtile" style="background:var(--orange)" onclick="closeSheet(true);chLoc()"><div class="wti">${ic('pin')}</div><div class="b">${L('发送位置','Location')}</div></div></div>`)}
async function chLoc(){toast(L('正在获取位置…','Getting location…'),false);try{const p=await getPos({exact:true});const addr=await revGeo(p.lat,p.lng);chPost({loc:{lat:p.lat,lng:p.lng,acc:p.acc,addr,url:gmap(p.lat,p.lng)}})}catch(e){locHelp(e,true)}}
/* 定位不可用时：说明怎么打开定位，也可以手动输入地址（同样发送谷歌地图链接） */
function locHelp(err,manual){const e=typeof err==='string'?locErr('fail'):err||locErr('fail');const k=e.kind||'fail';const n=NX();
  const tips=n?(k==='off'?L('点下面“打开 GPS 开关”，在系统页面里打开“使用位置信息”，然后返回 App。','Tap “Turn on GPS” below, switch on “Use location”, then come back.')
      :k==='denied'?L('点下面“打开定位权限”，进入“权限 → 位置信息”，选“仅在使用中允许”，然后返回 App。','Tap “Allow location” below → Permissions → Location → “Allow only while using the app”, then come back.')
      :L('请到窗边或室外再试；或者先打开 GPS 开关。','Move near a window or outdoors and try again, or turn GPS on.'))
    :isNative()?L('您的安装包是旧版，请卸载后安装最新版（新版会自动申请定位、相机、麦克风权限）。','This is an old app build — please install the latest APK (it asks for location, camera and microphone automatically).')
    :k==='wechat'?L('请点右上角“…”，选“在浏览器打开”，用 Chrome 打开本网址再打卡。','Tap “…” at the top right → “Open in browser”, then use Chrome.')
    :k==='denied'?L('Chrome：点地址栏左边的图标 → 权限 → 位置 → 允许，然后刷新页面。<br>如果没有这个选项：Chrome 右上角“⋮ → 设置 → 网站设置 → 位置”，把本网站改为“允许”。','Chrome: tap the icon left of the address → Permissions → Location → Allow, then reload.<br>Or Chrome ⋮ → Settings → Site settings → Location → allow this site.')
    :L('请打开手机顶部的“位置信息 / GPS”开关，到窗边或室外再试。','Switch on Location / GPS in the quick settings and try again near a window or outdoors.');
  openSheet(`<div class="sh">${L('定位没有成功','Location unavailable')}</div><div class="note-r" style="margin-top:8px">${esc(e.message)}</div>
  <div class="sm" style="margin-top:10px;line-height:1.8">${tips}</div>
  ${n?`<div class="row gap" style="margin-top:12px"><button class="bigbtn ghost" style="flex:1;height:48px" onclick="NX().openLocationSettings()">${ic('pin',16)} ${L('打开 GPS 开关','Turn on GPS')}</button><button class="bigbtn ghost" style="flex:1;height:48px" onclick="NX().openAppSettings()">${ic('cog',16)} ${L('打开定位权限','Allow location')}</button></div>`:''}
  <button class="bigbtn" style="width:100%;margin-top:14px" onclick="closeSheet(true);${manual?'chLoc()':'attRetry()'}">${ic('pin',18)} ${L('已打开，重新定位','Try again')}</button>
  ${manual?'':`<button class="bigbtn ghost" style="width:100%;margin-top:10px;height:48px" onclick="closeSheet(true);attGo(S.attLast||'in',true)">${L('暂时用网络大致位置打卡（会标记）','Use approximate network location (flagged)')}</button>`}
  ${manual?`<div class="fld"><label>${L('或手动输入地址（发送谷歌地图链接）','Or type an address (sends a Google Maps link)')}</label><input class="inp" id="locA" style="background:var(--card)" placeholder="${L('如：Adum, Kumasi','e.g. Adum, Kumasi')}"></div><button class="bigbtn ghost" style="width:100%;margin-top:10px" onclick="const a=$('#locA').value.trim();if(a.length<2)return toast(L('请输入地址','Enter an address'));closeSheet(true);chPost({loc:{addr:a,url:gmapQ(a)}})">${L('发送这个地址','Send this address')}</button>`:''}`)}
function msgMenu(id){const m=DB.get('msg',id);if(!m||m.rc)return;const mine=m.by===meId();const canRc=mine&&Date.now()-m.t<120e3;
  openSheet(`<div class="box" style="padding:4px 16px;margin-top:6px">
   <div class="li" onclick="S.cReply=DB.get('msg','${id}');closeSheet(true);render(false);setTimeout(()=>$('#cIn')&&$('#cIn').focus(),50)">${ic('reply',18)} <span class="sm b">${L('回复','Reply')}</span></div>
   ${m.voice?`<div class="box"><div class="xs muted">${L('系统播放器（兼容苹果网页）','System player (iPhone web compatible)')}</div><audio controls playsinline preload="metadata" src="${esc(m.voice)}" style="width:100%"></audio></div>`:''}
   ${m.text&&!m.voice?`<div class="li" onclick="msgRetranslate('${id}')">${ic('translate',18)} ${L('重新翻译','Retry translation')}</div><div class="li" onclick="msgSpeak('${id}','original')">${ic('play',18)} ${L('朗读原文','Read original')}</div>${msgLangs(m).filter(l=>trOf(m,l)&&trOf(m,l)!==m.text).map(l=>`<div class="li" onclick="msgSpeak('${id}','${l}')">${ic('play',18)} ${L('朗读译文','Read translation')} · ${esc(l.toUpperCase())}</div>`).join('')}`:''}
   ${m.text&&!m.voice?`<div class="li" onclick="copyText(DB.get('msg','${id}').text);closeSheet(true)">${ic('copy',18)} <span class="sm b">${L('复制','Copy')}</span></div>`:''}
   ${m.loc?`<div class="li" onclick="const l=DB.get('msg','${id}').loc;copyText(l.url||(l.lat!=null?gmap(l.lat,l.lng):gmapQ(l.addr||'')));closeSheet(true)">${ic('link',18)} <span class="sm b">${L('复制谷歌地图链接','Copy Google Maps link')}</span></div>`:''}
   ${canRc?`<div class="li" onclick="DB.put('msg',{...DB.get('msg','${id}'),rc:true,text:'',img:'',thumb:'',loc:null,voice:'',tr:null});closeSheet(true);chatPaint()">${ic('ret',18)} <span class="sm b red">${L('撤回（2 分钟内）','Recall (within 2 min)')}</span></div>`:''}</div>`)}
function viewImg(u){openSheet(`<img src="${esc(u)}" style="width:100%;border-radius:14px;margin-top:8px">`)}
/* 定位：浏览器定位 + 反查地址（OpenStreetMap） */
function locErr(kind){const m={denied:L('定位权限没有打开','Location permission is off'),off:L('手机的“位置信息 / GPS”开关是关着的','Phone Location / GPS is switched off'),wechat:L('微信 / 应用内浏览器不支持定位','In-app browsers (WeChat etc.) cannot use location'),fail:L('暂时没有定到位置（室内信号弱）','Could not get a GPS fix (weak signal indoors)')};const e=new Error(m[kind]||m.fail);e.kind=kind;return e}
async function ipPos(){const tryJ=async(u,f)=>{const r=await Promise.race([fetch(u),new Promise((_,j)=>setTimeout(()=>j(0),6000))]);const j=await r.json();return f(j)};
  for(const [u,f] of [['https://ipwho.is/',j=>j&&j.success!==false&&j.latitude?{lat:+j.latitude,lng:+j.longitude,city:j.city}:null],['https://ipapi.co/json/',j=>j&&j.latitude?{lat:+j.latitude,lng:+j.longitude,city:j.city}:null]]){try{const p=await tryJ(u,f);if(p)return {lat:p.lat,lng:p.lng,acc:5000,approx:true}}catch(e){}}return null}
async function getPos(opt={}){const n=NX();let kind='fail';S.locKind='';
  if(n){try{await nativePerms(['location'])}catch(e){}
    try{const r=await n.getLocation({timeout:20000});if(r&&r.lat!=null)return {lat:r.lat,lng:r.lng,acc:Math.round(r.acc||0)}}catch(e){const c=String(e&&(e.code||e.message)||'');kind=/OFF/i.test(c)?'off':/DENIED|PERM/i.test(c)?'denied':'fail'}}
  else if(/MicroMessenger|FBAN|FBAV|Instagram/i.test(navigator.userAgent))kind='wechat';
  if(navigator.geolocation&&(!n||kind==='fail')){const g=o=>new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy||0)}),rej,o));
    try{return await g({enableHighAccuracy:true,timeout:12000,maximumAge:0})}catch(e){if(e&&e.code===1&&kind!=='wechat')kind='denied'}
    if(kind!=='denied')try{return await g({enableHighAccuracy:false,timeout:15000,maximumAge:600000})}catch(e){}}
  S.locKind=kind;if(opt.exact)throw locErr(kind);
  const ip=await ipPos();if(ip){ip.kind=kind;return ip}
  throw locErr(kind)}
async function revGeo(lat,lng){try{const r=await Promise.race([fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=17&accept-language=${S.lang==='zh'?'zh-CN,en':S.lang}&lat=${lat}&lon=${lng}`),new Promise((_,j)=>setTimeout(()=>j(0),6000))]);const j=await r.json();return j.display_name||''}catch(e){return ''}}

/* ===== 语音消息：按住说话、上滑取消（最长 60 秒）。录音同时用手机自带的语音识别转成文字，再自动翻译成中 / 英文 ===== */
let VREC=null,VAUD=null,VPLAY=null;
const vMime=()=>{if(!window.MediaRecorder)return '';for(const m of ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus','audio/ogg'])if(MediaRecorder.isTypeSupported(m))return m;return ''};
const srLang=()=>LS.get('speechInputLanguage','')||({zh:'zh-CN',en:'en-GH',fr:'fr-FR',ar:'ar-EG',pt:'pt-PT',sw:'sw-KE',am:'am-ET',ha:'ha-NG',yo:'yo-NG',ig:'ig-NG',zu:'zu-ZA',af:'af-ZA'})[S.lang]||S.lang||'zh-CN';
async function voiceCaps(){if(!isNative()||!NX())return {};try{return await NX().voiceCapabilities()}catch(e){return {}}}
function voiceRecordingUI(r){const composer=$('#voiceComposeRecord');if(composer)composer.textContent=r?L('结束并核对','Finish & review'):L('开始录音','Start recording');const b=$('#cVoiceTap');if(b)b.textContent=r?.tap?L('结束发送','Stop & send'):L('点击录音','Tap to record');const h=$('#cVoiceBtn');if(h)h.textContent=r?L('正在录音…','Recording…'):L('按住说话','Hold to talk')}
function vTap(ev){if(VREC)return vStop(false);return vStart(ev,{tap:true})}
async function vStart(ev,opt={}){ev.preventDefault();if(VREC)return;if(!opt.tap)try{(ev.currentTarget||ev.target).setPointerCapture(ev.pointerId)}catch(e){}
 const R={starting:true,t0:Date.now(),y0:ev.clientY||0,cancel:false,text:'',ch:S.chId,compose:!!opt.compose,tap:!!opt.tap,user:meId()};VREC=R;
 try{await nativePerms(['microphone']);const caps=await voiceCaps();R.native=!!caps.record;
  if(R.released||meId()!==R.user){if(VREC===R)VREC=null;toast(L('麦克风已准备，请再次按住说话','Microphone ready; hold to talk again'),false);return}
  // Recording owns the microphone. A failing system recognizer must never silence or block the original audio.
  if(R.native){R.live=false;await NX().startVoice({lang:srLang(),transcribe:false})}
  else{const mime=vMime();if(!mime||!navigator.mediaDevices?.getUserMedia)throw Error(L('当前浏览器不支持录音，请使用新版APP或Chrome','Recording unavailable; use the app or Chrome'));
   R.st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});R.mime=mime;R.chunks=[];R.mr=new MediaRecorder(R.st,{mimeType:mime,audioBitsPerSecond:64000});R.mr.ondataavailable=e=>{if(e.data?.size)R.chunks.push(e.data)};R.mr.start(250)}
  R.t0=Date.now();R.starting=false;if(R.released||meId()!==R.user){await vStop(true);return}
  const ov=document.createElement('div');ov.id='vOv';ov.style.cssText='position:fixed;left:50%;top:35%;transform:translate(-50%,-50%);z-index:90;pointer-events:none;background:rgba(0,0,0,.78);color:#fff;border-radius:22px;padding:20px;text-align:center';ov.innerHTML=`🎙️<div id="vT">0″</div><div id="vH">${R.tap?L('点击“结束发送”完成录音','Tap Stop & send to finish'):L('松开发送，上滑取消','Release to send · slide up to cancel')}</div>`;document.body.appendChild(ov);voiceRecordingUI(R);
  R.tm=setInterval(()=>{const t=$('#vT');if(t)t.textContent=Math.floor((Date.now()-R.t0)/1000)+'″';if(Date.now()-R.t0>=60000)vStop(false)},250);
 }catch(e){R.st?.getTracks().forEach(t=>t.stop());if(R.native)try{await NX().stopVoice({cancel:true})}catch(_){}if(VREC===R)VREC=null;voiceRecordingUI(null);toast(L('录音未启动：','Recording did not start: ')+String(e.message||e));if(/permission|denied|权限/i.test(String(e)))micHelp()}}
function vMove(ev){if(!VREC)return;const up=(VREC.y0-(ev.clientY||0))>70;VREC.cancel=up;const o=$('#vOv'),h=$('#vH');if(o)o.style.background=up?'rgba(200,40,40,.85)':'rgba(0,0,0,.78)';if(h)h.textContent=up?L('松开取消','Release to cancel'):L('松开发送，上滑取消','Release to send · slide up to cancel')}
async function vStop(cancel){const R=VREC;if(!R)return;if(R.starting){R.released=true;R.cancel=true;return}R.released=true;VREC=null;clearInterval(R.tm);$('#vOv')?.remove();voiceRecordingUI(null);cancel=cancel||R.cancel;const dur=(Date.now()-R.t0)/1000;
  try{let blob;if(R.native){const result=await NX().stopVoice({cancel:!!cancel||dur<1});if(cancel||dur<1){if(!cancel)toast(L('录音太短，请说话至少1秒','Recording too short; speak for at least 1 second'));return;}blob=await (await fetch(result.data)).blob();R.text=result.text||R.text}
    else{await new Promise((resolve,reject)=>{R.mr.onstop=resolve;R.mr.onerror=reject;R.mr.stop()});R.st.getTracks().forEach(t=>t.stop());if(R.sr)R.sr.stop();if(cancel||dur<1){if(!cancel)toast(L('录音太短，请说话至少1秒','Recording too short; speak for at least 1 second'));return;}if(R.srDone)await Promise.race([R.srDone,new Promise(r=>setTimeout(r,1500))]);blob=new Blob(R.chunks,{type:R.mr.mimeType||R.mime})}
    if(!blob.size)throw new Error(L('录音为空，请重试','Empty recording; try again'));if(meId()!==R.user)return;const id=uid('ms');toast(L('正在发送语音…','Sending voice…'),false);const url=await upVoice(blob);if(meId()!==R.user)return;chPost({id,voice:url,dur:Math.min(60,Math.round(dur))},R.ch);
  }catch(e){toast(L('语音发送失败：','Voice send failed: ')+String(e.message||e))}finally{R.st?.getTracks().forEach(t=>t.stop());try{R.sr?.stop()}catch(e){}}}
// Decode browser recordings into PCM WAV before sharing. Native recordings are standard AAC/M4A.
async function portableVoice(blob){if(!/webm|ogg/.test(blob.type))return blob;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return blob;let ctx;try{ctx=new AC();const decoded=await ctx.decodeAudioData(await blob.arrayBuffer()),offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();const a=await offline.startRendering(),n=a.length,c=a.numberOfChannels,b=new ArrayBuffer(44+n*c*2),v=new DataView(b);const txt=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i))};txt(0,'RIFF');v.setUint32(4,b.byteLength-8,true);txt(8,'WAVE');txt(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,c,true);v.setUint32(24,a.sampleRate,true);v.setUint32(28,a.sampleRate*c*2,true);v.setUint16(32,c*2,true);v.setUint16(34,16,true);txt(36,'data');v.setUint32(40,n*c*2,true);for(let i=0;i<n;i++)for(let j=0;j<c;j++){const x=Math.max(-1,Math.min(1,a.getChannelData(j)[i]));v.setInt16(44+(i*c+j)*2,x<0?x*32768:x*32767,true)}return new Blob([b],{type:'audio/wav'})}catch(e){return blob}finally{if(ctx)await ctx.close()}}
function speechTextReview(text,ch,user=meId()){if(meId()!==user)return;S.speechDraft={text:cleanVoiceTranscript(text),ch,user};openSheet(`<div class="sh">${L('核对文字后翻译','Review text before translation')}</div><div class="note-g">${L('先核对识别文字，再生成译文；确认后仅发送文字。','Review the transcript, generate the translation, then confirm to send text only.')}</div><textarea class="inp" id="spText" rows="4">${esc(S.speechDraft.text)}</textarea><button class="bigbtn" id="spTranslate" onclick="sendSpeechText()">${L('生成译文并核对','Translate & review')}</button>`)}
async function speechTranslate(){const ch=S.chId,user=meId();if(!ch)return toast(L('请先打开聊天，再使用语音输入','Open a chat before using dictation'));if(S.dictating)return;S.dictating=true;try{const caps=await voiceCaps();if(!isNative())return browserSpeechTranslate(ch);if(!caps.recognize)throw Error('UNAVAILABLE');await nativePerms(['microphone']);const r=await NX().recognizeSpeech({lang:srLang()});if(r.cancelled||meId()!==user)return;const text=cleanVoiceTranscript(r.text);if(!text)throw Error('NO_SPEECH');speechTextReview(text,ch,user)}catch(e){if(meId()!==user)return;speechTextReview('',ch,user);toast(L('系统语音输入不可用，请授权系统语音引擎，或用输入法麦克风填写文字后翻译。','System dictation unavailable. Authorize the system speech engine, or use keyboard dictation and translate.'))}finally{S.dictating=false}}
async function sendSpeechText(){const d=S.speechDraft,text=cleanVoiceTranscript($('#spText')?.value);if(!d||!text||d.user!==meId()||d.busy)return;d.busy=true;const button=$('#spTranslate');if(button)button.disabled=true;try{const result=await languageTranslate(text);if(S.speechDraft!==d||d.user!==meId())return;if(!result||result.error)throw Error(result?.error||'Translation unavailable');d.text=text;d.translation=result;openSheet(`<div class="sh">${L('核对原文与译文','Review original & translation')}</div><div class="note-g" style="white-space:pre-wrap">${esc(text)}</div>${Object.entries(result.tr||{}).map(([lang,t])=>`<div class="fld"><label>${esc(lang)}</label><div style="white-space:pre-wrap">${esc(t)}</div></div>`).join('')}<button class="bigbtn" onclick="confirmSpeechText()">${L('确认发送文字','Confirm & send text')}</button><button class="bigbtn ghost" onclick="speechTextReview(S.speechDraft.text,S.speechDraft.ch)">${L('返回修改','Edit text')}</button>`)}catch(e){if(S.speechDraft===d)toast(L('翻译未完成，未发送。请核对网络后重试。','Translation incomplete; nothing sent. Check the network and retry.'))}finally{d.busy=false;if(button)button.disabled=false}}
function confirmSpeechText(){const d=S.speechDraft;if(!d||d.user!==meId()||!d.text||!d.translation||d.busy)return;d.busy=true;chPost({id:uid('ms'),text:d.text,src:d.translation.src,tr:d.translation.tr,vt:true},d.ch);S.speechDraft=null;closeSheet(true)}
async function msgRetranslate(id){const m=DB.get('msg',id);const text=m?.text||S.localVoiceText?.[id]?.text;if(!text||m.rc||m.voice)return;toast(L('正在翻译…','Translating…'),false);const r=await translateMessage(id,text);if(r&&Object.keys(r.tr||{}).length)toast(L('翻译完成','Translation ready'),false);else toast(L('翻译未完成，原文已保留，可稍后重试','Translation incomplete; original retained for retry'))}
async function msgSpeak(id,lang){const m=DB.get('msg',id);if(!m||m.rc)return;const local=S.localVoiceText?.[id],text=lang==='original'?(m.text||local?.text):(local?.tr?.[lang]||trOf(m,lang));if(!text)return toast(L('译文尚未生成，请稍后重试','Translation is not ready; try again'));const l=lang==='original'?(local?.src||m.src||m.lg||'zh'):lang;const tag={zh:'zh-CN',en:'en-US'}[l]||l;
  try{const caps=await voiceCaps();if(caps.speak){await NX().speak({text,lang:tag});return}if(!window.speechSynthesis)throw new Error(L('请更新 APP 以使用朗读','Update the app to enable speech'));speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=tag;u.onerror=()=>toast(L('朗读失败，请检查系统语音包','Speech failed; check system voice packs'));speechSynthesis.speak(u)}catch(e){toast(String(e.message||e))}}
/* 上传语音：云端存到进销存自己的语音空间（jxc-voice），同一段录音只存一份；本机模式直接存在消息里 */
async function upVoice(blob){blob=await portableVoice(blob);const toData=()=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(blob)});if(!DB.cloud)return toData();
  try{const u8=new Uint8Array(await blob.arrayBuffer());if(u8.length>2400000)return toData();const h=await sha1(u8);const type=blob.type||'audio/webm';const ext=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':type.includes('wav')?'wav':'webm';
    const name='a/'+h.slice(0,2)+'/'+h+'.'+ext;const BASE=CFG.supabaseUrl.replace(/\/$/,'');
    for(let a=0;a<3;a++){if(a)await new Promise(z=>setTimeout(z,[0,800,2000][a]));try{const r=await fetch(BASE+'/storage/v1/object/jxc-voice/'+name,{method:'POST',headers:{apikey:CFG.supabaseAnonKey,Authorization:'Bearer '+CFG.supabaseAnonKey,'Content-Type':type==='audio/mp4'?'audio/mp4':type,'x-upsert':'false'},body:blob,signal:AbortSignal.timeout(15000)});
      const t=r.ok?'':await r.text().catch(()=>'');if(r.ok||/Duplicate|already exists/i.test(t))return BASE+'/storage/v1/object/public/jxc-voice/'+name;if(r.status<500&&r.status!==429)break}catch(e){}}}catch(e){}
  return toData()}
async function vPlay(id){const m=DB.get('msg',id);if(!m?.voice)return;if(VAUD&&VPLAY===id){VAUD.pause();VAUD=null;VPLAY=null;chatPaint();return}if(VAUD)VAUD.pause();const a=new Audio();a.preload='auto';a.setAttribute('playsinline','');a.src=m.voice;VAUD=a;VPLAY=id;
  const reset=()=>{if(VAUD===a){VAUD=null;VPLAY=null;chatPaint()}};a.onended=reset;a.onerror=()=>{if(VAUD===a)toast(L('语音无法解码或下载，请检查网络；旧录音可让发送人用新版重发','Cannot decode/download audio; check network or resend old recordings with the updated app'));reset()};try{if(navigator.audioSession)navigator.audioSession.type='playback';noticeCtx?.resume()}catch(e){}const playing=a.play();chatPaint();try{await playing}catch(e){if(VAUD!==a)return;toast(L('播放失败：','Playback failed: ')+String(e.message||e));reset()}}
function vMode(on){S.cVoice=on;const t=$('#cTxtRow'),v=$('#cVoiceBtn'),mb=$('#cMic');if(t)t.style.display=on?'none':'flex';if(v)v.style.display=on?'flex':'none';if(mb){mb.innerHTML=ic(on?'keyboard':'volume-2',26);mb.setAttribute?.('aria-label',on?L('键盘','Keyboard'):L('语音','Voice'))}if(!on){const i=$('#cIn');i&&i.focus()}}

/* ===== 外勤打卡：定位 + 带水印的现场照片（姓名、时间、地址、经纬度）。总经理、销售经理、运营经理可查看，出勤统计报给销售经理 ===== */
const ATT_T={in:['上班打卡','Clock in'],visit:['拜访客户','Customer visit'],out:['下班打卡','Clock out']};
const dayKey=t=>{const d=new Date(t);return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())};
function attTodayDone(){return DB.all('att').some(a=>a.by===meId()&&a.type==='in'&&dayKey(a.t)===dayKey(Date.now()))}
V.att=()=>{const mine=DB.all('att').filter(a=>a.by===meId()).sort((a,b)=>b.t-a.t);const today=mine.filter(a=>dayKey(a.t)===dayKey(Date.now()));
  const hasIn=today.some(a=>a.type==='in'),hasOut=today.some(a=>a.type==='out');const vis=['field','sales'].includes(S.me.role);
  const next=!hasIn?'in':!hasOut?(vis?'visit':'out'):(vis?'visit':'');
  const tabbed=S.me.role==='field'&&!S.hist.length;
  return (tabbed?'':hdr(L('考勤打卡','Check-in')))+`<div class="pad" style="padding-top:${tabbed?16:4}px">${tabbed?`<div class="ptitle">${L('考勤打卡','Check-in')}</div>`:''}
   <div class="box" style="margin-top:12px;text-align:center;padding:22px 16px"><div class="xs muted">${new Date().toLocaleDateString(S.lang==='zh'?'zh-CN':'en-GB',{weekday:'long',month:'long',day:'numeric'})}</div>
    <div style="font-size:40px;font-weight:800;margin:6px 0" id="attClock" data-notr>${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())}</div>
    <div class="row gap" style="justify-content:center;flex-wrap:wrap;margin-top:6px">
     ${(vis?['in','visit','out']:['in','out']).map(k=>{const dis=k==='in'&&hasIn||k==='out'&&(hasOut||!hasIn);return `<button class="bigbtn ${k===next?'':'ghost'}" style="flex:1;min-width:92px;height:50px;font-size:14px;${dis?'opacity:.4':''}" ${dis?'disabled':''} onclick="attGo('${k}')">${ic(k==='visit'?'user':'pin',16)} ${L(ATT_T[k][0],ATT_T[k][1])}</button>`}).join('')}</div>
    <div class="xs muted" style="margin-top:12px;line-height:1.6">${L('打卡时自动定位，并用相机拍一张现场照片，照片上加水印（姓名、时间、地址、经纬度）。董事长、总经理和运营经理能看到所有人的打卡汇总；除董事长外全员须拍照打卡。','Each check-in records your location and a camera photo with a watermark (name, time, address, coordinates). The chairman, GM and operations can see everyone\'s records.')}</div></div>
   <div class="sec-h">${L('我的打卡记录','My check-ins')}</div>${attList(mine.slice(0,60),false)}</div>`};
function attList(l,showName){return `<div class="box" style="margin-top:0;padding:4px 16px">${l.map(a=>`<div class="li" onclick="attView('${a.id}')">${a.thumb||a.photo?`<img src="${esc(a.thumb||a.photo)}" style="width:52px;height:52px;border-radius:12px;object-fit:cover;flex:none" loading="lazy">`:`<div class="qi">${ic('pin',18)}</div>`}
  <div style="flex:1;min-width:0"><div class="b sm one">${showName?esc(userName(a.by))+' · ':''}${L(ATT_T[a.type][0],ATT_T[a.type][1])}${a.cus?' · '+esc(ptName(a.cus)):''}</div><div class="xs muted one">${fdate(a.t)}</div><div class="xs muted one">${a.approx?`<span class="red b">${L('大致位置','Approx.')}</span> · `:''}${esc(a.addr||(a.lat?a.lat.toFixed(5)+', '+a.lng.toFixed(5):L('未定位','No location')))}</div></div></div>`).join('')||`<div class="sm muted" style="padding:12px 0">${L('还没有打卡记录','No check-ins yet')}</div>`}</div>`}
function attView(id){const a=DB.get('att',id);openSheet(`<div class="sh">${L(ATT_T[a.type][0],ATT_T[a.type][1])}</div><div class="sm muted">${esc(userName(a.by))} · ${fdate(a.t)}</div>
  ${a.photo?`<img src="${esc(a.photo)}" style="width:100%;border-radius:14px;margin-top:12px">`:''}
  <div class="kv" style="margin-top:12px"><div style="grid-column:1/3"><div class="l">${L('地址','Address')}</div><div class="v">${esc(a.addr||'—')}</div></div><div><div class="l">${L('经纬度','Coordinates')}</div><div class="v" data-notr>${a.lat?a.lat.toFixed(5)+', '+a.lng.toFixed(5):'—'}</div></div><div><div class="l">${L('精度','Accuracy')}</div><div class="v" data-notr>${a.acc?a.acc+' m':'—'}</div></div>
  ${a.cus?`<div><div class="l">${L('客户','Customer')}</div><div class="v">${esc(ptName(a.cus))}</div></div>`:''}${a.note?`<div style="grid-column:1/3"><div class="l">${L('备注','Note')}</div><div class="v">${esc(a.note)}</div></div>`:''}</div>
  ${a.lat?`<div class="xs muted" style="margin-top:10px;word-break:break-all">${esc(gmap(a.lat,a.lng))}</div><div class="row gap" style="margin-top:10px"><button class="bigbtn ghost" style="flex:1" onclick="copyText('${gmap(a.lat,a.lng)}')">${ic('copy',16)} ${L('复制地图链接','Copy map link')}</button><button class="bigbtn" style="flex:1" onclick="openExt('${gmap(a.lat,a.lng)}')">${ic('pin',16)} ${L('谷歌地图','Google Maps')}</button></div>`:''}`)}
/* 打卡：先定位，再拍照（加水印），可选客户与备注 */
function attRetry(){attGo(S.attLast||'in')}
async function attGo(type,approx){if(!own('att'))return toast(L('董事长无需打卡','The chairman is exempt from check-in'));S.attLast=type;toast(L('正在定位…','Getting location…'),false);let p;
  if(approx){p=await ipPos();if(!p)return toast(L('网络定位也失败了，请检查网络','Network location failed too — check the connection'))}
  else try{p=await getPos({exact:true})}catch(e){return locHelp(e,false)}
  const addr=await revGeo(p.lat,p.lng);S.att={type,...p,addr,photo:'',thumb:'',cus:'',note:''};attSheet()}
function attSheet(){const a=S.att;openSheet(`<div class="sh">${L(ATT_T[a.type][0],ATT_T[a.type][1])}</div>
  <div class="${a.approx?'note-r':'note-g'}" style="margin-top:8px">${ic('pin',14)} ${esc(a.addr||(a.lat.toFixed(5)+', '+a.lng.toFixed(5)))} <span class="xs muted" data-notr>±${a.acc}m</span>${a.approx?`<div class="xs" style="margin-top:4px">${S.locKind==='denied'?L('定位权限没有允许','Location permission is off'):S.locKind==='off'?L('GPS 开关没有打开','GPS is switched off'):L('GPS 暂时没有信号','No GPS signal yet')}${L('，这是网络大致位置（误差较大，会标记在打卡记录里）。',' — this is an approximate network location (flagged on the record).')} <a onclick="locHelp(locErr(S.locKind||'fail'),false)" style="text-decoration:underline">${L('打开精确定位','Fix GPS')}</a></div>`:''}</div>
  <div class="ph" id="attPh" style="width:100%;height:200px;margin-top:12px;border-radius:16px" onclick="attPhoto()">${a.photo?`<img src="${esc(a.thumb||a.photo)}" style="width:100%;height:100%;object-fit:cover;border-radius:16px">`:`<div style="text-align:center">${ic('camera',28)}<div class="sm b" style="margin-top:6px">${L('打开相机拍现场照片（必拍，自动加水印）','Open the camera — site photo (required, watermarked)')}</div></div>`}</div>
  ${a.type==='visit'?`<div class="fld"><label>${L('拜访客户','Customer visited')}</label>${partnerSel('cus',a.cus,"S.att.cus=this.value")}</div>`:''}
  <div class="fld"><label>${L('备注（可选）','Note (optional)')}</label><input class="inp" style="background:var(--card)" value="${esc(a.note)}" oninput="S.att.note=this.value"></div>
  <button class="bigbtn" style="width:100%;margin-top:14px" onclick="attSave()">${ic('check',18)} ${L('确认打卡','Check in')}</button>`)}
function attPhoto(){if(!own('att')||!S.att)return;const a=S.att;
  camShot(async f=>{S.photoBusy=true;try{toast(L('正在处理照片…','Processing photo…'),false);
    const lines=[`${nmP(S.me.name)} · ${userTitle(S.me)}`,new Date().toLocaleString(),a.addr||'',`${Number(a.lat||0).toFixed(5)}, ${Number(a.lng||0).toFixed(5)}`];
    const [big,small]=await Promise.all([wmImg(f,960,lines),wmImg(f,200,[])]);
    a.photo=big;a.thumb=small;S.att=a;LS.set('attDraft_'+meId(),a);attSheet();
    const [u,t]=await Promise.all([upImg(big),upImg(small)]);a.photo=u;a.thumb=t;LS.set('attDraft_'+meId(),a);
    if(S.att===a&&sheetOn())attSheet();
  }catch(e){S.att=a;attSheet();toast(L('照片处理失败，请重试：','Photo processing failed: ')+String(e.message||e))}finally{S.photoBusy=false}},()=>attSheet())}
/* 应用内相机：直接打开摄像头拍照（不用选相册）；手机不支持时退回系统相机 */
function camFallback(cb){const i=document.createElement('input');i.type='file';i.accept='image/*';i.capture='environment';i.onchange=()=>{const f=i.files[0];if(f)cb(f)};i.click()}
async function camShot(cb,back){const caps=await voiceCaps();if(caps.camera&&isNative()){try{await nativePerms(['camera']);const photo=await NX().capturePhoto();if(photo.cancelled){back&&back();return}await cb(await (await fetch(photo.data)).blob());return}catch(e){toast(String(e.message||e));back&&back();return}}if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return camFallback(cb);
  let st;try{await nativePerms(['camera']);st=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false})}catch(e){return camFallback(cb)}
  const ov=document.createElement('div');ov.id='camOv';ov.style.cssText='position:fixed;inset:0;z-index:95;background:#000;display:flex;flex-direction:column';
  ov.innerHTML=`<video id="camV" autoplay playsinline muted style="flex:1;width:100%;object-fit:cover;min-height:0"></video>
   <div style="display:flex;align-items:center;justify-content:space-around;padding:18px 0 calc(22px + env(safe-area-inset-bottom));background:#000">
    <button id="camX" style="color:#fff;font-size:15px;font-weight:700;width:80px">${L('取消','Cancel')}</button>
    <button id="camS" aria-label="shutter" style="width:74px;height:74px;border-radius:50%;background:#fff;border:5px solid #9a9a9a"></button>
    <button id="camF" style="color:#fff;font-size:15px;font-weight:700;width:80px">${L('翻转','Flip')}</button></div>`;
  document.body.appendChild(ov);const v=$('#camV');v.srcObject=st;let face='environment';
  const stop=()=>{st.getTracks().forEach(t=>t.stop());ov.remove()};
  $('#camX').onclick=()=>{stop();back&&back()};
  $('#camF').onclick=async()=>{face=face==='environment'?'user':'environment';st.getTracks().forEach(t=>t.stop());try{st=await navigator.mediaDevices.getUserMedia({video:{facingMode:face},audio:false});v.srcObject=st}catch(e){}};
  $('#camS').onclick=()=>{const w=v.videoWidth,h=v.videoHeight;if(!w)return;const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(v,0,0,w,h);
    cv.toBlob(b=>{stop();if(b)cb(b)},'image/jpeg',.9)}}
/* 水印：照片底部半透明黑条 + 白字（姓名职位、时间、地址、经纬度） */
function wmImg(f,max,lines){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);
  const x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);if(lines.length){const fs=Math.max(14,Math.round(c.width/34)),lh=fs*1.35;const wrap=[];x.font=`600 ${fs}px sans-serif`;
    lines.forEach(t=>{let cur='';for(const ch of t){if(x.measureText(cur+ch).width>c.width-fs*2){wrap.push(cur);cur=ch}else cur+=ch}wrap.push(cur)});
    const h=wrap.length*lh+fs*1.2;x.fillStyle='rgba(0,0,0,.55)';x.fillRect(0,c.height-h,c.width,h);x.fillStyle='#fff';x.textBaseline='top';wrap.forEach((t,i)=>x.fillText(t,fs,c.height-h+fs*.6+i*lh));
    x.fillStyle='#F2B705';x.fillRect(0,c.height-h,Math.max(6,fs/3),h)}
  res(c.toDataURL('image/jpeg',.82))};im.onerror=()=>rej(new Error('Photo decode failed'));im.src=r.result};r.onerror=()=>rej(new Error('Photo read failed'));r.readAsDataURL(f)})}
function attSave(){if(!own('att'))return;const a=S.att;if(S.photoBusy)return toast(L('照片处理中，请稍候','Photo processing; please wait'));if(!a.photo)return toast(L('请先拍现场照片','Take the site photo first'));if(a.type==='visit'&&!a.cus&&!a.note)return toast(L('请选择客户或填写备注','Choose a customer or add a note'));
  DB.put('att',{type:a.type,t:Date.now(),lat:a.lat,lng:a.lng,acc:a.acc,approx:!!a.approx,addr:a.addr,photo:a.photo,thumb:a.thumb,cus:a.cus||'',note:a.note||'',wh:S.me.wh});closeSheet(true);LS.del('attDraft_'+meId());toast(L('打卡已保存，正在同步','Check-in saved; syncing'),false);render(false)}
/* 考勤统计：按人、按月；出勤天数、首次 / 末次打卡、拜访次数；点人看明细 */
V.att_stats=()=>{const m=S.attM||dayKey(Date.now()).slice(0,7);const [y,mo]=m.split('-').map(Number);const from=new Date(y,mo-1,1).getTime(),to=new Date(y,mo,1).getTime();
  const rs=DB.all('att').filter(a=>a.t>=from&&a.t<to);const staff=DB.all('users').filter(u=>u.active!==false&&own('att',u)&&(S.me.role!=='sales'||['sales','field'].includes(u.role))).sort((x,y)=>Object.keys(ROLES).indexOf(x.role)-Object.keys(ROLES).indexOf(y.role));
  const ws=+((DB.get('settings','app')||{}).workStart??8.5);
  const row=u=>{const l=rs.filter(a=>a.by===u.id);const days=[...new Set(l.filter(a=>a.type==='in').map(a=>dayKey(a.t)))];const late=days.filter(d=>{const f=l.filter(a=>a.type==='in'&&dayKey(a.t)===d).sort((a,b)=>a.t-b.t)[0];const h=new Date(f.t);return !leaveSlots(u.id,d).am&&h.getHours()+h.getMinutes()/60>ws}).length;
    return {u,days:days.length,late,visit:l.filter(a=>a.type==='visit').length,out:new Set(l.filter(a=>a.type==='out').map(a=>dayKey(a.t))).size,last:l.sort((a,b)=>b.t-a.t)[0]}};
  const data=staff.map(row);const sel=S.attU;
  return hdr(L('考勤统计','Attendance'),`<button class="icbtn" onclick="exportAtt('${m}')">${ic('download')}</button>`)+`<div class="pad">
   <div class="row gap" style="margin-top:6px"><button class="icbtn" onclick="S.attM=attShift('${m}',-1);render(false)">${ic('back')}</button><b style="flex:1;text-align:center" data-notr>${m}</b><button class="icbtn" style="transform:scaleX(-1)" onclick="S.attM=attShift('${m}',1);render(false)">${ic('back')}</button></div>
   <div class="xs muted" style="margin-top:6px">${L(`上班时间 ${workTime(ws)}，下班时间 17:00；晚于上班时间为迟到`,`Work ${workTime(ws)}–17:00; clock-ins after start are late`)}</div>
   <div class="box" style="padding:4px 16px">${data.map(d=>`<div class="li" onclick="S.attU=S.attU==='${d.u.id}'?null:'${d.u.id}';render(false)">${avatar(d.u.id,38)}<div style="flex:1;min-width:0">${personLine(d.u)}
     <div class="xs muted">${L('出勤','Days')} <b>${d.days}</b> · ${L('批准请假','Approved leave')} <b>${leaveMonthDays(d.u.id,m)}</b> · ${L('迟到','Late')} <b class="${d.late?'red':''}">${d.late}</b> · ${L('拜访','Visits')} <b>${d.visit}</b> · ${L('下班打卡','Clock-outs')} <b>${d.out}</b></div>${d.last?`<div class="xs muted one">${L('最近：','Latest: ')}${fdate(d.last.t)} · ${esc(d.last.addr||'')}</div>`:''}</div>${ic('chev',14)}</div>`).join('')||`<div class="sm muted" style="padding:12px 0">${L('还没有需要打卡的人员','No staff to show')}</div>`}</div>
   ${sel?`<div class="sec-h">${esc(userName(sel))} · ${L('打卡明细','Records')}</div>${attList(rs.filter(a=>a.by===sel).sort((a,b)=>b.t-a.t),false)}${leaveAttendanceHTML(sel,m)}`:`<div class="sec-h">${L('本月全部打卡','All check-ins this month')}</div>${attList(rs.sort((a,b)=>b.t-a.t).slice(0,80),true)}`}</div>`};
const attShift=(m,d)=>{const [y,mo]=m.split('-').map(Number);const x=new Date(y,mo-1+d,1);return x.getFullYear()+'-'+pad2(x.getMonth()+1)};
function exportAtt(m){const [y,mo]=m.split('-').map(Number);const from=new Date(y,mo-1,1).getTime(),to=new Date(y,mo,1).getTime();
  const rows=[[L('姓名','Name'),L('职位','Position'),L('类型','Type'),L('时间','Time'),L('客户','Customer'),L('地址','Address'),L('纬度','Lat'),L('经度','Lng'),L('备注','Note')]];
  DB.all('att').filter(a=>a.t>=from&&a.t<to).sort((a,b)=>a.t-b.t).forEach(a=>{const u=DB.get('users',a.by)||{};rows.push([nmP(u.name),userTitle(u),L(ATT_T[a.type][0],ATT_T[a.type][1]),fdate(a.t),a.cus?ptName(a.cus):'',a.addr||'',a.lat||'',a.lng||'',a.note||''])});
  DB.all('leave').filter(l=>l.status==='approved'&&!l._q&&l.startDate<=m+'-31'&&l.endDate>=m+'-01').forEach(l=>{const u=DB.get('users',l.by)||{};rows.push([nmP(u.name),userTitle(u),L('已批准请假','Approved leave'),l.startDate+' — '+l.endDate,'','','','',l.days+' '+L('天','days')+'; '+l.reason])});
  downloadFile(`attendance_${m}.csv`,csv(rows))}

/* ===== 费用报销：办公费、外勤报销、杂费。普通费用：提交 → 会计入账 → 出纳付款；特殊费用（超过限额或标为特殊）：先由总经理或运营经理审批，再报备财务 ===== */
const EXP_C={office:['办公用品','Office supplies'],rent:['房租水电','Rent & utilities'],travel:['交通差旅','Travel & transport'],meal:['餐饮招待','Meals & hospitality'],comm:['通讯网络','Phone & internet'],
  field:['外勤报销','Field claims'],freight:['运费物流','Freight & logistics'],clear:['清关报关','Customs & clearance'],repair:['维修保养','Repairs'],staff:['工资福利','Staff costs'],other:['其他','Other']};
const EXP_ST={gm_pending:['待总经理审批','GM review','b-gold'],submitted:['待运营经理审批','Operations review','b-gold'],approved:['已审批，待入账','Approved, to book','b-blue'],booked:['已入账，待付款','Booked, to pay','b-blue'],paid:['已付款','Paid','b-green'],rejected:['已驳回','Rejected','b-red'],void:['已撤回','Withdrawn','b-grey']};
const expLimit=d=>d?.id?+(d.approvalLimit??2000):+(DB.get('settings','app')?.expLimit??2000);
const expName=k=>L((EXP_C[k]||EXP_C.other)[0],(EXP_C[k]||EXP_C.other)[1]);
/* 当前用户在这笔费用上能做什么 */
function expAct(e){const r=S.me.role;
  if(e.status==='submitted'&&['chair','ops'].includes(r))return 'approve';
  if(e.status==='gm_pending'&&['chair','gm'].includes(r)&&e.op)return 'gm';
  if(e.status==='approved'&&e.op&&(+e.amt<=expLimit(e)||e.gm)&&own('exp_book'))return 'book';
  if(e.status==='booked'&&e.op&&(+e.amt<=expLimit(e)||e.gm)&&own('fin_pay'))return 'pay';return ''}
function expTodo(){if(!S.me)return 0;return DB.all('exp').filter(e=>expAct(e)).length+DB.all('exp').filter(e=>e.by===S.me.id&&e.status==='rejected'&&!e.seen).length}
const expSeeAll=()=>can('exp_approve')||own('exp_book')||own('fin_pay');
V.exp=()=>{const seg=S.expSeg||(expTodo()?'todo':'mine');const all=DB.all('exp').sort((a,b)=>b.t-a.t);
  const l=seg==='todo'?all.filter(e=>expAct(e)):seg==='all'?all:all.filter(e=>e.by===S.me.id);const mon=+new Date(new Date().getFullYear(),new Date().getMonth(),1);
  const mineM=all.filter(e=>e.by===S.me.id&&e.t>=mon&&!['rejected','void'].includes(e.status)).reduce((a,e)=>a+(+e.amt||0),0);
  return hdr(L('费用报销','Expenses'),expSeeAll()?`<button class="icbtn" onclick="go('exp_stats')">${ic('chart')}</button>`:'')+`<div class="pad">
   <button class="bigbtn" style="width:100%;margin-top:6px" onclick="expNew()">${ic('plus',18)} ${L('新增费用 / 报销','New expense / claim')}</button>
   <div class="xs muted" style="margin-top:8px;line-height:1.6">${L(`每笔费用：提交 → 运营经理审批 → 会计入账 → 出纳付款；单笔超过 ${money(expLimit())}，运营经理审批后还需总经理审批。`,`Every expense: submit → operations → accountant → cashier. Over ${money(expLimit())}: GM approval is also required after operations.`)}</div>
   <div class="seg" style="margin-top:12px">${[['mine',L('我的','Mine')],...(expSeeAll()||expTodo()?[['todo',L('待我处理','To do')+(expTodo()?` (${expTodo()})`:'')]]:[]),...(expSeeAll()?[['all',L('全部','All')]]:[])].map(([k,t])=>`<button class="${seg===k?'on':''}" onclick="S.expSeg='${k}';render(false)">${t}</button>`).join('')}</div>
   ${seg==='mine'?`<div class="xs muted" style="margin:8px 2px">${L('本月我的费用','My expenses this month')} <b data-notr>${money(mineM)}</b></div>`:''}
   <div style="margin-top:8px">${l.slice(0,120).map(e=>`<div class="box" style="margin-top:8px;padding:12px 14px;cursor:pointer" onclick="expView('${e.id}')"><div class="row between" style="gap:8px"><div style="min-width:0"><div class="b sm one">${expName(e.cat)}${e.special?` <span class="badge b-red" style="padding:1px 7px">${L('特殊','Special')}</span>`:''}</div><div class="xs muted one">${esc(userName(e.by))} · ${fdate(e.t)}${e.note?' · '+esc(e.note):''}</div></div>
     <div style="text-align:right;flex:none"><b data-notr>${money(e.amt)}</b><div>${stB(EXP_ST,e.status)}</div></div></div></div>`).join('')||emptyBox('receipt',L('暂无费用记录','No expenses'))}</div></div>`};
function expNew(){S.ex={cat:S.me.role==='field'?'field':'office',amt:'',note:'',photo:'',thumb:'',special:false,so:''};expForm()}
/* 运费 / 清关类费用：关联“我方承担运费”的销售单，报表按实际报销金额计运费、不重复计入运营费用；
   采购单附加费用已进商品到岸成本，应由会计对采购单发起付款申请，不在这里报销 */
function expFreightBox(e){if(!['freight','clear'].includes(e.cat))return '';
  const warn=`<div class="note-y" style="margin-top:8px">${L('采购进货的运费、清关费如果已填在采购单的“附加费用”里，就已经计入商品成本，请由会计对采购单发起付款申请，不要在这里再报销，否则成本会重复计算。','If inbound freight or clearance is already on a purchase order as an extra cost, it is in the landed cost. Ask the accountant to raise a payment request on that PO instead of claiming it here, or the cost is counted twice.')}</div>`;
  if(e.cat!=='freight')return warn;
  const l=DB.all('so').filter(s=>s.frt&&s.frt.payer==='us'&&['approved','shipped','done'].includes(s.status)).sort((a,b)=>b.t-a.t).slice(0,60);
  return `<div class="fld"><label>${L('关联销售单（我方承担运费的送货）','Linked sales order (delivery freight we pay)')}</label><select class="inp" style="background:var(--card)" onchange="S.ex.so=this.value"><option value="">${L('不关联','None')}</option>${l.map(s=>`<option value="${s.id}" ${e.so===s.id?'selected':''}>${esc(s.no)} · ${esc(ptName(s.cus))} · ${L('单上运费','freight on order')} ${money(s.frt.amt)}</option>`).join('')}</select>
   <div class="xs muted" style="margin-top:4px">${L('关联后，利润报表按这笔实际报销金额计算该单运费，不会重复计入运营费用。','Once linked, the report uses this claim as the actual freight for that order and does not count it again as an expense.')}</div></div>${warn}`}
function expForm(){const e=S.ex;openSheet(`<div class="sh">${L('新增费用 / 报销','New expense / claim')}</div>
  <div class="fld"><label>${L('类别','Category')}</label><div class="chips wrap" id="exC">${Object.keys(EXP_C).map(k=>`<span class="chip ${e.cat===k?'on':''}" onclick="S.ex.cat='${k}';expForm()">${expName(k)}</span>`).join('')}</div></div>
  ${expFreightBox(e)}
  <div class="fld"><label>${L('金额','Amount')} (${esc(CUR())} ${baseIso()})</label><input class="inp" type="number" inputmode="decimal" style="background:var(--card);font-size:20px;font-weight:800" value="${e.amt}" oninput="S.ex.amt=this.value;$('#exS').style.display=(+this.value>expLimit())?'':'none'"><div class="xs red" id="exS" style="display:${+e.amt>expLimit(e)?'':'none'};margin-top:4px">${L(`超过 ${money(expLimit())}，运营经理审批后，还需要总经理审批`,`Over ${money(expLimit())}: operations then GM approval`)}</div></div>
  <div class="fld"><label>${L('用途说明（必填）','What for (required)')}</label><input class="inp" style="background:var(--card)" value="${esc(e.note)}" placeholder="${L('如：拜访库马西客户打车费','e.g. taxi to a customer in Kumasi')}" oninput="S.ex.note=this.value"></div>
  <div class="row gap" style="margin-top:12px;align-items:center"><div class="ph" id="exPh" onclick="pickImage2(1280,(u,t)=>{S.ex.photo=u;S.ex.thumb=t;$('#exPh').innerHTML='<img src=&quot;'+t+'&quot;>'},true)">${e.thumb?`<img src="${esc(e.thumb)}">`:ic('camera')}</div><span class="sm muted">${L('拍发票 / 收据（建议）','Photo of the receipt (recommended)')}</span></div>
  <label class="row gap" style="margin-top:12px"><input type="checkbox" ${e.special?'checked':''} onchange="S.ex.special=this.checked" style="width:20px;height:20px;accent-color:#0B7A4B"><span class="sm b">${L('标记为特殊费用（每笔仍须运营经理审批）','Special expense (operations review required)')}</span></label>
  <button class="bigbtn" style="width:100%;margin-top:16px" onclick="expSave()">${L('提交','Submit')}</button>`)}
function expSave(){const e=S.ex;const amt=+e.amt;if(!(amt>0))return toast(L('请填写金额','Enter the amount'));if((e.note||'').trim().length<2)return toast(L('请填写用途说明','Say what it was for'));
  const sp=!!e.special||amt>expLimit();const so=e.cat==='freight'&&e.so&&DB.get('so',e.so)?e.so:undefined;
  DB.put('exp',{cat:e.cat,amt:Math.round(amt*100)/100,note:e.note.trim(),photo:e.photo,thumb:e.thumb,special:sp,so,status:'submitted',t:Date.now()});
  closeSheet(true);toast(L('已提交，等待运营经理审批','Submitted — waiting for operations approval'),false);S.expSeg='mine';render(false)}
function expView(id){const e=DB.get('exp',id);if(e.by===S.me.id&&e.status==='rejected'&&!e.seen)DB.put('exp',{...e,seen:true},{quiet:true});const act=expAct(e);
  const line=(t,o)=>o?`<div class="xs muted" style="margin-top:4px">${ic('check',12)} ${t}：${esc(userName(o.by))} · ${fdate(o.t)}${o.note?' · '+esc(o.note):''}${o.ref?' · '+esc(o.ref):''}</div>`:'';
  openSheet(`<div class="row between"><div class="sh">${expName(e.cat)}</div>${stB(EXP_ST,e.status)}</div><div class="sm muted">${esc(userName(e.by))} · ${fdate(e.t)}</div>
   <div style="font-size:30px;font-weight:800;margin-top:8px" data-notr>${moneyBase(e.amt)}</div>${e.special?`<span class="badge b-red">${L('特殊费用','Special expense')}</span>`:''}
   <div class="sm" style="margin-top:8px">${esc(e.note)}</div>${e.so&&DB.get('so',e.so)?`<div class="xs muted" style="margin-top:4px">${L('关联销售单','Linked order')}：<span data-notr>${esc(DB.get('so',e.so).no)}</span></div>`:''}${e.photo?`<img src="${esc(e.photo)}" style="width:100%;border-radius:14px;margin-top:10px" onclick="viewImg('${esc(e.photo)}')">`:''}
   <div style="margin-top:8px">${line(L('运营经理审批','Operations approval'),e.op)}${line(L('总经理审批','GM approval'),e.gm)}${line(L('入账','Booked'),e.bk)}${line(L('付款','Paid'),e.pd)}${e.rj?`<div class="note-r" style="margin-top:8px">${L('驳回：','Rejected: ')}${esc(e.rj.note||'')} · ${esc(userName(e.rj.by))}</div>`:''}</div>
   ${act?`<div class="fld"><label>${act==='pay'?L('付款方式与凭证号','Method & reference'):L('意见（驳回时必填）','Comment (required to reject)')}</label>
    ${act==='pay'?`<div class="chips wrap">${Object.keys(PM).map((k,i)=>`<span class="chip ${i?'':'on'}" data-m="${k}" onclick="pmPick(this,'#exN',true)">${pmName(k)}</span>`).join('')}</div>`:''}
    <input class="inp" id="exN" style="background:var(--card);margin-top:${act==='pay'?8:0}px" placeholder="${act==='pay'?refLabel('cash')+L('（必填）',' (required)'):''}"></div>
    <div class="row gap" style="margin-top:12px">${act!=='pay'?`<button class="bigbtn dark" style="flex:1" onclick="expDo('${id}',false)">${L('驳回','Reject')}</button>`:''}<button class="bigbtn" style="flex:1" onclick="expDo('${id}',true)">${ic('check',18)} ${act==='approve'&&e.amt>expLimit(e)?L('运营通过，提交总经理','Operations OK → GM'):act==='approve'||act==='gm'?L('批准，报备财务','Approve → finance'):act==='book'?L('入账，交出纳付款','Book → cashier'):L('确认已付款','Confirm paid')}</button></div>`:''}
   ${e.by===S.me.id&&e.status==='submitted'?`<button class="bigbtn ghost" style="width:100%;margin-top:10px" onclick="DB.put('exp',{...DB.get('exp','${id}'),status:'void'});closeSheet(true);render(false)">${L('撤回','Withdraw')}</button>`:''}`)}
function expDo(id,ok){const e=DB.get('exp',id);const act=expAct(e);if(!act)return toast(L('这笔已处理','Already handled'));const n=($('#exN').value||'').trim();const o={by:S.me.id,t:Date.now(),note:n};
  if(!ok){if(n.length<2)return toast(L('请填写驳回原因','Give a reason'));DB.put('exp',{...e,status:'rejected',rj:o,seen:false})}
  else if(act==='approve')DB.put('exp',{...e,status:e.amt>expLimit(e)?'gm_pending':'approved',op:o});
  else if(act==='gm')DB.put('exp',{...e,status:'approved',gm:o});
  else if(act==='book')DB.put('exp',{...e,status:'booked',bk:o,bt:Date.now()});
  else{const m=($('#sheet .chip.on')||{dataset:{}}).dataset.m||'cash';if(n.length<2)return toast(L('请填写','Enter the ')+refLabel(m));DB.put('exp',{...e,status:'paid',accountId:S.moneyAccount,pd:{...o,ref:n,method:m}})}
  closeSheet(true);toast(L('已处理','Done'),false);render(false)}
/* 费用统计：按月、按类别、按人员，方便核算运营成本 */
V.exp_stats=()=>{const m=S.exM||dayKey(Date.now()).slice(0,7);const [y,mo]=m.split('-').map(Number);const from=new Date(y,mo-1,1).getTime(),to=new Date(y,mo,1).getTime();
  const l=DB.all('exp').filter(e=>e.t>=from&&e.t<to&&!['rejected','void'].includes(e.status));const tot=l.reduce((a,e)=>a+(+e.amt||0),0);
  const byC=Object.keys(EXP_C).map(k=>({k,v:l.filter(e=>e.cat===k).reduce((a,e)=>a+(+e.amt||0),0)})).filter(x=>x.v).sort((a,b)=>b.v-a.v);const mx=Math.max(1,...byC.map(x=>x.v));
  const byU=[...new Set(l.map(e=>e.by))].map(u=>({u,v:l.filter(e=>e.by===u).reduce((a,e)=>a+(+e.amt||0),0),n:l.filter(e=>e.by===u).length})).sort((a,b)=>b.v-a.v);
  const paid=l.filter(e=>e.status==='paid').reduce((a,e)=>a+(+e.amt||0),0),pend=tot-paid,sp=l.filter(e=>e.special).reduce((a,e)=>a+(+e.amt||0),0);
  return hdr(L('费用统计','Expense statistics'),`<button class="icbtn" onclick="exportExp('${m}')">${ic('download')}</button>`)+`<div class="pad">
   <div class="row gap" style="margin-top:6px"><button class="icbtn" onclick="S.exM=attShift('${m}',-1);render(false)">${ic('back')}</button><b style="flex:1;text-align:center" data-notr>${m}</b><button class="icbtn" style="transform:scaleX(-1)" onclick="S.exM=attShift('${m}',1);render(false)">${ic('back')}</button></div>
   <div class="stats">${statT('g',numK(tot),L('本月费用合计','Total this month'))}${statT('',numK(paid),L('已付款','Paid'))}${statT('y',numK(pend),L('未付款（审核中 / 待付）','Not yet paid'))}</div>
   <div class="xs muted" style="margin-top:6px">${L('金额单位','in')} <span data-notr>${esc(CUR())}</span> · ${L('其中特殊费用','special')} <b data-notr>${money(sp)}</b></div>
   <div class="box"><h4>${L('按类别','By category')}</h4>${byC.map(x=>`<div style="margin-top:8px"><div class="row between sm"><span>${expName(x.k)}</span><b data-notr>${money(x.v)}</b></div><div style="height:8px;background:var(--soft);border-radius:6px;margin-top:4px"><div style="height:8px;border-radius:6px;background:var(--green);width:${x.v/mx*100}%"></div></div></div>`).join('')||`<div class="sm muted">${L('本月没有费用','No expenses this month')}</div>`}</div>
   <div class="box"><h4>${L('按人员','By person')}</h4>${byU.map(x=>`<div class="li" style="cursor:default">${avatar(x.u,32)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(userName(x.u))}</div><div class="xs muted">${x.n} ${L('笔','item(s)')}</div></div><b data-notr>${money(x.v)}</b></div>`).join('')||`<div class="sm muted">—</div>`}</div></div>`};
function exportExp(m){const [y,mo]=m.split('-').map(Number);const from=new Date(y,mo-1,1).getTime(),to=new Date(y,mo,1).getTime();
  const rows=[[L('日期','Date'),L('人员','Person'),L('类别','Category'),L('金额','Amount'),L('说明','Note'),L('特殊','Special'),L('状态','Status'),L('审批','Approved by'),L('入账','Booked by'),L('付款','Paid by')]];
  DB.all('exp').filter(e=>e.t>=from&&e.t<to).sort((a,b)=>a.t-b.t).forEach(e=>rows.push([fdate(e.t),userName(e.by),expName(e.cat),e.amt,e.note,e.special?'✓':'',L(EXP_ST[e.status][0],EXP_ST[e.status][1]),e.ap?userName(e.ap.by):'',e.bk?userName(e.bk.by):'',e.pd?userName(e.pd.by):'']));
  downloadFile(`expenses_${m}.csv`,csv(rows))}

/* ===== 单据打印：销售单 / 出库单 / 入库单（A4，中英双语表头，含签字栏）。电脑直接打印；手机上可“打印 / 存为 PDF”或下载后打印 ===== */
function printHTML(kind,id){const co=(DB.get('settings','app')||{}).co||{};const coName=nm(co)||BRAND();let title,no,date,rows,meta,foot,sign,showPrice=true;
  const P=pid=>P_(pid);const B=(zh,en)=>`${zh}<br><small>${en}</small>`;
  if(kind==='so'||kind==='out'){const d=DB.get('so',id);no=d.no;date=d.st&&kind==='out'?d.st:d.t;
    title=kind==='so'?B('销售单','SALES ORDER'):B('出库单','DELIVERY NOTE');showPrice=kind==='so';
    meta=[[B('客户','Customer'),ptName(d.cus)],[B('出货门店','Store'),whName(d.wh)],[B('业务员','Sales rep'),userName(d.by)],[B('付款方式','Terms'),d.pay==='credit'?'赊账 / Credit':'现款 / Cash'],...(nm(d.addr)?[[B('送货地址','Deliver to'),nm(d.addr)]]:[])];
    const mv=kind==='out'?DB.all('moves').filter(m=>m.ref===d.id&&m.type==='so_out'):[];
    rows=d.items.map(it=>{const p=P(it.pid);const bt=mv.filter(m=>m.pid===it.pid&&m.batch).map(m=>m.batch).join(', ');return [p.code||'',nm(p.n)+(bt?` <small>(${bt})</small>`:''),unit(p),n2(kind==='out'?(it.shipped||it.qty):it.qty),showPrice?fmtN(it.price,2):'',showPrice?fmtN(lineTotal(it),2):'']});
    foot=showPrice?[[B('商品金额','Goods'),fmtN(itemsTotal(d),2)],...(d.frt&&d.frt.amt?[[B('运费','Freight')+(d.frt.payer==='cus'?'':' <small>(我方承担 / paid by us)</small>'),d.frt.payer==='cus'?fmtN(d.frt.amt,2):'0.00']]:[]),[B('合计','TOTAL')+` (${baseIso()})`,fmtN(docTotal(d),2)]]:[];
    sign=kind==='so'?[B('制单','Prepared by'),B('财务审核','Finance'),B('客户确认','Customer')]:[B('仓库发货','Warehouse'),B('送货人','Delivered by'),B('客户签收','Received by')]}
  else if(kind==='grn'){const g=DB.get('grn',id);const po=DB.get('po',g.po)||{items:[]};no=g.no;date=g.t;title=B('入库单','GOODS RECEIVED NOTE');const k=landK(po);
    meta=[[B('供应商','Supplier'),ptName(po.sup)],[B('采购单','PO'),po.no||''],[B('入库仓库','Store'),whName(g.wh)],[B('收货人','Received by'),userName(g.by)]];
    rows=g.items.map(it=>{const p=P(it.pid);const pi=po.items.find(x=>x.pid===it.pid)||{};const uc=(+pi.price||0)*k;return [p.code||'',nm(p.n)+(it.batch?` <small>(${it.batch}${it.exp?' · '+it.exp:''})</small>`:''),unit(p),n2(it.qty),fmtN(uc,2),fmtN(uc*it.qty,2)]});
    const tot=g.items.reduce((a,it)=>{const pi=po.items.find(x=>x.pid===it.pid)||{};return a+(+pi.price||0)*k*it.qty},0);
    foot=[[B('到岸成本合计','Landed cost total')+` (${baseIso()})`,fmtN(tot,2)]];sign=[B('仓库收货','Warehouse'),B('采购','Purchasing'),B('财务','Finance')]}
  const css=`body{font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",Arial,sans-serif;color:#111;margin:0;padding:28px 32px;font-size:13px}h1{font-size:22px;margin:0;text-align:center;line-height:1.2}h1 small{font-size:12px;letter-spacing:3px;color:#555}
   .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0B7A4B;padding-bottom:10px;margin-bottom:14px}.co{font-size:16px;font-weight:800}.no{text-align:right;font-size:12px}.no b{font-size:15px}
   table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #444;padding:6px 7px;text-align:left;vertical-align:top}th{background:#EEF5F0;font-size:12px;line-height:1.25}th small,td small{color:#555;font-weight:400}
   .meta td:nth-child(odd){width:16%;background:#FAFAF7;font-weight:700;font-size:12px}.num{text-align:right;white-space:nowrap}.foot td{font-weight:700}.sign{display:flex;gap:18px;margin-top:36px}.sign div{flex:1;border-top:1px solid #333;padding-top:6px;font-size:12px;text-align:center}
   .pf{margin-top:18px;font-size:11px;color:#666;text-align:center}@media print{body{padding:10mm}@page{size:A4;margin:8mm}}`;
  const metaRows=[];for(let i=0;i<meta.length;i+=2)metaRows.push(`<tr><td>${meta[i][0]}</td><td>${esc(meta[i][1])}</td>${meta[i+1]?`<td>${meta[i+1][0]}</td><td>${esc(meta[i+1][1])}</td>`:'<td></td><td></td>'}</tr>`);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(no)}</title><style>${css}</style></head><body>
   <div class="top"><div class="co">${esc(coName)}</div><h1>${title}</h1><div class="no">${'No.'} <b>${esc(no)}</b><br>${new Date(date).toLocaleString('zh-CN')}</div></div>
   <table class="meta">${metaRows.join('')}</table>
   <table><tr><th>#</th><th>${B('编码','Code')}</th><th>${B('品名','Item')}</th><th>${B('单位','Unit')}</th><th class="num">${B('数量','Qty')}</th>${showPrice?`<th class="num">${B(kind==='grn'?'到岸单价':'单价',kind==='grn'?'Landed cost':'Price')}</th><th class="num">${B('金额','Amount')}</th>`:''}</tr>
    ${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])}</td><td>${r[1]}</td><td>${esc(r[2])}</td><td class="num">${r[3]}</td>${showPrice?`<td class="num">${r[4]}</td><td class="num">${r[5]}</td>`:''}</tr>`).join('')}
    ${foot.map(f=>`<tr class="foot"><td colspan="${showPrice?6:4}" class="num">${f[0]}</td><td class="num">${f[1]}</td></tr>`).join('')}</table>
   <div class="sign">${sign.map(s=>`<div>${s}</div>`).join('')}</div><div class="pf">${esc(BRAND())} · ${new Date().toLocaleString('zh-CN')}</div></body></html>`}
function printDoc(kind,id){const h=printHTML(kind,id);const no=(h.match(/<title>(.*?)<\/title>/)||[])[1]||'doc';
  openSheet(`<div class="sh">${L('打印单据','Print document')}</div><div class="sm muted" data-notr>${esc(no)}</div>
   <iframe id="pvF" style="width:100%;height:52vh;border:1px solid var(--line);border-radius:12px;margin-top:10px;background:#fff"></iframe>
   <div class="row gap" style="margin-top:12px"><button class="bigbtn ghost" style="flex:1" onclick="downloadFile('${esc(no)}.html',window._pvH,'text/html;charset=utf-8')">${ic('download',18)} ${L('下载','Download')}</button><button class="bigbtn" style="flex:1" onclick="pvPrint()">${ic('print',18)} ${L('打印 / 存为 PDF','Print / save PDF')}</button></div>
   <div class="xs muted" style="margin-top:10px;line-height:1.6">${L('手机和打印机连同一个 WiFi，点“打印”后系统会自动搜索并列出网络打印机，选中即可打印（第一次选好后会记住）。','Keep the phone and printer on the same WiFi. Tap Print and the system finds network printers automatically; pick one (it is remembered).')} <a style="text-decoration:underline" onclick="go('printers')">${L('打印机设置','Printer setup')}</a></div>`);
  window._pvH=h;setTimeout(()=>{const f=$('#pvF');if(f)f.srcdoc=h},60)}
function pvPrint(){const n=NX();if(n&&n.printHtml){n.printHtml({html:window._pvH,name:((window._pvH.match(/<title>(.*?)<\/title>/)||[])[1]||'document')}).catch(e=>toast(String(e&&e.message||e)));return}
  if(isNative())return toast(L('旧版安装包不支持打印，请安装最新版','This app build cannot print — install the latest APK'));
  const f=$('#pvF');try{if(f&&f.contentWindow&&f.contentWindow.print){f.contentWindow.focus();f.contentWindow.print();return}}catch(e){}
  const w=window.open('','_blank');if(w){w.document.write(window._pvH);w.document.close();setTimeout(()=>w.print(),400)}else downloadFile('document.html',window._pvH,'text/html;charset=utf-8')}

/* ===== 工作台：本职位能用的全部功能（底部导航只放 5 个） ===== */
V.work=()=>{const t=[];const b=n=>n?`<span class="badge b-red" style="position:absolute;top:10px;right:10px">${n}</span>`:'';
  const T=(cond,bg,icon,title,sub,fn,n)=>{if(cond)t.push(`<div class="wtile" style="background:${bg};position:relative" onclick="${fn}"><div class="wti">${ic(icon)}</div><div style="min-width:0"><div class="b">${title}</div><div class="wsub">${sub}</div></div>${b(n)}</div>`)};
  T(can('_docs'),'var(--blue)','doc',L('单据','Orders'),L('采购 · 销售 · 入库 · 出库 · 盘点','Purchase · sales · in · out · counts'),"tab('docs')",todoCount());
  T(can('stock'),'var(--green)','box',L('库存','Stock'),L('商品 · 分类 · 库存数量','Items · categories · quantities'),"tab('stock')");
  T(can('fin'),'var(--purple)','calc',L('财务','Finance'),L('应收 · 应付 · 资金日记账','Receivables · payables · cash book'),"tab('fin')",finTodo());
  T(true,'#C0532B','receipt',L('费用报销','Expenses'),L('办公费 · 外勤报销 · 杂费','Office · field claims · sundries'),"go('exp')",expTodo());
  T(own('att'),'#0E7C86','pin',L('考勤打卡','Check-in'),L('定位 · 现场拍照 · 水印','Location · camera photo · watermark'),S.me.role==='field'?"tab('att')":"go('att')",attTodayDone()?0:'!');
  T(can('att_view'),'#3D4A5C','clock',L('考勤统计','Attendance'),S.me.role==='sales'?L('销售部出勤与打卡记录','Sales team attendance'):L('全员出勤与打卡记录','Everyone\'s attendance & records'),"go('att_stats')");
  T(can('logi'),'var(--orange)','truck',L('物流跟踪','Logistics'),L('在途 · 签收 · 异常','In transit · delivered · issues'),"tab('logi')",DB.all('ships').filter(s=>s.status==='exception').length);
  T(can('logi'),'#2367B0','calc',L('运费计算器','Freight calculator'),L('运费 + 清关费 + 其他费用','Freight + clearance + other'),"go('logi_svc')");
  T(can('report'),'#7B4FA0','chart',L('报表','Reports'),L('销售 · 成本 · 运营费用','Sales · costs · operating expenses'),"go('report')");
  T(can('_pt'),'#5C6B2E','user',L('客户与供应商','Customers & suppliers'),L('新增 · 修改 · 删除','Add · edit · delete'),"go('m_partners')");
  T(can('mgmt'),'#161616','gear',L('后台管理','Management'),L('账号 · 门店 · 设置','Accounts · stores · settings'),"tab('mgmt')");
  return `<div class="pad" style="padding-top:16px"><div class="ptitle">${L('工作台','Work')}</div><div class="wtiles" style="margin-top:14px">${t.join('')}</div></div>`};
/* 空白开始：没有商品时的引导 */
function startBox(){const cp=canProd();return `<div class="box" style="margin-top:14px;text-align:center;padding:26px 18px"><div style="font-size:40px">📦</div><div class="b" style="font-size:18px;margin-top:6px">${L('还没有商品','No items yet')}</div>
  <div class="sm muted" style="margin-top:6px;line-height:1.7">${cp?L('先建好商品分类（如：摩托车、配件、手机），再添加商品，可同时录入现有库存数量。','Set up categories (e.g. motorcycles, parts, phones), then add items with the quantity you have now.'):L('请采购主管或总经理先添加商品。','Ask purchasing or the GM to add items first.')}</div>
  ${cp?`<button class="bigbtn" style="width:100%;margin-top:16px" onclick="prodEdit()">${ic('plus',18)} ${L('添加第一个商品','Add your first item')}</button>
  <div class="row gap" style="margin-top:10px"><button class="bigbtn ghost" style="flex:1;height:46px;font-size:14px" onclick="catSheet()">${ic('box',16)} ${L('商品分类','Categories')}</button><button class="bigbtn ghost" style="flex:1;height:46px;font-size:14px" onclick="prodImport()">${ic('upload',16)} ${L('批量导入','Bulk import')}</button></div>`:''}</div>`}
/* 总经理：开始使用清单（全部完成后自动隐藏） */
function setupBox(){const s=DB.get('settings','app')||{};const done=LS.get('setupDone',0);
  const steps=[[!!(s.co&&(s.co.zh||s.co.en)),L('填写公司名称与结算货币','Company name & currency'),"go('m_settings')"],
   [allWh().some(w=>w.n&&(w.n.zh||w.n.en)&&nm(w.n)!=='总店'&&nm(w.n)!=='Main store'),L('设置门店名称','Name your store'),"go('m_stores')"],
   [catList().length>0,L('建立商品分类（如：摩托车、手机）','Create categories (e.g. motorcycles, phones)'),"catSheet()"],
   [DB.all('products').length>0,L('添加商品并录入现有库存','Add items with current stock'),"prodEdit()"],
   [DB.all('partners').some(p=>p.type==='sup'),L('添加供应商','Add suppliers'),"go('m_partners',{t:'sup'})"],
   [DB.all('partners').some(p=>p.type==='cus'),L('添加客户','Add customers'),"go('m_partners',{t:'cus'})"],
   [DB.all('users').some(u=>u.role!=='gm'&&u.name&&nmP(u.name)!==roleName(u.role))||LS.get('setupUsers',0),L('设置各部门人员姓名与密码','Set staff names & passwords'),"LS.set('setupUsers',1);go('m_users')"]];
  const n=steps.filter(x=>x[0]).length;if(done||n===steps.length)return '';
  return `<div class="box" style="margin-top:14px;border:2px solid var(--green)"><div class="row between"><b style="font-size:17px">${L('开始使用','Get started')}</b><span class="badge b-green">${n} / ${steps.length}</span></div>
   <div class="xs muted" style="margin-top:4px">${L('按顺序完成这几步，就可以正式开单了','Finish these steps and you are ready to go')}</div>
   ${steps.map((x,i)=>`<div class="li" onclick="${x[2]}"><span style="width:26px;height:26px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;${x[0]?'background:var(--green);color:#fff':'background:var(--soft);color:var(--ink)'}">${x[0]?'✓':i+1}</span><span class="sm ${x[0]?'muted':'b'}" style="flex:1;${x[0]?'text-decoration:line-through':''}">${x[1]}</span>${x[0]?'':ic('chev',14)}</div>`).join('')}
   <div style="text-align:right;margin-top:6px"><a class="xs muted" style="cursor:pointer" onclick="LS.set('setupDone',1);render(false)">${L('不再显示','Hide')}</a></div></div>`}
function deptBoard(F,x){const card=(role,lines,fn)=>`<div class="box dcard ${role==='sales'?'dk':''}" style="--dc:${ROLE_COLOR[role]}" onclick="${fn}"><div class="row between"><b class="dtt one">${roleName(role)}</b>${ic('chev',14)}</div>${lines.map(l=>`<div class="row between" style="margin-top:7px;gap:6px"><span class="xs one dl">${l[0]}</span><b class="sm ${l[2]?'dwarn':''}" data-notr style="white-space:nowrap">${l[1]}</b></div>`).join('')}</div>`;
  const mon=+new Date(new Date().getFullYear(),new Date().getMonth(),1);const poM=DB.all('po').filter(p=>p.t>=mon&&p.status!=='draft'&&p.status!=='cancel').reduce((a,p)=>a+docTotal(p),0);
  return `<div class="sec-h"><span>${L('各部门进展','Department progress')} <span class="xs muted" style="font-weight:600">${L('金额单位','in')} <span data-notr>${esc(CUR())}</span></span></span><a onclick="go('report')">${L('报表','Reports')} ›</a></div><div class="dgrid">
   ${card('buyer',[[L('本月采购额','Purchases, month'),numK(poM)],[L('在途采购单','Open POs'),x.toRecv],[L('库存不足','Low stock'),x.low,x.low?'red':'']],"S.docSeg='po';S.docF='all';tab('docs')")}
   ${card('sales',[[L('今日出库货值','Goods shipped today'),numK(x.sales)],[L('待出库','To ship'),x.toShip],[L('销售草稿','Drafts'),DB.all('so').filter(s=>s.status==='draft').length]],"S.docSeg='so';S.docF='all';tab('docs')")}
   ${card('keeper',[[L('待入库 / 待出库','To receive / ship'),x.toRecv+' / '+x.toShip],[L('待审盘点','Counts to review'),x.tk,x.tk?'red':''],[L('物流异常','Exceptions'),x.exc,x.exc?'red':'']],"tab('stock')")}
   ${card('acct',[[L('应收余额','Receivable'),numK(F.arBal)],[L('应付余额','Payable'),numK(F.apBal)],[L('待核对收款','To verify'),F.unverN,F.unverN?'red':'']],"S.finSeg='ar';tab('fin')")}
   ${card('cashier',[[L('今日收款','Received today'),numK(F.rcvToday)],[L('待付款','To pay'),F.apprN,F.apprN?'red':''],[L('资金余额','Cash balance'),numK(F.cash)]],"S.finSeg='book';tab('fin')")}
  </div>`}
function mvRow(m){const p=P_(m.pid);return `<div class="li" onclick="go('product',{id:'${m.pid}'})"><span class="badge ${(MV[m.type]||[0,0,'b-grey'])[2]}" style="min-width:64px;justify-content:center">${mvName(m.type)}</span>
  <div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted one">${esc(whName(m.wh))} · ${fdate(m.t)}</div></div><b class="${m.qty<0?'red':'green'}" data-notr>${m.qty>0?'+':''}${n2(m.qty)}</b></div>`}

/* ================= 库存 ================= */
S.stF='all';S.stW='all';S.stQ='';S.stC='all';
V.stock=()=>{const sm=stockMap();const q=S.stQ.trim().toLowerCase();const W=S.stW;
  let list=DB.all('products').map(p=>{const qty=W==='all'?qtyOf(p.id):qtyOf(p.id,W);return {p,qty,s:stStatus(p,qty)}});
  const cnt={all:list.length,ok:0,low:0,over:0};list.forEach(x=>{if(x.s==='ok')cnt.ok++;else if(x.s==='over')cnt.over++;else cnt.low++});
  if(q)list=list.filter(({p})=>[p.n.zh,p.n.en,p.code,p.bar,nm(p.cat)].join(' ').toLowerCase().includes(q));
  if(S.stF!=='all')list=list.filter(x=>S.stF==='low'?(x.s==='low'||x.s==='out'):x.s===S.stF);
  const cats=catList(),unc=DB.all('products').some(p=>!catKey(p.cat));if(S.stC!=='all')list=list.filter(({p})=>S.stC==='_'?!catKey(p.cat):catKey(p.cat)===S.stC);
  if(!DB.all('products').length)return `<div class="pad" style="padding-top:16px"><div class="ptitle">${L('库存','Stock')}</div>${startBox()}</div>`;
  const val=list.reduce((a,x)=>a+x.qty*(can('cost')?avgCost(x.p.id):x.p.price),0);
  return `<div class="pad" style="padding-top:16px"><div class="row between"><div class="ptitle">${L('库存','Stock')}</div><div class="row" style="gap:8px">${canProd()?`<button class="pill g" onclick="prodEdit()">${ic('plus',16)} ${L('商品','Item')}</button>`:''}${can('take')?`<button class="pill w" onclick="go('take')">${ic('clip',16)} ${L('盘点','Count')}</button>`:''}</div></div>
   <div class="searchbar">${ic('search')}<input id="stQ" placeholder="${L('商品名称 / 编码 / 条码','Name / code / barcode')}" value="${esc(S.stQ)}" oninput="S.stQ=this.value;clearTimeout(window._sq);window._sq=setTimeout(()=>{render(false);const i=$('#stQ');i.focus();i.setSelectionRange(i.value.length,i.value.length)},300)"><button class="scan" onclick="scanLookup()" aria-label="scan">${ic('scan',18)}</button></div>
   <div class="chips">${[['all',L('全部门店','All stores')]].concat(activeWh().map(w=>[w.id,nm(w.n)])).map(([k,t])=>`<span class="chip ${S.stW===k?'on':''}" onclick="S.stW='${k}';render(false)">${esc(t)}</span>`).join('')}</div>
   <div class="chips" style="margin-top:8px">${[['all',L('全部分类','All categories')],...cats.map(c=>[c.k,nm(c.n)]),...(unc?[['_',L('未分类','Uncategorised')]]:[])].map(([k,t])=>`<span class="chip ${S.stC===k?'on':''}" onclick="S.stC='${esc(k)}';render(false)">${esc(t)}</span>`).join('')}<span class="chip" style="border:1.5px dashed var(--muted);background:transparent" onclick="catSheet()">${ic('edit',13)} ${L('分类','Categories')}</span></div>
   <div class="seg">${[['all',L('全部','All'),cnt.all],['ok',L('正常','Normal'),cnt.ok],['low',L('不足','Low'),cnt.low],['over',L('积压','Overstock'),cnt.over]].map(([k,t,n])=>`<button class="${S.stF===k?'on':''}" onclick="S.stF='${k}';render(false)">${t} ${n}</button>`).join('')}</div>
   <div class="row between sm muted" style="margin:10px 2px"><span>${list.length} ${L('种商品','items')}</span><span>${can('cost')?L('库存成本','Stock cost'):L('库存货值','Stock value')} <b style="color:var(--ink)" data-notr>${can('cost')&&DB.all('moves').some(m=>m.uc==null||m.costFixed===false)?L('待核对','Pending reconciliation'):money(val)}</b></span></div>
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
  return hdr(L('库存详情','Item details'),canProd()?`<button class="icbtn" onclick="prodEdit('${p.id}')">${ic('edit')}</button>`:'')+`<div class="pad">
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
function pickProduct(cb,wh){const listH=q=>{q=(q||'').toLowerCase();return DB.all('products').filter(p=>!q||[p.n.zh,p.n.en,p.code,p.bar].join(' ').toLowerCase().includes(q)).map(p=>`<div class="li" onclick="closeSheet();(${cb})('${p.id}')">${thumb(p,40)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted one"><span data-notr>${esc(p.code)}</span> · ${L('库存','Qty')} ${n2(wh?qtyOf(p.id,wh):qtyOf(p.id))} ${esc(unit(p))}</div></div><span class="b sm" data-notr>${n2(p.price)}</span></div>`).join('')||(DB.all('products').length?emptyBox('search',L('没有找到','Nothing found')):`<div style="text-align:center;padding:18px 0"><div class="sm muted">${L('还没有商品','No items yet')}</div>${canProd()?`<button class="bigbtn" style="width:100%;margin-top:12px" onclick="prodEdit()">${ic('plus',18)} ${L('添加商品','Add an item')}</button>`:`<div class="xs muted" style="margin-top:6px">${L('请采购主管或总经理先添加商品','Ask purchasing or the GM to add items first')}</div>`}</div>`)};
  window._ppL=listH;openSheet(`<div class="sh">${L('选择商品','Choose item')}</div><div class="searchbar">${ic('search')}<input id="ppQ" placeholder="${L('名称 / 编码 / 条码','Name / code / barcode')}" oninput="$('#ppList').innerHTML=_ppL(this.value)"><button class="scan" onclick="openScan(L('扫码添加','Scan to add'),c=>{const p=findByCode(c);if(!p){toast(L('未找到商品：','Not found: ')+c);return false}(${cb})(p.id)})">${ic('scan',18)}</button></div><div id="ppList" style="margin-top:6px">${listH('')}</div>`)}
function partnerSel(type,val,onch){const l=DB.all('partners').filter(p=>p.type===type&&(!p.del||p.id===val));return `<select class="inp" onchange="${onch}">${!val?`<option value="">${L('请选择','Please choose')}</option>`:''}${l.map(p=>`<option value="${p.id}" ${p.id===val?'selected':''}>${esc(nmP(p.n))}</option>`).join('')}</select>`}
function whSel(val,onch){return `<select class="inp" onchange="${onch}">${activeWh().map(w=>`<option value="${w.id}" ${w.id===val?'selected':''}>${esc(nm(w.n))}</option>`).join('')}</select>`}
function newPartner(type,after){S._npAfter=after;openSheet(`<div class="sh">${type==='cus'?L('新增客户','New customer'):L('新增供应商','New supplier')}</div>
  <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('中文名称','Name (Chinese)')}</label><input class="inp" id="npN" data-zh2en="#npE"></div><div class="fld" style="flex:1;min-width:0"><label>${L('英文名称','Name (English)')}</label><input class="inp" id="npE" data-auto="1" placeholder="${L('自动生成，可修改','Auto-filled, editable')}"></div></div>
  <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('电话','Phone')}</label><input class="inp" id="npP" inputmode="tel"></div><div class="fld" style="flex:1;min-width:0"><label>${L('城市','City')}</label><input class="inp" id="npC"></div></div>
  <button class="bigbtn" style="width:100%;margin-top:18px" onclick="npSave('${type}')">${L('保存','Save')}</button>`)}
async function npSave(type){const n={zh:$('#npN').value,en:$('#npE').value};if(!n.zh.trim()&&!n.en.trim())return toast(L('请填写名称','Enter a name'));await fillEn(n);const c=await fillEn({zh:$('#npC').value,en:''});
  const d=DB.put('partners',{type,n,phone:$('#npP').value.trim(),city:c});closeSheet();const f=S._npAfter;if(typeof f==='function')f(d.id)}

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
V.docs=()=>{const segs=[['grn',L('入库审核','Receipt approvals')]];const dv=can('docs_view');if(can('po')||can('po_recv')||dv)segs.push(['po',L('采购','Purchase')]);if(can('so')||can('so_ship')||own('so_fin')||dv)segs.push(['so',L('销售','Sales')]);
  if(can('pr')||can('sr')||can('pr_exec')||can('sr_exec'))segs.push(['ret',L('退货','Returns')]);if(can('take')||own('tk_fin')||can('tk_final'))segs.push(['take',L('盘点','Counts')]);
  if(!segs.length)return emptyBox('doc',L('没有可查看的单据','No documents'));if(!segs.some(s=>s[0]===S.docSeg))S.docSeg=(can('so_ship')&&!can('po_recv'))||own('so_fin')?'so':segs[0][0];const seg=S.docSeg;
  let body='',add='';
  if(seg==='grn'){body=grnList();}
  else if(seg==='po'){const st=['all','draft','ordered','received','done'];if(!st.includes(S.docF))S.docF='all';
    const l=DB.all('po').filter(d=>S.docF==='all'||d.status===S.docF).sort((a,b)=>b.t-a.t);
    add=can('po')?`<button class="pill g" onclick="go('po_new')">${ic('plus',16)} ${L('新建采购单','New PO')}</button>`:can('po_recv')?`<button class="pill g" onclick="go('recv_pick')">${ic('in',16)} ${L('采购入库','Receive')}</button>`:'';
    body=`<div class="chips">${st.map(k=>`<span class="chip ${S.docF===k?'on':''}" onclick="S.docF='${k}';render(false)">${k==='all'?L('全部','All'):L(PO_ST[k][0],PO_ST[k][1])} <span class="n">${k==='all'?DB.all('po').length:DB.all('po').filter(d=>d.status===k).length}</span></span>`).join('')}</div><div style="margin-top:12px">${l.map(d=>docCard('po',d)).join('')||emptyBox('doc',L('暂无采购单','No purchase orders'))}</div>`}
  else if(seg==='so'){const st=['all','draft','submitted','credit_gm','approved','shipped','done','rejected'];if(!st.includes(S.docF))S.docF='all';
    const l=DB.all('so').filter(d=>S.docF==='all'||d.status===S.docF).sort((a,b)=>b.t-a.t).slice(0,80);
    add=can('so')?`<button class="pill g" onclick="go('so_new')">${ic('plus',16)} ${L('销售开单','New sale')}</button>`:'';
    body=`<div class="chips sales-status-filters">${st.map(k=>`<span class="chip ${S.docF===k?'on':''}" onclick="S.docF='${k}';render(false)"><span class="status-label">${k==='all'?L('全部','All'):L(SO_ST[k][0],SO_ST[k][1])}</span> <span class="n">${k==='all'?DB.all('so').length:DB.all('so').filter(d=>d.status===k).length}</span></span>`).join('')}</div><div style="margin-top:12px">${l.map(d=>docCard('so',d)).join('')||emptyBox('doc',L('暂无销售单','No sales orders'))}</div>`}
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
   ${poFeesEditor()}
   <div class="fld"><label>${L('备注','Note')}</label><textarea class="inp" oninput="S.form.note=this.value">${esc(nm(F.note))}</textarea></div></div>
  <div class="bbar"><div class="total"><span class="l">${L('合计','Total')}</span><span class="v" id="ftotal" data-notr>${moneyBase(docTotal(F))}</span></div><button class="bigbtn ghost" onclick="savePO('draft')">${L('存草稿','Save draft')}</button><button class="bigbtn" onclick="savePO('ordered')">${L('提交下单','Place order')}</button></div>`};
/* 采购附加费用：运费、清关费、其他（本币），计入应付和商品到岸成本；可从运费计算器带入 */
const FEE_K={freight:['运费','Freight'],clear:['清关费','Clearance'],other:['其他费用','Other']};
const feeName=f=>(f.n?f.n:L(FEE_K[f.k||'other'][0],FEE_K[f.k||'other'][1]));
function poFeesEditor(){const F=S.form;F.fees=F.fees||[];
  return `<div class="box" style="margin-top:12px;padding:12px 14px"><div class="row between"><b class="sm">${L('附加费用（运费 / 清关费 / 其他）','Extra costs (freight / clearance / other)')}</b><a class="xs" style="color:var(--green);font-weight:700;cursor:pointer" onclick="feeFromCalc()">${ic('calc',13)} ${L('从运费计算器带入','From calculator')}</a></div>
   <div class="xs muted" style="margin-top:2px">${L('计入应付总额，并按金额比例分摊进商品成本，方便核算','Added to the amount payable and spread into item cost')}</div>
   ${F.fees.map((f,i)=>`<div class="row gap" style="margin-top:8px;align-items:center"><select class="inp" style="width:96px;flex:none;padding:8px 4px;background:var(--soft)" onchange="S.form.fees[${i}].k=this.value">${Object.keys(FEE_K).map(k=>`<option value="${k}" ${f.k===k?'selected':''}>${L(FEE_K[k][0],FEE_K[k][1])}</option>`).join('')}</select>
     <input class="inp" style="flex:1;min-width:0;padding:8px;background:var(--soft)" value="${esc(f.n||'')}" placeholder="${L('说明（可选）','Note (optional)')}" oninput="S.form.fees[${i}].n=this.value">
     <input class="inp" type="number" inputmode="decimal" style="width:96px;flex:none;padding:8px;background:var(--soft)" value="${f.amt||''}" placeholder="${esc(CUR())}" oninput="S.form.fees[${i}].amt=+this.value;$('#ftotal').textContent=moneyBase(docTotal(S.form))">
     <button class="icbtn" style="width:32px;height:32px;flex:none" onclick="S.form.fees.splice(${i},1);render(false)">${ic('x',14)}</button></div>`).join('')}
   <a class="sm" style="display:inline-block;margin-top:8px;color:var(--green);font-weight:700;cursor:pointer" onclick="S.form.fees.push({k:'clear',n:'',amt:0});render(false)">+ ${L('添加费用','Add a cost')}</a></div>`}
function feeFromCalc(){fcInit();const f=S.fc;if([f.cur,...f.clr.map(c=>c.cur),...f.oth.map(o=>o.cur)].includes('CNY')&&!fxCNY())return toast(L('请先发布公司人民币汇率','Publish a company CNY rate first'));const r=frRate(f.mode);const x=frCost(f.mode,f.kg,f.cbm,{...r,p:+f.p||0,cur:f.cur});const F=S.form;F.fees=F.fees||[];
  if(x.cost)F.fees.push({k:'freight',n:`${L(MODES[f.mode][0],MODES[f.mode][1])} ${n2(x.q)} ${frUnitName(x.unit)}`,amt:Math.round(toBase(x.cost,f.cur)*100)/100,...feeFxSnapshot(x.cost,f.cur)});
  f.clr.filter(c=>+c.q&&+c.p).forEach(c=>F.fees.push({k:'clear',n:`${n2(c.q)} ${c.u}`,amt:Math.round(toBase(c.q*c.p,c.cur)*100)/100,...feeFxSnapshot(c.q*c.p,c.cur)}));
  f.oth.filter(o=>+o.a).forEach(o=>F.fees.push({k:'other',n:o.n||'',amt:Math.round(toBase(o.a,o.cur)*100)/100,...feeFxSnapshot(o.a,o.cur)}));toast(L('已带入运费计算器的费用','Costs added from the calculator'),false);render(false)}
/* 到岸成本系数 = (货款 + 附加费用) / 货款；平均成本按入库记录的到岸单价加权 */
const landK=d=>{const it=itemsTotal(d);const fe=(d.fees||[]).reduce((a,f)=>a+(+f.amt||0),0);return it>0?(it+fe)/it:1};
let _acV=-1,_acM={};
function avgCost(pid){if(_acV!==DB.ver){_acV=DB.ver;_acM={}}if(pid in _acM)return _acM[pid];const p=P_(pid);let q=0,v=0;
  DB.all('moves').filter(m=>m.pid===pid).sort((a,b)=>(a.postedAt||a.t)-(b.postedAt||b.t)).forEach(m=>{const uc=m.uc!=null?+m.uc:(q>0?v/q:+p.cost||0);q+=+m.qty;v+=+m.qty*uc;if(Math.abs(q)<1e-8){q=0;v=0}});
  return _acM[pid]=q>0?v/q:(+p.cost||0)}
function savePO(st){const F=S.form;if(!F.sup)return toast(L('请选择供应商','Choose a supplier'));const items=mergeOrderLines(F.items);if(!items)return;if(!items.length)return toast(L('请添加商品','Add at least one item'));
  const d=DB.put('po',{...F,kind:undefined,_v:undefined,fees:(F.fees||[]).filter(f=>+f.amt>0).map(f=>({...f,k:f.k,n:f.n||'',amt:+f.amt})),items:items.map(i=>({...i,qty:+i.qty,price:+i.price,recv:+i.recv||0})),status:st,no:F.no||genNo('PO'),t:F.t||Date.now()});S.form=null;
  toast(st==='draft'?L('草稿已保存','Draft saved'):S.online?L('已下单','Order placed'):L('已暂存本机，联网后自动提交','Saved offline — will submit when online'));finish('po_view',{id:d.id})}
/* ---------- 采购单锁定与入库后补录费用（lcadj） ----------
   采购单有了入库单或付款申请后，商品、单价、附加费用都不能再改（服务器同样拦截）。
   之后才发生的运费、清关费：会计提交补录 → 运营经理 / 总经理批准 → 计入该采购单应付，利润报表作为当期采购费用 */
const LC_ST={pending:['待运营经理 / 总经理审批','Awaiting operations / GM','b-gold'],approved:['已批准，计入应付','Approved — payable','b-green'],rejected:['已驳回','Rejected','b-red']};
const poLocked=d=>!!d&&d.status!=='draft'&&(DB.all('grn').some(g=>g.po===d.id&&grnStatus(g)!=='rejected')||DB.all('fin').some(f=>f.type==='pay'&&f.ref===d.id&&f.status!=='void'));
const lcOf=po=>DB.all('lcadj').filter(x=>x.po===po);
const lcApproved=po=>lcOf(po).filter(x=>x.status==='approved').reduce((a,x)=>a+(+x.amt||0),0);
const lcCanAdd=d=>['acct','chair'].includes(S.me.role)&&['ordered','received','done'].includes(d.status);
const lcCanReview=x=>x.status==='pending'&&['ops','gm','chair'].includes(S.me.role)&&x.by!==S.me.id;
function lcBox(d){const l=lcOf(d.id).sort((a,b)=>b.t-a.t);if(!l.length&&!lcCanAdd(d))return '';
  return `<div class="box"><h4>${L('入库后补录的费用','Costs added after receipt')}${lcCanAdd(d)?`<a class="sm green b" style="cursor:pointer" onclick="lcNew('${d.id}')">+ ${L('补录费用','Add cost')}</a>`:''}</h4>
   <div class="xs muted">${L('采购单已入库或已申请付款后，附加费用不能再改。之后才发生的运费、清关费在这里补录：批准后计入这张采购单的应付，利润报表计为当期采购费用。','Once a PO has receipts or payment requests its extra costs are locked. Add later freight or clearance here: once approved it is payable on this PO and reported as a period purchasing cost.')}</div>
   ${l.map(x=>`<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm">${esc(feeName(x))} · <span data-notr>${money(x.amt)}</span></div><div class="xs muted">${esc(userName(x.by))} · ${fdate(x.t)}${x.approval?' · '+esc(userName(x.approval.by))+' '+fdate(x.approval.t)+(x.approval.note?' · '+esc(x.approval.note):''):''}</div></div>
     ${lcCanReview(x)?`<button class="pill g" onclick="lcReview('${x.id}')">${L('审批','Review')}</button>`:stB(LC_ST,x.status)}</div>`).join('')}</div>`}
function lcNew(po){if(!lcCanAdd(DB.get('po',po)||{}))return;S.lc={po,k:'freight',n:'',amt:''};
  openSheet(`<div class="sh">${L('补录采购费用','Add purchase cost')}</div>
   <div class="fld"><label>${L('类别','Type')}</label><select class="inp" style="background:var(--card)" onchange="S.lc.k=this.value">${Object.keys(FEE_K).map(k=>`<option value="${k}">${L(FEE_K[k][0],FEE_K[k][1])}</option>`).join('')}</select></div>
   <div class="fld"><label>${L('说明（必填）','Description (required)')}</label><input class="inp" style="background:var(--card)" oninput="S.lc.n=this.value" placeholder="${L('如：港口滞箱费、二次清关费','e.g. port demurrage, re-clearance')}"></div>
   <div class="fld"><label>${L('金额','Amount')} (${esc(CUR())} ${baseIso()})</label><input class="inp" type="number" inputmode="decimal" style="background:var(--card)" oninput="S.lc.amt=this.value"></div>
   <button class="bigbtn" style="width:100%;margin-top:14px" onclick="lcSave()">${L('提交审批','Submit for approval')}</button>`)}
function lcSave(){const x=S.lc,amt=Math.round((+x.amt||0)*100)/100;if(!(amt>0))return toast(L('请填写金额','Enter the amount'));if((x.n||'').trim().length<2)return toast(L('请填写说明','Add a description'));
  DB.put('lcadj',{po:x.po,k:x.k,n:x.n.trim(),amt,status:'pending',by:S.me.id,t:Date.now()});closeSheet(true);toast(L('已提交，等待运营经理或总经理审批','Submitted for operations / GM approval'),false);render(false)}
function lcReview(id){const x=DB.get('lcadj',id);if(!x||!lcCanReview(x))return;const p=DB.get('po',x.po)||{};
  openSheet(`<div class="sh">${L('审批补录费用','Review cost addition')}</div><div class="sm muted"><span data-notr>${esc(p.no||'')}</span> · ${esc(ptName(p.sup))}</div>
   <div style="font-size:28px;font-weight:800;margin-top:10px" data-notr>${moneyBase(x.amt)}</div><div class="sm">${esc(feeName(x))} · ${esc(userName(x.by))}</div>
   <div class="fld"><label>${L('意见（驳回时必填）','Comment (required to reject)')}</label><input class="inp" id="lcN" style="background:var(--card)"></div>
   <div class="row gap" style="margin-top:12px"><button class="bigbtn dark" style="flex:1" onclick="lcDecide('${id}',false)">${L('驳回','Reject')}</button><button class="bigbtn" style="flex:1" onclick="lcDecide('${id}',true)">${L('批准','Approve')}</button></div>`)}
function lcDecide(id,ok){const x=DB.get('lcadj',id),n=($('#lcN').value||'').trim();if(!x||!lcCanReview(x))return toast(L('这笔已处理','Already handled'));if(!ok&&n.length<2)return toast(L('请填写驳回原因','Give a reason'));
  DB.put('lcadj',{...x,status:ok?'approved':'rejected',approval:{by:S.me.id,t:Date.now(),note:n}});closeSheet(true);toast(ok?L('已批准，计入应付','Approved — added to payables'):L('已驳回','Rejected'),false);render(false)}
function steps(flow,cur,M){const i=flow.indexOf(cur);return `<div class="steps">${flow.map((s,k)=>`<div class="st ${k<=i?'ok':''}"><b>${k<i?'✓':k+1}</b>${L(M[s][0],M[s][1])}</div>`).join('')}</div>`}
V.po_view=()=>{const d=DB.get('po',S.params.id);if(!d)return hdr('')+emptyBox('doc',L('单据不存在','Not found'));const feeBox=(d.fees||[]).length?`<div class="box"><h4>${L('附加费用（计入商品到岸成本）','Extra costs (in landed cost)')}</h4>${d.fees.map(f=>`<div class="row between sm" style="margin-top:6px"><span>${esc(feeName(f))}</span><b data-notr>${money(f.amt)}</b></div>`).join('')}<div class="xs muted" style="margin-top:6px">${L('按商品金额比例分摊：每 1 元货款分摊 ','Spread by value: each 1.00 of goods carries ')}${(landK(d)-1).toFixed(3)}</div></div>`:'';
  const grns=DB.all('grn').filter(g=>g.po===d.id);const shs=DB.all('ships').filter(s=>s.ref===d.id);const acts=[];
  if(d.status==='draft'&&can('po')){acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('po_new',{id:'${d.id}'})">${L('编辑','Edit')}</button>`,`<button class="bigbtn" onclick="setSt('po','${d.id}','ordered')">${L('提交下单','Place order')}</button>`)}
  if(d.status==='ordered'&&can('po_prepare'))acts.push(`<button class="bigbtn" onclick="S.form=null;go('recv',{id:'${d.id}'})">${ic('in',18)} ${L('登记到货，提交审批','Register arrival for approval')}</button>`);
  if(d.status==='received'&&can('po'))acts.push(`<button class="bigbtn" onclick="setSt('po','${d.id}','done')">${L('完成订单','Complete')}</button>`);
  if(['received','done'].includes(d.status)&&can('pr')&&grns.some(g=>grnStatus(g)==='done'))acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('pr_new',{grn:'${grns.find(g=>grnStatus(g)==='done').id}'})">${ic('ret',18)} ${L('采购退货','Return')}</button>`);
  if(d.status==='ordered'&&can('po')&&grns.some(g=>grnStatus(g)==='done')&&!grns.some(g=>['submitted','fin_ok','ready'].includes(g.status)))acts.push(`<button class="bigbtn ghost" onclick="poCloseShort('${d.id}')">${L('按实到数量结案','Close at received qty')}</button>`);
  if(d.status==='ordered'&&can('po')&&!grns.some(g=>grnStatus(g)!=='rejected'))acts.push(`<button class="bigbtn ghost" onclick="setSt('po','${d.id}','cancel')">${L('取消订单','Cancel order')}</button>`);
  return hdr(L('采购单','Purchase order'),`<button class="icbtn" onclick="copyText('${d.no}')">${ic('copy')}</button>`)+`<div class="pad">
   <div class="box" style="margin-top:6px"><div class="row between"><div class="b" style="font-size:18px" data-notr>${esc(d.no)}</div>${stB(PO_ST,d.status)}</div>${d.status!=='cancel'?steps(['draft','ordered','received','done'],d.status,PO_ST):''}
    <div class="kv" style="margin-top:14px"><div><div class="l">${L('供应商','Supplier')}</div><div class="v">${esc(ptName(d.sup))}</div></div><div><div class="l">${L('入库仓库','Warehouse')}</div><div class="v">${esc(whName(d.wh))}</div></div>
    <div><div class="l">${L('制单人','Created by')}</div><div class="v">${esc(userName(d.by))}</div></div><div><div class="l">${L('日期','Date')}</div><div class="v">${fdate(d.t)}</div></div></div>
    ${nm(d.note)?`<div class="note-y" style="margin-top:12px">${esc(nm(d.note))}</div>`:''}${d._q?`<div class="note-y" style="margin-top:12px">${ic('cloud',15)} ${L('暂存本机，联网后自动提交','Saved on this phone — submits when online')}</div>`:''}</div>
   <div class="box"><h4>${L('商品明细','Items')}<span class="sm muted">${L('已入库 / 订购','Received / ordered')}</span></h4>${d.items.map(it=>{const p=P_(it.pid);return `<div class="li" onclick="go('product',{id:'${it.pid}'})">${thumb(p,38)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted" data-notr>${n2(it.qty)} × ${n2(it.price)} = ${n2(lineTotal(it))}</div></div><b class="${(+it.recv||0)>=it.qty?'green':''}" data-notr>${n2(+it.recv||0)}/${n2(it.qty)}</b></div>`}).join('')}
    <div class="row between" style="margin-top:10px"><span class="muted">${L('合计','Total')}</span><b style="font-size:18px" data-notr>${money(docTotal(d))}</b></div></div>
   ${grns.length?grnList(grns):''}${feeBox}${lcBox(d)}${shipBox(shs,'in','po',d.id)}</div>${acts.length?`<div class="bbar">${acts.join('')}</div>`:''}`};
/* 供应商少发、不再补货：按已入库数量结案。结案后应付只按实到货计算，多付的定金显示为供应商欠我方 */
function poCloseShort(id){const d=DB.get('po',id);if(!d||d.status!=='ordered')return;const short=d.items.filter(i=>(+i.recv||0)<i.qty);
  openSheet(`<div class="sh">${L('按实到数量结案','Close at received quantities')}</div><div class="sm muted" data-notr>${esc(d.no)} · ${esc(ptName(d.sup))}</div>
   <div class="box" style="padding:6px 16px">${short.map(i=>`<div class="li" style="cursor:default"><span style="flex:1">${esc(pName(i.pid))}</span><b data-notr>${n2(+i.recv||0)} / ${n2(i.qty)}</b></div>`).join('')}</div>
   <div class="xs muted">${L('结案后未到的数量不再入库，应付按实到货计算；已多付的钱会显示为“供应商欠我方”，由出纳登记退款。','Unreceived quantities are cancelled; the payable follows what arrived, and any overpayment shows as owed by the supplier.')}</div>
   <div class="fld"><label>${L('结案原因（必填）','Reason (required)')}</label><input class="inp" id="pcN" style="background:var(--card)" placeholder="${L('如：供应商缺货，不再补发','e.g. supplier out of stock, no back-order')}"></div>
   <button class="bigbtn" style="width:100%;margin-top:12px" onclick="poCloseShortDo('${id}')">${L('确认结案','Close order')}</button>`)}
function poCloseShortDo(id){const d=DB.get('po',id),n=($('#pcN').value||'').trim();if(!d||d.status!=='ordered')return;if(n.length<2)return toast(L('请填写结案原因','Give a reason'));
  if(DB.all('grn').some(g=>g.po===id&&['submitted','fin_ok','ready'].includes(g.status)))return toast(L('还有入库单在审批中，请先处理','A receipt is still in review'));
  DB.put('po',{...d,status:'done',closed:{by:S.me.id,t:Date.now(),note:n,short:true}});closeSheet(true);toast(L('已按实到数量结案','Closed at received quantities'),false);render(false)}
function setSt(k,id,st){if(k==='so'&&st==='done')return completeSale(id);const d=DB.get(k,id);DB.put(k,{...d,status:st});toast(L('已更新','Updated'));render(false)}
function shipBox(shs,dir,refKind,ref){if(!can('logi')&&!shs.length)return '';
  return `<div class="box"><h4>${L('物流跟踪','Logistics')}${can('logi')?`<a class="sm green b" style="cursor:pointer" onclick="S.form=null;go('ship_new',{dir:'${dir}',refKind:'${refKind}',ref:'${ref}'})">+ ${L('添加物流','Add shipment')}</a>`:''}</h4>${shs.map(shipRow).join('')||`<div class="sm muted">${L('还没有物流信息','No shipment yet')}</div>`}</div>`}
function shipRow(s){const c=carrier(s.carrier);return `<div class="li" onclick="go('ship_view',{id:'${s.id}'})"><div class="qi" style="background:${s.status==='exception'?'#FCE9E5':'var(--lime)'};color:${s.status==='exception'?'var(--red)':'var(--green)'}">${ic(MODES[s.mode||c.mode][2],18)}</div><div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(c))} · <span data-notr>${esc(s.trackNo||s.no)}</span></div><div class="xs muted one">${esc(nm(s.from))} → ${esc(nm(s.to))}</div></div>${stB(SH_ST,s.status)}</div>`}

/* ---------- 采购入库：选订单 → 填数量 → 扫码核对 → 确认入库 ---------- */
V.recv_pick=()=>hdr(L('采购到货与入库','Arrivals & receipts'))+`<div class="pad">${grnList(DB.all('grn').filter(g=>g.status&&g.status!=='done'))}${can('po_prepare')?DB.all('po').filter(d=>d.status==='ordered').map(d=>`<div class="wc" onclick="S.form=null;go('recv',{id:'${d.id}'})"><div class="top"><b data-notr>${esc(d.no)}</b><div>${L('登记到货，提交审批','Register arrival for approval')}</div></div></div>`).join(''):''}</div>`;
V.recv=()=>{const d=DB.get('po',S.params.id);if(!d)return hdr('');
  if(!S.form||S.form.kind!=='recv'||S.form.po!==d.id)S.form={kind:'recv',po:d.id,wh:d.wh,chk:{},lines:d.items.map(it=>{const p=P_(it.pid);const rem=grnRemaining(d,it.pid);return {pid:it.pid,qty:rem,rem,batch:genNo('B'),exp:''}})};
  const F=S.form;const total=F.lines.length,ok=F.lines.filter(l=>(F.chk[l.pid]||0)>0).length;
  return hdr(L('确认入库','Receive')+' · <span data-notr>'+esc(d.no)+'</span>')+`<div class="pad">
   <div class="note-g" style="margin-top:4px">${L('第 2 步：核对实到数量（默认为未入库数量），可扫码逐件核对','Step 2: check quantities (defaults to remaining). Scan items to verify.')}</div>
   <div class="row between" style="margin-top:12px"><div class="sm">${L('已扫码核对','Scan-checked')} <b>${ok}/${total}</b></div><button class="pill g" onclick="recvScan()">${ic('scan',16)} ${L('扫码核对','Scan check')}</button></div>
   <div class="fld"><label>${L('入库仓库','Warehouse')}</label>${whSel(F.wh,"S.form.wh=this.value")}</div>
   ${F.lines.map((l,i)=>{const p=P_(l.pid);const c=F.chk[l.pid]||0;return `<div class="box" style="margin-top:10px;padding:12px 14px;${c?'border:2px solid var(--green)':''}"><div class="row gap">${thumb(p,40)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted"><span data-notr>${esc(p.bar)}</span> · ${L('未入库','Remaining')} ${n2(l.rem)} ${esc(unit(p))}</div></div>${c?`<span class="badge b-green">✓ ${c}</span>`:''}</div>
    <div class="row between" style="margin-top:10px"><span class="sm muted">${L('实到数量','Received qty')}</span><div class="qty"><button onclick="S.form.lines[${i}].qty=Math.max(0,S.form.lines[${i}].qty-1);render(false)">−</button><input type="number" inputmode="decimal" value="${l.qty}" oninput="S.form.lines[${i}].qty=+this.value"><button onclick="S.form.lines[${i}].qty++;render(false)">+</button></div></div>
    ${true?`<div class="row gap" style="margin-top:8px"><input class="inp" style="padding:9px 12px;font-size:14px" placeholder="${L('批次号','Batch no.')}" value="${esc(l.batch)}" oninput="S.form.lines[${i}].batch=this.value"><input class="inp" style="padding:9px 12px;font-size:14px" type="date" value="${esc(l.exp)}" oninput="S.form.lines[${i}].exp=this.value" title="${L('有效期','Expiry')}"></div>`:''}</div>`}).join('')}</div>
  <div class="bbar"><button class="bigbtn" onclick="doRecv()">${ic('check',18)} ${L('提交财务审批','Submit to finance')}</button></div>`};
function recvScan(){openScan(L('扫码核对','Scan check'),c=>{const F=S.form;const p=findByCode(c);const l=p&&F.lines.find(x=>x.pid===p.id);
  if(!l){toast(L('不在此订单中：','Not in this order: ')+c);const g=$('#scLog');if(g)g.innerHTML=`<div class="note-r" style="margin-top:8px">${L('不在此订单中','Not in this order')}: <span data-notr>${esc(c)}</span></div>`;return false}
  F.chk[p.id]=(F.chk[p.id]||0)+1;S.formDirty=true;const g=$('#scLog');if(g)g.innerHTML=`<div class="note-g" style="margin-top:8px">✓ ${esc(nm(p.n))} · ${L('已核对','checked')} ${F.chk[p.id]} ${L('次','x')}</div>`},true)}
function doRecv(){const F=S.form,d=F&&DB.get('po',F.po);if(!can('po_prepare')||!d||d.status!=='ordered')return;
  const lines=F.lines.filter(l=>+l.qty>0);if(!lines.length)return toast(L('请填写实到数量','Enter received quantities'));
  for(const l of lines){if(!Number.isFinite(+l.qty)||+l.qty>grnRemaining(d,l.pid))return toast(L('数量超过未入库且未申请的数量','Quantity exceeds remaining unrequested amount'));if(P_(l.pid).batch&&!l.exp)return toast(L('请填写有效期：','Enter expiry for: ')+pName(l.pid))}
  const batch=genNo('B');const g=DB.put('grn',{no:genNo('GR'),batch,po:d.id,wh:F.wh,status:'submitted',t:Date.now(),items:lines.map(l=>({pid:l.pid,qty:+l.qty,batch:(l.batch||batch).trim(),exp:l.exp||''}))});
  S.form=null;toast(L('已提交：财务审批 → 内勤确认 → 库管入库','Submitted: finance → clerk → warehouse'),false);finish('grn_view',{id:g.id})}
const grnStatus=g=>g.status||'done';
const grnCanAct=g=>g.status==='submitted'&&own('grn_fin')||g.status==='fin_ok'&&own('grn_check')||g.status==='ready'&&own('po_recv');
function grnRemaining(d,pid){const it=d.items.find(i=>i.pid===pid);const pending=DB.all('grn').filter(g=>g.po===d.id&&['submitted','fin_ok','ready'].includes(g.status)).reduce((n,g)=>n+g.items.filter(i=>i.pid===pid).reduce((v,i)=>v+(+i.qty||0),0),0);return Math.max(0,(+it.qty||0)-(+it.recv||0)-pending)}
function grnList(rows=DB.all('grn')){return `<div class="box"><h4>${L('入库信息 / 审批','Receipt information / review')}</h4>${rows.slice().sort((a,b)=>b.t-a.t).map(g=>`<div class="li" onclick="go('grn_view',{id:'${g.id}'})"><div style="flex:1"><b data-notr>${esc(g.no)}</b><div class="xs muted">${L('入库批号','Receipt batch')}: <span data-notr>${esc(g.batch||g.no)}</span> · ${esc(whName(g.wh))}</div></div>${stB(GR_ST,grnStatus(g))}</div>`).join('')||L('暂无入库信息','No receipts')}</div>`}
V.grns=()=>hdr(L('入库信息 / 审批','Receipt information / review'))+`<div class="pad">${grnList()}</div>`;
V.grn_view=()=>{const g=DB.get('grn',S.params.id);if(!g)return hdr('');const d=DB.get('po',g.po)||{};return hdr(L('采购入库单','Goods receipt'))+`<div class="pad"><div class="box"><b data-notr>${esc(g.no)}</b> ${stB(GR_ST,grnStatus(g))}<div class="sm">${L('入库批号','Receipt batch')}: <span data-notr>${esc(g.batch||g.no)}</span></div><div class="sm">${esc(d.no)} · ${esc(ptName(d.sup))} · ${esc(whName(g.wh))}</div><div class="note-y">${L('财务审批 → 内勤审核确认 → 库管入库；最后一步才增加库存','Finance → clerk → warehouse; stock changes only at the last step')}</div>${g.items.map(i=>`<div class="li"><span style="flex:1">${esc(pName(i.pid))}<div class="xs muted" data-notr>${esc(i.batch||g.batch||g.no)} ${esc(i.exp||'')}</div></span><b>${n2(i.qty)}</b></div>`).join('')}${['fin','check','received','reject'].filter(k=>g[k]).map(k=>`<div class="xs muted">${esc(userName(g[k].by))} · ${fdate(g[k].t)} · ${esc(g[k].note||'')}</div>`).join('')}</div></div>${grnCanAct(g)?`<div class="bbar">${g.status!=='ready'?`<button class="bigbtn ghost" onclick="grnReview('${g.id}',false)">${L('拒绝','Reject')}</button>`:''}<button class="bigbtn" onclick="grnReview('${g.id}',true)">${g.status==='submitted'?L('财务审批通过','Finance approve'):g.status==='fin_ok'?L('内勤审核确认','Clerk confirm'):L('确认入库','Receive into stock')}</button></div>`:''}`};
function grnReview(id,ok){const g=DB.get('grn',id);if(!g||!grnCanAct(g))return;if(!ok){openSheet(`<div class="sh">${L('驳回原因','Reason')}</div><input class="inp" id="grR"><button class="bigbtn" onclick="grnReject('${id}')">${L('确认驳回','Reject')}</button>`);return}
  const t=Date.now();if(g.status==='submitted')DB.put('grn',{...g,status:'fin_ok',fin:{by:S.me.id,t,note:L('财务审批通过','Finance approved')}});
  else if(g.status==='fin_ok')DB.put('grn',{...g,status:'ready',check:{by:S.me.id,t,note:L('内勤审核确认','Clerk confirmed')}});
  else{const d=DB.get('po',g.po);if(!d||d.status!=='ordered')return toast(L('采购单状态已变更，请同步后重试','PO changed; sync and retry'));if(g.items.some(l=>{const i=d.items.find(x=>x.pid===l.pid);return !i||(+i.recv||0)+l.qty>i.qty}))return toast(L('入库数量超出采购数量','Receipt exceeds ordered quantity'));
    const k=landK(d);g.items.forEach((l,i)=>{const it=d.items.find(x=>x.pid===l.pid);addMove({id:'grn_'+g.id+'_'+i,pid:l.pid,wh:g.wh,qty:l.qty,type:'po_in',ref:g.id,batch:l.batch||g.batch||g.no,exp:l.exp||'',uc:Math.round((+it.price||0)*k*100)/100})});
    const items=d.items.map(it=>({...it,recv:(+it.recv||0)+g.items.filter(l=>l.pid===it.pid).reduce((n,l)=>n+l.qty,0)}));DB.put('po',{...d,items,status:items.every(i=>i.recv>=i.qty)?'received':'ordered'});DB.put('grn',{...g,status:'done',received:{by:S.me.id,t,note:L('库管确认入库','Warehouse received')}})}
  toast(L('已处理','Processed'),false);render(false)}
function grnReject(id){const g=DB.get('grn',id),note=($('#grR').value||'').trim();if(!g||!grnCanAct(g)||g.status==='ready')return;if(note.length<2)return toast(L('请填写驳回原因','Give a reason'));DB.put('grn',{...g,status:'rejected',reject:{by:S.me.id,t:Date.now(),note}});closeSheet(true);render(false)}

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
V.pr_new=()=>{const gid=S.params.grn;if(!gid){const l=DB.all('grn').filter(g=>grnStatus(g)==='done').sort((a,b)=>b.t-a.t);return hdr(L('采购退货','Return to supplier'))+`<div class="pad"><div class="note-g" style="margin-top:4px">${L('选择要退货的入库单','Choose the receipt to return from')}</div><div style="margin-top:12px">${l.map(g=>{const po=DB.get('po',g.po)||{};return `<div class="wc" onclick="S.form=null;S.params.grn='${g.id}';render(true)"><div class="top"><div class="row between"><h3><span class="tt" data-notr>${esc(g.no)}</span></h3><span class="badge b-green">${L('已入库','Received')}</span></div><small class="one" style="display:block">${esc(ptName(po.sup))} · <span data-notr>${esc(po.no||'')}</span></small><div class="cols"><div><span class="l">${L('商品','Items')}</span><span class="v">${g.items.length}</span></div><div><span class="l">${L('门店','Store')}</span><span class="v">${esc(whName(g.wh))}</span></div><div><span class="l">${L('日期','Date')}</span><span class="v">${fdate(g.t,false)}</span></div></div></div></div>`}).join('')||emptyBox('in',L('暂无入库单','No receipts'))}</div></div>`}
  const g=DB.get('grn',gid);const po=DB.get('po',g.po)||{};
  if(!S.form||S.form.kind!=='pr'||S.form.grn!==gid)S.form={kind:'pr',grn:gid,reason:'',lines:g.items.map((it,i)=>({i,pid:it.pid,batch:it.batch,max:Math.max(0,it.qty-(+it.ret||0)-pendRet('pr',gid,i)),qty:0}))};
  const F=S.form;
  return hdr(L('采购退货','Return to supplier'))+`<div class="pad"><div class="box" style="margin-top:6px"><div class="b" data-notr>${esc(g.no)}</div><div class="sm muted">${esc(ptName(po.sup))} · ${esc(whName(g.wh))} · ${fdate(g.t)}</div></div>
   <div class="note-y" style="margin-top:12px">${L('提交后由仓库主管确认出库，库存才会减少。','After you submit, the warehouse manager ships it out and stock goes down.')}</div>
   ${F.lines.map((l,k)=>{const p=P_(l.pid);return `<div class="box" style="margin-top:10px;padding:12px 14px"><div class="row gap">${thumb(p,40)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted">${l.batch?'<span data-notr>'+esc(l.batch)+'</span> · ':''}${L('最多可退','Max')} ${n2(l.max)} ${esc(unit(p))}</div></div>
    <div class="qty"><button onclick="S.form.lines[${k}].qty=Math.max(0,S.form.lines[${k}].qty-1);render(false)">−</button><input type="number" value="${l.qty}" oninput="S.form.lines[${k}].qty=+this.value"><button onclick="S.form.lines[${k}].qty=Math.min(${l.max},S.form.lines[${k}].qty+1);render(false)">+</button></div></div></div>`}).join('')}
   <div class="fld"><label>${L('退货原因','Reason')}</label><input class="inp" value="${esc(F.reason)}" oninput="S.form.reason=this.value" placeholder="${L('如：质量问题、型号不符','e.g. quality issue, wrong model')}"></div></div>
  <div class="bbar"><button class="bigbtn" onclick="doPR()">${L('提交退货单','Submit return')}</button></div>`};
function doPR(){const F=S.form;const g=DB.get('grn',F.grn);if(!g||grnStatus(g)!=='done'||!can('pr'))return;const lines=F.lines.filter(l=>+l.qty>0);if(!lines.length)return toast(L('请填写退货数量','Enter return quantities'));
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
   <div class="fld"><label>${L('付款方式','Payment terms')} <span class="xs muted">${(F.pay||'cash')==='credit'?L('赊账：财务审核 + 总经理审批后出库','credit: finance + GM approve before shipping'):L('现款：财务确认收款后出库','cash: ships after finance confirms payment')}</span></label><div class="seg" style="margin-top:0">${[['cash',L('现款','Cash')],['credit',L('赊账','Credit')]].map(([k,t])=>`<button class="${(F.pay||'cash')===k?'on':''}" onclick="S.form.pay='${k}';render(false)">${t}</button>`).join('')}</div></div>
   <div class="fld"><label>${L('运费','Freight')} <span class="xs muted">${((F.frt||{}).payer)==='cus'?L('加到货款里向客户收取','added to the customer’s total'):((F.frt||{}).payer)==='us'?L('计入公司运营成本','counted as company cost'):''}</span></label><div class="seg" style="margin-top:0">${[['none',L('无','None')],['cus',L('对方承担','Customer')],['us',L('我方承担','Us')]].map(([k,t])=>`<button class="${((F.frt||{}).payer||'none')===k?'on':''}" onclick="S.form.frt={...(S.form.frt||{amt:0}),payer:'${k}'};render(false)">${t}</button>`).join('')}</div>
    ${(F.frt||{}).payer&&F.frt.payer!=='none'?`<div class="row gap" style="margin-top:8px;align-items:center"><input class="inp" type="number" inputmode="decimal" value="${F.frt.amt||''}" placeholder="${L('运费金额','Freight amount')} (${esc(CUR())})" oninput="S.form.frt.amt=+this.value;$('#ftotal').textContent=moneyBase(docTotal(S.form))"><button class="pill w" style="flex:none" onclick="go('logi_svc')">${ic('calc',14)} ${L('计算器','Calculator')}</button></div>`:''}</div>
   <div class="fld"><label>${L('送货地址','Delivery address')}</label><input class="inp" value="${esc(nm(F.addr))}" oninput="S.form.addr=this.value" placeholder="${L('客户自提可不填','Leave empty for pickup')}"></div>
   <div class="fld"><label>${L('备注','Note')}</label><textarea class="inp" oninput="S.form.note=this.value">${esc(nm(F.note))}</textarea></div></div>
  <div class="bbar"><div class="total"><span class="l">${L('合计','Total')}</span><span class="v" id="ftotal" data-notr>${moneyBase(docTotal(F))}</span></div><button class="bigbtn ghost" onclick="saveSO('draft')">${L('保存','Save')}</button><button class="bigbtn" onclick="saveSO('submitted')">${L('提交','Submit')}</button></div>`};
function saveSO(st){const F=S.form;if(!F.cus)return toast(L('请选择客户','Choose a customer'));const items=mergeOrderLines(F.items);if(!items)return;if(!items.length)return toast(L('请添加商品','Add at least one item'));
    const frt=F.frt&&F.frt.payer&&F.frt.payer!=='none'?{payer:F.frt.payer,amt:+F.frt.amt||0}:null;if(frt&&!frt.amt&&st!=='draft')return toast(L('请填写运费金额','Enter the freight amount'));
  const d=DB.put('so',{...F,kind:undefined,_v:undefined,pay:F.pay||'cash',frt,rj:st==='submitted'?'':F.rj,items:items.map(i=>({...i,qty:+i.qty,price:+i.price})),status:st,no:F.no||genNo('SO'),t:F.t||Date.now()});S.form=null;
  toast(st==='draft'?L('已保存草稿','Draft saved'):!S.online?L('已暂存本机，联网后自动提交','Saved offline — will submit when online'):(F.pay==='credit'?L('已提交：财务审核 → 总经理审批 → 仓库出库','Submitted: finance → GM → warehouse'):L('已提交：财务确认收款后仓库出库','Submitted: ships after finance confirms payment')));finish('so_view',{id:d.id})}
V.so_view=()=>{const d=DB.get('so',S.params.id);if(!d)return hdr('')+emptyBox('doc',L('单据不存在','Not found'));const shs=DB.all('ships').filter(s=>s.ref===d.id);const rets=DB.all('sr').filter(r=>r.so===d.id);const acts=[];
  if(d.status==='rejected'&&can('so'))acts.push(`<button class="bigbtn" onclick="S.form=null;go('so_new',{id:'${d.id}'})">${L('修改后重新提交','Edit & resubmit')}</button>`);
  if(d.status==='submitted'&&own('so_fin'))acts.push(`<button class="bigbtn" onclick="soFin('${d.id}')">${ic('calc',18)} ${d.pay==='credit'?L('赊账审核','Review credit'):L('确认收款','Confirm payment')}</button>`);
  if(d.status==='credit_gm'&&['chair','gm'].includes(S.me.role))acts.push(`<button class="bigbtn" onclick="soGm('${d.id}')">${ic('check',18)} ${L('审批赊账','Approve credit')}</button>`);
  if(d.status==='draft'&&can('so'))acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('so_new',{id:'${d.id}'})">${L('编辑','Edit')}</button>`,`<button class="bigbtn" onclick="setSt('so','${d.id}','submitted')">${L('提交','Submit')}</button>`);
  if(d.status==='approved'&&can('so_ship'))acts.push(`<button class="bigbtn" onclick="shipSheet('${d.id}')">${ic('out',18)} ${L('确认发货','Confirm shipment')}</button>`);
  if(['submitted','credit_gm'].includes(d.status)&&can('so')&&d.by===S.me.id)acts.push(`<button class="bigbtn ghost" onclick="setSt('so','${d.id}','draft')">${L('撤回修改','Withdraw')}</button>`);
  if(d.status==='shipped'&&(can('so')||can('so_ship')))acts.push(`<button class="bigbtn" onclick="completeSale('${d.id}')">${L('客户签收并完成','Customer receipt & complete')}</button>`);
  if(['shipped','done'].includes(d.status)&&can('sr'))acts.push(`<button class="bigbtn ghost" onclick="S.form=null;go('sr_new',{so:'${d.id}'})">${ic('ret',18)} ${L('退货','Return')}</button>`);
  return hdr(L('销售单','Sales order'),`<div class="row gap6"><button class="icbtn" onclick="printDoc('so','${d.id}')" title="${L('打印销售单','Print sales order')}">${ic('print')}</button><button class="icbtn" onclick="copyText('${d.no}')">${ic('copy')}</button></div>`)+`<div class="pad">
   ${['shipped','done'].includes(d.status)?`<button class="bigbtn ghost" style="width:100%;margin-top:6px;height:46px;font-size:14px" onclick="printDoc('out','${d.id}')">${ic('print',16)} ${L('打印出库单（送货签收）','Print delivery note')}</button>`:''}
   <div class="box" style="margin-top:6px"><div class="row between"><div class="b" style="font-size:18px" data-notr>${esc(d.no)}</div>${stB(SO_ST,d.status)}</div>${!['cancel','rejected'].includes(d.status)?steps(d.pay==='credit'?['draft','submitted','credit_gm','approved','shipped','done']:['draft','submitted','approved','shipped','done'],d.status,SO_ST):''}
    ${d.status==='rejected'?`<div class="note-r" style="margin-top:10px">${L('驳回原因：','Rejected: ')}${esc(d.rj||'')}</div>`:''}
    <div class="xs muted" style="margin-top:10px">${d.pay==='credit'?L('赊账：业务员提交 → 财务审核 → 总经理审批 → 仓库出库','Credit: sales → finance → GM → warehouse'):L('现款：业务员提交 → 财务确认收款 → 仓库出库','Cash: sales → finance confirms payment → warehouse')}</div>
    ${d.fin?`<div class="xs muted" style="margin-top:4px">${ic('check',12)} ${L('财务','Finance')}：${esc(userName(d.fin.by))} · ${fdate(d.fin.t)}${d.fin.note?' · '+esc(d.fin.note):''}</div>`:''}${d.gmok?`<div class="xs muted">${ic('check',12)} ${L('总经理','GM')}：${esc(userName(d.gmok.by))} · ${fdate(d.gmok.t)}${d.gmok.note?' · '+esc(d.gmok.note):''}</div>`:''}
    <div class="kv" style="margin-top:14px"><div><div class="l">${L('客户','Customer')}</div><div class="v">${esc(ptName(d.cus))}</div></div><div><div class="l">${L('出货仓库','Warehouse')}</div><div class="v">${esc(whName(d.wh))}</div></div>
    <div><div class="l">${L('销售员','Sales rep')}</div><div class="v">${esc(userName(d.by))}</div></div><div><div class="l">${L('日期','Date')}</div><div class="v">${fdate(d.t)}</div></div>
    ${nm(d.addr)?`<div style="grid-column:1/3"><div class="l">${L('送货地址','Delivery address')}</div><div class="v">${esc(nm(d.addr))}</div></div>`:''}</div>
    ${d._q?`<div class="note-y" style="margin-top:12px">${ic('cloud',15)} ${L('暂存本机，联网后自动提交','Saved on this phone — submits when online')}</div>`:''}</div>
   <div class="box"><h4>${L('商品明细','Items')}</h4>${d.items.map(it=>{const p=P_(it.pid);return `<div class="li" onclick="go('product',{id:'${it.pid}'})">${thumb(p,38)}<div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted" data-notr>${n2(it.qty)} ${esc(unit(p))} × ${n2(it.price)}${it.ret?` · <span class="red">${L('已退','returned')} ${n2(it.ret)}</span>`:''}</div></div><b data-notr>${n2(lineTotal(it))}</b></div>`}).join('')}
    ${d.frt&&d.frt.amt?`<div class="row between" style="margin-top:8px"><span class="sm muted">${L('运费','Freight')} · ${d.frt.payer==='cus'?L('对方承担','customer pays'):L('我方承担（不计入货款）','we pay (not charged)')}</span><b class="sm" data-notr>${money(d.frt.amt)}</b></div>`:''}
    <div class="row between" style="margin-top:10px"><span class="muted">${L('合计','Total')} · ${d.pay==='credit'?L('赊账','credit'):L('现款','cash')}</span><b style="font-size:20px" data-notr>${money(docTotal(d))}</b></div></div>
   ${rets.length?`<div class="box"><h4>${L('退货记录','Returns')}</h4>${rets.map(r=>`<div class="li" onclick="retSheet('sr','${r.id}')"><div class="qi" style="background:var(--lilac);color:var(--purple)">${ic('ret',18)}</div><div style="flex:1;min-width:0"><div class="b sm" data-notr>${esc(r.no)}</div><div class="xs muted">${fdate(r.t)} · ${esc(nm(r.reason)||'')}</div></div><b data-notr>${n2(r.items.reduce((a,i)=>a+i.qty,0))}</b></div>`).join('')}</div>`:''}
   ${d.status!=='draft'?shipBox(shs,'out','so',d.id):''}</div>${acts.length?`<div class="bbar">${acts.join('')}</div>`:''}`};
/* 销售单审核：现款 = 财务确认收款后放行；赊账 = 财务审核 → 总经理审批后放行。仓库只能出库“待出库”的单 */
function soHead(d){const owe=arDocs().filter(s=>s.cus===d.cus&&s.id!==d.id).reduce((a,s)=>a+arOf(s).bal,0);
  return `<div class="sm muted"><span data-notr>${esc(d.no)}</span> · ${esc(ptName(d.cus))} · ${L('业务员','Sales')} ${esc(userName(d.by))}</div>
   <div style="font-size:30px;font-weight:800;margin-top:10px" data-notr>${moneyBase(docTotal(d))}</div>
   <div class="kv" style="margin-top:10px"><div><div class="l">${L('付款方式','Terms')}</div><div class="v">${d.pay==='credit'?L('赊账','Credit'):L('现款','Cash')}</div></div><div><div class="l">${L('该客户其他欠款','Other amounts owed')}</div><div class="v ${owe>0?'red':''}" data-notr>${money(owe)}</div></div>
   ${d.frt&&d.frt.amt?`<div><div class="l">${L('运费','Freight')}</div><div class="v" data-notr>${money(d.frt.amt)} · ${d.frt.payer==='cus'?L('对方承担','customer'):L('我方承担','us')}</div></div>`:''}<div><div class="l">${L('已收','Received')}</div><div class="v" data-notr>${money(arOf(d).got)}</div></div></div>`}
function soFin(id){const d=DB.get('so',id);if(!own('so_fin')||!d||d.status!=='submitted')return;const x=arOf(d);openSheet(`<div class="sh">${L('销售财务审核','Sales financial review')}</div>${soHead(d)}<div class="note-g">${L('收款由出纳登记，另一名会计逐笔核对；此处只审核订单，不自动记收款或核对。','The cashier records receipts and a different accountant verifies each receipt. This screen only reviews the order.')}</div>${d.pay==='credit'?`<input id="sfN" class="inp" placeholder="${L('审核意见','Review comment')}">`:`<div class="sm">${L('未核对','Unverified')} ${money(x.pend)} · ${L('尚缺已核对收款','Verified payment shortfall')} ${money(Math.max(0,x.tot-x.vgot))}</div>`}<div class="action-grid"><button class="bigbtn ghost" onclick="soReject('${id}')">${L('驳回','Reject')}</button><button class="bigbtn" onclick="soFinOk('${id}')">${d.pay==='credit'?L('审核通过，交总经理','Approve and send to GM'):L('审核通过，放行出库','Approve and release')}</button></div>`) }
async function soFinOk(id){const d=DB.get('so',id);if(!own('so_fin')||!d||d.status!=='submitted')return;const x=arOf(d);if(d.pay!=='credit'&&(x.vgot+0.005<x.tot||x.fs.some(f=>f.status!=='verified')))return toast(L('请先由出纳登记全额收款，再由另一名会计核对','A cashier must record full payment and a different accountant must verify it first'));if(S.reviewingSale)return;S.reviewingSale=true;try{DB.put('so',{...d,status:d.pay==='credit'?'credit_gm':'approved',fin:{by:meId(),t:Date.now(),note:d.pay==='credit'?($('#sfN')?.value||'').trim():L('已核对全额收款','Verified full payment')}});await commitBusiness([id]);closeSheet(true);render(false);toast(L('订单审核已同步','Order review synced'),false)}catch(e){toast(String(e.message||e))}finally{S.reviewingSale=false}}
function soGm(id){const d=DB.get('so',id);if(!['chair','gm'].includes(S.me.role)||d.status!=='credit_gm')return;
  openSheet(`<div class="sh">${L('审批赊账','Approve credit')}</div>${soHead(d)}${d.fin?`<div class="note-g" style="margin-top:10px">${L('财务意见：','Finance: ')}${esc(userName(d.fin.by))} · ${esc(d.fin.note||L('同意','approved'))}</div>`:''}
   <div class="fld"><label>${L('审批意见','Comment')}</label><input class="inp" id="sgN" style="background:var(--card)"></div>
   <div class="row gap" style="margin-top:14px"><button class="bigbtn dark" style="flex:1" onclick="soReject('${id}')">${L('驳回','Reject')}</button><button class="bigbtn" style="flex:1" onclick="soGmOk('${id}')">${ic('check',18)} ${L('批准赊账','Approve')}</button></div>`)}
function soGmOk(id){const d=DB.get('so',id);if(!S.me||!['chair','gm'].includes(S.me.role)||!d)return;if(d.status!=='credit_gm')return;DB.put('so',{...d,status:'approved',gmok:{by:S.me.id,t:Date.now(),note:($('#sgN').value||'').trim()}});closeSheet(true);toast(L('已批准，仓库可以出库了','Approved — the warehouse can ship'),false);render(false)}
function soReject(id){const d=DB.get('so',id);if(!d||!(d.status==='submitted'&&own('so_fin')||d.status==='credit_gm'&&['chair','gm'].includes(S.me.role)))return;openSheet(`<div class="sh">${L('驳回原因','Reason')}</div><input class="inp" id="srR" style="margin-top:10px;background:var(--card)" placeholder="${L('如：客户欠款过多，请先收款','e.g. too much owed — collect first')}">
  <button class="bigbtn" style="width:100%;margin-top:14px;background:var(--red);color:#fff" onclick="const r=$('#srR').value.trim();if(r.length<2)return toast(L('请填写驳回原因','Give a reason'));DB.put('so',{...DB.get('so','${id}'),status:'rejected',rj:r,rjBy:S.me.id});closeSheet(true);toast(L('已驳回，业务员会收到通知','Rejected — sales has been notified'));render(false)">${L('确认驳回','Reject')}</button>`)}
/* 销售出库：确认发货 → 按先到期先出扣减库存，可同时登记物流 */
function shipSheet(id){const d=DB.get('so',id);if(!can('so_ship')||!d||d.status!=='approved')return;if(new Set(d.items.map(i=>i.pid)).size!==d.items.length)return toast(L('旧单存在重复商品行，请先由管理员处理，不能重复分配库存','This legacy order has duplicate products; ask the administrator to correct it before shipping'));S.shipQty={};
  openSheet(`<div class="sh">${L('分批出库','Partial shipment')}</div><div class="sm">${esc(d.no)} · ${esc(ptName(d.cus))}</div>${d.items.map((it,n)=>{const shipped=DB.all('moves').filter(m=>m.ref===d.id&&m.pid===it.pid&&m.type==='so_out').reduce((a,m)=>a-m.qty,0),left=Math.max(0,it.qty-shipped),q=Math.min(left,availableQty(it.pid,d.wh,d.id));S.shipQty[n]=q;return `<div class="box"><b>${esc(pName(it.pid))}</b><div>${L('已发 / 待发 / 库存','Shipped / remaining / stock')}: ${shipped} / ${left} / ${qtyOf(it.pid,d.wh)}</div><label>${L('本次出库数量','Quantity this shipment')}</label><input class="inp" type="number" min="0" max="${q}" value="${q}" oninput="S.shipQty[${n}]=+this.value"></div>`}).join('')}<div class="note-g">${L('未全部发出时保留待出库；每批实际出库确认收入并固定成本。','Unshipped quantities remain open. Each actual shipment fixes revenue and cost.')}</div><button class="bigbtn" onclick="doShip('${id}')">${L('确认本次出库','Confirm this shipment')}</button>`)}
async function doShip(id){const d=DB.get('so',id);if(!can('so_ship')||!d||d.status!=='approved'||S.shipping)return;const plan=[];const shipment=uid('dispatch');
  for(let n=0;n<d.items.length;n++){const it=d.items[n],q=+(S.shipQty?.[n]||0),sent=DB.all('moves').filter(m=>m.ref===id&&m.pid===it.pid&&m.type==='so_out').reduce((a,m)=>a-m.qty,0);if(q<0||!Number.isFinite(q)||q>it.qty-sent+1e-8)return toast(L('出库数量超出未发数量','Shipment exceeds remaining quantity'));if(q===0)continue;if(q>availableQty(it.pid,d.wh,id)+1e-8)return toast(L('库存已被其他批准订单占用，请同步后重试','Stock is reserved by other approved orders; sync and retry'));const a=allocate(it.pid,d.wh,q);if(!a)return toast(L('库存不足：','Not enough stock: ')+pName(it.pid));plan.push([it,a])}
  if(!plan.length)return toast(L('请填写本次出库数量','Enter a shipment quantity'));S.shipping=true;
  try{plan.forEach(([it,a])=>a.forEach((b,n)=>addMove({id:shipment+'_'+it.pid+'_'+n,pid:it.pid,wh:d.wh,qty:-b.qty,uc:avgCost(it.pid),revenue:+it.price*b.qty,type:'so_out',ref:id,batch:b.batch||'',exp:b.exp||'',shipment})));
    const items=d.items.map(i=>({...i,shipped:DB.all('moves').filter(m=>m.ref===id&&m.pid===i.pid&&m.type==='so_out').reduce((a,m)=>a-m.qty,0)})),complete=items.every(i=>i.shipped>=i.qty-1e-8);
    DB.put('so',{...d,status:complete?'shipped':'approved',st:Date.now(),items});await commitBusiness([id,...plan.flatMap(([it,a])=>a.map((b,n)=>shipment+'_'+it.pid+'_'+n))]);closeSheet(true);toast(complete?L('全部出库已同步','Shipment completed and synced'):L('本批出库已同步，余量仍待出库','Partial shipment synced; balance remains open'),false);Alerts.low(false);render(false)
  }catch(e){toast(L('出库未确认，请核对同步状态：','Shipment not confirmed; check sync: ')+String(e.message||e))}finally{S.shipping=false}}

/* ---------- 简易盘点：录入实盘数 → 生成差异记录（不立即改账，待审核） ---------- */
V.take=()=>{if(!S.form||S.form.kind!=='take')S.form={kind:'take',wh:myWh(),items:[],note:''};const F=S.form;
  const diffs=F.items.filter(i=>i.real!==''&&+i.real!==i.sys);
  return hdr(L('库存盘点','Stock count'))+`<div class="pad"><div class="note-y" style="margin-top:4px">${L('先开始盘点并冻结仓库，再清点可售库存。待检批次在质检区单独管理。提交后由财务复核、运营或总经理终审；终审或驳回后解除冻结。','Enter the counted quantities; differences are calculated automatically. Stock only changes after an admin approves.')}</div>
   <div class="fld"><label>${L('盘点仓库','Warehouse')}</label>${whSel(F.wh,"if(S.form.countId){toast(L('盘点中不能换仓，请先结束本次盘点','Finish the active count before changing warehouse'));return}S.form.wh=this.value;render(false)")}</div>
   <div class="row gap" style="margin-top:12px"><button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="beginCount()">${ic('grid',18)} ${L('开始盘点并冻结仓库','Start count & freeze warehouse')}</button><button class="bigbtn ghost" style="height:46px;font-size:14px" onclick="openScan(L('扫码盘点','Scan to count'),c=>{const p=findByCode(c);if(!p){toast(L('未找到商品：','Not found: ')+c);return false}tkAdd(p.id)},true)">${ic('scan',18)} ${L('扫码盘点','Scan')}</button></div>
   ${F.items.map((it,i)=>{const p=P_(it.pid);const df=it.real===''?null:+it.real-it.sys;return `<div class="box" style="margin-top:10px;padding:12px 14px"><div class="row gap"><div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(p.n))}</div><div class="xs muted">${L('账面','Book')} ${n2(it.sys)} ${esc(unit(p))}</div></div>
    <input class="inp" style="width:92px;padding:8px 10px;text-align:center;font-weight:800" type="number" inputmode="decimal" placeholder="${L('实盘','Count')}" value="${it.real}" oninput="tkSet(${i},this.value)"><b id="tkd${i}" style="min-width:54px;text-align:right" class="${df>0?'green':df<0?'red':'muted'}" data-notr>${df==null?'—':(df>0?'+':'')+n2(df)}</b></div></div>`}).join('')||emptyBox('clip',L('点“载入本仓商品”或扫码开始盘点','Load items or scan to start'))}
   <div class="fld"><label>${L('备注','Note')}</label><input class="inp" value="${esc(F.note)}" oninput="S.form.note=this.value"></div></div>
  <div class="bbar"><div class="total"><span class="l">${L('差异','Differences')}</span><span class="v" id="tkN">${diffs.length}</span></div><button class="bigbtn" onclick="saveTake()">${L('提交审核','Submit for review')}</button></div>`};
function tkAdd(pid){const F=S.form;if(!F?.countId)return toast(L('请先开始盘点并冻结仓库','Start and freeze the warehouse first'));let it=F.items.find(i=>i.pid===pid);if(!it)return toast(L('该商品不在盘点快照中，请结束后重新开始','Product is outside the count snapshot; restart the count'));it.real=(+it.real||0)+1;S.formDirty=true;
  const g=$('#scLog');if(g)g.innerHTML=`<div class="note-g" style="margin-top:8px">${esc(pName(pid))} · ${L('实盘','counted')} ${it.real}</div>`}
function tkSet(i,v){const it=S.form.items[i];it.real=v===''?'':+v;const df=it.real===''?null:it.real-it.sys;const e=$('#tkd'+i);if(e){e.textContent=df==null?'—':(df>0?'+':'')+n2(df);e.className=df>0?'green':df<0?'red':'muted'}
  const n=$('#tkN');if(n)n.textContent=S.form.items.filter(x=>x.real!==''&&+x.real!==x.sys).length}
async function saveTake(){const F=S.form;if(!F?.countId||!F.integritySnapshot)return toast(L('请先开始盘点，锁定仓库并取得服务器快照','Start a stock count to freeze the warehouse and get a server snapshot'));const items=F.items.filter(i=>i.real!=='');if(!items.length||items.some(i=>!Number.isFinite(+i.real)||+i.real<0))return toast(L('请填写有效实盘数','Enter valid count quantities'));try{const d=DB.get('counts',F.countId);DB.put('counts',{...d,status:'pending',note:F.note||'',items:items.map(i=>({pid:i.pid,sys:+i.sys,real:+i.real}))});await commitBusiness([d.id]);S.form=null;toast(L('已同步，仓库保持冻结至终审或驳回','Synced; warehouse stays frozen until final approval or rejection'),false);finish('take_view',{id:d.id})}catch(e){toast(String(e.message||e))}}
V.take_view=()=>{const d=DB.get('counts',S.params.id);if(!d)return hdr('');const df=d.items.filter(i=>i.real!==i.sys);const val=df.reduce((a,i)=>a+(i.real-i.sys)*avgCost(i.pid),0);
  return hdr(L('盘点单','Stock count'))+`<div class="pad"><div class="box" style="margin-top:6px"><div class="row between"><div class="b" style="font-size:18px" data-notr>${esc(d.no)}</div>${stB(TK_ST,d.status)}</div>
   <div class="kv" style="margin-top:12px"><div><div class="l">${L('仓库','Warehouse')}</div><div class="v">${esc(whName(d.wh))}</div></div><div><div class="l">${L('盘点人','Counted by')}</div><div class="v">${esc(userName(d.by))}</div></div>
   <div><div class="l">${L('差异项','Differences')}</div><div class="v ${df.length?'red':''}">${df.length} / ${d.items.length}</div></div>${can('cost')?`<div><div class="l">${L('差异金额','Diff value')}</div><div class="v ${val<0?'red':'green'}" data-notr>${money(val)}</div></div>`:''}</div>
   <div class="xs muted" style="margin-top:12px">${L('流程：库管盘点 → 财务复核 → 运营经理或总经理终审 → 自动调整库存（互相制约）','Flow: warehouse counts → finance checks → operations manager or GM approves → stock adjusted')}</div>
   ${['pending','fin_ok'].includes(d.status)?`<div class="note-y" style="margin-top:8px">${L('差异尚未改动库存，终审通过后自动生成盘点调整。','Stock not yet changed; adjusted after final approval.')}</div>`:''}
   ${d.fv?`<div class="xs muted" style="margin-top:8px">${ic('check',12)} ${L('财务复核','Finance')}：${esc(userName(d.fv))} · ${fdate(d.ft)}</div>`:''}${d.rv?`<div class="xs muted">${ic('check',12)} ${L('终审','Final')}：${esc(userName(d.rv))} · ${fdate(d.rt)} ${d.rr?'· '+esc(d.rr):''}</div>`:''}</div>
   <div class="box"><h4>${L('明细','Lines')}<span class="sm muted">${L('账面 → 实盘','Book → Count')}</span></h4>${d.items.map(i=>{const x=i.real-i.sys;return `<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm one">${esc(pName(i.pid))}</div><div class="xs muted" data-notr>${n2(i.sys)} → ${n2(i.real)}</div></div><b class="${x>0?'green':x<0?'red':'muted'}" data-notr>${x>0?'+':''}${n2(x)}</b></div>`}).join('')||emptyBox('clip',L('暂无明细','No lines'))}</div></div>
   ${(d.status==='pending'&&own('tk_fin'))||(d.status==='fin_ok'&&can('tk_final'))?`<div class="bbar"><button class="bigbtn ghost" onclick="tkReview('${d.id}',false)">${L('驳回','Reject')}</button><button class="bigbtn" onclick="tkReview('${d.id}',true)">${d.status==='pending'?L('财务复核通过','Finance OK'):L('终审通过，调整库存','Approve & adjust')}</button></div>`:''}`};
async function tkReview(id,ok){const d=DB.get('counts',id);if(!d)return;if(!ok)return rejectCount(id);if(!d.integritySnapshot)return toast(L('旧盘点缺少冻结快照，请驳回后重新盘点','Reject this legacy count and start a new frozen count'));if(S.reviewingCount)return;if(d.status==='pending'&&!own('tk_fin')||d.status==='fin_ok'&&!can('tk_final'))return;if(d.by===meId()||d.status==='fin_ok'&&d.fv===meId())return toast(L('盘点、复核与终审必须由不同人员处理','Count, finance check and final approval require different people'));S.reviewingCount=true;try{const ids=[id];if(d.status==='pending')DB.put('counts',{...d,status:'fin_ok',fv:meId(),ft:Date.now()});else if(d.status==='fin_ok'){for(const i of d.items){const diff=+i.real-+i.sys;if(!diff)continue;const parts=diff<0?allocate(i.pid,d.wh,-diff):[{batch:'COUNT_'+d.id,qty:diff}];if(!parts)throw Error(L('盘亏超过可用批次数量','Count loss exceeds available batch stock'));for(const b of parts){const m=addMove({pid:i.pid,wh:d.wh,qty:diff<0?-b.qty:b.qty,type:'adj',ref:id,batch:b.batch,exp:b.exp||''});ids.push(m.id)}}DB.put('counts',{...d,status:'approved',rv:meId(),rt:Date.now()})}else return;await commitBusiness(ids);toast(L('盘点审核已同步','Count review synced'),false);render(false)}catch(e){toast(String(e.message||e))}finally{S.reviewingCount=false}}
/* ================= 财务：会计记账审核，出纳收付款（职责分离） =================
   应收 = 销售单金额 − 已完成退货；出纳登记收款 → 会计核对
   应付 = 采购单金额 − 已完成退货；会计审批付款 → 出纳执行付款 */
const PM={cash:['现金','Cash','cash'],bank:['银行转账','Bank','wh'],momo:['手机钱包','Mobile money','phone']};
/* 付款 / 收款凭证号随付款方式变化：现金填收据号，银行转账填银行流水号，手机钱包填交易号 */
const refLabel=m=>m==='cash'?L('收据号','Receipt no.'):m==='momo'?L('手机钱包交易号','Mobile money transaction ID'):L('银行流水号','Bank reference');
function pmPick(el,inp,req){el.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));el.classList.add('on');const i=$(inp);if(i)i.placeholder=refLabel(el.dataset.m)+(req?L('（必填）',' (required)'):L('（可选）',' (optional)'))}
const pmName=k=>L((PM[k]||PM.cash)[0],(PM[k]||PM.cash)[1]);
const FN_ST={syncing:['待同步确认','Awaiting sync','b-gold'],recorded:['待核对','To verify','b-gold'],verified:['已核对','Verified','b-green'],gm_pending:['待总经理审批','Awaiting GM','b-gold'],req:['待运营经理审批','Awaiting operations','b-gold'],rejected:['审批驳回','Rejected','b-red'],approved:['已批准待付','Approved, to pay','b-blue'],paid:['已付款','Paid','b-green'],void:['已作废','Void','b-grey']};
const soNet=s=>docTotal(s)-(s.items||[]).reduce((a,i)=>a+(+i.ret||0)*(+i.price||0),0);
/* 应付 = 采购单金额（含附加费用）+ 已批准的入库后补录费用 − 已完成的采购退货（按采购单价，供应商只退货款） */
const poNet=p=>{const grs=DB.all('grn').filter(g=>g.po===p.id).map(g=>g.id);const ret=DB.all('pr').filter(r=>grs.includes(r.grn)&&(r.status||'done')==='done').reduce((a,r)=>a+r.items.reduce((b,i)=>{const it=p.items.find(x=>x.pid===i.pid)||{};return b+i.qty*(+it.price||0)},0),0);return docTotal(p)+lcApproved(p.id)-ret};
/* 应收：got/bal 含出纳已登记、会计未核对的收款，只用于防止重复登记和放行判断；
   vgot/vbal 只算会计已核对的收款，是账面应收余额（正规做法：未核对的收款不冲减应收） */
/* 已付给客户的退款从已收中扣除；dlv=已出库（才形成应收）；excess=多收（被驳回 / 取消 / 草稿的单，已收全部算多收）；
   refundable=还可以申请退款的金额（扣掉审批中的退款） */
const SO_DEAD=['rejected','cancel','draft'];
const soDelivered=s=>['shipped','done'].includes(s.status)||(typeof financeIndex==='function'?financeIndex().dispatches.has(s.id):DB.all('moves').some(m=>m.type==='so_out'&&m.ref===s.id));
function arOf(s){const fs=(typeof financeIndex==='function'?financeIndex().receipts.get(s.id)||[]:DB.all('fin').filter(f=>f.type==='rcv'&&f.ref===s.id&&f.status!=='void'));const sum=l=>l.reduce((a,f)=>a+(+f.amount||0),0);
  const rfs=(typeof financeIndex==='function'?financeIndex().refunds.get(s.id)||[]:DB.all('refund').filter(r=>r.so===s.id&&!['void','rejected'].includes(r.status))),rfd=sum(rfs.filter(r=>r.status==='paid'&&!r._q)),rfp=sum(rfs.filter(r=>r.status!=='paid'||r._q));
  const alloc=typeof allocationNet==='function'?allocationNet(s.id):0,privateFinance=['chair','gm','ops','acct','cashier'].includes(S.me?.role),fallback=+s.paidVerified||0,got=privateFinance?sum(fs)+alloc-rfd:fallback,vgot=privateFinance?sum(fs.filter(f=>f.status==='verified'&&!f._q))+alloc-rfd:fallback,tot=soNet(s);
  const live=SO_DEAD.includes(s.status)?0:tot,due=recognizedDue(s),excess=Math.max(0,vgot-live),advance=Math.max(0,vgot-due)-excess;
  return {tot,got,vgot,pend:Math.max(0,got-vgot),bal:Math.max(0,tot-got),due,advance:Math.max(0,advance),vbal:Math.max(0,due-vgot),dlv:soDelivered(s),excess,refundable:Math.max(0,excess-rfp),rfd,rfp,rfs,fs}}
/* 应付（正规做法：货到才形成应付）：
   due  = 已到货的货款（按采购单价）+ 附加费用（首批到货后全额计入）+ 已批准的补录费用 − 已完成退货
   tot  = 订单总额，付款申请（含到货前的定金）以它为上限；已结案（done）的采购单以 due 为准
   paid = 已付款 − 已核对的供应商退款；bal = 欠供应商；adv = 预付款 / 供应商欠我方 */
function poDue(p){const goods=(p.items||[]).reduce((a,i)=>a+Math.min(+i.recv||0,+i.qty||0)*(+i.price||0),0);
  const fees=goods>0?(p.fees||[]).reduce((a,f)=>a+(+f.amt||0),0):0;return Math.max(0,goods+fees+lcApproved(p.id)-(docTotal(p)+lcApproved(p.id)-poNet(p)))}
function apOf(p){const fs=DB.all('fin').filter(f=>f.type==='pay'&&f.ref===p.id&&f.status!=='void');const sum=st=>fs.filter(f=>f.status===st&&!(st==='paid'&&f._q)).reduce((a,f)=>a+(+f.amount||0),0);
  const srs=DB.all('fin').filter(f=>f.type==='rcv'&&f.refKind==='po'&&f.ref===p.id&&f.status!=='void'),srV=srs.filter(f=>f.status==='verified'&&!f._q).reduce((a,f)=>a+(+f.amount||0),0),srP=srs.filter(f=>f.status!=='verified'||f._q).reduce((a,f)=>a+(+f.amount||0),0);
  const paid=sum('paid')-srV,appr=sum('approved')+fs.filter(f=>f.status==='paid'&&f._q).reduce((a,f)=>a+(+f.amount||0),0),req=sum('req')+sum('gm_pending'),due=poDue(p),tot=['done','cancel'].includes(p.status)?due:poNet(p);
  return {tot,due,paid,appr,req,bal:Math.max(0,due-paid),adv:Math.max(0,paid-due),srs,srP,free:Math.max(0,tot-paid-appr-req),fs}}
const arDocs=()=>DB.all('so').filter(s=>['submitted','credit_gm','approved','shipped','done'].includes(s.status));
const apDocs=()=>DB.all('po').filter(p=>['ordered','received','done'].includes(p.status)||p.status==='cancel'&&(apOf(p).adv>0.005||apOf(p).srP>0.005));
/* 资金流水：收款、采购付款、已付款的费用报销统一在这里，资金余额与日记账都用它。
   posted=false 的是出纳已登记、会计未核对的收款：列出来，但不计入余额 */
function cashEntries(){const out=[];
  DB.all('fin').forEach(f=>{if(f.status==='void')return;
    if(f.type==='rcv')out.push({src:'fin',d:f,dir:1,amount:+(f.cashAmountBase??f.amount)||0,method:f.method||'cash',t:f.t,status:f.status,posted:f.status==='verified'&&!f._q});
    else if(f.type==='pay'&&f.status==='paid')out.push({src:'fin',d:f,dir:-1,amount:+(f.cashAmountBase??f.amount)||0,method:f.method||'bank',t:f.pt||f.t,status:'paid',posted:!f._q})});
  DB.all('exp').forEach(e=>{if(e.status!=='paid')return;const pd=e.pd||{};out.push({src:'exp',d:e,dir:-1,amount:+e.amt||0,method:pd.method||'cash',t:pd.t||e.t,status:'paid',posted:!e._q})});
  DB.all('refund').forEach(r=>{if(r.status!=='paid')return;out.push({src:'refund',d:r,dir:-1,amount:+r.amount||0,method:r.method||'cash',t:r.pt||r.t,status:'paid',posted:!r._q})});
  return out}
function finSum(){const t0=dayStart(),m0=+new Date(new Date().getFullYear(),new Date().getMonth(),1);const fin=DB.all('fin').filter(f=>f.status!=='void');
  const rc=fin.filter(f=>f.type==='rcv'),ce=cashEntries(),posted=ce.filter(c=>c.posted),out=ce.filter(c=>c.dir<0&&c.posted);
  const ars=DB.all('so').map(s=>({s,x:arOf(s)})),aps=apDocs().map(p=>apOf(p));
  return {arBal:ars.filter(o=>o.x.dlv).reduce((a,o)=>a+o.x.vbal,0),
    advRcv:ars.reduce((a,o)=>a+o.x.advance,0)+(typeof customerAdvance==='function'?DB.all('partners').reduce((a,p)=>a+Math.max(0,customerAdvance(p.id,false)),0):0),
    custCredit:ars.reduce((a,o)=>a+o.x.excess,0),rfN:DB.all('refund').filter(r=>rfCanAct(r)).length,
    apBal:aps.reduce((a,x)=>a+x.bal,0),advPay:aps.reduce((a,x)=>a+x.adv,0),unverN:rc.filter(f=>f.status==='recorded').length,apprN:fin.filter(f=>f.type==='pay'&&f.status==='approved').length,reqN:fin.filter(f=>payCanReview(f)).length,rejN:fin.filter(f=>f.type==='pay'&&f.status==='rejected').length,
    rcvToday:rc.filter(f=>f.t>=t0).reduce((a,f)=>a+f.amount,0),payMonth:out.filter(c=>c.t>=m0).reduce((a,c)=>a+c.amount,0),
    cash:posted.reduce((a,c)=>a+c.dir*c.amount,0),cashPend:ce.filter(c=>!c.posted&&c.dir>0).reduce((a,c)=>a+c.amount,0)}}
function finTodo(){if(!S.me||!can('fin'))return 0;const F=finSum();return (can('fin_verify')&&S.me.role!=='gm'?F.unverN:0)+(can('fin_pay')&&S.me.role!=='gm'?F.apprN:0)+(['gm','ops'].includes(S.me.role)?F.reqN:0)+(S.me.role==='acct'?F.rejN:0)+DB.all('lcadj').filter(lcCanReview).length+F.rfN}
/* ---------- 客户退款（refund）：会计申请 → 运营经理 →（> 2000）总经理 → 出纳付款；服务器同样校验 ----------
   只能退“可退金额”：已核对收款超出该单应收的部分（多收、退货后多出来的、被驳回 / 取消的单上已收的钱） */
const RF_ST={req:['待运营经理审批','Awaiting operations','b-gold'],gm_pending:['待总经理审批','Awaiting GM','b-gold'],approved:['已批准待退款','Approved, to refund','b-blue'],paid:['已退款','Refunded','b-green'],rejected:['已驳回','Rejected','b-red'],void:['已撤回','Withdrawn','b-grey']};
const rfReady=r=>r.status==='approved'&&!!r.oby&&(+r.amount<=expLimit(r)||!!r.gby);
const rfCanReview=r=>r.by!==S.me.id&&(r.status==='req'&&['chair','ops'].includes(S.me.role)||r.status==='gm_pending'&&['chair','gm'].includes(S.me.role)&&!!r.oby);
const rfCanAct=r=>rfCanReview(r)||rfReady(r)&&['chair','cashier'].includes(S.me.role);
function rfBox(s,x){const can_=['acct','chair'].includes(S.me.role)&&x.refundable>0.005;if(!x.rfs.length&&!x.excess&&!can_)return '';
  return `<div class="box" style="padding:10px 16px"><h4>${L('客户退款','Customer refunds')}${x.excess>0.005?`<span class="sm red" data-notr>${L('多收','Over-received')} ${money(x.excess)}</span>`:''}</h4>
   ${DB.all('refund').filter(r=>r.so===s.id).sort((a,b)=>b.t-a.t).map(r=>`<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm" data-notr>${money(r.amount)}</div><div class="xs muted">${esc(userName(r.by))} · ${fdate(r.t)} · ${esc(r.reason||'')}${r.oby?' · '+L('运营','Ops')+' '+esc(userName(r.oby)):''}${r.gby?' · '+L('总经理','GM')+' '+esc(userName(r.gby)):''}${r.pby?' · '+pmName(r.method)+' '+esc(r.pref||''):''}${r.onote||r.gnote?' · '+esc(r.gnote||r.onote):''}</div></div>
     ${rfCanReview(r)?`<button class="pill g" onclick="rfReview('${r.id}')">${L('审批','Review')}</button>`:rfReady(r)&&['chair','cashier'].includes(S.me.role)?`<button class="pill g" onclick="rfPay('${r.id}')">${L('退款','Refund')}</button>`:['req','rejected'].includes(r.status)&&r.by===S.me.id?`<button class="pill w" onclick="rfVoid('${r.id}')">${L('撤回','Withdraw')}</button>`:stB(RF_ST,r.status)}</div>`).join('')}
   ${can_?`<button class="bigbtn ghost" style="width:100%;margin-top:10px;height:44px;font-size:14px" onclick="rfNew('${s.id}')">${L('申请退款给客户','Request refund to customer')} · <span data-notr>${money(x.refundable)}</span></button>`:''}
   ${x.excess>0.005&&!can_&&!x.rfs.length?`<div class="xs muted">${L('多收的钱请由会计申请退款，或与客户确认转为下次货款。','The accountant can request a refund, or agree with the customer to use it on a later order.')}</div>`:''}</div>`}
function rfNew(so){const s=DB.get('so',so),x=arOf(s);if(!(x.refundable>0.005))return;S.rf={so,method:'cash'};
  openSheet(`<div class="sh">${L('申请退款给客户','Refund to customer')}</div><div class="sm muted"><span data-notr>${esc(s.no)}</span> · ${esc(ptName(s.cus))} · ${L('可退','Refundable')} <span data-notr>${money(x.refundable)}</span></div>
   <div class="fld"><label>${L('退款金额','Amount')} (${esc(baseIso())})</label><input class="inp" id="rfA" type="number" inputmode="decimal" value="${x.refundable.toFixed(2)}" style="background:var(--card)"></div>
   <div class="fld"><label>${L('原因（必填）','Reason (required)')}</label><input class="inp" id="rfR" style="background:var(--card)" placeholder="${L('如：客户退货 2 件；重复付款','e.g. 2 items returned; paid twice')}"></div>
   <div class="fld"><label>${L('建议退款方式','Suggested method')}</label><div class="chips wrap" id="rfM">${Object.keys(PM).map(k=>`<span class="chip ${k==='cash'?'on':''}" onclick="S.rf.method='${k}';$$('#rfM .chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${pmName(k)}</span>`).join('')}</div></div>
   <button class="bigbtn" style="width:100%;margin-top:14px" onclick="rfSave()">${L('提交给运营经理审批','Send to operations')}</button>`)}
function rfSave(){const s=DB.get('so',S.rf.so),x=arOf(s),amt=Math.round((+$('#rfA').value||0)*100)/100,reason=$('#rfR').value.trim();
  if(!(amt>0))return toast(L('请填写金额','Enter the amount'));if(amt>x.refundable+0.005)return toast(L('超过可退金额','More than the refundable amount'));if(reason.length<2)return toast(L('请填写原因','Give a reason'));
  DB.put('refund',{so:s.id,cus:s.cus,amount:amt,reason,method:S.rf.method,status:'req',by:S.me.id,t:Date.now()});closeSheet(true);toast(L('已提交，等待运营经理审批','Sent for operations approval'),false);arSheet(s.id);softRender(true)}
function rfReview(id){const r=DB.get('refund',id);if(!r||!rfCanReview(r))return;const s=DB.get('so',r.so)||{};
  openSheet(`<div class="sh">${L('审批客户退款','Review customer refund')}</div><div class="sm muted"><span data-notr>${esc(s.no||'')}</span> · ${esc(ptName(r.cus))} · ${esc(userName(r.by))}</div>
   <div style="font-size:30px;font-weight:800;margin-top:12px" data-notr>${moneyBase(r.amount)}</div><div class="sm">${esc(r.reason||'')}</div>
   <div class="fld"><label>${L('意见（驳回时必填）','Comment (required to reject)')}</label><input class="inp" id="rfN" style="background:var(--card)"></div>
   <div class="row gap" style="margin-top:12px"><button class="bigbtn dark" style="flex:1" onclick="rfDecide('${id}',false)">${L('驳回','Reject')}</button><button class="bigbtn" style="flex:1" onclick="rfDecide('${id}',true)">${L('批准','Approve')}</button></div>`)}
function rfDecide(id,ok){const r=DB.get('refund',id),n=($('#rfN').value||'').trim();if(!r||!rfCanReview(r))return toast(L('这笔已处理','Already handled'));if(!ok&&n.length<2)return toast(L('请填写驳回原因','Give a reason'));
  const t=Date.now(),first=r.status==='req';
  DB.put('refund',{...r,...(first?{oby:S.me.id,ot:t,onote:n}:{gby:S.me.id,gt:t,gnote:n}),status:!ok?'rejected':first&&+r.amount>expLimit(r)?'gm_pending':'approved'});closeSheet(true);
  toast(!ok?L('已驳回','Rejected'):first&&+r.amount>expLimit(r)?L('运营经理已通过，等待总经理审批','Operations approved — awaiting GM'):L('已批准，出纳会收到退款通知','Approved — the cashier will refund'),false);softRender(true)}
function rfPay(id){const r=DB.get('refund',id);if(!r||!rfReady(r)||!['chair','cashier'].includes(S.me.role))return;
  openSheet(`<div class="sh">${L('执行退款','Pay refund')}</div><div class="sm muted">${esc(ptName(r.cus))}</div><div style="font-size:30px;font-weight:800;margin-top:12px" data-notr>${moneyBase(r.amount)}</div>
   <div class="chips wrap" style="margin-top:12px">${Object.keys(PM).map(k=>`<span class="chip ${k===(r.method||'cash')?'on':''}" data-m="${k}" onclick="pmPick(this,'#rfP',true)">${pmName(k)}</span>`).join('')}</div>
   <input class="inp" id="rfP" style="margin-top:10px;background:var(--card)" placeholder="${refLabel(r.method||'cash')}${L('（必填）',' (required)')}">
   <button class="bigbtn" style="width:100%;margin-top:14px" onclick="rfPayDo('${id}')">${L('确认已退款','Confirm refunded')}</button>`)}
function rfPayDo(id){const r=DB.get('refund',id),ref=$('#rfP').value.trim(),m=($('#sheet .chip.on')||{dataset:{}}).dataset.m||'cash';if(!r||!rfReady(r))return;if(ref.length<2)return toast(L('请填写','Enter the ')+refLabel(m));
  DB.put('refund',{...r,status:'paid',method:m,pby:S.me.id,pt:Date.now(),pref:ref});closeSheet(true);toast(L('已退款','Refunded'),false);softRender(true)}
function rfVoid(id){const r=DB.get('refund',id);if(!r||r.by!==S.me.id||!['req','rejected'].includes(r.status))return;DB.put('refund',{...r,status:'void'});closeSheet(true);toast(L('已撤回','Withdrawn'),false);softRender(true)}
/* 资金流水的说明文字：类型、单号、往来单位 */
function cashLabel(c){if(c.src==='exp'){const e=c.d;return {type:L('费用报销','Expense'),no:e.no||'',party:expName(e.cat)+' · '+userName(e.by)}}
  if(c.src==='refund'){const r=c.d;return {type:L('客户退款','Customer refund'),no:(DB.get('so',r.so)||{}).no||'',party:ptName(r.cus)}}
  const f=c.d;if(f.refKind==='customer')return {type:L('客户预收款','Customer deposit'),no:f.no||'',party:ptName(f.ref)};if(f.refKind==='open')return {type:L('期初资金','Opening balance'),no:'',party:''};const d=DB.get(f.refKind,f.ref)||{};
  return {type:f.type==='rcv'?(f.refKind==='po'?L('供应商退款','Supplier refund'):L('收款','Receipt')):L('付款','Payment'),no:d.no||'',party:ptName(d.cus||d.sup)}}
function cashRow(c){const x=cashLabel(c),f=c.d,inn=c.dir>0;
  const go_=c.src==='exp'?`expView('${f.id}')`:c.src==='refund'?(f.refKind==='customer'?`go('customer_balances')`:`arSheet('${f.so}')`):f.refKind==='customer'?`go('customer_balances')`:f.refKind==='open'?'':f.refKind==='po'||!inn?`apSheet('${f.ref}')`:`arSheet('${f.ref}')`;
  return `<div class="li" onclick="${go_}"><div class="qi" style="background:${inn?'var(--lime)':'#FCE9E5'};color:${inn?'var(--green)':'var(--red)'}">${ic(inn?'in':'out',18)}</div>
    <div style="flex:1;min-width:0"><div class="b sm one">${esc(x.type)}${x.no?' · <span data-notr>'+esc(x.no)+'</span>':''}${x.party?' · '+esc(x.party):''}</div><div class="xs muted one">${pmName(c.method)} · ${fdate(c.t)} · ${c.src==='exp'?stB(EXP_ST,'paid'):c.src==='refund'?stB(RF_ST,'paid'):stB(FN_ST,f._q?'syncing':c.status)}${c.posted?'':' · '+L('未计入余额','not in balance')}</div></div>
    <b class="${c.posted?(inn?'green':'red'):'muted'}" data-notr style="white-space:nowrap">${inn?'+':'−'}${money(c.amount)}</b></div>`}
S.finSeg='ar';S.finF='open';
V.fin=()=>{if(S.params&&S.params.seg){S.finSeg=S.params.seg;S.params={}}const seg=S.finSeg||'ar';const F=finSum();let body='';
  if(seg==='ar'){const l=arDocs().map(s=>({s,x:arOf(s)})).filter(o=>S.finF==='all'||o.x.vbal>0.005).sort((a,b)=>b.s.t-a.s.t).slice(0,120);
    const exl=DB.all('so').map(s=>({s,x:arOf(s)})).filter(o=>o.x.excess>0.005).sort((a,b)=>b.s.t-a.s.t);
    body=`${can('fin_receive')?`<button class="bigbtn ghost" style="width:100%;height:44px;font-size:14px;margin-bottom:10px" onclick="bulkRcvNew()">${ic('in',16)} ${L('按客户批量收款（一笔钱分到多张单）','Receive one payment across several orders')}</button>`:''}
     ${exl.length?`<div class="note-r" style="margin-bottom:10px">${L('客户多收 / 待退款：','Over-received / to refund: ')}${exl.map(({s,x})=>`<a class="b" style="cursor:pointer;margin-left:6px" onclick="arSheet('${s.id}')" data-notr>${esc(s.no)} ${money(x.excess)}</a>`).join('')}</div>`:''}
     <div class="chips">${[['open',L('未收清','Outstanding')],['all',L('全部','All')]].map(([k,t])=>`<span class="chip ${S.finF===k?'on':''}" onclick="S.finF='${k}';render(false)">${t}</span>`).join('')}</div>
     <div class="xs muted" style="margin:8px 2px 0">${L('出库后才形成应收；未出库的单已收的钱算“预收款”。余额只扣除会计已核对的收款，出纳已登记、未核对的单独显示为“待核对”。','A receivable arises on shipment; money on unshipped orders is a customer advance. Balances only deduct verified receipts; unverified ones show as “to verify”.')}</div>
     <div style="margin-top:12px">${l.map(({s,x})=>`<div class="wc" onclick="arSheet('${s.id}')"><div class="top"><div class="row between" style="gap:8px"><h3><span class="tt" data-notr>${esc(s.no)}</span>${x.dlv?'':`<span class="tag">${L('未出库','Not shipped')}</span>`}</h3>${x.vbal<=0.005?`<span class="badge b-green">${L('已收清','Paid')}</span>`:x.bal<=0.005?`<span class="badge b-gold">${L('已登记待核对','Recorded, to verify')}</span>`:x.got>0?`<span class="badge b-gold">${L('部分收款','Part paid')}</span>`:`<span class="badge b-red">${L('未收款','Unpaid')}</span>`}</div>
      <small>${esc(ptName(s.cus))} · ${L(SO_ST[s.status][0],SO_ST[s.status][1])}</small>
      <div class="cols"><div><span class="l">${L('应收','Due')}</span><span class="v" data-notr>${numK(x.due)}</span></div><div><span class="l">${L('已核对','Verified')}</span><span class="v" data-notr>${numK(x.vgot)}</span></div>${x.pend>0.005?`<div><span class="l">${L('待核对','To verify')}</span><span class="v" data-notr>${numK(x.pend)}</span></div>`:''}<div><span class="l">${L('余额','Balance')}</span><span class="v ${x.vbal>0?'red':''}" data-notr>${numK(x.vbal)}</span></div></div></div></div>`).join('')||emptyBox('calc',L('没有未收清的销售单','Nothing outstanding'))}</div>`}
  else if(seg==='ap'){const l=apDocs().map(p=>({p,x:apOf(p)})).filter(o=>S.finF==='all'||o.x.bal>0.005||o.x.adv>0.005||o.x.req+o.x.appr>0.005).sort((a,b)=>(b.x.req+b.x.appr>0)-(a.x.req+a.x.appr>0)||b.p.t-a.p.t);
    const lcP=DB.all('lcadj').filter(lcCanReview);
    body=(lcP.length?`<div class="note-y" style="margin-bottom:12px">${ic('calc',16)} ${L(`${lcP.length} 笔入库后补录费用待您审批：`,`${lcP.length} cost addition(s) to review:`)}${lcP.map(x=>`<a class="b" style="cursor:pointer;margin-left:6px" onclick="lcReview('${x.id}')" data-notr>${esc((DB.get('po',x.po)||{}).no||'')} ${money(x.amt)}</a>`).join('')}</div>`:'')+(['gm','ops'].includes(S.me.role)&&F.reqN?`<div class="note-y" style="margin-bottom:12px;cursor:pointer" onclick="payReview()">${ic('calc',16)} ${L(`${F.reqN} 笔付款申请待您审批，点此审批`,`${F.reqN} payment request(s) to review — tap here`)}</div>`:'')+`<div class="chips">${[['open',L('未付清','Outstanding')],['all',L('全部','All')]].map(([k,t])=>`<span class="chip ${S.finF===k?'on':''}" onclick="S.finF='${k}';render(false)">${t}</span>`).join('')}</div>
     <div style="margin-top:12px">${l.map(({p,x})=>`<div class="wc" onclick="apSheet('${p.id}')"><div class="top"><div class="row between" style="gap:8px"><h3><span class="tt" data-notr>${esc(p.no)}</span></h3>${x.req>0?`<span class="badge b-gold">${L('待运营 / 总经理审批','Awaiting operations / GM')}</span>`:x.appr>0?`<span class="badge b-blue">${L('已批准待付','Approved')}</span>`:x.adv>0.005?`<span class="badge b-blue">${p.status==='ordered'&&x.due<0.005?L('已付定金','Deposit paid'):L('多付 / 供应商欠我方','Overpaid')}</span>`:x.bal<=0.005?`<span class="badge b-green">${L('已付清','Paid')}</span>`:`<span class="badge b-red">${L('未付款','Unpaid')}</span>`}</div>
      <small>${esc(ptName(p.sup))} · ${L(PO_ST[p.status][0],PO_ST[p.status][1])}</small>
      <div class="cols"><div><span class="l">${L('已到货应付','Payable')}</span><span class="v" data-notr>${numK(x.due)}</span></div><div><span class="l">${L('已付','Paid')}</span><span class="v" data-notr>${numK(x.paid)}</span></div><div><span class="l">${x.adv>0.005?L('预付 / 供应商欠','Advance'):L('余额','Balance')}</span><span class="v ${x.bal>0?'red':''}" data-notr>${numK(x.adv>0.005?x.adv:x.bal)}</span></div></div></div></div>`).join('')||emptyBox('calc',L('没有未付清的采购单','Nothing outstanding'))}</div>`}
  else{const ce=cashEntries().sort((a,b)=>b.t-a.t);const bal={cash:0,bank:0,momo:0};
    ce.filter(c=>c.posted).forEach(c=>{bal[c.method]=(bal[c.method]||0)+c.dir*c.amount});
    body=`<div class="stats">${Object.keys(PM).map(k=>statT(k==='cash'?'g':'',numK(bal[k]||0),pmName(k),'',1)).join('')}</div>
     ${F.cashPend>0.005?`<div class="note-y" style="margin-top:10px">${L(`另有 ${F.unverN} 笔收款共 ${money(F.cashPend)} 待会计核对，核对后才计入余额。`,`${F.unverN} receipt(s) totalling ${money(F.cashPend)} await verification and are not yet in the balances.`)}</div>`:''}
     <div class="row between" style="margin:14px 2px 6px"><b>${L('收付款流水','Receipts & payments')}</b><button class="pill w" onclick="exportFin()">${ic('download',16)} Excel</button></div>
     <div class="box" style="margin-top:0;padding:4px 16px">${ce.slice(0,150).map(cashRow).join('')||emptyBox('calc',L('暂无收付款','No entries yet'))}</div>`}
  return `<div class="pad" style="padding-top:16px"><div class="row between"><div class="ptitle">${L('财务','Finance')}</div><div class="row" style="gap:8px">${curBtn()}</div></div>
   <div class="stats">${statT('g',numK(F.arBal),L('应收余额','Receivable'),"S.finSeg='ar';render(false)",1)}${statT('',numK(F.apBal),L('应付余额','Payable'),"S.finSeg='ap';render(false)")}${statT(F.unverN||F.apprN?'y':'',can('fin_pay')&&S.me.role==='cashier'?F.apprN:F.unverN,can('fin_pay')&&S.me.role==='cashier'?L('待付款','To pay'):L('待核对收款','To verify'),"S.finSeg='"+(S.me.role==='cashier'?'ap':'book')+"';render(false)")}</div>
   <div class="xs muted" style="margin:8px 2px 0" data-notr>${L('预收款','Customer advances')} ${money(F.advRcv)} · ${L('客户多收待退','Owed back to customers')} ${money(F.custCredit)} · ${L('预付款 / 供应商欠我方','Supplier advances')} ${money(F.advPay)}</div>
   <div class="xs muted" style="margin:10px 2px 0">${L('金额单位','Amounts in')} <b data-notr>${esc(CUR())} ${dispIso()}</b></div><div class="seg">${[['ar',L('应收','Receivable')],['ap',L('应付','Payable')],['book',L('资金日记账','Cash book')]].map(([k,t])=>`<button class="${seg===k?'on':''}" onclick="S.finSeg='${k}';S.finF='open';render(false)">${t}</button>`).join('')}</div>${body}</div>`};
function arSheet(id){const s=DB.get('so',id);const x=arOf(s);
  openSheet(`<div class="row between"><div class="sh" data-notr>${esc(s.no)}</div>${stB(SO_ST,s.status)}</div><div class="sm muted">${esc(ptName(s.cus))} · ${fdate(s.t)}</div>
   <div class="kv" style="margin-top:12px"><div><div class="l">${L('应收','Due')}</div><div class="v" data-notr>${money(x.due)}</div></div><div><div class="l">${L('余额（按已核对）','Balance (verified)')}</div><div class="v ${x.vbal>0&&!SO_DEAD.includes(s.status)?'red':'green'}" data-notr>${money(SO_DEAD.includes(s.status)?0:x.vbal)}</div></div><div><div class="l">${L('已核对收款','Verified')}</div><div class="v" data-notr>${money(x.vgot)}</div></div>${x.pend>0.005?`<div><div class="l">${L('待核对','To verify')}</div><div class="v" data-notr>${money(x.pend)}</div></div>`:''}${x.rfd>0.005?`<div><div class="l">${L('已退款','Refunded')}</div><div class="v" data-notr>${money(x.rfd)}</div></div>`:''}</div>
   ${!x.dlv&&!SO_DEAD.includes(s.status)&&x.vgot>0.005?`<div class="xs muted" style="margin-top:6px">${L('这张单还没出库，已收的钱目前是“预收款”，出库后才转为销售收入。','Not shipped yet: money received is a customer advance until the goods ship.')}</div>`:''}
   ${SO_DEAD.includes(s.status)&&x.vgot>0.005?`<div class="note-r" style="margin-top:8px">${L('这张单已驳回 / 取消 / 退回草稿，但已收了钱：请申请退款，或在客户同意后重新开单。','This order is rejected / cancelled / back to draft but money was received: refund it, or re-issue the order with the customer’s agreement.')}</div>`:''}
   <div class="box" style="padding:6px 16px">${x.fs.map(f=>`<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm">${pmName(f.method)} · <span data-notr>${money(f.amount)}</span></div><div class="xs muted">${fdate(f.t)} · ${L('出纳','Cashier')} ${esc(userName(f.by))}${f.vby?' · '+L('会计','Accountant')+' '+esc(userName(f.vby)):''}${nm(f.note)?' · '+esc(nm(f.note)):''}</div></div>
     ${f.status==='recorded'&&own('fin_verify')&&f.by!==meId()?`<button class="pill g" onclick="finVerify('${f.id}','${id}')">${L('核对','Verify')}</button>`:stB(FN_ST,f.status)}</div>`).join('')||`<div class="sm muted" style="padding:10px 0">${L('还没有收款记录','No receipts yet')}</div>`}</div>
   ${rfBox(s,x)}
   ${s.status==='submitted'&&own('so_fin')?`<button class="bigbtn" style="width:100%;margin-top:14px" onclick="soFin('${id}')">${s.pay==='credit'?L('赊销：拒绝 / 直报总经理审批','Credit: reject / send to GM'):L('审核收款并放行出库','Verify payment & release')}</button>`:''}
   ${s.status==='credit_gm'&&S.me.role==='gm'?`<button class="bigbtn" onclick="soGm('${id}')">${L('赊销审批：通过 / 拒绝','Credit: approve / reject')}</button>`:''}
   ${can('fin_receive')&&x.bal>0.005&&!SO_DEAD.includes(s.status)?`<div class="sec-h" style="margin-top:16px">${L('登记收款','Record receipt')}</div><div class="row gap"><input class="inp" id="rcA" type="number" inputmode="decimal" value="${(+x.bal).toFixed(2)}" style="background:var(--card)"><span class="b" data-notr>${esc(baseIso())}</span></div>
     <div class="chips wrap" style="margin-top:10px">${Object.keys(PM).map((k,i)=>`<span class="chip ${i?'':'on'}" data-m="${k}" onclick="pmPick(this,'#rcN',false)">${pmName(k)}</span>`).join('')}</div>
     <input class="inp" id="rcN" style="margin-top:10px;background:var(--card)" placeholder="${refLabel('cash')}${L('（可选）',' (optional)')}">
     <button class="bigbtn" style="width:100%;margin-top:14px" onclick="finRecv('${id}')">${ic('check',18)} ${L('确认收款','Confirm receipt')}</button>`:''}
   ${!can('fin_receive')&&x.bal>0.005&&can('fin')?`<div class="note-y" style="margin-top:12px">${L('收款由出纳登记，会计负责核对。','The cashier records receipts; the accountant verifies them.')}</div>`:''}`)}
function finRecv(id){const s=DB.get('so',id);const x=arOf(s);const amt=+$('#rcA').value;if(SO_DEAD.includes(s.status))return toast(L('这张单已驳回或取消，不能再收款','This order is rejected or cancelled'));if(!(amt>0))return toast(L('请输入收款金额','Enter an amount'));if(amt>x.bal+0.005)return toast(L('超过未收余额','More than the balance'));
  const m=($('#sheet .chip.on')||{}).dataset.m||'cash';DB.put('fin',{type:'rcv',ref:id,refKind:'so',accountId:S.moneyAccount,amount:amt,method:m,note:$('#rcN').value.trim(),status:'recorded',t:Date.now()});
  toast(L('已登记收款，等待会计核对','Receipt recorded — waiting for the accountant'),false);arSheet(id);softRender(true)}
/* 按客户批量收款：客户一次付一笔钱，按开单先后自动分到多张未收清的单（可手动调整），每张单生成一条待核对收款，凭证号相同 */
const bulkOpen=cus=>DB.all('so').filter(s=>s.cus===cus&&['submitted','credit_gm','approved','shipped','done'].includes(s.status)).map(s=>({s,x:arOf(s)})).filter(o=>o.x.bal>0.005).sort((a,b)=>a.s.t-b.s.t);
function bulkAuto(){const b=S.br;let left=+b.amt||0;b.alloc={};bulkOpen(b.cus).forEach(({s,x})=>{const v=Math.min(left,x.bal);if(v>0.005){b.alloc[s.id]=Math.round(v*100)/100;left-=v}})}
function bulkRcvNew(){if(!can('fin_receive'))return;S.br={cus:'',amt:'',alloc:{},method:'bank'};bulkRcvSheet()}
function bulkRcvSheet(){const b=S.br,l=b.cus?bulkOpen(b.cus):[],sum=Object.values(b.alloc).reduce((a,v)=>a+(+v||0),0),open=l.reduce((a,o)=>a+o.x.bal,0);
  openSheet(`<div class="sh">${L('按客户批量收款','Receive across orders')}</div>
   <div class="fld"><label>${L('客户','Customer')}</label>${partnerSel('cus',b.cus,"S.br.cus=this.value;S.br.alloc={};bulkAuto();bulkRcvSheet()")}</div>
   ${b.cus?`<div class="xs muted">${L('未收清','Outstanding')} ${l.length} ${L('张单，合计','orders, total')} <span data-notr>${money(open)}</span></div>
   <div class="fld"><label>${L('本次收到金额','Amount received')} (${esc(baseIso())})</label><input class="inp" id="brA" type="number" inputmode="decimal" value="${b.amt}" style="background:var(--card)" onchange="S.br.amt=this.value;bulkAuto();bulkRcvSheet()"></div>
   <div class="chips wrap" style="margin-top:10px">${Object.keys(PM).map(k=>`<span class="chip ${k===b.method?'on':''}" data-m="${k}" onclick="S.br.method='${k}';pmPick(this,'#brR',true)">${pmName(k)}</span>`).join('')}</div>
   <input class="inp" id="brR" style="margin-top:10px;background:var(--card)" value="${esc(b.ref||'')}" oninput="S.br.ref=this.value" placeholder="${refLabel(b.method)}${L('（必填）',' (required)')}">
   <div class="box" style="padding:6px 16px">${l.map(({s,x})=>`<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm" data-notr>${esc(s.no)}</div><div class="xs muted">${fdate(s.t,false)} · ${L('未收','Open')} <span data-notr>${money(x.bal)}</span></div></div>
     <input class="inp" type="number" inputmode="decimal" style="width:110px;flex:none;padding:8px;background:var(--soft)" value="${b.alloc[s.id]||''}" oninput="S.br.alloc['${s.id}']=+this.value;$('#brS').textContent=money(Object.values(S.br.alloc).reduce((a,v)=>a+(+v||0),0))"></div>`).join('')||`<div class="sm muted" style="padding:10px 0">${L('这个客户没有未收清的单','Nothing outstanding for this customer')}</div>`}</div>
   <div class="row between sm" style="margin-top:8px"><span>${L('已分配','Allocated')}</span><b id="brS" data-notr>${money(sum)}</b></div>
   <div class="xs muted" style="margin-top:4px">${L('未分配的金额会自动登记为该客户的预收款，等待另一名会计核对。','Unallocated money is recorded as a customer advance for a different accountant to verify.')}</div>
   <button class="bigbtn" style="width:100%;margin-top:12px" onclick="bulkRcvSave()">${ic('check',18)} ${L('确认收款，交会计核对','Record and send for verification')}</button>`:''}`)}
function bulkRcvSave(){const b=S.br,amt=Math.round((+b.amt||0)*100)/100,ref=(b.ref||'').trim(),l=bulkOpen(b.cus);if(!(amt>0))return toast(L('请填写金额','Enter the amount'));if(ref.length<2)return toast(L('请填写','Enter the ')+refLabel(b.method));
  const rows=l.map(({s,x})=>({s,x,v:Math.round((+b.alloc[s.id]||0)*100)/100})).filter(o=>o.v>0);const sum=Math.round(rows.reduce((a,o)=>a+o.v,0)*100)/100;
  if(sum>amt+0.005)return toast(L('分配合计不能超过收到金额','Allocations exceed the amount received'));
  const bad=rows.find(o=>o.v>o.x.bal+0.005);if(bad)return toast(L('超过未收余额：','More than open balance: ')+bad.s.no);
  const batch=genNo('RB');rows.forEach(o=>DB.put('fin',{type:'rcv',ref:o.s.id,refKind:'so',accountId:S.moneyAccount,amount:o.v,method:b.method,note:ref,pref:ref,batch,status:'recorded',t:Date.now()}));
  const remainder=Math.round((amt-sum)*100)/100;if(remainder>0.005)DB.put('fin',{type:'rcv',ref:b.cus,refKind:'customer',amount:remainder,method:b.method,note:ref,pref:ref,batch,status:'recorded',t:Date.now()});
  closeSheet(true);toast(L(`已登记 ${rows.length} 张单的收款，等待会计核对`,`Recorded on ${rows.length} orders — waiting for verification`),false);softRender(true)}
async function finVerify(fid,so){if(!own('fin_verify'))return;const f=DB.get('fin',fid);if(!f||f.status!=='recorded')return;if(f.by===meId())return toast(L('不能核对本人登记的收款，请另一名会计处理','A different accountant must verify your receipt'));if(S.verifyingReceipt)return;S.verifyingReceipt=true;try{DB.put('fin',{...f,status:'verified',vby:meId(),vt:Date.now()});await commitBusiness([fid]);toast(L('已核对并同步；订单放行请单独审核','Verified and synced; review the order separately to release it'),false);arSheet(so);softRender(true)}catch(e){toast(String(e.message||e))}finally{S.verifyingReceipt=false}}
/* ===== 付款审批流程：会计提交付款申请 → 总经理审批（批准 / 驳回）→ 出纳按批准金额付款 ===== */
const PAY_PURP={dep:['预付款 / 定金','Deposit / advance'],goods:['货款','Goods payment'],final:['尾款','Final payment'],freight:['运费 / 清关','Freight / clearance'],other:['其他','Other']};
const purpName=k=>{const p=PAY_PURP[k]||PAY_PURP.other;return L(p[0],p[1])};
/* 每笔付款的过程记录：谁申请、谁批准 / 驳回、谁付款 */
function payTrail(f){const st=(ic_,c,t,who,at,note)=>`<div class="row" style="gap:8px;align-items:flex-start;margin-top:6px"><span style="color:${c};flex:none">${ic(ic_,14)}</span><div class="xs" style="flex:1;min-width:0"><b>${t}</b> · ${esc(userName(who))} · ${fdate(at)}${note?`<div class="muted">${esc(note)}</div>`:''}</div></div>`;
  let h=st('doc','var(--purple)',L('会计申请','Requested by accountant'),f.by,f.at||f.t,[purpName(f.purp),f.due?L('希望 ','wanted by ')+fday(f.due):'',nm(f.note)].filter(Boolean).join(' · '));
  if(f.oby)h+=st('check','var(--green)',L('运营经理审批','Operations review'),f.oby,f.ot,f.onote);
  if(f.gby)h+=st(f.status==='rejected'?'x':'check',f.status==='rejected'?'var(--red)':'var(--green)',f.status==='rejected'?L('总经理驳回','Rejected by GM'):L('总经理批准','Approved by GM'),f.gby,f.gt,f.gnote);
  if(f.pby)h+=st('out','var(--orange)',L('出纳付款','Paid by cashier'),f.pby,f.pt,[pmName(f.method),f.pref].filter(Boolean).join(' · '));
  if(f.status==='void')h+=`<div class="xs muted" style="margin-top:6px">${L('已撤回作废','Withdrawn')}</div>`;return h}
/* 供应商退款：多付给供应商的钱（预付款超过已到货应付）退回时，出纳登记 → 会计核对，核对后冲减已付 */
function supRefundBox(p,x){const can_=can('fin_receive')&&x.adv-x.srP>0.005;if(!x.srs.length&&!can_)return '';
  return `<div class="box" style="padding:6px 16px"><h4>${L('供应商退款','Supplier refunds')}</h4>${x.srs.map(f=>`<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="b sm">${pmName(f.method)} · <span data-notr>${money(f.amount)}</span></div><div class="xs muted">${fdate(f.t)} · ${esc(userName(f.by))}${f.note?' · '+esc(f.note):''}${f.vby?' · '+L('会计','Accountant')+' '+esc(userName(f.vby)):''}</div></div>
    ${f.status==='recorded'&&own('fin_verify')&&f.by!==S.me.id?`<button class="pill g" onclick="supRefundVerify('${f.id}')">${L('核对','Verify')}</button>`:stB(FN_ST,f.status)}</div>`).join('')}
   ${can_?`<div class="row gap" style="margin-top:8px"><input class="inp" id="srA" type="number" inputmode="decimal" value="${(x.adv-x.srP).toFixed(2)}" style="background:var(--card)"><span class="b" data-notr>${esc(baseIso())}</span></div>
    <div class="chips wrap" style="margin-top:8px">${Object.keys(PM).map((k,i)=>`<span class="chip ${k==='bank'?'on':''}" data-m="${k}" onclick="pmPick(this,'#srN',true)">${pmName(k)}</span>`).join('')}</div>
    <input class="inp" id="srN" style="margin-top:8px;background:var(--card)" placeholder="${refLabel('bank')}${L('（必填）',' (required)')}">
    <button class="bigbtn ghost" style="width:100%;margin-top:10px;height:44px;font-size:14px" onclick="supRefundSave('${p.id}')">${L('登记供应商退款','Record supplier refund')}</button>`:''}</div>`}
function supRefundSave(po){const p=DB.get('po',po),x=apOf(p),amt=Math.round((+$('#srA').value||0)*100)/100,ref=$('#srN').value.trim(),m=($('#sheet .chip.on')||{dataset:{}}).dataset.m||'bank';
  if(!can('fin_receive'))return;if(!(amt>0))return toast(L('请填写金额','Enter the amount'));if(amt>x.adv-x.srP+0.005)return toast(L('超过供应商欠我方的金额','More than the supplier owes'));if(ref.length<2)return toast(L('请填写','Enter the ')+refLabel(m));
  DB.put('fin',{type:'rcv',ref:po,refKind:'po',accountId:S.moneyAccount,amount:amt,method:m,note:ref,pref:ref,status:'recorded',t:Date.now()});toast(L('已登记，等待会计核对','Recorded — waiting for the accountant'),false);apSheet(po);softRender(true)}
function supRefundVerify(fid){const f=DB.get('fin',fid);if(!own('fin_verify')||!f||f.status!=='recorded'||f.by===S.me.id)return;DB.put('fin',{...f,status:'verified',vby:S.me.id,vt:Date.now()});toast(L('已核对','Verified'),false);apSheet(f.ref);softRender(true)}
function apSheet(id){const p=DB.get('po',id);const x=apOf(p);const me=S.me.role;
  const acts=f=>{let b='';
    if(payCanReview(f))b+=`<button class="pill g" onclick="payGm('${f.id}')">${L('审批','Review')}</button>`;
    if(payReady(f)&&own('fin_pay'))b+=`<button class="pill g" onclick="finPaySheet('${f.id}')">${L('付款','Pay')}</button>`;
    if(f.status==='approved'&&['gm','ops'].includes(me))b+=`<button class="pill w" style="margin-left:6px" onclick="payUnapprove('${f.id}')">${L('撤销批准','Undo approval')}</button>`;
    if(['req','rejected'].includes(f.status)&&(me==='acct'||me==='gm'))b+=`${f.status==='rejected'?`<button class="pill g" onclick="payReqSheet('${id}','${f.id}')">${L('修改后重新提交','Edit & resubmit')}</button>`:''}<button class="pill w" style="margin-left:6px" onclick="finVoid('${f.id}','${id}')">${L('撤回','Withdraw')}</button>`;
    return b||stB(FN_ST,f.status)};
  openSheet(`<div class="row between"><div class="sh" data-notr>${esc(p.no)}</div>${stB(PO_ST,p.status)}</div><div class="sm muted">${esc(ptName(p.sup))} · ${fdate(p.t)}</div>
   <div class="kv" style="margin-top:12px"><div><div class="l">${L('订单总额','Order total')}</div><div class="v" data-notr>${money(x.tot)}</div></div><div><div class="l">${L('已到货应付','Payable (received)')}</div><div class="v" data-notr>${money(x.due)}</div></div><div><div class="l">${L('已付（扣供应商退款）','Paid (net of refunds)')}</div><div class="v" data-notr>${money(x.paid)}</div></div><div><div class="l">${L('审批中 / 已批准待付','In review / approved')}</div><div class="v" data-notr>${money(x.req)} / ${money(x.appr)}</div></div><div><div class="l">${L('欠供应商','Owed to supplier')}</div><div class="v ${x.bal>0?'red':'green'}" data-notr>${money(x.bal)}</div></div>${x.adv>0.005?`<div><div class="l">${L('预付款 / 供应商欠我方','Advance / supplier owes us')}</div><div class="v" data-notr>${money(x.adv)}</div></div>`:''}</div>
   <div class="xs muted" style="margin-top:6px">${L('货到才形成应付；到货前付的定金是预付款。退货或按实到结案后多付的钱，记为供应商欠我方，供应商退回时由出纳登记、会计核对。','Payables arise on receipt; deposits before that are advances. Overpayment after returns or short closure is owed back by the supplier; the cashier records the refund and the accountant verifies it.')}</div>
   ${supRefundBox(p,x)}
   <div class="xs muted" style="margin-top:6px">${L('流程：会计申请 → 运营经理批准 → 超过复审门槛再由总经理批准 → 出纳付款','Flow: accountant requests → GM approves → cashier pays')}</div>
   <div class="box" style="padding:6px 16px">${x.fs.slice().sort((a,b)=>b.t-a.t).map(f=>`<div class="li" style="cursor:default;align-items:flex-start"><div style="flex:1;min-width:0"><div class="row" style="gap:8px"><b class="sm" data-notr>${money(f.amount)}</b>${stB(FN_ST,f.status)}</div>${payTrail(f)}</div><div style="flex:none;display:flex;flex-direction:column;gap:6px;align-items:flex-end">${acts(f)}</div></div>`).join('')||`<div class="sm muted" style="padding:10px 0">${L('还没有付款申请','No payment requests yet')}</div>`}</div>
   ${(me==='acct'||me==='gm')&&x.free>0.005?`<button class="bigbtn" style="width:100%;margin-top:14px" onclick="payReqSheet('${id}')">${ic('plus',18)} ${L('提交付款申请（运营经理先审批）','Request payment (operations first)')}</button>`:''}
   ${me!=='acct'&&me!=='gm'&&x.free>0.005?`<div class="note-y" style="margin-top:12px">${L('付款流程：会计提交申请 → 运营经理批准 → 超过复审门槛再由总经理批准 → 出纳付款。','Flow: the accountant requests, the GM approves, then the cashier pays.')}</div>`:''}`)}
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
   <button class="bigbtn" style="width:100%;margin-top:12px" onclick="payReqSave('${po}','${fid||''}')">${L('提交给运营经理审批','Send to operations for approval')}</button>`);
}
function payReqSave(po,fid){const x=apOf(DB.get('po',po)),f=fid?DB.get('fin',fid):null,e=$('#pqE');const amt=+$('#pqA').value,note=$('#pqN').value.trim(),due=$('#pqD').value;
  if(!(amt>0))return e.textContent=L('请输入金额','Enter an amount');if(amt>x.free+0.005)return e.textContent=L('超过可申请金额','More than can be requested');
  if(note.length<2)return e.textContent=L('请填写申请说明','Enter a reason');
  const d={...(f||{type:'pay',ref:po,refKind:'po'}),amount:+amt.toFixed(2),purp:S.pq.purp,method:S.pq.method,due:due?+new Date(due):0,note,status:'req',at:Date.now(),t:f?f.t:Date.now()};
  delete d.oby;delete d.ot;delete d.onote;delete d.gby;delete d.gt;delete d.gnote;DB.put('fin',d);closeSheet(true);toast(L('已提交，等待总经理审批','Sent — waiting for the GM'),false);apSheet(po);softRender(true)}
/* 总经理：逐笔审批，可批准或驳回（驳回需写原因） */
const payCanReview=f=>f.type==='pay'&&(['chair','ops'].includes(S.me.role)&&f.status==='req'||['chair','gm'].includes(S.me.role)&&f.status==='gm_pending'&&!!f.oby);
const payReady=f=>f.status==='approved'&&!!f.oby&&(+f.amount<=expLimit(f)||!!f.gby);
function payGm(fid){const f=DB.get('fin',fid);if(!f||!payCanReview(f))return;const p=DB.get('po',f.ref),x=apOf(p);
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
function payGmDo(fid,ok){const f=DB.get('fin',fid),n=$('#pgN').value.trim();if(!f||!payCanReview(f))return toast(L('这笔申请已处理','Already handled'));
  if(!ok&&n.length<2)return $('#pgE').textContent=L('驳回请写明原因','Give a reason for rejecting');
  const ops=['chair','ops'].includes(S.me.role);DB.put('fin',{...f,status:ok?(ops&&f.amount>expLimit(f)?'gm_pending':'approved'):'rejected',...(ops?{oby:S.me.id,ot:Date.now(),onote:n}:{gby:S.me.id,gt:Date.now(),gnote:n})});closeSheet(true);
  toast(ok?(ops&&f.amount>expLimit(f)?L('运营经理已通过，等待总经理审批','Operations approved — awaiting GM'):L('已批准，出纳会收到付款通知','Approved — the cashier has been notified')):L('已驳回，会计会收到通知','Rejected — the accountant has been notified'),false);apSheet(f.ref);softRender(true)}
function payUnapprove(fid){const f=DB.get('fin',fid);if(!['gm','ops'].includes(S.me.role)||f.status!=='approved')return;DB.put('fin',{...f,status:'req',oby:null,ot:null,onote:'',gby:null,gt:null,gnote:''});toast(L('已撤销批准，回到待审批','Approval undone'),false);apSheet(f.ref);softRender(true)}
/* 总经理：所有待审批的付款申请 */
function payReview(){const l=DB.all('fin').filter(f=>payCanReview(f)).sort((a,b)=>(a.due||a.t)-(b.due||b.t));
  openSheet(`<div class="sh">${L('付款申请待审批','Payment requests to review')}</div>
   <div class="box" style="padding:4px 16px">${l.map(f=>{const p=DB.get('po',f.ref)||{};return `<div class="li" onclick="payGm('${f.id}')"><div class="qi" style="background:#FFF4D6;color:#8a6200">${ic('calc',18)}</div><div style="flex:1;min-width:0"><div class="b sm one"><span data-notr>${esc(p.no||'')}</span> · ${esc(ptName(p.sup))}</div><div class="xs muted one">${purpName(f.purp)} · ${esc(userName(f.by))} · ${f.due?L('希望 ','by ')+fday(f.due):fdate(f.t)}</div></div><b data-notr style="white-space:nowrap">${money(f.amount)}</b></div>`}).join('')||`<div class="sm muted" style="padding:12px 0">${L('没有待审批的付款','Nothing to review')}</div>`}</div>`)}
function finVoid(fid,po){const f=DB.get('fin',fid);if(!['req','rejected'].includes(f.status))return toast(L('已批准的付款只能由总经理撤销','Only the GM can undo an approved payment'));DB.put('fin',{...f,status:'void'});toast(L('已撤回','Withdrawn'),false);apSheet(po);softRender(true)}
/* 出纳：只能按总经理批准的金额付款 */
function finPaySheet(fid){const f=DB.get('fin',fid);const p=DB.get('po',f.ref);if(!own('fin_pay')||!payReady(f))return toast(L('需要运营经理审批；超过该单复审门槛还需总经理审批','Operations approval required; over the document threshold also needs GM approval'));
  openSheet(`<div class="sh">${L('执行付款','Make payment')}</div><div class="sm muted"><span data-notr>${esc(p.no)}</span> · ${esc(ptName(p.sup))}</div>
   <div style="font-size:30px;font-weight:800;margin-top:12px" data-notr>${moneyBase(f.amount)}</div>
   <div class="box" style="padding:10px 14px">${payTrail(f)}</div>
   <div class="chips wrap" style="margin-top:12px">${Object.keys(PM).map(k=>`<span class="chip ${k===(f.method||'bank')?'on':''}" data-m="${k}" onclick="pmPick(this,'#pyN',true)">${pmName(k)}</span>`).join('')}</div>
   <input class="inp" id="pyN" style="margin-top:10px;background:var(--card)" placeholder="${refLabel(f.method||'bank')}${L('（必填）',' (required)')}">
   <button class="bigbtn" style="width:100%;margin-top:14px" onclick="finPay('${fid}')">${ic('check',18)} ${L('确认已付款','Confirm paid')}</button>`)}
function finPay(fid){const f=DB.get('fin',fid);if(!own('fin_pay')||!payReady(f))return toast(L('需要运营经理审批；超过该单复审门槛还需总经理审批','Operations approval required; over the document threshold also needs GM approval'));const ref=$('#pyN').value.trim();if(ref.length<2)return toast(L('请填写','Enter the ')+refLabel(($('#sheet .chip.on')||{dataset:{}}).dataset.m));
  const m=($('#sheet .chip.on')||{}).dataset.m||'bank';DB.put('fin',{...f,status:'paid',accountId:S.moneyAccount,method:m,pby:S.me.id,pt:Date.now(),pref:ref});
  toast(L('已付款','Paid'),false);apSheet(f.ref);softRender(true)}
/* 资金日记账导出：含费用报销付款；待核对的收款列出但不计入余额和合计 */
function exportFin(){const ce=cashEntries().sort((a,b)=>a.t-b.t);let bal=0,tin=0,tout=0;
  exportXlsx(L('资金日记账','CashBook'),[{name:L('资金日记账','Cash book'),title:L('资金日记账','Cash book'),money:[5,6,7],
   head:[L('日期','Date'),L('类型','Type'),L('单号','Ref'),L('往来单位','Party'),L('方式','Method'),L('收入','In'),L('支出','Out'),L('余额','Balance'),L('状态','Status'),L('经手人','By')],
   rows:ce.map(c=>{const x=cashLabel(c),f=c.d;const v=+conv(c.amount).toFixed(2);if(c.posted){bal+=c.dir*v;if(c.dir>0)tin+=v;else tout+=v}
     const st=c.src==='exp'?L(EXP_ST.paid[0],EXP_ST.paid[1]):c.src==='refund'?L(RF_ST.paid[0],RF_ST.paid[1]):L(FN_ST[c.status][0],FN_ST[c.status][1])+(c.posted?'':L('（未计入余额）',' (not in balance)'));
     return [fday(c.t),x.type,x.no,x.party,pmName(c.method),c.dir>0?v:null,c.dir<0?v:null,+bal.toFixed(2),st,userName(c.src==='exp'?((f.pd||{}).by||f.by):(f.pby||f.by))]}),
   total:[L('合计（已计入余额）','Total (posted)'),'','','','',+tin.toFixed(2),+tout.toFixed(2),+bal.toFixed(2),'','']}])}

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
    return `<div class="wc" onclick="go('ship_view',{id:'${s.id}'})"><div class="top"><div class="row between" style="gap:8px"><h3><span class="qi" style="display:inline-grid;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:var(--soft)">${ic(MODES[s.mode||c.mode][2],15)}</span><span class="tt">${esc(nm(c))}</span><span class="tag">${s.dir==='in'?L('到货','In'):L('发货','Out')}</span></h3>${stB(SH_ST,s.status)}</div>
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
  if(e.st==='delivered'&&s.refKind==='so'){const so=DB.get('so',s.ref);if(so&&so.status==='shipped')toast(L('物流已送达；请完成客户拍照签名后确认销售完成','Delivery arrived; obtain the customer photo and signature to complete the sale'),false)}
  closeSheet();toast(L('已更新物流状态','Status updated'));render(false)}
V.ship_new=()=>{if(!S.form||S.form.kind!=='ship'){const p=S.params;const ref=p.ref&&DB.get(p.refKind,p.ref);
    S.form={kind:'ship',dir:p.dir||'out',refKind:p.refKind||'',ref:p.ref||'',carrier:p.dir==='in'?'cosco':'own',mode:p.dir==='in'?'sea':'road',trackNo:'',container:'',from:'',to:'',eta:fday(Date.now()+(p.dir==='in'?20:1)*864e5),cost:'',driver:''};
    if(ref){if(p.refKind==='so'){S.form.from=whName(ref.wh);S.form.to=nm(ref.addr)||ptName(ref.cus)}else{S.form.from=nm((DB.get('partners',ref.sup)||{}).city);S.form.to=whName(ref.wh)}}}
  const F=S.form;if(!F.costManual&&(+F.kg||+F.cbm))F.cost=frCost(F.mode,F.kg,F.cbm).costB;const refs=F.dir==='out'?DB.all('so').filter(s=>['approved','shipped'].includes(s.status)):DB.all('po').filter(p=>['ordered','received'].includes(p.status));
  const fld=(k,t,ph,type)=>`<div class="fld"><label>${t}</label><input class="inp" ${type?`type="${type}"`:''} value="${esc(F[k])}" placeholder="${ph||''}" oninput="S.form.${k}=this.value"></div>`;
  return hdr(L('登记物流','New shipment'))+`<div class="pad"><div class="seg">${[['out',L('发货（销售）','Outbound')],['in',L('到货（采购）','Inbound')]].map(([k,t])=>`<button class="${F.dir===k?'on':''}" onclick="S.form.dir='${k}';S.form.ref='';S.form.refKind='${k==='out'?'so':'po'}';render(false)">${t}</button>`).join('')}</div>
   <div class="fld"><label>${L('关联单据（可选）','Linked order (optional)')}</label><select class="inp" onchange="S.form.ref=this.value;S.form.refKind='${F.dir==='out'?'so':'po'}'"><option value="">${L('不关联','None')}</option>${refs.map(r=>`<option value="${r.id}" ${r.id===F.ref?'selected':''}>${esc(r.no)} · ${esc(ptName(r.cus||r.sup))}</option>`).join('')}</select></div>
   <div class="fld"><label>${L('承运商','Carrier')}</label><select class="inp" onchange="S.form.carrier=this.value;S.form.mode=carrier(this.value).mode;render(false)">${CARRIERS.map(c=>`<option value="${c.id}" ${c.id===F.carrier?'selected':''}>${esc(nm(c))}</option>`).join('')}</select></div>
   <div class="chips wrap" style="margin-top:10px">${Object.keys(MODES).map(k=>`<span class="chip sm ${F.mode===k?'on':''}" onclick="S.form.mode='${k}';if(!S.form.costManual&&(+S.form.kg||+S.form.cbm))S.form.cost=frCost('${k}',S.form.kg,S.form.cbm).costB;render(false)">${ic(MODES[k][2],14)} ${L(MODES[k][0],MODES[k][1])}</span>`).join('')}</div>
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
V.logi_svc=()=>{fcInit();loadFxCNY();const bk=DB.all('svc').sort((a,b)=>b.t-a.t);
  const BK={new:['待处理','New','b-gold'],confirmed:['已安排','Scheduled','b-blue'],done:['已完成','Done','b-green'],cancel:['已取消','Cancelled','b-grey']};
  return hdr(L('物流服务','Logistics services'))+`<div class="pad">
   ${fcBox()}
   <div class="sec-h">${L('预约物流','Book logistics')}<a onclick="bookSheet()">+ ${L('新预约','New')}</a></div>
   <div class="box" style="margin-top:0;padding:4px 16px">${bk.map(b=>`<div class="li" onclick="${S.me.role==='gm'?`bookAdmin('${b.id}')`:''}"><div class="qi">${ic(b.type==='customs'?'shield':'calendar',18)}</div><div style="flex:1;min-width:0"><div class="b sm one">${{pickup:L('上门提货','Pickup'),delivery:L('送货上门','Delivery'),customs:L('代理报关','Customs clearance')}[b.type]} · ${esc(nm(b.from))} → ${esc(nm(b.to))}</div><div class="xs muted one">${esc(b.date||'')} · ${n2(b.weight||0)} kg · ${esc(userName(b.by))}</div></div><span class="badge ${BK[b.status][2]}">${L(BK[b.status][0],BK[b.status][1])}</span></div>`).join('')||`<div class="sm muted" style="padding:12px 0">${L('还没有预约','No bookings yet')}</div>`}</div>
   <div class="sec-h">${L('承运商官网查询','Carrier tracking sites')}</div>
   <div class="box" style="margin-top:0;padding:4px 16px">${CARRIERS.filter(c=>c.url).map(c=>`<div class="li" onclick="const n=prompt('${L('输入运单号 / 柜号','Enter tracking / container no.')}');if(n)openExt('${c.url}'.replace('{no}',encodeURIComponent(n.trim())))"><div class="qi">${ic(MODES[c.mode][2],18)}</div><div style="flex:1;min-width:0"><div class="b sm">${esc(nm(c))}</div><div class="xs muted">${L(MODES[c.mode][0],MODES[c.mode][1])}</div></div>${ic('link',16)}</div>`).join('')}</div>
   <div class="sec-h">${L('进口清关资料清单','Import customs checklist')}</div>
   <div class="box" style="margin-top:0">${[[L('提单 / 空运单','Bill of lading / air waybill')],[L('商业发票','Commercial invoice')],[L('装箱单（与发票一致）','Packing list (matching invoice)')],[L('原产地证','Certificate of origin')],[L('进口申报（ICUMS 系统）','Import declaration (ICUMS)')],[L('纳税人识别号 TIN','Taxpayer ID (TIN)')],[L('货物保险单（如有）','Insurance certificate (if any)')]].map((x,i)=>`<label class="li" style="cursor:pointer"><input type="checkbox" ${LS.get('cc'+i,false)?'checked':''} onchange="LS.set('cc${i}',this.checked)" style="width:20px;height:20px;accent-color:#0B7A4B"><span class="sm b" style="flex:1">${x[0]}</span></label>`).join('')}
    <div class="xs muted" style="margin-top:8px">${L('以加纳海关最新要求为准；常用口岸：特马港、塔科拉迪港、科托卡国际机场。','Follow the latest Ghana customs rules. Main entry points: Tema Port, Takoradi Port, Kotoka International Airport.')}</div></div>
  </div>`};
/* ===== 运费计算器：运费（单价 × 体积 / 重量，可用人民币报价，自动换算成本币）+ 清关费（按台 / 个）+ 其他费用 = 合计 ===== */
const CURS=()=>baseIso()==='CNY'?['CNY']:['CNY',baseIso()];
const curSym=c=>c==='CNY'?'¥':CUR();
const curName=c=>c==='CNY'?L('人民币','RMB'):`${CUR()} ${baseIso()}`;
const fmtC=(v,c)=>c==='CNY'?'¥ '+fmtN(v,2):money(v);
function fcInit(){if(S.fc&&S.fc.v===2)return;const s=LS.get('fc',null);if(s&&s.v===2){S.fc=s;return}const r=frRate('sea');
  S.fc={v:2,mode:'sea',p:r.p,cur:r.cur,cbm:2,kg:0,clr:[{q:1,u:'台',p:0,cur:baseIso()}],oth:[{n:'',a:0,cur:baseIso()}]}}
function fcMode(m){const r=frRate(m);Object.assign(S.fc,{mode:m,p:r.p,cur:r.cur});LS.set('fc',S.fc);render(false)}
const fcSel=(val,on,opts)=>`<select class="inp" style="padding:8px 4px;background:var(--soft);width:auto;min-width:0" onchange="${on}">${opts.map(([v,t])=>`<option value="${esc(v)}" ${v===val?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
const fcNum=(val,on,ph,w)=>`<input class="inp" type="number" inputmode="decimal" min="0" style="padding:8px;background:var(--soft);${w?`width:${w}px;flex:none`:'flex:1;min-width:0'}" value="${val||''}" placeholder="${ph||'0'}" oninput="${on};fcCalc()">`;
function fcBox(){const f=S.fc,r=frRate(f.mode),fx=fxCNY(),fi=fxInfo();const curs=CURS().map(c=>[c,c==='CNY'?'¥ '+L('人民币','RMB'):CUR()+' '+baseIso()]);
  return `<div class="box" style="margin-top:6px;border:2px solid var(--green)"><div class="row gap"><div class="qi" style="background:var(--green);color:#fff">${ic('calc',20)}</div><div><div class="b" style="font-size:18px">${L('运费计算器','Freight calculator')}</div><div class="xs muted">${L('运费 + 清关费 + 其他费用 = 合计（本币）','Freight + clearance + other fees = total (local currency)')}</div></div></div>
   <div class="chips wrap" style="margin-top:12px">${Object.keys(MODES).map(k=>`<span class="chip ${f.mode===k?'on':''}" onclick="fcMode('${k}')">${ic(MODES[k][2],14)} ${L(MODES[k][0],MODES[k][1])}</span>`).join('')}</div>
   <div class="xs b" style="margin-top:14px">① ${L('运费单价','Freight price')}</div>
   <div class="row gap" style="margin-top:6px;align-items:center">${fcNum(f.p,"S.fc.p=+this.value")}${fcSel(f.cur,"S.fc.cur=this.value;fcCalc()",curs)}<span class="sm muted" style="flex:none">/ ${frUnitName(r.unit)}</span></div>
   <div class="row gap" style="margin-top:8px"><div style="flex:1;min-width:0"><div class="xs muted">${L('体积（立方米）','Volume (m³)')}${r.unit==='cbm'?' *':''}</div>${fcNum(f.cbm,"S.fc.cbm=+this.value")}</div><div style="flex:1;min-width:0"><div class="xs muted">${L('重量（公斤）','Weight (kg)')}${r.unit!=='cbm'?' *':''}</div>${fcNum(f.kg,"S.fc.kg=+this.value")}</div></div>
   <div class="xs b" style="margin-top:14px">② ${L('清关费','Customs clearance')}</div>
   ${f.clr.map((c,i)=>`<div class="row gap" style="margin-top:6px;align-items:center">${fcNum(c.q,`S.fc.clr[${i}].q=+this.value`,'1',58)}${fcSel(c.u,`S.fc.clr[${i}].u=this.value;fcCalc()`,[['台',L('台','unit(s)')],['个',L('个','piece(s)')],['票',L('票','shipment')],['柜',L('柜','container')]])}<span class="sm muted" style="flex:none">×</span>${fcNum(c.p,`S.fc.clr[${i}].p=+this.value`,L('单价','price'))}${fcSel(c.cur,`S.fc.clr[${i}].cur=this.value;fcCalc()`,curs.map(([v])=>[v,curSym(v)]))}<button class="icbtn" style="width:32px;height:32px;flex:none" onclick="S.fc.clr.splice(${i},1);LS.set('fc',S.fc);render(false)">${ic('x',14)}</button></div>`).join('')}
   <a class="sm" style="display:inline-block;margin-top:8px;color:var(--green);font-weight:700;cursor:pointer" onclick="S.fc.clr.push({q:1,u:'台',p:0,cur:baseIso()});LS.set('fc',S.fc);render(false)">+ ${L('添加清关项目','Add clearance item')}</a>
   <div class="xs b" style="margin-top:12px">③ ${L('其他费用','Other fees')}</div>
   ${f.oth.map((o,i)=>`<div class="row gap" style="margin-top:6px;align-items:center"><input class="inp" style="padding:8px;background:var(--soft);flex:1.3;min-width:0" value="${esc(o.n)}" placeholder="${L('项目，如：提货费、仓储费','Item, e.g. pickup, storage')}" oninput="S.fc.oth[${i}].n=this.value;LS.set('fc',S.fc)">${fcNum(o.a,`S.fc.oth[${i}].a=+this.value`,L('金额','amount'))}${fcSel(o.cur,`S.fc.oth[${i}].cur=this.value;fcCalc()`,curs.map(([v])=>[v,curSym(v)]))}<button class="icbtn" style="width:32px;height:32px;flex:none" onclick="S.fc.oth.splice(${i},1);LS.set('fc',S.fc);render(false)">${ic('x',14)}</button></div>`).join('')}
   <a class="sm" style="display:inline-block;margin-top:8px;color:var(--green);font-weight:700;cursor:pointer" onclick="S.fc.oth.push({n:'',a:0,cur:baseIso()});LS.set('fc',S.fc);render(false)">+ ${L('添加其他费用','Add other fee')}</a>
   ${baseIso()==='CNY'?'':`<div class="row gap" style="margin-top:14px;align-items:center;flex-wrap:wrap"><span class="sm b">${L('汇率','Rate')}</span><span class="sm" data-notr>1 ¥ =</span><input class="inp" type="number" inputmode="decimal" style="width:96px;padding:8px;background:var(--soft)" value="${fx?+fx.toFixed(4):''}" placeholder="${L('请填写','enter')}" onchange="setFxMan(this.value)"><span class="sm" data-notr>${esc(CUR())}</span><span class="xs muted">${fi}</span></div>`}
   <div id="fcOut" style="margin-top:12px">${fcHTML()}</div>
   ${can('mgmt')?`<div style="text-align:right;margin-top:8px"><a class="xs muted" style="cursor:pointer;text-decoration:underline" onclick="fcSaveRate()">${L('把这个运费单价设为默认','Save this price as the default')}</a></div>`:''}</div>`}
function fcHTML(){const f=S.fc,r=frRate(f.mode);const x=frCost(f.mode,f.kg,f.cbm,{...r,p:+f.p||0,cur:f.cur});
  const rows=[];const add=(t,sub,v,c)=>rows.push({t,sub,v,c,b:toBase(v,c)});
  add(L('运费','Freight'),`${n2(x.q)} ${frUnitName(x.unit)} × ${fmtC(+f.p||0,f.cur)}${x.byVol&&r.unit!=='cbm'?' · '+L('按体积重','by volume weight'):''}`,x.cost,f.cur);
  f.clr.filter(c=>+c.q&&+c.p).forEach(c=>add(L('清关费','Clearance'),`${n2(c.q)} ${c.u} × ${fmtC(+c.p,c.cur)}`,(+c.q)*(+c.p),c.cur));
  f.oth.filter(o=>+o.a).forEach(o=>add(o.n||L('其他费用','Other fee'),'',+o.a,o.cur));
  const needFx=rows.some(z=>z.c==='CNY')&&baseIso()!=='CNY'&&!fxCNY();const tot=rows.reduce((s,z)=>s+z.b,0);
  return `<div style="background:var(--soft);border-radius:16px;padding:12px 14px">${rows.map(z=>`<div class="row between" style="gap:8px;margin-top:4px"><div style="min-width:0"><div class="sm b">${esc(z.t)}</div>${z.sub?`<div class="xs muted" data-notr>${z.sub}</div>`:''}</div><div style="text-align:right;flex:none"><div class="sm b" data-notr>${money(z.b)}</div>${z.c==='CNY'&&baseIso()!=='CNY'?`<div class="xs muted" data-notr>${fmtC(z.v,'CNY')}</div>`:''}</div></div>`).join('')}
   <div class="row between" style="border-top:1.5px solid var(--line);margin-top:10px;padding-top:10px"><b>${L('合计','Total')}</b><b style="font-size:22px;color:var(--green)" data-notr>${money(tot)}</b></div>
   ${needFx?`<div class="xs red" style="margin-top:6px">${L('请填写人民币汇率','Enter the RMB exchange rate')}</div>`:''}<div class="xs muted" style="margin-top:4px">${L(`时效约 ${r.d1}–${r.d2} 天`,`Transit about ${r.d1}–${r.d2} days`)}</div></div>`}
function fcSaveRate(){const f=S.fc,r=frRate(f.mode);const s=JSON.parse(JSON.stringify(DB.get('settings','app')||{id:'app'}));s.rates=s.rates||{};s.rates[f.mode]=[+f.p||0,r.d1,r.d2,r.unit,f.cur];DB.put('settings',s);toast(L('已设为默认运价','Saved as default'),false)}
function setFxMan(v){v=+v;LS.set('fxCNYman',v>0?v:0);fcCalc();render(false)}
/* 登记物流：填了重量 / 体积就按运价自动算运费（手动改过运费后不再覆盖） */
function shCostHint(){const F=S.form;if(!F||!(+F.kg||+F.cbm))return L('填重量或体积可自动计算','enter weight or volume to calculate');const x=frCost(F.mode,F.kg,F.cbm);return `= ${n2(x.q)} ${frUnitName(x.unit)} × ${fmtC(x.p,x.cur)}${x.cur==='CNY'&&baseIso()!=='CNY'?' · '+L('按汇率换算','converted'):''}`}
function shipCost(){const F=S.form;if(!(+F.kg||+F.cbm))return;loadFxCNY();const x=frCost(F.mode,F.kg,F.cbm);if(!F.costManual){F.cost=x.costB;const i=$('#shCost');if(i)i.value=x.costB}const h=$('#shCostHint');if(h)h.textContent=shCostHint()}
function fcCalc(){LS.set('fc',S.fc);const o=$('#fcOut');if(o)o.innerHTML=fcHTML()}
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
/* 利润的费用部分（每笔只算一次）：
   freight 我方承担运费：本期出库、运费由我方承担的销售单；已有关联费用报销（入账或已付）时按实际报销金额，否则按单上金额
   opex    运营费用：本期入账 / 已付款的费用报销，但已关联到“我方承担运费”销售单的报销不再计入（已在 freight 里）
   adj     盘点调整：本期盘点调整流水按成本计价，盘盈为正、盘亏为负 */
function profitParts(so,mv,from){const exps=DB.all('exp').filter(e=>['booked','paid'].includes(e.status));
  const usFrt=id=>{const s=DB.get('so',id);return !!(s&&s.frt&&s.frt.payer==='us')};
  const freight=so.filter(s=>s.frt&&s.frt.payer==='us').reduce((a,s)=>{const ln=exps.filter(e=>e.so===s.id);return a+(ln.length?ln.reduce((b,e)=>b+(+e.amt||0),0):(+s.frt.amt||0))},0);
  const opex=exps.filter(e=>(e.bt||e.t)>=from&&!(e.so&&usFrt(e.so))).reduce((a,e)=>a+(+e.amt||0),0);
  const adj=mv.filter(m=>m.type==='adj').reduce((a,m)=>a+Math.sign(+m.qty||0)*(m.costAmount??Math.abs(+m.qty||0)*(+m.uc||0)),0);
  /* lc    入库后补录的采购费用：本期批准的补录费用，计为当期费用
     prLoss 采购退货费用损失：退货按到岸成本出库，供应商只退采购单价，差额（分摊进去的运费、清关费）是损失 */
  const lc=DB.all('lcadj').filter(x=>x.status==='approved'&&((x.approval||{}).t||x.t)>=from).reduce((a,x)=>a+(+x.amt||0),0);
  const prLoss=mv.filter(m=>m.type==='po_ret').reduce((a,m)=>{const r=DB.get('pr',m.ref),g=r&&DB.get('grn',r.grn),p=g&&DB.get('po',g.po),it=p&&(p.items||[]).find(i=>i.pid===m.pid);
    if(!it)return a;const cost=m.costAmount??Math.abs(+m.qty||0)*(+m.uc||0);return a+Math.max(0,cost-Math.abs(+m.qty||0)*(+it.price||0))},0);
  return {freight:Math.round(freight*100)/100,opex:Math.round(opex*100)/100,adj:Math.round(adj*100)/100,lc:Math.round(lc*100)/100,prLoss:Math.round(prLoss*100)/100}}
V.report=()=>{const from=S.rpR==='today'?dayStart():S.rpR==='week'?dayStart()-((new Date().getDay()+6)%7)*864e5:+new Date(new Date().getFullYear(),new Date().getMonth(),1);
  const r=S.me.role;const seeSales=['gm','ops','sales','acct'].includes(r),seeStock=can('stock'),seeProfit=can('profit'),seeBuy=['gm','ops','buyer','acct'].includes(r);
  const so=DB.all('so').filter(s=>['shipped','done'].includes(s.status)&&(s.st||0)>=from);const sales=confirmedRevenue(from);
  const mv=DB.all('moves').filter(m=>m.t>=from);const outN=new Set(mv.filter(m=>m.type==='so_out'||m.type==='po_ret').map(m=>m.ref)).size,inN=new Set(mv.filter(m=>m.type==='po_in'||m.type==='so_ret').map(m=>m.ref)).size;
  const cogs=mv.filter(m=>m.type==='so_out').reduce((a,m)=>a+(m.costAmount??(-m.qty)*(+m.uc||0)),0)-mv.filter(m=>m.type==='so_ret').reduce((a,m)=>a+(m.costAmount??m.qty*(+m.uc||0)),0);
  const {freight,opex,adj,lc,prLoss}=profitParts(so,mv,from),fxLoss=DB.all('fin').filter(f=>(f.type==='pay'&&f.status==='paid'||f.type==='rcv'&&f.refKind==='po'&&f.status==='verified')&&(f.pt||f.vt||f.t)>=from).reduce((a,f)=>a+(+f.fxLoss||0),0),writeoff=mv.filter(m=>m.type==='writeoff').reduce((a,m)=>a+(+m.costAmount||0),0);const net=sales-cogs-freight-opex+adj-lc-prLoss-fxLoss-writeoff;
  const buys=DB.all('po').filter(p=>p.status!=='draft'&&p.status!=='cancel'&&p.t>=from).reduce((a,p)=>a+docTotal(p),0);
  const days=[...Array(7)].map((_,i)=>{const d0=dayStart()-(6-i)*864e5;const v=confirmedRevenue(d0,d0+864e5);return {d0,v}});
  const mx=Math.max(1,...days.map(d=>d.v));
  const rank=DB.all('products').map(p=>{const q=qtyOf(p.id);return {p,q,v:q*(can('cost')?avgCost(p.id):p.price)}}).sort((a,b)=>S.rpK==='val'?b.v-a.v:b.q-a.q).slice(0,20);const rmx=Math.max(1,...rank.map(x=>S.rpK==='val'?x.v:x.q));
  const last=DB.all('moves').sort((a,b)=>b.t-a.t).slice(0,10);
  return hdr(L('简易报表','Reports'),`<button class="icbtn" onclick="exportSheet()">${ic('download')}</button>`)+`<div class="pad">
   <div class="seg">${[['today',L('今日','Today')],['week',L('本周','This week')],['month',L('本月','This month')]].map(([k,t])=>`<button class="${S.rpR===k?'on':''}" onclick="S.rpR='${k}';render(false)">${t}</button>`).join('')}</div>
   <div class="stats">${seeSales?statT('g',numK(sales),L('销售额','Sales'),'',1):seeBuy?statT('g',numK(buys),L('采购额','Purchases'),'',1):''}${statT('',outN,L('出库笔数','Outbound'))}${statT('',inN,L('入库笔数','Inbound'))}</div>
   ${seeProfit?`<div class="box"><h4>${L('利润（估算）','Profit (estimate)')}<span class="sm muted" data-notr>${esc(CUR())}</span></h4><div class="kv">
     <div><div class="l">${L('销售收入','Revenue')}</div><div class="v" data-notr>${money(sales)}</div></div><div><div class="l">${L('销售成本','Cost of goods')}</div><div class="v" data-notr>${money(cogs)}</div></div>
     <div><div class="l">${L('毛利','Gross profit')}</div><div class="v ${sales-cogs<0?'red':'green'}" data-notr>${money(sales-cogs)}</div></div><div><div class="l">${L('毛利率','Margin')}</div><div class="v" data-notr>${sales?((sales-cogs)/sales*100).toFixed(1):'0.0'}%</div></div>
     <div><div class="l">${L('我方承担运费','Freight we paid')}</div><div class="v" data-notr>${money(freight)}</div></div><div><div class="l">${L('运营费用（费用报销）','Operating expenses')}</div><div class="v" data-notr>${money(opex)}</div></div>
     <div style="grid-column:1/3"><div class="l">${L('盘盈 / 盘亏（盘点调整，按成本计）','Stock count gain / loss (at cost)')}</div><div class="v ${adj<0?'red':adj>0?'green':''}" data-notr>${adj>0?'+':''}${money(adj)}</div></div>
     ${lc||prLoss?`<div><div class="l">${L('入库后补录的采购费用','Purchase costs added after receipt')}</div><div class="v" data-notr>${money(lc)}</div></div><div><div class="l">${L('采购退货费用损失','Freight lost on supplier returns')}</div><div class="v" data-notr>${money(prLoss)}</div></div>`:''}
     <div style="grid-column:1/3"><div class="l">${L('净利润（估算）= 毛利 − 我方运费 − 运营费用 ± 盘盈盘亏 − 补录采购费用 − 采购退货费用损失','Net profit (est.) = gross − freight − expenses ± count adjustments − added purchase costs − return cost loss')}</div><div class="v ${net<0?'red':'green'}" style="font-size:20px" data-notr>${money(net)}</div></div></div>
     <div class="xs muted" style="margin-top:8px">${L('销售成本按“含运费、清关费的到岸成本”加权平均计算。我方承担的运费：有关联的费用报销时按实际报销金额，否则按销售单上填写的金额；已关联销售单的运费报销不再重复计入运营费用。','Cost of goods uses weighted average landed cost (incl. freight & clearance). Freight we pay uses the linked expense claims when present, otherwise the amount on the order; linked freight claims are not counted again as expenses.')}</div>
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
  if(k==='ar'){const l=arDocs().map(s=>({s,x:arOf(s)}));return exportXlsx(L('应收账款','Receivables'),[{name:L('应收','Receivables'),title:L('应收账款','Receivables'),money:[4,5,6,7],head:[L('单号','No.'),L('日期','Date'),L('客户','Customer'),L('状态','Status'),L('应收','Due'),L('已核对收款','Verified'),L('待核对收款','To verify'),L('余额','Balance')],
    rows:l.map(({s,x})=>[s.no,fday(s.t),ptName(s.cus),L(SO_ST[s.status][0],SO_ST[s.status][1]),cv(x.tot),cv(x.vgot),cv(x.pend),cv(x.vbal)]),total:[L('合计','Total'),'','','',+l.reduce((a,o)=>a+cv(o.x.tot),0).toFixed(2),+l.reduce((a,o)=>a+cv(o.x.vgot),0).toFixed(2),+l.reduce((a,o)=>a+cv(o.x.pend),0).toFixed(2),+l.reduce((a,o)=>a+cv(o.x.vbal),0).toFixed(2)]}])}
  if(k==='ap'){const l=apDocs().map(p=>({p,x:apOf(p)}));return exportXlsx(L('应付账款','Payables'),[{name:L('应付','Payables'),title:L('应付账款','Payables'),money:[4,5,6,7,8,9],head:[L('单号','No.'),L('日期','Date'),L('供应商','Supplier'),L('状态','Status'),L('订单总额','Order total'),L('已到货应付','Payable (received)'),L('已付（扣退款）','Paid (net)'),L('已审批待付','Approved'),L('欠供应商','Owed'),L('预付 / 供应商欠我方','Advance')],
    rows:l.map(({p,x})=>[p.no,fday(p.t),ptName(p.sup),L(PO_ST[p.status][0],PO_ST[p.status][1]),cv(x.tot),cv(x.due),cv(x.paid),cv(x.appr),cv(x.bal),cv(x.adv)]),total:[L('合计','Total'),'','','',...['tot','due','paid','appr','bal','adv'].map(k=>+l.reduce((a,o)=>a+cv(o.x[k]),0).toFixed(2))]}])}
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
   <div class="box" style="display:flex;gap:14px;align-items:center"><button class="avatar-edit" onclick="avatarSheet()" aria-label="${L('修改头像','Change avatar')}">${avatar(me.id,64)}</button><div style="min-width:0;flex:1">${personLine(me,true)}<div class="xs muted" style="margin-top:4px">${L('默认门店','Default store')}: ${esc(whName(me.wh))}</div></div></div>
   ${!can('mgmt')&&can('_pt')?`<div class="box" style="padding:4px 16px">${row('user',can('po')?L('供应商','Suppliers'):L('客户','Customers'),L('新增、修改、删除','Add, edit, delete'),"go('m_partners')")}</div>`:''}${can('mgmt')?`<div class="sec-h">${L('后台管理','Management')}</div><div class="box" style="margin-top:0;padding:4px 16px">
    ${row('users',L('账号与密码','Accounts & passwords'),L('各部门密码、新增账号、停用登录','Department passwords, new accounts, disable sign-in'),"go('m_users')")}
    ${row('wh',L('门店与 VIP','Stores & VIP'),(P.vip?L(`VIP · ${P.limit} 个门店名额`,`VIP · ${P.limit} store slots`):L('1 个门店（新增门店需开通码）','1 store (new stores need an activation code)'))+L(` · 已用 ${Math.min(allWh().length,P.limit)}`,` · ${Math.min(allWh().length,P.limit)} in use`),"go('m_stores')")}
    ${row('gear',L('更多后台功能','More management'),L('商品资料、往来单位、系统设置、备份、日志','Products, partners, settings, backup, log'),"go('mgmt')")}</div>`:''}
   <div class="sec-h">${L('账号','Account')}</div><div class="box" style="margin-top:0;padding:4px 16px">
    ${row('user',L('个人资料','Profile'),esc(nmP(me.name)),'profileSheet()')}${row('lock',L('修改我的密码','Change my password'),L('初始密码 666666，可改成自己的','Starting password 666666 — change it to your own'),'pwdSheet()')}${row('wh',L('默认门店','Default store'),esc(whName(me.wh)),'whSheet()')}
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
    ${row('print',L('打印机','Printers'),L('WiFi 网络打印机，自动搜索','WiFi network printers — auto discovery'),"go('printers')")}
    ${row('shield',L('手机权限','Phone permissions'),L('定位 · 相机 · 麦克风','Location · camera · microphone'),'permSheet()')}
    ${!isNative()?row('download',L('下载安卓安装包','Download Android app'),L('支持应用内一键更新','APK with in-app updates'),'doApk()'):''}
    ${row('bell',L('未读提醒与后台推送','Unread alerts & background push'),'',"pushSettings()")}
    ${row('refresh',L('检查更新','Check for updates'),`<span data-notr>v${APP_VER} · build ${APP_BUILD}</span>`,'checkUpdate(true)',hasUpd()?'<span style="width:9px;height:9px;border-radius:50%;background:var(--red)"></span>':null)}</div>
   <button class="bigbtn ghost" style="width:100%;margin-top:18px;color:var(--red)" onclick="doLogout()">${ic('logout',18)} ${L('退出登录','Sign out')}</button>
   <div class="xs muted" style="text-align:center;margin-top:14px" data-notr>v${APP_VER} · build ${APP_BUILD}</div></div>`};
function langSheet(){const ls=langsOf(S.country);openSheet(`<div class="sh">${L('语言','Language')}</div><div class="xs muted">${L('英语、中文和所在国家的官方语言','English, Chinese and the official languages of your country')}</div><div style="margin-top:8px">${ls.map(l=>`<div class="li" onclick="closeSheet();setLang('${l}')"><b data-notr style="flex:1">${langFlag(l)} ${esc(LN[l]||l)}</b>${S.lang===l?ic('check'):''}</div>`).join('')}</div>`)}
function profileSheet(){openSheet(`<div class="sh">${L('个人资料','Profile')}</div><button class="pill" onclick="avatarSheet()">${L('修改头像：照片 / 表情 / 图案','Avatar: photo / emoji / icon')}</button><div class="fld"><label>${L('姓名','Name')}</label><input class="inp" id="pfN" value="${esc(nmP(S.me.name))}"></div><div class="fld"><label>${L('账号代码','Account code')}</label><input class="inp" value="${esc(S.me.code||'')}" disabled data-notr></div>
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
   <div class="note-g" style="margin-top:4px">${L('账号按部门管理：总经办、采购部、销售部、仓储部、财务部。新增账号先选部门、再选职位，账号代码自动生成；所有账号初始密码都是 666666，登录时同一职位有多人会让本人选择姓名。总经理可在这里为任何人重设密码，也可用下面的按钮把所有人的密码统一重设。','Accounts by department. New accounts: department, then position; the code is generated. Every account starts with password 666666; when a position has several people, each picks their name at sign-in. The GM can reset anyone’s password here, or reset everyone’s below.')}</div>
   ${S.me.role==='chair'?`<button class="bigbtn ghost" style="width:100%;margin-top:10px;height:46px;font-size:14px" onclick="pwAllSheet()">${ic('lock',16)} ${L('所有人密码统一重设','Reset everyone’s password')}</button>`:''}
   ${DEPTS.map(d=>{const l=us.filter(u=>d.roles.includes(u.role)).sort((a,b)=>String(a.code).localeCompare(String(b.code)));const dp=ps.filter(p=>p.dept===d.id);
    return `<div class="sec-h" style="margin-top:18px"><span class="row gap6"><span class="badge ${ROLES[d.roles[0]].c}">${deptName(d)}</span><span class="xs muted">${l.length} ${L('人','')}</span></span><a onclick="acctSheet(null,'${d.id}')">+ ${L('新增账号','Add account')}</a></div>
    <div class="chips wrap" style="margin:0 0 8px">${d.roles.map(r=>`<span class="chip" style="cursor:default;font-size:12px;padding:5px 10px">${roleName(r)}</span>`).join('')}${dp.map(p=>`<span class="chip" style="font-size:12px;padding:5px 10px" onclick="S.eu=null;posSheet('${d.id}','${p.id}')">${esc(nm(p.n))} ${ic('edit',12)}</span>`).join('')}${d.roles.includes('chair')&&S.me.role!=='chair'?'':`<span class="chip" style="font-size:12px;padding:5px 10px;border:1.5px dashed var(--muted);background:transparent" onclick="S.eu=null;posSheet('${d.id}')">+ ${L('新增职位','New position')}</span>`}</div>
    <div class="box" style="margin-top:0;padding:4px 16px">${l.map(u=>`<div class="li" onclick="acctSheet('${u.id}')"><div class="av" style="width:36px;height:36px;font-size:14px;${u.active===false?'background:#D6D3CC':''}">${esc(nmP(u.name).slice(0,1))}</div><div style="flex:1;min-width:0"><div class="b sm one">${esc(nmP(u.name))} <span class="xs muted" style="font-weight:600">${esc(userTitle(u))}</span>${u.admin&&u.role!=='gm'?` <span class="badge b-dark" style="padding:1px 7px">${L('后台','Backend')}</span>`:''}</div><div class="xs muted"><span data-notr>${esc(u.code)}</span> · ${esc(whName(u.wh))}${u.active===false?` · <b class="red">${L('已停用登录','Sign-in disabled')}</b>`:''}</div></div><button class="pill w" style="box-shadow:0 1px 3px rgba(0,0,0,.08)" onclick="event.stopPropagation();acctSheet('${u.id}')">${ic('edit',14)} ${L('重新编辑','Edit')}</button></div>`).join('')||`<div class="sm muted" style="padding:10px 0">${L('暂无账号','No accounts')}</div>`}</div>`}).join('')}</div>`};
/* 总经理：把所有账号（含自己）的密码统一重设，默认 666666 */
function pwAllSheet(){openSheet(`<div class="sh">${L('所有人密码统一重设','Reset everyone’s password')}</div><div class="sm" style="margin-top:8px;line-height:1.7">${L(`全部 ${DB.all('users').length} 个账号（包括您自己）的密码都会改成下面的密码，方便大家登录。之后每个人可以在“我的 → 修改密码”自己改，您也可以随时在这里为某个人单独重设。`,`All ${DB.all('users').length} accounts (including yours) get the password below. Each person can change it later under Me → Change password.`)}</div>
  <input class="inp" id="paP" style="background:var(--card);margin-top:12px;letter-spacing:3px;font-size:18px" value="666666"><div class="sm red" id="paE" style="margin-top:8px"></div>
  <button class="bigbtn" style="width:100%;margin-top:12px" onclick="pwAllDo()">${L('确认重设','Reset now')}</button>`)}
async function pwAllDo(){const pw=$('#paP').value.trim();if(pw.length<6)return $('#paE').textContent=L('密码至少 6 位','At least 6 characters');
  try{if(DB.cloud){const r=await rpc('jxc_reset_all_pw',{p_token:S.token,p_pw:pw});if(r&&r.users)DB.d.users=r.users}
    else{for(const u of DB.all('users'))DB.put('users',{...u,pw:await pwHash(u.id,pw)},{quiet:true})}
    DB.ver++;closeSheet(true);toast(L(`已把所有人的密码设为 ${pw}`,`Everyone’s password is now ${pw}`),false);render(false)}catch(e){$('#paE').textContent=e.message}}
/* 新增 / 重新编辑账号：先选部门，再选职位（基本职位或本部门新增的职位），账号代码自动生成 */
function acctSheet(id,dept){const u=id?{...DB.get('users',id)}:{code:'',name:'',wh:activeWh()[0].id,active:true,role:'',pos:null};
  if(S.me.role!=='chair'&&u.role==='chair')return toast(L('董事长账号只能由董事长修改','Only the chairman can edit chairman accounts'));
  S.eu=u;S.euDept=id?deptOf(u.role).id:(dept||'');S.euCodeTouched=false;S.euSelf=id===S.me.id;acctDraw()}
function acctPick(role,pos){if(S.euSelf)return;S.eu.role=role;S.eu.pos=pos||null;if(!S.eu.id&&!S.euCodeTouched)S.eu.code=nextCode(role);acctDraw()}
function acctDraw(){const u=S.eu,id=u.id,self=S.euSelf;const depts=DEPTS;const d=DEPTS.find(x=>x.id===S.euDept);
  const chip=(on,txt,fn,extra='')=>`<span class="chip ${on?'on':''}" ${self?'style="opacity:.5;pointer-events:none"':`onclick="${fn}"`}${extra}>${txt}</span>`;
  const pos=d?[...d.roles.filter(r=>r!=='chair'||S.me.role==='chair').map(r=>({role:r,pos:null,n:roleName(r)})),...positions().filter(p=>!p.del&&p.dept===d.id&&d.roles.includes(p.role)&&(p.role!=='chair'||S.me.role==='chair')).map(p=>({role:p.role,pos:p.id,n:nm(p.n)}))]:[];
  openSheet(`<div class="sh">${id?L('重新编辑','Edit account'):L('新增岗位账号','New post account')}</div>
   <div class="fld"><label>${L('① 部门','① Department')}${self?` <span class="xs muted">${L('（不能修改自己的部门和职位）','(you cannot change your own)')}</span>`:''}</label><div class="chips wrap">${depts.map(x=>chip(S.euDept===x.id,deptName(x),`S.euDept='${x.id}';acctDraw()`)).join('')}</div></div>
   ${d?`<div class="fld"><label>${L('② 职位','② Position')}</label><div class="chips wrap" id="euRoles">${pos.map(p=>chip(u.role===p.role&&(u.pos||null)===p.pos,esc(p.n),`acctPick('${p.role}',${p.pos?`'${p.pos}'`:'null'})`,` data-r="${p.role}"`)).join('')}${self?'':`<span class="chip" style="border:1.5px dashed var(--muted);background:transparent" onclick="posSheet('${d.id}')">+ ${L('新增职位','New position')}</span>`}</div></div>`:''}
   <div class="fld"><label>${L('账号代码（自动生成，可修改）','Account code (automatic, can be changed)')}</label><input class="inp" style="background:var(--card);letter-spacing:2px" value="${esc(u.code)}" data-notr ${id?'disabled':''} oninput="S.eu.code=this.value.trim();S.euCodeTouched=true" placeholder="${L('先选部门和职位','Choose a department and position first')}"></div>
   <div class="fld"><label>${L('姓名','Name')}</label><input class="inp" style="background:var(--card)" value="${esc(nmP(u.name))}" oninput="S.eu.name=this.value"></div>
   <div class="fld"><label>${L('门店','Store')}</label><select class="inp" style="background:var(--card)" onchange="S.eu.wh=this.value">${activeWh().map(w=>`<option value="${w.id}" ${w.id===u.wh?'selected':''}>${esc(nm(w.n))}</option>`).join('')}</select></div>
   <div class="fld"><label>${id?L('重设密码（留空不改）','Reset password (leave empty to keep)'):L('初始密码（留空 = 666666）','Starting password (empty = 666666)')}</label><input class="inp" style="background:var(--card)" id="euPw" type="text" autocomplete="new-password"></div>
   ${self?'':`<div class="row between" style="margin-top:14px"><span class="sm b">${L('允许登录','Allow sign-in')}</span>${sw(u.active!==false,"S.eu.active=!(S.eu.active!==false);this.classList.toggle('on')")}</div>`}
   ${S.me.role==='chair'&&!self?`<div class="row between" style="margin-top:14px"><div><div class="sm b">${L('授权使用后台','Allow backend access')}</div><div class="xs muted">${L('可管理账号密码、门店、商品资料等（不能授权他人、不能改董事长账号）','Can manage accounts, stores, products… (cannot grant access or edit chairman accounts)')}</div></div>${sw(!!u.admin,"S.eu.admin=!S.eu.admin;this.classList.toggle('on')")}</div>`:''}
   <div class="sm red" id="euE" style="margin-top:8px"></div><button class="bigbtn" style="width:100%;margin-top:12px" onclick="acctSave()">${L('保存','Save')}</button>`)}
/* 在部门里新增职位：起个名字，选择权限参照本部门的哪个基本职位 */
function posSheet(dept,pid){const d=DEPTS.find(x=>x.id===dept);const p=pid?JSON.parse(JSON.stringify(posById(pid))):{id:'P'+Date.now().toString(36),dept,role:d.roles[0],n:{zh:'',en:''}};S.ep2=p;const back=!!S.eu;
  openSheet(`<div class="sh">${pid?L('修改职位','Edit position'):L('新增职位','New position')} · ${deptName(d)}</div>
   <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('职位名称（中文）','Name (Chinese)')}</label><input class="inp" style="background:var(--card)" value="${esc(p.n.zh)}" data-zh2en="#ep2En" placeholder="${L('如：采购员','e.g. Buyer')}" oninput="S.ep2.n.zh=this.value"></div><div class="fld" style="flex:1;min-width:0"><label>${L('英文名称','Name (English)')}</label><input class="inp" id="ep2En" data-auto="1" style="background:var(--card)" value="${esc(p.n.en)}" placeholder="${L('自动生成，可修改','Auto-filled, editable')}" oninput="S.ep2.n.en=this.value"></div></div>
   ${d.roles.length>1?`<div class="fld"><label>${L('权限与哪个职位相同','Same permissions as')}</label><div class="chips wrap" id="ep2R">${d.roles.map(r=>`<span class="chip ${p.role===r?'on':''}" onclick="S.ep2.role='${r}';$$('#ep2R .chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${roleName(r)}</span>`).join('')}</div></div>`:`<div class="xs muted" style="margin-top:10px">${L('权限与“','Same permissions as “')}${roleName(d.roles[0])}${L('”相同','”')}</div>`}
   <div class="sm red" id="ep2E" style="margin-top:8px"></div>
   <button class="bigbtn" style="width:100%;margin-top:12px" onclick="posSave(${back})">${L('保存职位','Save position')}</button>
   ${pid?`<button class="bigbtn dark" style="width:100%;margin-top:10px" onclick="posDel('${pid}')">${ic('trash',18)} ${L('删除职位','Delete position')}</button>`:''}`)}
async function posSave(back){const p=S.ep2;if(!p.n.zh.trim()&&!p.n.en.trim())return $('#ep2E').textContent=L('请填写职位名称','Enter a name');await fillEn(p.n);
  if(DEPTS.find(x=>x.id===p.dept).roles.includes('chair')&&S.me.role!=='chair')return $('#ep2E').textContent=L('总经办的职位只能由总经理设置','Only the GM can set positions in the GM office');
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
   <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('中文名称','Name (Chinese)')}</label><input class="inp" style="background:var(--card)" value="${esc(w.n.zh)}" data-zh2en="#ewEn" oninput="S.ew.n.zh=this.value"></div><div class="fld" style="flex:1;min-width:0"><label>${L('英文名称','Name (English)')}</label><input class="inp" id="ewEn" data-auto="1" style="background:var(--card)" value="${esc(w.n.en)}" placeholder="${L('自动生成，可修改','Auto-filled, editable')}" oninput="S.ew.n.en=this.value"></div></div>
   <div class="fld"><label>${L('城市','City')}</label><input class="inp" style="background:var(--card)" value="${esc(w.city.zh||w.city.en)}" oninput="S.ew.city={zh:this.value,en:''}"></div>
   <button class="bigbtn" style="width:100%;margin-top:16px" onclick="storeSave()">${L('保存','Save')}</button>`)}
async function storeSave(){const w=S.ew;if(!(w.n.zh||'').trim()&&!(w.n.en||'').trim())return toast(L('请填写名称','Enter a name'));await fillEn(w.n);await fillEn(w.city);DB.put('wh',w);closeSheet();toast(L('已保存','Saved'),false);render(false)}
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
/* ===== 商品与分类：分类可自行新增 / 改名 / 删除；商品可新增 / 修改 / 删除；新商品可直接录入期初库存 ===== */
const canProd=()=>can('mgmt')||can('po');
const canInit=()=>S.me&&(S.me.role==='gm'||(S.me.role==='keeper'));
const catKey=c=>((c&&(c.zh||c.en))||'').trim();
/* 分类列表 = 后台维护的分类 + 商品里已用到的分类 */
function catList(){const s=(DB.get('settings','app')||{}).cats||[];const m=new Map();s.forEach(c=>{if(catKey(c))m.set(catKey(c),{n:c,fixed:true})});
  DB.all('products').forEach(p=>{const k=catKey(p.cat);if(k&&!m.has(k))m.set(k,{n:p.cat,fixed:false})});
  return [...m.entries()].map(([k,v])=>({k,n:v.n,cnt:DB.all('products').filter(p=>catKey(p.cat)===k).length}))}
function catSheet(){const l=catList();const ok=can('mgmt');
  openSheet(`<div class="sh">${L('商品分类','Categories')}</div><div class="xs muted" style="margin-top:4px">${L('按您经营的商品自行设置，例如：摩托车、配件、手机、电脑、建材……','Set them up for what you sell, e.g. motorcycles, parts, phones, computers…')}</div>
   <div class="box" style="padding:4px 16px">${l.map(c=>`<div class="li" ${ok?`onclick="catEdit('${esc(c.k)}')"`:'style="cursor:default"'}><div class="qi">${ic('box',18)}</div><div style="flex:1;min-width:0"><div class="b sm one">${esc(nm(c.n))}</div><div class="xs muted">${c.cnt} ${L('种商品','item(s)')}</div></div>${ok?ic('edit',16):''}</div>`).join('')||`<div class="sm muted" style="padding:12px 0">${L('还没有分类','No categories yet')}</div>`}</div>
   ${ok?`<button class="bigbtn" style="width:100%;margin-top:14px" onclick="catEdit()">${ic('plus',18)} ${L('新增分类','New category')}</button>`:`<div class="note-y" style="margin-top:12px">${L('新增商品时可以直接输入新的分类名称','You can type a new category when adding a product')}</div>`}`)}
function catEdit(k){const c=k?(catList().find(x=>x.k===k)||{n:{zh:k,en:k}}).n:{zh:'',en:''};S.ecat={old:k||null,n:{zh:c.zh||'',en:c.en||''}};
  openSheet(`<div class="sh">${k?L('修改分类','Edit category'):L('新增分类','New category')}</div>
   <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('中文名称','Name (Chinese)')}</label><input class="inp" style="background:var(--card)" value="${esc(S.ecat.n.zh)}" data-zh2en="#ecEn" placeholder="${L('如：摩托车','e.g. Motorcycles')}" oninput="S.ecat.n.zh=this.value"></div>
    <div class="fld" style="flex:1;min-width:0"><label>${L('英文名称','Name (English)')}</label><input class="inp" id="ecEn" data-auto="1" style="background:var(--card)" value="${esc(S.ecat.n.en)}" placeholder="${L('自动生成，可修改','Auto-filled, editable')}" oninput="S.ecat.n.en=this.value"></div></div>
   <button class="bigbtn" style="width:100%;margin-top:16px" onclick="catSave()">${L('保存','Save')}</button>
   ${k?`<button class="bigbtn dark" style="width:100%;margin-top:10px" onclick="catDel('${esc(k)}')">${ic('trash',18)} ${L('删除分类','Delete category')}</button>`:''}`)}
async function catSave(){const e=S.ecat;if(!e.n.zh.trim()&&!e.n.en.trim())return toast(L('请填写名称','Enter a name'));await fillEn(e.n);const nk=catKey(e.n);
  if(catList().some(c=>c.k===nk&&c.k!==e.old))return toast(L('分类已存在','Category already exists'));
  const s=DB.get('settings','app')||{id:'app'};const l=(s.cats||[]).filter(c=>catKey(c)!==e.old&&catKey(c)!==nk);l.push(e.n);DB.put('settings',{...s,cats:l});
  if(e.old&&e.old!==nk)DB.all('products').filter(p=>catKey(p.cat)===e.old).forEach(p=>DB.put('products',{...p,cat:{...e.n}},{quiet:true}));
  toast(L('已保存','Saved'),false);catSheet();softRender(true)}
function catDel(k){const n=DB.all('products').filter(p=>catKey(p.cat)===k).length;
  confirmSheet(L('删除分类？','Delete this category?'),n?L(`有 ${n} 种商品属于这个分类，删除后它们变为“未分类”，商品本身不会删除。`,`${n} item(s) are in this category; they become “Uncategorised”. The items are kept.`):L('这个分类下没有商品。','No items are in this category.'),L('删除','Delete'),()=>{
    const s=DB.get('settings','app')||{id:'app'};DB.put('settings',{...s,cats:(s.cats||[]).filter(c=>catKey(c)!==k)});
    DB.all('products').filter(p=>catKey(p.cat)===k).forEach(p=>DB.put('products',{...p,cat:{zh:'',en:''}},{quiet:true}));if(S.stC===k)S.stC='all';toast(L('已删除','Deleted'),false);catSheet();softRender(true)})}
/* 通用确认框（不用浏览器自带的 confirm，安卓安装包里也能用） */
function confirmSheet(title,msg,okText,fn,danger=true){S._cf=fn;openSheet(`<div class="sh">${title}</div><div class="sm" style="margin-top:8px;line-height:1.7">${msg}</div>
  <div class="row gap" style="margin-top:18px"><button class="bigbtn dark" style="flex:1" onclick="closeSheet()">${L('取消','Cancel')}</button><button class="bigbtn" style="flex:1;${danger?'background:var(--red);color:#fff':''}" onclick="const f=S._cf;S._cf=null;f&&f()">${okText}</button></div>`)}
function prodEdit(id){const p=id?JSON.parse(JSON.stringify(DB.get('products',id))):{n:{zh:'',en:''},unit:{zh:'',en:''},cat:{zh:'',en:''},code:'',bar:'',cost:0,price:0,min:0,max:0,batch:false,sup:''};
  ['n','unit','cat'].forEach(k=>{if(typeof p[k]!=='object'||!p[k])p[k]={zh:p[k]||'',en:p[k]||''}});if(!id&&!p.code)p.code=nextProdCode();S.ep=p;S.epOpen={};
  if(!id&&S.stC&&S.stC!=='all'){const c=catList().find(x=>x.k===S.stC);if(c)p.cat={...c.n}}
  const f=(k,t,sub,type,extra='')=>`<div class="fld" style="flex:1;margin-top:10px;min-width:0"><label>${t}</label><input class="inp" style="background:var(--card)" ${type?`type="${type}" inputmode="decimal"`:''} value="${esc(sub?p[k][sub]:p[k])}" ${extra} oninput="S.ep.${k}${sub?'.'+sub:''}=${type==='number'?'+this.value':'this.value'}"></div>`;
  const cats=catList();
  openSheet(`<div class="sh">${id?L('修改商品','Edit product'):L('新增商品','New product')}</div>
   <div class="row gap" style="margin-top:8px"><div class="photos"><div class="ph" id="epPh" onclick="pickImage2(800,(u,t)=>{S.ep.photo=u;S.ep.thumb=t;$('#epPh').innerHTML='<img src=&quot;'+t+'&quot;>'},true)">${p.thumb||p.photo?`<img src="${esc(p.thumb||p.photo)}">`:ic('camera')}</div></div><span class="sm muted">${L('拍照或上传商品图片（自动压缩）','Take or upload a photo (auto-compressed)')}</span></div>
   <div class="row gap">${f('n',L('中文名称','Name (Chinese)'),'zh','','data-zh2en="#epNen"')}${f('n',L('英文名称','Name (English)'),'en','',`id="epNen" data-auto="1" placeholder="${L('自动生成，可修改','Auto-filled, editable')}"`)}</div>
   <div class="fld" style="margin-top:10px"><label>${L('分类','Category')}</label><div class="chips wrap" id="epCats">${cats.map(c=>`<span class="chip ${catKey(p.cat)===c.k?'on':''}" onclick="S.ep.cat={...catList().find(x=>x.k==='${esc(c.k)}').n};$$('#epCats .chip').forEach(x=>x.classList.remove('on'));this.classList.add('on');$('#epNewCat').value=''">${esc(nm(c.n))}</span>`).join('')}</div>
    <input class="inp" id="epNewCat" style="background:var(--card);margin-top:8px" placeholder="${cats.length?L('或输入新分类，如：摩托车','Or type a new category, e.g. Motorcycles'):L('输入分类，如：摩托车、手机、配件','Type a category, e.g. Motorcycles, Phones, Parts')}" oninput="S.ep.cat={zh:this.value,en:''};$$('#epCats .chip').forEach(x=>x.classList.remove('on'))"></div>
   <div class="row gap">${f('unit',L('单位','Unit'),'zh','',`placeholder="${L('如：台、个、件','e.g. unit, pc')}"`)}${f('code',L('商品编码','Item code'))}</div>
   <div class="row gap">${f('bar',L('条码（可扫码或留空）','Barcode (optional)'))}</div>
   <div class="row gap">${can('cost')||!id?f('cost',L('成本价','Cost')+' '+esc(CUR()),'','number'):''}${f('price',L('售价','Price')+' '+esc(CUR()),'','number')}</div>
   <div class="row gap">${f('min',L('安全库存（低于提醒）','Min stock (alert below)'),'','number')}${f('max',L('库存上限（可不填）','Max stock (optional)'),'','number')}</div>
   ${!id&&canInit()?`<div class="box" style="padding:12px 14px;margin-top:14px;background:var(--soft)"><div class="sm b">${L('期初库存（现有数量）','Opening stock (quantity on hand now)')}</div>${activeWh().map(w=>`<div class="row between" style="margin-top:8px;gap:8px"><span class="sm one">${esc(nm(w.n))}</span><input class="inp" type="number" inputmode="decimal" min="0" placeholder="0" style="width:110px;background:var(--card);text-align:right" oninput="S.epOpen['${w.id}']=+this.value"></div>`).join('')}</div>`:''}
   <label class="row gap" style="margin-top:12px"><input type="checkbox" ${p.batch?'checked':''} onchange="S.ep.batch=this.checked" style="width:20px;height:20px;accent-color:#0B7A4B"><span class="sm b">${L('按批次 / 效期管理','Track batches / expiry')}</span></label>
   <div class="row gap" style="margin-top:18px">${id?`<button class="bigbtn ghost" style="color:var(--red);flex:none;width:110px" onclick="prodDel('${id}')">${ic('trash',18)} ${L('删除','Delete')}</button>`:''}<button class="bigbtn" style="flex:1" onclick="prodSave()">${L('保存','Save')}</button></div>`)}
function nextProdCode(){let n=DB.all('products').length+1;const has=c=>(DB.d.products||[]).some(p=>p.code===c);let c;do{c='SP'+String(n).padStart(4,'0');n++}while(has(c));return c}
async function prodSave(){const p=S.ep;if(!p.n.zh.trim()&&!p.n.en.trim())return toast(L('请填写名称','Enter a name'));if(!p.code.trim())return toast(L('请填写商品编码','Enter an item code'));
  if(DB.all('products').some(x=>x.id!==p.id&&(x.code===p.code||(p.bar&&x.bar===p.bar))))return toast(L('编码或条码重复','Code or barcode already used'));
  await fillEn(p.n);p.unit.en=p.unit.en||p.unit.zh;if(catKey(p.cat))await fillEn(p.cat);
  const known=catList().find(c=>c.k===catKey(p.cat));if(known)p.cat={...known.n};
  const isNew=!p.id;const d=DB.put('products',p);
  if(isNew)Object.entries(S.epOpen||{}).forEach(([wh,q])=>{if(q>0)DB.put('stockreq',{type:'opening',status:'pending',wh,items:[{pid:d.id,qty:q,uc:+d.cost||0}],t:Date.now()})});
  closeSheet();toast(L('已保存','Saved'),false);render(false)}
function prodDel(id){const p=DB.get('products',id);const q=qtyOf(id);
  confirmSheet(L('删除商品？','Delete this product?'),`<b>${esc(nm(p.n))}</b><br>${q?L(`当前库存 ${n2(q)}，删除后不再出现在库存和开单里；以前的单据和流水仍保留。`,`${n2(q)} on hand. It will no longer appear in stock or new documents; past documents are kept.`):L('删除后不再出现在库存和开单里；以前的单据仍保留。','It will no longer appear in stock or new documents; past documents are kept.')}`,L('删除','Delete'),()=>{
    DB.put('products',{...DB.get('products',id),del:true});closeSheet(true);toast(L('已删除','Deleted'),false);if(S.view==='product')back();else render(false)})}
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
   <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('中文名称','Name (Chinese)')}</label><input class="inp" style="background:var(--card)" value="${esc(p.n.zh)}" data-zh2en="#eptEn" oninput="S.ept.n.zh=this.value"></div><div class="fld" style="flex:1;min-width:0"><label>${L('英文名称','Name (English)')}</label><input class="inp" id="eptEn" data-auto="1" style="background:var(--card)" value="${esc(p.n.en)}" placeholder="${L('自动生成，可修改','Auto-filled, editable')}" oninput="S.ept.n.en=this.value"></div></div>
   <div class="row gap"><div class="fld" style="flex:1;min-width:0"><label>${L('电话','Phone')}</label><input class="inp" style="background:var(--card)" value="${esc(p.phone)}" oninput="S.ept.phone=this.value"></div><div class="fld" style="flex:1;min-width:0"><label>${L('城市','City')}</label><input class="inp" style="background:var(--card)" value="${esc(p.city.zh||p.city.en)}" oninput="S.ept.city={zh:this.value,en:''}"></div></div>
   <button class="bigbtn" style="width:100%;margin-top:16px" onclick="ptSave()">${L('保存','Save')}</button>
   ${id?`<button class="bigbtn dark" style="width:100%;margin-top:10px;background:#fff;color:var(--red);border:1.5px solid var(--red)" onclick="ptDel('${id}')">${ic('trash',18)} ${L('删除','Delete')}</button>`:''}`)}
async function ptSave(){const p=S.ept;if(!(p.n.zh||'').trim()&&!(p.n.en||'').trim())return toast(L('请填写名称','Enter a name'));await fillEn(p.n);await fillEn(p.city);DB.put('partners',p);closeSheet();toast(L('已保存','Saved'),false);render(false)}
/* 有未结清的应收 / 应付或未完成的单据时不能删除；删除后历史单据仍显示名称，新单据里不再出现 */
function ptBusy(id){const p=DB.get('partners',id);const r=[];
  if(p.type==='sup'){const ps=DB.all('po').filter(o=>o.sup===id&&o.status!=='cancel');if(ps.some(o=>['draft','ordered'].includes(o.status)))r.push(L('有未完成的采购单','open purchase orders'));if(ps.reduce((a,o)=>a+apOf(o).bal,0)>0.005)r.push(L('还有未付清的货款','unpaid balance'))}
  else{const ss=DB.all('so').filter(o=>o.cus===id&&o.status!=='cancel');if(ss.some(o=>['draft','submitted','credit_gm','approved','rejected'].includes(o.status)))r.push(L('有未完成的销售单','open sales orders'));if(ss.reduce((a,o)=>a+arOf(o).bal,0)>0.005)r.push(L('还有未收清的货款','unpaid balance'))}
  return r}
function ptDel(id){const p=DB.get('partners',id);if(!p)return;if(!ptTypes().includes(p.type))return toast(L('没有权限','No permission'));const b=ptBusy(id);
  if(b.length)return openSheet(`<div class="sh">${L('暂时不能删除','Cannot delete yet')}</div><div class="sm" style="margin-top:8px;line-height:1.7"><b>${esc(nmP(p.n))}</b>：${b.join('、')}。${L('请先结清或取消后再删除。','Settle or cancel them first.')}</div><button class="bigbtn" style="width:100%;margin-top:16px" onclick="closeSheet()">${L('知道了','OK')}</button>`);
  openSheet(`<div class="sh">${L('删除往来单位？','Delete this partner?')}</div><div class="sm" style="margin-top:8px;line-height:1.7"><b>${esc(nmP(p.n))}</b><br>${L('删除后，新开单据里不再出现；以前的单据和报表仍保留它的名称。','It will no longer appear for new documents; past documents and reports keep its name.')}</div>
   <div class="row gap" style="margin-top:16px"><button class="bigbtn dark" style="flex:1" onclick="closeSheet()">${L('取消','Cancel')}</button><button class="bigbtn" style="flex:1;background:var(--red);color:#fff" onclick="DB.put('partners',{...DB.get('partners','${id}'),del:true,dt:Date.now()});closeSheet(true);toast(L('已删除','Deleted'),false);render(false)">${ic('trash',18)} ${L('删除','Delete')}</button></div>`)}
V.m_settings=()=>{const s=DB.get('settings','app')||{id:'app',co:{zh:'',en:''}};const isos=[...new Map(Object.values(AF).map(c=>[c.iso,c])).values()].sort((x,y)=>x.iso.localeCompare(y.iso));
  return hdr(L('系统设置','Settings'))+`<div class="pad"><div class="box" style="margin-top:6px"><h4>${L('公司','Company')}</h4>
   <div class="fld"><label>${L('公司名称（中）','Company (Chinese)')}</label><input class="inp" style="background:var(--soft)" id="stCz" data-zh2en="#stCe" value="${esc((s.co||{}).zh||'')}"></div><div class="fld"><label>${L('公司名称（英）','Company (English)')}</label><input class="inp" style="background:var(--soft)" id="stCe" data-auto="1" placeholder="${L('自动生成，可修改','Auto-filled, editable')}" value="${esc((s.co||{}).en||'')}"></div>
   <div class="fld"><label>${L('付款 / 退款 / 费用的总经理复审门槛','GM approval threshold for payments, refunds & expenses')} (${esc(baseIso())})</label><input id="stLimit" class="inp" type="number" min="0" value="${expLimit()}"></div><div class="note-g">${L('VAT状态：暂未注册；不加收VAT，不开具VAT税务发票。门槛变更只用于新申请。','VAT: unregistered. No VAT charged or VAT invoices issued. Threshold changes apply to new requests.')}</div>
   <div class="fld"><label>${L('结算货币（只用本国货币，全部单据和报表都用它）','Settlement currency (local currency only, used everywhere)')}</label><select class="inp" style="background:var(--soft)" id="stB">${isos.map(c=>`<option value="${c.iso}" ${c.iso===baseIso()?'selected':''}>${esc(c.sym)} ${c.iso} · ${esc(S.lang==='zh'?c.zh:c.en)}</option>`).join('')}</select></div>
    <div class="row gap" style="margin-top:4px"><div class="fld" style="flex:1;min-width:0"><label>${L('超过此金额需追加总经理审批','GM approval required above')}</label><input class="inp" id="stEL" type="number" readonly inputmode="decimal" style="background:var(--soft)" value="${expLimit()}"></div>
     <div class="fld" style="flex:1;min-width:0"><label>${L('外勤上班时间（点）','Field work start (hour)')}</label><input class="inp" id="stWS" type="number" min="0" max="23" style="background:var(--soft)" value="${+(s.workStart||9)}"></div></div>
   <div class="xs muted" style="margin-top:6px">${L('更改结算货币不会换算已有金额，请在开始使用前设定。','Changing it does not convert existing amounts — set it before you start.')}</div>
   <button class="bigbtn" style="width:100%;margin-top:14px" onclick="coSave()">${L('保存','Save')}</button></div>
   ${S.me.role==='chair'?`<div class="box"><h4>${L('数据管理','Data')}</h4>
    <div class="xs muted" style="line-height:1.7">${L('清空后：商品、分类、客户、供应商、所有单据、库存流水、财务和物流记录全部删除；账号密码、门店、公司设置和运费价格保留。','Clears items, categories, customers, suppliers, all documents, stock movements, finance and logistics; keeps accounts, stores, company settings and freight rates.')}</div>
    <button class="bigbtn" style="width:100%;margin-top:12px;background:var(--red);color:#fff" onclick="resetSheet()">${ic('trash',18)} ${L('清空业务数据，开始正式使用','Clear business data and start for real')}</button>
    ${DB.cloud?'':`<button class="bigbtn ghost" style="width:100%;margin-top:10px" onclick="confirmSheet(L('载入演示数据？','Load demo data?'),L('会用一套建材公司的演示数据替换现在的数据，仅供试用。','Replaces the current data with a sample building-materials company, for trying the app.'),L('载入','Load'),async()=>{await seedDemo();closeSheet(true);toast(L('已载入演示数据','Demo data loaded'),false);render(true)},false)">${L('载入演示数据（试用）','Load demo data (trial)')}</button>`}</div>`:''}
   <div class="box"><h4>${L('运费价格','Freight rates')}<span class="xs muted">${L('可用人民币或本币报价','Price in RMB or local currency')}</span></h4>
    ${Object.keys(MODES).map(k=>{const r=frRate(k);return `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">
     <div class="row gap" style="align-items:center"><b style="width:40px;flex:none" class="sm">${L(MODES[k][0],MODES[k][1])}</b>
      <input class="inp" style="flex:1;min-width:0;padding:8px 10px;background:var(--soft)" type="number" inputmode="decimal" min="0" value="${r.p}" aria-label="${L('单价','Unit price')}" onchange="setRate('${k}',0,this.value)">
      ${baseIso()==='CNY'?'':`<select class="inp" style="width:66px;flex:none;padding:8px 4px;background:var(--soft)" onchange="setRate('${k}',4,this.value)"><option value="CNY" ${r.cur==='CNY'?'selected':''}>¥</option><option value="base" ${r.cur!=='CNY'?'selected':''}>${esc(CUR())}</option></select>`}<select class="inp" style="width:100px;flex:none;padding:8px 6px;background:var(--soft)" onchange="setRate('${k}',3,this.value)">${Object.keys(FR_UNIT).map(u=>`<option value="${u}" ${r.unit===u?'selected':''}>${L('每','per ')}${frUnitName(u)}</option>`).join('')}</select></div>
     <div class="row gap xs muted" style="margin:6px 0 0 48px;align-items:center">${L('时效','Transit')}<input class="inp" style="width:56px;padding:6px;background:var(--soft);text-align:center" type="number" min="0" value="${r.d1}" onchange="setRate('${k}',1,this.value)">–<input class="inp" style="width:56px;padding:6px;background:var(--soft);text-align:center" type="number" min="0" value="${r.d2}" onchange="setRate('${k}',2,this.value)">${L('天','days')}</div></div>`}).join('')}
    <div class="xs muted" style="margin-top:8px;line-height:1.6">${L('运费 = 计费量 × 单价。计费量取实际重量与体积重量中较大的：按立方米计时 1 立方米 = 1000 公斤；按公斤计时体积重量 = 体积 × 换算系数（海运 1000、空运 167、陆运 333、快递 200）。','Freight = chargeable quantity × unit price. The larger of actual weight and volume weight is charged: per m³, 1 m³ = 1000 kg; per kg, volume weight = volume × factor (sea 1000, air 167, road 333, express 200).')}</div>
    <div class="box" style="margin:12px 0 0;background:var(--soft);padding:12px"><b class="sm">${L('试算','Try it')}</b><div class="row gap" style="margin-top:8px"><div style="flex:1"><div class="xs muted">${L('重量（公斤）','Weight (kg)')}</div><input class="inp" id="frKg" type="number" inputmode="decimal" value="${S.frKg||500}" style="background:var(--card)" oninput="S.frKg=this.value;frTry()"></div><div style="flex:1"><div class="xs muted">${L('体积（立方米）','Volume (m³)')}</div><input class="inp" id="frCbm" type="number" inputmode="decimal" value="${S.frCbm||2}" style="background:var(--card)" oninput="S.frCbm=this.value;frTry()"></div></div><div id="frOut" style="margin-top:8px">${Object.keys(MODES).map(k=>frLine(k,S.frKg||500,S.frCbm||2)).join('')}</div></div></div></div>`};

async function coSave(){const limit=+$('#stLimit').value;if(!Number.isFinite(limit)||limit<0)return toast(L('请输入有效审批门槛','Enter a valid approval threshold'));const co=await fillEn({zh:$('#stCz').value,en:$('#stCe').value});DB.put('settings',{...(DB.get('settings','app')||{id:'app'}),base:$('#stB').value,co,expLimit:limit,vatRegistered:false,workStart:8.5,workEnd:17});toast(L('已保存','Saved'),false);render(false)}
function resetSheet(){openSheet(`<div class="sh red">${L('清空业务数据','Clear business data')}</div><div class="sm" style="margin-top:8px;line-height:1.7">${L('所有商品、分类、客户、供应商、单据、库存、财务和物流记录都会被删除，不能恢复。其他部门的手机也会同步清空。请输入 <b>清空</b> 两个字确认。','All items, categories, customers, suppliers, documents, stock, finance and logistics records are deleted and cannot be restored. Other phones are cleared too. Type <b>CLEAR</b> to confirm.')}</div>
  <input class="inp" id="rsT" style="background:var(--card);margin-top:12px" autocomplete="off"><div class="sm red" id="rsE" style="margin-top:8px"></div>
  <button class="bigbtn" style="width:100%;margin-top:12px;background:var(--red);color:#fff" onclick="doReset()">${L('确认清空','Clear now')}</button>`)}
async function doReset(){const v=$('#rsT').value.trim();if(v!=='清空'&&v.toUpperCase()!=='CLEAR')return $('#rsE').textContent=L('请输入“清空”','Type CLEAR');
  try{await resetData();closeSheet(true);S.stC='all';LS.del('setupDone');toast(L('已清空，可以开始正式使用了','Cleared — you can start for real'),false);tab('home')}catch(e){$('#rsE').textContent=e.message}}
function setRate(k,i,v){const s=JSON.parse(JSON.stringify(DB.get('settings','app')||{id:'app'}));s.rates=s.rates||{};const r=frRate(k);s.rates[k]=[r.p,r.d1,r.d2,r.unit,r.cur==='CNY'?'CNY':'base'];s.rates[k][i]=i>=3?v:Math.max(0,+v||0);DB.put('settings',s);toast(L('已保存','Saved'),false);frTry()}
const frLine=(k,kg,cbm)=>{const x=frCost(k,kg,cbm);return `<div style="margin-top:8px"><div class="row between sm"><b>${L(MODES[k][0],MODES[k][1])}</b><b data-notr style="white-space:nowrap">${money(x.costB)}</b></div><div class="xs muted" data-notr>${n2(x.q)} ${frUnitName(x.unit)} × ${fmtC(x.p,x.cur)}${x.byVol?' · '+L('按体积计费','charged by volume'):''}</div></div>`};
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
  if(!DB.cloud&&/[?&]demo=1/.test(location.search)&&!LS.get('demo1',0)){await seedDemo();LS.set('demo1',1);LS.set('start4',1);LS.del(SK);}
  if(!DB.cloud&&!LS.get('start4',0)){await seedBlank();LS.set('start4',1);LS.del('setupDone');LS.del('setupUsers');LS.del(SK);Object.keys(localStorage).filter(k=>k.startsWith('jxc_notes')).forEach(k=>localStorage.removeItem(k))}
  /* 国家：手动选过就用手动的，否则按时区 / 手机语言自动识别；语言：手动选过的优先，否则匹配手机语言 */
  const cs=LS.get('country',null);S.country=cs&&cs.manual&&AF[cs.code]?cs.code:detectCountry();
  const lm=LS.get('lang',null),ls=langsOf(S.country);S.lang=lm&&ls.includes(lm)?lm:pickLang(S.country);
  await setLang(S.lang,true);
  /* 首次使用某种语言：先把界面文字翻好再显示（最多等 4 秒），不会先出英文再变外文 */
  if(!['zh','en'].includes(S.lang))await Promise.race([ensureLang(S.lang),new Promise(r=>setTimeout(r,4000))]);
  S.online=navigator.onLine;
  if(restoreSession()){S.view=/mgmt/.test(location.hash)&&can('mgmt')?'mgmt':'home';Alerts.first()}else S.view='login';
  render(true);Sync.start();if(S.me){Sync.run('boot');bindPushRegistration()}
  /* 更新完成后，告诉用户更新了什么（只显示一次） */
  const from=LS.get('updFrom',null);if(from&&from!==APP_VER){LS.set('updFrom',null);setTimeout(async()=>{let v=null;try{v=await (await fetch('version.json?t='+Date.now(),{cache:'no-store'})).json()}catch(e){}
    openSheet(`<div class="sh">✓ ${L('已更新到','Updated to')} v${APP_VER}</div>${v&&v.version===APP_VER?updNotes(v):''}<button class="bigbtn" style="width:100%;margin-top:18px" onclick="closeSheet()">${L('好的','OK')}</button>`)},600)}
  /* 何时检查更新：启动后、回到前台、每 30 分钟 */
  if(location.protocol==='https:'){setTimeout(()=>checkUpdate(false),2500);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkUpdate(false)});setInterval(()=>checkUpdate(false),30*60e3)}
}
/* 屏幕顶部插入下拉刷新提示 */
const _r0=render;render=function(top,soft){_r0(top,soft);const f=$('#screen .fade');if(f&&S.me&&!$('#ptr')){const p=document.createElement('div');p.id='ptr';p.className='ptr';f.prepend(p)}};
/* Android 返回键（App 内） */
(function(){const C=window.Capacitor;if(!C||!C.isNativePlatform||!C.isNativePlatform())return;const A=C.Plugins&&C.Plugins.App;if(!A)return;
  A.addListener('backButton',()=>{if(sheetOn())return closeSheet();if(S.hist.length)return back();if(S.view!=='home'&&S.me)return tab('home');A.exitApp()});
  A.addListener('resume',()=>{Sync.run();checkUpdate(false)})})();
if(!isNative()&&'serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
boot().catch(e=>{console.error('Application startup failed',e);const screen=$('#screen');if(screen)screen.innerHTML=`<div class="pad"><div class="box"><h3>${L('暂时无法启动','Unable to start')}</h3><p>${L('请检查网络后重试；已保存的数据保留在设备上。','Check the connection and retry. Saved device data is retained.')}</p><button class="bigbtn" onclick="location.reload()">${L('重新打开','Retry')}</button></div></div>`});
