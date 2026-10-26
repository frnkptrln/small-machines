import {CPU6502,hex,disassemble} from './cpu.mjs';
import {assemble} from './assembler.mjs';
export const CLOCK=985248;
export const DRIVER=`; SID/65 • Jeder Ton beginnt als 6502-Code.
; PLAY wird für jeden Sechzehntelschritt aufgerufen.
; $02 = Schritt; $2000… = Notentabellen; $3000… = Klang.
.org $1000
play:
  LDX #$18
copy:
  LDA $3000,X
  STA $D400,X
  DEX
  BPL copy
  LDX $02
; Stimme 1
  LDA $2000,X
  STA $D400
  LDA $2010,X
  STA $D401
  LDA $2020,X
  ORA $3004
  STA $D404
; Stimme 2
  LDA $2040,X
  STA $D407
  LDA $2050,X
  STA $D408
  LDA $2060,X
  ORA $300B
  STA $D40B
; Stimme 3
  LDA $2080,X
  STA $D40E
  LDA $2090,X
  STA $D40F
  LDA $20A0,X
  ORA $3012
  STA $D412
; Weiter zum nächsten Schritt
  INC $02
  LDA $02
  AND #$0F
  STA $02
  RTS`;
const AT=[2,8,16,24,38,56,68,80,100,250,500,800,1000,3000,5000,8000];
const DR=[6,24,48,72,114,168,204,240,300,750,1500,2400,3000,9000,15000,24000];
const blep=(t,dt)=>{if(t<dt){t/=dt;return t+t-t*t-1;}if(t>1-dt){t=(t-1)/dt;return t*t+t+t+1;}return 0;};
export class SID {
 constructor(rate=44100){this.rate=rate;this.reg=new Uint8Array(32);this.voices=Array.from({length:3},()=>({phase:0,env:0,gate:false,stage:'off',lfsr:0x7ffff8,value:0}));this.ic1=this.ic2=this.prevIn=this.prevOut=0;this.g=0.1;this.k=1;}
 write(r,v){r&=31;this.reg[r]=v;if([4,11,18].includes(r)){const o=this.voices[(r-4)/7],gate=!!(v&1);if(gate&&!o.gate)o.stage='attack';if(!gate&&o.gate)o.stage='release';o.gate=gate;if(v&8){o.phase=0;o.lfsr=0x7ffff8;}}
 if(r>=21&&r<=23){let cut=this.reg[21]&7|this.reg[22]<<3;let hz=30*Math.pow(350,cut/2047);this.g=Math.tan(Math.PI*Math.min(hz,this.rate*.4)/this.rate);this.k=2-1.85*(this.reg[23]>>4)/15;}}
 sample(){const r=this.reg;let direct=0,filtered=0;const old=this.voices.map(v=>v.phase);let crossing=[false,false,false];
  for(let i=0;i<3;i++){let v=this.voices[i],b=i*7,f=r[b]|r[b+1]<<8;if(!(r[b+4]&8)){let next=v.phase+f*CLOCK/this.rate;crossing[i]=old[i]<8388608&&next>=8388608;v.phase=next%16777216;let shifts=Math.floor((next+524288)/1048576)-Math.floor((old[i]+524288)/1048576);for(let j=0;j<shifts;j++)v.lfsr=((v.lfsr<<1)|(((v.lfsr>>22)^(v.lfsr>>17))&1))&0x7fffff;}}
  for(let i=0;i<3;i++){const v=this.voices[i],b=i*7,ctrl=r[b+4],prev=(i+2)%3;if((ctrl&2)&&crossing[prev])v.phase=0;
   let sustain=(r[b+6]>>4)/15;
   if(v.stage==='attack'){v.env+=1/(AT[r[b+5]>>4]*.001*this.rate);if(v.env>=1){v.env=1;v.stage='decay';}}
   else if(v.stage==='decay'){v.env=Math.max(sustain,v.env-1/(DR[r[b+5]&15]*.001*this.rate));if(v.env<=sustain)v.stage='sustain';}
   else if(v.stage==='sustain'){if(v.env>sustain)v.stage='decay';}
   else if(v.stage==='release'){v.env=Math.max(0,v.env-1/(DR[r[b+6]&15]*.001*this.rate));if(!v.env)v.stage='off';}
   let p=v.phase/16777216,dt=Math.min(.49,((r[b]|r[b+1]<<8)*CLOCK/16777216)/this.rate),wave=0,n=0;
   if(ctrl&16){let tri=1-4*Math.abs(p-.5);if((ctrl&4)&&this.voices[prev].phase>=8388608)tri=-tri;wave+=tri;n++;}
   if(ctrl&32){wave+=2*p-1-(dt?blep(p,dt):0);n++;}
   if(ctrl&64){let duty=Math.max(.01,Math.min(.99,(r[b+2]|(r[b+3]&15)<<8)/4096));wave+=(p<duty?1:-1)+(dt?blep(p,dt)-blep((p-duty+1)%1,dt):0);n++;}
   if(ctrl&128){const bits=[22,20,16,13,11,7,4,2];let noise=0;for(const bit of bits)noise=(noise<<1)|((v.lfsr>>bit)&1);wave+=noise/127.5-1;n++;}
   v.value=(n?wave/n:0)*v.env*.24;
   if(r[23]&(1<<i))filtered+=v.value;else if(!(i===2&&(r[24]&128)))direct+=v.value;
  }
  let a1=1/(1+this.g*(this.g+this.k)),a2=this.g*a1,a3=this.g*a2,v3=filtered-this.ic2,v1=a1*this.ic1+a2*v3,v2=this.ic2+a2*this.ic1+a3*v3;this.ic1=2*v1-this.ic1;this.ic2=2*v2-this.ic2;
  let f=0;if(r[24]&16)f+=v2;if(r[24]&32)f+=v1;if(r[24]&64)f+=filtered-this.k*v1-v2;
  let mix=(direct+f)*(r[24]&15)/15,dc=mix-this.prevIn+.995*this.prevOut;this.prevIn=mix;this.prevOut=dc;return Math.tanh(dc*1.25);
 }
}
const voice=(wave,pw,a,d,s,r)=>({wave,pw,attack:a,decay:d,sustain:s,release:r,mute:false,ring:false,sync:false});
export const PRESETS=[
 {name:'01 · Nachglühen',desc:'Warme Pulse, schwebende Arpeggien.',bpm:94,cutoff:1480,resonance:3,echo:.30,voices:[voice(64,28,2,8,7,7),voice(16,50,1,7,9,5),voice(32,50,3,7,5,7)],patterns:[[67,null,74,70,67,null,62,65,67,null,74,77,75,74,70,65],[43,null,null,43,null,null,43,null,39,null,null,39,null,46,null,null],[55,null,58,null,62,null,58,null,51,null,55,null,58,null,62,null]]},
 {name:'02 · Rasterfahrt',desc:'Ein kleiner Nachtzug aus drei Stimmen.',bpm:128,cutoff:1750,resonance:7,echo:.18,voices:[voice(64,18,0,5,3,3),voice(32,50,0,6,6,3),voice(128,50,0,3,0,2)],patterns:[[72,75,79,84,79,75,72,79,70,74,77,82,77,74,70,77],[36,null,36,48,36,null,43,null,34,null,34,46,34,null,41,null],[null,76,84,76,null,76,84,76,null,76,84,76,null,76,84,88]]},
 {name:'03 · Kalter Satellit',desc:'Langsame Dreiecke und metallische Ringe.',bpm:68,cutoff:1270,resonance:4,echo:.42,voices:[{...voice(16,50,7,8,8,9),ring:true},voice(16,50,5,8,9,9),voice(16,50,6,9,4,8)],patterns:[[72,null,null,79,null,null,74,null,70,null,null,77,null,74,null,null],[36,null,null,null,43,null,null,null,34,null,null,null,41,null,null,null],[55,null,null,62,null,null,58,null,53,null,null,60,null,57,null,null]]},
 {name:'04 · Leeres Band',desc:'Platz für deine eigene Maschine.',bpm:110,cutoff:1700,resonance:2,echo:.2,voices:[voice(64,40,1,6,7,5),voice(16,50,1,6,8,5),voice(128,50,0,3,0,2)],patterns:Array.from({length:3},()=>Array(16).fill(null))}
];
export const freshProject=(i=0)=>({...JSON.parse(JSON.stringify(PRESETS[i])),source:DRIVER,version:1});
export function validateProject(p){if(!p||typeof p.name!=='string'||p.name.length>100||p.version!==1||!Array.isArray(p.voices)||p.voices.length!==3||!Array.isArray(p.patterns)||p.patterns.length!==3)throw Error('Keine SID/65-Projektdatei.');const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;for(const [key,min,max] of [['bpm',40,220],['cutoff',0,2047],['resonance',0,15],['echo',0,.6]])if(!num(p[key],min,max))throw Error('Ungültiger Wert: '+key);for(const v of p.voices){if(![16,32,64,128].includes(v.wave))throw Error('Ungültige Wellenform');for(const key of ['attack','decay','sustain','release'])if(!Number.isInteger(v[key])||!num(v[key],0,15))throw Error('Ungültige Hüllkurve');if(!num(v.pw,1,99))throw Error('Ungültige Pulsbreite');}for(const pat of p.patterns)if(!Array.isArray(pat)||pat.length!==16||pat.some(n=>n!==null&&(!Number.isInteger(n)||!num(n,24,96))))throw Error('Ungültige Notentabelle');assemble(p.source);return p;}
export class Machine {
 constructor(rate=44100,project=freshProject()){this.rate=rate;this.mem=new Uint8Array(65536);this.sid=new SID(rate);this.writes=[];this.cpu=new CPU6502(this.mem,(a,v)=>{if(a>=0xd400&&a<0xd420){this.sid.write(a-0xd400,v);this.writes.push({address:a,value:v,pc:this.cpu.lastPC});if(this.writes.length>12)this.writes.shift();}});this.delay=new Float32Array(rate*2);this.dp=0;this.position=-1;this.remaining=0;this.gateRemaining=0;this.playing=false;this.manual=new Map();this.trace=[];this.error=null;this.setProject(project);this.load(project.source);this.cpu.pc=this.program.entry;}
 setProject(p){this.project=JSON.parse(JSON.stringify(p));const m=this.mem;
  for(let i=0;i<3;i++){let v=p.voices[i],b=0x3000+i*7,pw=Math.round(v.pw/100*4095);m[b+2]=pw&255;m[b+3]=pw>>8;m[b+4]=v.mute?0:v.wave|(v.ring?4:0)|(v.sync?2:0);m[b+5]=(v.attack<<4)|v.decay;m[b+6]=(v.sustain<<4)|v.release;
   for(let j=0;j<16;j++){let note=p.patterns[i][j],f=note===null?0:Math.min(65535,Math.round(440*Math.pow(2,(note-69)/12)*16777216/CLOCK)),a=0x2000+i*64+j;m[a]=f&255;m[a+16]=f>>8;m[a+32]=note===null||v.mute?0:1;}}
  m[0x3015]=p.cutoff&7;m[0x3016]=p.cutoff>>3;m[0x3017]=(p.resonance<<4)|7;m[0x3018]=0x1f;
  if(this.program){const regs=[];for(let i=0;i<3;i++){const b=i*7;for(const j of [2,3,5,6])regs.push([0xd400+b+j,m[0x3000+b+j]]);regs.push([0xd404+b,m[0x3004+b]|(p.voices[i].mute?0:this.sid.reg[b+4]&1)]);}for(let i=21;i<=24;i++)regs.push([0xd400+i,m[0x3000+i]]);this.immediate(regs);}
 }
 load(source){const p=assemble(source);for(const [a,v]of p.writes)this.mem[a]=v;this.program=p;this.project.source=source;this.cpu.pc=p.entry;this.error=null;this.debugging=false;return p;}
 runRoutine(entry=this.program.entry){const returnPC=0x0fff;this.cpu.push((returnPC-1)>>8);this.cpu.push(returnPC-1);this.cpu.pc=entry;let count=0;while(this.cpu.pc!==returnPC){if(++count>4096)throw Error('CPU gestoppt: Routine kehrt nach 4096 Befehlen nicht mit RTS zurück.');if(count<12)this.trace.push(disassemble(this.mem,this.cpu.pc,1)[0]);this.cpu.step();}if(this.trace.length>10)this.trace=this.trace.slice(-10);}
 immediate(registers){const bytes=[];for(const [address,value]of registers)bytes.push(0xa9,value&255,0x8d,address&255,address>>8);bytes.push(0x60);this.mem.set(bytes,0x1800);this.runRoutine(0x1800);}
 noteOn(voice,note){if(this.project.voices[voice].mute)return;this.manual.set(voice,note);let v=this.project.voices[voice],f=Math.round(440*Math.pow(2,(note-69)/12)*16777216/CLOCK),b=0xd400+7*voice;this.immediate([[b+4,0],...Array.from({length:7},(_,j)=>[b+j,this.mem[0x3000+voice*7+j]]),[b,f&255],[b+1,f>>8],[0xd415,this.mem[0x3015]],[0xd416,this.mem[0x3016]],[0xd417,this.mem[0x3017]],[0xd418,31],[b+4,v.wave|(v.ring?4:0)|(v.sync?2:0)|1]]);}
 noteOff(voice){this.manual.delete(voice);this.immediate([[0xd404+voice*7,this.sid.reg[4+voice*7]&~1]]);}
 silence(){this.immediate([0,1,2].map(i=>[0xd404+i*7,this.sid.reg[4+i*7]&~1]));}
 start(){this.cpu.sp=0xfd;this.mem[2]=0;this.remaining=0;this.gateRemaining=0;this.position=-1;this.playing=true;this.error=null;this.debugging=false;}
 stop(){this.playing=false;this.manual.clear();this.silence();}
 tick(){this.position=this.mem[2]&15;this.trace=[];this.runRoutine();for(const [v,n]of this.manual)this.noteOn(v,n);}
 sample(){if(this.playing){try{if(this.remaining<=0){this.tick();this.remaining+=this.rate*60/this.project.bpm/4;this.gateRemaining=this.remaining*.77;}this.remaining--;if(this.gateRemaining>0&&--this.gateRemaining<=0){this.immediate([0,1,2].filter(i=>!this.manual.has(i)).map(i=>[0xd404+i*7,this.sid.reg[4+i*7]&~1]));}}catch(e){this.error=e.message;this.playing=false;for(let i=0;i<3;i++)this.sid.write(i*7+4,0);}}
  let dry=this.sid.sample(),len=Math.min(this.delay.length-1,Math.round(this.rate*60/this.project.bpm*.75)),wet=this.delay[(this.dp-len+this.delay.length)%this.delay.length];this.delay[this.dp]=dry+wet*.37;this.dp=(this.dp+1)%this.delay.length;return Math.tanh(dry+wet*this.project.echo);}
 debugStep(){if(this.playing)this.stop();if(!this.debugging){this.cpu.sp=0xfd;this.cpu.push(0x0f);this.cpu.push(0xfe);this.cpu.pc=this.program.entry;this.debugging=true;}let ins=disassemble(this.mem,this.cpu.pc,1)[0];this.cpu.step();if(this.cpu.pc===0x0fff)this.debugging=false;this.trace=[ins];return this.snapshot();}
 snapshot(){return {cpu:this.cpu.snapshot(),registers:Array.from(this.sid.reg.slice(0,25)),position:this.position,playing:this.playing,writes:this.writes,trace:this.trace,next:disassemble(this.mem,this.cpu.pc,7),levels:this.sid.voices.map(v=>v.env),error:this.error};}
}
