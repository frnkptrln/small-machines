import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {installCleanPaula} from './clean-paula.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {Paula}=await import(pathToFileURL(resolve(process.env.SMALL_MACHINES_ENGINE,'paula.mjs')));
const mem=new Uint8Array(524288);mem.fill(100,0x10000,0x10100);
const p=new Paula(44100,mem);const check=installCleanPaula(p);
p.channels[0].pointer=0x10000;p.channels[0].length=256;p.channels[0].volume=64;p.channels[0].loop=true;
p.write(0xdff096,0x8201);for(let i=0;i<1000;i++)p.sample();const before=p.out[0];
p.write(0xdff096,1);p.sample();const boundary=Math.abs(p.out[0]-before);assert(boundary<1e-12);
for(let i=0;i<200;i++)p.sample();assert.equal(p.out[0],0);assert.equal(p.out[1],0);assert.equal(p.channels[0].active,false);
const scores=readdirSync(resolve(root,'scores')).filter(x=>x.endsWith('.json')).map(x=>JSON.parse(readFileSync(resolve(root,'scores',x))));assert.equal(scores.length,24);
const report={stopBoundaryJump:boundary,settlesToSilence:true,albums:{}};
for(const engine of ['sid','paula','duo']){const songs=scores.filter(s=>s.engine===engine);assert.equal(songs.length,8);assert.deepEqual(songs.map(s=>s.track).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);
 for(const s of songs){for(const e of s.events){assert(e.at>=0&&e.at<s.bars*16);if(e.type==='tone')continue;assert(e.voice>=0&&e.voice<(e.type==='sid'?3:4));assert(Number.isFinite(e.note));if(engine!=='duo')assert.equal(e.type,engine);}if(engine==='duo'){assert(s.events.some(e=>e.type==='sid'));assert(s.events.some(e=>e.type==='paula'));}}
 report.albums[engine]={tracks:songs.length,new:songs.filter(s=>s.origin==='new composition').length,seconds:songs.reduce((a,s)=>a+s.bars*240/s.bpm+s.tail,0)};
}
writeFileSync(resolve(root,'verification/composition-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
