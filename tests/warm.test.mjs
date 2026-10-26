import test from 'node:test';
import assert from 'node:assert/strict';
import {WARM_PARAMS,WARM_PRESETS,freshWarm,validateWarm,WarmMachine} from '../dist/warm.mjs';

const silencePatterns=()=>Array.from({length:8},()=>Array(16).fill(null));
const toneProject=()=>{const p=freshWarm();p.patterns=silencePatterns();Object.assign(p.params,{saw:100,pulse:0,sub:0,noise:0,pwm:0,cutoff:6000,resonance:0,env:0,attack:3,decay:30,sustain:100,release:30,hpf:20,chorus:0,drift:0,volume:70});return p;};
const advance=(m,frames)=>{let energy=0;for(let i=0;i<frames;i++){const s=m.sample();energy+=s[0]**2+s[1]**2;}return energy;};
const active=m=>m.voices.filter(v=>v.stage!=='off');
const pcm=x=>Math.round(Math.max(-1,Math.min(1,x))*(x<0?32768:32767))||0;

test('warm projects round-trip without sharing preset state; malformed imports are rejected',()=>{
 assert.ok(WARM_PRESETS.length>=6);
 const names=new Set();
 for(let i=0;i<WARM_PRESETS.length;i++){
  const p=freshWarm(i);names.add(p.name);assert.deepEqual(validateWarm(JSON.parse(JSON.stringify(p))),p);
  const before=freshWarm(i);p.params.cutoff=123;p.patterns[0][0]={notes:[24],velocity:.2,length:1};assert.deepEqual(freshWarm(i),before);
 }
 assert.equal(names.size,WARM_PRESETS.length);
 for(const mutate of [p=>p.bpm=Infinity,p=>p.version=2,p=>p.params.cutoff=-1,p=>p.params.chorus=NaN,p=>p.patterns.pop(),p=>p.patterns[0].pop(),p=>p.patterns[0][0]={notes:[60,60],velocity:.5,length:4},p=>p.patterns[0][0]={notes:[97],velocity:.5,length:4},p=>p.patterns[0][0]={notes:[60.5],velocity:.5,length:4},p=>p.patterns[0][0]={notes:[60],velocity:2,length:4},p=>p.patterns[0][0]={notes:[60],velocity:.5,length:0},p=>p.patterns[0][0]={notes:[60],velocity:.5,length:33}]){
  const p=freshWarm();mutate(p);assert.throws(()=>validateWarm(p));
 }
});

test('an isolated warm oscillator keeps A4 tuning across sample rates',()=>{
 for(const rate of [8000,44100,48000]){
  const m=new WarmMachine(rate,toneProject());m.noteOn(69);advance(m,Math.ceil(rate*.15));
  let crossings=0,last=m.sample()[0];
  for(let i=0;i<rate;i++){const value=m.sample()[0];if(last<=0&&value>0)crossings++;last=value;}
  assert.ok(Math.abs(crossings-440)<=1,`${rate} Hz output: ${crossings} positive crossings`);
 }
});

test('six-voice allocation handles voice stealing, release and independent chord gates',()=>{
 const m=new WarmMachine(8000,toneProject());
 for(let n=60;n<67;n++)m.noteOn(n,.8);
 assert.equal(m.voices.length,6);assert.equal(active(m).length,6);assert.ok(active(m).some(v=>v.note===66));
 assert.ok(advance(m,1000)>.01);
 m.noteOff(66);advance(m,8000);assert.ok(!active(m).some(v=>v.note===66));assert.ok(active(m).length<=5);
 m.allNotesOff();advance(m,8000);assert.equal(active(m).length,0);assert.ok(advance(m,800)<1e-12);
 m.panic();m.trigger({notes:[60,61,62,63,64,65],velocity:.7,length:1},100);advance(m,50);
 m.noteOn(72,.9);advance(m,200);
 const stolen=active(m).find(v=>v.note===72);assert.ok(stolen&&stolen.stage!=='release','expired chord gates must not release a reused voice');
 m.allNotesOff();advance(m,8000);assert.equal(active(m).length,0);
 m.panic();m.trigger({notes:[60],velocity:0,length:1},100);assert.equal(advance(m,800),0);
});

test('all warm presets are deterministic and finite; chorus makes a stereo field',()=>{
 for(const rate of [8000,44100,48000])for(let preset=0;preset<WARM_PRESETS.length;preset++){
  const p=freshWarm(preset),a=new WarmMachine(rate,p),b=new WarmMachine(rate,p);a.start();b.start();let energy=0;
  for(let i=0;i<Math.round(rate*.45);i++){
   const x=a.sample(),y=b.sample();assert.equal(x[0],y[0]);assert.equal(x[1],y[1]);
   assert.ok(x.every(v=>Number.isFinite(v)&&Math.abs(v)<1),`${rate} preset ${preset}`);energy+=x[0]**2+x[1]**2;
  }
  assert.ok(energy>.0001,`audible preset ${preset} at ${rate}`);
  a.panic();for(let i=0;i<300;i++)assert.deepEqual([...a.sample()],[0,0]);
 }
 const p=toneProject();p.params.chorus=100;const chorus=new WarmMachine(44100,p);chorus.noteOn(60);chorus.noteOn(67);let total=0,difference=0;
 for(let i=0;i<44100;i++){const s=chorus.sample();total+=s[0]**2+s[1]**2;difference+=(s[0]-s[1])**2;}
 assert.ok(total>.1);assert.ok(difference/total>.00001,'stereo chorus must affect channel difference');
});

test('extreme controls stay finite, volume mutes smoothly, panic is immediate',()=>{
 for(const rate of [8000,44100,48000]){
  const p=toneProject();for(const [key,range] of Object.entries(WARM_PARAMS))p.params[key]=range[1];
  const m=new WarmMachine(rate,p);for(const n of [24,36,48,60,72,96])m.noteOn(n);
  for(let i=0;i<Math.round(rate*.35);i++){const s=m.sample();assert.ok(s.every(v=>Number.isFinite(v)&&Math.abs(v)<1));}
  m.setParam('volume',0);advance(m,rate);assert.ok(advance(m,1000)<1e-12);
  m.setParam('volume',80);m.noteOn(60);assert.ok(advance(m,rate)>.001);m.panic();for(let i=0;i<1000;i++)assert.deepEqual([...m.sample()],[0,0]);
 }
});

test('the eight-bar sequencer uses one fractional sample clock and project edits preserve transport',()=>{
 const rate=8000,p=toneProject();p.bpm=137;p.patterns[0][0]={notes:[60,64,67],velocity:.7,length:4};const m=new WarmMachine(rate,p);m.start();
 const seen=[];let prior='';
 for(let f=0;f<Math.ceil(rate*8*240/p.bpm);f++){
  m.sample();const key=`${m.bar}:${m.step}`;if(key!==prior){seen.push({frame:f,bar:m.bar,step:m.step});prior=key;}
 }
 assert.equal(seen.length,128);for(let i=0;i<seen.length;i++)assert.ok(Math.abs(seen[i].frame-i*rate*60/p.bpm/4)<=1,`step ${i}`);
 assert.equal(seen[0].bar,0);assert.equal(seen[0].step,0);assert.equal(seen.at(-1).bar,7);assert.equal(seen.at(-1).step,15);
 const state=m.snapshot(),updated=structuredClone(p);updated.bpm=90;updated.params.cutoff=900;m.setProject(updated);assert.equal(m.playing,true);assert.equal(m.bar,state.bar);assert.equal(m.step,state.step);
 m.stop();assert.equal(m.playing,false);advance(m,rate);assert.equal(active(m).length,0);
});

test('warm worklet records actual Float32 output after live controls and flushes on panic',async()=>{
 let Processor;globalThis.sampleRate=8000;globalThis.AudioWorkletProcessor=class{constructor(){this.messages=[];this.port={postMessage:data=>this.messages.push(structuredClone(data))};}};
 globalThis.registerProcessor=(name,p)=>{assert.equal(name,'small-warm');Processor=p;};await import('../dist/warm-worklet.mjs');
 const w=new Processor(),send=data=>w.port.onmessage({data}),heard=[];
 send({type:'load',data:freshWarm()});send({type:'play'});send({type:'record'});
 for(let block=0;block<120;block++){
  if(block===20)send({type:'param',key:'cutoff',value:1700});if(block===50)send({type:'param',key:'chorus',value:0});if(block===80)send({type:'on',note:76,velocity:.5});if(block===100)send({type:'off',note:76});
  const l=new Float32Array(128),r=new Float32Array(128);w.process([],[[l,r]]);for(let i=0;i<128;i++)heard.push(pcm(l[i]),pcm(r[i]));
 }
 send({type:'panic'});assert.equal(w.recording,false);
 const chunks=w.messages.filter(m=>m.type==='chunk').flatMap(m=>[...m.chunk]);assert.deepEqual(chunks,heard);const done=w.messages.find(m=>m.type==='recordDone');assert.equal(done.frames,15360);assert.equal(done.rate,8000);
 const l=new Float32Array(128),r=new Float32Array(128);w.process([],[[l,r]]);assert.ok(l.every(v=>v===0)&&r.every(v=>v===0));
 send({type:'load',data:{}});assert.ok(w.messages.some(m=>m.type==='error'));w.process([],[[l,r]]);assert.ok(l.every(v=>v===0)&&r.every(v=>v===0));
 // Exercise the complete cap with a silent stopped machine: no synthetic counter edits.
 w.messages=[];send({type:'record'});const bigL=new Float32Array(32768),bigR=new Float32Array(32768);
 for(let frames=0;frames<8000*300+32768;frames+=32768)w.process([],[[bigL,bigR]]);
 assert.equal(w.recording,false);assert.equal(w.messages.find(m=>m.type==='recordDone').frames,8000*300);
});

test('warm offline export contains eight complete bars, stereo PCM and a faded tail',async()=>{
 const messages=[];globalThis.self={postMessage:message=>messages.push(structuredClone(message))};await import('../dist/warm-render-worker.mjs');
 const p=freshWarm();p.bpm=220;self.onmessage({data:{data:p,bars:8}});assert.ok(!messages.some(m=>m.type==='error'));
 const done=messages.at(-1),chunks=messages.filter(m=>m.type==='chunk').map(m=>m.chunk);assert.equal(done.type,'done');assert.equal(done.rate,44100);assert.equal(done.frames,Math.ceil(8*240/220*44100)+4*44100);assert.equal(chunks.reduce((n,c)=>n+c.length,0),done.frames*2);assert.equal(chunks.at(-1).at(-1),0);assert.ok(done.peak>0&&done.peak<1);
 const reference=new WarmMachine(44100,p);reference.start();const head=chunks[0];for(let f=0;f<Math.min(2000,head.length/2);f++){const s=reference.sample();assert.equal(head[f*2],pcm(s[0]));assert.equal(head[f*2+1],pcm(s[1]));}
});
