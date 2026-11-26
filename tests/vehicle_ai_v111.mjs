import assert from 'node:assert/strict';
const vars={SUPABASE_URL:'https://db.example.test',SUPABASE_SERVICE_ROLE_KEY:'server-secret',GEMINI_VEHICLE_API_KEY:'private-model-key'};globalThis.Deno={env:{get:k=>vars[k]},serve(){}};
let mode='success',providerCalls=0,reservations=0,finished=[];
globalThis.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);if(url.includes('/rpc/jxc_vehicle_ai_identity')){if(body.p_token!=='valid')return new Response(null,{status:401});return Response.json('keeper')}
 if(url.includes('/rpc/jxc_vehicle_ai_reserve')){reservations++;if(mode==='limited')return Response.json({limited:true});if(mode==='cached')return Response.json({cached:true,result:{fields:{vin:'TESTVIN1234567890'},uncertain:[],needsReview:true}});return Response.json({requestId:'request-test-001',userId:'keeper'})}
 if(url.includes('/rpc/jxc_vehicle_ai_finish')){finished.push(body);return new Response(null,{status:204})}
 if(url.startsWith('https://generativelanguage.googleapis.com/')){providerCalls++;assert.equal(opts.headers['x-goog-api-key'],'private-model-key');assert.equal(body.generationConfig.responseMimeType,'application/json');assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'LOW');assert.equal(body.tools,undefined,'No paid tools or search');if(mode==='transient'){mode='success';return new Response('{}',{status:503})}if(mode==='quota')return new Response('{}',{status:429});return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({fields:{model:'TEST-100',vin:'TESTVIN1234567890',motor:'MOTOR123',configuration:'32AH/Disc',color:'Black',date:'2026-04-17',vehicleCode:'UNIT001'},uncertain:['vin'],notes:[]})}]}}]})}
 throw Error('Unexpected network request');
};
const {handleRequest,normalizeResult}=await import('../supabase/functions/jxc-vehicle-ocr/index.ts');
const image='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(120,1)]).toString('base64');
const req=(token='valid',origin='https://debaoqi.github.io')=>new Request('https://edge.example.test',{method:'POST',headers:{'x-jxc-session':token,origin},body:JSON.stringify({image,requestId:'request-test-001'})});
assert.equal((await handleRequest(req('invalid'))).status,401);assert.equal(providerCalls,0);
assert.equal((await handleRequest(req('valid','https://evil.test'))).status,403);assert.equal(providerCalls,0);
let r=await handleRequest(req());assert.equal(r.status,200);let out=await r.json();assert.equal(out.fields.motor,'MOTOR123');assert.equal(out.needsReview,true);assert.equal(JSON.stringify(out).includes('private-model-key'),false);assert.equal(finished.at(-1).p_ok,true);
mode='quota';r=await handleRequest(req());assert.equal(r.status,429);assert.equal(finished.at(-1).p_ok,false);assert.equal(providerCalls,2,'Do not fall through to a paid model');
mode='limited';assert.equal((await handleRequest(req())).status,429);assert.equal(providerCalls,2);
mode='cached';assert.equal((await handleRequest(req())).status,200);assert.equal(providerCalls,2);
mode='transient';const before=providerCalls;assert.equal((await handleRequest(req())).status,200);assert.equal(providerCalls,before+2,'Retry a temporary outage using the same model');
delete vars.GEMINI_VEHICLE_API_KEY;assert.equal((await handleRequest(req())).status,503);
assert.equal(normalizeResult({fields:{date:'2026-02-30'}}).fields.date,'');
assert.ok(normalizeResult({fields:{vin:'SUSPECT01'}}).uncertain.includes('vin'));
console.log('Vehicle AI PASS: authenticated roles, origin isolation, private key, structured fields, invalid dates/VIN warnings, quota stops with no paid fallback, result caching and missing-configuration handling.');
