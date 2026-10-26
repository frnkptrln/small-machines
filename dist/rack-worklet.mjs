import {Rack} from './rack.mjs';
class RackProcessor extends AudioWorkletProcessor {
 constructor(){super();this.rack=new Rack(sampleRate);this.frames=0;this.peaks=[0,0];this.recording=false;this.recFrames=0;this.recBuffer=null;this.recIndex=0;this.port.onmessage=({data:d})=>{try{const r=this.rack;
 if(d.type==='set'){this.rack=new Rack(sampleRate,d.set);if(d.play)this.rack.start();}
 else if(d.type==='play')r.start();else if(d.type==='stop')r.stop();else if(d.type==='panic'){r.panic();if(this.recording)this.stopRecording();}
 else if(d.type==='mix')r.setMix(d.patch);else if(d.type==='tempo')r.setTempo(d.bpm);
 else if(d.type==='scene')r.queue(d.set,d.id);
 else if(d.type==='paula'){r.paula.setProject(d.project,d.samples);if(d.reload)r.paula.load(d.project.source);}
 else if(d.type==='paulaParam')r.paula.setParam(d.channel,d.key,d.value);
 else if(d.type==='sid'){r.sid.setProject(d.project);if(d.reload)r.sid.load(d.project.source);}
 else if(d.type==='sidMute'){const p=r.sid.project;p.voices[d.voice].mute=d.mute;r.sid.setProject(p);}
 else if(d.type==='noteOn')r.paula.noteOn(d.voice,d.note);else if(d.type==='noteOff')r.paula.noteOff(d.voice);
 else if(d.type==='load')r.paula.load(d.source);else if(d.type==='step'){r.stop();r.paula.debugStep();}
 else if(d.type==='recordStart'){if(!this.recording){this.recording=true;this.recFrames=0;this.recIndex=0;this.recBuffer=new Float32Array(8192);}}
 else if(d.type==='recordStop')this.stopRecording();this.sendState();
 }catch(e){this.rack.playing=false;this.port.postMessage({type:'error',message:e.message});}};}
 flush(){if(!this.recIndex)return;const buffer=this.recIndex===this.recBuffer.length?this.recBuffer:this.recBuffer.slice(0,this.recIndex);this.port.postMessage({type:'recordChunk',buffer},[buffer.buffer]);this.recBuffer=new Float32Array(8192);this.recIndex=0;}
 stopRecording(){if(!this.recording)return;this.flush();this.recording=false;this.recBuffer=null;this.port.postMessage({type:'recordDone',frames:this.recFrames,rate:sampleRate});}
 sendState(){this.port.postMessage({type:'state',state:this.rack.snapshot(),recording:this.recording,recordFrames:this.recFrames,peaks:[...this.peaks]});this.peaks=[0,0];}
 process(inputs,outputs){const channels=outputs[0],left=channels[0],right=channels[1]||channels[0];for(let i=0;i<left.length;i++){const sample=this.rack.sample();left[i]=sample[0];right[i]=sample[1];this.peaks[0]=Math.max(this.peaks[0],Math.abs(sample[0]));this.peaks[1]=Math.max(this.peaks[1],Math.abs(sample[1]));if(this.recording){this.recBuffer[this.recIndex++]=sample[0];this.recBuffer[this.recIndex++]=sample[1];this.recFrames++;if(this.recIndex===this.recBuffer.length)this.flush();if(this.recFrames>=sampleRate*120)this.stopRecording();}}if((this.frames+=left.length)>=sampleRate/12){this.frames=0;this.sendState();}return true;}
}
registerProcessor('small-machines',RackProcessor);
