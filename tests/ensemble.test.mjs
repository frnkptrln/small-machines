import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DrumMachine,freshDrum,validateDrum} from '../dist/drum.mjs';
import {Ensemble,validateEnsemble,toPCM,wavHeader} from '../dist/ensemble.mjs';
import {freshEnsemble,setSeconds,DECKS} from '../dist/ensemble-score.mjs';
const hash=x=>createHash('sha256').update(Buffer.from(x.buffer)).digest('hex');
test('eight original drum voices are distinct, deterministic, bounded and decay to silence',()=>{
 for(const rate of [8000,44100,48000]){const hashes=new Set();for(let voice=0;voice<8;voice++){const a=new DrumMachine(rate),b=new DrumMachine(rate);a.trigger(voice);b.trigger(voice);const samples=new Float32Array(rate);let energy=0;for(let i=0;i<rate;i++){const x=a.sample(),y=b.sample();assert.deepEqual(x,y);assert.ok(x.every(n=>Number.isFinite(n)&&Math.abs(n)<1));samples[i]=x[0];energy+=x[0]**2;}assert.ok(energy>.001,`voice ${voice}`);hashes.add(hash(samples));for(let i=0;i<rate*5;i++)a.sample();assert.ok(a.out.every(x=>Math.abs(x)<1e-6));}assert.equal(hashes.size,8);}
});
test('closed hi-hat chokes the open hat; velocity and mute affect sound',()=>{
 const rate=8000,a=new DrumMachine(rate),b=new DrumMachine(rate);a.trigger(4);b.trigger(4);for(let i=0;i<1000;i++){a.sample();b.sample();}a.trigger(3);for(let i=0;i<400;i++){a.sample();b.sample();}assert.ok(Math.abs(a.voices[4].last)<Math.abs(b.voices[4].last)*.01);
 const p=freshDrum();p.voices[0].mute=true;const muted=new DrumMachine(rate,p);muted.trigger(0);for(let i=0;i<2000;i++)assert.deepEqual([...muted.sample()],[0,0]);
 const low=new DrumMachine(rate),high=new DrumMachine(rate);low.trigger(0,.3);high.trigger(0,1);let e0=0,e1=0;for(let i=0;i<1000;i++){e0+=low.sample()[0]**2;e1+=high.sample()[0]**2;}assert.ok(e1>e0*8);
});
test('the factory set is exactly fifteen minutes and all musical data validates',()=>{
 const data=freshEnsemble();assert.equal(setSeconds(data),900);assert.equal(data.scenes.reduce((n,s)=>n+s.bars,0),480);assert.deepEqual(validateEnsemble(JSON.parse(JSON.stringify(data))),data);
 for(const mutate of [s=>s.bpm=NaN,s=>s.scenes[0].bars=0,s=>s.levels.sid=2,s=>s.scenes[0].patterns[0].drums[0][0]=-1,s=>s.scenes[0].patterns[0].acid[0].note=999,s=>s.scenes[0].patterns[0].paula[0].pop(),s=>s.solo='foo']){const x=freshEnsemble();mutate(x);assert.throws(()=>validateEnsemble(x));}
 const d=freshDrum();d.voices[1].decay=Infinity;assert.throws(()=>validateDrum(d));
});
test('one clock triggers all four engines and queues a scene at the next bar',()=>{
 const data=freshEnsemble();data.bpm=120;data.scenes[0].evolution=false;const p=data.scenes[0].patterns[0];p.sid[0][0]=60;p.paula[0][0]=72;p.acid[0]={note:38,accent:true,slide:false};p.drums[0][0]=1;
 const m=new Ensemble(8000,data),events=[];for(const [object,method,key]of [[m.sid,'noteOn','sid'],[m.paula,'noteOn','paula'],[m.acid,'noteOn','acid'],[m.drums,'trigger','drums']]){const original=object[method].bind(object);object[method]=(...args)=>{events.push({key,frame:m.frames});return original(...args);};}
 m.start(false);m.sample();for(const key of DECKS)assert.ok(events.some(e=>e.key===key&&e.frame===0));m.queue(3);for(let i=1;i<16000;i++)m.sample();assert.equal(m.sceneIndex,0);m.sample();assert.equal(m.sceneIndex,3);assert.equal(m.sceneBar,0);assert.equal(m.stepIndex,0);assert.equal(m.sceneChanges.at(-1).frame,16000);assert.equal(m.sid.playing,false);assert.equal(m.acid.playing,false);
});
test('automatic order terminates, manual scene mode loops and tempo changes stay shared',()=>{
 const data=freshEnsemble();data.bpm=137;for(const s of data.scenes){s.bars=4;s.evolution=false;}const m=new Ensemble(8000,data);m.start(true);const count=Math.ceil(32*240/137*8000);for(let i=0;i<=count;i++)m.sample();assert.equal(m.ended,true);assert.equal(m.playing,false);assert.equal(m.sceneIndex,7);for(let i=1;i<8;i++)assert.ok(Math.abs(m.sceneChanges[i].frame-i*4*240/137*8000)<=1);
 const loop=new Ensemble(8000,data);loop.start(false);for(let i=0;i<100000;i++)loop.sample();assert.equal(loop.sceneIndex,0);assert.equal(loop.playing,true);loop.setTempo(160);assert.equal(loop.sid.project.bpm,160);assert.equal(loop.paula.project.bpm,160);assert.equal(loop.acid.project.bpm,160);
});
test('all scenes render finite stereo; muted/solo endpoints, panic and pad audition work',()=>{
 const data=freshEnsemble();const energies=[];for(let scene=0;scene<8;scene++){const m=new Ensemble(8000,data);m.queue(scene);m.start(false);let energy=0;for(let i=0;i<64000;i++){const s=m.sample();assert.ok(s.every(x=>Number.isFinite(x)&&Math.abs(x)<.92));energy+=s[0]**2+s[1]**2;}assert.equal(m.error,null);assert.ok(energy>.1);energies.push(energy);m.panic();for(let i=0;i<3000;i++)assert.ok(m.sample().every(x=>x===0));}
 const m=new Ensemble(8000,data);m.queue(6);m.start(false);m.setMix({mutes:{sid:true,paula:true,acid:true,drums:true}});for(let i=0;i<10000;i++)assert.ok(m.sample().every(x=>x===0));m.panic();m.setMix({mutes:{drums:false},solo:'drums'});m.pad(0);let e=0;for(let i=0;i<8000;i++)e+=m.sample()[0]**2;assert.ok(e>.1);
});
test('drum edits and imported scene updates survive export without mutating factory presets',()=>{
 const m=new Ensemble(8000);m.drumEdit(0,2,4,7,.6);m.drumVoice(0,4,'tune',7);assert.equal(m.data.scenes[0].patterns[2].drums[4][7],.6);assert.equal(m.drums.project.voices[4].tune,7);assert.equal(freshEnsemble().scenes[0].patterns[2].drums[4][7],0);assert.doesNotThrow(()=>validateEnsemble(JSON.parse(JSON.stringify(m.data))));
 const s=structuredClone(m.data.scenes[0]);s.name='My scene';m.replaceScene(0,s);assert.equal(m.data.scenes[0].name,'My scene');assert.throws(()=>m.drumEdit(0,8,0,0,.5));assert.throws(()=>m.setMix({levels:{acid:-1}}));
});
test('recording bytes exactly match the audible output during mix and scene changes',async()=>{
 let Processor;globalThis.sampleRate=8000;globalThis.AudioWorkletProcessor=class{constructor(){this.messages=[];this.port={postMessage:d=>this.messages.push(d)};}};globalThis.registerProcessor=(name,p)=>{assert.equal(name,'small-ensemble');Processor=p;};await import('../dist/ensemble-worklet.mjs');const w=new Processor(),send=data=>w.port.onmessage({data}),heard=[];
 send({type:'queue',index:3});send({type:'play',auto:false});send({type:'record'});for(let block=0;block<160;block++){if(block===30)send({type:'mix',patch:{levels:{acid:.4},mutes:{sid:true}}});if(block===40)send({type:'queue',index:5});const l=new Float32Array(128),r=new Float32Array(128);w.process([],[[l,r]]);for(let i=0;i<128;i++)heard.push(toPCM(l[i]),toPCM(r[i]));}send({type:'recordStop'});const chunks=w.messages.filter(m=>m.type==='chunk').map(m=>m.chunk);assert.deepEqual(chunks.flatMap(c=>[...c]),heard);const done=w.messages.find(m=>m.type==='recordDone');assert.equal(done.frames,20480);const header=new DataView(wavHeader(done.frames,done.rate));assert.equal(header.getUint32(40,true),heard.length*2);assert.equal(header.getUint32(24,true),8000);
 send({type:'record'});w.recordFrames=8000*1200-1;w.process([],[[new Float32Array(128),new Float32Array(128)]]);assert.equal(w.recording,false);assert.equal(w.messages.filter(m=>m.type==='recordDone').at(-1).frames,9600000);send({type:'panic'});assert.equal(w.engine.playing,false);
});
test('WAV worker exports a complete eight-bar scene and a full custom set with quiet tails',async()=>{
 const messages=[];globalThis.self={postMessage:m=>messages.push(m)};await import('../dist/ensemble-render-worker.mjs');const data=freshEnsemble();data.bpm=220;for(const s of data.scenes)s.bars=4;
 for(const full of [false,true]){messages.length=0;self.onmessage({data:{data,index:6,full}});assert.ok(!messages.some(m=>m.type==='error'));const done=messages.at(-1),chunks=messages.filter(m=>m.type==='chunk').map(m=>m.chunk);assert.equal(done.type,'done');assert.equal(done.frames,Math.ceil((full?32:8)*240/220*44100)+44100*4);assert.equal(chunks.reduce((n,c)=>n+c.length,0),done.frames*2);assert.equal(chunks.at(-1).at(-1),0);assert.ok(done.peak>0&&done.peak<.92);}
});
