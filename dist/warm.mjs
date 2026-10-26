// WARM/06 — original six-voice subtractive synth, inspired by the Juno family.
// No copied ROM, sample, factory patch, or circuit model. All sound is synthesized.
export const WARM_PARAMS={
 saw:[0,100],pulse:[0,100],sub:[0,100],noise:[0,30],pulseWidth:[10,90],pwm:[0,100],
 cutoff:[80,12000],resonance:[0,85],env:[0,100],attack:[3,3000],decay:[30,5000],
 sustain:[0,100],release:[30,6000],hpf:[20,1200],chorus:[0,100],drift:[0,20],
 volume:[0,100],lfoRate:[.1,5]
};
const defaults={saw:68,pulse:36,sub:20,noise:1,pulseWidth:46,pwm:27,cutoff:1050,resonance:18,env:26,attack:450,decay:1100,sustain:76,release:1900,hpf:35,chorus:66,drift:4,volume:75,lfoRate:.24};
const clone=x=>structuredClone(x),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const chords=[[50,57,60,65],[46,53,57,60],[53,60,64,69],[48,55,58,62]];
function pattern(kind=0){return Array.from({length:8},(_,bar)=>{
 const steps=Array(16).fill(null),chord=chords[Math.floor(bar/2)%4];
 if(kind===1){for(const st of [0,6,8,14])steps[st]={notes:[chord[0]-12],velocity:st%8===0?.82:.61,length:st%8===0?4.8:1.4};}
 else if(kind===2){for(let st=0;st<16;st+=3)steps[st]={notes:[chord[(Math.floor(st/3)+bar)%4]+12],velocity:.58+(st===0?.15:0),length:2};}
 else if(kind===3){steps[0]={notes:chord.map(n=>n+12),velocity:.66,length:15.5};}
 else if(kind===4){for(const st of [0,5,10])steps[st]={notes:[chord[1],chord[2]+12,chord[3]+12],velocity:st===0?.75:.58,length:3.5};}
 else if(kind===5){steps[0]={notes:[chord[0],chord[1]+12,chord[2]+12],velocity:.7,length:15.7};if(bar%2)steps[12]={notes:[chord[3]+12],velocity:.46,length:3.8};}
 else steps[0]={notes:chord,velocity:bar%2?.67:.78,length:15.5};
 return steps;
});}
export const WARM_PRESETS=[
 {name:'Bernsteinfenster',bpm:92,params:{...defaults},patterns:pattern()},
 {name:'Samtboden',bpm:104,params:{...defaults,saw:36,pulse:70,sub:58,noise:0,pwm:8,cutoff:380,resonance:23,env:47,attack:8,decay:420,sustain:44,release:140,hpf:20,chorus:13,drift:2},patterns:pattern(1)},
 {name:'Staub im Sonnenlicht',bpm:86,params:{...defaults,saw:28,pulse:64,sub:0,noise:2,pwm:18,cutoff:1650,resonance:24,env:42,attack:6,decay:980,sustain:12,release:1200,hpf:115,chorus:74,drift:5},patterns:pattern(2)},
 {name:'Langsame Gardinen',bpm:78,params:{...defaults,saw:72,pulse:42,sub:8,noise:3,pwm:45,cutoff:760,resonance:10,env:20,attack:1500,decay:2200,sustain:82,release:3500,hpf:65,chorus:83,drift:7,lfoRate:.15},patterns:pattern(3)},
 {name:'Kassettenherz',bpm:108,params:{...defaults,saw:76,pulse:18,sub:18,noise:0,pwm:12,cutoff:1700,resonance:26,env:35,attack:30,decay:760,sustain:34,release:850,hpf:50,chorus:48,drift:5},patterns:pattern(4)},
 {name:'Die letzte Lampe',bpm:72,params:{...defaults,saw:30,pulse:76,sub:22,noise:1,pulseWidth:34,pwm:21,cutoff:610,resonance:15,env:28,attack:700,decay:1600,sustain:62,release:2800,hpf:28,chorus:64,drift:6,lfoRate:.18},patterns:pattern(5)}
];
export function freshWarm(index=0){const p=WARM_PRESETS[index]||WARM_PRESETS[0];return clone({format:'small-machines-warm',version:1,...p});}
export function validateWarm(p){
 if(!p||p.format!=='small-machines-warm'||p.version!==1||typeof p.name!=='string'||p.name.length>80||!Number.isFinite(p.bpm)||p.bpm<40||p.bpm>220)throw Error('Keine gültige WARM/06-Datei.');
 for(const [key,[lo,hi]]of Object.entries(WARM_PARAMS))if(!Number.isFinite(p.params?.[key])||p.params[key]<lo||p.params[key]>hi)throw Error('Ungültiger WARM/06-Regler: '+key);
 if(!Array.isArray(p.patterns)||p.patterns.length!==8)throw Error('WARM/06 benötigt acht Pattern-Takte.');
 for(const bar of p.patterns){if(!Array.isArray(bar)||bar.length!==16)throw Error('Ein Takt benötigt sechzehn Schritte.');for(const event of bar){if(event===null)continue;if(!event||!Array.isArray(event.notes)||event.notes.length<1||event.notes.length>6||event.notes.some(n=>!Number.isInteger(n)||n<24||n>96)||new Set(event.notes).size!==event.notes.length||!Number.isFinite(event.velocity)||event.velocity<0||event.velocity>1||!Number.isFinite(event.length)||event.length<1||event.length>32)throw Error('Ungültiger Akkordschritt.');}}
 return {format:p.format,version:1,name:p.name,bpm:p.bpm,params:Object.fromEntries(Object.keys(WARM_PARAMS).map(k=>[k,p.params[k]])),patterns:p.patterns.map(bar=>bar.map(e=>e===null?null:{notes:[...e.notes],velocity:e.velocity,length:e.length}))};
}
function blep(t,dt){if(t<dt){t/=dt;return t+t-t*t-1;}if(t>1-dt){t=(t-1)/dt;return t*t+t+t+1;}return 0;}
function lowpass(v,x,g,k,stage){const a=stage===0?'a':'c',b=stage===0?'b':'d',v1=(v[a]+g*(x-v[b]))/(1+g*(g+k)),v2=v[b]+g*v1;v[a]=2*v1-v[a];v[b]=2*v2-v[b];return v2;}
function newVoice(index){return {index,note:-1,env:0,stage:'off',age:0,serial:0,gateFrames:-1,velocity:0,phase:index*.157,subPhase:index*.091,frequency:0,dt:0,g:0,gTarget:0,a:0,b:0,c:0,d:0,last:0,tail:0,seed:0x51f15e+index*18481};}
export class WarmMachine{
 constructor(rate=44100,project=freshWarm()){
  if(!Number.isFinite(rate)||rate<8000||rate>192000)throw Error('Nicht unterstützte Abtastrate.');
  this.rate=rate;this.project=validateWarm(project);this.current={...this.project.params};this.voices=Array.from({length:6},(_,i)=>newVoice(i));this.out=new Float64Array(2);this.meters=new Float64Array(2);this.playing=false;this.step=-1;this.bar=-1;this.frames=0;this.samples=0;this.remaining=0;this.serial=0;this.error=null;this.lfoPhase=0;this.chorusPhase=0;this.controlTick=0;
  this.smooth=1-Math.exp(-1/(rate*.018));this.controlSmooth=1-Math.exp(-32/(rate*.018));this.tailDecay=Math.exp(-1/(rate*.002));this.delay=new Float64Array(Math.ceil(rate*.04)+4);this.delayAt=0;this.hpIn=0;this.hpOut=0;this.chorusLP=new Float64Array(2);this.chorusFilter=1-Math.exp(-2*Math.PI*Math.min(6500,rate*.32)/rate);this.volume=this.project.params.volume/100;this.wet=this.project.params.chorus/100;this.releaseMaxFrames=Math.ceil(rate*6);this.updateControl(true);
 }
 setProject(project){this.project=validateWarm(project);}
 setParam(key,value){const range=WARM_PARAMS[key];if(!range||!Number.isFinite(value))throw Error('Ungültiger Klangregler.');this.project.params[key]=clamp(value,...range);}
 start(){if(this.playing)return;this.playing=true;this.bar=-1;this.step=-1;this.remaining=0;this.frames=0;this.error=null;}
 stop(){this.playing=false;this.allNotesOff();}
 allNotesOff(){for(const v of this.voices){if(v.stage!=='off')v.stage='release';v.gateFrames=-1;}}
 noteOff(note){for(const v of this.voices)if(v.note===note&&v.stage!=='off'){v.stage='release';v.gateFrames=-1;}}
 noteOn(note,velocity=1){
  if(!Number.isInteger(note)||note<24||note>96||!Number.isFinite(velocity)||velocity<0||velocity>1)throw Error('Ungültige Note.');
  if(velocity===0)return null;
  let voice=this.voices.find(v=>v.note===note&&v.stage!=='off'&&v.stage!=='release')||this.voices.find(v=>v.stage==='off');
  if(!voice){for(const v of this.voices)if(v.stage==='release'&&(!voice||v.env<voice.env))voice=v;}
  if(!voice)voice=this.voices.reduce((old,v)=>v.serial<old.serial?v:old);
  // Preserve the old waveform as a very short correction tail on a stolen voice.
  voice.tail=voice.last;voice.note=note;voice.frequency=440*2**((note-69)/12);voice.env=0;voice.stage='attack';voice.age=0;voice.serial=++this.serial;voice.gateFrames=-1;voice.velocity=velocity;voice.a=voice.b=voice.c=voice.d=0;voice.g=this.filterG(voice);voice.gTarget=voice.g;voice.dt=voice.frequency/this.rate;return voice;
 }
 trigger(event,stepFrames){if(event===null)return;if(!Number.isFinite(stepFrames)||stepFrames<=0)throw Error('Ungültige Schrittlänge.');for(const note of event.notes){const voice=this.noteOn(note,event.velocity);if(voice)voice.gateFrames=Math.max(1,Math.round(event.length*stepFrames));}}
 panic(){this.playing=false;this.voices=Array.from({length:6},(_,i)=>newVoice(i));this.delay.fill(0);this.chorusLP.fill(0);this.out.fill(0);this.meters.fill(0);this.hpIn=this.hpOut=0;this.step=-1;this.bar=-1;this.remaining=0;this.delayAt=0;this.lfoPhase=this.chorusPhase=0;}
 filterG(v){const p=this.current,frequency=clamp(p.cutoff*2**(v.env*p.env*.035+(v.note-60)*.012),25,this.rate*.38);return Math.tan(Math.PI*frequency/this.rate);}
 updateControl(immediate=false){const p=this.current,t=this.project.params,a=immediate?1:this.controlSmooth;for(const key in WARM_PARAMS)p[key]+=(t[key]-p[key])*a;
  this.attackStep=1/Math.max(1,this.rate*p.attack/1000);this.decayFactor=Math.exp(-5/(this.rate*p.decay/1000));this.releaseFactor=Math.exp(-8/(this.rate*p.release/1000));this.sustain=p.sustain/100;this.resK=1.42-p.resonance/100*1.32;this.hpFactor=Math.exp(-2*Math.PI*p.hpf/this.rate);
  for(const v of this.voices){if(v.stage==='off')continue;const drift=p.drift*Math.sin(this.samples/this.rate*(.13+v.index*.017)+v.index*1.7);v.dt=Math.min(.45,v.frequency*2**(drift/1200)/this.rate);v.gTarget=this.filterG(v);}
 }
 readDelay(samples){let i=this.delayAt-samples;while(i<0)i+=this.delay.length;const at=Math.floor(i),f=i-at;return this.delay[at]*(1-f)+this.delay[(at+1)%this.delay.length]*f;}
 sample(){
  if(this.playing){if(this.remaining<=0){this.step=(this.step+1)%16;if(this.step===0)this.bar=(this.bar+1)%8;const duration=this.rate*60/this.project.bpm/4;this.trigger(this.project.patterns[this.bar][this.step],duration);this.remaining+=duration;}this.remaining--;this.frames++;}
  if(this.controlTick--<=0){this.updateControl();this.controlTick=31;}
  const p=this.current,lfo=Math.sin(this.lfoPhase);this.lfoPhase=(this.lfoPhase+2*Math.PI*p.lfoRate/this.rate)%(Math.PI*2);let mono=0;
  for(const v of this.voices){
   if(v.gateFrames>0&&--v.gateFrames===0)v.stage='release';
   if(v.stage==='attack'){v.env=Math.min(1,v.env+this.attackStep);if(v.env===1)v.stage='decay';}
   else if(v.stage==='decay'){v.env=this.sustain+(v.env-this.sustain)*this.decayFactor;if(Math.abs(v.env-this.sustain)<.0005)v.stage='sustain';}
   else if(v.stage==='sustain')v.env+=(this.sustain-v.env)*this.smooth;
   else if(v.stage==='release'){v.env*=this.releaseFactor;if(v.env<1e-6){v.env=0;v.stage='off';}}
   v.tail*=this.tailDecay;if(Math.abs(v.tail)<1e-10)v.tail=0;
   if(v.stage==='off'){v.last=v.tail;mono+=v.last;continue;}
   const t=v.phase,dt=v.dt,pw=clamp(p.pulseWidth/100+lfo*p.pwm*.0035,.06,.94);let osc=(2*t-1-blep(t,dt))*p.saw/100;
   osc+=((t<pw?1:-1)+blep(t,dt)-blep((t-pw+1)%1,dt))*p.pulse/100;
   osc+=((v.subPhase<.5?1:-1)+blep(v.subPhase,dt*.5)-blep((v.subPhase+.5)%1,dt*.5))*p.sub/100;
   v.seed=(Math.imul(v.seed,1664525)+1013904223)>>>0;osc+=(v.seed/2147483648-1)*p.noise/100;
   v.phase=(t+dt)%1;v.subPhase=(v.subPhase+dt*.5)%1;v.g+=(v.gTarget-v.g)*.08;
   const first=lowpass(v,Math.tanh(osc*.65),v.g,this.resK,0),second=lowpass(v,Math.tanh(first),v.g,1.42,1);
   v.last=second*v.env*v.velocity*.24+v.tail;mono+=v.last;v.age++;
  }
  const hp=mono-this.hpIn+this.hpFactor*this.hpOut;this.hpIn=mono;this.hpOut=Math.abs(hp)<1e-12?0:hp;
  this.delay[this.delayAt]=this.hpOut;const phase=this.chorusPhase;this.chorusPhase=(phase+2*Math.PI*.31/this.rate)%(2*Math.PI);
  const l=this.readDelay(this.rate*(.009+.0026*Math.sin(phase))),r=this.readDelay(this.rate*(.012+.003*Math.sin(phase+Math.PI*.7)));
  this.chorusLP[0]+=(l-this.chorusLP[0])*this.chorusFilter;this.chorusLP[1]+=(r-this.chorusLP[1])*this.chorusFilter;this.delayAt=(this.delayAt+1)%this.delay.length;
  this.volume+=(this.project.params.volume/100-this.volume)*this.smooth;this.wet+=(this.project.params.chorus/100-this.wet)*this.smooth;
  for(let ch=0;ch<2;ch++){const x=(this.hpOut*(1-this.wet*.2)+this.chorusLP[ch]*this.wet*.65)*this.volume;this.out[ch]=.9*Math.tanh(x/.9);if(!Number.isFinite(this.out[ch])){this.error='WARM/06-Audioberechnung unterbrochen.';this.panic();break;}this.meters[ch]=Math.max(Math.abs(this.out[ch]),this.meters[ch]*.9995);}
  this.samples++;return this.out;
 }
 snapshot(){return {playing:this.playing,bar:this.bar,step:this.step,voices:this.voices.reduce((n,v)=>n+(v.stage!=='off'),0),meters:[...this.meters],seconds:this.frames/this.rate};}
}
