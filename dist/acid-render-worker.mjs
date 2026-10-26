import {AcidMachine,encodeAcidWav} from './acid.mjs';
self.onmessage=e=>{try{const d=e.data,rate=d.rate||44100;let chunks;
 if(d.type==='recording')chunks=d.chunks;
 else{const m=new AcidMachine(rate,d.project),end=Math.round(8*240/d.project.bpm*rate),frames=end+rate*2,pcm=new Float32Array(frames*2);m.start();for(let i=0;i<frames;i++){if(i===end)m.stop();const s=m.sample(),fade=Math.min(1,(frames-1-i)/(rate*.15));pcm[2*i]=s[0]*fade;pcm[2*i+1]=s[1]*fade;}chunks=[pcm];}
 const wav=encodeAcidWav(chunks,rate);self.postMessage({wav},[wav]);
 }catch(error){self.postMessage({error:error.message});}};
