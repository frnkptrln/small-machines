// Isolated browser audition at the sample's root pitch, without changing a set.
// Auditions are available only while transport and recording are stopped.
export function previewPCM(sample,outputRate){
 const duration=sample.loop ? .9 : Math.min(2,sample.pcm.length/sample.rate),length=Math.max(2,Math.ceil(duration*outputRate));
 const output=new Float32Array(length),fade=Math.max(1,Math.round(outputRate*.008));
 for(let i=0;i<length;i++){let pos=Math.floor(i*sample.rate/outputRate);if(sample.loop)pos%=sample.pcm.length;const value=sample.pcm[pos]||0;output[i]=value/128*.24*Math.min(1,i/fade,(length-1-i)/fade);}
 return output;
}
