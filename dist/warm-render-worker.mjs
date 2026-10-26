import {WarmMachine,validateWarm} from './warm.mjs';
const pcm=x=>Math.round(Math.max(-1,Math.min(1,x))*(x<0?32768:32767))||0;
self.onmessage=e=>{try{const data=validateWarm(e.data.data),bars=e.data.bars??8,rate=44100;if(!Number.isInteger(bars)||bars<1||bars>128)throw Error('Exportlänge: 1–128 Takte.');const machine=new WarmMachine(rate,data),musicFrames=Math.ceil(bars*240/data.bpm*rate),frames=musicFrames+rate*4;machine.start();let done=0,peak=0;
 while(done<frames){const count=Math.min(8192,frames-done),chunk=new Int16Array(count*2);for(let i=0;i<count;i++){const f=done+i;if(f===musicFrames)machine.stop();const s=machine.sample();if(machine.error)throw Error(machine.error);const fade=Math.min(1,(frames-1-f)/(rate*.2));for(let ch=0;ch<2;ch++){peak=Math.max(peak,Math.abs(s[ch]));chunk[i*2+ch]=pcm(s[ch]*fade);}}done+=count;self.postMessage({type:'chunk',chunk,progress:done/frames},[chunk.buffer]);}
 self.postMessage({type:'done',frames,rate,peak});
 }catch(error){self.postMessage({type:'error',message:error.message});}};
