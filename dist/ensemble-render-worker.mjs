import {Ensemble,toPCM} from './ensemble.mjs';
import {setSeconds} from './ensemble-score.mjs';
self.onmessage=e=>{try{const {data,index=0,full=false}=e.data,rate=44100,m=new Ensemble(rate,data);m.queue(full?0:index);m.start(full);const musicFrames=Math.ceil((full?setSeconds(data):8*240/data.bpm)*rate),frames=musicFrames+rate*4;let done=0,peak=0;
 while(done<frames){const count=Math.min(8192,frames-done),chunk=new Int16Array(count*2);for(let i=0;i<count;i++){const f=done+i;if(f===musicFrames)m.stop();const s=m.sample();if(m.error)throw Error(m.error);const fade=Math.min(1,(frames-1-f)/(rate*.15));for(let ch=0;ch<2;ch++){peak=Math.max(peak,Math.abs(s[ch]));chunk[i*2+ch]=toPCM(s[ch]*fade);}}done+=count;self.postMessage({type:'chunk',chunk,progress:done/frames},[chunk.buffer]);}
 self.postMessage({type:'done',frames,rate,peak});
 }catch(error){self.postMessage({type:'error',message:error.message});}};
