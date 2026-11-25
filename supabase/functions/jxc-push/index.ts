// Server-only FCM HTTP v1 relay. Never include service credentials in www/ or APK resources.
const env = (name: string) => Deno.env.get(name) || '';
let accessToken = '', accessUntil = 0;
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const encode = (s: string) => b64url(new TextEncoder().encode(s));

async function googleToken(account: {client_email:string,private_key:string}) {
  if (accessToken && Date.now()<accessUntil) return accessToken;
  const now=Math.floor(Date.now()/1000);
  const input=encode(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+encode(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const pem=account.private_key.replace(/-----[^-]+-----|\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(input));
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:input+'.'+b64url(new Uint8Array(signature))})});
  if(!response.ok)throw new Error('FCM OAuth failed: '+response.status);
  const data=await response.json();accessToken=data.access_token;accessUntil=Date.now()+Math.max(60,(data.expires_in||3600)-120)*1000;return accessToken;
}

async function db(path:string,method='GET',body?:unknown) {
  const key=env('SUPABASE_SERVICE_ROLE_KEY');
  const response=await fetch(env('SUPABASE_URL')+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:path.startsWith('rpc/')?'return=representation':'return=minimal'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok)throw new Error('Push database request failed: '+response.status);
  const text=await response.text();return text?JSON.parse(text):null;
}

export async function handleRequest(req:Request) {
  if(req.method!=='POST')return new Response('Method not allowed',{status:405});
  const secret=env('PUSH_WEBHOOK_SECRET');
  if(!secret||req.headers.get('x-jxc-push-secret')!==secret)return new Response('Unauthorized',{status:401});
  if(!env('FCM_SERVICE_ACCOUNT'))return new Response('FCM server credentials are not configured',{status:503});
  try{
    const account=JSON.parse(env('FCM_SERVICE_ACCOUNT'));
    const token=await googleToken(account);
    const events=await db('rpc/jxc_claim_push','POST',{p_limit:10})||[];
    let sent=0;
    for(const event of events){
      const users=encodeURIComponent('('+event.recipients.map((x:string)=>JSON.stringify(x)).join(',')+')');
      const devices=await db('jxc_push_tokens?select=device_token,user_id,jxc_users!inner(active)&jxc_users.active=eq.true&user_id=in.'+users+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()))||[];
      let failed=false;
      await Promise.all(devices.map(async(device:{device_token:string,user_id:string})=>{
        try{
          const response=await fetch('https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(account.project_id)+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:{token:device.device_token,data:{userId:device.user_id,eventId:String(event.id),body:event.body},android:{priority:'high',ttl:'86400s'}}})});
          if(!response.ok){const error=await response.json();const gone=error?.error?.details?.some((d:{errorCode?:string})=>d.errorCode==='UNREGISTERED');
            if(gone)await db('jxc_push_tokens?device_token=eq.'+encodeURIComponent(device.device_token),'DELETE');else failed=true;
          }
        }catch{failed=true}
      }));
      await db('jxc_push_events?id=eq.'+event.id,'PATCH',failed?{last_error:'Transient delivery error; retry queued',leased_until:new Date(Date.now()+30000).toISOString()}:{sent_at:new Date().toISOString(),last_error:null,leased_until:null});
      if(!failed)sent++;
    }
    return Response.json({processed:events.length,sent});
  }catch(e){console.error('Push relay failed',e instanceof Error?e.message:'unknown error');return new Response('Push relay failed; queued events retained',{status:503})}
}

Deno.serve(handleRequest);
