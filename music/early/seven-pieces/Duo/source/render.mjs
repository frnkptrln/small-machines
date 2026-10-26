// Render the original scores with the existing CPU-driven SID/Paula engines.
// Usage: SMALL_MACHINES_ENGINE=/path/to/site/dist node source/render.mjs [01|02|03]
import {readFileSync,writeFileSync,mkdirSync,readdirSync,openSync,writeSync,closeSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),engine=process.env.SMALL_MACHINES_ENGINE;
if(!engine)throw Error('Set SMALL_MACHINES_ENGINE to the Small Machines dist directory.');
const {Machine,freshProject}=await import(pathToFileURL(resolve(engine,'machine.mjs')));
const {PaulaMachine,freshPaula,SAMPLE_BANK,SAMPLE_ADDRESSES,PAULA_CLOCK}=await import(pathToFileURL(resolve(engine,'paula.mjs')));
const bank=new Map(SAMPLE_BANK.map(s=>[s.id,s]));mkdirSync(resolve(root,'work'),{recursive:true});
const selected=process.argv[2]||'';
function resample(s,rate){
 const length=Math.ceil(s.pcm.length*rate/s.rate/2)*2,pcm=new Int8Array(length),ratio=rate/s.rate,cutoff=Math.min(1,ratio)*.94,radius=32;
 for(let i=0;i<length;i++){const x=i/ratio;let sum=0,weight=0;for(let j=Math.ceil(x-radius);j<=Math.floor(x+radius);j++){const d=x-j,z=Math.PI*d*cutoff,w=(Math.abs(z)<1e-8?1:Math.sin(z)/z)*(.5+.5*Math.cos(Math.PI*d/radius))*cutoff;weight+=w;if(j>=0&&j<s.pcm.length)sum+=s.pcm[j]*w;}pcm[i]=Math.round(Math.max(-128,Math.min(127,sum/weight)));}
 return {...s,rate,pcm};
}
function writeFloatWav(path,data,rate){const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(data.byteLength+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(3,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*8,28);h.writeUInt16LE(8,32);h.writeUInt16LE(32,34);h.write('data',36);h.writeUInt32LE(data.byteLength,40);const fd=openSync(path,'w');writeSync(fd,h);writeSync(fd,Buffer.from(data.buffer));closeSync(fd);}
for(const name of readdirSync(resolve(root,'scores')).filter(n=>n.endsWith('.json')&&n.startsWith(selected))){
 const score=JSON.parse(readFileSync(resolve(root,'scores',name))),rate=score.rate,stepSeconds=60/score.bpm/4,totalSeconds=score.bars*16*stepSeconds+score.tail,frames=Math.ceil(totalSeconds*rate);
 const sp=freshProject(3);sp.bpm=score.bpm;sp.voices=score.voices;sp.echo=.16;sp.cutoff=1250;sp.resonance=2;
 const pp=freshPaula(3);pp.bpm=score.bpm;pp.echo=score.mix.echo;pp.width=score.mix.width;pp.filter=60;
 const sid=new Machine(rate,sp),paula=new PaulaMachine(rate,pp),preparedRates={};
 // Preserve pitch above Paula's highest playback-rate ceiling by bandlimited
 // downsampling the same PCM first. Root pitch and original sound are retained.
 for(const id of new Set(score.events.filter(e=>e.type==='paula').map(e=>e.sample))){const s=bank.get(id);if(!s)throw Error('Unknown sample '+id);const highest=Math.max(...score.events.filter(e=>e.sample===id).map(e=>e.note)),safeRate=Math.floor((PAULA_CLOCK/124)*.98/2**((highest-s.root)/12)/100)*100;if(safeRate<s.rate){const changed=resample(s,Math.max(3000,safeRate));paula.installSample(changed,SAMPLE_ADDRESSES.get(id));preparedRates[id]=changed.rate;}}
 const swingAt=step=>{const whole=Math.floor(step),part=step-whole;return whole+part+((whole%2===0?part:1-part)*score.swing);};
 const events=score.events.map(e=>({...e,frame:Math.round(swingAt(e.at)*stepSeconds*rate)}));
 for(const e of score.events)if(e.gate!==undefined)events.push({type:e.type==='sid'?'sidOff':'paulaOff',voice:e.voice,id:e.id,frame:Math.round(swingAt(e.at+e.gate)*stepSeconds*rate)});
 events.sort((a,b)=>a.frame-b.frame||((a.type.endsWith('Off')?0:1)-(b.type.endsWith('Off')?0:1)));
 const liveSID=[-1,-1,-1],livePaula=[-1,-1,-1,-1],audio=new Float32Array(frames*2);let next=0,duck=0,peak=0,energySID=0,energyPaula=0,heldNote=[null,null,null],tone=1250,toneTarget=1250;
 const duckRelease=Math.exp(-1/(rate*.145)),musicEnd=Math.round(score.bars*16*stepSeconds*rate),stats=[];
 let windowEnergy=0,windowCount=0,stopped=false;
 for(let i=0;i<frames;i++){
  while(next<events.length&&events[next].frame<=i){const e=events[next++];
   if(e.type==='sid'){sid.noteOn(e.voice,e.note);liveSID[e.voice]=e.id;heldNote[e.voice]={note:e.note,frame:i};}
   else if(e.type==='sidOff'){if(liveSID[e.voice]===e.id){sid.noteOff(e.voice);heldNote[e.voice]=null;}}
   else if(e.type==='paula'){const s=paula.bank.get(e.sample),period=PAULA_CLOCK/(s.rate*2**((e.note-s.root)/12));if(period<124)throw Error('Unreachable Paula pitch: '+e.sample+' '+e.note);paula.project.channels[e.voice]={sample:e.sample,volume:e.volume,loop:s.loop===true,mute:false};paula.noteOn(e.voice,e.note);livePaula[e.voice]=e.id;if(e.sample.includes('kick'))duck=1;}
   else if(e.type==='paulaOff'){if(livePaula[e.voice]===e.id)paula.noteOff(e.voice);}
   else if(e.type==='tone'){toneTarget=e.cutoff;paula.setParam(null,'filter',e.paulaFilter);}
  }
  if(!stopped&&i>=musicEnd){sid.stop();paula.stop();stopped=true;}
  // Slow filter motion and a subtle delayed vibrato, written through the CPU.
  if(i%512===0){tone+=(toneTarget-tone)*.085;const c=Math.round(tone+Math.sin(i/rate*.24)*18);sid.immediate([[0xd415,c&7],[0xd416,c>>3]]);const note=heldNote[0];if(note&&i-note.frame>rate*.22){const vibrato=Math.sin((i-note.frame)/rate*2*Math.PI*4.65)*.032,frequency=Math.round(440*2**((note.note-69+vibrato)/12)*16777216/985248);sid.immediate([[0xd400,frequency&255],[0xd401,frequency>>8]]);}}
  duck*=duckRelease;const a=sid.sample()*score.mix.sid*(1-duck*score.mix.sidechain),p=paula.sample();energySID+=a*a;energyPaula+=p[0]*p[0]+p[1]*p[1];
  const fadeIn=Math.min(1,i/(rate*score.mix.fadeIn)),fadeOut=Math.min(1,(frames-1-i)/(rate*score.mix.fadeOut)),fade=Math.sin(fadeIn*Math.PI/2)*Math.sin(fadeOut*Math.PI/2);
  const l=(a+p[0]*score.mix.paula)*fade,r=(a+p[1]*score.mix.paula)*fade;
  if(!Number.isFinite(l)||!Number.isFinite(r))throw Error('Nonfinite output');audio[2*i]=l;audio[2*i+1]=r;peak=Math.max(peak,Math.abs(l),Math.abs(r));windowEnergy+=(l*l+r*r)/2;windowCount++;
  if(windowCount===rate){stats.push(Math.sqrt(windowEnergy/windowCount));windowEnergy=0;windowCount=0;}
 }
 const path=resolve(root,'work',score.id+'-raw.wav');writeFloatWav(path,audio,rate);
 const report={title:score.title,seconds:frames/rate,peak,energySID,energyPaula,sidInstructions:sid.cpu.instructions,paulaInstructions:paula.cpu.instructions,preparedRates,rmsBySecond:stats};
 if(energySID<1||energyPaula<1)throw Error('One machine is missing');writeFileSync(resolve(root,'work',score.id+'-render.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rmsBySecond:undefined}));
}
