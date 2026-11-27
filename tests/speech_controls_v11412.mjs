import assert from 'node:assert/strict';import {ctx,vm} from './ui_v190.mjs';const run=s=>vm.runInContext(s,ctx);let handler,spoken=[],stops=0,haptics=0,warm=0;
ctx.nativeSpeech={addListener:async(n,h)=>{handler=h;return {remove(){}}},prepareSpeech:async()=>{warm++},speak:async o=>{spoken.push(o)},stopSpeak:async()=>{stops++;return {offset:6}},speechFeedback:async()=>{haptics++}};
run("S.me={id:'reader',role:'sales'};DB.d.msg=[{id:'one',text:'原文',tr:{en:'Hello, this is a reading test.'}},{id:'two',text:'第二条',tr:{en:'Another message.'}}];DB.ver++;window.Capacitor={isNativePlatform:()=>true};NX=()=>nativeSpeech;voiceCaps=async()=>({speechControls:true,speak:true});toast=()=>{}");
const started=run("msgSpeak('one','en')");assert.equal(run('MESSAGE_SPEECH.phase'),'loading','Immediate visual feedback before any bridge await');assert.match(run("speechButtonContent('one','en')"),/准备中/);await started;assert.equal(spoken[0].rate,.8);assert.equal(warm,1);
handler({id:spoken[0].id,state:'playing'});assert.equal(run('MESSAGE_SPEECH.phase'),'playing');assert.match(run("speechButtonContent('one','en')"),/暂停/);
await run("msgSpeak('one','en')");assert.equal(run('MESSAGE_SPEECH.phase'),'paused');assert.equal(run('MESSAGE_SPEECH.offset'),6);assert.match(run("speechButtonContent('one','en')"),/继续/);assert.equal(stops,1);
await run("msgSpeak('one','en')");assert.equal(spoken[1].text,' this is a reading test.');assert.equal(spoken[1].offset,6);assert.equal(warm,1,'Engine prepared only once');
handler({id:spoken[0].id,state:'done'});assert.notEqual(run('MESSAGE_SPEECH'),null,'Stale completion cannot reset newer speech');handler({id:spoken[1].id,state:'done'});assert.equal(run('MESSAGE_SPEECH'),null);
await run("msgSpeak('two','en')");handler({id:spoken.at(-1).id,state:'error'});assert.equal(run('MESSAGE_SPEECH'),null);assert.equal(haptics,4);assert.match(run("speechButtonContent('two','en')"),/朗读/);
console.log('Speech controls PASS: immediate preparing/pause button, native start/end/error events, pause/resume offset, stale-event isolation, haptics, 0.8 rate and single prewarm. Device haptics and audio callbacks are mocked.');

