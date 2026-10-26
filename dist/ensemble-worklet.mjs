import {Ensemble,toPCM} from './ensemble.mjs';
class EnsembleProcessor extends AudioWorkletProcessor{
 constructor(){super();this.engine=new Ensemble(sampleRate);this.recording=false;this.recordFrames=0;this.used=0;this.chunk=new Int16Array(16384);this.stateFrames=0;this.tail=-1;this.lastError=null;this.port.onmessage=e=>{const d=e.data;try{
  if(d.type==='load'){if(this.recording)this.finish();this.engine=new Ensemble(sampleRate,d.data);}
  else if(d.type==='play')this.engine.start(d.auto);
  else if(d.type==='stop')this.engine.stop();
  else if(d.type==='panic'){this.engine.panic();if(this.recording)this.finish();}
  else if(d.type==='queue')this.engine.queue(d.index);
  else if(d.type==='auto')this.engine.auto=!!d.value;
  else if(d.type==='tempo')this.engine.setTempo(d.bpm);
  else if(d.type==='mix')this.engine.setMix(d.patch);
  else if(d.type==='scene')this.engine.replaceScene(d.index,d.scene);
  else if(d.type==='drumEdit')this.engine.drumEdit(d.scene,d.bar,d.voice,d.step,d.value);
  else if(d.type==='drumVoice')this.engine.drumVoice(d.scene,d.voice,d.key,d.value);
  else if(d.type==='pad')this.engine.pad(d.voice);
  else if(d.type==='record'){if(this.recording)return;this.recording=true;this.recordFrames=0;this.used=0;this.tail=-1;}
  else if(d.type==='recordStop')this.finish();
 }catch(error){this.engine.panic();if(this.recording)this.finish();this.port.postMessage({type:'error',message:error.message});}};}
 flush(){if(!this.used)return;const chunk=this.chunk.slice(0,this.used);this.port.postMessage({type:'chunk',chunk},[chunk.buffer]);this.used=0;}
 finish(){if(!this.recording)return;this.recording=false;this.flush();this.port.postMessage({type:'recordDone',frames:this.recordFrames,rate:sampleRate});}
 process(inputs,outputs){const channels=outputs[0];if(!channels?.[0])return true;for(let i=0;i<channels[0].length;i++){
  const s=this.engine.sample();channels[0][i]=s[0];if(channels[1])channels[1][i]=s[1];
  if(this.recording){this.chunk[this.used++]=toPCM(channels[0][i]);this.chunk[this.used++]=toPCM(channels[1]?channels[1][i]:channels[0][i]);this.recordFrames++;if(this.used===this.chunk.length)this.flush();if(this.engine.ended){if(this.tail<0)this.tail=sampleRate*4;if(--this.tail===0)this.finish();}if(this.recordFrames>=sampleRate*1200)this.finish();}
 }
 this.stateFrames+=channels[0].length;if(this.stateFrames>=sampleRate/15){this.stateFrames=0;this.port.postMessage({type:'state',state:this.engine.snapshot(),recording:this.recording,recordSeconds:this.recordFrames/sampleRate});}
 if(this.engine.error&&this.engine.error!==this.lastError){this.lastError=this.engine.error;this.port.postMessage({type:'error',message:this.lastError});if(this.recording)this.finish();}return true;
 }
}
registerProcessor('small-ensemble',EnsembleProcessor);
