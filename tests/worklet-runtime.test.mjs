import test from 'node:test';
import assert from 'node:assert/strict';
import {cloneData} from '../dist/clone-data.mjs';

test('plain project cloning works without structuredClone and does not normalize invalid values',()=>{
 const native=globalThis.structuredClone;
 try{
  delete globalThis.structuredClone;
  const source=JSON.parse('{"__proto__":{"sample":"own data"},"notes":[50,57,65]}');
  source.missing=undefined;source.invalid=NaN;source.unbounded=Infinity;source.negativeZero=-0;
  source.shared=source.notes;source.self=source;
  const result=cloneData(source);
  assert.equal(Object.getPrototypeOf(result),Object.prototype);
  assert.equal(Object.hasOwn(result,'__proto__'),true);
  assert.deepEqual(result.__proto__,{sample:'own data'});
  assert.equal(result.sample,undefined);
  assert.equal(Object.hasOwn(result,'missing'),true);
  assert.equal(result.missing,undefined);
  assert.ok(Number.isNaN(result.invalid));
  assert.equal(result.unbounded,Infinity);
  assert.ok(Object.is(result.negativeZero,-0));
  assert.equal(result.shared,result.notes);assert.equal(result.self,result);
  result.notes[0]=48;result.__proto__.sample='edited';
  assert.equal(source.notes[0],50);assert.equal(source.__proto__.sample,'own data');
  for(const value of [new Date(),new Map(),new Float32Array(2),()=>{},Symbol('unsupported')])assert.throws(()=>cloneData(value),TypeError);
  assert.equal(globalThis.structuredClone,undefined);
 }finally{globalThis.structuredClone=native;}
});

test('all real processor classes start and render the same audio when structuredClone is absent',async()=>{
 const names=['structuredClone','sampleRate','AudioWorkletProcessor','registerProcessor'];
 const descriptors=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const native=globalThis.structuredClone,processors=new Map();
 try{
  delete globalThis.structuredClone;
  globalThis.sampleRate=8000;
  globalThis.AudioWorkletProcessor=class{
   constructor(){this.messages=[];this.port={postMessage:message=>this.messages.push(message)};}
  };
  globalThis.registerProcessor=(name,processor)=>processors.set(name,processor);
  for(const module of ['worklet','rack-worklet','acid-worklet','warm-worklet','ensemble-worklet'])await import(`../dist/${module}.mjs`);
  assert.equal(processors.size,5);

  function render(Processor){
   const processor=new Processor();
   processor.port.onmessage({data:{type:'play',auto:false}});
   const samples=[];
   for(let block=0;block<64;block++){
    const channels=[new Float32Array(128),new Float32Array(128)];
    assert.equal(processor.process([], [channels]),true);
    for(let frame=0;frame<128;frame++)samples.push(channels[0][frame],channels[1][frame]);
   }
   assert.ok(samples.every(Number.isFinite));
   assert.ok(samples.some(value=>value!==0));
   assert.deepEqual(processor.messages.filter(message=>message.type==='error'),[]);
   for(const message of processor.messages)if(message.type==='state'&&message.state&&Object.hasOwn(message.state,'error'))assert.equal(message.state.error,null);
   return samples;
  }

  for(const [name,Processor]of processors){
   delete globalThis.structuredClone;
   const actual=render(Processor);
   globalThis.structuredClone=native;
   assert.deepEqual(actual,render(Processor),`${name}: native and worklet clone paths`);
  }

  delete globalThis.structuredClone;
  const {freshWarmEnsemble}=await import('../dist/warm-ensemble.mjs');
  const {validateEnsemble,toPCM}=await import('../dist/ensemble.mjs');
  const data=freshWarmEnsemble();data.bpm=220;
  const source=data.scenes[2];
  source.evolution=false;
  source.paula.custom[0]={name:'Worklet sample',rate:16000,root:60,pcm:[-128,127,0,0]};
  source.paula.channels[0].sample='custom0';
  source.patterns[0].paula[0][0]=60;
  const processor=new (processors.get('small-ensemble'))(),send=data=>processor.port.onmessage({data});
  send({type:'load',data});send({type:'queue',index:2});send({type:'play',auto:false});send({type:'record'});
  const replacement=cloneData(source);replacement.name='Szene im Worklet';replacement.warm.params.cutoff=1400;
  const heard=[];
  for(let block=0;block<160;block++){
   if(block===5)send({type:'scene',index:2,scene:replacement});
   if(block===20)send({type:'drumVoice',scene:2,voice:0,key:'tune',value:3});
   if(block===80){
    assert.equal(processor.engine.sceneIndex,2);
    assert.equal(processor.engine.sceneBar,0);
    assert.equal(processor.engine.warm.project.params.cutoff,1400);
    assert.equal(processor.engine.drums.project.voices[0].tune,3);
    assert.deepEqual([...processor.engine.paula.bank.get('custom0').pcm],[-128,127,0,0]);
    send({type:'queue',index:3});
   }
   const channels=[new Float32Array(128),new Float32Array(128)];
   processor.process([], [channels]);
   for(let frame=0;frame<128;frame++)heard.push(toPCM(channels[0][frame]),toPCM(channels[1][frame]));
  }
  send({type:'recordStop'});
  assert.equal(processor.engine.sceneIndex,3);
  assert.deepEqual(processor.messages.filter(message=>message.type==='error'),[]);
  assert.equal(processor.engine.error,null);
  assert.equal(processor.messages.find(message=>message.type==='recordDone').frames,20480);
  const recorded=processor.messages.filter(message=>message.type==='chunk').flatMap(message=>[...message.chunk]);
  assert.deepEqual(recorded,heard);
  assert.ok(recorded.some(value=>value!==0));
  assert.doesNotThrow(()=>validateEnsemble(processor.engine.data));
  const invalid=cloneData(data);invalid.bpm=NaN;
  assert.throws(()=>validateEnsemble(invalid));
  assert.equal(globalThis.structuredClone,undefined);
 }finally{
  for(const [name,descriptor]of descriptors){
   if(descriptor)Object.defineProperty(globalThis,name,descriptor);
   else delete globalThis[name];
  }
 }
});
