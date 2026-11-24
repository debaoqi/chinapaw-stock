/* ================= 语言与货币：非洲 54 国（与华宝 ChinaPaw 同一套） =================
   国家 → 官方语言 + 货币。打开时按手机时区 / 语言自动识别国家和语言；
   语言按钮在“英语、中文、该国官方语言”之间轮换（按钮显示下一种语言）；
   中文、英文为内置词典，其他语言首次使用时自动翻译一次并保存在手机里（之后离线可用、不再闪动）。 */
const AF_RAW=`DZ|阿尔及利亚|Algeria|DZD|DA|ar,fr|N
AO|安哥拉|Angola|AOA|Kz|pt|S
BJ|贝宁|Benin|XOF|CFA|fr|W
BW|博茨瓦纳|Botswana|BWP|P|en|S
BF|布基纳法索|Burkina Faso|XOF|CFA|fr|W
BI|布隆迪|Burundi|BIF|FBu|fr|E
CV|佛得角|Cabo Verde|CVE|Esc|pt|W
CM|喀麦隆|Cameroon|XAF|FCFA|fr,en|C
CF|中非|Central African Republic|XAF|FCFA|fr|C
TD|乍得|Chad|XAF|FCFA|fr,ar|C
KM|科摩罗|Comoros|KMF|CF|fr,ar|E
CG|刚果（布）|Congo|XAF|FCFA|fr,ln|C
CD|刚果（金）|DR Congo|CDF|FC|fr,sw,ln|C
CI|科特迪瓦|Côte d'Ivoire|XOF|CFA|fr|W
DJ|吉布提|Djibouti|DJF|Fdj|fr,ar|E
EG|埃及|Egypt|EGP|E£|ar|N
GQ|赤道几内亚|Equatorial Guinea|XAF|FCFA|es,fr,pt|C
ER|厄立特里亚|Eritrea|ERN|Nfk|ti,ar,en|E
SZ|埃斯瓦蒂尼|Eswatini|SZL|E|en|S
ET|埃塞俄比亚|Ethiopia|ETB|Br|am,en|E
GA|加蓬|Gabon|XAF|FCFA|fr|C
GM|冈比亚|Gambia|GMD|D|en|W
GH|加纳|Ghana|GHS|GH₵|en|W
GN|几内亚|Guinea|GNF|FG|fr|W
GW|几内亚比绍|Guinea-Bissau|XOF|CFA|pt|W
KE|肯尼亚|Kenya|KES|KSh|sw,en|E
LS|莱索托|Lesotho|LSL|M|en,st|S
LR|利比里亚|Liberia|LRD|L$|en|W
LY|利比亚|Libya|LYD|LD|ar|N
MG|马达加斯加|Madagascar|MGA|Ar|mg,fr|E
MW|马拉维|Malawi|MWK|MK|en,ny|S
ML|马里|Mali|XOF|CFA|fr,bm|W
MR|毛里塔尼亚|Mauritania|MRU|UM|ar,fr|W
MU|毛里求斯|Mauritius|MUR|Rs|en,fr|E
MA|摩洛哥|Morocco|MAD|DH|ar,fr|N
MZ|莫桑比克|Mozambique|MZN|MT|pt|S
NA|纳米比亚|Namibia|NAD|N$|en,af|S
NE|尼日尔|Niger|XOF|CFA|fr,ha|W
NG|尼日利亚|Nigeria|NGN|₦|en,ha,yo,ig|W
RW|卢旺达|Rwanda|RWF|FRw|rw,fr,en,sw|E
ST|圣多美和普林西比|São Tomé and Príncipe|STN|Db|pt|C
SN|塞内加尔|Senegal|XOF|CFA|fr|W
SC|塞舌尔|Seychelles|SCR|SR|en,fr|E
SL|塞拉利昂|Sierra Leone|SLE|Le|en|W
SO|索马里|Somalia|SOS|Sh|so,ar|E
ZA|南非|South Africa|ZAR|R|en,zu,af,xh,st|S
SS|南苏丹|South Sudan|SSP|SSP|en,ar|E
SD|苏丹|Sudan|SDG|SDG|ar,en|N
TZ|坦桑尼亚|Tanzania|TZS|TSh|sw,en|E
TG|多哥|Togo|XOF|CFA|fr|W
TN|突尼斯|Tunisia|TND|DT|ar,fr|N
UG|乌干达|Uganda|UGX|USh|en,sw,lg|E
ZM|赞比亚|Zambia|ZMW|K|en,ny|S
ZW|津巴布韦|Zimbabwe|USD|US$|en,sn|S`;
const AF={};AF_RAW.split('\n').forEach(l=>{const [code,zh,en,iso,sym,langs,reg]=l.split('|');AF[code]={code,zh,en,iso,sym,langs:langs.split(','),reg}});
const LN={en:'English',zh:'中文',fr:'Français',pt:'Português',ar:'العربية',sw:'Kiswahili',am:'አማርኛ',ha:'Hausa',yo:'Yorùbá',ig:'Igbo',zu:'isiZulu',xh:'isiXhosa',af:'Afrikaans',st:'Sesotho',so:'Soomaali',rw:'Kinyarwanda',mg:'Malagasy',ny:'Chichewa',sn:'chiShona',ti:'ትግርኛ',es:'Español',ln:'Lingála',bm:'Bamanankan',lg:'Luganda'};
const flagE=c=>c&&c.length===2?String.fromCodePoint(...[...c.toUpperCase()].map(x=>0x1F1E6+x.charCodeAt(0)-65)):'';
const TZ2C={Algiers:'DZ',Luanda:'AO','Porto-Novo':'BJ',Gaborone:'BW',Ouagadougou:'BF',Bujumbura:'BI',Cape_Verde:'CV',Douala:'CM',Bangui:'CF',Ndjamena:'TD',Comoro:'KM',Brazzaville:'CG',Kinshasa:'CD',Lubumbashi:'CD',Abidjan:'CI',Djibouti:'DJ',Cairo:'EG',Malabo:'GQ',Asmara:'ER',Mbabane:'SZ',Addis_Ababa:'ET',Libreville:'GA',Banjul:'GM',Accra:'GH',Conakry:'GN',Bissau:'GW',Nairobi:'KE',Maseru:'LS',Monrovia:'LR',Tripoli:'LY',Antananarivo:'MG',Blantyre:'MW',Bamako:'ML',Nouakchott:'MR',Mauritius:'MU',Casablanca:'MA',El_Aaiun:'MA',Maputo:'MZ',Windhoek:'NA',Niamey:'NE',Lagos:'NG',Kigali:'RW',Sao_Tome:'ST',Dakar:'SN',Mahe:'SC',Freetown:'SL',Mogadishu:'SO',Johannesburg:'ZA',Juba:'SS',Khartoum:'SD',Dar_es_Salaam:'TZ',Lome:'TG',Tunis:'TN',Kampala:'UG',Lusaka:'ZM',Harare:'ZW'};
function detectCountry(){try{const k=(Intl.DateTimeFormat().resolvedOptions().timeZone||'').split('/').pop();if(TZ2C[k])return TZ2C[k]}catch(e){}
  for(const l of (navigator.languages||[navigator.language||''])){const m=/[-_]([A-Za-z]{2})$/.exec(l||'');if(m&&AF[m[1].toUpperCase()])return m[1].toUpperCase()}return 'GH'}
const C=()=>AF[S.country]||AF.GH;
const langsOf=code=>[...new Set(['en','zh',...(AF[code]||AF.GH).langs])];
function pickLang(code){const ls=langsOf(code),off=(AF[code]||AF.GH).langs;const ph=(navigator.languages||[navigator.language||'en']).map(x=>(x||'').slice(0,2).toLowerCase());
  for(const p of ph)if(ls.includes(p))return p;return off[0]}
const RTL=['ar'];

/* ---------- 翻译：L(中文, English)；其他语言 = 英文原句的翻译（数字不参与翻译，保证一句只翻一次） ---------- */
const L=(zh,en)=>S.lang==='zh'?zh:S.lang==='en'?en:tr(en);
const nm=v=>v==null?'':typeof v==='object'?(S.lang==='zh'?(v.zh||v.en||''):S.lang==='en'?(v.en||v.zh||''):tr(v.en||v.zh||'')):String(v);
/* 人名、公司名、品牌名不翻译 */
const nmP=v=>v==null?'':typeof v==='object'?(S.lang==='zh'?(v.zh||v.en||''):(v.en||v.zh||'')):String(v);
const BRAND=()=>S.lang==='zh'?'华宝进销存':'ChinaPaw Stock';
const TRC={},TRQ=new Set();
function trDict(l){return TRC[l]||(TRC[l]=LS.get('tr_'+l,{}))}
function trOne(s){if(!/[A-Za-z]/.test(s))return s;const nums=[];const key=s.replace(/\d[\d,.:]*\d|\d/g,m=>{nums.push(m);return '{'+(nums.length-1)+'}'}).trim();
  if(!key)return s;const d=trDict(S.lang);let v=d[key];if(v==null){TRQ.add(key);v=key;trFlush()}
  const lead=s.match(/^\s*/)[0],tail=s.match(/\s*$/)[0];return lead+v.replace(/\{\s*(\d+)\s*\}/g,(m,i)=>nums[i]!=null?nums[i]:m)+tail}
function tr(s){if(s==null)return '';s=String(s);if(s.indexOf('<')<0)return trOne(s);
  return s.split(/(<[^>]+>)/).map(p=>p[0]==='<'?p:trOne(p)).join('')}
async function gtx(lines,l){const out=[];const one=async c=>{try{const r=await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl='+l+'&dt=t&q='+encodeURIComponent(c.join('\n')));
      const j=await r.json();const res=(j[0]||[]).map(x=>x[0]).join('').split('\n').map(s=>s.trim());return res.length===c.length?res:null}catch(e){return null}};
  let chunk=[],len=0;const send=async c=>{let r=await one(c);if(!r&&c.length>1){r=[];for(const x of c){const y=await one([x]);r.push(y?y[0]:null)}}out.push(...(r||c.map(()=>null)))};
  for(const s of lines){if(len+s.length>1300&&chunk.length){await send(chunk);chunk=[];len=0}chunk.push(s.replace(/\n/g,' '));len+=s.length+1}if(chunk.length)await send(chunk);return out}
let _trT=null,_trBusy=false;
function trFlush(){if(_trBusy||!navigator.onLine)return;clearTimeout(_trT);_trT=setTimeout(async()=>{const l=S.lang;if(['zh','en'].includes(l))return;const keys=[...TRQ];TRQ.clear();if(!keys.length)return;
  _trBusy=true;const v=await gtx(keys,l);_trBusy=false;const d=trDict(l);let n=0;keys.forEach((k,i)=>{if(v[i]){d[k]=v[i];n++}});LS.set('tr_'+l,d);
  if(n&&S.lang===l&&window.softRender)softRender(true);if(TRQ.size)trFlush()},60)}
/* 切换到新语言时，先把全部界面文字一次翻好（只需联网一次），再显示，避免先英文后外文的闪动 */
async function ensureLang(l){if(['zh','en'].includes(l))return true;const d=trDict(l);const all=(window.TR_ALL||[]).map(s=>{const nums=[];return s.replace(/\d[\d,.:]*\d|\d/g,m=>{nums.push(m);return '{'+(nums.length-1)+'}'}).trim()})
   .flatMap(s=>s.indexOf('<')<0?[s]:s.split(/(<[^>]+>)/).filter(p=>p&&p[0]!=='<'&&/[A-Za-z]/.test(p)).map(p=>p.trim()));
  const miss=[...new Set(all)].filter(k=>k&&/[A-Za-z]/.test(k)&&d[k]==null);if(!miss.length)return true;if(!navigator.onLine)return false;
  const v=await gtx(miss,l);miss.forEach((k,i)=>{if(v[i])d[k]=v[i]});LS.set('tr_'+l,d);return true}
function langBtn(){const ls=langsOf(S.country);const i=ls.indexOf(S.lang);const nx=ls[(i+1)%ls.length];const lab=nx==='zh'?'中':nx.toUpperCase();
  return `<button class="langbtn" data-notr onclick="setLang('${nx}')" title="${esc(LN[nx]||nx)}">${lab}</button>`}
function ctryBtn(){return `<button class="langbtn" data-notr onclick="countrySheet()" title="${esc(C().en)}" style="font-size:18px">${flagE(S.country)}</button>`}
async function setLang(l,quiet){const prev=S.lang;LS.set('lang',l);
  if(!['zh','en'].includes(l)&&!quiet){const d=trDict(l);if(Object.keys(d).length<50){toast((LN[l]||l)+' …',false);await ensureLang(l)}else ensureLang(l)}
  S.lang=l;document.documentElement.lang=l==='zh'?'zh-CN':l;document.documentElement.dir=RTL.includes(l)?'rtl':'ltr';
  try{$('#toast').classList.remove('on')}catch(e){}document.title=BRAND();if(window.render&&!quiet)render(false)}
function setCountry(code){S.country=AF[code]?code:'GH';LS.set('country',{code:S.country,manual:true});closeSheet(true);const ls=langsOf(S.country);
  setLang(ls.includes(S.lang)?S.lang:pickLang(S.country));loadFx();toast(flagE(S.country)+' '+(S.lang==='zh'?C().zh:C().en)+' · '+C().sym,false)}
function countrySheet(){const q=(S.cq||'').trim().toLowerCase();const zhUI=S.lang==='zh';
  const row=c=>`<div class="li" onclick="setCountry('${c.code}')"><span style="font-size:24px;line-height:1" data-notr>${flagE(c.code)}</span><div style="flex:1;min-width:0"><b class="sm" data-notr>${esc(zhUI?c.zh:c.en)}</b><div class="xs muted one" data-notr>${c.langs.map(l=>LN[l]||l).join(' / ')} · ${esc(c.sym)} ${c.iso}</div></div>${S.country===c.code?ic('check'):''}</div>`;
  const list=Object.values(AF).filter(c=>!q||(c.zh+c.en+c.code+c.iso).toLowerCase().includes(q)).sort((a,b)=>zhUI?a.zh.localeCompare(b.zh,'zh'):a.en.localeCompare(b.en));
  openSheet(`<div class="sh">${L('选择国家（非洲 54 国通用）','Choose your country (54 African countries)')}</div><div class="xs muted">${L('自动识别：','Detected: ')}<span data-notr>${flagE(detectCountry())} ${esc(zhUI?AF[detectCountry()].zh:AF[detectCountry()].en)}</span> · ${L('语言和货币随国家切换','Language and currency follow the country')}</div>
   <div class="searchbar">${ic('search')}<input placeholder="${L('搜索国家','Search country')}" value="${esc(S.cq||'')}" oninput="S.cq=this.value;const t=this;clearTimeout(window._cqT);window._cqT=setTimeout(()=>{countrySheet();const i=$('#sheet input');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)"></div>
   <div style="margin-top:6px">${list.map(row).join('')}</div>`)}

/* ---------- 货币：账本用公司本币记账；显示时按所在国家货币或美元实时换算 ---------- */
const FXF={USD:1,DZD:134,AOA:915,XOF:565,BWP:13.6,BIF:2960,CVE:95,XAF:565,KMF:424,CDF:2850,DJF:178,EGP:49,ERN:15,SZL:18,ETB:140,GMD:72,GHS:11,GNF:8650,KES:129,LSL:18,LRD:180,LYD:5.45,MGA:4500,MWK:1740,MRU:40,MUR:46,MAD:9.2,MZN:64,NAD:18,NGN:1500,RWF:1450,STN:21.3,SCR:14.4,SLE:23,SOS:572,ZAR:18,SSP:4500,SDG:600,TZS:2500,TND:2.95,UGX:3650,ZMW:25,CNY:7.1,EUR:0.87};
const FX={d:LS.get('fx',null),busy:false};
async function loadFx(force){if(FX.busy)return;if(!force&&FX.d&&Date.now()-FX.d.t<3600e3)return;if(!navigator.onLine)return;FX.busy=true;
  try{const r=await fetch('https://open.er-api.com/v6/latest/USD',{cache:'no-store'});const j=await r.json();if(j&&j.rates){FX.d={t:Date.now(),upd:(j.time_last_update_unix||0)*1000,r:j.rates};LS.set('fx',FX.d);if(window.softRender)softRender(true)}}
  catch(e){}finally{FX.busy=false}}
const rateOf=iso=>(FX.d&&FX.d.r&&FX.d.r[iso])||FXF[iso]||1;   /* 1 美元 = 多少该货币 */
const fxLive=()=>!!(FX.d&&FX.d.r);
const symOf=iso=>iso==='USD'?'US$':iso==='CNY'?'¥':((Object.values(AF).find(c=>c.iso===iso)||{}).sym||iso);
const baseIso=()=>((typeof DB!=='undefined'&&DB.get('settings','app'))||{}).base||'GHS';
const dispIso=()=>S.curMode==='USD'?'USD':(LS.get('curFollow',true)?C().iso:baseIso());
const conv=(n,to)=>(+n||0)/rateOf(baseIso())*rateOf(to||dispIso());
const fmtN=(n,d=2)=>(+n||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const n2=n=>(Math.round((+n||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
const numK=n=>{n=conv(n);return Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e4?(n/1e3).toFixed(1)+'k':n2(n)};
const CUR=()=>symOf(dispIso());
const money=n=>CUR()+' '+fmtN(conv(n),(rateOf(dispIso())>=500?0:2));
const moneyK=n=>CUR()+' '+numK(n);
const moneyBase=n=>symOf(baseIso())+' '+fmtN(n);
const usd=n=>'US$ '+fmtN(conv(n,'USD'));
function curToggle(){S.curMode=S.curMode==='USD'?'local':'USD';LS.set('curMode',S.curMode);render(false)}
function curBtn(){return `<button class="syncchip" data-notr onclick="fxSheet()" style="padding:7px 10px">${esc(CUR())}${S.curMode==='USD'?'':' ⇄ $'}</button>`}
function fxSheet(){const b=baseIso(),l=C().iso;const r=rateOf(l),rb=rateOf(b);
  openSheet(`<div class="sh">${L('货币与美元汇率','Currency & USD rate')}</div>
   <div class="xs muted">${fxLive()?L('实时汇率，更新于 ','Live rate, updated ')+fdate(FX.d.upd||FX.d.t):L('离线参考汇率（联网后自动更新）','Offline reference rate (updates when online)')}</div>
   <div class="box"><div class="kv"><div><div class="l">${L('所在国家货币','Local currency')}</div><div class="v" data-notr>${flagE(S.country)} ${esc(C().sym)} · ${l}</div></div><div><div class="l">${L('1 美元 =','1 US$ =')}</div><div class="v" data-notr>${fmtN(r,r>=100?0:2)} ${l}</div></div>
    <div><div class="l">${L('公司记账货币','Company ledger currency')}</div><div class="v" data-notr>${esc(symOf(b))} · ${b}</div></div><div><div class="l">${L('1 美元 =','1 US$ =')}</div><div class="v" data-notr>${fmtN(rb,rb>=100?0:2)} ${b}</div></div></div></div>
   <div class="box"><h4>${L('换算','Convert')}</h4><div class="row gap"><input class="inp" id="fxA" type="number" inputmode="decimal" value="100" oninput="fxCalc()" style="background:var(--soft)"><select class="inp" id="fxF" onchange="fxCalc()" style="background:var(--soft);width:120px">${[...new Set([l,b,'USD'])].map(x=>`<option>${x}</option>`).join('')}</select></div><div id="fxOut" class="sm b" style="margin-top:10px;line-height:1.8" data-notr></div></div>
   <div class="seg">${[['local',L('显示本地货币','Show local currency')],['USD',L('显示美元','Show US$')]].map(([k,t])=>`<button class="${(S.curMode||'local')===k?'on':''}" onclick="S.curMode='${k}';LS.set('curMode','${k}');closeSheet();render(false)">${t}</button>`).join('')}</div>
   <div class="xs muted" style="margin-top:10px"><a href="https://www.exchangerate-api.com" target="_blank" style="color:inherit">Rates By Exchange Rate API</a></div>`);fxCalc()}
function fxCalc(){const a=+($('#fxA')||{}).value||0,f=($('#fxF')||{}).value||'USD';const u=a/rateOf(f);const o=$('#fxOut');if(!o)return;
  o.innerHTML=[...new Set([C().iso,baseIso(),'USD'])].filter(x=>x!==f).map(x=>`${fmtN(a,2)} ${f} = ${fmtN(u*rateOf(x),2)} ${x}`).join('<br>')}
