// Deterministic video timing from the archived scores, never from audio analysis.
// node generate-cues.mjs --engine-dir /absolute/path/to/studio/dist
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url));
const idx=process.argv.indexOf('--engine-dir');
if(idx>=0&&!process.argv[idx+1])throw Error('--engine-dir requires a path');
const engineDir=idx>=0?resolve(process.argv[idx+1]):resolve(root,'../dist');
const input=join(root,'Originale'),output=join(root,'Cues');mkdirSync(output,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const json=(p,v)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const csv=(p,rows,cols)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,cols.join(',')+'\n'+rows.map(r=>cols.map(c=>{const v=r[c]??'';return '"'+String(typeof v==='object'?JSON.stringify(v):v).replaceAll('"','""')+'"';}).join(',')).join('\n')+'\n');};
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const rate=44100,sourceVersion=read(join(input,'SM001-003/engine-version.json'));
const engineChecks=Object.fromEntries(Object.entries(sourceVersion.files).map(([name,expected])=>[name,{expected,actual:sha(join(engineDir,name))}]));
for(const [name,c] of Object.entries(engineChecks))assert.equal(c.actual,c.expected,`Album engine mismatch: ${name}`);
const albumOffsets=new Map(),albums=[];
for(const n of readdirSync(join(input,'SM001-003/Album-Offsets')).sort()){
 const tracks=read(join(input,'SM001-003/Album-Offsets',n));let total=0;
 const out=tracks.map(t=>{const frame=Math.round(t.start_seconds*rate),frames=Math.round(t.seconds*rate);assert.equal(frame,total);total+=frames;const x={album:n.slice(0,5),track:t.number,id:t.id,title:t.title,start_frame:frame,start_seconds:frame/rate,frames,seconds:frames/rate};albumOffsets.set(t.id,x);return x;});
 albums.push({id:n.slice(0,5),sample_rate:rate,frames:total,seconds:total/rate,tracks:out});
}
json(join(output,'Alben-Trackpositionen.json'),albums);
csv(join(output,'Alben-Trackpositionen.csv'),albums.flatMap(a=>a.tracks),['album','track','id','title','start_frame','start_seconds','frames','seconds']);
const tracks=[];
for(const filename of readdirSync(join(input,'SM001-003/scores')).filter(n=>n.endsWith('.json')).sort()){
 const score=read(join(input,'SM001-003/scores',filename));const album=albumOffsets.get(score.id);assert(album);
 const stepSeconds=60/score.bpm/4;
 const swingAt=step=>{const whole=Math.floor(step),part=step-whole;return whole+part+((whole%2===0?part:1-part)*score.swing);};
 const atFrame=step=>Math.round(swingAt(step)*stepSeconds*rate);
 const frames=Math.ceil((score.bars*16*stepSeconds+score.tail)*rate),musicEnd=Math.round(score.bars*16*stepSeconds*rate);
 const render=read(join(input,'SM001-003/verification',score.id+'-render.json'));
 assert.equal(Math.round(render.seconds*rate),frames);assert.equal(album.frames,frames);
 const sectionAt=at=>score.sections.find(s=>at/16>=s.start&&at/16<s.end)?.name??'Ausklang';
 const queue=score.events.map(e=>({...e,frame:atFrame(e.at)}));
 for(const e of score.events)if(e.gate!==undefined)queue.push({type:e.type==='sid'?'sidOff':'paulaOff',voice:e.voice,id:e.id,at:e.at+e.gate,frame:atFrame(e.at+e.gate)});
 queue.sort((a,b)=>a.frame-b.frame||((a.type.endsWith('Off')?0:1)-(b.type.endsWith('Off')?0:1)));
 const live={sid:[-1,-1,-1],paula:[-1,-1,-1,-1]},events=[];
 for(const e of queue){
  if(e.frame>=frames)continue;
  const off=e.type.endsWith('Off'),engine=off?e.type.slice(0,-3):e.type;
  const applied=off?live[engine][e.voice]===e.id:true;
  const previous=!off&&engine!=='tone'?live[engine][e.voice]:null;
  if(!off&&engine!=='tone')live[engine][e.voice]=e.id;
  // The renderer does not clear its live ID on gate release; preserve that rule.
  events.push({...e,command:off?'note_off':engine==='tone'?'filter_target':'note_on',engine:engine==='tone'?'shared':engine,applied,previous_event_id:previous,
   seconds:e.frame/rate,album_frame:album.start_frame+e.frame,album_seconds:(album.start_frame+e.frame)/rate,
   bar_1:Math.floor(e.at/16)+1,step_1:e.at%16+1,section:sectionAt(e.at)});
 }
 events.push({command:'music_stop',engine:'all',frame:musicEnd,seconds:musicEnd/rate,album_frame:album.start_frame+musicEnd,album_seconds:(album.start_frame+musicEnd)/rate,applied:true,section:'Ausklang'});
 events.sort((a,b)=>a.frame-b.frame);
 const sections=score.sections.map(s=>({name:s.name,start_bar_0:s.start,end_bar_0:s.end,start_frame:Math.round(s.start*16*stepSeconds*rate),end_frame:Math.round(s.end*16*stepSeconds*rate)})).map(s=>({...s,start_seconds:s.start_frame/rate,end_seconds:s.end_frame/rate,album_start_frame:album.start_frame+s.start_frame,album_start_seconds:(album.start_frame+s.start_frame)/rate}));
 sections.push({name:'Ausklang',start_frame:musicEnd,end_frame:frames,start_seconds:musicEnd/rate,end_seconds:frames/rate,album_start_frame:album.start_frame+musicEnd,album_start_seconds:(album.start_frame+musicEnd)/rate});
 const meta={format:'small-machines-video-cues',version:1,id:score.id,title:score.title,album:album.album,track:score.track,bpm:score.bpm,swing:score.swing,sample_rate:rate,frames,seconds:frames/rate,music_end_frame:musicEnd,album_start_frame:album.start_frame,source_score_sha256:sha(join(input,'SM001-003/scores',filename)),sections,events};
 const base=join(output,'SM001-003',score.id);json(base+'.json',meta);
 csv(base+'-Ereignisse.csv',events,['frame','seconds','album_frame','album_seconds','bar_1','step_1','section','command','engine','voice','note','sample','volume','gate','applied','id','previous_event_id','cutoff','paulaFilter','patch','sweep']);
 csv(base+'-Abschnitte.csv',sections,['name','start_frame','start_seconds','end_frame','end_seconds','album_start_frame','album_start_seconds','start_bar_0','end_bar_0']);
 assert.equal(events.filter(e=>e.command==='note_on').length,score.events.filter(e=>e.type!=='tone').length);
 tracks.push({id:score.id,title:score.title,frames,source_events:score.events.length,note_on_events:events.filter(e=>e.command==='note_on').length,gate_commands:events.filter(e=>e.command==='note_off').length,ignored_old_gate_commands:events.filter(e=>e.command==='note_off'&&!e.applied).length,sections:score.sections.length});
}
assert.equal(tracks.length,24);

// Execute the genuine engine's tick() method. Jump across spans between ticks;
// apply the exact sample() gate countdown ordering without rendering waveforms.
const {Ensemble}=await import(pathToFileURL(join(engineDir,'ensemble.mjs')));
const set=read(join(input,'Licht-im-Hinterhof/Licht-im-Hinterhof-Ensemble.json'));
const report=read(join(input,'Licht-im-Hinterhof/render-report.json'));
const ens=new Ensemble(rate,set),commands=[],ticks=[];let frame=0,currentTick=null;
const push=(command,engine,data={})=>commands.push({frame,seconds:frame/rate,command,engine,...(currentTick??{}),...data});
for(const key of ['sid','paula','acid']){
 const machine=ens[key],on=machine.noteOn.bind(machine),off=machine.noteOff.bind(machine),stop=machine.stop.bind(machine);
 machine.noteOn=(...a)=>{if(key==='acid')push('note_on',key,{note:a[0],accent:a[1],legato:a[2]});else push('note_on',key,{voice:a[0],note:a[1],...(key==='paula'?{sample:machine.project.channels[a[0]].sample,volume:machine.project.channels[a[0]].volume}: {})});return on(...a);};
 machine.noteOff=(...a)=>{push('note_off',key,key==='acid'?{}:{voice:a[0]});return off(...a);};
 machine.stop=(...a)=>{push('engine_stop',key);return stop(...a);};
}
const drumTrigger=ens.drums.trigger.bind(ens.drums);ens.drums.trigger=(voice,velocity)=>{push('drum_trigger','drums',{voice,velocity});return drumTrigger(voice,velocity);};
const acidParam=ens.acid.setParam.bind(ens.acid);ens.acid.setParam=(key,value)=>{if(key==='cutoff')push('filter_target','acid',{key,value});return acidParam(key,value);};
ens.start(true);
let tickIndex=0;
while(ens.playing){
 const before=commands.length;
 currentTick=null;ens.tick();
 if(!ens.playing){push('music_stop','all');break;}
 const scene=set.scenes[ens.sceneIndex];
 currentTick={scene_index_0:ens.sceneIndex,scene:scene.name,scene_bar_1:ens.sceneBar+1,global_bar_1:ens.totalBars,step_1:ens.stepIndex+1,pattern_bar_1:ens.sceneBar%8+1,tick_index_0:tickIndex};
 // tick() calls engines before we can read its new position; attach it now.
 for(let i=before;i<commands.length;i++)Object.assign(commands[i],currentTick);
 ticks.push({frame,seconds:frame/rate,...currentTick});tickIndex++;
 const gap=Math.ceil(ens.remaining);
 for(let i=0;i<8;i++)if(ens.gates[i]>=0){
  if(ens.gates[i]<=gap){const tickFrame=frame;frame+=Math.max(0,Math.ceil(ens.gates[i])-1);ens.gates[i]=-1;if(i<3)ens.sid.noteOff(i);else if(i<7)ens.paula.noteOff(i-3);else ens.acid.noteOff();frame=tickFrame;}
  else ens.gates[i]-=gap;
 }
 frame+=gap;ens.frames+=gap;ens.remaining-=gap;
}
assert.equal(tickIndex,480*16);assert.equal(frame,900*rate);
assert.deepEqual(ens.sceneChanges.map(x=>({scene:x.scene,frame:x.frame})),report.sceneChanges.map(x=>({scene:x.scene,frame:x.frame})));
commands.sort((a,b)=>a.frame-b.frame);
const scenes=report.sceneChanges.map((s,i)=>({...s,start_frame:s.frame,start_seconds:s.frame/rate,end_frame:i+1<report.sceneChanges.length?report.sceneChanges[i+1].frame:frame,end_seconds:(i+1<report.sceneChanges.length?report.sceneChanges[i+1].frame:frame)/rate,bars:set.scenes[i].bars}));
scenes.push({name:'Ausklang',start_frame:frame,start_seconds:frame/rate,end_frame:Math.round(report.seconds*rate),end_seconds:report.seconds});
const light={format:'small-machines-video-cues',version:1,id:'LICHT-01',title:set.name,sample_rate:rate,bpm:set.bpm,frames:Math.round(report.seconds*rate),seconds:report.seconds,music_end_frame:frame,source_set_sha256:sha(join(input,'Licht-im-Hinterhof/Licht-im-Hinterhof-Ensemble.json')),source_engine_sha256:sha(join(engineDir,'ensemble.mjs')),scenes,events:commands};
json(join(output,'Licht-im-Hinterhof/Ereignisse.json'),light);
csv(join(output,'Licht-im-Hinterhof/Ereignisse.csv'),commands,['frame','seconds','scene_index_0','scene','scene_bar_1','global_bar_1','step_1','pattern_bar_1','command','engine','voice','note','sample','volume','velocity','accent','legato','key','value']);
csv(join(output,'Licht-im-Hinterhof/Taktraster.csv'),ticks,['frame','seconds','scene_index_0','scene','scene_bar_1','global_bar_1','step_1','pattern_bar_1','tick_index_0']);
csv(join(output,'Licht-im-Hinterhof/Szenen.csv'),scenes,['name','start_frame','start_seconds','end_frame','end_seconds','bars']);
const verification={generated_from:'archived original scores + current source engine tick, not audio inference',sample_rate:rate,album_engine_hash_checks:engineChecks,album_tracks:tracks,albums:albums.map(({tracks,...rest})=>rest),light:{scenes:8,ticks:tickIndex,commands:commands.length,music_end_frame:frame,total_frames:light.frames,scene_frames_match_original_render_report:true,engine_tick_executed:true,counts:Object.fromEntries(['note_on','note_off','drum_trigger','filter_target','engine_stop','music_stop'].map(c=>[c,commands.filter(e=>e.command===c).length]))},limitations:['Trigger/parameter/gate timing, not measured acoustic note duration or output amplitude.','PCM origin frame 0; compressed audio must be decoded gaplessly before frame alignment.','Waveform-dependent effects, envelopes, delay/reverb, SID sweeps/vibrato are not sampled in this cue export.','Browser live fader/scene improvisation is not part of the archived studio recording.']};
json(join(output,'Pruefbericht.json'),verification);
console.log(JSON.stringify({album_tracks:tracks.length,light:verification.light},null,2));
