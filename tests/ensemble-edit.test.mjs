import test from 'node:test';
import assert from 'node:assert/strict';
import {renameSet,copyScene,pasteScene} from '../dist/ensemble-edit.mjs';
import {Ensemble,validateEnsemble} from '../dist/ensemble.mjs';
import {freshEnsemble} from '../dist/ensemble-score.mjs';
import {freshWarmEnsemble} from '../dist/warm-ensemble.mjs';

function customSet(){
 const data=freshWarmEnsemble(),scene=data.scenes[2];
 scene.name='Kleine Maschine mit eigenem Sample';
 scene.evolution=false;
 scene.paula.custom[0]={name:'Fensterklang',rate:16000,root:60,pcm:[-128,-48,0,63,127,42,0,-37]};
 scene.paula.channels[0]={sample:'custom0',volume:31,loop:true,mute:false};
 scene.patterns[0].paula[0][0]=60;
 scene.patterns[0].warm[0]={notes:[50,57,65],velocity:.63,length:14};
 scene.warm.params.cutoff=1430;
 scene.drums.voices[0].tune=3;
 scene.patterns[3].drums[7][9]=.6;
 return validateEnsemble(data);
}

test('renaming changes only the trimmed title and leaves a fully independent set',()=>{
 const original=customSet(),before=structuredClone(original);
 const renamed=renameSet(original,'  Ein neues Fenster  ');
 assert.equal(renamed.name,'Ein neues Fenster');
 assert.deepEqual({...renamed,name:original.name},original);
 assert.deepEqual(original,before);
 renamed.scenes[2].paula.custom[0].pcm[0]=0;
 renamed.scenes[2].patterns[0].warm[0].notes[0]=48;
 renamed.mutes.sid=true;
 assert.deepEqual(original,before);
 assert.equal(renameSet(original,'x'.repeat(100)).name.length,100);
 assert.equal(renameSet(freshEnsemble(),'Quartett').version,1);
});

test('copy and paste retain the complete scene, samples and patches without aliases',()=>{
 const original=customSet(),before=structuredClone(original),clipboard=copyScene(original,2);
 assert.deepEqual(clipboard,original.scenes[2]);
 const pasted=pasteScene(original,6,clipboard);
 assert.deepEqual(pasted.scenes[6],before.scenes[2]);
 assert.deepEqual({...pasted,scenes:original.scenes},original);
 for(const index of [0,1,2,3,4,5,7])assert.deepEqual(pasted.scenes[index],original.scenes[index]);
 const restored=JSON.parse(JSON.stringify(pasted));
 assert.deepEqual(validateEnsemble(restored),pasted);
 pasted.scenes[6].paula.custom[0].pcm[0]=0;
 pasted.scenes[6].patterns[0].warm[0].notes[0]=48;
 pasted.scenes[6].sid.voices[0].attack=4;
 assert.deepEqual(original,before);
 assert.deepEqual(clipboard,before.scenes[2]);
 assert.deepEqual(pasted.scenes[2],before.scenes[2]);
 clipboard.patterns[3].drums[7][9]=0;
 assert.equal(pasted.scenes[6].patterns[3].drums[7][9],.6);
});

test('a pasted scene produces the same stereo samples as its source',()=>{
 const original=customSet(),pasted=pasteScene(original,6,copyScene(original,2));
 const source=new Ensemble(8000,original),destination=new Ensemble(8000,pasted);
 source.queue(2);destination.queue(6);source.start(false);destination.start(false);
 let energy=0;
 for(let frame=0;frame<16000;frame++){
  const expected=[...source.sample()],actual=[...destination.sample()];
  assert.deepEqual(actual,expected,`sample ${frame}`);
  energy+=actual[0]**2+actual[1]**2;
 }
 assert.ok(energy>0);
 assert.equal(source.error,null);assert.equal(destination.error,null);
});

test('a clipboard can be pasted repeatedly and the replaced scene can be restored',()=>{
 const original=customSet(),clipboard=copyScene(original,2),previous=copyScene(original,7);
 const first=pasteScene(original,7,clipboard),second=pasteScene(first,0,clipboard);
 assert.deepEqual(second.scenes[0],second.scenes[7]);
 second.scenes[0].patterns[0].warm[0].notes[0]=48;
 assert.equal(second.scenes[7].patterns[0].warm[0].notes[0],50);
 assert.equal(clipboard.patterns[0].warm[0].notes[0],50);
 assert.deepEqual(pasteScene(first,7,previous),original);
 assert.deepEqual(pasteScene(original,2,clipboard),original);
});

test('quartet scenes migrate with silent WARM while preserving all four original lanes',()=>{
 const legacy=freshEnsemble(),before=structuredClone(legacy),clipboard=copyScene(legacy,3);
 const pasted=pasteScene(legacy,0,clipboard);
 assert.equal(pasted.version,2);
 assert.deepEqual(legacy,before);
 assert.deepEqual(clipboard,before.scenes[3]);
 assert.equal(pasted.levels.warm,1);assert.equal(pasted.mutes.warm,false);
 for(const scene of pasted.scenes){
  assert.equal(scene.levels.warm,0);
  assert.ok(scene.warm.patterns.every(bar=>bar.every(event=>event===null)));
  assert.ok(scene.patterns.every(bar=>bar.warm.every(event=>event===null)));
 }
 const scene=pasted.scenes[0];
 for(const key of ['name','bars','sid','paula','acid','drums','evolution'])assert.deepEqual(scene[key],clipboard[key]);
 for(let bar=0;bar<8;bar++)for(const deck of ['sid','paula','acid','drums'])assert.deepEqual(scene.patterns[bar][deck],clipboard.patterns[bar][deck]);
 assert.doesNotThrow(()=>validateEnsemble(JSON.parse(JSON.stringify(pasted))));
 const quintet=pasteScene(freshWarmEnsemble(),7,clipboard);
 assert.equal(quintet.scenes[7].levels.warm,0);
 assert.ok(quintet.scenes[7].patterns.every(bar=>bar.warm.every(event=>event===null)));
 const warmIntoLegacy=pasteScene(legacy,7,copyScene(customSet(),2));
 assert.deepEqual(warmIntoLegacy.scenes[7].patterns[0].warm[0],{notes:[50,57,65],velocity:.63,length:14});
});

test('invalid names, indexes, sets and clipboard data fail without changing the inputs',()=>{
 const data=customSet(),before=structuredClone(data),scene=copyScene(data,2);
 for(const name of ['', ' \n\t ', 'x'.repeat(101), null, undefined, 42])assert.throws(()=>renameSet(data,name));
 for(const index of [-1,8,.5,NaN,Infinity,'0',null,undefined]){
  assert.throws(()=>copyScene(data,index));
  assert.throws(()=>pasteScene(data,index,scene));
 }
 for(const invalid of [null,{}, {...data,version:3}, {...data,bpm:NaN}]){
  assert.throws(()=>renameSet(invalid,'Valid title'));
  assert.throws(()=>copyScene(invalid,0));
  assert.throws(()=>pasteScene(invalid,0,scene));
 }
 for(const mutate of [
  s=>s.paula.custom[0].pcm[0]=256,
  s=>s.patterns[0].warm[0].notes=[50,50],
  s=>s.patterns[0].drums[0][0]=-1,
  s=>s.bars=0
 ]){
  const invalid=structuredClone(scene);mutate(invalid);
  assert.throws(()=>pasteScene(data,7,invalid));
 }
 assert.throws(()=>pasteScene(data,7,null));
 assert.deepEqual(data,before);
 assert.deepEqual(scene,before.scenes[2]);
});
