/* ================= 华宝进销存 · ChinaPaw Stock — 核心（用户端与管理后台共用） =================
   结构与 ChinaPaw 一致：单文件网页应用 + version.json 热更新 + 可选 Supabase 云端（只通过 RPC 读写）。
   未配置云端时以“本机演示模式”运行（数据存于本机 localStorage），配置后自动切换为多人实时同步。 */
const APP_VER='1.14.1',APP_BUILD=24;
const CFG=window.JXC_CONFIG||{};
let SK=window.JXC_SESS||'sess';/* 用户端与管理后台各自保存登录状态 */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const LS={get(k,d){try{const v=localStorage.getItem('jxc_'+k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem('jxc_'+k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem('jxc_'+k)}catch(e){}}};
const S={lang:'zh',country:'GH',curMode:'local',view:'login',params:{},hist:[],me:null,online:navigator.onLine,syncing:false};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>(p||'')+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const isNative=()=>!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());

/*I18N*/

/* ---------- 图标 ---------- */
const ICONS={
 mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
 keyboard:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
 play:'<path d="M7 5v14l12-7z"/>',
 pause:'<path d="M8 5v14M16 5v14"/>',
 chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
 send:'<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
 smile:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
 print:'<path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>',
 receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
 reply:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/>',
 translate:'<path d="M4 5h9M8.5 3v2M6 5c.5 3 2.5 6 6 7.5M11 5c-.8 3.5-3.3 6.5-7 8"/><path d="m13 21 4-10 4 10M14.5 17.5h5"/>',
 at:'<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
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
const pad2=n=>String(n).padStart(2,'0');
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fdate(t,withTime=true){if(!t)return '';const d=new Date(t);const tm=withTime?' '+pad2(d.getHours())+':'+pad2(d.getMinutes()):'';
  return S.lang==='zh'?`${d.getMonth()+1}月${d.getDate()}日${tm}`:`${MON[d.getMonth()]} ${d.getDate()}${tm}`}
function fday(t){if(!t)return '';const d=new Date(t);return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
function ago(t){const s=(Date.now()-t)/1000;if(s<60)return L('刚刚','just now');if(s<3600)return Math.floor(s/60)+L(' 分钟前',' min ago');
  if(s<86400)return Math.floor(s/3600)+L(' 小时前',' h ago');if(s<172800)return L('昨天','yesterday');return fdate(t,false)}
const dayStart=(t=Date.now())=>{const d=new Date(t);d.setHours(0,0,0,0);return +d};

/* ---------- 职能部门与权限：各司其职、互不越界 ----------
   每个部门有固定的“部门代码”（也是初始密码）；新增同部门账号用“代码-序号”，如 444444-1 = 第 2 个仓库主管账号。 */
const ROLES={
 chair:{zh:'董事长',en:'Chairman',code:'111111',c:'b-dark',p:'*'},
 gm:{zh:'总经理',en:'General Manager',code:'111112',c:'b-dark',p:'*'},
 clerk:{zh:'内勤',en:'Office Clerk',code:'999999',c:'b-blue',p:['stock','docs_view','po_prepare','grn_check','att']},
 buyer:{zh:'采购主管',en:'Purchasing Manager',code:'222222',c:'b-blue',p:['stock','po','pr','logi','report','cost','sup']},
 sales:{zh:'销售经理',en:'Sales Manager',code:'333333',c:'b-gold',p:['stock','so','sr','logi','report','cus']},
 keeper:{zh:'仓库主管',en:'Warehouse Manager',code:'444444',c:'b-green',p:['stock','po_recv','so_ship','take','pr_exec','sr_exec','logi','report']},
 acct:{zh:'会计',en:'Accountant',code:'555555',c:'b-purple',p:['stock','cost','report','profit','fin','fin_verify','fin_approve']},
 cashier:{zh:'出纳',en:'Cashier',code:'666666',c:'b-orange',p:['fin','fin_receive','fin_pay']},
 field:{zh:'外勤人员',en:'Field Sales',code:'777777',c:'b-gold',p:['stock','so','cus','att','logi']},
 ops:{zh:'运营经理',en:'Operations Manager',code:'888888',c:'b-dark',p:['stock','report','cost','profit','fin','logi','att_view','exp_approve','tk_final','docs_view']}
};
/* 新增权限说明：
   att 外勤打卡 · att_view 查看考勤（总经理 / 销售经理 / 运营经理）
   so_fin 销售单财务审核（确认收款 / 赊账初审）· tk_fin 盘点财务复核 · tk_final 盘点终审（运营经理 / 总经理）
   exp_approve 特殊费用审批（总经理 / 运营经理）· exp_book 费用入账（会计）· 付费用由出纳（fin_pay） */
ROLES.sales.p.push('att_view');['buyer','sales','keeper','acct','cashier'].forEach(r=>{if(!ROLES[r].p.includes('att'))ROLES[r].p.push('att')});ROLES.acct.p.push('so_fin','tk_fin','exp_book');
ROLES.ops.p.push('fin_approve_ops');ROLES.buyer.p.push('po_prepare','docs_view');ROLES.keeper.p.push('po_prepare');ROLES.acct.p.push('grn_fin','docs_view');ROLES.cashier.p.push('docs_view');
ROLES.ops.p.push('att');
const ROLE_ORDER=['chair','gm','ops','buyer','sales','field','keeper','acct','cashier','clerk'];
function can(p,u){u=u||S.me;if(p==='att')return !!u&&!!ROLES[u.role]&&u.role!=='chair';if(p==='mgmt')return !!u&&(['chair','gm'].includes(u.role)||u.admin===true);if(p==='_exps')return can('exp_approve',u)||own('exp_book',u)||own('fin_pay',u);if(p==='_pt')return can('mgmt',u)||can('po',u)||can('so',u);if(p==='_recv')return can('po_prepare',u)||can('po_recv',u);if(p==='_docs')return can('po',u)||can('so',u)||can('po_recv',u)||can('so_ship',u)||can('take',u)||can('docs_view',u)||can('so_fin',u);if(!u)return false;const r=ROLES[u.role];if(!r)return false;return r.p==='*'||r.p.includes(p)}
/* 职位本身的权限（不含总经理的“全部权限”）：财务复核、出纳付款等环节只属于对应职位，互相制约 */
const own=(p,u)=>{u=u||S.me;if(p==='att')return !!u&&!!ROLES[u.role]&&u.role!=='chair';const r=u&&ROLES[u.role];return !!r&&(u.role==='chair'||r.p!=='*'&&r.p.includes(p))};
const roleName=r=>nm(ROLES[r]||{zh:r,en:r});
/* 由账号代码识别部门：111111 / 111111-3 → 总经理 …… */
/* 部门：每个部门有基本职位，也可以新增职位（新职位的权限参照本部门的一个基本职位） */
const DEPTS=[{id:'gmo',zh:'总经办',en:"GM's office",roles:['chair','gm','ops']},{id:'pur',zh:'采购部',en:'Purchasing',roles:['buyer','clerk']},{id:'sal',zh:'销售部',en:'Sales',roles:['sales','field']},{id:'whs',zh:'仓储部',en:'Warehouse',roles:['keeper']},{id:'fin',zh:'财务部',en:'Finance',roles:['acct','cashier']}];
const deptOf=r=>DEPTS.find(d=>d.roles.includes(r))||DEPTS[0];
const deptName=d=>nm(typeof d==='string'?DEPTS.find(x=>x.id===d)||{zh:d,en:d}:d);
/* 职位列表：登录后以公司设置为准（同时存一份到手机，供登录页使用）；登录页在云端模式下用刚从云端取到的列表 */
function positions(){const s=(typeof DB!=='undefined'&&DB.get('settings','app'))||null;if(S.me&&s&&Array.isArray(s.positions)){if(JSON.stringify(s.positions)!==JSON.stringify(LS.get('pos',[])))LS.set('pos',s.positions);return s.positions}
  if(!S.me&&DB.cloud)return LS.get('pos',[]);return s&&Array.isArray(s.positions)?s.positions:LS.get('pos',[])}
const posById=id=>positions().find(p=>p.id===id&&!p.del);
const userTitle=u=>{const p=u&&u.pos&&posById(u.pos);return p&&p.role===u.role?nm(p.n):roleName(u&&u.role)};
/* 自动生成账号代码：部门代码，已被使用就用“部门代码-序号” */
function nextCode(role,except){const b=ROLES[role].code;const used=new Set(DB.all('users').filter(u=>u.id!==except).map(u=>String(u.code)));if(!used.has(b))return b;let n=1;while(used.has(b+'-'+n))n++;return b+'-'+n}
function roleOfCode(code){const m=/^(\d{6})(?:-(\d{1,3}))?$/.exec(String(code||'').trim());if(!m)return null;return ROLE_ORDER.find(k=>ROLES[k].code===m[1])||null}
/* 门店：免费版 1 个，VIP 可关联 3 个或更多（平台后台调整） */
/* 门店名额：初始 1 个；每个“门店开通码”（付款后由平台提供）增加 1 个；名额大于 1 即为 VIP */
const plan=()=>{const p=Object.assign({limit:1},((typeof DB!=='undefined'&&DB.get('settings','app'))||{}).plan||{});p.limit=Math.max(1,+p.limit||1);p.vip=p.limit>1;return p};
const allWh=()=>DB.all('wh');
const activeWh=()=>allWh().slice(0,plan().limit);
const whActive=id=>activeWh().some(w=>w.id===id);

/* ================= 数据层：本机数据库 + 待提交队列（离线可用） + 云端同步 ================= */
const KINDS=['settings','wh','products','partners','moves','po','grn','pr','so','sr','counts','ships','svc','fin','users','chat','msg','att','exp','read','leave','stockreq','transfer','receipt','account','reconcile','period','quote','serial','adjust','opening_balance','vehicle','profile','writeoff','qc','invoice','allocation','refund','lcadj','fxrate','credit_note'];
const DB={
  d:{},outbox:[],seq:0,lastSync:0,ver:0,cloud:!!(CFG.supabaseUrl&&CFG.supabaseAnonKey),
  p(){return this.cloud?'c_':''},
  load(){const P=this.p(),s=LS.get(P+'db',null);KINDS.forEach(k=>this.d[k]=(s&&s[k])||[]);this.outbox=LS.get(P+'outbox',[]);this.seq=LS.get(P+'seq',0);this.lastSync=LS.get(P+'lastSync',0);this.ver++},
  /* 本机保存合并成一次（空闲时写入），连续操作不卡；关闭页面前一定写完 */
  save(now){clearTimeout(this._st);if(now)return this._save();this._st=setTimeout(()=>{(window.requestIdleCallback||setTimeout)(()=>this._save())},300)},
  _save(){clearTimeout(this._st);const o={};KINDS.forEach(k=>o[k]=this.d[k]);if(o.msg&&o.msg.length>1500)o.msg=[...o.msg].sort((a,b)=>a.t-b.t).slice(-1500);/* 手机上只保留最近 1500 条消息，不占空间 */const P=this.p();LS.set(P+'db',o);LS.set(P+'outbox',this.outbox);LS.set(P+'seq',this.seq);LS.set(P+'lastSync',this.lastSync)},
  all(k){return (this.d[k]||[]).filter(x=>!x.del)},
  get(k,id){return (this.d[k]||[]).find(x=>x.id===id)},
  /* 写入一条记录：本机立即生效，进入待提交队列；联网后自动提交到云端 */
  put(k,doc,opt={}){doc={...doc};delete doc.paidVerified;if(!doc.id)doc.id=uid(k.slice(0,2));doc.u=Math.max(Date.now(),(+doc.u||0)+1,(+this.get(k,doc.id)?.u||0)+1);doc.by=doc.by||(S.me&&S.me.id)||'';
    const a=this.d[k]||(this.d[k]=[]);const i=a.findIndex(x=>x.id===doc.id);if(i>=0)a[i]=doc;else a.push(doc);
    if(!opt.local){this.outbox.push({k,id:doc.id,d:doc});doc._q=1}
    this.ver++;this.save();if(!opt.quiet){bc('chg',[{k,d:doc}]);setTimeout(()=>Sync.run(),50)}return doc},
  merge(rows){let n=0;rows.forEach(r=>{const a=this.d[r.k]||(this.d[r.k]=[]);const i=a.findIndex(x=>x.id===r.d.id);
      if(i>=0){if(a[i]._q&&this.outbox.some(o=>o.k===r.k&&o.id===r.d.id))return;if((a[i].u||0)>(r.d.u||0)&&!r.force)return;a[i]=r.d}else a.push(r.d);n++});
    if(n){this.ver++;this.save()}return n}
};
/* 同一台设备多个窗口之间实时同步（演示多人协作，也让手机桌面版与浏览器版保持一致） */
addEventListener('pagehide',()=>DB._save());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')DB._save()});
let BC=null;try{BC=new BroadcastChannel('jxc')}catch(e){}
function bc(type,rows){try{BC&&BC.postMessage({type,rows})}catch(e){}}
if(BC)BC.onmessage=e=>{const m=e.data||{};if(m.type==='chg'){const rows=(m.rows||[]).map(r=>({k:r.k,d:{...r.d,_q:0},force:true}));DB.merge(rows);onRemote(rows)}
  else if(m.type==='reset'){DB.load();if(window.render)render(false)}};
function onRemote(rows){try{typeof Alerts!=='undefined'&&Alerts.scan(rows)}catch(e){console.error(e)}if(window.softRender)softRender();if(window.updateUnreadBadge)updateUnreadBadge()}

/* 云端（Supabase）：所有读写都走 RPC 函数，便于权限控制（与 ChinaPaw 相同的安全原则） */
/* 云端是否已启用：数据库脚本未运行时（函数不存在）自动用本机模式，运行后自动切换到云端 */
async function cloudProbe(){if(!DB.cloud)return;const k='cloudOK';let ok=LS.get(k,null);
  try{const r=await Promise.race([fetch(CFG.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/jxc_pull',{method:'POST',headers:{apikey:CFG.supabaseAnonKey,Authorization:'Bearer '+CFG.supabaseAnonKey,'Content-Type':'application/json'},body:'{"p_token":"probe","p_since":0}'}),new Promise((_,j)=>setTimeout(()=>j(0),6000))]);
    ok=!(r.status===404||(await r.text()).includes('PGRST202'));LS.set(k,ok)}catch(e){}
  if(ok===false)DB.cloud=false;else SK='c_'+SK}
async function rpc(fn,args){const r=await fetch(CFG.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/'+fn,{method:'POST',
   headers:{apikey:CFG.supabaseAnonKey,Authorization:'Bearer '+CFG.supabaseAnonKey,'Content-Type':'application/json'},body:JSON.stringify(args||{})});
  const tx=await r.text();if(!r.ok){let m=tx;try{m=JSON.parse(tx).message||tx}catch(e){}throw new Error(m)}return tx?JSON.parse(tx):null}
function acceptCloudUsers(users){if(window.purgeRestrictedCache)purgeRestrictedCache();const changed=JSON.stringify(DB.d.users)!==JSON.stringify(users);DB.d.users=users;if(changed)DB.ver++;if(S.me){const me=users.find(u=>u.id===S.me.id);if(me){S.me={...me};const sess=LS.get(SK,null);if(sess){sess.me=S.me;LS.set(SK,sess)}}}}
const Sync={timer:null,
  async run(force){
    if(S.syncing){S.syncAgain=true;return}if(!navigator.onLine){S.online=false;window.syncUI&&syncUI();return}
    S.syncing=true;window.syncUI&&syncUI();const v0=DB.ver;
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
          if(p.users&&p.users.length)acceptCloudUsers(p.users);if(fresh.length){if(force==='boot'){try{Alerts.scan(fresh,false)}catch(e){console.error(e)}}else onRemote(fresh.filter(r=>r.d.by!==S.me.id))}}
      }else{
        /* 本机演示模式：联网时把暂存的单据“提交”（清空队列） */
        if(DB.outbox.length){const ks=new Set(DB.outbox.map(o=>o.k+o.id));DB.outbox=[];(KINDS).forEach(k=>DB.d[k].forEach(x=>{if(ks.has(k+x.id))delete x._q}))}
      }
      DB.lastSync=Date.now();DB.save();S.online=true;S.syncErr='';
    }catch(e){console.error(e);S.syncErr=String(e.message||e);
      if(DB.cloud&&S.token&&/Approval changed or permission denied/.test(S.syncErr)){
        try{const match=S.syncErr.match(/(\[[^\]]*\])\s*$/),bad=new Set(match?JSON.parse(match[1]):[]);let changed=true;
          while(changed){changed=false;DB.outbox.forEach(o=>{const links=[o.id,o.d.ref,o.d.po,o.d.so,o.d.grn].filter(Boolean);if(links.some(id=>bad.has(id)))links.forEach(id=>{if(!bad.has(id)){bad.add(id);changed=true}})})}
          DB.outbox=DB.outbox.filter(o=>!bad.has(o.id));KINDS.forEach(k=>DB.d[k]=DB.d[k].filter(d=>!bad.has(d.id)));DB.seq=0;DB.ver++;
          const p=await rpc('jxc_pull',{p_token:S.token,p_since:0});if(p){const mine=new Set(DB.outbox.map(o=>o.k+o.id));DB.merge((p.rows||[]).filter(r=>!mine.has(r.k+r.d.id)).map(r=>({...r,force:true})));DB.seq=p.seq||0;if(p.users)acceptCloudUsers(p.users)}
          toast(/Photo and customer signature required/.test(S.syncErr)?L('尚未客户签收，已恢复为服务器真实状态；请先拍照签字','Customer receipt missing; server state restored. Take a photo and obtain the signature first'):L('校验未通过，操作未保存；已恢复云端记录，请重新核对','Validation failed; changes were not saved. Server records restored; review again'));DB.save();
        }catch(recovery){console.error(recovery)}
      }else if(force===true)toast(L('同步失败：','Sync failed: ')+S.syncErr)}
    finally{S.syncing=false;window.syncUI&&syncUI();if(force===true&&!S.syncErr)toast(L('已同步','Synced'));
      /* 只有数据真的变了才刷新画面（原来每次后台同步都整页重画，造成闪动） */
      if(DB.ver!==v0&&window.softRender)softRender();if(S.syncAgain){S.syncAgain=false;setTimeout(()=>this.run(),30)}}},
  /* 实时自动同步：每 3 秒只问一次云端“有没有新数据”（极小的请求），有变化才下载；自己的修改保存后立即上传 */
  async head(){if(!DB.cloud||!S.token||S.syncing||!navigator.onLine)return;if(DB.outbox.length)return this.run();
    try{const h=await rpc('jxc_head',{p_token:S.token});if(h===-1){S.syncErr='session';return}if(+h>DB.seq)this.run()}catch(e){}},
  start(){clearInterval(this.timer);let n=0;const tick=()=>{n++;if(document.visibilityState!=='visible')return;if(S.view!=='chat_room'&&n%2)return;/* 聊天窗口里 1.5 秒查一次，其他页面 3 秒 */if(DB.cloud)this.head();else if(DB.outbox.length)this.run()};
    this.timer=setInterval(tick,1500);
    addEventListener('online',()=>{S.online=true;toast(L('网络已恢复，正在自动提交','Back online, submitting…'));this.run();window.syncUI&&syncUI();window.render&&render(false)});
    addEventListener('offline',()=>{S.online=false;window.syncUI&&syncUI();window.render&&render(false)});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')this.run()})}
};

/* ---------- 库存引擎：库存 = 全部出入库流水之和（离线、多人同时操作都不会算错） ---------- */
let _sm=null,_smv=-1;
function stockMap(){if(_smv===DB.ver&&_sm)return _sm;const m={};
  DB.all('moves').filter(v=>v.quality!=='hold').forEach(v=>{const p=m[v.pid]||(m[v.pid]={q:0,w:{}});p.q+=v.qty;const w=p.w[v.wh]||(p.w[v.wh]={q:0,b:{}});w.q+=v.qty;
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
function addMove(o){return DB.put('moves',{t:Date.now(),...o,uc:o.uc!=null?o.uc:typeof avgCost==='function'?avgCost(o.pid):0})}
const MV={init:['期初','Opening','b-grey'],po_in:['采购入库','Purchase in','b-green'],po_ret:['采购退货','Purchase return','b-orange'],
  so_out:['销售出库','Sales out','b-blue'],so_ret:['销售退货','Sales return','b-purple'],adj:['盘点调整','Count adjust','b-gold']};
const mvName=t=>L((MV[t]||[t,t])[0],(MV[t]||[t,t])[1]);

/* ---------- 单据状态 ---------- */
const PO_ST={draft:['草稿','Draft','b-grey'],ordered:['已下单','Ordered','b-blue'],received:['已入库','Received','b-green'],done:['已完成','Completed','b-dark'],cancel:['已取消','Cancelled','b-grey']};
const GR_ST={submitted:['待财务审批','Finance review','b-gold'],fin_ok:['待内勤确认','Clerk review','b-gold'],ready:['待库管入库','Warehouse receipt','b-blue'],done:['已入库','Received','b-green'],rejected:['已驳回','Rejected','b-red']};
const SO_ST={draft:['草稿','Draft','b-grey'],submitted:['待财务审核','Finance review','b-gold'],credit_gm:['赊账待总经理审批','Credit: GM review','b-gold'],approved:['待出库','To ship','b-blue'],rejected:['已驳回','Rejected','b-red'],shipped:['已出库','Shipped','b-blue'],done:['已完成','Completed','b-dark'],cancel:['已取消','Cancelled','b-grey']};
const TK_ST={pending:['待财务复核','Finance review','b-gold'],fin_ok:['待运营 / 总经理终审','Final review','b-gold'],approved:['已审核','Approved','b-green'],rejected:['已驳回','Rejected','b-red']};
const SH_ST={pending:['待揽收','Awaiting pickup','b-grey'],picked:['已揽收','Picked up','b-blue'],transit:['运输中','In transit','b-blue'],customs:['清关中','Customs','b-purple'],
  delivering:['派送中','Out for delivery','b-gold'],delivered:['已签收','Delivered','b-green'],exception:['异常','Exception','b-red']};
const SH_FLOW=['pending','picked','transit','customs','delivering','delivered'];
const stB=(M,s)=>{const x=M[s]||[s,s,'b-grey'];return `<span class="badge ${x[2]}">${L(x[0],x[1])}</span>`};
function genNo(pre){const d=new Date();return pre+String(d.getFullYear()).slice(2)+pad2(d.getMonth()+1)+pad2(d.getDate())+'-'+Math.random().toString(36).slice(2,5).toUpperCase()}
const lineTotal=it=>(+it.qty||0)*(+it.price||0);
/* 单据合计 = 商品金额 + 对方承担的运费（销售单）+ 附加费用（采购单：运费、清关费、其他） */
const docTotal=d=>(d.items||[]).reduce((a,i)=>a+lineTotal(i),0)+(d.frt&&d.frt.payer==='cus'?(+d.frt.amt||0):0)+(d.fees||[]).reduce((a,f)=>a+(+f.amt||0),0);
const itemsTotal=d=>(d.items||[]).reduce((a,i)=>a+lineTotal(i),0);

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
/* 运费：每种运输方式 = 单价 + 计费单位（公斤 / 立方米 / 吨）+ 时效。按实际重量和体积换算的“计费量” × 单价 = 运费 */
const FR_UNIT={kg:['公斤','kg','kg'],cbm:['立方米','m³','m³'],t:['吨','ton','t']};
const FR_FAC={sea:1000,air:167,road:333,express:200};   /* 1 立方米折算多少公斤（体积重） */
const FR_DEF={sea:[1800,28,45,'cbm','CNY'],air:[100,5,9,'kg','base'],road:[1,1,3,'kg','base'],express:[160,3,6,'kg','base']};
function frRate(m){const r=(((typeof DB!=='undefined'&&DB.get('settings','app'))||{}).rates||{})[m]||FR_DEF[m];const cu=r[4]==='CNY'?'CNY':baseIso();return {p:+r[0]||0,d1:+r[1]||0,d2:+r[2]||0,unit:FR_UNIT[r[3]]?r[3]:'kg',cur:cu}}
/* 人民币 → 本币汇率：自动取实时汇率（6 小时更新一次），也可手动填写（手动优先） */
function fxCNY(){const b=baseIso();if(b==='CNY')return 1;const m=+LS.get('fxCNYman',0);if(m>0)return m;const x=LS.get('fxCNY',null);return x&&x.b===b?x.r:0}
function fxInfo(){if(+LS.get('fxCNYman',0)>0)return L('手动汇率','manual rate');const x=LS.get('fxCNY',null);return x&&x.b===baseIso()?L('实时汇率 ','live rate ')+new Date(x.t).toLocaleString(S.lang==='zh'?'zh-CN':'en-GB',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):L('正在获取实时汇率…','getting live rate…')}
async function loadFxCNY(force){const b=baseIso();if(b==='CNY')return;const x=LS.get('fxCNY',null);if(!force&&x&&x.b===b&&Date.now()-x.t<6*36e5)return;
  try{const j=await (await fetch('https://open.er-api.com/v6/latest/CNY')).json();const r=j&&j.rates&&j.rates[b];if(r){LS.set('fxCNY',{b,r,t:Date.now()});if(window.softRender)softRender(true)}}catch(e){}}
const toBase=(v,cur)=>cur==='CNY'&&baseIso()!=='CNY'?(+v||0)*fxCNY():(+v||0);
function frCost(m,kg,cbm,rate){const r=rate||frRate(m);kg=+kg||0;cbm=+cbm||0;const f=FR_FAC[m]||1000;
  const q=r.unit==='cbm'?Math.max(cbm,kg/1000):r.unit==='t'?Math.max(kg,cbm*f)/1000:Math.max(kg,cbm*f);
  return {q:Math.round(q*1000)/1000,unit:r.unit,p:r.p,cur:r.cur,cost:Math.round(q*r.p*100)/100,costB:Math.round(toBase(q*r.p,r.cur)*100)/100,byVol:r.unit==='cbm'?cbm>=kg/1000:cbm*f>kg}}
const frUnitName=u=>L(FR_UNIT[u][0],FR_UNIT[u][1]);
const carrier=id=>CARRIERS.find(c=>c.id===id)||CARRIERS[CARRIERS.length-1];
const trackUrl=s=>{const c=carrier(s.carrier);return c.url&&s.trackNo?c.url.replace('{no}',encodeURIComponent(s.trackNo)):''};

/* ---------- 上传：图片压缩 + 上传到云端存储（去重、失败自动重试；与 ChinaPaw upImg 相同） ---------- */
function resizeImg(f,max){return new Promise(res=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height));
  const c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.8))};im.src=r.result};r.readAsDataURL(f)})}
/* 选图：主图 + 列表缩略图（列表只下载缩略图，省流量、手机更流畅） */
function pickImage2(max,cb,capture){const i=document.createElement('input');i.type='file';i.accept='image/*';if(capture)i.capture='environment';
  i.onchange=async()=>{const f=i.files[0];if(!f)return;const [a,b]=await Promise.all([resizeImg(f,max||800),resizeImg(f,200)]);const [u,t]=await Promise.all([upImg(a),upImg(b)]);cb(u,t)};i.click()}
function pickImage(max,cb,capture){const i=document.createElement('input');i.type='file';i.accept='image/*';if(capture)i.capture='environment';
  i.onchange=async()=>{const f=i.files[0];if(!f)return;const du=await resizeImg(f,max||1000);cb(await upImg(du))};i.click()}
async function sha1(u8){const h=await crypto.subtle.digest('SHA-1',u8);return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
const upCache=LS.get('mediaUp',{});
async function upImg(du){
  if(!DB.cloud||typeof du!=='string'||!du.startsWith('data:image/'))return du;
  const m=/^data:(image\/(jpeg|jpg|png|webp));base64,([\s\S]*)$/.exec(du);if(!m)return du;
  try{const bin=atob(m[3]);if(bin.length>590000)return du;const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    const h=await sha1(u8);if(upCache[h])return upCache[h];const ext=m[2]==='png'?'png':'jpg',type=ext==='jpg'?'image/jpeg':'image/png';
    const name='p/'+h.slice(0,2)+'/'+h+'.'+ext;const BASE=CFG.supabaseUrl.replace(/\/$/,'');let ok=false;
    for(let a=0;a<4&&!ok;a++){if(a)await new Promise(z=>setTimeout(z,[0,800,2000,4500][a]));
      try{const r=await fetch(BASE+'/storage/v1/object/media/'+name,{method:'POST',headers:{apikey:CFG.supabaseAnonKey,Authorization:'Bearer '+CFG.supabaseAnonKey,'Content-Type':type,'cache-control':'max-age=31536000','x-upsert':'false'},body:new Blob([u8],{type})});
        if(r.ok){ok=true;break}const t=await r.text().catch(()=>'');if(/Duplicate|already exists/i.test(t)){ok=true;break}if(r.status<500&&r.status!==429)break}catch(e){}}
    if(!ok)return du;const url=BASE+'/storage/v1/object/public/media/'+name;upCache[h]=url;const ks=Object.keys(upCache);if(ks.length>200)delete upCache[ks[0]];LS.set('mediaUp',upCache);return url}catch(e){return du}}

/* ---------- 下载：导出 CSV / JSON（浏览器直接下载；App 内用系统分享） ---------- */
async function downloadFile(name,text,type){const blob=new Blob(['﻿'+text],{type:type||'text/csv;charset=utf-8'});
  try{if(isNative()&&navigator.canShare){const f=new File([blob],name,{type:blob.type});if(navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return}}}catch(e){}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);toast(L('已开始下载：','Downloading: ')+name)}
const csv=rows=>rows.map(r=>r.map(c=>{c=c==null?'':String(c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\n');
/* ---------- 导出 Excel（.xlsx）：带边框、表头底色、列宽，打开即可打印 ---------- */
const _CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=_CRC[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zipBlob(files,type){const enc=new TextEncoder();const parts=[],cd=[];let off=0;
  files.forEach(f=>{const nb=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(data),sz=data.length;
    const h=new DataView(new ArrayBuffer(30));[[0,0x04034b50,4],[4,20,2],[6,0x0800,2],[8,0,2],[10,0,2],[12,0x21,2],[14,crc,4],[18,sz,4],[22,sz,4],[26,nb.length,2],[28,0,2]].forEach(([o,v,n])=>n===4?h.setUint32(o,v,true):h.setUint16(o,v,true));
    parts.push(new Uint8Array(h.buffer),nb,data);
    const e=new DataView(new ArrayBuffer(46));[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x0800,2],[10,0,2],[12,0,2],[14,0x21,2],[16,crc,4],[20,sz,4],[24,sz,4],[28,nb.length,2],[30,0,2],[32,0,2],[34,0,2],[36,0,2],[38,0,4],[42,off,4]].forEach(([o,v,n])=>n===4?e.setUint32(o,v,true):e.setUint16(o,v,true));
    cd.push(new Uint8Array(e.buffer),nb);off+=30+nb.length+sz});
  const cs=cd.reduce((a,b)=>a+b.length,0);const z=new DataView(new ArrayBuffer(22));z.setUint32(0,0x06054b50,true);z.setUint16(8,files.length,true);z.setUint16(10,files.length,true);z.setUint32(12,cs,true);z.setUint32(16,off,true);
  return new Blob([...parts,...cd,new Uint8Array(z.buffer)],{type})}
const xesc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
const colL=n=>{let s='';n++;while(n){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s};
/* sheets: [{name,title,sub,head:[...],rows:[[...]],money:[列序号]}] */
function xlsxBlob(sheets){
  const sx=sheets.map((s,si)=>{const W=s.head.length;const widths=s.head.map((h,i)=>Math.min(48,Math.max(8,...[h,...s.rows.map(r=>r[i])].map(v=>{v=String(v==null?'':v);let w=0;for(const ch of v)w+=/[⺀-￿]/.test(ch)?2:1.1;return w+2}))));
    let r=1,rows='';const cell=(c,v,st)=>{const ref=colL(c)+r;if(typeof v==='number'&&isFinite(v))return `<c r="${ref}" s="${st}"><v>${v}</v></c>`;return `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`};
    rows+=`<row r="${r}" ht="24" customHeight="1">${cell(0,s.title,4)}</row>`;r++;
    rows+=`<row r="${r}">${cell(0,s.sub||'',6)}</row>`;r++;
    rows+=`<row r="${r}" ht="22" customHeight="1">${s.head.map((h,i)=>cell(i,h,1)).join('')}</row>`;const hr=r;r++;
    s.rows.forEach(row=>{rows+=`<row r="${r}">${s.head.map((h,i)=>{const v=row[i];const isN=typeof v==='number';return cell(i,v==null?'':v,isN?((s.money||[]).includes(i)?3:5):2)}).join('')}</row>`;r++});
    if(s.total){rows+=`<row r="${r}">${s.head.map((h,i)=>{const v=s.total[i];return v===undefined||v===null||v===''?cell(i,'',7):typeof v==='number'?cell(i,v,(s.money||[]).includes(i)?8:7):cell(i,v,7)}).join('')}</row>`;r++}
    const last=colL(W-1);
    return {name:`xl/worksheets/sheet${si+1}.xml`,data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${hr}" topLeftCell="A${hr+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w.toFixed(1)}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><mergeCells count="2"><mergeCell ref="A1:${last}1"/><mergeCell ref="A2:${last}2"/></mergeCells><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="${W>6?'landscape':'portrait'}" fitToWidth="1" fitToHeight="0"/></worksheet>`}});
  const bd='<border><left style="thin"><color rgb="FF8A8478"/></left><right style="thin"><color rgb="FF8A8478"/></right><top style="thin"><color rgb="FF8A8478"/></top><bottom style="thin"><color rgb="FF8A8478"/></bottom><diagonal/></border>';
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="5"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="15"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF6E6656"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B7A4B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1ECDF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${bd}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const sn=(s,i)=>xesc(String(s.name||('Sheet'+(i+1))).replace(/[\\\/\?\*\[\]:]/g,' ').slice(0,31));
  const files=[{name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`},
   {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
   {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${sn(s,i)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><definedNames>${sheets.map((s,i)=>`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${sn(s,i).replace(/'/g,"''")}'!$3:$3</definedName>`).join('')}</definedNames></workbook>`},
   {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
   {name:'xl/styles.xml',data:styles},...sx];
  return zipBlob(files,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
async function downloadBlob(name,blob){
  try{if(isNative()&&navigator.canShare){const f=new File([blob],name,{type:blob.type});if(navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return}}}catch(e){}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);toast(L('已开始下载：','Downloading: ')+name,false)}
function exportXlsx(file,sheets){const co=nmP(((DB.get('settings','app')||{}).co))||BRAND();
  sheets.forEach(s=>{s.sub=s.sub||`${co} · ${L('导出时间','Exported')} ${fday(Date.now())} ${new Date().toTimeString().slice(0,5)} · ${L('货币','Currency')} ${dispIso()}${S.me?' · '+nmP(S.me.name):''}`});
  downloadBlob(file+'_'+fday(Date.now())+'.xlsx',xlsxBlob(sheets))}

/* ---------- 账号：选部门 → 职位 →（同一职位有多人时）选人员 → 输入密码。密码可以相同（默认 666666），总经理在后台修改 ---------- */
const DEF_PW='666666';
async function pwHash(id,pw){const b=new TextEncoder().encode('jxc|'+id+'|'+pw);const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function findByPw(pw,exceptId){for(const u of DB.all('users')){if(u.id!==exceptId&&u.pw===await pwHash(u.id,pw))return u}return null}
async function login(pw,trust,role,uidSel){pw=String(pw||'').trim();const lk=LS.get('lock',{n:0,until:0});
  if(lk.until>Date.now())throw new Error(L(`尝试次数过多，请 ${Math.ceil((lk.until-Date.now())/1000)} 秒后再试`,`Too many attempts. Try again in ${Math.ceil((lk.until-Date.now())/1000)}s`));
  try{if(DB.cloud){const r=await rpc('jxc_login',{p_pw:pw,p_role:role||null,p_uid:uidSel||null,p_device:(LS.get('dev',null)||(LS.set('dev',uid('d')),LS.get('dev','')))+' '+navigator.userAgent.slice(0,90)});if(!r||!r.token)throw new Error(r&&r.error?r.error.split(' / ')[S.lang==='zh'?0:1]||r.error:'');S.token=r.token;S.me=r.user}
    else{let u=null;for(const x of DB.all('users')){if(x.active===false||(role&&x.role!==role)||(uidSel&&x.id!==uidSel))continue;if(x.pw===await pwHash(x.id,pw)){u=x;break}}if(!u)throw 0;S.me={...u};delete S.me.pw}}
  catch(e){lk.n++;if(lk.n>=5){lk.until=Date.now()+60e3;lk.n=0}LS.set('lock',lk);throw new Error(e&&e.message&&DB.cloud?e.message:L('职位或密码不正确，或账号已停用','Wrong position or password, or account disabled'))}
  LS.set('lock',{n:0,until:0});LS.set(SK,{me:S.me,token:S.token||null,trust:!!trust,t:Date.now()})}
function restoreSession(){const s=LS.get(SK,null);if(!s||!s.trust)return false;if(Date.now()-s.t>30*864e5)return false;S.me=s.me;S.token=s.token;
  if(!DB.cloud){const u=DB.get('users',S.me.id);if(!u||u.active===false)return false;S.me={...u};delete S.me.pw}return true}
function logout(){if(window.resetLanguageSession)resetLanguageSession();const session=S.token;if(DB.cloud&&session){const drop=window.revokePushRegistration?revokePushRegistration(session):Promise.resolve();drop.finally(()=>rpc('jxc_logout',{p_token:session}).catch(()=>{}))}LS.del(SK);S.me=null;S.token=null;if(window.updateUnreadBadge)updateUnreadBadge(true)}
async function changePw(old,nw){if(DB.cloud){await rpc('jxc_change_pw',{p_token:S.token,p_old:old,p_new:nw});return}
  const u=DB.get('users',S.me.id);if(u.pw!==await pwHash(u.id,old))throw new Error(L('原密码不正确','Current password is wrong'));
  if(String(nw).length<6)throw new Error(L('新密码至少 6 位','At least 6 characters'));DB.put('users',{...u,pw:await pwHash(u.id,nw)})}
/* 管理：新增 / 修改账号（总经理在后台操作） */
async function saveAccount(a,newPw){if(!can('mgmt'))throw new Error(L('没有后台权限','No backend access'));
  const old=a.id?DB.get('users',a.id):null;
  /* 职位可以在“重新编辑”里按需要更改；新账号默认按代码识别职位 */
  const role=ROLES[a.role]?a.role:(old?old.role:roleOfCode(a.code));
  if(!a.id&&!roleOfCode(a.code))throw new Error(L('账号代码格式：部门代码或“部门代码-序号”，如 444444-1','Code format: department code, or code-number such as 444444-1'));
  if(!role)throw new Error(L('请选择职位','Choose a position'));
  if(S.me.role!=='chair'){if(role==='chair'||(old&&old.role==='chair'))throw new Error(L('董事长账号只能由董事长修改','Only the chairman can edit chairman accounts'));a={...a,admin:old?!!old.admin:false}}
  if(old&&old.id===S.me.id&&role!==old.role)throw new Error(L('不能修改自己的职位','You cannot change your own position'));
  if(old&&old.role==='chair'&&(role!=='chair'||a.active===false)&&!DB.all('users').some(u=>u.id!==old.id&&u.role==='chair'&&u.active!==false))throw new Error(L('至少要保留一个可登录的董事长','Keep at least one active chairman'));
  if(role==='chair')a={...a,admin:false};
  if(DB.cloud){const r=await rpc('jxc_admin_user',{p_token:S.token,p_user:{id:a.id||null,code:a.code,name:nmP(a.name),role,pos:a.pos||null,wh:a.wh,active:a.active!==false,admin:!!a.admin},p_pw:newPw||null});if(r&&r.users)DB.d.users=r.users;DB.ver++;return}
  if(!a.id&&DB.all('users').some(u=>u.code===a.code))throw new Error(L('这个账号代码已存在','This account code already exists'));
  if(a.id===S.me.id&&a.active===false)throw new Error(L('不能停用自己的账号','You cannot disable your own account'));
  const d={...a,role};if(!d.id)d.id=uid('U');const pw=newPw||(!a.id?DEF_PW:null);
  if(pw){if(pw.length<6)throw new Error(L('密码至少 6 位','At least 6 characters'));d.pw=await pwHash(d.id,pw)}
  else d.pw=(old||{}).pw;DB.put('users',d)}
/* 门店开通码：付款后由平台提供，每个码增加 1 个门店名额（只能用一次） */
async function redeemCode(code){code=String(code||'').trim().toUpperCase().replace(/\s/g,'');if(!code)throw new Error(L('请输入开通码','Enter the activation code'));
  if(DB.cloud){const p=await rpc('jxc_redeem_code',{p_token:S.token,p_code:code});await Sync.run(true);return p}
  const cs=DB.get('settings','codes')||{id:'codes',list:[]};const it=(cs.list||[]).find(x=>x.code===code);
  if(!it)throw new Error(L('开通码不正确','Invalid activation code'));if(it.used)throw new Error(L('这个开通码已经用过了','This code has already been used'));
  DB.put('settings',{...cs,list:cs.list.map(x=>x.code===code?{...x,used:Date.now(),by:S.me.id}:x)});
  const s=DB.get('settings','app')||{id:'app'};const p={limit:plan().limit+1};DB.put('settings',{...s,plan:p});return p}
async function genCodes(platformPw,n){n=Math.max(1,Math.min(50,+n||1));
  if(DB.cloud)return await rpc('jxc_gen_codes',{p_platform_pw:platformPw,p_n:n});
  if(await pwHash('platform',platformPw)!==PLATFORM_HASH)throw new Error(L('平台密码不正确','Wrong platform password'));
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const out=[];for(let k=0;k<n;k++){const r=crypto.getRandomValues(new Uint8Array(8));out.push('MD'+[...r].map(x=>A[x%A.length]).join(''))}
  const cs=DB.get('settings','codes')||{id:'codes',list:[]};DB.put('settings',{...cs,list:[...(cs.list||[]),...out.map(code=>({code,t:Date.now()}))]});return out}


/* ================= 演示数据（加纳建材贸易场景，与 ChinaPaw 同一市场） ================= */
function ean(base){const d=base.split('').map(Number);let s=0;d.forEach((x,i)=>s+=x*(i%2?3:1));return base+((10-s%10)%10)}
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
async function seedDemo(){
  const R=rng(20261124),pick=a=>a[Math.floor(R()*a.length)],now=Date.now(),D=864e5;
  const d={};KINDS.forEach(k=>d[k]=[]);
  d.settings=[{id:'app',base:'GHS',country:'GH',co:{zh:'华兴建材（加纳）',en:'Huaxing Building Materials (Ghana)'},rates:{sea:[1800,28,45,'cbm','CNY'],air:[100,5,9,'kg'],road:[1,1,3,'kg'],express:[160,3,6,'kg']},lowRule:'min',plan:{limit:1}},{id:'codes',list:[]}];
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
  /* 部门账号：初始密码 = 部门代码（总经理 111111 … 出纳 666666），444444-1 是新增的第 2 个仓库主管 */
  const U=[['U1','chair','111111',{zh:'孙总',en:'Chairman Sun'},'W1'],['U2','buyer','222222',{zh:'李采购',en:'Li (Purchasing)'},'W1'],['U3','sales','333333',{zh:'阿玛·门萨',en:'Ama Mensah'},'W2'],
   ['U4','keeper','444444',{zh:'科乔·阿散蒂',en:'Kojo Asante'},'W1'],['U5','acct','555555',{zh:'陈会计',en:'Chen (Accounts)'},'W1'],['U6','cashier','666666',{zh:'阿贝娜',en:'Abena Owusu'},'W1'],
   ['U7','keeper','444444-1',{zh:'亚乌（库马西）',en:'Yaw (Kumasi)'},'W3'],['U8','field','777777',{zh:'夸梅（外勤）',en:'Kwame (Field)'},'W1'],['U9','ops','888888',{zh:'周运营',en:'Zhou (Operations)'},'W1'],['U10','clerk','999999',{zh:'内勤',en:'Office Clerk'},'W1'],['U11','gm','111112',{zh:'总经理',en:'General Manager'},'W1']];
  for(const u of U)d.users.push({id:u[0],role:u[1],code:u[2],name:u[3],wh:u[4],active:true,pw:await pwHash(u[0],u[2])});
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
    d.sr.push({id:'sr1',no:'SR'+fday(now-2*D).slice(2).replace(/-/g,'')+'-401',so:ret.id,wh:ret.wh,t:now-2*D,u:now-2*D,by:'U3',items:[{pid:it.pid,qty:q}],reason:{zh:'包装破损',en:'Damaged packaging'},status:'done',xby:'U4',xt:now-2*D});
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
  /* 财务：已完成订单大多已收款；采购付款有已付、已批准待付 */
  const tot=x=>(x.items||[]).reduce((a,i)=>a+i.qty*i.price,0);let fn=0;
  d.so.filter(s=>s.status==='done').forEach((s,k)=>{if(k%5===4)return;const amt=k%7===3?Math.round(tot(s)/2):tot(s);d.fin.push({id:'f'+(++fn),type:'rcv',ref:s.id,refKind:'so',amount:amt,method:['cash','bank','momo'][k%3],status:k%4===0?'recorded':'verified',t:s.t+2*36e5,by:'U6',vby:k%4===0?'':'U5'})});
  d.so.filter(s=>s.status==='shipped').forEach(s=>d.fin.push({id:'f'+(++fn),type:'rcv',ref:s.id,refKind:'so',amount:Math.round(tot(s)*0.3),method:'momo',status:'recorded',t:now-6*36e5,by:'U6',note:{zh:'定金',en:'Deposit'}}));
  d.po.filter(p=>p.status==='done').forEach((p,k)=>d.fin.push({id:'f'+(++fn),type:'pay',ref:p.id,refKind:'po',amount:tot(p),method:'bank',status:'paid',purp:'goods',t:p.u+3*864e5,at:p.u+2*864e5,by:'U5',gby:'U1',gt:p.u+2.5*864e5,gnote:'',pby:'U6',pt:p.u+3*864e5}));
  d.po.filter(p=>p.status==='received').forEach(p=>d.fin.push({id:'f'+(++fn),type:'pay',ref:p.id,refKind:'po',amount:Math.round(tot(p)*0.5),method:'bank',status:'approved',purp:'dep',t:now-5*36e5,at:now-5*36e5,by:'U5',gby:'U1',gt:now-3*36e5,gnote:'',note:{zh:'首付 50%',en:'50% first payment'}}));
  d.fin.unshift({id:'f0',type:'rcv',ref:'',refKind:'open',amount:450000,method:'bank',status:'verified',t:t0,by:'U6',vby:'U5',note:{zh:'期初资金',en:'Opening balance'}});
  d.fin.forEach(f=>f.u=f.t);
  [ 'moves','so','po','grn','sr','counts','ships','svc'].forEach(k=>d[k].forEach(x=>{if(!x.u)x.u=x.t||now}));
  KINDS.forEach(k=>d[k].forEach(x=>{if(!x.u)x.u=now}));
  /* 初始只有 1 个门店：演示数据全部归到总店（第 2 个门店起需要开通码） */
  d.wh=[{id:'W1',n:{zh:'特马总店',en:'Tema Main Store'},city:{zh:'特马',en:'Tema'}}];
  ['moves','po','grn','pr','so','sr','counts','ships','users'].forEach(k=>d[k].forEach(x=>{if(x.wh)x.wh='W1'}));
  d.counts.forEach(t=>t.items.forEach(i=>{const q=d.moves.filter(m=>m.pid===i.pid&&m.wh==='W1').reduce((a,m)=>a+m.qty,0);const df=i.real-i.sys;i.sys=q;i.real=Math.max(0,q+df)}));
  d.ships.forEach(s=>{['from','to'].forEach(k=>{if(s[k]&&s[k].en==='Accra Shop Store')s[k]={zh:'特马总店',en:'Tema Main Store'};if(s[k]&&s[k].en==='Tema Main Warehouse')s[k]={zh:'特马总店',en:'Tema Main Store'}})});
  d.users.find(u=>u.id==='U7').name={zh:'亚乌（副库管）',en:'Yaw (Deputy)'};
  KINDS.forEach(k=>DB.d[k]=d[k]);DB.outbox=[];DB.ver++;DB.save(true);LS.set('seeded',1);LS.set('seeded2',1);
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
  openSheet(`<div class="row gap"><img src="${LOGO}" class="logo" style="width:52px;height:52px;border-radius:16px"><div><div class="sh">${L('发现新版本','New version available')}</div>
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
  const head=`<div class="row gap"><img src="${LOGO}" class="logo" style="width:52px;height:52px;border-radius:16px"><div><div class="sh">${BRAND()} v${esc((UPD.remote||{}).version||'')}</div><div class="sm muted">${s==='dl'?L('正在下载…','Downloading…'):s==='ready'?L('下载完成','Downloaded'):s==='perm'?L('需要允许安装','Allow installs'):L('下载失败','Download failed')}</div></div></div>`;
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
function openSheet(h,force){SHEET_FORCE=!!force;const s=$('#sheet');s.innerHTML='<div class="grab"></div>'+h;s.scrollTop=0;s.classList.add('on');$('#mask').classList.add('on');/* 弹层里的按钮文字放不下时自动缩小 */if(window.fitText){requestAnimationFrame(fitText);setTimeout(fitText,320)}}
function closeSheet(really){if(SHEET_FORCE&&really!==true)return;SHEET_FORCE=false;const sh=$('#sheet');if(sh.contains(document.activeElement))document.activeElement.blur();const phone=sh.closest('.phone');if(phone)phone.scrollTop=0;sh.classList.remove('on');$('#mask').classList.remove('on');if(window._scanStop)_scanStop()}
const sheetOn=()=>$('#sheet').classList.contains('on');
function toast(m,bad){const t=$('#toast');if(!t)return;if(bad==null)bad=/失败|不足|未找到|不在|请|超过|错误|无法|failed|not |enter |choose |add at|exceed|wrong|cannot/i.test(m);t.innerHTML=ic(bad?'alert':'check',16)+'<span>'+esc(m)+'</span>';t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2200)}
function copyText(s){const ok=()=>toast(L('已复制：','Copied: ')+s);try{navigator.clipboard.writeText(s).then(ok,()=>fb())}catch(e){fb()}
  function fb(){const a=document.createElement('textarea');a.value=s;document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch(e){}a.remove();ok()}}
function openExt(u){if(!u)return;try{window.open(u,'_blank')}catch(e){location.href=u}}

/* ---------- 中文名称自动生成英文：输入框加 data-zh2en="#英文框"，英文框为空或是自动生成的才会填写，手动改过就不覆盖 ---------- */
async function zh2en(t){t=(t||'').trim();if(!t)return '';if(!/[一-鿿]/.test(t))return t;const k='z2e_'+t;const c=LS.get(k,null);if(c)return c;
  try{const r=await Promise.race([fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q='+encodeURIComponent(t)),new Promise((_,j)=>setTimeout(()=>j(0),5000))]);
    const j=await r.json();const o=(j[0]||[]).map(x=>x[0]).join('').trim();if(o){LS.set(k,o);return o}}catch(e){}return ''}
async function fillEn(o){if(o&&typeof o==='object'){o.zh=(o.zh||'').trim();o.en=(o.en||'').trim();if(!o.en&&o.zh)o.en=(await zh2en(o.zh))||o.zh;if(!o.zh&&o.en)o.zh=o.en}return o}
if(typeof document!=='undefined')document.addEventListener('input',e=>{const el=e.target;if(!el||!el.dataset)return;
  if(el.dataset.zh2en){clearTimeout(el._zt);el._zt=setTimeout(async()=>{const tg=document.querySelector(el.dataset.zh2en);if(!tg||(tg.value&&tg.dataset.auto!=='1'))return;
    const en=await zh2en(el.value);if(!tg.isConnected||(tg.value&&tg.dataset.auto!=='1'))return;tg.value=en;tg.dispatchEvent(new Event('input',{bubbles:true}));tg.dataset.auto='1'},450)}
  else if(el.dataset.auto==='1'&&e.isTrusted)el.dataset.auto=''},true);

/* ---------- 空白开始：新客户只有门店、公司设置和各部门账号（初始密码 = 部门代码） ---------- */
const BIZ_KINDS=()=>KINDS.filter(k=>!['users','wh','settings'].includes(k));
async function seedBlank(){const d={};KINDS.forEach(k=>d[k]=[]);const cc=(typeof C==='function'&&C())||{};
  d.settings=[{id:'app',base:cc.iso||'GHS',country:S.country||'GH',co:{zh:'',en:''},rates:{sea:[...FR_DEF.sea],air:[...FR_DEF.air],road:[...FR_DEF.road],express:[...FR_DEF.express]},lowRule:'min',plan:{limit:1},cats:[]},{id:'codes',list:[]}];
  d.wh=[{id:'W1',n:{zh:'总店',en:'Main store'},city:{zh:'',en:''}}];
  const U=[['U1','chair'],['U2','buyer'],['U3','sales'],['U4','keeper'],['U5','acct'],['U6','cashier'],['U8','field'],['U9','ops'],['U10','clerk'],['U11','gm']];
  for(const [id,r] of U){const code=ROLES[r].code;d.users.push({id,role:r,code,name:{zh:ROLES[r].zh,en:ROLES[r].en},wh:'W1',active:true,pw:await pwHash(id,DEF_PW)})}
  KINDS.forEach(k=>DB.d[k]=d[k]);DB.outbox=[];DB.ver++;DB.save(true)}
/* 清空业务数据（保留账号、门店、设置）。云端由服务器统一清空，其他手机同步 */
async function resetData(){if(S.me.role!=='chair')throw new Error(L('只有董事长可以清空数据','Only the GM can clear data'));
  if(DB.cloud){await rpc('jxc_reset',{p_token:S.token,p_confirm:'清空'});BIZ_KINDS().forEach(k=>DB.d[k]=[]);DB.outbox=DB.outbox.filter(o=>['users','wh','settings'].includes(o.k));await Sync.run(true)}
  else{BIZ_KINDS().forEach(k=>DB.d[k]=[]);DB.outbox=[]}
  const s=DB.get('settings','app')||{id:'app'};DB.put('settings',{...s,cats:[]});DB.ver++;DB.save(true);
  Object.keys(localStorage).filter(k=>k.startsWith('jxc_notes')||k.startsWith('jxc_alert')).forEach(k=>localStorage.removeItem(k))}
