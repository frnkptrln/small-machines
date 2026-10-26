import {AcidMachine,freshAcid} from './acid.mjs';
class AcidProcessor extends AudioWorkletProcessor{
 constructor(){super();this.machine=new AcidMachine(sampleRate,freshAcid());this.recording=false;this.frames=0;this.tick=0;this.peak=0;this.chunk=new Float32Array(8192);this.used=0;this.port.onmessage=e=>{
  try{const d=e.data,m=this.machine;
   if(d.type==='project')m.setProject(d.project);
   else if(d.type==='param')m.setParam(d.key,d.value);
   else if(d.type==='play')m.start();
   else if(d.type==='stop')m.stop();
   else if(d.type==='panic')m.panic();
   else if(d.type==='record'){this.recording=true;this.frames=0;this.used=0;}
   else if(d.type==='recordStop')this.finish();
  }catch(error){this.machine.panic();if(this.recording)this.finish();this.port.postMessage({type:'error',message:error.message});}
 };}
 flush(){if(!this.used)return;const chunk=this.chunk.slice(0,this.used);this.port.postMessage({type:'chunk',chunk},[chunk.buffer]);this.used=0;}
 finish(){if(!this.recording)return;this.recording=false;this.flush();this.port.postMessage({type:'recordDone',frames:this.frames,rate:sampleRate});}
 process(inputs,outputs){const channels=outputs[0];if(!channels?.[0])return true;const left=channels[0],right=channels[1]||left;
  for(let i=0;i<left.length;i++){const s=this.machine.sample();left[i]=s[0];right[i]=s[1];this.peak=Math.max(this.peak,Math.abs(s[0]),Math.abs(s[1]));
   if(this.recording){this.chunk[this.used++]=s[0];this.chunk[this.used++]=s[1];this.frames++;if(this.used===this.chunk.length)this.flush();if(this.frames>=sampleRate*120)this.finish();}
  }
  this.tick+=left.length;if(this.tick>=sampleRate/15){this.tick=0;this.port.postMessage({type:'state',step:this.machine.step,playing:this.machine.playing,peak:this.peak,seconds:this.frames/sampleRate,recording:this.recording});this.peak=0;}
  return true;
 }
}
registerProcessor('small-acid',AcidProcessor);
