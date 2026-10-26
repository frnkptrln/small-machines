import {installCleanPaula} from './clean-paula.mjs';
import {readFileSync,writeFileSync,openSync,writeSync,closeSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),engine=process.env.SMALL_MACHINES_ENGINE;
if(!engine)throw Error('Set SMALL_MACHINES_ENGINE to the Small Machines dist directory.');
for(const d of ['work','verification','audio'])mkdirSync(resolve(root,d),{recursive:true});
const {AcidMachine,freshAcid}=await import(pathToFileURL(resolve(engine,'acid.mjs')));
const {PaulaMachine,freshPaula,SAMPLE_BANK,SAMPLE_ADDRESSES,PAULA_CLOCK}=await import(pathToFileURL(resolve(engine,'paula.mjs')));
const score=JSON.parse(readFileSync(resolve(root,'scores/SM004-Saeureblumen.json'))),rate=score.rate,stepSeconds=60/score.bpm/4,end=Math.round(score.bars*16*stepSeconds*rate),frames=Math.ceil((score.bars*16*stepSeconds+score.tail)*rate);
const ap=freshAcid();ap.params={...ap.params,echo:12,volume:86,cutoff:120};const acid=new AcidMachine(rate,ap);
const pp=freshPaula(3);pp.bpm=score.bpm;pp.echo=14;pp.width=54;pp.filter=64;const paula=new PaulaMachine(rate,pp),cleanPlayback=installCleanPaula(paula.paula),preparedRates={};
function resample(s,rate){const length=s.loop?Math.max(2,Math.floor(s.pcm.length*rate/s.rate/2)*2):Math.ceil(s.pcm.length*rate/s.rate/2)*2;if(s.loop)rate=s.rate*length/s.pcm.length;const pcm=new Int8Array(length),ratio=rate/s.rate,cutoff=Math.min(1,ratio)*.94,radius=32;for(let i=0;i<length;i++){const x=i/ratio;let sum=0,weight=0;for(let j=Math.ceil(x-radius);j<=Math.floor(x+radius);j++){const d=x-j,z=Math.PI*d*cutoff,w=(Math.abs(z)<1e-8?1:Math.sin(z)/z)*(.5+.5*Math.cos(Math.PI*d/radius))*cutoff;weight+=w;if(s.loop)sum+=s.pcm[((j%s.pcm.length)+s.pcm.length)%s.pcm.length]*w;else if(j>=0&&j<s.pcm.length)sum+=s.pcm[j]*w;}pcm[i]=Math.round(Math.max(-128,Math.min(127,sum/weight)));}return {...s,rate,pcm};}
for(const id of new Set(score.events.filter(e=>e.type==='paula').map(e=>e.sample))){const s=SAMPLE_BANK.find(s=>s.id===id);if(!s)throw Error('Unknown sample');const highest=Math.max(...score.events.filter(e=>e.sample===id).map(e=>e.note)),safeRate=Math.floor(PAULA_CLOCK/124*.98/2**((highest-s.root)/12)/100)*100;if(safeRate<s.rate){const changed=resample(s,Math.max(3000,safeRate));paula.installSample(changed,SAMPLE_ADDRESSES.get(id));preparedRates[id]=changed.rate;}}
const events=score.events.map(e=>({...e,frame:Math.round(e.at*stepSeconds*rate)}));for(const e of score.events)if(e.gate!==undefined)events.push({type:e.type+'Off',voice:e.voice,id:e.id,frame:Math.round((e.at+e.gate)*stepSeconds*rate)});events.sort((a,b)=>a.frame-b.frame||Number(b.type.endsWith('Off'))-Number(a.type.endsWith('Off'))||a.id-b.id);
const audio=new Float32Array(frames*2),live=[-1,-1,-1,-1];let next=0,held=-1,duck=0,peak=0,energyAcid=0,energyPaula=0,clips=0,maxDelta=0,previous=[0,0],windowEnergy=0;const rmsBySecond=[],duckRelease=Math.exp(-1/(rate*.145));
for(let i=0;i<frames;i++){
 while(next<events.length&&events[next].frame<=i){const e=events[next++];
  if(e.type==='acid'){acid.noteOn(e.note,e.accent,e.slide);held=e.id;}
  else if(e.type==='acidOff'){if(held===e.id)acid.noteOff();}
  else if(e.type==='paula'){const s=paula.bank.get(e.sample);if(PAULA_CLOCK/(s.rate*2**((e.note-s.root)/12))<124)throw Error('Pitch outside Paula range');paula.project.channels[e.voice]={sample:e.sample,volume:e.volume,loop:s.loop===true,mute:false};paula.noteOn(e.voice,e.note);live[e.voice]=e.id;if(e.sample.includes('kick'))duck=1;}
  else if(e.type==='paulaOff'){if(live[e.voice]===e.id)paula.noteOff(e.voice);}
  else if(e.type==='tone')for(const key of ['cutoff','resonance','env','decay'])acid.setParam(key,e[key]);
 }
 if(i===end){acid.stop();paula.stop();}duck*=duckRelease;const a=acid.sample(),p=paula.sample(),gain=score.mix.acid*(1-duck*score.mix.sidechain),fade=Math.sin(Math.min(1,i/(rate*score.mix.fadeIn))*Math.PI/2)*Math.sin(Math.min(1,(frames-1-i)/(rate*score.mix.fadeOut))*Math.PI/2);
 energyAcid+=a[0]**2+a[1]**2;energyPaula+=p[0]**2+p[1]**2;
 for(let ch=0;ch<2;ch++){const x=(a[ch]*gain+p[ch]*score.mix.paula)*fade;if(!Number.isFinite(x))throw Error('Nonfinite');audio[i*2+ch]=x;peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>=1)clips++;maxDelta=Math.max(maxDelta,Math.abs(x-previous[ch]));previous[ch]=x;windowEnergy+=x*x/2;}
 if((i+1)%rate===0){rmsBySecond.push(Math.sqrt(windowEnergy/rate));windowEnergy=0;}
}
if(energyAcid<1||energyPaula<1||clips)throw Error('Invalid duet or clipped mix');
const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(audio.byteLength+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(3,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*8,28);h.writeUInt16LE(8,32);h.writeUInt16LE(32,34);h.write('data',36);h.writeUInt32LE(audio.byteLength,40);const fd=openSync(resolve(root,'work',score.id+'-raw.wav'),'w');writeSync(fd,h);writeSync(fd,Buffer.from(audio.buffer));closeSync(fd);
const report={title:score.title,engine:score.engine,seconds:frames/rate,peak,clippedSamples:clips,maxSampleDelta:maxDelta,energyAcid,energyPaula,paulaInstructions:paula.cpu.instructions,preparedRates,cleanPlayback,rmsBySecond};writeFileSync(resolve(root,'verification',score.id+'-render.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rmsBySecond:undefined}));
