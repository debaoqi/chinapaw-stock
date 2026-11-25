import assert from 'node:assert/strict';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const privateKey=Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64');
const vars={PUSH_WEBHOOK_SECRET:'test-only-hook-secret',SUPABASE_URL:'https://db.example.test',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-key',FCM_SERVICE_ACCOUNT:JSON.stringify({client_email:'push@example.test',private_key:'-----BEGIN PRIVATE KEY-----\n'+privateKey+'\n-----END PRIVATE KEY-----',project_id:'test-push'})};
globalThis.Deno={env:{get:k=>vars[k]},serve:()=>{}};
let mode='success';const calls=[];
globalThis.fetch=async(url,opts={})=>{
 calls.push({url:String(url),method:opts.method||'GET',body:opts.body&&String(opts.body)});
 if(String(url).includes('oauth2.googleapis.com'))return Response.json({access_token:'test-google-access-token',expires_in:3600});
 if(String(url).includes('/rpc/jxc_claim_push'))return Response.json([{id:7,recipients:['sales','ops'],body:'您有新消息'}]);
 if(String(url).includes('/jxc_push_tokens?')&&(!opts.method||opts.method==='GET'))return Response.json([{device_token:'good',user_id:'sales'},{device_token:'gone',user_id:'ops'}]);
 if(String(url).includes('fcm.googleapis.com')){
  const message=JSON.parse(opts.body).message;
  assert.equal(message.android.priority,'high');assert.equal(message.data.eventId,'7');assert.ok(message.data.userId);
  assert.equal(message.notification,undefined,'native service owns unread counting');
  if(mode==='retry')return Response.json({error:{details:[{errorCode:'UNAVAILABLE'}]}},{status:503});
  if(message.token==='gone')return Response.json({error:{details:[{errorCode:'UNREGISTERED'}]}},{status:404});
  return Response.json({name:'delivered'});
 }
 return new Response(null,{status:204});
};
const {handleRequest}=await import('../supabase/functions/jxc-push/index.ts');
const request=secret=>new Request('https://edge.example.test',{method:'POST',headers:{'x-jxc-push-secret':secret}});
assert.equal((await handleRequest(request('wrong'))).status,401);assert.equal(calls.length,0);
let response=await handleRequest(request(vars.PUSH_WEBHOOK_SECRET));assert.equal(response.status,200);assert.equal((await response.json()).sent,1);
assert.ok(calls.some(c=>c.method==='DELETE'&&c.url.includes('device_token=eq.gone')));
assert.ok(calls.some(c=>c.method==='PATCH'&&JSON.parse(c.body).sent_at));
calls.length=0;mode='retry';response=await handleRequest(request(vars.PUSH_WEBHOOK_SECRET));assert.equal((await response.json()).sent,0);
assert.ok(calls.some(c=>c.method==='PATCH'&&JSON.parse(c.body).last_error));
assert.ok(!calls.some(c=>c.method==='DELETE'),'transient failures must not delete valid devices');
delete vars.FCM_SERVICE_ACCOUNT;assert.equal((await handleRequest(request(vars.PUSH_WEBHOOK_SECRET))).status,503);
console.log('Push relay PASS: shared-secret auth, OAuth signing, per-user high-priority data, invalid-token cleanup, retry retention, missing-configuration handling');
