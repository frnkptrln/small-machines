import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SAMPLE_BANK,SAMPLE_ADDRESSES,PaulaMachine,freshPaula,validatePaula,assignSample,pcmTo8SVX} from '../dist/paula.mjs';
import {findSamples} from '../dist/sound-bank.mjs';
import {previewPCM} from '../dist/sample-preview.mjs';
import {SID_INSTRUMENTS,applyInstrument,identifyInstrument} from '../dist/sid-instruments.mjs';
import {Machine,freshProject,validateProject} from '../dist/machine.mjs';
const digest=pcm=>createHash('sha256').update(pcm).digest('hex');

test('30 distinct, deterministic PCM sounds have valid metadata, tails and bounded levels',async()=>{
 assert.equal(SAMPLE_BANK.length,30);assert.equal(new Set(SAMPLE_BANK.map(s=>s.id)).size,30);assert.equal(new Set(SAMPLE_BANK.map(s=>digest(s.pcm))).size,30);
 const regenerated=await import('../dist/sound-bank.mjs?determinism');
 for(const s of SAMPLE_BANK){assert.ok(s.pcm instanceof Int8Array);assert.equal(s.pcm.length%2,0);assert.ok(s.pcm.length<=32768);assert.ok(s.rate>=8000&&s.rate<=28000);assert.ok(s.description&&s.category);assert.ok(s.pcm.reduce((n,x)=>n+x*x,0)/s.pcm.length>10);}
 for(const s of regenerated.EXTRA_SAMPLES){const original=SAMPLE_BANK.find(x=>x.id===s.id);assert.equal(digest(s.pcm),digest(original.pcm));if(!s.loop){assert.equal(Math.abs(s.pcm[0]),0);assert.equal(Math.abs(s.pcm.at(-1)),0);}}
});

test('expanded bank fits 512 KiB without overlap and preserves legacy/custom addresses',()=>{
 const p=freshPaula();for(let i=0;i<4;i++)p.custom[i]={name:'Full slot '+i,root:60,rate:16000,pcm:Array(32768).fill(31+i)};
 const m=new PaulaMachine(44100,p),ranges=[];
 for(let i=0;i<SAMPLE_BANK.length;i++){const s=SAMPLE_BANK[i],a=SAMPLE_ADDRESSES.get(s.id);if(i<6)assert.equal(a,0x10000+i*32768);assert.equal(a%2,0);assert.ok(a+s.pcm.length<=m.mem.length);assert.deepEqual(new Int8Array(m.mem.slice(a,a+s.pcm.length).buffer),s.pcm);ranges.push([a,a+s.pcm.length]);}
 for(let i=0;i<4;i++){const a=m.bank.get('custom'+i).address;assert.equal(a,0x40000+i*32768);assert.ok(m.mem.slice(a,a+32768).every(n=>n===31+i));ranges.push([a,a+32768]);}
 ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)assert.ok(ranges[i-1][1]<=ranges[i][0]);
});

test('every bank sound plays through real 68K writes and exports the correct 8SVX bytes',()=>{
 const p=freshPaula(3),m=new PaulaMachine(22050,p);
 for(const s of SAMPLE_BANK){assignSample(p,0,s.id);m.setProject(p);m.noteOn(0,s.root);let energy=0;for(let i=0;i<11025;i++){const out=m.sample();assert.ok(out.every(x=>Number.isFinite(x)&&Math.abs(x)<1));energy+=out[0]**2+out[1]**2;}assert.ok(energy>.001,s.name);assert.equal(m.paula.channels[0].pointer,SAMPLE_ADDRESSES.get(s.id));m.noteOff(0);const data=pcmTo8SVX(s),view=new DataView(data);assert.equal(view.getUint32(44),s.pcm.length);assert.deepEqual(new Int8Array(data,48,s.pcm.length),s.pcm);}
});

test('sample assignment changes only sample and recommended loop; sets survive JSON roundtrip',()=>{
 const p=freshPaula(),before=structuredClone(p);p.channels[1].mute=true;assignSample(p,1,'organ');assert.equal(p.channels[1].loop,true);assert.equal(p.channels[1].mute,true);assert.equal(p.channels[1].volume,before.channels[1].volume);assert.deepEqual(p.patterns,before.patterns);assert.equal(p.source,before.source);assert.deepEqual(p.channels[0],before.channels[0]);assignSample(p,1,'clap');assert.equal(p.channels[1].loop,false);
 p.custom[0]={name:'Custom',rate:16000,root:60,pcm:[127,-128]};assignSample(p,1,'custom0');assert.equal(p.channels[1].sample,'custom0');assert.throws(()=>assignSample(p,4,'kick'));assert.throws(()=>assignSample(p,0,'missing'));assert.doesNotThrow(()=>validatePaula(JSON.parse(JSON.stringify(p))));
});

test('catalog searches multiple words, descriptions and categories including custom sounds',()=>{
 assert.equal(findSamples(SAMPLE_BANK,'').length,30);assert.ok(findSamples(SAMPLE_BANK,'BASS').length>=4);assert.deepEqual(findSamples(SAMPLE_BANK,'weicher fm').map(s=>s.id),['epiano']);assert.equal(findSamples(SAMPLE_BANK,'kick','Flächen').length,0);assert.ok(findSamples(SAMPLE_BANK,'','Drums').length>=10);assert.equal(findSamples(SAMPLE_BANK,'qwerty123').length,0);const custom={name:'Meine Stimme',id:'custom0',category:'Eigene'};assert.deepEqual(findSamples([...SAMPLE_BANK,custom],'stimme','Eigene'),[custom]);
});

test('audition is bounded at multiple output rates, fades at both ends and loops cycles',()=>{
 for(const s of SAMPLE_BANK)for(const rate of [8000,44100,48000]){const pcm=previewPCM(s,rate);assert.ok(pcm.length<=rate*2);assert.ok(pcm.every(x=>Number.isFinite(x)&&Math.abs(x)<=.24));assert.equal(Math.abs(pcm[0]),0);assert.equal(Math.abs(pcm.at(-1)),0);assert.ok(pcm.some(x=>Math.abs(x)>.01));if(s.loop){assert.equal(pcm.length,Math.ceil(.9*rate));assert.ok(pcm.slice(Math.floor(pcm.length/2)).some(x=>Math.abs(x)>.01));}}
});

test('all 16 SID patches play, preserve patterns/code/mute and become custom after editing',()=>{
 assert.equal(SID_INSTRUMENTS.length,16);
 for(const patch of SID_INSTRUMENTS){const p=freshProject(3),before=structuredClone(p);p.voices[0].mute=true;applyInstrument(p,0,patch.id);assert.equal(p.voices[0].mute,true);assert.deepEqual(p.patterns,before.patterns);assert.equal(p.source,before.source);assert.equal(p.cutoff,before.cutoff);assert.deepEqual(p.voices[1],before.voices[1]);assert.equal(identifyInstrument(p.voices[0]),patch.id);p.voices[0].mute=false;validateProject(p);const m=new Machine(8000,p);m.noteOn(0,patch.category==='Bässe'?36:60);let energy=0;for(let i=0;i<16000;i++){const x=m.sample();assert.ok(Number.isFinite(x)&&Math.abs(x)<=1);energy+=x*x;}assert.ok(energy>.01,patch.name);p.voices[0].pw+=.125;assert.equal(identifyInstrument(p.voices[0]),'');}
 assert.throws(()=>applyInstrument(freshProject(),0,'unknown'));
});
