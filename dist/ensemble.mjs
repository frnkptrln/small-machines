import {Machine,validateProject} from './machine.mjs';
import {PaulaMachine,validatePaula} from './paula.mjs';
import {AcidMachine,validateAcid} from './acid.mjs';
import {DrumMachine,validateDrum} from './drum.mjs';
import {freshEnsemble,DECKS} from './ensemble-score.mjs';
import {smoothPaula} from './paula-smooth.mjs';
import {WarmMachine,validateWarm} from './warm.mjs';
import {ENSEMBLE_DECKS,upgradeEnsemble,warmScene} from './warm-ensemble.mjs';
const num=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
const notes=(rows,count)=>Array.isArray(rows)&&rows.length===count&&rows.every(r=>Array.isArray(r)&&r.length===16&&r.every(n=>n===null||Number.isInteger(n)&&n>=24&&n<=96));
export function validateScene(s){
 if(!s||typeof s.name!=='string'||s.name.length>80||!Number.isInteger(s.bars)||s.bars<4||s.bars>128||typeof s.evolution!=='boolean')throw Error('Ungültige Szene.');
 validateProject(s.sid);validatePaula(s.paula);validateAcid(s.acid);validateDrum(s.drums);
 if(!Array.isArray(s.patterns)||s.patterns.length!==8)throw Error('Acht Pattern-Takte erforderlich.');
 for(const p of s.patterns){if(!notes(p.sid,3)||!notes(p.paula,4))throw Error('Ungültige Melodie.');validateAcid({...s.acid,steps:p.acid});validateDrum({...s.drums,pattern:p.drums});}
 for(const d of DECKS)if(!num(s.levels?.[d],0,1))throw Error('Ungültiger Szenenpegel.');
 if(s.warm!==undefined){validateWarm(s.warm);validateWarm({...s.warm,patterns:s.patterns.map(p=>p.warm)});if(!num(s.levels.warm,0,1))throw Error('Ungültiger WARM-Pegel.');}return s;
}
export function validateEnsemble(s){
 if(!s||s.kind!=='small-ensemble'||![1,2].includes(s.version)||typeof s.name!=='string'||s.name.length>100||!num(s.bpm,40,220)||!num(s.master,0,1)||!num(s.filter,.2,4)||!Array.isArray(s.scenes)||s.scenes.length!==8)throw Error('Keine ENSEMBLE/04-Setdatei.');
 if(s.solo!==null&&!(s.version===2?ENSEMBLE_DECKS:DECKS).includes(s.solo))throw Error('Ungültiges Solo.');for(const d of DECKS)if(!num(s.levels?.[d],0,1)||typeof s.mutes?.[d]!=='boolean')throw Error('Ungültiger Mixer.');s.scenes.forEach(validateScene);if(s.version===2){if(!num(s.levels.warm,0,1)||typeof s.mutes.warm!=='boolean'||s.scenes.some(x=>!x.warm))throw Error('Unvollständiges Fünfer-Set.');}return s;
}
export class Ensemble{
 constructor(rate=44100,data=freshEnsemble()){
  data=upgradeEnsemble(validateEnsemble(data));this.rate=rate;this.data=data;this.playing=false;this.auto=false;this.sceneIndex=0;this.sceneBar=-1;this.stepIndex=-1;this.totalBars=0;this.frames=0;this.remaining=0;this.pending=null;this.gates=new Float64Array(8).fill(-1);this.tied=false;this.error=null;this.ended=false;this.mix=new Float64Array(2);this.meters=new Float64Array(5);this.gains=new Float64Array(5);this.master=data.master;this.duck=0;this.duckRelease=Math.exp(-1/(rate*.13));this.sceneChanges=[];this.audition=0;
  const s=this.data.scenes[0];this.sid=new Machine(rate,s.sid);this.paula=new PaulaMachine(rate,s.paula);this.clean=smoothPaula(this.paula.paula);this.acid=new AcidMachine(rate,s.acid);this.drums=new DrumMachine(rate,s.drums);this.warm=new WarmMachine(rate,s.warm);this.applyScene(0);
 }
 applyScene(index){const s=this.data.scenes[index];this.sid.stop();this.paula.stop();this.acid.stop();this.warm.stop();this.gates.fill(-1);this.tied=false;this.sceneIndex=index;this.sceneBar=-1;this.pending=null;
  this.sid.setProject({...s.sid,bpm:this.data.bpm});this.sid.load(s.sid.source);this.paula.setProject({...s.paula,bpm:this.data.bpm},true);this.paula.load(s.paula.source);this.acid.setProject({...s.acid,bpm:this.data.bpm});this.drums.project=structuredClone(s.drums);this.warm.setProject({...s.warm,bpm:this.data.bpm});
  this.sceneChanges.push({scene:index,frame:this.frames});if(this.sceneChanges.length>64)this.sceneChanges.shift();
 }
 queue(index){if(!Number.isInteger(index)||index<0||index>7)throw Error('Unknown scene');if(this.playing)this.pending=index;else{this.applyScene(index);this.stepIndex=-1;}}
 start(auto=this.auto){if(this.playing)return;this.auto=!!auto;this.playing=true;this.ended=false;this.error=null;this.stepIndex=-1;this.sceneBar=-1;this.remaining=0;this.frames=0;this.totalBars=0;this.tied=false;this.gates.fill(-1);this.sceneChanges=[{scene:this.sceneIndex,frame:0}];}
 stop(){this.playing=false;this.pending=null;this.sid.stop();this.paula.stop();this.acid.stop();this.warm.stop();this.gates.fill(-1);this.tied=false;}
 panic(){this.stop();this.sid.sid.reg.fill(0);for(const v of this.sid.sid.voices){v.env=0;v.stage='off';}this.sid.sid.ic1=this.sid.sid.ic2=this.sid.sid.prevIn=this.sid.sid.prevOut=0;this.sid.delay.fill(0);this.paula.paula.channels.forEach(c=>c.active=false);this.paula.delay.forEach(x=>x.fill(0));this.paula.lp.fill(0);this.paula.dcIn.fill(0);this.paula.dcOut.fill(0);this.clean.reset();this.acid.panic();this.drums.panic();this.warm.panic();this.mix.fill(0);this.meters.fill(0);this.stepIndex=-1;}
 setTempo(bpm){if(!num(bpm,40,220))throw Error('Tempo 40–220 BPM');this.data.bpm=bpm;this.sid.project.bpm=this.paula.project.bpm=this.acid.project.bpm=this.warm.project.bpm=bpm;this.paula.updateFX();}
 setMix(patch){const next={...this.data,...patch,levels:{...this.data.levels,...patch.levels},mutes:{...this.data.mutes,...patch.mutes}};if(!num(next.master,0,1)||!num(next.filter,.2,4)||next.solo!==null&&!ENSEMBLE_DECKS.includes(next.solo))throw Error('Invalid mixer');for(const d of ENSEMBLE_DECKS)if(!num(next.levels[d],0,1)||typeof next.mutes[d]!=='boolean')throw Error('Invalid channel');Object.assign(this.data,{master:next.master,filter:next.filter,solo:next.solo,levels:next.levels,mutes:next.mutes});}
 replaceScene(index,scene){if(!Number.isInteger(index)||index<0||index>7)throw Error('Unknown scene');validateScene(scene);this.data.scenes[index]=warmScene(scene);if(index===this.sceneIndex){if(this.playing)this.pending=index;else this.applyScene(index);}}
 drumEdit(index,bar,voice,step,value){if(!Number.isInteger(index)||index<0||index>7||!Number.isInteger(bar)||bar<0||bar>7||!Number.isInteger(voice)||voice<0||voice>7||!Number.isInteger(step)||step<0||step>15||!num(value,0,1))throw Error('Invalid drum edit');this.data.scenes[index].patterns[bar].drums[voice][step]=value;}
 pad(voice){this.drums.trigger(voice,1);this.audition=this.rate*3;}
 drumVoice(index,voice,key,value){const s=this.data.scenes[index],p=structuredClone(s.drums);p.voices[voice][key]=value;validateDrum(p);s.drums=p;if(index===this.sceneIndex)this.drums.project.voices[voice]={...p.voices[voice]};}
 tick(){
  this.stepIndex=(this.stepIndex+1)%16;
  if(this.stepIndex===0){
   if(this.pending!==null)this.applyScene(this.pending);
   else if(this.sceneBar+1>=this.data.scenes[this.sceneIndex].bars&&this.auto){if(this.sceneIndex===7){this.stop();this.ended=true;return;}this.applyScene(this.sceneIndex+1);}
   this.sceneBar++;this.totalBars++;
  }
  const s=this.data.scenes[this.sceneIndex],p=s.patterns[this.sceneBar%8],st=this.stepIndex,stepFrames=this.rate*60/this.data.bpm/4;
  // A sixteen-bar musical breath: sparse openings, full middle, a small turnaround.
  this.warm.trigger(p.warm[st],stepFrames);
  const cycle=this.sceneBar%16,breath=s.evolution?(cycle<2?.65:cycle>=14?.82:1):1;
  const evolving=s.evolution?(0.65+Math.sin(Math.min(1,this.sceneBar/Math.max(1,s.bars-1))*Math.PI)*.75):1;
  this.acid.setParam('cutoff',Math.max(70,Math.min(6000,s.acid.params.cutoff*this.data.filter*evolving)));
  for(let v=0;v<3;v++){const n=p.sid[v][st];if(n!==null&&!(s.evolution&&v===2&&cycle<4)){this.sid.noteOn(v,n);this.gates[v]=stepFrames*(v===1?3.5:.72);}}
  for(let v=0;v<4;v++){const n=p.paula[v][st];if(n!==null&&!(s.evolution&&v===3&&cycle<4)){this.paula.noteOn(v,n);this.gates[3+v]=stepFrames*(v===2?6:2.6);}}
  const a=p.acid[st],next=st===15?s.patterns[(this.sceneBar+1)%8].acid[0]:p.acid[st+1];
  if(a.note!==null){this.acid.noteOn(a.note,a.accent,this.tied);this.tied=a.slide&&next.note!==null;this.gates[7]=this.tied?-1:stepFrames*s.acid.params.gate/100;}else{this.acid.noteOff();this.tied=false;this.gates[7]=-1;}
  for(let v=0;v<8;v++){let velocity=p.drums[v][st];if(s.evolution&&cycle===15&&st>=12&&v===5)velocity=Math.max(velocity,.3+(st-12)*.13);if(velocity>0){this.drums.trigger(v,velocity*breath);if(v===0)this.duck=1;}}
  this.remaining+=stepFrames;
 }
 sample(){try{
  if(this.playing){if(this.remaining<=0)this.tick();this.remaining--;for(let i=0;i<8;i++)if(this.gates[i]>=0&&--this.gates[i]<=0){this.gates[i]=-1;if(i<3)this.sid.noteOff(i);else if(i<7)this.paula.noteOff(i-3);else this.acid.noteOff();}if(this.playing)this.frames++;}
  const a=this.sid.sample(),p=this.paula.sample(),c=this.acid.sample(),d=this.drums.sample(),w=this.warm.sample(),s=this.data.scenes[this.sceneIndex];this.duck*=this.duckRelease;this.master+=(this.data.master-this.master)*.002;
  for(let j=0;j<ENSEMBLE_DECKS.length;j++){const key=ENSEMBLE_DECKS[j],enabled=!this.data.mutes[key]&&(this.data.solo===null||this.data.solo===key);let target=enabled?this.data.levels[key]*s.levels[key]:0;
   if(s.evolution&&this.sceneIndex===0)target*=Math.min(1,Math.max(0,this.sceneBar+1)/12);
   if(s.evolution&&this.sceneIndex===7&&this.sceneBar>=s.bars-16)target*=Math.max(0,(s.bars-this.sceneBar)/16);
   if(j===3&&!this.playing&&this.audition>0&&enabled)target=this.data.levels.drums;this.gains[j]+=(target-this.gains[j])*.0015;
  }
  if(this.audition>0)this.audition--;const gainDuck=1-this.duck*.12;
  for(let ch=0;ch<2;ch++){const x=(a*this.gains[0]*.72+p[ch]*this.gains[1]*1.1+c[ch]*this.gains[2]*gainDuck+d[ch]*this.gains[3]+w[ch]*this.gains[4])*this.master;this.mix[ch]=.92*Math.tanh(x/.92);if(!Number.isFinite(this.mix[ch]))throw Error('Audio calculation failed');}
  const raw=[Math.abs(a),Math.max(Math.abs(p[0]),Math.abs(p[1])),Math.max(Math.abs(c[0]),Math.abs(c[1])),Math.max(Math.abs(d[0]),Math.abs(d[1])),Math.max(Math.abs(w[0]),Math.abs(w[1]))];for(let j=0;j<ENSEMBLE_DECKS.length;j++)this.meters[j]=Math.max(this.meters[j]*.999,raw[j]*this.gains[j]);
 }catch(e){this.error=e.message;this.panic();}return this.mix;}
 snapshot(){return {playing:this.playing,auto:this.auto,scene:this.sceneIndex,bar:this.sceneBar,step:this.stepIndex,totalBars:this.totalBars,seconds:this.frames/this.rate,pending:this.pending,meters:[...this.meters],ended:this.ended,error:this.error};}
}
export function wavHeader(frames,rate){const buffer=new ArrayBuffer(44),v=new DataView(buffer);const text=(i,s)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j));};text(0,'RIFF');v.setUint32(4,36+frames*4,true);text(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,frames*4,true);return buffer;}
export const toPCM=x=>Math.round(Math.max(-1,Math.min(1,x))*(x<0?32768:32767))||0;
