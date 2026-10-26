// Eight original synthesized percussion voices. No samples or hardware ROMs.
export const DRUMS=[['kick','Kick','Tiefer Puls'],['snare','Snare','Papier & Feder'],['clap','Clap','Drei kleine Hände'],['hat','Closed hat','Kurzes Metall'],['open','Open hat','Luft & Metall'],['tom','Tom','Runder Bauch'],['rim','Rim','Holz am Rand'],['bell','Cowbell','Zwei schiefe Glocken']].map(([id,name,description])=>({id,name,description}));
export const freshDrum=()=>({kind:'small-drums',version:1,voices:DRUMS.map((d,i)=>({level:[.9,.66,.48,.38,.32,.55,.48,.35][i],tune:0,decay:1,mute:false})),pattern:drumPattern('house')});
export function drumPattern(name='house'){
 const p=Array.from({length:8},()=>Array(16).fill(0));
 const put=(v,steps,velocity=.7)=>{for(const s of steps)p[v][s]=velocity;};
 if(name==='house'){put(0,[0,4,8,12],1);put(1,[4,12],.8);put(2,[12],.5);put(3,[2,6,10,14],.65);put(4,[14],.55);put(6,[7,15],.4);}
 if(name==='broken'){put(0,[0,6,10],1);put(1,[4,12],.85);put(3,[0,2,5,7,8,10,13,15],.6);put(4,[11],.6);put(5,[14],.55);put(6,[3],.4);}
 if(name==='dust'){put(0,[0,8],.7);put(3,[2,10],.4);put(6,[7,15],.6);put(7,[12],.35);}
 return p;
}
export function validateDrum(p){
 if(!p||p.kind!=='small-drums'||p.version!==1||!Array.isArray(p.voices)||p.voices.length!==8||!Array.isArray(p.pattern)||p.pattern.length!==8)throw Error('Keine DRUM/08-Datei.');
 for(const v of p.voices){if(!v||!Number.isFinite(v.level)||v.level<0||v.level>1||!Number.isFinite(v.tune)||v.tune< -12||v.tune>12||!Number.isFinite(v.decay)||v.decay<.25||v.decay>2.5||typeof v.mute!=='boolean')throw Error('Ungültiger Drum-Klang.');}
 for(const row of p.pattern)if(!Array.isArray(row)||row.length!==16||row.some(n=>!Number.isFinite(n)||n<0||n>1))throw Error('Ungültiges Drum-Pattern.');return structuredClone(p);
}
const TAU=2*Math.PI,baseDecay=[.36,.14,.17,.045,.36,.29,.055,.22],pans=[0,-.08,.1,-.26,.26,.2,-.35,.32];
export class DrumMachine{
 constructor(rate=44100,project=freshDrum()){
  if(!Number.isFinite(rate)||rate<8000||rate>192000)throw Error('Unsupported sample rate');this.rate=rate;this.project=validateDrum(project);this.voices=DRUMS.map((_,i)=>({age:10,phase:0,env:0,velocity:0,seed:(0x808+12345*i)>>>0,lastNoise:0,lp:0,last:0,correction:0,fade:0,choke:1,decay:.1,tune:1}));this.out=new Float64Array(2);this.levels=new Float64Array(8);
 }
 trigger(i,velocity=1){if(!Number.isInteger(i)||i<0||i>7||!Number.isFinite(velocity)||velocity<=0)return;const c=this.project.voices[i],v=this.voices[i];if(c.mute)return;
  v.correction=v.last;v.fade=Math.round(this.rate*.002);v.age=0;v.phase=0;v.env=1;v.velocity=Math.min(1,velocity);v.decay=baseDecay[i]*c.decay;v.tune=2**(c.tune/12);v.choke=1;v.lp=0;v.lastNoise=0;
  if(i===3)this.voices[4].choke=Math.exp(-1/(this.rate*.003));
 }
 step(position){for(let i=0;i<8;i++)if(this.project.pattern[i][position]>0)this.trigger(i,this.project.pattern[i][position]);}
 panic(){for(const v of this.voices){v.env=0;v.last=0;v.correction=0;v.fade=0;}this.out.fill(0);this.levels.fill(0);}
 sample(){this.out.fill(0);
  for(let i=0;i<8;i++){const v=this.voices[i],c=this.project.voices[i];if(v.env<1e-6&&v.fade<=0){v.last=0;this.levels[i]=0;continue;}
   const t=v.age;v.age+=1/this.rate;v.env=Math.exp(-t/v.decay)*v.choke; // choke is also accumulated below
   if(v.choke<1){v.velocity*=v.choke;if(v.velocity<1e-6)v.env=0;}
   v.seed=(Math.imul(v.seed,1664525)+1013904223)>>>0;const noise=v.seed/2147483648-1;const hp=noise-v.lastNoise;v.lastNoise=noise;let x=0;
   if(i===0||i===5){const f=(i===0?48+125*Math.exp(-t*38):115+90*Math.exp(-t*24))*v.tune;v.phase=(v.phase+TAU*f/this.rate)%TAU;x=Math.sin(v.phase)*v.env+(i===0?noise*.10*Math.exp(-t*180):0);}
   else if(i===1){v.phase=(v.phase+TAU*185*v.tune/this.rate)%TAU;x=(Math.sin(v.phase)*.28+hp*.32)*v.env;}
   else if(i===2){const burst=t<.032?Math.exp(-((t%.0105)/.003)):Math.exp(-(t-.032)/v.decay)*.55;x=hp*.45*burst;v.env=t<.032?1:Math.exp(-(t-.032)/v.decay);}
   else if(i===3||i===4){let metal=0;for(const f of [473,709,1011,1471,1807,2311])metal+=Math.sin(TAU*Math.min(this.rate*.42,f*v.tune)*t)/6;x=(hp*.26+metal*.4)*v.env;}
   else if(i===6)x=(Math.sin(TAU*840*v.tune*t)+Math.sin(TAU*1280*v.tune*t)*.6)*.5*v.env;
   else x=(Math.sin(TAU*543*v.tune*t)+Math.sin(TAU*811*v.tune*t))*.36*v.env;
   x*=Math.min(1,t*this.rate/12)*v.velocity*.38;
   if(v.fade>0){x+=v.correction*v.fade/Math.round(this.rate*.002);v.fade--;}
   v.last=x;const audible=c.mute?0:x*c.level;this.levels[i]=Math.abs(audible);this.out[0]+=audible*(1-pans[i])*.78;this.out[1]+=audible*(1+pans[i])*.78;
  }return this.out;
 }
}
