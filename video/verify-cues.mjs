import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url));
const idx=process.argv.indexOf('--engine-dir');
if(idx>=0&&!process.argv[idx+1])throw Error('--engine-dir requires a path');
const engineDir=idx>=0?resolve(process.argv[idx+1]):resolve(root,'../dist');
const {Ensemble}=await import(pathToFileURL(join(engineDir,'ensemble.mjs')));
const set=JSON.parse(readFileSync(root+'/Originale/Licht-im-Hinterhof/Licht-im-Hinterhof-Ensemble.json'));
const cues=JSON.parse(readFileSync(root+'/Cues/Licht-im-Hinterhof/Ereignisse.json'));
const report=JSON.parse(readFileSync(root+'/Cues/Pruefbericht.json'));
const fields=['frame','command','engine','voice','note','sample','volume','velocity','accent','legato','key','value'];
const clean=o=>Object.fromEntries(fields.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const checks=[];
for(const [scene,bar] of [[0,0],[3,14],[7,48]]){
 const e=new Ensemble(44100,set);e.queue(scene);e.start(true);e.sceneBar=bar-1;e.stepIndex=15;
 const offset=cues.scenes[scene].start_frame+bar*1.875*44100;assert(Number.isInteger(offset));
 e.frames=offset;e.totalBars=Math.round(offset/44100/1.875);
 let frame=offset;const actual=[];
 const push=(command,engine,data={})=>actual.push({frame,command,engine,...data});
 for(const key of ['sid','paula','acid']){
  const m=e[key],on=m.noteOn.bind(m),off=m.noteOff.bind(m);
  m.noteOn=(...a)=>{push('note_on',key,key==='acid'?{note:a[0],accent:a[1],legato:a[2]}:{voice:a[0],note:a[1],...(key==='paula'?{sample:m.project.channels[a[0]].sample,volume:m.project.channels[a[0]].volume}:{})});return on(...a);};
  m.noteOff=(...a)=>{push('note_off',key,key==='acid'?{}:{voice:a[0]});return off(...a);};
 }
 const trigger=e.drums.trigger.bind(e.drums);e.drums.trigger=(voice,velocity)=>{push('drum_trigger','drums',{voice,velocity});return trigger(voice,velocity);};
 const param=e.acid.setParam.bind(e.acid);e.acid.setParam=(key,value)=>{if(key==='cutoff')push('filter_target','acid',{key,value});return param(key,value);};
 const frames=2*1.875*44100;
 for(let f=0;f<frames;f++){frame=offset+f;e.sample();if(e.error)throw Error(e.error);}
 let expected=cues.events.filter(x=>x.frame>=offset&&x.frame<offset+frames&&!['engine_stop','music_stop'].includes(x.command)).map(clean);
 // Starting a mid-set excerpt has no earlier held notes; only compare onset,
 // drum and filter commands there. The first scene checks all gate commands.
 let observed=actual.map(clean);
 if(bar>0){const keep=x=>x.command!=='note_off';expected=expected.filter(keep);observed=observed.filter(keep);}
 assert.deepEqual(observed,expected);
 checks.push({scene,scene_name:set.scenes[scene].name,start_bar_0:bar,frames,matched_commands:expected.length,actual_audio_engine_sample_loop:true});
}
report.light.audio_engine_spot_checks=checks;
writeFileSync(root+'/Cues/Pruefbericht.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(checks,null,2));
