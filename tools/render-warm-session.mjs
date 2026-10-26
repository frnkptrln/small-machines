// Usage: node tools/render-warm-session.mjs /absolute/output-directory [solo|visit|both]
import {openSync,writeSync,closeSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {WarmMachine,freshWarm} from '../dist/warm.mjs';
import {Ensemble} from '../dist/ensemble.mjs';
import {setSeconds} from '../dist/ensemble-score.mjs';
import {bernsteinScore,bernsteinProject,bernsteinVisit} from './warm-score.mjs';

const dir=resolve(process.argv[2]||'rendered-warm'),mode=process.argv[3]||'both',rate=44100;
mkdirSync(dir,{recursive:true});
function floatHeader(frames){const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+frames*8,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(3,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*8,28);h.writeUInt16LE(8,32);h.writeUInt16LE(32,34);h.write('data',36);h.writeUInt32LE(frames*8,40);return h;}
function render(stem,title,musicSeconds,tailSeconds,next,extra){
 const frames=Math.round((musicSeconds+tailSeconds)*rate),fd=openSync(resolve(dir,stem+'-raw.wav'),'w');writeSync(fd,floatHeader(frames));let peak=0,clipped=0,energy=0,secondEnergy=0;const rmsBySecond=[];
 for(let done=0;done<frames;){const count=Math.min(16384,frames-done),block=new Float32Array(count*2);
  for(let i=0;i<count;i++){const frame=done+i,a=next(frame),edge=Math.min(1,frame/(rate*.04),(frames-1-frame)/(rate*.5));for(let ch=0;ch<2;ch++){const x=a[ch]*edge;if(!Number.isFinite(x))throw Error(title+': nonfinite signal');peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>=1)clipped++;energy+=x*x*.5;secondEnergy+=x*x*.5;block[i*2+ch]=x;}if((frame+1)%rate===0){rmsBySecond.push(Math.sqrt(secondEnergy/rate));secondEnergy=0;}}
  writeSync(fd,Buffer.from(block.buffer));done+=count;
 }closeSync(fd);if(clipped||peak<.01)throw Error(title+': invalid audio');
 const report={title,sampleRate:rate,musicSeconds,tailSeconds,seconds:frames/rate,frames,peak,clippedSamples:clipped,rms:Math.sqrt(energy/frames),rmsBySecond,...extra()};writeFileSync(resolve(dir,stem+'-render-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rmsBySecond:undefined}));
}

if(mode==='solo'||mode==='both'){
 const score=bernsteinScore(),project=freshWarm(),machine=new WarmMachine(rate,project),stepFrames=rate*60/score.bpm/4,musicSeconds=score.bars*240/score.bpm;let ordinal=0,section=-1,stopped=false,renderedEvents=0,maxVoices=0;
 writeFileSync(resolve(dir,'Bernsteinfenster-Partitur.json'),JSON.stringify(score,null,2)+'\n');
 writeFileSync(resolve(dir,'Bernsteinfenster-WARM06.json'),JSON.stringify(bernsteinProject(),null,2)+'\n');
 render('bernsteinfenster',score.title,musicSeconds,score.tailSeconds,frame=>{
  while(ordinal<score.bars*16&&frame>=Math.round(ordinal*stepFrames)){
   const bar=Math.floor(ordinal/16),step=ordinal%16,row=score.score[bar];
   if(row.section!==section){section=row.section;machine.allNotesOff();machine.setProject({...project,name:score.sections[section].name,bpm:score.bpm,params:score.sections[section].params});}
   if(step===0)machine.setParam('cutoff',row.cutoff);
   const event=row.events[step];if(event){machine.trigger(event,stepFrames);renderedEvents++;}ordinal++;
  }
  if(!stopped&&frame>=Math.round(musicSeconds*rate)){machine.stop();stopped=true;}
  const sample=machine.sample();if(machine.error)throw Error(machine.error);
  if(frame%256===0)maxVoices=Math.max(maxVoices,machine.voices.filter(v=>v.stage!=='off').length);
  // The first chords arrive from silence. The last eight bars dim gradually.
  const t=frame/rate,gain=Math.min(1,t/4)*Math.min(1,Math.max(.16,(musicSeconds-t)/12));
  return [sample[0]*gain,sample[1]*gain];
 },()=>({bpm:score.bpm,bars:score.bars,renderedEvents,maxVoices,sections:score.sections.map(({params,...s})=>s)}));
}

if(mode==='visit'||mode==='both'){
 const set=bernsteinVisit(),engine=new Ensemble(rate,set),musicSeconds=setSeconds(set);engine.start(true);let stopped=false;
 writeFileSync(resolve(dir,'Bernsteinfenster-Besuch-Ensemble.json'),JSON.stringify(set,null,2)+'\n');
 render('bernsteinfenster-besuch','Bernsteinfenster · Besuch im Hinterhof',musicSeconds,4,frame=>{
  if(!stopped&&frame>=Math.ceil(musicSeconds*rate)){engine.stop();stopped=true;}
  const sample=engine.sample();if(engine.error)throw Error(engine.error);const t=frame/rate,gain=Math.min(1,t/2)*Math.min(1,Math.max(.12,(musicSeconds-t)/8));return [sample[0]*gain,sample[1]*gain];
 },()=>({bpm:set.bpm,bars:set.scenes.reduce((n,s)=>n+s.bars,0),sceneChanges:engine.sceneChanges.map(x=>({...x,name:set.scenes[x.scene].name,seconds:x.frame/rate})),instruments:['SID/65','PAULA/68','ACID/16','DRUM/08','WARM/06']}));
}
