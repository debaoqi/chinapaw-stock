import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('src/app.js',root),'utf8');
const code=source.slice(source.indexOf('function speechTextReview('),source.indexOf('async function msgRetranslate'));
let value='明天送十二箱',posts=[],sheets=[],toasts=[],mode='ok';
const ctx={S:{chId:'chat'},meId:()=> 'user',L:z=>z,esc:x=>String(x),cleanVoiceTranscript:t=>/inaudible|laughing/i.test(t||'')?'':String(t||'').trim(),openSheet:x=>sheets.push(x),closeSheet:()=>{},$:sel=>sel==='#spText'?{value}:null,toast:x=>toasts.push(x),uid:()=> 'new-text',chPost:(m,ch)=>posts.push({m,ch}),languageTranslate:async()=>{if(mode==='fail')throw Error('offline');if(mode==='partial')return {tr:{en:'tomorrow'},error:'partial'};return {src:'zh',tr:{en:'Deliver twelve boxes tomorrow'}}}};
vm.createContext(ctx);vm.runInContext(code,ctx);
ctx.speechTextReview(value,'chat');await ctx.sendSpeechText();assert.equal(posts.length,0,'Preview must not send');assert.ok(sheets.at(-1).includes('Deliver twelve boxes tomorrow'));ctx.confirmSpeechText();assert.equal(posts.length,1);assert.equal(posts[0].m.voice,undefined);assert.equal(posts[0].m.text,value);ctx.confirmSpeechText();assert.equal(posts.length,1,'Cannot double send');
for(const bad of ['fail','partial']){mode=bad;ctx.speechTextReview(value,'chat');await ctx.sendSpeechText();ctx.confirmSpeechText();assert.equal(posts.length,1,'Failure must not send');assert.ok(ctx.S.speechDraft);}
mode='ok';ctx.speechTextReview(value,'chat');ctx.S.speechDraft.user='other';await ctx.sendSpeechText();assert.equal(posts.length,1);
const bar=source.slice(source.indexOf('<button id="cVoiceBtn"'),source.indexOf('<button class="icbtn" style=',source.indexOf('<button id="cVoiceBtn"')));assert.ok(!bar.includes('cVoiceTap'));assert.ok(bar.includes('speechTranslate()'));assert.ok(!bar.includes('vStart'));
assert.ok(!code.includes('startVoice'));assert.ok(!code.includes('upVoice'));assert.ok(!code.includes('speechRecordComposer'));
console.log('Text-only speech PASS: review before translation and send, no audio upload/message, failure/partial failure blocking, duplicate prevention and session isolation. Speech hardware and Google upstream not simulated as real success.');
