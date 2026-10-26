import {freshProject} from './machine.mjs';
import {freshPaula} from './paula.mjs';
import {freshAcid} from './acid.mjs';
import {freshDrum,drumPattern} from './drum.mjs';
import {applyInstrument} from './sid-instruments.mjs';
export const DECKS=['sid','paula','acid','drums'];
export const SET_TITLE='Licht im Hinterhof';
export const SCENE_NAMES=['Die ersten Fenster','Diskettengarten','Kupferregen','Säureblumen bei Nacht','Der stille Innenhof','Laternenfieber','Alle Fenster offen','Morgen auf dem Balkon'];
const empty=n=>Array.from({length:n},()=>Array(16).fill(null));
const melody=[[[0,74],[3,77],[6,81],[10,79],[13,77]],[[0,74],[4,72],[8,70],[12,69]],[[0,72],[3,77],[7,76],[12,72]],[[0,67],[4,69],[8,72],[11,74],[14,72]]];
export function freshEnsemble(){
 const scenes=SCENE_NAMES.map((name,index)=>{
  const sid=freshProject(3),paula=freshPaula(3),acid=freshAcid(),drums=freshDrum();
  sid.bpm=paula.bpm=acid.bpm=128;sid.cutoff=[1150,1400,1510,1300,1100,1550,1480,1050][index];sid.echo=.18;
  ['glass-lead','soft-pad','pluck'].forEach((p,i)=>applyInstrument(sid,i,p));sid.voices[1].attack=5;sid.voices[1].release=7;
  paula.echo=22;paula.filter=65;paula.width=65;paula.channels=[{sample:'music-box',volume:34,loop:false,mute:false},{sample:'epiano',volume:28,loop:false,mute:false},{sample:'warm-pad',volume:24,loop:false,mute:false},{sample:'pluck',volume:23,loop:false,mute:false}];
  acid.wave=index===2||index===5?'square':'saw';acid.params={...acid.params,cutoff:[120,190,350,600,130,850,650,150][index],resonance:[30,44,58,70,35,76,63,30][index],env:[22,38,55,65,30,72,60,25][index],echo:15,volume:80,decay:index===4?600:280};
  const bars=Array.from({length:8},(_,b)=>{
   const chord=Math.floor(b/2)%4,root=[38,34,41,36][chord],third=chord===0?3:4;
   const s=empty(3),p=empty(4),a=Array.from({length:16},()=>({note:null,accent:false,slide:false})),d=drumPattern(index===0||index===4||index===7?'dust':index===2?'broken':'house');
   for(const [st,n]of melody[chord]){if(index!==4&&b%4<3){p[0][st]=n+(index===7?-12:0);if(index===1||index===6)s[0][(st+2)%16]=n-12;}}
   const chordNotes=[root+24,root+24+third,root+31,root+24+third];
   for(let j=0;j<4;j++){p[1][j*4+(b%2?1:0)]=chordNotes[j];if(index>=2&&index!==4&&index!==7)p[3][j*4+2]=chordNotes[(j+2)%4];}
   p[2][0]=root+24;if(b%2)p[2][8]=root+31;
   s[1][0]=root+12;s[1][8]=root+19;
   if(index===2||index===5||index===6)for(const st of [2,5,10,14])s[2][st]=root+[24,31,third+24,31][[2,5,10,14].indexOf(st)];
   const bass=b%2?[0,null,7,0,null,third,12,7,0,null,0,third,7,null,12,7]:[0,null,0,12,third,0,null,7,0,0,third+12,null,12,7,third,-2];
   for(let st=0;st<16;st++)if(bass[st]!==null)a[st]={note:root+bass[st],accent:[0,4,8,14].includes(st),slide:[2,7,9,13].includes(st)};
   if(index===0||index===4||index===7)for(let st=0;st<16;st++)if(st%4)a[st].note=null;
   if(b===7&&index!==0&&index!==4&&index!==7){d[5][13]=.55;d[5][15]=.75;d[1][15]=.35;}
   if(index===5||index===6){d[7][3]=.35;d[7][11]=.5;d[3][15]=.35;}
   return {sid:s,paula:p,acid:a,drums:d};
  });
  return {name,bars:index===0?32:64,sid,paula,acid,drums,patterns:bars,levels:[{sid:.35,paula:.85,acid:0,drums:.3},{sid:.48,paula:.9,acid:.25,drums:.8},{sid:.55,paula:.64,acid:.55,drums:.9},{sid:.25,paula:.7,acid:.95,drums:.94},{sid:.38,paula:.85,acid:.18,drums:.08},{sid:.38,paula:.65,acid:1,drums:1},{sid:.58,paula:.82,acid:.72,drums:.95},{sid:.36,paula:.8,acid:.18,drums:.32}][index],evolution:true};
 });
 return {kind:'small-ensemble',version:1,name:SET_TITLE,bpm:128,master:.85,levels:{sid:1,paula:1,acid:1,drums:1},mutes:{sid:false,paula:false,acid:false,drums:false},solo:null,filter:1,scenes};
}
export function setSeconds(set){return set.scenes.reduce((n,s)=>n+s.bars,0)*240/set.bpm;}
