// Offline reconstruction for album recordings; original PCM and four DMA lanes.
// This is a rendering aid, not a cycle-exact model of an Amiga output circuit.
export function installCleanPaula(chip, clock=3546895, transitionMs=3) {
 const phases=1024,taps=16,radius=8,cutoff=.94,kernel=new Float64Array(phases*taps);
 const sinc=x=>Math.abs(x)<1e-10?1:Math.sin(Math.PI*x)/(Math.PI*x);
 for(let p=0;p<phases;p++){let sum=0;for(let k=0;k<taps;k++){const d=k-7-p/phases,w=Math.abs(d)<radius?cutoff*sinc(d*cutoff)*sinc(d/radius):0;kernel[p*taps+k]=w;sum+=w;}for(let k=0;k<taps;k++)kernel[p*taps+k]/=sum;}
 const n=Math.max(2,Math.round(chip.rate*transitionMs/1000)),states=chip.channels.map(()=>({last:0,offset:0,age:n,changed:false}));
 const report={mode:'windowed-sinc PCM; 3 ms sample transition smoothing',transitions:0,maxBoundaryJumpBefore:0,maxBoundaryJumpAfter:0};
 const originalWrite=chip.write.bind(chip);
 chip.write=(addr,value)=>{const before=chip.channels.map(c=>[c.active,c.volume]);originalWrite(addr,value);chip.channels.forEach((c,i)=>{if(c.active!==before[i][0]||c.volume!==before[i][1])states[i].changed=true;});};
 chip.sample=()=>{
  chip.out.fill(0);chip.ended=0;
  for(let i=0;i<4;i++){
   const c=chip.channels[i],s=states[i];let raw=0;
   if(c.active&&c.pos>=c.count){if(c.loop){c.pos%=c.count;c.base=c.pointer;c.count=c.length;}else{c.active=false;chip.dma&=~(1<<i);chip.ended|=1<<i;s.changed=true;}}
   if(c.active){const index=Math.floor(c.pos),phase=Math.min(phases-1,Math.floor((c.pos-index)*phases))*taps;let v=0;
    for(let k=0;k<taps;k++){let j=index+k-7;if(c.loop)j=((j%c.count)+c.count)%c.count;else if(j<0||j>=c.count)continue;const b=chip.mem[(c.base+j)%chip.mem.length];v+=(b<128?b:b-256)*kernel[phase+k];}
    raw=v/128*c.volume/64*.34;c.pos+=clock/c.period/chip.rate;
   }
   if(s.changed){report.maxBoundaryJumpBefore=Math.max(report.maxBoundaryJumpBefore,Math.abs(raw-s.last));s.offset=s.last-raw;s.age=0;s.changed=false;report.transitions++;report.maxBoundaryJumpAfter=Math.max(report.maxBoundaryJumpAfter,Math.abs(raw+s.offset-s.last));}
   const value=raw+(s.age<n?s.offset*(.5+.5*Math.cos(Math.PI*s.age/n)):0);s.age++;s.last=value;c.value=value;chip.out[i===0||i===3?0:1]+=value;
  }
  return chip.out;
 };
 chip.cleanPlayback=report;return report;
}
