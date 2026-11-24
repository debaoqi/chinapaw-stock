/* ================= 华宝进销存 · ChinaPaw Stock — 核心（用户端与管理后台共用） =================
   结构与 ChinaPaw 一致：单文件网页应用 + version.json 热更新 + 可选 Supabase 云端（只通过 RPC 读写）。
   未配置云端时以“本机演示模式”运行（数据存于本机 localStorage），配置后自动切换为多人实时同步。 */
const APP_VER='1.0.0',APP_BUILD=1;
const CFG=window.JXC_CONFIG||{};
const SK=window.JXC_SESS||'sess';/* 用户端与管理后台各自保存登录状态 */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const LS={get(k,d){try{const v=localStorage.getItem('jxc_'+k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem('jxc_'+k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem('jxc_'+k)}catch(e){}}};
const S={lang:'zh',view:'login',params:{},hist:[],me:null,online:navigator.onLine,syncing:false};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>(p||'')+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const isNative=()=>!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());

/* ---------- 语言：中文 / English（与 ChinaPaw 相同：按钮只显示目标语言，中文时显示 EN，英文时显示 中） ---------- */
function detectLang(){const ls=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'en'];
  for(const l of ls){const c=(l||'').slice(0,2).toLowerCase();if(c==='zh')return 'zh';if(c==='en')return 'en'}return 'en'}
const L=(zh,en)=>S.lang==='zh'?zh:en;
const nm=v=>v==null?'':typeof v==='object'?(v[S.lang]||v.zh||v.en||''):String(v);
function langBtn(){return `<button class="langbtn" data-notr onclick="setLang('${S.lang==='zh'?'en':'zh'}')" title="${S.lang==='zh'?'English':'中文'}">${S.lang==='zh'?'EN':'中'}</button>`}
function setLang(l){S.lang=l;document.documentElement.lang=l==='zh'?'zh-CN':'en';LS.set('lang',l);try{$('#toast').classList.remove('on')}catch(e){}document.title=L('华宝进销存','ChinaPaw Stock');if(window.render)render(false)}

/* ---------- 图标 ---------- */
const ICONS={
 home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
 box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
 doc:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
 truck:'<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
 users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5M16 4.5a3.5 3.5 0 0 1 0 7M18 13.7c2.1.8 3.5 3 3.5 5.3"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
 arrow:'<path d="M7 17 17 7M8 7h9v9"/>',back:'<path d="m15 18-6-6 6-6"/>',chev:'<path d="m9 18 6-6-6-6"/>',down:'<path d="m6 9 6 6 6-6"/>',
 bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',
 cloud:'<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/>',
 refresh:'<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
 lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 logout:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
 chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
 wh:'<path d="M3 21V9l9-5 9 5v12M7 21v-8h10v8M7 17h10"/>',
 tag:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
 cart:'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L22 8H6"/>',
 in:'<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',out:'<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
 ret:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
 clip:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11l2 2 4-4M9 17h6"/>',
 camera:'<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
 copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
 link:'<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
 pin:'<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
 ship:'<path d="M3 17l2 4h14l2-4M5 17V9h14v8M9 9V5h6v4M12 5V2"/><path d="M2 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1"/>',
 plane:'<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
 calc:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>',
 phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
 edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
 shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
 download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',upload:'<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 msg:'<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>'
};
const ic=(n,s)=>`<svg class="i" viewBox="0 0 24 24"${s?` style="width:${s}px;height:${s}px"`:''}>${ICONS[n]||''}</svg>`;

/* ---------- 格式化 ---------- */
const CUR=()=>(DB.get('settings','app')||{}).cur||'GH₵';
const n2=n=>(Math.round((+n||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
const money=n=>CUR()+' '+(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const numK=n=>{n=+n||0;return Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e4?(n/1e3).toFixed(1)+'k':n2(n)};
const moneyK=n=>{n=+n||0;return CUR()+' '+(Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e4?(n/1e3).toFixed(1)+'k':n2(n))};
const pad2=n=>String(n).padStart(2,'0');
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fdate(t,withTime=true){if(!t)return '';const d=new Date(t);const tm=withTime?' '+pad2(d.getHours())+':'+pad2(d.getMinutes()):'';
  return S.lang==='zh'?`${d.getMonth()+1}月${d.getDate()}日${tm}`:`${MON[d.getMonth()]} ${d.getDate()}${tm}`}
function fday(t){if(!t)return '';const d=new Date(t);return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
function ago(t){const s=(Date.now()-t)/1000;if(s<60)return L('刚刚','just now');if(s<3600)return Math.floor(s/60)+L(' 分钟前',' min ago');
  if(s<86400)return Math.floor(s/3600)+L(' 小时前',' h ago');if(s<172800)return L('昨天','yesterday');return fdate(t,false)}
const dayStart=(t=Date.now())=>{const d=new Date(t);d.setHours(0,0,0,0);return +d};

/* ---------- 角色权限 ---------- */
const ROLES={
 admin:{zh:'管理员',en:'Admin',c:'b-dark',p:'*'},
 buyer:{zh:'采购员',en:'Purchaser',c:'b-blue',p:['stock','po','po_ret','logi','report','cost','partner']},
 sales:{zh:'销售员',en:'Sales',c:'b-gold',p:['stock','so','so_ret','logi','report','partner']},
 keeper:{zh:'库管',en:'Warehouse keeper',c:'b-green',p:['stock','po_recv','po_ret','so_ship','so_ret','take','logi','report','cost']},
 viewer:{zh:'查看者',en:'Viewer',c:'b-grey',p:['stock','report']}
};
function can(p,u){u=u||S.me;if(!u)return false;const r=ROLES[u.role];if(!r)return false;return r.p==='*'||r.p.includes(p)}
const roleName=r=>nm(ROLES[r]||{zh:r,en:r});

/* ================= 数据层：本机数据库 + 待提交队列（离线可用） + 云端同步 ================= */
const KINDS=['settings','wh','products','partners','moves','po','grn','pr','so','sr','counts','ships','svc','users'];
const DB={
  d:{},outbox:[],seq:0,lastSync:0,ver:0,cloud:!!(CFG.supabaseUrl&&CFG.supabaseAnonKey),
  load(){const s=LS.get('db',null);KINDS.forEach(k=>this.d[k]=(s&&s[k])||[]);this.outbox=LS.get('outbox',[]);this.seq=LS.get('seq',0);this.lastSync=LS.get('lastSync',0);this.ver++},
  save(){const o={};KINDS.forEach(k=>o[k]=this.d[k]);LS.set('db',o);LS.set('outbox',this.outbox);LS.set('seq',this.seq);LS.set('lastSync',this.lastSync)},
  all(k){return (this.d[k]||[]).filter(x=>!x.del)},
  get(k,id){return (this.d[k]||[]).find(x=>x.id===id)},
  /* 写入一条记录：本机立即生效，进入待提交队列；联网后自动提交到云端 */
  put(k,doc,opt={}){doc={...doc};if(!doc.id)doc.id=uid(k.slice(0,2));doc.u=Date.now();doc.by=doc.by||(S.me&&S.me.id)||'';
    const a=this.d[k]||(this.d[k]=[]);const i=a.findIndex(x=>x.id===doc.id);if(i>=0)a[i]=doc;else a.push(doc);
    if(!opt.local){this.outbox.push({k,id:doc.id,d:doc});doc._q=1}
    this.ver++;this.save();if(!opt.quiet){bc('chg',[{k,d:doc}]);setTimeout(()=>Sync.run(),50)}return doc},
  merge(rows){let n=0;rows.forEach(r=>{const a=this.d[r.k]||(this.d[r.k]=[]);const i=a.findIndex(x=>x.id===r.d.id);
      if(i>=0){if(a[i]._q&&this.outbox.some(o=>o.k===r.k&&o.id===r.d.id))return;if((a[i].u||0)>(r.d.u||0)&&!r.force)return;a[i]=r.d}else a.push(r.d);n++});
    if(n){this.ver++;this.save()}return n}
};
/* 同一台设备多个窗口之间实时同步（演示多人协作，也让手机桌面版与浏览器版保持一致） */
let BC=null;try{BC=new BroadcastChannel('jxc')}catch(e){}
function bc(type,rows){try{BC&&BC.postMessage({type,rows})}catch(e){}}
if(BC)BC.onmessage=e=>{const m=e.data||{};if(m.type==='chg'){const rows=(m.rows||[]).map(r=>({k:r.k,d:{...r.d,_q:0},force:true}));DB.merge(rows);onRemote(rows)}
  else if(m.type==='reset'){DB.load();if(window.render)render(false)}};
function onRemote(rows){try{typeof Alerts!=='undefined'&&Alerts.scan(rows)}catch(e){console.error(e)}if(window.softRender)softRender()}

/* 云端（Supabase）：所有读写都走 RPC 函数，便于权限控制（与 ChinaPaw 相同的安全原则） */
async function rpc(fn,args){const r=await fetch(CFG.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/'+fn,{method:'POST',
   headers:{apikey:CFG.supabaseAnonKey,Authorization:'Bearer '+CFG.supabaseAnonKey,'Content-Type':'application/json'},body:JSON.stringify(args||{})});
  const tx=await r.text();if(!r.ok){let m=tx;try{m=JSON.parse(tx).message||tx}catch(e){}throw new Error(m)}return tx?JSON.parse(tx):null}
const Sync={timer:null,
  async run(force){
    if(S.syncing)return;if(!navigator.onLine){S.online=false;window.syncUI&&syncUI();return}
    S.syncing=true;window.syncUI&&syncUI();
    try{
      if(DB.cloud&&S.token){
        for(let b=0;DB.outbox.length&&b<25;b++){const ops=DB.outbox.slice(0,200).map(o=>({k:o.k,id:o.id,d:{...o.d,_q:undefined}}));
          const r=await rpc('jxc_push',{p_token:S.token,p_ops:ops});
          DB.outbox.splice(0,ops.length);ops.forEach(o=>{const x=DB.get(o.k,o.id);if(x&&!DB.outbox.some(q=>q.k===o.k&&q.id===o.id))delete x._q});
          if(r&&r.rejected&&r.rejected.length){const rj=new Set(r.rejected);ops.filter(o=>rj.has(o.id)).forEach(o=>{DB.d[o.k]=(DB.d[o.k]||[]).filter(x=>x.id!==o.id)});DB.seq=0;DB.ver++}
          if(r&&r.rejected&&r.rejected.length)toast(L('有 ','')+r.rejected.length+L(' 条记录无权限，未提交',' change(s) rejected (no permission)'))}
        const p=await rpc('jxc_pull',{p_token:S.token,p_since:DB.seq});
        if(p){const rows=(p.rows||[]).map(r=>({k:r.k,d:r.d,force:true}));const mine=new Set(DB.outbox.map(o=>o.k+o.id));
          const fresh=rows.filter(r=>!mine.has(r.k+r.d.id));DB.merge(fresh);DB.seq=p.seq||DB.seq;
          if(p.users)DB.d.users=p.users;if(fresh.length&&(force!=='boot'))onRemote(fresh.filter(r=>r.d.by!==S.me.id))}
      }else{
        /* 本机演示模式：联网时把暂存的单据“提交”（清空队列） */
        if(DB.outbox.length){const ks=new Set(DB.outbox.map(o=>o.k+o.id));DB.outbox=[];(KINDS).forEach(k=>DB.d[k].forEach(x=>{if(ks.has(k+x.id))delete x._q}))}
      }
      DB.lastSync=Date.now();DB.save();S.online=true;S.syncErr='';
    }catch(e){console.error(e);S.syncErr=String(e.message||e);if(force===true)toast(L('同步失败：','Sync failed: ')+S.syncErr)}
    finally{S.syncing=false;window.syncUI&&syncUI();if(force===true&&!S.syncErr)toast(L('已同步','Synced'));if(window.softRender)softRender()}},
  start(){clearInterval(this.timer);const tick=()=>{if(document.visibilityState==='visible')this.run()};
    this.timer=setInterval(tick,DB.cloud?8000:20000);
    addEventListener('online',()=>{S.online=true;toast(L('网络已恢复，正在自动提交','Back online, submitting…'));this.run();window.syncUI&&syncUI();window.render&&render(false)});
    addEventListener('offline',()=>{S.online=false;window.syncUI&&syncUI();window.render&&render(false)});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')this.run()})}
};

/* ---------- 库存引擎：库存 = 全部出入库流水之和（离线、多人同时操作都不会算错） ---------- */
let _sm=null,_smv=-1;
function stockMap(){if(_smv===DB.ver&&_sm)return _sm;const m={};
  DB.all('moves').forEach(v=>{const p=m[v.pid]||(m[v.pid]={q:0,w:{}});p.q+=v.qty;const w=p.w[v.wh]||(p.w[v.wh]={q:0,b:{}});w.q+=v.qty;
    const bk=v.batch||'-';const b=w.b[bk]||(w.b[bk]={q:0,exp:v.exp||'',batch:v.batch||''});b.q+=v.qty;if(v.exp&&!b.exp)b.exp=v.exp});
  _sm=m;_smv=DB.ver;return m}
const qtyOf=(pid,wh)=>{const p=stockMap()[pid];if(!p)return 0;return wh?((p.w[wh]||{}).q||0):p.q};
function batchesOf(pid,wh){const p=stockMap()[pid];if(!p)return [];const out=[];Object.entries(p.w).forEach(([w,x])=>{if(wh&&w!==wh)return;
  Object.values(x.b).forEach(b=>{if(Math.abs(b.q)>1e-9)out.push({...b,wh:w})})});return out.sort((a,b)=>(a.exp||'9999').localeCompare(b.exp||'9999'))}
function stStatus(p,q){if(q==null)q=qtyOf(p.id);if(q<=0)return 'out';if(q<=(+p.min||0))return 'low';if(p.max&&q>=+p.max)return 'over';return 'ok'}
const ST_NAME={ok:['正常','Normal','b-green'],low:['不足','Low','b-red'],over:['积压','Overstock','b-purple'],out:['缺货','Out','b-red']};
const stBadge=s=>`<span class="badge ${ST_NAME[s][2]}">${L(ST_NAME[s][0],ST_NAME[s][1])}</span>`;
/* 先到期先出（FEFO）分配批次 */
function allocate(pid,wh,qty){const bs=batchesOf(pid,wh).filter(b=>b.q>0);const r=[];let left=qty;
  for(const b of bs){if(left<=0)break;const take=Math.min(b.q,left);r.push({batch:b.batch,exp:b.exp,qty:take});left-=take}
  if(left>1e-9)return null;return r}
function addMove(o){return DB.put('moves',{t:Date.now(),...o})}
const MV={init:['期初','Opening','b-grey'],po_in:['采购入库','Purchase in','b-green'],po_ret:['采购退货','Purchase return','b-orange'],
  so_out:['销售出库','Sales out','b-blue'],so_ret:['销售退货','Sales return','b-purple'],adj:['盘点调整','Count adjust','b-gold']};
const mvName=t=>L((MV[t]||[t,t])[0],(MV[t]||[t,t])[1]);

/* ---------- 单据状态 ---------- */
const PO_ST={draft:['草稿','Draft','b-grey'],ordered:['已下单','Ordered','b-blue'],received:['已入库','Received','b-green'],done:['已完成','Completed','b-dark'],cancel:['已取消','Cancelled','b-grey']};
const SO_ST={draft:['草稿','Draft','b-grey'],submitted:['待出库','To ship','b-gold'],shipped:['已出库','Shipped','b-blue'],done:['已完成','Completed','b-dark'],cancel:['已取消','Cancelled','b-grey']};
const TK_ST={pending:['待审核','Pending','b-gold'],approved:['已审核','Approved','b-green'],rejected:['已驳回','Rejected','b-red']};
const SH_ST={pending:['待揽收','Awaiting pickup','b-grey'],picked:['已揽收','Picked up','b-blue'],transit:['运输中','In transit','b-blue'],customs:['清关中','Customs','b-purple'],
  delivering:['派送中','Out for delivery','b-gold'],delivered:['已签收','Delivered','b-green'],exception:['异常','Exception','b-red']};
const SH_FLOW=['pending','picked','transit','customs','delivering','delivered'];
const stB=(M,s)=>{const x=M[s]||[s,s,'b-grey'];return `<span class="badge ${x[2]}">${L(x[0],x[1])}</span>`};
function genNo(pre){const d=new Date();return pre+String(d.getFullYear()).slice(2)+pad2(d.getMonth()+1)+pad2(d.getDate())+'-'+Math.random().toString(36).slice(2,5).toUpperCase()}
const lineTotal=it=>(+it.qty||0)*(+it.price||0);
const docTotal=d=>(d.items||[]).reduce((a,i)=>a+lineTotal(i),0);

/* ---------- 物流：承运商与官网查询地址 ---------- */
const CARRIERS=[
 {id:'own',zh:'自有车队',en:'Own fleet',mode:'road'},
 {id:'local',zh:'本地货运',en:'Local haulage',mode:'road'},
 {id:'dhl',zh:'DHL 快递',en:'DHL Express',mode:'express',url:'https://www.dhl.com/gh-en/home/tracking/tracking-express.html?submit=1&tracking-id={no}'},
 {id:'maersk',zh:'马士基',en:'Maersk',mode:'sea',url:'https://www.maersk.com/tracking/{no}'},
 {id:'msc',zh:'地中海航运 MSC',en:'MSC',mode:'sea',url:'https://www.msc.com/en/track-a-shipment?agencyPath=msc&trackingNumber={no}'},
 {id:'cosco',zh:'中远海运',en:'COSCO Shipping',mode:'sea',url:'https://elines.coscoshipping.com/ebusiness/cargoTracking?trackingType=CONTAINER&number={no}'},
 {id:'cma',zh:'达飞轮船',en:'CMA CGM',mode:'sea',url:'https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference={no}'},
 {id:'air',zh:'航空货运',en:'Air cargo',mode:'air',url:'https://t.17track.net/en#nums={no}'},
 {id:'other',zh:'其他（17TRACK 查询）',en:'Other (17TRACK)',mode:'express',url:'https://t.17track.net/en#nums={no}'}];
const MODES={sea:['海运','Sea','ship'],air:['空运','Air','plane'],road:['陆运','Road','truck'],express:['快递','Express','box']};
const carrier=id=>CARRIERS.find(c=>c.id===id)||CARRIERS[CARRIERS.length-1];
const trackUrl=s=>{const c=carrier(s.carrier);return c.url&&s.trackNo?c.url.replace('{no}',encodeURIComponent(s.trackNo)):''};

/* ---------- 上传：图片压缩 + 上传到云端存储（去重、失败自动重试；与 ChinaPaw upImg 相同） ---------- */
function resizeImg(f,max){return new Promise(res=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height));
  const c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.8))};im.src=r.result};r.readAsDataURL(f)})}
function pickImage(max,cb,capture){const i=document.createElement('input');i.type='file';i.accept='image/*';if(capture)i.capture='environment';
  i.onchange=async()=>{const f=i.files[0];if(!f)return;const du=await resizeImg(f,max||1000);cb(await upImg(du))};i.click()}
async function sha1(u8){const h=await crypto.subtle.digest('SHA-1',u8);return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
const upCache=LS.get('mediaUp',{});
async function upImg(du){
  if(!DB.cloud||typeof du!=='string'||!du.startsWith('data:image/'))return du;
  const m=/^data:(image\/(jpeg|jpg|png|webp));base64,([\s\S]*)$/.exec(du);if(!m)return du;
  try{const bin=atob(m[3]);const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    const h=await sha1(u8);if(upCache[h])return upCache[h];const ext=m[2]==='png'?'png':'jpg',type=ext==='jpg'?'image/jpeg':'image/png';
    const name='jxc/'+h.slice(0,2)+'/'+h+'.'+ext;const BASE=CFG.supabaseUrl.replace(/\/$/,'');let ok=false;
    for(let a=0;a<4&&!ok;a++){if(a)await new Promise(z=>setTimeout(z,[0,800,2000,4500][a]));
      try{const r=await fetch(BASE+'/storage/v1/object/media/'+name,{method:'POST',headers:{apikey:CFG.supabaseAnonKey,Authorization:'Bearer '+CFG.supabaseAnonKey,'Content-Type':type,'cache-control':'max-age=31536000','x-upsert':'false'},body:new Blob([u8],{type})});
        if(r.ok){ok=true;break}const t=await r.text().catch(()=>'');if(/Duplicate|already exists/i.test(t)){ok=true;break}if(r.status<500&&r.status!==429)break}catch(e){}}
    if(!ok)return du;const url=BASE+'/storage/v1/object/public/media/'+name;upCache[h]=url;LS.set('mediaUp',upCache);return url}catch(e){return du}}

/* ---------- 下载：导出 CSV / JSON（浏览器直接下载；App 内用系统分享） ---------- */
async function downloadFile(name,text,type){const blob=new Blob(['﻿'+text],{type:type||'text/csv;charset=utf-8'});
  try{if(isNative()&&navigator.canShare){const f=new File([blob],name,{type:blob.type});if(navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return}}}catch(e){}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);toast(L('已开始下载：','Downloading: ')+name)}
const csv=rows=>rows.map(r=>r.map(c=>{c=c==null?'':String(c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\n');

/* ---------- 账号：本机模式用 SHA-256 摘要；云端模式由数据库 crypt() 校验 ---------- */
async function pwHash(phone,pw){const b=new TextEncoder().encode('jxc|'+phone+'|'+pw);const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function login(phone,pw,trust){phone=String(phone).replace(/\s/g,'');
  if(DB.cloud){const r=await rpc('jxc_login',{p_phone:phone,p_pw:pw,p_device:navigator.userAgent.slice(0,120)});if(!r||!r.token)throw new Error(L('手机号或密码错误','Wrong phone or password'));
    S.token=r.token;S.me=r.user}
  else{const u=DB.all('users').find(x=>x.phone===phone&&x.active!==false);if(!u||u.pw!==await pwHash(phone,pw))throw new Error(L('手机号或密码错误','Wrong phone or password'));S.me={...u};delete S.me.pw}
  LS.set('lastPhone',phone);LS.set(SK,{me:S.me,token:S.token||null,trust:!!trust,t:Date.now()})}
function restoreSession(){const s=LS.get(SK,null);if(!s||!s.trust)return false;if(Date.now()-s.t>30*864e5)return false;S.me=s.me;S.token=s.token;
  if(!DB.cloud){const u=DB.get('users',S.me.id);if(!u||u.active===false)return false;S.me={...u};delete S.me.pw}return true}
function logout(){const s=LS.get(SK,null);if(DB.cloud&&S.token)rpc('jxc_logout',{p_token:S.token}).catch(()=>{});LS.del(SK);S.me=null;S.token=null}
async function changePw(old,nw){if(DB.cloud){await rpc('jxc_change_pw',{p_token:S.token,p_old:old,p_new:nw});return}
  const u=DB.get('users',S.me.id);if(u.pw!==await pwHash(u.phone,old))throw new Error(L('原密码不正确','Current password is wrong'));DB.put('users',{...u,pw:await pwHash(u.phone,nw)})}

/* ================= 演示数据（加纳建材贸易场景，与 ChinaPaw 同一市场） ================= */
function ean(base){const d=base.split('').map(Number);let s=0;d.forEach((x,i)=>s+=x*(i%2?3:1));return base+((10-s%10)%10)}
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
async function seedDemo(){
  const R=rng(20261124),pick=a=>a[Math.floor(R()*a.length)],now=Date.now(),D=864e5;
  const d={};KINDS.forEach(k=>d[k]=[]);
  d.settings=[{id:'app',cur:'GH₵',co:{zh:'华兴建材（加纳）',en:'Huaxing Building Materials (Ghana)'},rates:{sea:[1.2,28,45],air:[6.5,5,9],road:[0.35,1,3],express:[12,3,6]},lowRule:'min'}];
  d.wh=[{id:'W1',n:{zh:'特马总仓',en:'Tema Main Warehouse'},city:{zh:'特马',en:'Tema'}},{id:'W2',n:{zh:'阿克拉门店仓',en:'Accra Shop Store'},city:{zh:'阿克拉',en:'Accra'}},{id:'W3',n:{zh:'库马西仓',en:'Kumasi Warehouse'},city:{zh:'库马西',en:'Kumasi'}}];
  const P=[['水泥 42.5R 50kg','Cement 42.5R 50kg','包','bag',78,92,300,4000,1,'建材','Building'],
   ['螺纹钢 Φ12 12m','Rebar Φ12 12m','根','pc',95,118,150,2500,0,'钢材','Steel'],['螺纹钢 Φ16 12m','Rebar Φ16 12m','根','pc',168,205,100,1500,0,'钢材','Steel'],
   ['PPR 水管 25mm 4m','PPR Pipe 25mm 4m','根','pc',18,26,200,1200,0,'水电','Plumbing'],['PVC 排水管 110mm','PVC Drain Pipe 110mm','根','pc',45,62,80,800,0,'水电','Plumbing'],
   ['抛光瓷砖 600×600','Polished Tile 600×600','箱','box',105,138,120,1500,0,'装饰','Finishing'],['电线 2.5mm² 100m','Electric Wire 2.5mm² 100m','卷','roll',320,415,40,400,0,'水电','Electrical'],
   ['LED 球泡灯 12W','LED Bulb 12W','个','pc',9,15,300,3000,0,'灯具','Lighting'],['乳胶漆 20L 白色','Emulsion Paint 20L White','桶','pail',210,280,40,500,1,'装饰','Finishing'],
   ['瓷砖胶 25kg','Tile Adhesive 25kg','袋','bag',48,65,100,1200,1,'装饰','Finishing'],['镀锌铁皮 0.3mm','Roofing Sheet 0.3mm','张','sheet',62,85,150,1800,0,'建材','Building'],
   ['汽油发电机 5kW','Petrol Generator 5kW','台','set',3150,3980,5,40,0,'设备','Equipment'],['太阳能板 450W','Solar Panel 450W','块','pc',980,1260,20,200,0,'设备','Equipment'],
   ['铁钉 3寸 25kg','Iron Nails 3" 25kg','箱','carton',260,330,30,300,0,'五金','Hardware'],['防水涂料 20kg','Waterproof Coating 20kg','桶','pail',185,245,30,300,1,'装饰','Finishing'],
   ['角磨机 125mm','Angle Grinder 125mm','台','set',230,310,10,120,0,'工具','Tools']];
  d.products=P.map((p,i)=>({id:'P'+(i+1),code:'HX-'+String(1001+i),bar:ean('69'+String(2026110000+i*37).slice(0,10)),n:{zh:p[0],en:p[1]},unit:{zh:p[2],en:p[3]},
    cost:p[4],price:p[5],min:p[6],max:p[7],batch:!!p[8],cat:{zh:p[9],en:p[10]},sup:i<1?'S2':i>=6&&i<8||i===11||i===12?'S3':'S1'}));
  d.partners=[{id:'S1',type:'sup',n:{zh:'华兴建材（广州）',en:'Huaxing Building Materials (Guangzhou)'},phone:'+86 20 8888 0001',city:{zh:'中国广州',en:'Guangzhou, China'}},
   {id:'S2',type:'sup',n:{zh:'西非水泥厂',en:'West Africa Cement Works'},phone:'0302 000 111',city:{zh:'特马',en:'Tema'}},
   {id:'S3',type:'sup',n:{zh:'远航电器',en:'Yuanhang Electrical'},phone:'+86 757 0000 222',city:{zh:'中国佛山',en:'Foshan, China'}},
   {id:'C1',type:'cus',n:{zh:'科菲五金店',en:'Kofi Hardware'},phone:'024 111 2233',city:{zh:'阿克拉',en:'Accra'}},
   {id:'C2',type:'cus',n:{zh:'阿克拉建筑公司',en:'Accra Builders Ltd'},phone:'020 555 6677',city:{zh:'阿克拉',en:'Accra'}},
   {id:'C3',type:'cus',n:{zh:'华程路桥加纳项目部',en:'Huacheng Road & Bridge (Ghana)'},phone:'054 222 8899',city:{zh:'塔科拉迪',en:'Takoradi'}},
   {id:'C4',type:'cus',n:{zh:'夸梅装饰',en:'Kwame Decor'},phone:'027 333 4455',city:{zh:'库马西',en:'Kumasi'}},
   {id:'C5',type:'cus',n:{zh:'库马西建材城',en:'Kumasi Building Mart'},phone:'050 777 1212',city:{zh:'库马西',en:'Kumasi'}}];
  const U=[['U1','admin',{zh:'王经理',en:'Manager Wang'},'0240000001','W1'],['U2','buyer',{zh:'李采购',en:'Li (Purchasing)'},'0240000002','W1'],
   ['U3','sales',{zh:'阿玛·门萨',en:'Ama Mensah'},'0240000003','W2'],['U4','keeper',{zh:'科乔·阿散蒂',en:'Kojo Asante'},'0240000004','W1'],['U5','viewer',{zh:'陈会计',en:'Chen (Accounts)'},'0240000005','W1']];
  for(const u of U)d.users.push({id:u[0],role:u[1],name:u[2],phone:u[3],wh:u[4],active:true,pw:await pwHash(u[3],'123456')});
  const mv=(o)=>d.moves.push({id:'dm'+d.moves.length,u:o.t,by:o.by||'U4',...o});
  const t0=now-34*D;const exp=(days)=>fday(now+days*D);
  /* 按先到期先出扣减批次 */
  const seedOut=(pid,wh,qty,t,ref)=>{const bs={};d.moves.filter(m=>m.pid===pid&&m.wh===wh).forEach(m=>{const k=m.batch||'';bs[k]=bs[k]||{q:0,exp:m.exp||''};bs[k].q+=m.qty;if(m.exp)bs[k].exp=m.exp});
    let left=qty;Object.entries(bs).filter(([k,b])=>b.q>0).sort((a,b)=>(a[1].exp||'9').localeCompare(b[1].exp||'9')).forEach(([k,b])=>{if(left<=0)return;const take=Math.min(b.q,left);left-=take;mv({t,pid,wh,qty:-take,type:'so_out',ref,by:'U4',batch:k,exp:b.exp})})};
  /* 期初库存 */
  const open={P1:[1800,600,500],P2:[900,200,300],P3:[500,60,120],P4:[1500,300,0],P5:[260,90,60],P6:[420,160,200],P7:[90,40,30],P8:[600,200,120],P9:[120,50,40],P10:[400,150,120],P11:[700,200,260],P12:[14,6,4],P13:[12,4,2],P14:[90,30,30],P15:[70,30,20],P16:[6,2,1]};
  Object.entries(open).forEach(([pid,a])=>a.forEach((q,i)=>{if(!q)return;const p=d.products.find(x=>x.id===pid);mv({t:t0,pid,wh:'W'+(i+1),qty:q,type:'init',ref:'',batch:p.batch?'B'+fday(t0).replace(/-/g,'').slice(2)+'A':'',exp:p.batch?exp(p.id==='P1'?40:200):''})}));
  /* 历史销售（近 30 天） */
  const cus=['C1','C2','C3','C4','C5'];let soN=0;
  for(let day=30;day>=1;day--){const n=1+Math.floor(R()*3);for(let k=0;k<n;k++){
    const t=dayStart(now-day*D)+(8+Math.floor(R()*9))*36e5+Math.floor(R()*3600e3);const wh=pick(['W1','W1','W2','W3']);
    const items=[];const cnt=1+Math.floor(R()*3);const used=new Set();
    for(let j=0;j<cnt;j++){const p=pick(d.products);if(used.has(p.id))continue;used.add(p.id);const big=p.price<100;items.push({pid:p.id,qty:big?10+Math.floor(R()*60):1+Math.floor(R()*6),price:p.price})}
    const id='so'+(++soN),no='SO'+fday(t).slice(2).replace(/-/g,'')+'-'+(100+soN);
    const ok=items.every(it=>{const have=d.moves.filter(m=>m.pid===it.pid&&m.wh===wh).reduce((a,m)=>a+m.qty,0);return have>=it.qty});if(!ok)continue;
    d.so.push({id,no,cus:pick(cus),wh,items:items.map(i=>({...i,shipped:i.qty})),status:'done',t,u:t,by:'U3',st:t+36e5});
    items.forEach(it=>seedOut(it.pid,wh,it.qty,t+36e5,id))}}
  /* 历史采购 */
  const poDef=[[26,'S2','W1',[['P1',1200]]],[19,'S1','W1',[['P2',600],['P3',200],['P11',300]]],[12,'S3','W1',[['P7',60],['P8',800]]],[6,'S2','W1',[['P1',1000]]],[3,'S1','W2',[['P6',200],['P10',300],['P9',80]]]];
  poDef.forEach((x,i)=>{const t=now-x[0]*D;const id='po'+(i+1),no='PO'+fday(t).slice(2).replace(/-/g,'')+'-'+(201+i);
    const items=x[3].map(([pid,q])=>({pid,qty:q,price:d.products.find(p=>p.id===pid).cost,recv:q}));
    d.po.push({id,no,sup:x[1],wh:x[2],items,status:x[0]>10?'done':'received',t:t-4*D,u:t,by:'U2'});
    const gid='gr'+(i+1);d.grn.push({id:gid,no:'GR'+fday(t).slice(2).replace(/-/g,'')+'-'+(301+i),po:id,wh:x[2],t,u:t,by:'U4',items:items.map(it=>{const p=d.products.find(q=>q.id===it.pid);return {pid:it.pid,qty:it.qty,batch:p.batch?'B'+fday(t).replace(/-/g,'').slice(2)+'C':'',exp:p.batch?exp(p.id==='P1'?75:300):''}})});
    d.grn[d.grn.length-1].items.forEach(it=>mv({t,pid:it.pid,wh:x[2],qty:it.qty,type:'po_in',ref:gid,batch:it.batch,exp:it.exp}))});
  /* 进行中的单据 */
  d.po.push({id:'po6',no:'PO'+fday(now-D).slice(2).replace(/-/g,'')+'-206',sup:'S3',wh:'W1',status:'ordered',t:now-D,u:now-D,by:'U2',note:{zh:'海运，预计 12 月初到特马港',en:'By sea, ETA Tema early December'},
    items:[{pid:'P13',qty:120,price:980,recv:0},{pid:'P12',qty:20,price:3150,recv:0},{pid:'P8',qty:1500,price:9,recv:0}]});
  d.po.push({id:'po7',no:'PO'+fday(now).slice(2).replace(/-/g,'')+'-207',sup:'S1',wh:'W1',status:'draft',t:now-3*36e5,u:now-3*36e5,by:'U2',items:[{pid:'P4',qty:400,price:18,recv:0},{pid:'P5',qty:100,price:45,recv:0}]});
  d.po.push({id:'po8',no:'PO'+fday(now-2*D).slice(2).replace(/-/g,'')+'-208',sup:'S2',wh:'W1',status:'ordered',t:now-2*D,u:now-2*D,by:'U2',items:[{pid:'P1',qty:800,price:78,recv:0}]});
  const so1={id:'so901',no:'SO'+fday(now).slice(2).replace(/-/g,'')+'-901',cus:'C3',wh:'W1',status:'submitted',t:now-2*36e5,u:now-2*36e5,by:'U3',items:[{pid:'P1',qty:300,price:92},{pid:'P2',qty:120,price:118}],addr:{zh:'塔科拉迪 华程路桥 2 号工地',en:'Takoradi, Huacheng site No.2'}};
  const so2={id:'so902',no:'SO'+fday(now).slice(2).replace(/-/g,'')+'-902',cus:'C1',wh:'W2',status:'submitted',t:now-50*60e3,u:now-50*60e3,by:'U3',items:[{pid:'P8',qty:100,price:15},{pid:'P7',qty:5,price:415}]};
  const so3={id:'so903',no:'SO'+fday(now).slice(2).replace(/-/g,'')+'-903',cus:'C4',wh:'W3',status:'draft',t:now-20*60e3,u:now-20*60e3,by:'U3',items:[{pid:'P6',qty:40,price:138}]};
  d.so.push(so1,so2,so3);
  /* 一笔已发货、正在物流中的订单 */
  const so4={id:'so904',no:'SO'+fday(now-D).slice(2).replace(/-/g,'')+'-904',cus:'C5',wh:'W1',status:'shipped',t:now-D-5*36e5,u:now-D,by:'U3',st:now-D,items:[{pid:'P11',qty:200,price:85,shipped:200},{pid:'P14',qty:10,price:330,shipped:10}]};
  d.so.push(so4);so4.items.forEach(it=>seedOut(it.pid,'W1',it.qty,now-D,so4.id));
  /* 销售退货 */
  const ret=d.so.find(s=>s.status==='done'&&s.items.some(i=>i.qty>=10));if(ret){const it=ret.items.find(i=>i.qty>=10);const q=Math.max(2,Math.floor(it.qty/5));
    d.sr.push({id:'sr1',no:'SR'+fday(now-2*D).slice(2).replace(/-/g,'')+'-401',so:ret.id,wh:ret.wh,t:now-2*D,u:now-2*D,by:'U3',items:[{pid:it.pid,qty:q}],reason:{zh:'包装破损',en:'Damaged packaging'}});
    it.ret=q;mv({t:now-2*D,pid:it.pid,wh:ret.wh,qty:q,type:'so_ret',ref:'sr1'})}
  /* 盘点（待审核） */
  const q2=pid=>d.moves.filter(m=>m.pid===pid&&m.wh==='W2').reduce((a,m)=>a+m.qty,0);
  d.counts.push({id:'tk1',no:'ST'+fday(now).slice(2).replace(/-/g,'')+'-501',wh:'W2',status:'pending',t:now-4*36e5,u:now-4*36e5,by:'U4',note:'',
    items:[['P6',-3],['P8',2],['P10',0],['P4',-1],['P7',0]].map(([pid,x])=>({pid,sys:q2(pid),real:Math.max(0,q2(pid)+x)}))});
  /* 物流 */
  d.ships=[
   {id:'sh1',no:'SH'+fday(now-12*D).slice(2).replace(/-/g,'')+'-601',dir:'in',ref:'po6',refKind:'po',carrier:'cosco',mode:'sea',trackNo:'CSNU6184520',container:'CSNU6184520 / 40HQ',from:{zh:'中国广州南沙港',en:'Nansha Port, Guangzhou'},to:{zh:'加纳特马港',en:'Tema Port, Ghana'},eta:fday(now+9*D),cost:28500,status:'transit',t:now-12*D,u:now-2*D,by:'U2',
    ev:[{t:now-12*D,st:'picked',place:{zh:'广州南沙港',en:'Nansha, Guangzhou'},note:{zh:'已装柜，提单号 COSU6380012',en:'Loaded, B/L COSU6380012'}},{t:now-9*D,st:'transit',place:{zh:'新加坡中转',en:'Singapore transshipment'},note:''},{t:now-2*D,st:'transit',place:{zh:'阿比让外海',en:'Off Abidjan'},note:{zh:'船期正常',en:'On schedule'}}]},
   {id:'sh2',no:'SH'+fday(now-D).slice(2).replace(/-/g,'')+'-602',dir:'out',ref:'so904',refKind:'so',carrier:'own',mode:'road',trackNo:'GT-4471-24',driver:{zh:'司机 约瑟夫 · 054 000 8812',en:'Driver Joseph · 054 000 8812'},from:{zh:'特马总仓',en:'Tema Main Warehouse'},to:{zh:'库马西建材城',en:'Kumasi Building Mart'},eta:fday(now),cost:1800,status:'delivering',t:now-D,u:now-3*36e5,by:'U4',
    ev:[{t:now-D,st:'picked',place:{zh:'特马总仓',en:'Tema Main Warehouse'},note:''},{t:now-D+4*36e5,st:'transit',place:{zh:'N6 公路 恩卡乌',en:'N6 Highway, Nkawkaw'},note:''},{t:now-3*36e5,st:'delivering',place:{zh:'库马西',en:'Kumasi'},note:{zh:'预计下午送达',en:'Arriving this afternoon'}}]},
   {id:'sh3',no:'SH'+fday(now-6*D).slice(2).replace(/-/g,'')+'-603',dir:'in',ref:'po3',refKind:'po',carrier:'air',mode:'air',trackNo:'176-12345675',from:{zh:'中国佛山',en:'Foshan, China'},to:{zh:'阿克拉科托卡机场',en:'Kotoka Airport, Accra'},eta:fday(now-2*D),cost:6200,status:'customs',t:now-6*D,u:now-D,by:'U2',
    ev:[{t:now-6*D,st:'picked',place:{zh:'广州白云机场',en:'Guangzhou Baiyun Airport'},note:''},{t:now-4*D,st:'transit',place:{zh:'迪拜中转',en:'Dubai transit'},note:''},{t:now-D,st:'exception',place:{zh:'科托卡机场海关',en:'Kotoka Airport customs'},note:{zh:'缺少原产地证，等待补件',en:'Certificate of origin missing, awaiting documents'}}]},
   {id:'sh4',no:'SH'+fday(now-9*D).slice(2).replace(/-/g,'')+'-604',dir:'out',ref:'',carrier:'dhl',mode:'express',trackNo:'1234567890',from:{zh:'阿克拉门店仓',en:'Accra Shop Store'},to:{zh:'塔科拉迪',en:'Takoradi'},eta:fday(now-7*D),cost:240,status:'delivered',t:now-9*D,u:now-7*D,by:'U3',
    ev:[{t:now-9*D,st:'picked',place:{zh:'阿克拉',en:'Accra'},note:''},{t:now-8*D,st:'delivering',place:{zh:'塔科拉迪',en:'Takoradi'},note:''},{t:now-7*D,st:'delivered',place:{zh:'塔科拉迪',en:'Takoradi'},note:{zh:'客户已签收',en:'Signed by customer'}}]}];
  d.ships[2].status='exception';
  d.svc=[{id:'bk1',no:'BK'+fday(now-D).slice(2).replace(/-/g,'')+'-701',type:'pickup',mode:'road',from:{zh:'特马总仓',en:'Tema Main Warehouse'},to:{zh:'塔科拉迪',en:'Takoradi'},date:fday(now+D),weight:12000,vol:18,note:{zh:'需要 20 吨平板车',en:'Need a 20-ton flatbed'},status:'new',t:now-D,u:now-D,by:'U3'}];
  [ 'moves','so','po','grn','sr','counts','ships','svc'].forEach(k=>d[k].forEach(x=>{if(!x.u)x.u=x.t||now}));
  KINDS.forEach(k=>d[k].forEach(x=>{if(!x.u)x.u=now}));
  KINDS.forEach(k=>DB.d[k]=d[k]);DB.outbox=[];DB.ver++;DB.save();LS.set('seeded',1);
}

/* ---------- 版本更新（与 ChinaPaw 相同：读取 version.json，网页版一键刷新，安装包版在 App 内下载安装） ---------- */
const UPD={remote:null,busy:false};
const APK_URLS=()=>{const v=UPD.remote||{};return [v.apkMirror,v.apk,v.apkExt].filter(Boolean)};
const hasUpd=()=>UPD.remote&&(+UPD.remote.build||0)>APP_BUILD;
function updNotes(v){const n=(v.notes&&(v.notes[S.lang]||v.notes.en))||[];return n.length?`<div class="sm muted" style="margin-top:14px;font-weight:700">${L('更新内容','What\'s new')}</div><ul style="margin:6px 0 0 18px;font-size:14px;line-height:1.7">${n.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
async function nativeBuild(){try{const r=await window.Capacitor.Plugins.App.getInfo();return +r.build||0}catch(e){return 0}}
async function checkUpdate(manual){if(UPD.busy)return;UPD.busy=true;
  try{const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;const v=await r.json();UPD.remote=v;
    const nb=isNative()?await nativeBuild():0;
    if(isNative()&&v.minNative&&nb&&nb<v.minNative){showUpd(v,'apk');return}
    if((+v.build||0)>APP_BUILD){if(!manual&&!v.force){const d=LS.get('updLater',null);if(d&&d.b===v.build&&Date.now()-d.t<2*3600e3)return}showUpd(v,'web');return}
    if(manual)toast(L('已是最新版本','You have the latest version')+' · v'+APP_VER)}
  catch(e){if(manual)toast(L('检查更新失败，请检查网络','Update check failed, check your network'))}
  finally{UPD.busy=false;window.syncUI&&syncUI()}}
function showUpd(v,kind){const force=!!v.force||kind==='apk'&&v.forceNative;
  openSheet(`<div class="row gap"><img src="logo.svg" class="logo" style="width:52px;height:52px;border-radius:16px"><div><div class="sh">${L('发现新版本','New version available')}</div>
   <div class="sm muted">v${APP_VER} → <b style="color:var(--ink)">v${esc(v.version)}</b>${v.date?' · '+esc(v.date):''}</div></div></div>${updNotes(v)}
   ${kind==='apk'?`<div class="note-y" style="margin-top:14px">${L('这次更新需要安装新的安装包，下载后点“安装”即可，数据不会丢失。','This update needs a new app package. Download and tap Install — your data stays.')}</div>`:''}
   ${force?`<div class="xs red" style="margin-top:10px">${L('此版本为必要更新','This update is required')}</div>`:''}
   <div class="row gap" style="margin-top:18px">${force?'':`<button class="bigbtn ghost" onclick="updLater(${+v.build||0})">${L('稍后','Later')}</button>`}
   <button class="bigbtn" onclick="${kind==='apk'?'doApk()':'doUpdate()'}">${kind==='apk'?L('下载安装','Download'):L('立即更新','Update now')}</button></div>`,force)}
function updLater(b){LS.set('updLater',{b,t:Date.now()});closeSheet()}
async function doUpdate(){LS.set('updFrom',APP_VER);
  try{if('serviceWorker' in navigator){const rg=await navigator.serviceWorker.getRegistration();if(rg){await rg.update();if(rg.waiting)rg.waiting.postMessage('skip')}}
    if(window.caches){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}}catch(e){}
  location.replace(location.pathname+'?v='+(UPD.remote?UPD.remote.build:Date.now()))}
/* 安卓 App：用内置下载器下载新安装包（显示进度），然后调起系统安装 */
const UPX={st:'idle',pct:0,done:0,total:0};let _updL=null;
const mb=b=>(b/1048576).toFixed(1)+' MB';
function hasUpdater(){try{return !!(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.AppUpdater)}catch(e){return false}}
function updSheet(){const s=UPX.st;const bar=`<div style="height:12px;border-radius:8px;background:#E7E1D4;overflow:hidden;margin-top:16px"><div id="updBar" style="height:100%;width:${Math.max(3,UPX.pct)}%;background:var(--green);transition:width .25s"></div></div>
   <div class="row between sm" style="margin-top:8px"><span id="updPct" class="b">${UPX.pct>=0?UPX.pct+'%':''}</span><span id="updSz" class="muted">${UPX.total?mb(UPX.done)+' / '+mb(UPX.total):''}</span></div>`;
  const head=`<div class="row gap"><img src="logo.svg" class="logo" style="width:52px;height:52px;border-radius:16px"><div><div class="sh">${L('华宝进销存','ChinaPaw Stock')} v${esc((UPD.remote||{}).version||'')}</div><div class="sm muted">${s==='dl'?L('正在下载…','Downloading…'):s==='ready'?L('下载完成','Downloaded'):s==='perm'?L('需要允许安装','Allow installs'):L('下载失败','Download failed')}</div></div></div>`;
  let body='';
  if(s==='dl')body=bar+`<button class="bigbtn ghost" style="width:100%;margin-top:16px" onclick="updCancel()">${L('取消','Cancel')}</button>`;
  else if(s==='ready')body=bar+`<button class="bigbtn" style="width:100%;margin-top:16px" onclick="updInstall()">${L('安装','Install')}</button>`;
  else if(s==='perm')body=`<div class="note-y" style="margin-top:14px">${L('请在设置中允许“安装未知应用”，返回后会自动继续安装。','Please allow “Install unknown apps” in settings; installation continues when you return.')}</div><button class="bigbtn" style="width:100%;margin-top:16px" onclick="updPermit()">${L('去设置','Open settings')}</button>`;
  else body=`<div class="note-r" style="margin-top:14px">${esc(UPX.err||'')}</div><div class="row gap" style="margin-top:16px"><button class="bigbtn ghost" onclick="updBrowser()">${L('用浏览器下载','Use browser')}</button><button class="bigbtn" onclick="doApk()">${L('重试','Retry')}</button></div>`;
  openSheet(head+body,s==='dl')}
function updProg(){const b=$('#updBar');if(!b)return;b.style.width=Math.max(3,UPX.pct)+'%';$('#updPct').textContent=UPX.pct>=0?UPX.pct+'%':'';$('#updSz').textContent=UPX.total?mb(UPX.done)+' / '+mb(UPX.total):''}
async function doApk(){
  if(!isNative())return window.open(APK_URLS()[0]||'app/ChinaPawStock.apk','_blank');
  if(!hasUpdater())return updBrowser();
  const P=window.Capacitor.Plugins.AppUpdater;if(!_updL)_updL=await P.addListener('progress',p=>{UPX.pct=p.pct;UPX.done=p.done;UPX.total=p.total;updProg()});
  UPX.st='dl';UPX.pct=0;UPX.done=0;UPX.total=0;UPX.err='';updSheet();let ok=false;
  for(const u of APK_URLS()){try{await P.download({url:u});ok=true;break}catch(e){UPX.err=String(e&&e.message||e);if(/cancelled/.test(UPX.err))return}}
  if(!ok){UPX.st='fail';updSheet();return}UPX.st='ready';UPX.pct=100;updSheet();updInstall()}
async function updInstall(){const P=window.Capacitor.Plugins.AppUpdater;try{const r=await P.install();if(r&&r.needPermission){UPX.st='perm';UPX.wait=true;updSheet()}}catch(e){UPX.st='fail';UPX.err=String(e.message||e);updSheet()}}
function updPermit(){UPX.wait=true;window.Capacitor.Plugins.AppUpdater.openInstallSettings()}
function updCancel(){UPX.st='idle';try{window.Capacitor.Plugins.AppUpdater.cancel()}catch(e){}closeSheet(true)}
function updBrowser(){const v=UPD.remote||{};location.href=v.apkMirror||v.apk||'app/ChinaPawStock.apk'}
try{window.Capacitor&&window.Capacitor.Plugins.App&&window.Capacitor.Plugins.App.addListener('resume',async()=>{if(!UPX.wait||!hasUpdater())return;
  const r=await window.Capacitor.Plugins.AppUpdater.canInstall();if(r.allowed){UPX.wait=false;UPX.st='ready';updSheet();updInstall()}})}catch(e){}

/* ---------- 弹层 / 提示 ---------- */
let SHEET_FORCE=false;
function openSheet(h,force){SHEET_FORCE=!!force;const s=$('#sheet');s.innerHTML='<div class="grab"></div>'+h;s.scrollTop=0;s.classList.add('on');$('#mask').classList.add('on')}
function closeSheet(really){if(SHEET_FORCE&&really!==true)return;SHEET_FORCE=false;$('#sheet').classList.remove('on');$('#mask').classList.remove('on');if(window._scanStop)_scanStop()}
const sheetOn=()=>$('#sheet').classList.contains('on');
function toast(m,bad){const t=$('#toast');if(!t)return;if(bad==null)bad=/失败|不足|未找到|不在|请|超过|错误|无法|failed|not |enter |choose |add at|exceed|wrong|cannot/i.test(m);t.innerHTML=ic(bad?'alert':'check',16)+'<span>'+esc(m)+'</span>';t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2200)}
function copyText(s){const ok=()=>toast(L('已复制：','Copied: ')+s);try{navigator.clipboard.writeText(s).then(ok,()=>fb())}catch(e){fb()}
  function fb(){const a=document.createElement('textarea');a.value=s;document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch(e){}a.remove();ok()}}
function openExt(u){if(!u)return;try{window.open(u,'_blank')}catch(e){location.href=u}}
