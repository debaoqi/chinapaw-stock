import {pipeline,env} from './vendor/speech/transformers.min.js';
env.allowLocalModels=false;
env.backends.onnx.wasm.numThreads=1;
env.backends.onnx.wasm.proxy=false;
env.backends.onnx.wasm.wasmPaths=new URL('./vendor/speech/',import.meta.url).href;
let transcriber;
self.onmessage=async({data:d})=>{try{
 if(!transcriber)transcriber=await pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',{device:'wasm',dtype:'q8',revision:'ff4177021cc41f7db950912b73ea4fdf7d01d8e7',progress_callback:p=>self.postMessage({id:d.id,type:'progress',progress:p.progress,status:p.status,file:p.file})});
 if(d.type==='prepare'){self.postMessage({id:d.id,type:'ready'});return}
 const result=await transcriber(d.audio,{language:d.language||undefined,task:'transcribe',chunk_length_s:20,stride_length_s:3,return_timestamps:false});
 self.postMessage({id:d.id,type:'result',text:result.text||''});
}catch(e){transcriber=null;self.postMessage({id:d.id,type:'error',error:String(e.message||e)})}};
