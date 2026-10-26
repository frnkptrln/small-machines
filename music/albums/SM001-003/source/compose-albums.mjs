// Seventeen original compositions. Explicit themes, harmonic routes, and forms.
// No random melodies. Each solo instantiates only its own sound engine.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');mkdirSync(resolve(root,'scores'),{recursive:true});
const V=(wave,pw,a,d,s,r)=>({wave,pw,attack:a,decay:d,sustain:s,release:r,mute:false,ring:false,sync:false});
const patches={pulse:V(64,28,1,7,5,5),reed:V(64,37,3,8,8,6),triangle:V(16,50,3,10,5,9),bell:V(16,50,0,10,0,7),saw:V(32,50,2,7,5,5),bass:V(16,50,0,6,8,4),acid:V(64,19,0,7,3,3),arp:V(64,25,0,7,0,4),pad:V(16,50,7,9,6,9),kick:V(16,50,0,5,0,2),snare:V(128,50,0,5,0,2),hat:V(128,50,0,2,0,1)};
const scales={minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11],dorian:[0,2,3,5,7,9,10],mixolydian:[0,2,4,5,7,9,10]};
const albums={sid:'Drei Stimmen, eine Stadt',paula:'Diskettenblumen',duo:'Wo die Maschinen sich treffen'};
const degree=(c,d)=>c.tonic+12*Math.floor(d/7)+scales[c.mode][((d%7)+7)%7];
const rhythm={
 skipping:[[0,3,6,10,13],[1,6,11],[0,4,7,12],[2,8,13],[0,3,8,11,14],[1,5,10],[0,6,10,14],[0,5,9,13]],
 long:[[0,7],[2,10],[1,6,12],[0,9],[2,8],[0,5,11],[1,10],[0,6,12]],
 weave:[[0,2,5,8,11,14],[1,4,7,10,13],[0,3,6,9,12,15],[0,4,8,12],[1,3,6,9,11,14],[0,3,7,10,14],[0,2,5,9,12],[1,5,8,11,14]],
 offbeat:[[1,4,7,11,14],[2,6,12],[1,5,8,13],[0,6,10],[2,5,9,12,15],[1,7,12],[0,3,9,13],[2,8,12]],
 sparse:[[1,10],[4],[0,8],[3,12],[0,7],[5],[2,11],[0,10]]
};
// Degree numbers are relative to each named key. Both themes are independently
// written eight-bar phrases; a return quotes A with a short altered cadence.
const works=[
 {engine:'sid',track:1,title:'Stadt aus Strom',bpm:112,bars:96,tonic:60,mode:'dorian',key:'c-Dorisch',style:'drive',rhythm:'skipping',lead:'pulse',swing:.035,progress:[0,0,5,5,3,3,6,4],bridge:[2,5,1,4],
  A:[[7,9,11,12,11],[9,8,7],[9,11,14,12],[11,9,7],[10,12,14,15,14],[12,10,9],[8,10,12,10],[11,10,8,7]],B:[[14,12,11,9,11],[12,11,8],[10,12,15,14],[12,10,8],[11,14,16,15,14],[12,11,9],[10,8,7,8],[11,10,8,7]],description:'Eine kleine Stadtrundfahrt: federnder Puls, Dreieckskick und ein heller dorischer Refrain.'},
 {engine:'sid',track:3,title:'Lötzinnlibellen',bpm:128,bars:112,tonic:62,mode:'major',key:'D-Dur',style:'weave',rhythm:'weave',lead:'bell',swing:.015,progress:[0,4,5,3,0,2,1,4],bridge:[5,3,1,4],
  A:[[7,9,11,9,8,7],[6,8,10,11,10],[9,11,12,14,12,11],[10,9,7,5],[7,11,14,16,14,11],[9,8,6,8,11],[8,10,12,11,10],[6,8,10,8,7]],B:[[11,14,16,14,11,9],[10,13,15,13,10],[12,14,16,18,16,14],[12,10,9,7],[11,9,7,9,11,14],[12,11,9,8,6],[10,12,15,12,10],[8,10,13,11,7]],description:'Drei ineinandergreifende Stimmen: ein heller Kanon, dessen Antworten immer einen Moment später auftauchen.'},
 {engine:'sid',track:5,title:'Nachtbus 03:17',bpm:90,bars:96,tonic:64,mode:'minor',key:'e-Moll',style:'dub',rhythm:'offbeat',lead:'reed',swing:.12,progress:[0,0,3,3,5,5,4,4],bridge:[2,6,3,4],
  A:[[7,9,8,7,4],[6,4,2],[7,10,9,7],[5,7,9],[10,12,11,9,7],[8,7,4],[6,8,11,8],[9,8,6,4]],B:[[11,10,8,7,8],[9,7,6],[10,12,14,12],[10,9,7],[12,14,15,14,11],[10,8,7],[8,11,13,11],[9,8,6,7]],description:'Ein langsamer, synkopierter Nachtgroove. Im Mittelteil bleibt die Melodie kurz allein an der Haltestelle.'},
 {engine:'sid',track:6,title:'Fenster ohne Schlaf',bpm:136,bars:96,tonic:57,mode:'minor',key:'a-Moll',style:'drive',rhythm:'weave',lead:'saw',swing:.02,progress:[0,5,2,6,0,3,5,4],bridge:[3,2,1,4],
  A:[[14,11,9,7,9,11],[12,11,9,7,5],[11,14,16,14,11,9],[10,8,6,8],[7,9,11,14,11,9],[10,12,14,12,10],[12,14,16,14,12],[11,10,8,7,4]],B:[[11,12,14,16,14,12],[12,14,17,16,14],[16,14,11,9,11,14],[15,13,10,8],[14,16,18,16,14,11],[12,10,7,10,12],[14,12,9,12,14],[13,11,10,8,7]],description:'Die schnellste SID-Seite: ein unruhiger Sägezahn und kleine Rauschfahnen zwischen den Bassnoten.'},
 {engine:'sid',track:7,title:'Wir bleiben kurz',bpm:78,bars:80,tonic:65,mode:'major',key:'F-Dur',style:'quiet',rhythm:'long',lead:'triangle',swing:.04,progress:[0,0,5,5,3,3,1,4],bridge:[2,5,3,4],
  A:[[7,9],[8,7],[9,11,12],[11,9],[10,12],[11,10,7],[8,10],[8,6,7]],B:[[14,11],[12,9],[11,14,16],[14,12],[12,10],[11,9,7],[10,8],[9,8,7]],description:'Ein ruhiges Dreieckstrio. Lange Atemzüge und eine zweite Stimme, die erst spät zu einer eigenen Melodie wird.'},
 {engine:'sid',track:8,title:'Morgen im RAM',bpm:104,bars:112,tonic:62,mode:'dorian',key:'d-Dorisch',style:'dawn',rhythm:'skipping',lead:'reed',swing:.055,progress:[0,3,0,5,2,6,3,0],bridge:[5,2,1,4],
  A:[[7,8,11,12,11],[10,9,7],[7,11,14,12],[9,7,5],[9,11,14,16,14],[13,11,10],[10,12,14,12],[11,9,8,7]],B:[[11,14,16,15,14],[12,10,9],[14,12,11,9],[12,14,16],[11,9,7,9,11],[10,13,15],[12,10,8,7],[9,8,7,7]],description:'Die Stadt wird heller. Aus kurzen Impulsen entsteht ein offener Schluss mit Orgelpulsen und einer wiederkehrenden Dreiecksantwort.'},
 {engine:'paula',track:1,title:'Unter dem Ladekopf',bpm:108,bars:96,tonic:62,mode:'dorian',key:'d-Dorisch',style:'wood',rhythm:'offbeat',lead:'pluck',answer:'organ',swing:.09,progress:[0,0,3,3,5,2,6,4],bridge:[2,5,1,4],
  A:[[7,9,11,10,9],[7,4,7],[10,12,14,12],[10,7,5],[12,11,9,7,9],[11,14,12],[10,8,6,8],[11,10,8,7]],B:[[14,12,11,9,11],[12,9,7],[12,14,17,14],[12,10,7],[14,16,14,12,9],[11,9,7],[13,10,8,6],[11,10,8,7]],description:'Nylonsaiten aus acht Bit, Holzpercussion und eine kleine Orgel. Der Garten wird langsam eingeschaltet.'},
 {engine:'paula',track:3,title:'Kupferregen',bpm:142,bars:112,tonic:60,mode:'minor',key:'c-Moll',style:'breaks',rhythm:'weave',lead:'epiano',answer:'mallet',swing:.025,progress:[0,0,5,3,2,2,6,4],bridge:[3,5,1,4],
  A:[[7,9,11,14,11,9],[8,7,4,7,9],[12,11,9,7,5,7],[10,12,14,12],[11,14,16,18,16,14],[12,11,9,11,14],[13,10,8,6,8],[11,10,8,7,4]],B:[[14,16,18,16,14,11],[12,14,11,9,7],[16,14,12,9,7,9],[14,12,10,7],[16,18,21,18,16,14],[16,14,11,9,11],[15,13,10,8,6],[13,11,10,8,7]],description:'Ein lebhafter Vierkanal-Breakbeat. Elektrische Tasten fallen in kurzen Linien, während Marimba-Antworten dazwischenblitzen.'},
 {engine:'paula',track:5,title:'Rasterklee',bpm:120,bars:104,tonic:67,mode:'major',key:'G-Dur',style:'garden',rhythm:'skipping',lead:'mallet',answer:'glass',swing:.045,progress:[0,4,5,2,3,0,1,4],bridge:[5,3,2,4],
  A:[[7,9,11,9,8],[6,8,11],[9,12,14,12],[11,9,6],[10,12,14,12,10],[11,9,7],[8,10,12,10],[8,6,4,7]],B:[[14,11,9,7,9],[10,11,13],[12,14,16,14],[13,11,9],[12,14,17,14,12],[14,11,9],[12,10,8,10],[11,10,8,7]],description:'Eine helle Tracker-Miniatur mit einem längeren Weg durch den Mittelteil. Die Mallets springen über gläserne Gegenstimmen.'},
 {engine:'paula',track:6,title:'Magnetischer Sommer',bpm:128,bars:120,tonic:63,mode:'major',key:'Es-Dur',style:'house',rhythm:'offbeat',lead:'epiano',answer:'music-box',swing:.06,progress:[0,5,3,4,0,2,5,4],bridge:[3,1,5,4],
  A:[[7,11,14,11,9],[12,11,9],[10,12,14,12],[11,13,11],[14,11,9,7,9],[11,9,6],[12,14,16,14],[13,11,8,7]],B:[[14,16,18,16,14],[16,14,12],[17,14,12,10],[15,13,11],[18,16,14,11,9],[13,11,9],[16,14,12,9],[13,11,8,7]],description:'Ein warmer, tanzender Sommertag aus E-Piano, Spieluhr und einem Vierkanalbass. Eine lange Öffnung führt zum zweiten Refrain.'},
 {engine:'paula',track:7,title:'Die letzte Diskette',bpm:84,bars:88,tonic:59,mode:'minor',key:'h-Moll',style:'quiet',rhythm:'long',lead:'glass',answer:'choir',swing:.07,progress:[0,0,5,5,2,2,3,4],bridge:[3,6,1,4],
  A:[[7,11],[10,9],[12,11,9],[7,5],[9,14],[12,11,9],[10,12],[11,8,7]],B:[[14,12],[11,9],[16,14,12],[11,9],[14,16],[18,16,14],[12,10],[11,8,7]],description:'Gläserne Töne und eine synthetische Vokalwolke. Die Percussion setzt aus, als würde das Laufwerk noch nach einer Erinnerung suchen.'},
 {engine:'paula',track:8,title:'Bitte nicht ausschalten',bpm:76,bars:96,tonic:65,mode:'major',key:'F-Dur',style:'ambient',rhythm:'sparse',lead:'epiano',answer:'warm-pad',swing:.03,progress:[0,0,3,3,5,5,1,4],bridge:[2,5,3,0],
  A:[[7,11],[9],[10,12],[11,10],[12,14],[11],[8,10],[8,7]],B:[[14,11],[12],[17,14],[12,10],[16,14],[12],[10,8],[9,7]],description:'Ein langsamer Abspann aus vier Samplekanälen. Die Melodie löst sich in einzelne Töne auf; die letzte Quinte bleibt offen.'},
 {engine:'duo',track:1,title:'Zwei Fenster offen',bpm:100,bars:96,tonic:60,mode:'major',key:'C-Dur',style:'wood',rhythm:'skipping',lead:'reed',answer:'epiano',swing:.08,progress:[0,5,3,4,0,2,1,4],bridge:[5,2,3,4],
  A:[[7,9,11,14,11],[12,11,9],[10,12,14,12],[11,8,6],[7,11,14,16,14],[13,11,9],[8,10,12,10],[11,8,6,7]],B:[[14,12,11,9,11],[16,14,12],[17,14,12,10],[15,13,11],[18,16,14,11,9],[13,11,9],[12,10,8,10],[11,8,6,7]],description:'SID öffnet das erste Fenster, Paula das zweite. Die beiden Themen antworten sich und treffen sich erst später im selben Refrain.'},
 {engine:'duo',track:4,title:'Die Maschinen besuchen sich',bpm:124,bars:112,tonic:62,mode:'minor',key:'d-Moll',style:'exchange',rhythm:'offbeat',lead:'pulse',answer:'mallet',swing:.035,progress:[0,5,2,6,0,3,5,4],bridge:[2,3,1,4],
  A:[[7,9,11,9,7],[12,11,9],[11,14,16,14],[13,10,8],[14,11,9,7,9],[12,10,7],[12,14,16,14],[11,10,8,7]],B:[[11,14,16,14,11],[16,14,12],[18,16,14,11],[15,13,10],[16,14,11,9,7],[14,12,10],[16,14,12,9],[13,11,8,7]],description:'Ein Instrumententausch: dieselbe Frage wandert zwischen Pulston und Marimba. Beide behalten ihre eigene Art zu antworten.'},
 {engine:'duo',track:5,title:'Gemeinsam um drei',bpm:114,bars:112,tonic:57,mode:'dorian',key:'a-Dorisch',style:'house',rhythm:'weave',lead:'saw',answer:'epiano',swing:.08,progress:[0,0,3,3,5,2,6,4],bridge:[5,3,2,4],
  A:[[7,9,11,9,7,4],[7,8,9,11,9],[10,12,14,12,10,7],[10,12,14,10],[12,14,16,14,12,9],[11,14,16,14,11],[13,10,8,6,8],[11,10,8,7,4]],B:[[14,16,18,16,14,11],[12,14,16,14,11],[17,14,12,10,12,14],[17,14,12,10],[16,14,12,9,12,14],[18,16,14,11,9],[15,13,10,8,6],[13,11,10,8,7]],description:'Eine gemeinsame Clubseite. Der SID trägt Bass und Melodie; Paula antwortet mit Tasten, Luft und einem geraden Puls.'},
 {engine:'duo',track:7,title:'Kleine Welt bei Nacht',bpm:88,bars:96,tonic:66,mode:'minor',key:'fis-Moll',style:'quiet',rhythm:'long',lead:'triangle',answer:'glass',swing:.06,progress:[0,0,5,5,2,2,6,4],bridge:[3,5,1,4],
  A:[[7,9],[11,9],[12,11,9],[7,5],[9,14],[12,11,9],[10,8],[11,8,7]],B:[[14,16],[17,16],[16,14,12],[11,9],[14,16],[17,16,14],[13,10],[11,8,7]],description:'Ein Nachtstück mit viel Raum zwischen den Stimmen. Kleine gläserne Antworten bewegen sich um einen langsamen Dreieckston.'},
 {engine:'duo',track:8,title:'Es geht noch weiter',bpm:116,bars:120,tonic:62,mode:'major',key:'D-Dur',style:'dawn',rhythm:'skipping',lead:'reed',answer:'music-box',swing:.045,progress:[0,5,3,4,2,5,1,4],bridge:[5,2,3,0],
  A:[[7,9,11,14,11],[12,11,9],[10,12,14,12],[11,8,6],[9,11,14,16,14],[16,14,12],[10,12,15,12],[11,10,8,7]],B:[[14,16,18,16,14],[16,14,12],[17,14,12,10],[15,13,11],[16,18,19,18,16],[19,16,14],[17,15,12,10],[11,10,8,7]],description:'Ein offenes Finale. Die Melodie aus dem ersten Fenster wächst weiter, bis beide Maschinen nur noch leise aufeinander antworten.'}
];
function add(s,type,bar,at,voice,note,gate,extra={}){s.events.push({type,at:bar*16+at,voice,note,...(gate===undefined?{}:{gate}),...extra});}
function sid(s,b,t,v,n,g=2,patch){add(s,'sid',b,t,v,n,g,patch?{patch}:{});}
function pcm(s,b,t,v,sample,n,volume,g){add(s,'paula',b,t,v,n,g,{sample,volume});}
function drumSID(s,b,t,kind,soft=false){add(s,'sid',b,t,2,kind==='kick'?63:kind==='hat'?89:54,kind==='hat'?.3:.9,{patch:patches[kind],vibrato:false,...(kind==='kick'?{sweep:{to:29,seconds:.023}}:{})});}
const stageNames=['Ankommen','Erstes Thema','Bewegung','Zwischenraum','Zweites Thema','Wiederkehr','Nachklang'];
for(const c of works){
 const quiet=['quiet','ambient'].includes(c.style),woven=c.style==='weave',bounds=[0,8,24,40,48,64,c.bars-8,c.bars];
 const s={format:'small-machines-album-composition',version:1,engine:c.engine,track:c.track,id:`${c.engine.toUpperCase()}-${String(c.track).padStart(2,'0')}`,album:albums[c.engine],title:c.title,bpm:c.bpm,bars:c.bars,swing:c.swing,key:c.key,description:c.description,origin:'new composition',rate:44100,tail:8,recording_revision:3,voices:[patches[c.engine==='paula'?'triangle':c.lead],patches[c.style==='house'?'acid':'bass'],patches[quiet||woven?'arp':'hat']],sections:stageNames.map((name,i)=>({name,start:bounds[i],end:bounds[i+1]})),mix:{sid:c.engine==='paula'?0:c.engine==='duo'?.58:.76,paula:c.engine==='sid'?0:1.25,sidechain:c.engine==='duo'&&!quiet?.12:0,echo:quiet?24:woven?15:11,width:78,reverb:quiet?.13:.07,roomSeconds:quiet?1.9:1.15,lufs:quiet?-18:-16.5,fadeIn:quiet?2.5:.9,fadeOut:6},events:[]};
 for(let b=0;b<c.bars;b++){
  const phase=bounds.findIndex((end,i)=>i>0&&b<end)-1,local=b-bounds[phase],q=local%8,opening=phase===0,air=phase===3,ending=phase===6,second=phase===4,lift=phase===5||phase===2,active=!opening&&!ending;
  const degreeRoot=(air?c.bridge[Math.floor(local/2)%4]:c.progress[q]),chord=[degreeRoot,degreeRoot+2,degreeRoot+4,degreeRoot+6],r=degree(c,degreeRoot)-24;
  s.events.push({at:b*16,type:'tone',cutoff:quiet?1280+phase*22:air?1190:lift?1740:1470+(q%4)*35,paulaFilter:quiet?48+phase*2:air?50:lift?75:64});
  // Bass lines are composed by feel; the phrase's last bar anticipates the next chord.
  let bass=quiet||air?[[0,r,11],[12,r+7,3]]:c.style==='house'?[[0,r,2.1],[4,r,1.8],[7,r+12,1.5],[10,r+7,1.8],[14,r+12,1.4]]:c.style==='dub'?[[1,r,3],[7,r,2],[11,r+7,3]]:[[0,r,2.2],[3,r,1.4],[6,r+12,1.5],[8,r,2],[11,r+7,1.4],[14,r+12,1.6]];
  if(opening)bass=b<4?[]:[[0,r,12]];if(ending)bass=local<4?[[0,r,11]]:local===4?[[0,degree(c,0)-24,45]]:[];
  for(const [t,n,g]of bass){if(c.engine==='paula')pcm(s,b,t,0,c.style==='house'?'acid':quiet?'sub':'hollow-bass',n,quiet?32:40,g);else sid(s,b,t,1,n,g);}
  // Two hand-written themes. The reprise opens an octave window and changes its cadence.
  const motif=(second?c.B:c.A)[q],slots=rhythm[c.rhythm][q];
  let lead=[];
  if(active&&!air)lead=slots.map((t,j)=>[t,degree(c,motif[j%motif.length]),Math.min(quiet?6:2.8,(slots[j+1]??16)-t-.35)]);
  if(air)lead=[[1,degree(c,chord[2]+7),5.5],[10,degree(c,chord[1]+7),4]];
  if(opening&&b%2===0)lead=[[1,degree(c,c.A[q][0]),3],[10,degree(c,c.A[q][Math.min(1,c.A[q].length-1)]),3]];
  if(ending&&local<4)lead=[[1,degree(c,c.A[q][0]),4],[9,degree(c,c.A[q].at(-1)),4]];
  if(ending&&local===4)lead=[[0,degree(c,7),23]];
  if(phase===5&&q===7&&local>=8)lead=[[0,degree(c,11),2],[4,degree(c,9),2],[8,degree(c,8),2],[12,degree(c,7),3]];
  const exchange=c.engine==='duo'&&(c.style==='exchange'?Math.floor(local/4)%2===1:second&&q%2===1);
  for(const [t,n,g]of lead){
   if(c.engine==='paula'||exchange)pcm(s,b,t,1,air?(quiet?'glass':'epiano'):c.engine==='paula'?c.lead:c.answer,n,quiet?32:lift?43:38,g>5?g:undefined);
   else sid(s,b,t,0,n,g);
  }
  // SID's third lane either answers harmonically or shares kick/snare/noise.
  if(c.engine==='sid'){
   if(quiet||woven||air||c.style==='dawn'&&phase<2){
    const arpSlots=quiet?[2,7,12]:woven?[0,3,6,9,12,15]:[3,11];
    if(!ending||local<5)arpSlots.forEach((t,j)=>sid(s,b,t,2,degree(c,chord[(j+q)%4])+(lift?12:0),quiet?3:1.5,patches.arp));
   }else if(!ending||local<4){
    const kicks=c.style==='dub'?[0,7,10]:[0,8,...(lift&&q%2?[6]:[])];
    if(b>=4){for(const t of kicks)drumSID(s,b,t,'kick');for(const t of [4,12])drumSID(s,b,t,'snare');for(const t of [2,6,10,14])if(!kicks.includes(t))drumSID(s,b,t,'hat');if(q===7&&lift){drumSID(s,b,14.5,'snare',true);drumSID(s,b,15.3,'snare');}}
   }
  }else{
   // A four-channel Paula solo reserves lane 0 bass / 1 melody / 2 percussion /
   // 3 harmony. In duets SID takes the bass, freeing Paula 0 for longer kicks.
   const harmonyVoice=3,answerSample=air?'warm-pad':c.engine==='paula'?c.answer:quiet?'warm-pad':'pluck';
   if(!ending||local<5){
    const hs=quiet?[0,9]:air?[0,8]:lift?[1,5,9,13]:[2,7,12];
    hs.forEach((t,j)=>pcm(s,b,t,harmonyVoice,answerSample,degree(c,chord[(j+(q%2))%4])+(answerSample==='music-box'?12:0),quiet?23:27,answerSample==='organ'?2.5:undefined));
   }
   if(c.engine==='duo'){
    if(!ending||local<5){const arpSlots=quiet?[3,11]:air?[4,12]:[2,6,10,14];arpSlots.forEach((t,j)=>sid(s,b,t,2,degree(c,chord[(j+q)%4]),quiet?5:1.4,quiet?patches.pad:patches.arp));}
    if(!exchange&&active&&!air&&q%2===1){const response=c.B[q];[3,9,14].forEach((t,j)=>pcm(s,b,t,1,c.answer,degree(c,response[(j+1)%response.length]),quiet?25:30));}
   }
   if(b>=4&&(!ending||local<4)&&c.style!=='ambient'){
    const drumVoice=2,kickVoice=c.engine==='duo'?0:2;
    const half=quiet||air;
    const kicks=half?(b%2===0?[0]:[]):c.style==='house'?[0,4,8,12]:c.style==='breaks'?[0,6,10.5]:[0,8,...(q%2?[11]:[])];
    const sn=half?[8]:c.style==='wood'?[5,12]:[4,12];
    const hats=half?[14]:c.style==='breaks'?[2,3,7,9,13,14,15]:[2,6,10,14];
    for(const t of kicks)pcm(s,b,t,kickVoice,c.style==='breaks'?'hard-kick':'deep-kick',48,half?36:52);
    for(const t of sn)if(c.engine==='duo'||!kicks.includes(t))pcm(s,b,t,drumVoice,half||c.style==='wood'?'rim':c.style==='house'?'clap':'snare',48,half?21:34);
    for(const t of hats)if(!(q===7&&lift&&t>=13)&&!sn.includes(t)&&(c.engine==='duo'||!kicks.includes(t)))pcm(s,b,t,drumVoice,quiet||c.style==='wood'?'shaker':lift?'open-hat':'hat',48,half?14:19+(t===2?4:0));
    if(q===7&&lift)for(const [t,n]of [[13,46],[14.5,43],[15.3,41]])pcm(s,b,t,drumVoice,'tom',n,27);
   }
   if(ending&&local===6)pcm(s,b,0,3,'glass',degree(c,11),19);
  }
 }
 s.events.sort((a,b)=>a.at-b.at||(['tone','paula','sid'].indexOf(a.type)-['tone','paula','sid'].indexOf(b.type)));s.events.forEach((e,id)=>e.id=id);
 if(s.events.some(e=>e.type!=='tone'&&s.engine!=='duo'&&e.type!==s.engine))throw Error('Foreign solo source');
 // Every voice has a single note start per instant; collisions would silently cut notes.
 const starts=new Set();for(const e of s.events.filter(e=>e.type!=='tone')){const k=`${e.type}:${e.voice}:${e.at}`;if(starts.has(k))throw Error(`Collision ${s.id} ${k}`);starts.add(k);if(e.note<24||e.note>96)throw Error('Pitch outside designed range');}
 writeFileSync(resolve(root,'scores',s.id+'.json'),JSON.stringify(s,null,2));console.log(JSON.stringify({id:s.id,title:s.title,seconds:s.bars*240/s.bpm+s.tail,events:s.events.length}));
}
