// Säureblumen: original 96-bar score for one ACID/16 and four Paula channels.
import {writeFileSync} from 'node:fs';
const score={id:'SM004-Saeureblumen',title:'Säureblumen',album:'Small Machines — Erste Begegnungen',track:1,engine:'acid-paula',rate:44100,bpm:124,key:'D minor',bars:96,tail:5,swing:0,mix:{acid:.98,paula:.95,roomSeconds:1.45,reverb:.065,lufs:-17,fadeIn:.7,fadeOut:3,sidechain:.16},sections:[{bar:0,name:'Erstes Licht'},{bar:8,name:'Die Wurzeln'},{bar:24,name:'Blüten aus Kupfer'},{bar:40,name:'Ein stiller Innenhof'},{bar:48,name:'Der Garten antwortet'},{bar:64,name:'Alles in Bewegung'},{bar:80,name:'Nachglühen'},{bar:88,name:'Letzte Blüten'}],events:[]};
let id=0;const add=e=>score.events.push({id:id++,...e});
const note=(at,voice,sample,n,volume,gate)=>add({type:'paula',at,voice,sample,note:n,volume,...(gate!==undefined?{gate}:{})});
const roots=[38,34,41,36],thirds=[3,4,4,4];
const melodyA=[[[0,74,2],[3,77,1.5],[6,81,2],[10,79,1.8],[13,77,2.5]],[[0,74,2.4],[4,72,2],[7,70,2],[11,69,3]],[[0,72,2],[3,77,2],[7,76,2.4],[12,72,2.5]],[[0,67,2.5],[4,69,2],[8,72,2],[11,74,1],[14,72,1.6]]];
const melodyB=[[[1,69,1.5],[4,74,2],[8,77,2.7],[12,76,1.5],[14,74,1.5]],[[0,77,3],[5,74,2],[9,72,2],[12,70,3]],[[0,69,2],[4,72,1.8],[7,77,3.5],[12,79,2.5]],[[0,76,3],[5,74,2],[9,72,2],[13,69,2.6]]];
for(let bar=0;bar<96;bar++){
 const start=bar*16,bridge=bar>=40&&bar<48||bar>=80&&bar<88,intro=bar<8,outro=bar>=88,peak=bar>=64&&bar<80,chord=bar%4;
 let root=roots[chord],third=thirds[chord];if(bridge){root=[43,38,34,33][chord];third=[3,3,4,3][chord];}if(bar===95){root=38;third=3;}
 const baseCut=bar<8?110+bar*18:bar<24?240+(bar-8)*12:bar<40?500+(bar-24)*35:bar<48?180:bar<64?290+(bar-48)*28:bar<80?800+(bar-64)*22:bar<88?250:420-(bar-88)*40;
 for(let beat=0;beat<4;beat++)add({type:'tone',at:start+beat*4,cutoff:Math.round(baseCut*(1+.12*Math.sin((bar*4+beat)*.63))),resonance:bridge?43:peak?76:62,env:bridge?36:peak?70:55,decay:bridge?470:peak?210:285});
 let bass=bar%2===0?[0,null,0,12,third,0,null,7,0,0,third+12,null,12,7,third,-2]:[0,null,7,0,null,third,12,7,0,null,0,third,7,null,12,7];
 let slide=[2,7,9,13],accent=[0,4,8,14];
 if(bar<4)bass=[0,null,null,null,null,null,7,null,0,null,null,null,third,null,null,null];
 else if(bridge){bass=[0,null,null,null,null,null,7,null,null,null,null,null,12,null,null,null];slide=[];accent=[0];}
 else if(peak&&bar%4===3){bass=[0,0,12,7,third,null,0,7,12,7,third,0,-2,0,7,12];slide=[1,2,6,8,9,12,14];accent=[0,4,8,11,15];}
 if(outro)bass=bass.map((n,i)=>bar>91&&i%4!==0?null:n);if(bar===95)bass=[0,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];
 for(let st=0;st<16;st++)if(bass[st]!==null){const tied=st>0&&slide.includes(st-1)&&bass[st-1]!==null,outgoing=slide.includes(st)&&st<15&&bass[st+1]!==null;add({type:'acid',at:start+st,note:root+bass[st],accent:accent.includes(st),slide:tied,...(outgoing?{}:{gate:.64})});}
 const fullDrums=!intro&&!bridge&&!outro;
 if(fullDrums||bar>=4&&bar<8||bar>=88&&bar<92){for(const st of [0,4,8,12])note(start+st,0,'deep-kick',48,fullDrums?55:43);if(peak&&bar%4===3)note(start+15,0,'deep-kick',48,39);}
 if(fullDrums){for(const st of [2,6,10,14])note(start+st,1,st===14&&bar%2===1?'open-hat':'hat',48,st===6||st===14?22:17);for(const st of [4,12])note(start+st,1,bar%8===7?'clap':'snare',48,36+(peak?5:0));if(bar%8===7)for(const [st,n,v]of [[13,48,17],[14,50,24],[15,53,30]])note(start+st,1,'snare',n,v);}
 else if(bar>=4&&bar<8||bridge&&bar%2===0||bar>=88&&bar<92){for(const st of [2,10])note(start+st,1,'shaker',48,14);}
 if(bar<95){const voicing=[root+24,root+24+third,root+31,root+36],rhythm=bridge?[0,6,12]:intro?[0,8]:[0,3,6,10,13];for(let j=0;j<rhythm.length;j++)note(start+rhythm[j],3,bridge?'warm-pad':peak?'pluck':'epiano',voicing[(j+Math.floor(bar/4))%4],bridge?27:intro?30:26,bridge?4:2.5);}
 if(bar>=8&&bar<40||bar>=48&&bar<80){const phrase=bar<24||bar>=48&&bar<64?melodyA:melodyB;if(bar%8<6||peak)for(const [st,n,g]of phrase[chord])note(start+st,2,peak?'glass':'music-box',n+(bar>=56&&bar<64?-12:0),peak?36:30,g);}
 else if(bridge){const n=[74,72,70,69][chord];note(start+2,2,'glass',n,25,7);if(bar%2===1)note(start+11,2,'music-box',n-5,22,3);}
 else if(bar>=88){const n=[77,74,72,69,74,77,74,74][bar-88];note(start+(bar===95?0:3),2,'music-box',n,28-(bar-88),bar===95?10:5);}
}
// Resolve any same-channel, same-time drum fill into one intentional hit.
const unique=new Map();for(const e of score.events)unique.set(e.type==='paula'?`${e.at}:paula:${e.voice}`:`${e.at}:${e.type}`,e);score.events=[...unique.values()].sort((a,b)=>a.at-b.at||a.id-b.id);
writeFileSync(new URL('../scores/SM004-Saeureblumen.json',import.meta.url),JSON.stringify(score,null,2)+'\n');console.log(JSON.stringify({title:score.title,bars:score.bars,events:score.events.length,seconds:score.bars*240/score.bpm+score.tail}));
