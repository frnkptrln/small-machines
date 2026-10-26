// Four original solo compositions. All times are sixteenth-note steps.
// SID scores permit only three SID voices; Paula scores only four PCM channels.
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'scores');mkdirSync(out,{recursive:true});
const V=(wave,pw,attack,decay,sustain,release)=>({wave,pw,attack,decay,sustain,release,mute:false,ring:false,sync:false});
function song(engine,track,id,title,bpm,bars,swing,key,description,voices,sections,mix){return {format:'small-machines-solo-composition',version:1,engine,track,id,title,bpm,bars,swing,key,description,rate:44100,tail:7,voices,sections,mix:{sid:engine==='sid'?.8:0,paula:engine==='paula'?1.5:0,width:72,sidechain:0,fadeIn:1,fadeOut:5,...mix},events:[]};}
function S(s,b,t,v,n,g=2,extra={}){s.events.push({at:b*16+t,type:'sid',voice:v,note:n,gate:g,...extra});}
function P(s,b,t,v,sample,n,vol,g){s.events.push({at:b*16+t,type:'paula',voice:v,sample,note:n,volume:vol,...(g===undefined?{}:{gate:g})});}
function T(s,b,cutoff,paulaFilter){s.events.push({at:b*16,type:'tone',cutoff,paulaFilter});}
function melody(s,b,notes,v=0,transpose=0){for(const [t,n,g]of notes)S(s,b,t,v,n+transpose,g);}
function finish(s){s.events.sort((a,b)=>a.at-b.at||(['tone','paula','sid'].indexOf(a.type)-['tone','paula','sid'].indexOf(b.type)));s.events.forEach((e,i)=>e.id=i);if(s.events.some(e=>e.type!=='tone'&&e.type!==s.engine))throw Error('Foreign engine');writeFileSync(resolve(out,s.id+'.json'),JSON.stringify(s,null,2));console.log(JSON.stringify({title:s.title,engine:s.engine,seconds:s.bars*240/s.bpm+s.tail,events:s.events.length}));}
const kick=V(16,50,0,5,0,2),snare=V(128,50,0,5,0,2),hat=V(128,50,0,2,0,0),chirp=V(16,50,0,5,0,3);
function drum(s,b,t,type,accent=true){if(type==='kick')S(s,b,t,2,62,1.05,{patch:kick,sweep:{to:29,seconds:.021},vibrato:false});if(type==='snare')S(s,b,t,2,accent?56:50,.8,{patch:snare,vibrato:false});if(type==='hat')S(s,b,t,2,accent?91:86,.28,{patch:hat,vibrato:false});}

// SID I: A minor pulse tune. Voice 3 is time-shared by synthesized drums and fills.
const neon=song('sid',1,'SID-01-Drei-Stimmen-im-Neon','Drei Stimmen im Neon',118,64,.035,'a-Moll',
 'Drei Stimmen bauen eine kleine Nachtmaschine: Pulsmelodie, Sägezahnbass und Schlagzeug aus Rauschen und Dreiecken.',
 [V(64,24,1,7,6,5),V(32,50,0,6,7,3),hat],
 [{name:'Einschalten',start:0,end:8},{name:'Neon',start:8,end:24},{name:'Bewegung',start:24,end:32},{name:'Leere Straße',start:32,end:40},{name:'Rückkehr',start:40,end:56},{name:'Letztes Licht',start:56,end:64}],
 {reverb:.065,roomSeconds:1.0,echo:9,lufs:-16,fadeOut:4});
const roots=[45,45,41,41,48,48,43,40];
const tune=[
 [[0,76,2],[3,81,2],[6,84,2.5],[10,83,1.5],[13,81,2]],
 [[1,79,2],[5,76,3],[11,72,3]],
 [[0,77,3],[5,81,2],[9,84,2.5],[13,83,1.5]],
 [[0,81,5],[8,77,2],[12,76,2]],
 [[0,79,2],[3,84,2],[7,88,3],[12,86,2]],
 [[0,84,3],[6,83,2],[10,79,4]],
 [[0,83,3],[5,81,2],[9,79,3],[14,76,1.5]],
 [[0,80,3],[6,83,2],[10,76,4]]
];
for(let b=0;b<64;b++){
 const q=b%8,r=roots[q],bridge=b>=32&&b<40,lift=b>=24&&b<32||b>=40&&b<56,outro=b>=56;
 T(neon,b,bridge?1140:lift?1780:1420+(q%4)*45,50);
 if(b>=2&&b<63){const line=bridge?[[0,r,6],[10,r+7,4]]:[[0,r,1.7],[3,r,1.2],[6,r+12,1.3],[8,r,1.8],[11,r+7,1.3],[14,r+12,1.5]];melody(neon,b,line,1);}
 if(b>=8&&b<60&&!bridge)melody(neon,b,tune[q]);
 if(bridge)melody(neon,b,[[0,[81,79,77,76,76,74,71,68][q],5.8],[9,[76,76,72,72,72,71,67,68][q],4]],0,-12);
 if(b<8&&b%2===0)melody(neon,b,[[1,69+(q===2?8:q===4?3:q===6?10:0),2],[9,76,2]],0);
 if(b>=4&&b<62&&!bridge){
  for(const st of [0,8,...(lift?[6]:[]),...(q%2?[11]:[])])drum(neon,b,st,'kick');
  for(const st of [4,12])drum(neon,b,st,'snare');
  for(const st of [2,6,10,14])if(!(lift&&st===6))drum(neon,b,st,'hat',st===2||st===10);
  if(q===7){drum(neon,b,14.5,'snare',false);drum(neon,b,15.25,'snare');}
 }else if(bridge&&b>=36){drum(neon,b,0,'kick');drum(neon,b,8,'snare',false);}
 if(lift&&q===4)S(neon,b,15,2,88,.6,{patch:chirp});
 if(b===60){melody(neon,b,[[0,81,3],[6,79,2],[10,76,4]]);}
 if(b===62){S(neon,b,0,0,72,4);S(neon,b,8,0,71,3);}
}
S(neon,63,0,0,81,8);S(neon,63,0,1,45,7);drum(neon,63,0,'kick');finish(neon);

// SID II: B minor into D major; three melodic voices, no drum or PCM source.
const bit=song('sid',2,'SID-02-Ein-Bit-von-dir','Ein Bit von dir',80,48,.055,'h-Moll / D-Dur',
 'Ein stilles Trio: eine Dreiecksmelodie, tiefe gehaltene Töne und kleine Pulse, die sich im Mittelteil zu einer zweiten Melodie öffnen.',
 [V(16,50,4,9,6,9),V(16,50,5,8,7,10),V(64,38,1,8,0,6)],
 [{name:'Ein erster Ton',start:0,end:8},{name:'Nachricht',start:8,end:20},{name:'Antwort',start:20,end:32},{name:'Nähe',start:32,end:40},{name:'Bleibt offen',start:40,end:48}],
 {reverb:.14,roomSeconds:2.1,echo:23,lufs:-18,fadeIn:2.5,fadeOut:6});
const chords=[{r:35,a:[59,62,66,73]},{r:31,a:[59,62,66,69]},{r:38,a:[57,62,66,69]},{r:33,a:[57,61,64,71]}];
const quietTune=[[[1,74,5],[9,73,4]],[[0,71,6],[10,66,3]],[[0,69,4],[6,71,3],[12,74,3]],[[2,73,5],[10,69,4]],[[0,78,5],[9,76,4]],[[1,74,5],[10,73,3]],[[0,71,6],[10,69,4]],[[0,73,4],[7,71,4],[13,66,2]]];
for(let b=0;b<48;b++){
 const c=chords[Math.floor(b/2)%4],answer=b>=20&&b<32,peak=b>=32&&b<40,outro=b>=40;
 T(bit,b,answer?1590:peak?1680:1300+(b%8)*16,50);
 if(b%2===0)S(bit,b,0,1,c.r+12,27);
 const steps=outro?[2,10]:answer?[0,3,6,9,12,15]:[1,5,9,13];
 for(let j=0;j<steps.length;j++){const n=c.a[(j+(b%2)*2)%4]+(peak?12:0);S(bit,b,steps[j],2,n,answer?1.4:2.2);}
 if(b>=8&&b<44)melody(bit,b,quietTune[(b-8)%8],0,answer&&b%4<2?-12:0);
 if(b<8&&b%2===1)S(bit,b,3,0,c.a[2]+12,6);
 if(answer&&b%2===1){S(bit,b,7,2,c.a[3]+12,2.5);S(bit,b,12,2,c.a[2]+12,3);}
 if(b===44)melody(bit,b,[[0,74,6],[9,73,5]]);
 if(b===46){S(bit,b,0,0,74,23);S(bit,b,0,1,38,27);S(bit,b,4,2,66,7);S(bit,b,12,2,69,8);}
 if(b===47)S(bit,b,8,2,76,6);
}
finish(bit);

// Paula I: four channels, one for bass, one for keys, one time-shared drum lane,
// and one for pads / answer tones. No SID object is created by the renderer.
const moon=song('paula',1,'PAULA-01-Papiermond','Papiermond',94,56,.09,'f-Moll',
 'Ein weicher Vierkanal-Groove mit elektrischen Tasten, gezupften Antworten und einem runden Bass. Der Mittelteil lässt Luft zwischen die Schläge.',
 [V(16,50,0,0,0,0),V(16,50,0,0,0,0),V(16,50,0,0,0,0)],
 [{name:'Papierlicht',start:0,end:8},{name:'Mondbahn',start:8,end:24},{name:'Schwerelos',start:24,end:32},{name:'Wieder am Fenster',start:32,end:48},{name:'Gute Nacht',start:48,end:56}],
 {reverb:.15,roomSeconds:1.7,echo:22,width:78,lufs:-16.5,fadeIn:1.7,fadeOut:5.5});
const hMoon=[{r:41,a:[65,68,72,75]},{r:37,a:[65,68,72,77]},{r:44,a:[63,68,72,75]},{r:39,a:[63,67,70,77]}];
const moonTheme=[[[0,77],[6,80],[10,79],[13,75]],[[2,72],[9,75],[13,77]],[[0,80],[7,77],[12,75]],[[1,72],[8,68],[13,72]],[[0,75],[5,79],[10,80]],[[2,79],[8,75],[13,72]],[[0,77],[7,75],[12,70]],[[0,72],[6,75],[12,77]]];
for(let b=0;b<56;b++){
 const h=hMoon[Math.floor(b/2)%4],bridge=b>=24&&b<32,main=b>=8&&b<48,lift=b>=32&&b<48,outro=b>=48;
 T(moon,b,1300,bridge?45:lift?69:58);
 if(b>=4&&b<54){P(moon,b,0,0,'sub',h.r,43,bridge?10:5);if(!bridge){P(moon,b,7,0,'sub',h.r,36,2);P(moon,b,10,0,'sub',h.r+7,39,3);if(b%2)P(moon,b,14,0,'sub',h.r+12,34,1.7);}}
 const keySlots=bridge?[0,8,13]:outro?[0,7]:[0,3.15,6,10,13.15];keySlots.forEach((t,i)=>P(moon,b,t,1,bridge?'glass':'epiano',h.a[(i+(b%2?1:0))%4],i===0?36:29));
 if(main&&!bridge)for(const [t,n]of moonTheme[(b-8)%8])P(moon,b,t+.35,3,'pluck',n,lift?32:27);
 if(b<8&&b%2===0||bridge&&b%2===0)P(moon,b,1,3,'warm-pad',h.a[0],27);
 if(b>=6&&b<52&&!bridge){for(const t of [0,8,...(b%2?[11]:[])])P(moon,b,t,2,'deep-kick',48,56);for(const t of [4,12])P(moon,b,t,2,'snare',48,38);for(const t of [2,6,10,14])P(moon,b,t,2,'shaker',48,21);if(b%8===7){P(moon,b,14.7,2,'rim',48,24);P(moon,b,15.4,2,'snare',48,25);}}
 if(bridge&&b>=28){P(moon,b,0,2,'deep-kick',43,42);P(moon,b,8,2,'rim',43,22);}
 if(lift&&b%8===7)P(moon,b,15,3,'music-box',84,22);
 if(outro&&b<54){P(moon,b,2,3,'glass',77,22);P(moon,b,11,3,'glass',72,19);}
}
P(moon,55,0,0,'sub',41,37,13);P(moon,55,0,1,'epiano',65,34);P(moon,55,6,1,'epiano',68,27);P(moon,55,11,1,'epiano',72,22);P(moon,55,0,3,'warm-pad',65,24);finish(moon);

// Paula II: bright tracker structure in C minor; the lead and answer alternate.
const flowers=song('paula',2,'PAULA-02-Diskettenblumen','Diskettenblumen',132,64,.025,'c-Moll',
 'Ein lebhaftes Tracker-Stück: Marimba-Fragen, gläserne Antworten, ein beweglicher Samplebass und ein ruhiger Zwischenraum.',
 [V(16,50,0,0,0,0),V(16,50,0,0,0,0),V(16,50,0,0,0,0)],
 [{name:'Laufwerk',start:0,end:8},{name:'Blüten',start:8,end:24},{name:'Alles offen',start:24,end:32},{name:'Zwischenraum',start:32,end:40},{name:'Noch einmal Sommer',start:40,end:56},{name:'Auswerfen',start:56,end:64}],
 {reverb:.085,roomSeconds:1.1,echo:15,width:85,lufs:-16,fadeIn:.8,fadeOut:4});
const flowerRoots=[36,36,32,32,39,39,34,31],flowerChords=[[60,63,67,70],[60,63,67,70],[60,63,67,72],[60,63,67,72],[58,63,67,70],[58,63,67,70],[58,62,65,70],[59,62,67,71]];
const flowerTune=[[[0,72],[3,75],[6,79],[10,82],[13,79]],[[0,75],[6,74],[10,72]],[[0,75],[3,79],[7,84],[12,82]],[[1,79],[6,75],[11,72]],[[0,79],[4,82],[8,86],[13,82]],[[1,79],[7,77],[12,75]],[[0,77],[5,74],[9,70],[13,74]],[[0,71],[5,74],[9,79],[13,74]]];
for(let b=0;b<64;b++){
 const q=b%8,r=flowerRoots[q],a=flowerChords[q],bridge=b>=32&&b<40,lift=b>=24&&b<32||b>=40&&b<56,outro=b>=56;
 T(flowers,b,1300,bridge?49:lift?78:66);
 if(b>=2&&b<62){const line=bridge?[[0,r,7],[10,r+7,4]]:[[0,r,1.7],[3,r,1.2],[6,r+12,1.5],[8,r,1.7],[11,r+7,1.5],[14,r+12,1.6]];for(const [t,n,g]of line)P(flowers,b,t,0,'hollow-bass',n,bridge?34:43,g);}
 if(b>=8&&b<60&&!bridge)for(const [t,n]of flowerTune[q])P(flowers,b,t,1,'mallet',n,lift?45:39);
 else if(b<8&&b%2===0)for(const [t,n]of [[0,a[0]+12],[7,a[2]+12]])P(flowers,b,t,1,'music-box',n,29);
 else if(bridge){P(flowers,b,0,1,'epiano',a[0]+12,33);P(flowers,b,8,1,'epiano',a[2]+12,28);}
 if(b>=12&&b<56){const slots=bridge?[3,11]:b%2?[2,7,12]:lift?[2,9,14]:[9,14];slots.forEach((t,i)=>P(flowers,b,t,3,bridge?'warm-pad':'glass',a[(i+q)%4]+(bridge?0:12),bridge?22:26));}
 if(b>=4&&b<62){for(const t of bridge?[0,10]:[0,8,...(lift?[6]:[])])P(flowers,b,t,2,'hard-kick',48,55);for(const t of bridge?[8]:[4,12])P(flowers,b,t,2,'clap',48,37);for(const t of bridge?[14]:[2,6,10,14])if(!(lift&&t===6))P(flowers,b,t,2,lift?'open-hat':'hat',48,24);if(q===7&&!bridge)for(const t of [13,14,15])P(flowers,b,t,2,'tom',45+(t-13)*3,30+(t-13)*3);}
 if(b===7||b===31||b===39||b===55)P(flowers,b,12,3,'riser',60,24);
 if(outro&&b%2===0)P(flowers,b,8,3,'music-box',a[0]+12,23);
}
P(flowers,63,0,0,'sub',36,40,8);P(flowers,63,0,1,'mallet',72,42);P(flowers,63,0,2,'hard-kick',48,52);P(flowers,63,5,3,'glass',79,25);finish(flowers);
