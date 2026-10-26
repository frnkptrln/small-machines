// Stream the exact factory ensemble through its shared clock, without a browser.
// Usage: node tools/render-ensemble.mjs /absolute/output/directory
import {Ensemble} from '../dist/ensemble.mjs';
import {freshEnsemble,setSeconds} from '../dist/ensemble-score.mjs';
import {openSync,writeSync,closeSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const dir=resolve(process.argv[2]||'rendered');mkdirSync(dir,{recursive:true});const data=freshEnsemble(),rate=44100,frames=Math.ceil((setSeconds(data)+4)*rate),engine=new Ensemble(rate,data);engine.start(true);
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+frames*8,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(3,20);header.writeUInt16LE(2,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*8,28);header.writeUInt16LE(8,32);header.writeUInt16LE(32,34);header.write('data',36);header.writeUInt32LE(frames*8,40);
const fd=openSync(resolve(dir,'licht-im-hinterhof-raw.wav'),'w');writeSync(fd,header);let rendered=0,peak=0,clipped=0,energy=0,secondEnergy=0;const rms=[],sceneEnergy=Array(8).fill(0),blockSize=16384;
while(rendered<frames){const count=Math.min(blockSize,frames-rendered),out=new Float32Array(count*2);for(let i=0;i<count;i++){const sample=engine.sample(),f=rendered+i,fade=Math.min(1,(frames-1-f)/(rate*.5));if(engine.error)throw Error(engine.error);for(let ch=0;ch<2;ch++){const x=sample[ch]*fade;out[i*2+ch]=x;if(!Number.isFinite(x))throw Error('Nonfinite audio');peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>=1)clipped++;energy+=x*x/2;secondEnergy+=x*x/2;sceneEnergy[engine.sceneIndex]+=x*x/2;}if((f+1)%rate===0){rms.push(Math.sqrt(secondEnergy/rate));secondEnergy=0;}}
 writeSync(fd,Buffer.from(out.buffer));rendered+=count; // all output is streamed, not retained
}
closeSync(fd);if(!engine.ended||clipped||sceneEnergy.some(e=>e<1))throw Error('Incomplete or invalid performance');
const report={title:data.name,seconds:frames/rate,bpm:data.bpm,bars:480,sampleRate:rate,peak,clippedSamples:clipped,rms:Math.sqrt(energy/frames),sceneChanges:engine.sceneChanges.map(c=>({...c,seconds:c.frame/rate,name:data.scenes[c.scene].name})),sceneEnergy,rmsBySecond:rms,sidInstructions:engine.sid.cpu.instructions,paulaInstructions:engine.paula.cpu.instructions};
writeFileSync(resolve(dir,'render-report.json'),JSON.stringify(report,null,2)+'\n');writeFileSync(resolve(dir,'Licht-im-Hinterhof-Ensemble.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({...report,rmsBySecond:undefined}));
