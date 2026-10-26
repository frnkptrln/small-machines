// Bernsteinfenster: an original slow polyphonic study for WARM/06.
// The score is exported as data by render-warm-session.mjs.
import {freshWarm,validateWarm} from '../dist/warm.mjs';
import {freshWarmEnsemble} from '../dist/warm-ensemble.mjs';

const clone=x=>structuredClone(x);
const chordCycle=[[45,52,60,67],[41,53,57,64],[48,55,59,64],[43,55,59,64]];
const melody=[
 [[7,72,3.5],[12,71,3.3]],[[2,67,3],[7,64,4],[13,69,2.5]],
 [[7,69,4.5],[13,67,2]],[[3,64,3.5],[9,67,5]],
 [[7,67,4],[12,71,3.5]],[[2,72,3],[7,76,4.5],[13,74,2.5]],
 [[6,71,5],[13,69,2]],[[3,67,3],[9,64,6]]
];
const sectionDefs=[
 {name:'Eine Lampe bleibt an',bars:8,kind:'intro',params:{attack:1100,release:2300,cutoff:570,chorus:68,sustain:81,env:16,volume:76}},
 {name:'Bernstein auf dem Fensterbrett',bars:16,kind:'theme',params:{attack:130,release:1350,cutoff:1050,chorus:67,sustain:72,env:26,volume:78}},
 {name:'Die Straße trägt den Abend',bars:16,kind:'lift',params:{attack:90,release:1150,cutoff:1650,chorus:74,sustain:66,env:31,volume:77}},
 {name:'Zwischen zwei Atemzügen',bars:8,kind:'still',params:{attack:800,release:2800,cutoff:590,chorus:79,sustain:77,env:18,volume:72}},
 {name:'Noch einmal das warme Licht',bars:24,kind:'return',params:{attack:115,release:1450,cutoff:1350,chorus:72,sustain:70,env:25,volume:78}},
 {name:'Gute Nacht, kleines Fenster',bars:8,kind:'coda',params:{attack:650,release:3200,cutoff:540,chorus:68,sustain:76,env:14,volume:72}}
];

export function bernsteinScore(){
 const bpm=96,base=freshWarm(),sections=[],bars=[];let start=0;
 for(const [si,def]of sectionDefs.entries()){
  sections.push({name:def.name,startBar:start,bars:def.bars,startSeconds:start*240/bpm,params:{...base.params,...def.params}});
  for(let b=0;b<def.bars;b++){
   const phrase=b%8,cycle=Math.floor(b/8),slots=Array(16).fill(null),kind=def.kind;
   let chord=[...chordCycle[Math.floor(phrase/2)]];
   if(kind==='still')chord=[[50,57,60,64],[40,52,55,62],[41,53,57,64],[45,52,59,64]][Math.floor(phrase/2)];
   if(kind==='return'&&cycle===1)chord=[[45,55,60,64],[41,52,57,60],[48,55,59,67],[43,50,59,64]][Math.floor(phrase/2)];
   if(kind==='coda'&&b>=4)chord=b<6?[41,53,57,64]:[45,52,59,60];
   if(phrase%2===0){
    const sparse=(kind==='intro'&&b<4)||kind==='coda';
    slots[0]={notes:sparse?[chord[0],chord[2],chord[3]]:chord,velocity:kind==='still'?.51:kind==='intro'?.56:kind==='coda'?.55:.67+(cycle%2)*.025,length:kind==='coda'&&b===6?29:29.5};
   }
   const melodic=kind==='theme'||kind==='lift'||kind==='return';
   if(melodic){
    for(const [j,[step,pitch,length]]of melody[phrase].entries()){
     let note=pitch;
     if(kind==='return'&&cycle===1&&phrase===5&&step===7)note=79;
     if(kind==='return'&&cycle===2&&phrase===7&&step===9)note=69;
     slots[step]={notes:[note],velocity:.49+(j%2)*.055+(kind==='lift'?.055:0)+(cycle%2)*.015,length};
    }
    // Brief answering notes make the second statement less predictable.
    if((kind==='lift'||kind==='return'&&cycle===2)&&phrase%2===0)slots[3]={notes:[chord[2]+12],velocity:.33,length:2.4};
    if(kind==='lift'&&phrase===3)slots[14]={notes:[72],velocity:.36,length:1.5};
   }else if(kind==='intro'&&b>=4&&b%2)slots[8]={notes:[b===5?76:71],velocity:.35,length:6};
   else if(kind==='still'&&b%2)slots[10]={notes:[b===3?74:72],velocity:.34,length:5};
   else if(kind==='coda'&&b===3)slots[10]={notes:[72],velocity:.34,length:5};
   const arc=melodic?1+.12*Math.sin(Math.PI*(b+.5)/def.bars):1;
   bars.push({section:si,events:slots,cutoff:Math.round(def.params.cutoff*arc)});
  }start+=def.bars;
 }
 return {format:'small-machines-score',version:1,title:'Bernsteinfenster',artist:'Small Machines',instrument:'WARM/06',bpm,bars:bars.length,tailSeconds:5,sections,score:bars,notes:'Originalkomposition. Sechs Stimmen, Akkorde und eine antwortende Melodie; eine gemeinsame Klangfarbe pro Abschnitt.'};
}

export function bernsteinProject(){
 const score=bernsteinScore(),p=freshWarm();p.name='Bernsteinfenster · Hauptthema';p.bpm=score.bpm;p.params=clone(score.sections[1].params);p.patterns=score.score.slice(8,16).map(b=>clone(b.events));return validateWarm(p);
}

export function bernsteinVisit(){
 const set=freshWarmEnsemble();set.name='Bernsteinfenster · Besuch im Hinterhof';set.bpm=112;set.master=.86;
 // Eight four-bar scenes leave every machine space and finish in 68.6 s.
 // Six bars per scene make the visit 102.86 s; each original eight-bar phrase
 // is arranged anew below to resolve at every four-bar harmonic boundary.
 const names=['Die Tür steht offen','Paula bringt Blumen','SID am Fenster','Ein warmer Puls','Die kleine Pause','Fünf Stimmen im Hof','Noch ein gemeinsamer Takt','Bis zum nächsten Licht'];
 const warmGains=[.82,.68,.68,.64,.9,.72,.72,.62];
 set.scenes.forEach((scene,i)=>{
  scene.name=names[i];scene.bars=6;scene.evolution=false;
  scene.warm.params={...scene.warm.params,attack:i===4?850:220,release:1600,cutoff:[740,1000,1250,1450,650,1750,1450,600][i],chorus:70,volume:82,env:24};
  scene.levels={sid:[0,.16,.39,.22,.12,.34,.32,.15][i],paula:[.2,.7,.52,.45,.2,.6,.5,.23][i],acid:[0,.12,.16,.45,0,.4,.3,.08][i],drums:[.25,.49,.58,.68,.1,.75,.58,.24][i],warm:warmGains[i]};
  scene.patterns.forEach((p,b)=>{
   // The quartet source is in D minor. Retain its pitch world, then give
   // WARM/06 both the inner chord and a short response in its spare voices.
   const root=[50,46,53,48][Math.floor(b/2)%4],third=b<2?3:4;
   p.warm=Array(16).fill(null);
   if(b%2===0)p.warm[0]={notes:[root,root+7,root+12+third,root+19],velocity:.7,length:29.5};
   if(i!==0&&i!==4&&i!==7){p.warm[7]={notes:[root+24+third],velocity:.48,length:4};p.warm[13]={notes:[root+19],velocity:.43,length:2.5};}
   // Let the entering warm voice be heard before the drum/melody answer.
   if(i===0&&b<2){for(const row of p.sid)row.fill(null);for(const row of p.paula)row.fill(null);for(const a of p.acid)a.note=null;}
  });
  scene.warm.patterns=scene.patterns.map(p=>clone(p.warm));
 });return set;
}
