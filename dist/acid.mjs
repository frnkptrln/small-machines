// Original Small Machines monosynth; no ROMs, samples or proprietary circuit model.
export const PARAMS={cutoff:[70,6000],resonance:[0,100],env:[0,100],decay:[60,1200],accent:[0,100],glide:[20,180],echo:[0,60],volume:[0,100],gate:[30,95]};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const defaults={cutoff:280,resonance:68,env:62,decay:260,accent:65,glide:65,echo:18,volume:78,gate:62};
const phrase=(notes,accents=[],slides=[])=>notes.map((note,i)=>({note,accent:accents.includes(i),slide:slides.includes(i)}));
export const ACID_PRESETS=[
 {name:'Säureblumen',bpm:124,wave:'saw',params:defaults,steps:phrase([38,null,38,50,41,38,null,45,38,38,53,null,50,45,41,36],[0,4,8,14],[2,7,9,13])},
 {name:'Kupferader',bpm:132,wave:'square',params:{...defaults,cutoff:190,resonance:82,env:76,decay:170,echo:12},steps:phrase([33,33,null,45,33,40,43,40,33,null,45,43,40,36,33,null],[0,3,6,10,12],[4,5,10,12])},
 {name:'Nachtwasser',bpm:96,wave:'saw',params:{...defaults,cutoff:170,resonance:36,env:38,decay:630,echo:35,glide:125},steps:phrase([41,null,null,48,53,null,51,null,46,null,48,null,44,43,41,null],[0,8],[3,6,12,13])},
 {name:'Balkonacid',bpm:118,wave:'square',params:{...defaults,cutoff:420,resonance:55,env:57,decay:330,echo:23},steps:phrase([36,null,43,48,39,36,null,46,43,null,39,43,48,46,39,38],[0,4,7,12],[2,10,12,14])},
 {name:'Leeres Blatt',bpm:124,wave:'saw',params:defaults,steps:phrase(Array(16).fill(null))}
];
export function freshAcid(index=0){const p=ACID_PRESETS[index]??ACID_PRESETS[0];return structuredClone({format:'small-machines-acid',version:1,...p});}
export function validateAcid(p){
 if(!p||p.format!=='small-machines-acid'||p.version!==1||typeof p.name!=='string'||p.name.length>80)throw Error('Kein gültiges ACID/16-Set.');
 if(!Number.isFinite(p.bpm)||p.bpm<40||p.bpm>220||!['saw','square'].includes(p.wave))throw Error('Tempo oder Wellenform ungültig.');
 for(const [key,[lo,hi]]of Object.entries(PARAMS))if(!Number.isFinite(p.params?.[key])||p.params[key]<lo||p.params[key]>hi)throw Error('Ungültiger Klangregler: '+key);
 if(!Array.isArray(p.steps)||p.steps.length!==16)throw Error('Das Pattern braucht 16 Schritte.');
 for(const s of p.steps)if(!s||(s.note!==null&&(!Number.isInteger(s.note)||s.note<24||s.note>72))||typeof s.accent!=='boolean'||typeof s.slide!=='boolean')throw Error('Ungültiger Pattern-Schritt.');
 return {format:p.format,version:1,name:p.name,bpm:p.bpm,wave:p.wave,params:{...p.params},steps:p.steps.map(s=>({note:s.note,accent:s.accent,slide:s.slide}))};
}
function blep(t,dt){if(t<dt){t/=dt;return t+t-t*t-1;}if(t>1-dt){t=(t-1)/dt;return t*t+t+t+1;}return 0;}
class SVF{
 constructor(){this.a=0;this.b=0;}
 low(x,g,k){const v1=(this.a+g*(x-this.b))/(1+g*(g+k)),v2=this.b+g*v1;this.a=2*v1-this.a;this.b=2*v2-this.b;return v2;}
}
export class AcidVoice{
 constructor(rate,params={...defaults},wave='saw'){
  if(!Number.isFinite(rate)||rate<8000||rate>192000)throw Error('Unsupported sample rate');
  this.rate=rate;this.params={...defaults,...params};this.wave=wave;this.phase=0;this.pitch=38;this.targetPitch=38;this.env=0;this.amp=0;this.gate=false;this.accented=false;this.currentCutoff=this.params.cutoff;this.currentRes=this.params.resonance;this.filter1=new SVF();this.filter2=new SVF();this.dcIn=0;this.dcOut=0;this.triggers=0;
  this.smooth=1-Math.exp(-1/(rate*.012));this.attack=1-Math.exp(-1/(rate*.002));this.release=Math.exp(-1/(rate*.014));this.dc=Math.exp(-2*Math.PI*18/rate);this.level=.32;
 }
 noteOn(note,accent=false,slide=false){
  this.targetPitch=clamp(note,24,72);this.accented=!!accent;
  if(!slide||!this.gate){this.pitch=this.targetPitch;this.env=1;this.triggers++;}
  this.gate=true;
 }
 noteOff(){this.gate=false;}
 sample(){
  const p=this.params;this.pitch+=(this.targetPitch-this.pitch)*(1-Math.exp(-1/(this.rate*p.glide/3000)));
  this.amp=this.gate?this.amp+(1-this.amp)*this.attack:this.amp*this.release;
  this.env*=Math.exp(-1/(this.rate*p.decay/1000));
  this.currentCutoff+=(p.cutoff-this.currentCutoff)*this.smooth;this.currentRes+=(p.resonance-this.currentRes)*this.smooth;
  const accent=this.accented?p.accent/100:0;
  const cutoff=clamp(this.currentCutoff*2**(this.env*(p.env/100*4.7+accent*.7)),35,Math.min(14500,this.rate*.36));
  const g=Math.tan(Math.PI*cutoff/(this.rate*2)),res=this.currentRes/100;
  const dt=Math.min(.24,440*2**((this.pitch-69)/12)/(this.rate*2));let y=0;
  for(let j=0;j<2;j++){
   const t=this.phase;let x;
   if(this.wave==='square')x=(t<.5?1:-1)+blep(t,dt)-blep((t+.5)%1,dt);else x=2*t-1-blep(t,dt);
   this.phase=(t+dt)%1;
   const a=this.filter1.low(x*.55,g,1/(.707+res*6));
   const b=this.filter2.low(Math.tanh(a*1.15),g,1/(.707+res*.65));
   y+=Math.tanh(b*1.65)*.5;
  }
  this.level+=(.32+accent*.16-this.level)*this.smooth;y*=this.amp*this.level;const dc=y-this.dcIn+this.dc*this.dcOut;this.dcIn=y;this.dcOut=dc;
  return dc;
 }
}
export class AcidMachine{
 constructor(rate,project=freshAcid()){
  this.rate=rate;this.project=validateAcid(project);this.voice=new AcidVoice(rate,this.project.params,this.project.wave);this.playing=false;this.step=-1;this.remaining=0;this.gateRemaining=-1;this.tied=false;this.samples=0;this.volume=this.project.params.volume/100;this.wet=this.project.params.echo/100;
  this.delay=new Float64Array(Math.ceil(rate*2));this.delayAt=0;this.out=new Float64Array(2);
 }
 setProject(p){this.project=validateAcid(p);this.voice.params={...this.project.params};this.voice.wave=this.project.wave;}
 setParam(key,value){if(!PARAMS[key])throw Error('Unknown control');const [a,b]=PARAMS[key];if(!Number.isFinite(value))throw Error('Invalid control');value=clamp(value,a,b);this.project.params[key]=value;this.voice.params[key]=value;}
 start(){if(this.playing)return;this.playing=true;this.step=-1;this.remaining=0;this.gateRemaining=-1;this.tied=false;}
 stop(){this.playing=false;this.gateRemaining=-1;this.tied=false;this.voice.noteOff();}
 panic(){this.stop();this.voice=new AcidVoice(this.rate,this.project.params,this.project.wave);this.delay.fill(0);this.out.fill(0);}
 noteOn(note,accent=false,slide=false){this.voice.noteOn(note,accent,slide);}
 noteOff(){this.voice.noteOff();}
 sample(){
  if(this.playing){
   if(this.remaining<=0){
    this.step=(this.step+1)%16;const s=this.project.steps[this.step],next=this.project.steps[(this.step+1)%16];const duration=this.rate*60/this.project.bpm/4;
    if(s.note===null){this.voice.noteOff();this.tied=false;this.gateRemaining=-1;}
    else {this.voice.noteOn(s.note,s.accent,this.tied);this.tied=s.slide&&next.note!==null;this.gateRemaining=this.tied?-1:duration*this.project.params.gate/100;}
    this.remaining+=duration;
   }
   if(this.gateRemaining>=0&&--this.gateRemaining<=0){this.voice.noteOff();this.gateRemaining=-1;}
   this.remaining--;
  }
  const dry=this.voice.sample();this.volume+=(this.project.params.volume/100-this.volume)*.002;this.wet+=(this.project.params.echo/100-this.wet)*.002;
  // Fixed stereo taps avoid pitch jumps when tempo changes during a take.
  const l=this.delay[(this.delayAt+this.delay.length-Math.round(.243*this.rate))%this.delay.length],r=this.delay[(this.delayAt+this.delay.length-Math.round(.364*this.rate))%this.delay.length];this.delay[this.delayAt]=dry+l*.32;this.delayAt=(this.delayAt+1)%this.delay.length;
  this.out[0]=(dry+l*this.wet)*this.volume;this.out[1]=(dry+r*this.wet)*this.volume;this.samples++;return this.out;
 }
}
export function encodeAcidWav(chunks,rate){
 const length=chunks.reduce((n,c)=>n+c.length,0);if(length%2)throw Error('Stereo frames required');
 const buffer=new ArrayBuffer(44+length*2),v=new DataView(buffer);const str=(i,s)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j));};
 str(0,'RIFF');v.setUint32(4,36+length*2,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,length*2,true);
 let i=44;for(const c of chunks)for(const x of c){v.setInt16(i,Math.round(clamp(x,-1,1)*(x<0?32768:32767)),true);i+=2;}return buffer;
}
