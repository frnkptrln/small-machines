import {M68K,assemble68} from './m68k.mjs';
import {EXTRA_SAMPLES} from './sound-bank.mjs';
export const PAULA_CLOCK=3546895;
export const PAULA_DRIVER=`; PAULA/68 • 68000 music subset
; Der Host legt eine Zeile bei $2000 ab.
; Vier Blöcke: Pointer.L, Länge.W, Periode.W, Volumen.W
; $2030: DMA löschen / $2032: DMA setzen
.org $1000
play:
  MOVE.W $2030,$DFF096
  LEA $2000,A0
  LEA $DFF0A0,A1
  MOVEQ #3,D0
channel:
  MOVE.L (A0)+,(A1)+
  MOVE.W (A0)+,(A1)+
  MOVE.W (A0)+,(A1)+
  MOVE.W (A0)+,(A1)+
  ADDQ.L #6,A1
  DBRA D0,channel
  MOVE.W $2032,$DFF096
  RTS`;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let seed=0x683200;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;}
const sample=(id,name,rate,root,length,fn)=>{const pcm=new Int8Array(length+(length&1));for(let i=0;i<length;i++)pcm[i]=Math.round(clamp(fn(i/rate,i),-1,1)*120);return {id,name,rate,root,pcm};};
function builtins(){seed=0x683200;let phase=0,last=0;return [
 sample('kick','01 · Soft kick',11025,48,4400,t=>{phase+=2*Math.PI*(45+115*Math.exp(-t*30))/11025;return Math.sin(phase)*Math.exp(-t*10)+random()*.12*Math.exp(-t*100);}),
 sample('snare','02 · Paper snare',11025,48,3000,t=>(random()*.65+Math.sin(t*2*Math.PI*170)*.3)*Math.exp(-t*20)*Math.min(1,t*1600)),
 sample('glass','03 · Glass memory',22050,60,30000,t=>{let f=261.625565;return (Math.sin(2*Math.PI*f*t)*.56+Math.sin(2*Math.PI*f*2.003*t)*.24*Math.exp(-t*3)+Math.sin(2*Math.PI*f*4.01*t)*.13*Math.exp(-t*7))*Math.exp(-t*3.4)*Math.min(1,t*500);}),
 sample('bass','04 · Velvet cycle',16744,36,256,(t,i)=>Math.sin(i/256*2*Math.PI)*.72+Math.sin(i/256*4*Math.PI)*.18+Math.sin(i/256*6*Math.PI)*.07),
 sample('hat','05 · Dust hat',16000,48,1700,t=>{let n=random(),out=n-last;last=n;return out*.45*Math.exp(-t*55)*Math.min(1,t*2500);}),
 sample('chord','06 · Silver chord',16000,60,30000,t=>{let x=0;for(const ratio of [1,1.259921,1.498307])x+=Math.sin(t*2*Math.PI*130.81278*ratio)*.21+Math.sin(t*2*Math.PI*261.62556*ratio)*.07;return x*Math.min(1,t*45)*Math.exp(-t*2.7);})];}
const legacyMeta=[
 ['Drums','Weiche Bassdrum mit einem kleinen Rauschanschlag.',false],
 ['Drums','Kurzer, papierartiger Snare-Sound.',false],
 ['Keys','Gläserner, sanft ausklingender Tastenklang.',false],
 ['Bässe','Warmer, nahtloser Basszyklus.',true],
 ['Drums','Geschlossene, staubige Hi-Hat.',false],
 ['Flächen','Ein silbriger Dur-Akkord.',false]
];
export const SAMPLE_BANK=[...builtins().map((s,i)=>({...s,category:legacyMeta[i][0],description:legacyMeta[i][1],loop:legacyMeta[i][2]})),...EXTRA_SAMPLES];
// Retain all six legacy sample addresses and all four custom slots. Pack the
// expansion into the previously unused final 128 KiB, on even boundaries.
export const SAMPLE_ADDRESSES=new Map();let expansionAddress=0x60000;
for(let i=0;i<SAMPLE_BANK.length;i++){const s=SAMPLE_BANK[i],address=i<6?0x10000+i*32768:expansionAddress;if(i>=6)expansionAddress+=s.pcm.length;if(expansionAddress>0x80000)throw Error('Klangbank überschreitet das Chip-RAM.');SAMPLE_ADDRESSES.set(s.id,address);}
export function assignSample(project,channel,id){
 if(!Number.isInteger(channel)||channel<0||channel>3)throw Error('Ungültiger Kanal.');
 const sample=SAMPLE_BANK.find(s=>s.id===id)||( /^custom[0-3]$/.test(id) ? project.custom[+id.slice(-1)] : null);
 if(!sample)throw Error('Sample fehlt.');
 project.channels[channel].sample=id;project.channels[channel].loop=sample.loop===true;return sample;
}
export const SAMPLE_NAMES=Object.fromEntries(SAMPLE_BANK.map(s=>[s.id,s.name]));
const channel=(sample,volume=48,loop=false)=>({sample,volume,loop,mute:false});
export const PAULA_PRESETS=[
 {name:'01 · Diskette Dreams',bpm:112,filter:52,echo:24,width:70,channels:[channel('kick',54),channel('glass',43),channel('snare',35),channel('bass',42,true)],patterns:[[48,null,null,null,48,null,null,null,48,null,null,null,48,null,null,null],[60,null,67,null,70,null,67,null,63,null,70,null,74,null,70,67],[null,null,null,null,48,null,null,null,null,null,null,null,48,null,null,null],[36,null,null,null,36,null,43,null,32,null,null,null,32,null,39,null]]},
 {name:'02 · Copper Rain',bpm:126,filter:64,echo:18,width:85,channels:[channel('kick',50),channel('chord',42),channel('hat',22),channel('bass',46,true)],patterns:[[48,null,null,null,48,null,null,null,48,null,null,null,48,null,48,null],[60,null,null,null,null,null,63,null,58,null,null,null,null,null,65,null],[48,null,48,null,48,null,48,48,48,null,48,null,48,null,48,48],[36,null,36,null,43,null,36,48,34,null,34,null,41,null,34,46]]},
 {name:'03 · Workbench at Dawn',bpm:76,filter:38,echo:38,width:60,channels:[channel('glass',45),channel('chord',37),channel('hat',17),channel('bass',36,true)],patterns:[[60,null,null,67,null,null,70,null,63,null,null,70,null,74,null,null],[60,null,null,null,null,null,null,null,56,null,null,null,null,null,null,null],[null,null,43,null,null,null,48,null,null,null,43,null,null,null,48,null],[36,null,null,null,null,null,43,null,32,null,null,null,null,null,39,null]]},
 {name:'04 · Blank Disk',bpm:112,filter:55,echo:20,width:70,channels:[channel('kick',48),channel('glass',48),channel('snare',42),channel('bass',42,true)],patterns:Array.from({length:4},()=>Array(16).fill(null))},
 {name:'05 · Velvet Circuit',bpm:96,filter:62,echo:22,width:65,channels:[channel('deep-kick',52),channel('epiano',47),channel('clap',32),channel('sub',43,true)],patterns:[[48,null,null,null,null,null,48,null,48,null,null,48,null,null,48,null],[60,null,null,67,null,null,63,null,58,null,null,65,null,62,null,null],[null,null,null,null,48,null,null,null,null,null,null,null,48,null,null,null],[36,null,null,null,43,null,null,null,34,null,null,null,41,null,null,null]]},
 {name:'06 · Pocket Arcade',bpm:132,filter:70,echo:15,width:80,channels:[channel('hard-kick',49),channel('music-box',43),channel('open-hat',24),channel('acid',40,true)],patterns:[[48,null,null,null,48,null,null,null,48,null,null,null,48,null,48,null],[72,null,79,84,79,null,76,null,74,null,81,86,81,null,77,null],[null,null,48,null,null,null,48,null,null,null,48,null,null,null,48,48],[36,null,48,null,43,null,48,null,38,null,50,null,45,null,50,null]]},
 {name:'07 · Amber Room',bpm:72,filter:48,echo:32,width:80,channels:[channel('warm-pad',42),channel('pluck',43),channel('shaker',24),channel('hollow-bass',35,true)],patterns:[[60,null,null,null,null,null,null,null,57,null,null,null,null,null,null,null],[60,null,null,67,null,64,null,null,57,null,null,64,null,60,null,null],[null,null,48,null,null,null,48,null,null,null,48,null,null,null,48,null],[36,null,null,null,null,null,43,null,33,null,null,null,null,null,40,null]]},
 {name:'08 · Wooden Satellites',bpm:108,filter:68,echo:24,width:60,channels:[channel('tom',47),channel('mallet',48),channel('rim',35),channel('organ',33,true)],patterns:[[43,null,null,null,null,null,48,null,43,null,null,null,null,48,null,null],[60,null,67,null,72,null,67,64,62,null,69,null,74,null,69,65],[null,null,null,48,null,null,null,48,null,null,null,48,null,null,48,null],[48,null,null,null,null,null,null,null,50,null,null,null,null,null,null,null]]}
];
export const freshPaula=(i=0)=>({...JSON.parse(JSON.stringify(PAULA_PRESETS[i])),kind:'paula68',version:1,custom:[null,null,null,null],source:PAULA_DRIVER});
export function validatePaula(p){const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;if(!p||p.kind!=='paula68'||p.version!==1||typeof p.name!=='string'||p.name.length>100)throw Error('Keine PAULA/68-Datei.');for(const [key,a,b]of [['bpm',40,220],['filter',0,100],['echo',0,60],['width',0,100]])if(!num(p[key],a,b))throw Error('Ungültiger Wert: '+key);if(!Array.isArray(p.channels)||p.channels.length!==4||!Array.isArray(p.patterns)||p.patterns.length!==4||!Array.isArray(p.custom)||p.custom.length!==4)throw Error('Vier Paula-Kanäle erforderlich.');for(const s of p.custom)if(s!==null){if(!s||typeof s.name!=='string'||s.name.length>80||!num(s.rate,4000,28000)||!Number.isInteger(s.root)||!num(s.root,24,96)||!Array.isArray(s.pcm)||s.pcm.length<2||s.pcm.length>32768||s.pcm.length%2||s.pcm.some(n=>!Number.isInteger(n)||n< -128||n>127))throw Error('Ungültiges 8-Bit-Sample.');}for(const c of p.channels){if(!c||!Number.isInteger(c.volume)||!num(c.volume,0,64)||typeof c.loop!=='boolean'||typeof c.mute!=='boolean')throw Error('Ungültiger Kanal.');if(!SAMPLE_NAMES[c.sample]&&!/^custom[0-3]$/.test(c.sample))throw Error('Unbekanntes Sample.');if(c.sample?.startsWith('custom')&&!p.custom[+c.sample.slice(-1)])throw Error('Sample fehlt.');}for(const pat of p.patterns)if(!Array.isArray(pat)||pat.length!==16||pat.some(n=>n!==null&&(!Number.isInteger(n)||!num(n,24,96))))throw Error('Ungültige Noten.');assemble68(p.source);return p;}
export function pcmTo8SVX(s){const n=s.pcm.length,padded=n+(n&1),buf=new ArrayBuffer(48+padded),v=new DataView(buf),str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};str(0,'FORM');v.setUint32(4,40+padded);str(8,'8SVX');str(12,'VHDR');v.setUint32(16,20);v.setUint32(20,n);v.setUint32(24,0);v.setUint32(28,0);v.setUint16(32,Math.round(s.rate));v.setUint8(34,1);v.setUint8(35,0);v.setUint32(36,65536);str(40,'BODY');v.setUint32(44,n);new Int8Array(buf,48,n).set(s.pcm);return buf;}
export class Paula {
 constructor(rate,mem){this.rate=rate;this.mem=mem;this.dma=0;this.channels=Array.from({length:4},()=>({pointer:0,length:2,period:428,volume:0,active:false,pos:0,base:0,count:0,value:0,loop:false}));this.out=new Float64Array(2);this.ended=0;}
 write(addr,value){if(addr===0xdff096){this.dma=value&0x8000?this.dma|(value&0x7fff):this.dma&~value;for(let i=0;i<4;i++){const c=this.channels[i],active=!!((this.dma&0x200)&&(this.dma&(1<<i)));if(active&&!c.active){c.base=c.pointer;c.count=c.length;c.pos=0;}c.active=active;}return;}
 const offset=addr-0xdff0a0,i=offset>>4,r=offset&15;if(i<0||i>3)return;const c=this.channels[i];if(r===0)c.pointer=(c.pointer&65535)|((value&7)<<16);else if(r===2)c.pointer=(c.pointer&0x70000)|(value&0xfffe);else if(r===4)c.length=(value||65536)*2;else if(r===6)c.period=Math.max(124,value||65536);else if(r===8)c.volume=value&64?64:value&63;
 }
 sample(){this.out.fill(0);this.ended=0;for(let i=0;i<4;i++){const c=this.channels[i];c.value=0;if(!c.active)continue;if(c.pos>=c.count){if(c.loop){c.pos%=c.count;c.base=c.pointer;c.count=c.length;}else{c.active=false;this.dma&=~(1<<i);this.ended|=1<<i;continue;}}
 const raw=this.mem[(c.base+Math.floor(c.pos))%this.mem.length],signed=raw<128?raw:raw-256;c.value=signed/128*c.volume/64*.34;this.out[i===0||i===3?0:1]+=c.value;c.pos+=PAULA_CLOCK/c.period/this.rate;}return this.out;}
}
export class PaulaMachine {
 constructor(rate=44100,p=freshPaula()){this.rate=rate;this.mem=new Uint8Array(524288);this.paula=new Paula(rate,this.mem);this.writes=[];this.cpu=new M68K(this.mem,(a,v)=>{this.paula.write(a,v);this.writes.push({address:a,value:v,pc:this.cpu.lastPC});if(this.writes.length>10)this.writes.shift();});this.bank=new Map();this.delay=[new Float32Array(rate*2),new Float32Array(rate*2)];this.dp=0;this.lp=[0,0];this.dcIn=[0,0];this.dcOut=[0,0];this.output=new Float64Array(2);this.position=-1;this.manual=new Map();this.error=null;this.setProject(p,true);this.load(p.source);}
 setProject(p,withSamples=false){this.project=JSON.parse(JSON.stringify(p));if(withSamples||!this.bank.size){for(const s of SAMPLE_BANK)this.installSample(s,SAMPLE_ADDRESSES.get(s.id));for(let i=0;i<4;i++){const s=p.custom[i];if(s)this.installSample({...s,id:'custom'+i,pcm:Int8Array.from(s.pcm)},0x40000+i*32768);else this.bank.delete('custom'+i);}}
 this.updateFX();for(let i=0;i<4;i++){this.paula.channels[i].loop=p.channels[i].loop;if(this.program)this.writeRegisters([[0xdff0a8+16*i,p.channels[i].mute?0:p.channels[i].volume]]);}}
 installSample(s,address){if(address%2||s.pcm.length%2||address<0x10000||address+s.pcm.length>this.mem.length)throw Error('Ungültiger Sample-Speicherbereich.');this.mem.set(s.pcm,address);this.bank.set(s.id,{...s,address});}
 updateFX(){this.filterAlpha=1-Math.exp(-2*Math.PI*(250*Math.pow(50,this.project.filter/100))/this.rate);this.echo=this.project.echo/100;this.width=this.project.width/100;this.delayLength=Math.min(this.delay[0].length-1,Math.round(this.rate*60/this.project.bpm*.75));}
 setParam(channel,key,value){if(channel===null){this.project[key]=value;this.updateFX();return;}const c=this.project.channels[channel];c[key]=value;if(key==='loop')this.paula.channels[channel].loop=value;if(key==='volume'||key==='mute')this.writeRegisters([[0xdff0a8+channel*16,c.mute?0:c.volume]]);}
 load(source){const p=assemble68(source);for(const [a,v]of p.writes)this.mem[a]=v;this.program=p;this.project.source=source;this.cpu.pc=p.entry;this.error=null;this.debugging=false;return p;}
 routine(entry=this.program.entry){this.cpu.push(0x0ffe);this.cpu.pc=entry;for(let i=0;i<4096;i++){this.cpu.step();if(this.cpu.pc===0x0ffe)return;}throw Error('68K: Routine kehrt nach 4096 Befehlen nicht mit RTS zurück.');}
 writeRegisters(pairs){let a=0x1800;for(const [addr,v]of pairs){this.cpu.ww(a,0x33fc);this.cpu.ww(a+2,v);this.cpu.wl(a+4,addr);a+=8;}this.cpu.ww(a,0x4e75);this.routine(0x1800);}
 row(position){this.position=position;let trigger=0;for(let i=0;i<4;i++){const c=this.project.channels[i],s=this.bank.get(c.sample),note=this.manual.has(i)?this.manual.get(i):this.project.patterns[i][position],base=0x2000+i*10,old=this.paula.channels[i];const on=note!==null&&!c.mute;if(on)trigger|=1<<i;const period=on?clamp(Math.round(PAULA_CLOCK/(s.rate*Math.pow(2,(note-s.root)/12))),124,65535):old.period;this.cpu.wl(base,s.address);this.cpu.ww(base+4,s.pcm.length/2);this.cpu.ww(base+6,period);this.cpu.ww(base+8,c.mute?0:c.volume);this.paula.channels[i].loop=c.loop;}this.cpu.ww(0x2030,trigger);this.cpu.ww(0x2032,0x8200|trigger);this.routine();}
 noteOn(i,note){const c=this.project.channels[i];if(c.mute)return;this.manual.set(i,note);const s=this.bank.get(c.sample),b=0xdff0a0+i*16,period=clamp(Math.round(PAULA_CLOCK/(s.rate*Math.pow(2,(note-s.root)/12))),124,65535);this.paula.channels[i].loop=c.loop;this.writeRegisters([[0xdff096,1<<i],[b,s.address>>16],[b+2,s.address&65535],[b+4,s.pcm.length/2],[b+6,period],[b+8,c.volume],[0xdff096,0x8200|(1<<i)]]);}
 noteOff(i){this.manual.delete(i);this.writeRegisters([[0xdff096,1<<i]]);}
 stop(){this.manual.clear();this.writeRegisters([[0xdff096,15]]);}
 sample(){const raw=this.paula.sample();for(let i=0;i<2;i++){this.lp[i]+=this.filterAlpha*(raw[i]-this.lp[i]);const dc=this.lp[i]-this.dcIn[i]+.995*this.dcOut[i];this.dcIn[i]=this.lp[i];this.dcOut[i]=dc;const wet=this.delay[i][(this.dp-this.delayLength+this.delay[i].length)%this.delay[i].length];this.delay[i][this.dp]=dc+wet*.38;this.output[i]=dc+wet*this.echo;}this.dp=(this.dp+1)%this.delay[0].length;const mid=(this.output[0]+this.output[1])/2,side=(this.output[0]-this.output[1])/2*this.width;this.output[0]=mid+side;this.output[1]=mid-side;return this.output;}
 debugStep(){if(!this.debugging){this.cpu.a[7]=0xff00;this.cpu.push(0x0ffe);this.cpu.pc=this.program.entry;this.debugging=true;}this.cpu.step();if(this.cpu.pc===0x0ffe)this.debugging=false;return this.snapshot();}
 snapshot(){return {cpu:this.cpu.snapshot(),channels:this.paula.channels.map(c=>({pointer:c.pointer,length:c.length,period:c.period,volume:c.volume,active:c.active,position:Math.floor(c.pos),level:Math.abs(c.value)})),dma:this.paula.dma,position:this.position,writes:[...this.writes],error:this.error};}
}
