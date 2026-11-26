import assert from 'node:assert/strict';
let handler,calls=0;globalThis.Deno={serve(fn){handler=fn}};globalThis.fetch=async()=>{calls++;throw Error('Paid provider must never be called')};
await import('../supabase/functions/jxc-language/index.ts');
let r=await handler(new Request('https://edge.test',{method:'POST',body:'test'}));assert.equal(r.status,410);assert.equal((await r.json()).error,'RETIRED');assert.equal(calls,0);
r=await handler(new Request('https://edge.test'));assert.equal((await r.json()).ready,false);
console.log('Retired language adapter PASS: no OpenAI/Azure upstream calls, readiness false, POST returns 410.');
