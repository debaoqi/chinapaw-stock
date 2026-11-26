// Google basic text relay. Audio transcription stays on the device; no paid provider is called.
const headers={'Access-Control-Allow-Origin':'https://debaoqi.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-jxc-session','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
const limits=new Map<string,{at:number,n:number}>();
export async function handleLanguage(req:Request){
 if(req.headers.get('origin')&&req.headers.get('origin')!=='https://debaoqi.github.io')return reply({error:'ORIGIN'},403);
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method==='GET')return reply({ready:false,translationReady:true,provider:'device-google',speech:'device'});
 if(req.method!=='POST')return reply({error:'METHOD'},405);
 const token=req.headers.get('x-jxc-session');if(!token||token.length>1000)return reply({error:'SESSION'},401);
 if(Number(req.headers.get('content-length')||0)>14000)return reply({error:'SIZE'},413);
 let raw='';try{const reader=req.body?.getReader();if(!reader)return reply({error:'BODY'},400);const parts:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>14000){await reader.cancel();return reply({error:'SIZE'},413)}parts.push(value)}const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length}raw=new TextDecoder().decode(bytes)}catch{return reply({error:'BODY'},400)}
 let body;try{body=JSON.parse(raw)}catch{return reply({error:'BODY'},400)}
 if(body.action!=='translate')return reply({error:'RETIRED'},410);
 if(typeof body.text!=='string'||!body.text.trim()||body.text.length>2000||typeof body.target!=='string'||!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(body.target))return reply({error:'INPUT'},400);
 try{const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';const auth=await fetch((Deno.env.get('SUPABASE_URL')||'')+'/rest/v1/rpc/jxc_language_status',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_token:token}),signal:AbortSignal.timeout(8000)});if(!auth.ok)return reply({error:'SESSION'},401)}catch{return reply({error:'AUTH_UNAVAILABLE'},503)}
 // Instance-local burst protection; no transcripts, tokens or provider bodies are logged or persisted.
 const now=Date.now();if(limits.size>500)for(const [k,v]of limits)if(now-v.at>60000)limits.delete(k);const state=limits.get(token)||{at:now,n:0};if(now-state.at>60000){state.at=now;state.n=0}if(++state.n>30)return reply({error:'RATE'},429);limits.set(token,state);
 try{const response=await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='+encodeURIComponent(body.target)+'&dt=t&q='+encodeURIComponent(body.text),{signal:AbortSignal.timeout(12000)});if(!response.ok)return reply({error:'GOOGLE_UNAVAILABLE'},502);const j=await response.json(),out=(j[0]||[]).map((x:any)=>x?.[0]||'').join('').trim(),src=String(j[2]||'').toLowerCase().split('-')[0];if(!out)return reply({error:'EMPTY'},502);return reply({src,out,provider:'Google basic'})}catch{return reply({error:'GOOGLE_UNAVAILABLE'},502)}
}
Deno.serve(handleLanguage);
