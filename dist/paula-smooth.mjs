// Optional modern interpolation and 3 ms transition smoothing for the ensemble.
// Keeps four Paula DMA channels; leaves standalone Paula's playback untouched.
import {PAULA_CLOCK} from './paula.mjs';
export function smoothPaula(chip){
 const n=Math.max(1,Math.round(chip.rate*.003)),last=new Float64Array(4),offset=new Float64Array(4),remaining=new Int32Array(4),pending=[false,false,false,false],write=chip.write.bind(chip);
 chip.write=(addr,value)=>{if(addr===0xdff096){for(let i=0;i<4;i++)if(value&(1<<i))pending[i]=true;}else{const i=(addr-0xdff0a0)>>4;if(i>=0&&i<4&&(addr&15)===8)pending[i]=true;}write(addr,value);};
 const pcm=(c,position)=>{let index=position;if(c.loop)index=((index%c.count)+c.count)%c.count;else if(index<0||index>=c.count)return 0;const b=chip.mem[(c.base+index)%chip.mem.length];return (b<128?b:b-256)/128;};
 chip.sample=()=>{chip.out.fill(0);chip.ended=0;for(let i=0;i<4;i++){const c=chip.channels[i];let raw=0;if(c.active&&c.pos>=c.count){if(c.loop){c.pos%=c.count;c.base=c.pointer;c.count=c.length;}else{c.active=false;chip.dma&=~(1<<i);chip.ended|=1<<i;pending[i]=true;}}
  if(c.active){const pos=Math.floor(c.pos),fraction=c.pos-pos;raw=(pcm(c,pos)*(1-fraction)+pcm(c,pos+1)*fraction)*c.volume/64*.34;c.pos+=PAULA_CLOCK/c.period/chip.rate;}
  if(pending[i]){offset[i]=last[i]-raw;remaining[i]=n;pending[i]=false;}let x=raw;if(remaining[i]>0){x+=offset[i]*(.5-.5*Math.cos(Math.PI*remaining[i]/n));remaining[i]--;}
  last[i]=c.value=x;chip.out[i===0||i===3?0:1]+=x;
 }return chip.out;};
 return {reset(){last.fill(0);offset.fill(0);remaining.fill(0);pending.fill(false);}};
}
