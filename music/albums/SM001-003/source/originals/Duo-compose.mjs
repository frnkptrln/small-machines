// Original compositions for the Small Machines SID/65 + PAULA/68 engines.
// Units are sixteenth notes; 16 steps = one 4/4 bar. No random note generation.
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const OUT=resolve(dirname(fileURLToPath(import.meta.url)),'../scores');mkdirSync(OUT,{recursive:true});
const clone=x=>JSON.parse(JSON.stringify(x));
const V=(wave,pw,attack,decay,sustain,release)=>({wave,pw,attack,decay,sustain,release,mute:false,ring:false,sync:false});
function make(id,title,bpm,bars,swing,key,description,voices,sections,mix){return {format:'small-machines-composition',version:1,id,title,bpm,bars,swing,key,description,rate:44100,tail:7,voices,sections,mix,events:[]};}
function sid(s,bar,step,voice,note,gate=2){s.events.push({at:bar*16+step,type:'sid',voice,note,gate});}
function pcm(s,bar,step,voice,sample,note,volume,gate){s.events.push({at:bar*16+step,type:'paula',voice,sample,note,volume,...(gate===undefined?{}:{gate})});}
function fx(s,bar,step,cutoff,paulaFilter){s.events.push({at:bar*16+step,type:'tone',cutoff,paulaFilter});}
function phrase(s,bar,notes,voice=0,transpose=0,shift=0,gateScale=1){for(const [at,n,g]of notes)sid(s,bar,at+shift,voice,n+transpose,g*gateScale);}
function section(s,bar){return s.sections.find(x=>bar>=x.start&&bar<x.end).name;}
function finish(s){s.events.sort((a,b)=>a.at-b.at||(['tone','paula','sid'].indexOf(a.type)-['tone','paula','sid'].indexOf(b.type)));s.events.forEach((e,id)=>e.id=id);writeFileSync(resolve(OUT,s.id+'.json'),JSON.stringify(s,null,2));return s;}

// 01: D minor/add9. Eight-bar melody; a contrasting middle, then a lifted return.
const light=make('01-Fensterlicht-auf-Magnetband','Fensterlicht auf Magnetband',92,64,.075,'d-Moll',
 'Ein warmer Groove, der sich aus elektrischen Tasten und einem einzelnen Bass aufbaut. Die Pulsmelodie kehrt nach einem offenen Mittelteil heller zurück.',
 [V(64,36,2,9,5,8),V(16,50,0,6,10,5),V(16,50,9,9,6,10)],
 [{name:'Fenster auf',start:0,end:8},{name:'Erster Gedanke',start:8,end:24},{name:'Licht fällt ein',start:24,end:32},{name:'Schwebender Mittelteil',start:32,end:40},{name:'Wiederkehr',start:40,end:56},{name:'Band läuft aus',start:56,end:64}],
 {sid:.62,paula:1.2,reverb:.14,echo:19,width:85,sidechain:.15,fadeIn:1.8,fadeOut:5});
const harmony1=[{r:38,keys:[62,65,69,76],pad:65},{r:34,keys:[62,65,69,74],pad:65},{r:41,keys:[60,64,67,72],pad:64},{r:36,keys:[60,64,67,74],pad:67}];
const melody1=[
 [[0,74,3],[6,77,1.8],[9,76,2.2],[12,72,3]],
 [[2,69,3],[8,72,2],[12,74,3]],
 [[0,77,4],[6,76,1.5],[8,74,3],[13,72,2]],
 [[0,69,5],[8,67,3],[12,69,2]],
 [[0,72,3],[5,76,2],[8,79,4],[14,77,1]],
 [[2,76,3],[7,72,2],[10,69,4]],
 [[0,74,3],[6,72,2],[10,67,3]],
 [[0,69,4],[6,72,3],[12,74,3.5]]
];
const bridge1=[[[0,81,5],[9,79,4]],[[2,77,5],[11,76,3]],[[0,76,5],[8,72,5]],[[0,74,7],[10,72,3]]];
for(let b=0;b<64;b++){
 const h=harmony1[Math.floor(b/2)%4],intro=b<8,outro=b>=56,bridge=b>=32&&b<40,lift=(b>=24&&b<32)||(b>=40&&b<56),active=!intro&&!outro;
 fx(light,b,0,Math.round(1190+(lift?330:bridge?-100:80)+(b%8)*15),lift?68:56);
 // Electric keys articulate a chord over time, respecting Paula's monophony.
 const keySlots=bridge?[0,7,12]:outro?[0,6]:[0,3.1,6,10,13.1];
 keySlots.forEach((st,i)=>pcm(light,b,st,1,bridge?'glass':'epiano',h.keys[(i+(b%2?1:0))%4],bridge?27:29+(i===0?7:0)));
 if(b>=4&&b<62){sid(light,b,0,1,h.r,bridge?11:5.8);if(!bridge){sid(light,b,7,1,h.r,2);sid(light,b,10,1,h.r+7,2.7);if(b%2)sid(light,b,14,1,h.r+12,1.6);}}
 if(b%2===0)sid(light,b,0,2,h.pad,bridge?28:22);
 if(active&&!bridge)phrase(light,b,melody1[(b-8)%8],0,0,0,lift?1.03:.92);
 if(b>=24&&b<32&&b%4===3)pcm(light,b,14,3,'glass',81,21);
 if(bridge)phrase(light,b,bridge1[b%4],0,0,0,1.1);
 if(b>=40&&b<56&&b%8===7){sid(light,b,10,0,76,1.6);sid(light,b,12,0,77,1.7);sid(light,b,14,0,76,1.6);}
 if(b===56||b===58||b===60)phrase(light,b,[[0,74,4],[7,72,4],[12,69,3]],0,b===60?-12:0);
 if(b>=6&&b<60&&!bridge){for(const st of [0,8,...(b%2?[11]:[]),...(lift?[6]:[])])pcm(light,b,st,0,'deep-kick',48,50+(st===0?6:0));
  for(const st of [2,4,6,10,12,14])pcm(light,b,st,2,st===4||st===12?'snare':'shaker',48,st===4||st===12?34:17+(b%2)*3);
  if(b%8===7){pcm(light,b,14.5,2,'rim',48,22);pcm(light,b,15.25,2,'snare',48,23);}
 }else if(bridge&&b>=36){pcm(light,b,0,0,'deep-kick',43,42);pcm(light,b,12,2,'rim',48,21);}
 if(lift&&b%2===0)pcm(light,b,1,3,'warm-pad',h.keys[0],24);
 if(b===0||b===32||b===63)pcm(light,b,0,3,'glass',b===63?62:74,26);
}
// Last chord replaces the expected turnaround: a deliberately quiet resolution.
sid(light,63,0,1,38,12);sid(light,63,0,2,65,12);sid(light,63,0,0,74,9);
finish(light);

// 02: E minor, syncopated bass and a call/answer tune. A half-time passage resets it.
const steps=make('02-Zwischen-zwei-Takten','Zwischen zwei Takten',126,64,.025,'e-Moll',
 'Ein kleiner Maschinenclub: knappe Bassfiguren, eine Frage aus Pulsen, eine Antwort aus Marimba und ein Mittelteil im halben Tempo.',
 [V(64,19,0,7,4,4),V(32,50,0,6,5,3),V(16,50,1,7,0,5)],
 [{name:'Kontakt',start:0,end:8},{name:'Frage und Antwort',start:8,end:24},{name:'Offene Türen',start:24,end:32},{name:'Halbe Geschwindigkeit',start:32,end:40},{name:'Zweiter Anlauf',start:40,end:56},{name:'Letzter Zug',start:56,end:64}],
 {sid:.67,paula:1.25,reverb:.075,echo:12,width:78,sidechain:.23,fadeIn:.6,fadeOut:4});
const roots2=[40,40,36,36,43,43,38,47],notes2=[[64,67,71,74],[64,67,71,74],[60,64,67,71],[60,64,67,71],[62,67,71,74],[62,67,71,74],[62,66,69,74],[59,63,66,69]];
const tune2=[[[0,76,1.6],[3,79,1.4],[6,83,2.4],[10,79,1.3],[13,78,1.8]],[[0,76,3],[7,74,1.4],[10,71,2.2]],[[0,76,1.5],[3,79,1.4],[6,83,2],[11,84,3]],[[2,83,1.6],[5,79,2],[10,76,4]],[[0,79,1.5],[3,83,1.4],[6,86,2.5],[11,83,2]],[[0,81,2],[4,79,2],[8,78,2],[12,76,2]],[[0,78,3],[6,74,2],[10,78,3]],[[0,75,3],[6,78,1.6],[9,83,1.5],[12,78,2.8]]];
for(let b=0;b<64;b++){
 const q=b%8,root=roots2[q],h=notes2[q],half=b>=32&&b<40,outro=b>=56,intro=b<8,lift=b>=24&&b<32||b>=40&&b<56;
 fx(steps,b,0,Math.round((half?1120:intro?1190:lift?1730:1510)+(q%4)*32),half?52:76);
 if(b>=2&&b<63){const bass=half?[[0,root,5],[10,root+7,3]]:[[0,root,1.6],[3,root,1.2],[6,root+12,1.4],[8,root,1.6],[11,root+7,1.4],[14,root+12,1.3]];phrase(steps,b,bass,1);}
 if(b>=8&&b<60&&!half){if(b%2===0||lift)phrase(steps,b,tune2[q],0,0,0,1);else phrase(steps,b,tune2[q].slice(0,2),0,-12);}
 if(b>=4&&b<62){const slots=half?[2,9,14]:[2,5,9,12,15];slots.forEach((st,i)=>{if(!intro||i%2===0)pcm(steps,b,st,1,half?'epiano':'mallet',h[(i+q)%4]+(lift?12:0),half?30:35+(i%2?3:0));});}
 if(b>=16&&b<56&&b%2===1&&!half)for(const [st,n]of [[1,h[0]+12],[7,h[2]+12],[13,h[1]+12]])sid(steps,b,st,2,n,1.3);
 if(half){sid(steps,b,0,0,h[1]+12,6);sid(steps,b,8,0,h[0]+12,5);}
 if(b>=4&&b<62){const kicks=half?[0,10]:[0,4,8,12,...(q===7?[14.5]:[])];for(const st of kicks)pcm(steps,b,st,0,'hard-kick',48,half?43:54);
  for(let st=0;st<16;st+=2){if(half&&st!==8&&st!==14)continue;const sn=half?st===8:st===4||st===12;pcm(steps,b,st,2,sn?'clap':st%4===2&&lift?'open-hat':'hat',48,sn?36:st%4===2?23:14);}
  if(q===7&&!half)for(const st of [13,14,15])pcm(steps,b,st,2,'tom',48+(st-13)*3,31+(st-13)*3);
 }
 if(b===7||b===31||b===39||b===55)pcm(steps,b,12,3,'riser',60,27);
 if(lift&&b%4===0)pcm(steps,b,0,3,'cowbell',48,23);
 if(b===0||b===2)pcm(steps,b,0,3,'blip',b===0?72:76,26);
 if(b>=56&&b<60)pcm(steps,b,10,3,'music-box',h[0]+12,26);
}
sid(steps,63,0,1,40,5);sid(steps,63,0,0,76,3);pcm(steps,63,0,1,'mallet',64,35);pcm(steps,63,0,0,'hard-kick',48,51);finish(steps);

// 03: F# minor moving toward A major. Spacious, unhurried, no literal tape hiss.
const memory=make('03-Was-im-Speicher-bleibt','Was im Speicher bleibt',72,48,.04,'fis-Moll / A-Dur',
 'Ein ruhiger Dialog aus Dreiecken und gläsernen Tasten. Die Mitte verdichtet sich, am Ende bleibt ein heller Akkord mit einer offenen None.',
 [V(16,50,5,10,5,10),V(16,50,3,8,8,9),V(64,43,10,10,4,11)],
 [{name:'Ein Rest von Licht',start:0,end:8},{name:'Erinnerung',start:8,end:20},{name:'Nähe',start:20,end:32},{name:'Alles wird weit',start:32,end:40},{name:'Bleibt',start:40,end:48}],
 {sid:.57,paula:1.05,reverb:.23,echo:29,width:92,sidechain:.07,fadeIn:3.0,fadeOut:7});
const roots3=[42,38,45,40],keys3=[[66,69,73,80],[66,69,73,78],[64,69,73,76],[64,68,71,78]];
const tune3=[[[1,73,5],[9,76,5]],[[0,80,6],[10,78,4]],[[2,78,5],[10,76,4]],[[0,73,8],[11,69,3]],[[0,76,5],[8,73,5]],[[2,71,4],[9,69,5]],[[0,68,6],[9,71,4]],[[0,73,7],[10,76,5]]];
for(let b=0;b<48;b++){
 let chord=Math.floor(b/2)%4;const opening=b<8,center=b>=20&&b<32,wide=b>=32&&b<40,ending=b>=40;
 if(b>=44)chord=2;const root=roots3[chord],h=keys3[chord];fx(memory,b,0,center?1520:wide?1360:1260,center?60:48);
 if(b%2===0){sid(memory,b,0,2,h[1]-12,28);if(b>=4)sid(memory,b,0,1,root,25);pcm(memory,b,0,3,wide?'choir':'warm-pad',h[0],opening?22:27);}
 if(!ending||b<46){const slots=center?[1,5.2,9,13.2]:[2,9];slots.forEach((st,i)=>pcm(memory,b,st,1,center?'epiano':'glass',h[(i+(b%2)*2)%4],center?32:25));}
 if(b>=8&&b<44)phrase(memory,b,tune3[(b-8)%8],0,wide?12:0,0,wide?.8:1);
 if(opening&&b%2===1)pcm(memory,b,7,2,'music-box',h[2],21);
 if(b>=12&&b<40){if(!wide||b%2===0)pcm(memory,b,0,0,'deep-kick',43,center?40:30);if(center)pcm(memory,b,10,0,'deep-kick',43,27);
  for(const st of (center?[4,8,12,15]:[8]))pcm(memory,b,st,2,st===8?'rim':'shaker',st===8?43:48,center?21:16);
 }
 if(b>=40&&b<44)phrase(memory,b,[[1,76,6],[10,73,4]],0,b%2?-12:0);
 if(b===44){sid(memory,b,0,0,73,12);pcm(memory,b,4,1,'glass',76,27);pcm(memory,b,10,2,'music-box',83,19);}
 if(b===46){sid(memory,b,0,0,71,14);sid(memory,b,0,1,45,27);sid(memory,b,0,2,61,27);pcm(memory,b,0,3,'warm-pad',69,26);pcm(memory,b,6,1,'glass',76,23);}
 if(b===47)pcm(memory,b,0,1,'glass',81,21);
}
finish(memory);
console.log(JSON.stringify([light,steps,memory].map(s=>({title:s.title,bpm:s.bpm,bars:s.bars,events:s.events.length,duration:s.bars*240/s.bpm+s.tail})),null,2));
