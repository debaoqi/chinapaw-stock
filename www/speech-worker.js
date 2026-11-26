import {pipeline,env} from './vendor/speech/transformers.min.js';
env.allowLocalModels=false;
env.backends.onnx.wasm.numThreads=self.crossOriginIsolated?Math.min(4,self.navigator?.hardwareConcurrency||1):1;
env.backends.onnx.wasm.proxy=false;
env.backends.onnx.wasm.wasmPaths=new URL('./vendor/speech/',import.meta.url).href;
let transcriber,backend='wasm',chain=Promise.resolve();
const revision='ff4177021cc41f7db950912b73ea4fdf7d01d8e7';
async function load(d,device){backend=device;self.postMessage({id:d.id,type:'status',status:'loading',backend});return pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',{device,dtype:'q8',revision,progress_callback:p=>self.postMessage({id:d.id,type:'progress',progress:p.progress,status:p.status,file:p.file,backend})})}
async function ready(d){if(!transcriber)transcriber=await load(d,'wasm')}
// Drop only quiet leading/trailing frames, retaining 250ms on each side. Never cut pauses inside speech.
function speechBounds(audio){const frame=320,threshold=.003;let first=-1,last=-1;for(let i=0;i<audio.length;i+=frame){let energy=0,n=Math.min(frame,audio.length-i);for(let j=0;j<n;j++)energy+=audio[i+j]*audio[i+j];if(Math.sqrt(energy/n)>=threshold){if(first<0)first=i;last=i+n}}if(first<0)return null;return audio.subarray(Math.max(0,first-4000),Math.min(audio.length,last+4000))}
async function handle(d){const started=performance.now();try{
 if(d.type==='prepare'){await ready(d);self.postMessage({id:d.id,type:'ready',backend});return}
 const audio=speechBounds(d.audio);if(!audio||audio.length<3200){self.postMessage({id:d.id,type:'result',text:'',backend});return}
 await ready(d);self.postMessage({id:d.id,type:'status',status:'transcribing',backend});const options={language:d.language||undefined,task:'transcribe',chunk_length_s:30,stride_length_s:3,return_timestamps:false};let result;
 result=await transcriber(audio,options);
 self.postMessage({id:d.id,type:'result',text:result.text||'',backend,elapsedMs:Math.round(performance.now()-started)});
 }catch(e){try{await transcriber?.dispose()}catch{}transcriber=null;self.postMessage({id:d.id,type:'error',error:String(e.message||e),backend})}}
self.onmessage=({data:d})=>{chain=chain.catch(()=>{}).then(()=>handle(d))};
