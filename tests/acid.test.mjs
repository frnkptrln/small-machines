import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {AcidVoice,AcidMachine,ACID_PRESETS,PARAMS,freshAcid,validateAcid,encodeAcidWav} from '../dist/acid.mjs';
const energy=(v,n)=>{let e=0;for(let i=0;i<n;i++)e+=v.sample()**2;return e/n;};
test('original presets survive serialization; malformed imports are rejected',()=>{
 for(let i=0;i<ACID_PRESETS.length;i++){const p=freshAcid(i);assert.deepEqual(validateAcid(JSON.parse(JSON.stringify(p))),p);p.steps[0].note=24;assert.notEqual(freshAcid(i).steps[0].note,24);}
 for(const mutate of [p=>p.bpm=Infinity,p=>p.wave='noise',p=>p.params.cutoff=-1,p=>p.steps.pop(),p=>p.steps[0].note=24.5,p=>p.steps[0].accent='yes',p=>p.version=5]){const p=freshAcid();mutate(p);assert.throws(()=>validateAcid(p));}
});
test('the mono oscillator holds concert pitch independently of output sample rate',()=>{
 for(const rate of [8000,44100,48000])for(const wave of ['saw','square']){const v=new AcidVoice(rate,{...freshAcid().params,cutoff:4000,resonance:0,env:0},wave);v.noteOn(57);for(let i=0;i<rate/10;i++)v.sample();let last=0,crossings=0;for(let i=0;i<rate;i++){const x=v.sample();if(last<=0&&x>0)crossings++;last=x;}assert.ok(Math.abs(crossings-220)<=1,`${rate} ${wave}: ${crossings} Hz`);}
});
test('slide changes pitch continuously without re-trigger; rests and stop release',()=>{
 const v=new AcidVoice(44100);v.noteOn(36);energy(v,4000);const env=v.env;v.noteOn(48,true,true);assert.equal(v.pitch,36);assert.equal(v.triggers,1);assert.equal(v.env,env);v.sample();assert.ok(v.pitch>36&&v.pitch<48);energy(v,10000);assert.ok(Math.abs(v.pitch-48)<.001);v.noteOff();energy(v,44100);assert.ok(v.amp<1e-20);v.noteOn(40,false,true);assert.equal(v.triggers,2);assert.equal(v.pitch,40);
 const p=freshAcid(4);p.steps[0]={note:36,accent:false,slide:true};p.steps[1]={note:48,accent:false,slide:false};const m=new AcidMachine(8000,p);m.start();for(let i=0;i<1000;i++)m.sample();assert.equal(m.voice.triggers,1);for(let i=0;i<2000;i++)m.sample();assert.equal(m.voice.gate,false);m.stop();assert.equal(m.playing,false);m.panic();for(let i=0;i<100;i++)assert.deepEqual([...m.sample()],[0,0]);
});
test('accent adds energy and envelope opens the filter',()=>{
 const p={...freshAcid().params,cutoff:500,resonance:0,env:0,accent:100};const a=new AcidVoice(44100,p),b=new AcidVoice(44100,p);a.noteOn(38);b.noteOn(38,true);assert.ok(energy(b,12000)>energy(a,12000)*1.5);
 const closed=new AcidVoice(44100,{...p,cutoff:80}),open=new AcidVoice(44100,{...p,cutoff:80,env:100});closed.noteOn(50);open.noteOn(50);assert.ok(energy(open,3000)>energy(closed,3000)*3);
});
test('sixteenth-note transport remains on the sample clock across 32 bars',()=>{
 const rate=8000,p=freshAcid(4);p.bpm=137;const m=new AcidMachine(rate,p);m.start();let previous=-1;const seen=[];
 for(let f=0;f<Math.ceil(rate*32*240/137);f++){m.sample();if(m.step!==previous){seen.push(f);previous=m.step;}}
 assert.equal(seen.length,512);for(let i=0;i<seen.length;i++)assert.ok(Math.abs(seen[i]-i*rate*60/137/4)<=1,`step ${i}`);
});
test('all presets and extreme controls produce finite bounded output without a clipped sample',()=>{
 for(const rate of [8000,44100,48000])for(let preset=0;preset<ACID_PRESETS.length; preset++)for(const extreme of [false,true]){
  const p=freshAcid(preset);if(extreme)for(const [k,v]of Object.entries(PARAMS))p.params[k]=v[1];const m=new AcidMachine(rate,p);m.start();let e=0;
  for(let i=0;i<rate*2;i++){const s=m.sample();assert.ok(s.every(x=>Number.isFinite(x)&&Math.abs(x)<.98),`rate ${rate}, preset ${preset}`);e+=s[0]**2+s[1]**2;}
  if(preset!==4)assert.ok(e>1);m.stop();for(let i=0;i<rate*8;i++)m.sample();assert.ok(Math.max(...m.out.map(Math.abs))<1e-8);
 }
});
test('worklet records the exact stereo output, flushes short chunks and recovers from invalid commands',async()=>{
 let Processor;globalThis.sampleRate=8000;globalThis.AudioWorkletProcessor=class{constructor(){this.messages=[];this.port={postMessage:d=>this.messages.push(structuredClone(d))};}};globalThis.registerProcessor=(name,p)=>{assert.equal(name,'small-acid');Processor=p;};await import('../dist/acid-worklet.mjs');
 const w=new Processor(),p=freshAcid(1),reference=new AcidMachine(8000);reference.setProject(p);const command=data=>w.port.onmessage({data});command({type:'project',project:p});command({type:'play'});reference.start();command({type:'record'});const heard=[];
 for(let block=0;block<90;block++){if(block===30){command({type:'param',key:'cutoff',value:3200});reference.setParam('cutoff',3200);}const a=new Float32Array(128),b=new Float32Array(128);w.process([],[[a,b]]);for(let i=0;i<128;i++){const s=reference.sample();assert.equal(a[i],Math.fround(s[0]));assert.equal(b[i],Math.fround(s[1]));heard.push(a[i],b[i]);}}
 command({type:'recordStop'});const chunks=w.messages.filter(m=>m.type==='chunk').map(m=>m.chunk);assert.deepEqual(chunks.flatMap(c=>[...c]),heard);assert.equal(w.messages.find(m=>m.type==='recordDone').frames,11520);
 const wav=encodeAcidWav(chunks,8000),v=new DataView(wav);assert.equal(v.getUint32(24,true),8000);assert.equal(v.getUint16(22,true),2);assert.equal(wav.byteLength,44+heard.length*2);for(let i=0;i<heard.length;i++)assert.ok(Math.abs(v.getInt16(44+i*2,true)/32768-heard[i])<2/32768);
 command({type:'project',project:{}});assert.equal(w.machine.playing,false);assert.ok(w.messages.some(m=>m.type==='error'));const a=new Float32Array(128),b=new Float32Array(128);w.process([],[[a,b]]);assert.ok(a.every(x=>x===0)&&b.every(x=>x===0));
 command({type:'play'});command({type:'record'});w.frames=sampleRate*120-1;w.process([],[[a,b]]);assert.equal(w.recording,false);assert.equal(w.messages.filter(m=>m.type==='recordDone').at(-1).frames,960000);
});
test('offline export contains eight complete bars plus a two-second tail',async()=>{
 let message;globalThis.self={postMessage:m=>{message=m;}};await import('../dist/acid-render-worker.mjs');const p=freshAcid();p.bpm=220;self.onmessage({data:{project:p,rate:8000}});assert.ok(!message.error);const v=new DataView(message.wav),frames=Math.round(8*240/220*8000)+16000;assert.equal(message.wav.byteLength,44+frames*4);assert.equal(v.getInt16(message.wav.byteLength-2,true),0);
 const reference=new AcidMachine(8000,p);reference.start();for(let i=0;i<4000;i++){const s=reference.sample();assert.ok(Math.abs(v.getInt16(44+i*4,true)/32768-s[0])<2/32768);}
});
test('page wiring has unique controls and all local imports and navigation targets exist',()=>{
 const html=readFileSync(new URL('../dist/acid.html',import.meta.url),'utf8'),app=readFileSync(new URL('../dist/acid-app.mjs',import.meta.url),'utf8');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 for(const [,id] of app.matchAll(/\$\('(acid-[a-z-]+)'\)/g))assert.ok(ids.includes(id),id);
 for(const [,file]of html.matchAll(/(?:href|src)="\.\/([^"#]*)/g))assert.ok(existsSync(new URL('../dist/'+file,import.meta.url)),file);
 for(const file of ['index.html','paula.html'])assert.ok(readFileSync(new URL('../dist/'+file,import.meta.url),'utf8').includes('href="./acid.html"'));
});
