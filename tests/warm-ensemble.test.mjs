import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Ensemble,validateEnsemble,toPCM} from '../dist/ensemble.mjs';
import {freshEnsemble,DECKS} from '../dist/ensemble-score.mjs';
import {freshWarmEnsemble,upgradeEnsemble,ENSEMBLE_DECKS} from '../dist/warm-ensemble.mjs';
import {freshWarm} from '../dist/warm.mjs';

function pcmHash(machine,frames){
 const bytes=Buffer.alloc(frames*4);
 for(let i=0;i<frames;i++){
  const s=machine.sample();
  bytes.writeInt16LE(toPCM(s[0]),i*4);bytes.writeInt16LE(toPCM(s[1]),i*4+2);
 }
 assert.equal(machine.error,null);
 return createHash('sha256').update(bytes).digest('hex');
}

test('v1 sets retain original PCM through five-deck migration and leave source data intact',()=>{
 const original=freshEnsemble(),before=JSON.stringify(original),upgraded=upgradeEnsemble(original);
 assert.equal(original.version,1);assert.equal(upgraded.version,2);
 assert.equal(DECKS.length,4);assert.deepEqual(ENSEMBLE_DECKS,[...DECKS,'warm']);
 assert.equal(JSON.stringify(original),before);
 assert.equal(upgraded.levels.warm,1);
 for(const s of upgraded.scenes){assert.equal(s.levels.warm,0);assert.ok(s.patterns.every(p=>p.warm.every(e=>e===null)));}
 // Independently captured from the shipped four-deck engine at commit
 // eaeee77d840553877a86706483899b8aed4ed063: 64,000 frames, 8 kHz, PCM16 stereo.
 const expected={
  0:'ac33da879c787214efbe7499e69e9d409a1c7012d729d691eab6cea4b46f577b',
  3:'b3bdd8d9a7a2134080912116d64ea7412fd115e1ab2bc547dbb77b36f41e8a8c',
  6:'28b884a2ff22c027119cab4563b21a43a65140eb7160fdd316bbac1d21213757'
 };
 for(const [scene,hash]of Object.entries(expected)){
  const m=new Ensemble(8000,original);m.queue(Number(scene));m.start(false);
  assert.equal(pcmHash(m,64000),hash,`legacy scene ${scene}`);
 }
 assert.equal(JSON.stringify(original),before);
});

test('v2 validates both warm project patterns and scene events before audio loading',()=>{
 const data=freshWarmEnsemble();
 assert.deepEqual(validateEnsemble(JSON.parse(JSON.stringify(data))),data);
 for(const mutate of [
  s=>delete s.scenes[0].warm,
  s=>s.scenes[0].warm.patterns=null,
  s=>s.scenes[0].warm.params.cutoff=NaN,
  s=>s.scenes[0].patterns[0].warm[0].notes=[60,60],
  s=>s.scenes[0].patterns[0].warm[0].length=33,
  s=>s.scenes[0].patterns[0].warm[0].velocity=-1,
  s=>s.scenes[0].patterns[0].warm.pop(),
  s=>s.scenes[0].levels.warm=1.1,
  s=>s.levels.warm=Infinity,
  s=>s.mutes.warm=0,
  s=>s.solo='unknown'
 ]){const invalid=structuredClone(data);mutate(invalid);assert.throws(()=>validateEnsemble(invalid));}
});

test('all five decks share the first sample and warm scene changes use the same bar boundary',()=>{
 const data=freshWarmEnsemble();data.bpm=120;data.scenes.forEach(s=>s.evolution=false);
 const row=data.scenes[0].patterns[0];
 row.sid[0][0]=60;row.paula[0][0]=72;row.acid[0]={note:38,accent:true,slide:false};row.drums[0][0]=1;
 row.warm[0]={notes:[50,57,65],velocity:.7,length:12};
 const m=new Ensemble(8000,data),events=[];
 for(const [deck,method]of [['sid','noteOn'],['paula','noteOn'],['acid','noteOn'],['drums','trigger'],['warm','trigger']]){
  const fn=m[deck][method].bind(m[deck]);
  m[deck][method]=(...args)=>{if(deck!=='warm'||args[0]!==null)events.push({deck,frame:m.frames});return fn(...args);};
 }
 m.start(false);m.sample();
 for(const deck of ENSEMBLE_DECKS)assert.ok(events.some(e=>e.deck===deck&&e.frame===0),deck);
 assert.equal(m.warm.playing,false);assert.equal(m.warm.frames,0);
 m.queue(4);
 for(let i=1;i<16000;i++)m.sample();
 assert.equal(m.sceneIndex,0);m.sample();
 assert.equal(m.sceneIndex,4);assert.equal(m.sceneChanges.at(-1).frame,16000);
 assert.ok(events.some(e=>e.deck==='warm'&&e.frame===16000));
 assert.equal(m.warm.project.bpm,120);
 m.setTempo(137);assert.equal(m.warm.project.bpm,137);assert.equal(m.warm.playing,false);
 assert.equal(m.snapshot().meters.length,5);
});

test('warm solo isolates the fifth deck, mute silences it, and Panic clears its chorus tail',()=>{
 const data=freshWarmEnsemble();data.scenes[0].evolution=false;data.solo='warm';
 const solo=new Ensemble(8000,data),isolatedData=structuredClone(data);
 isolatedData.solo=null;for(const d of DECKS)isolatedData.mutes[d]=true;
 const isolated=new Ensemble(8000,isolatedData);solo.start(false);isolated.start(false);
 let energy=0;
 for(let i=0;i<24000;i++){const a=solo.sample(),b=isolated.sample();assert.deepEqual(a,b);energy+=a[0]**2+a[1]**2;}
 assert.ok(energy>1);assert.equal(solo.error,null);
 solo.panic();assert.ok(solo.warm.voices.every(v=>v.stage==='off'));
 for(let i=0;i<4000;i++)assert.ok(solo.sample().every(x=>x===0));
 const silentData=structuredClone(isolatedData);silentData.mutes.warm=true;
 const silent=new Ensemble(8000,silentData);silent.start(false);
 for(let i=0;i<12000;i++)assert.ok(silent.sample().every(x=>x===0));
});

test('a warm project transfers all eight bars, survives JSON, and switches only on the next bar',()=>{
 const m=new Ensemble(8000,freshWarmEnsemble());m.setTempo(120);m.start(false);m.sample();
 const oldName=m.warm.project.name,scene=structuredClone(m.data.scenes[0]),project=freshWarm(2);
 project.name='Imported eight-bar phrase';project.patterns[7][15]={notes:[60,64,71],velocity:.4,length:1.25};
 scene.warm=project;scene.patterns.forEach((p,i)=>p.warm=structuredClone(project.patterns[i]));
 m.replaceScene(0,scene);assert.equal(m.warm.project.name,oldName);
 const roundtrip=JSON.parse(JSON.stringify(m.data));assert.doesNotThrow(()=>validateEnsemble(roundtrip));
 assert.deepEqual(roundtrip.scenes[0].patterns[7].warm[15],project.patterns[7][15]);
 for(let i=1;i<=16000;i++)m.sample();
 assert.equal(m.warm.project.name,project.name);assert.equal(m.warm.project.bpm,120);
 assert.deepEqual(m.warm.project.patterns,project.patterns);assert.equal(m.warm.playing,false);
 assert.equal(m.error,null);
});
