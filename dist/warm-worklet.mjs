import {WarmMachine} from './warm.mjs';
const pcm=x=>Math.round(Math.max(-1,Math.min(1,x))*(x<0?32768:32767))||0;
class WarmProcessor extends AudioWorkletProcessor{
 constructor(){super();this.machine=new WarmMachine(sampleRate);this.recording=false;this.recordFrames=0;this.used=0;this.chunk=new Int16Array(16384);this.stateFrames=0;this.reportedError=null;this.port.onmessage=e=>{const d=e.data;try{
  if(d.type==='load')this.machine.setProject(d.data);
  else if(d.type==='play')this.machine.start();
  else if(d.type==='stop')this.machine.stop();
  else if(d.type==='panic'){this.machine.panic();if(this.recording)this.finish();}
  else if(d.type==='param')this.machine.setParam(d.key,d.value);
  else if(d.type==='on')this.machine.noteOn(d.note,d.velocity??1);
  else if(d.type==='off')this.machine.noteOff(d.note);
  else if(d.type==='record'){if(!this.recording){this.recording=true;this.recordFrames=0;this.used=0;}}
  else if(d.type==='recordStop')this.finish();
 }catch(error){this.machine.panic();if(this.recording)this.finish();this.port.postMessage({type:'error',message:error.message});}};}
 flush(){if(!this.used)return;const chunk=this.chunk.slice(0,this.used);this.port.postMessage({type:'chunk',chunk},[chunk.buffer]);this.used=0;}
 finish(){if(!this.recording)return;this.recording=false;this.flush();this.port.postMessage({type:'recordDone',frames:this.recordFrames,rate:sampleRate});}
 process(inputs,outputs){const channels=outputs[0];if(!channels?.[0])return true;for(let i=0;i<channels[0].length;i++){
  const s=this.machine.sample();channels[0][i]=s[0];if(channels[1])channels[1][i]=s[1];
  if(this.recording){this.chunk[this.used++]=pcm(channels[0][i]);this.chunk[this.used++]=pcm(channels[1]?channels[1][i]:channels[0][i]);this.recordFrames++;if(this.used===this.chunk.length)this.flush();if(this.recordFrames>=sampleRate*300)this.finish();}
 }
 this.stateFrames+=channels[0].length;if(this.stateFrames>=sampleRate/15){this.stateFrames=0;this.port.postMessage({type:'state',state:this.machine.snapshot(),recording:this.recording,recordSeconds:this.recordFrames/sampleRate});}
 if(this.machine.error&&this.machine.error!==this.reportedError){this.reportedError=this.machine.error;if(this.recording)this.finish();this.port.postMessage({type:'error',message:this.machine.error});}return true;
 }
}
registerProcessor('small-warm',WarmProcessor);
