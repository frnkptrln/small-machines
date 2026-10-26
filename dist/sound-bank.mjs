// Original synthetic PCM. No recordings, third-party samples or ROM data.
const TAU=2*Math.PI,C4=261.625565;
const sin=(f,t)=>Math.sin(TAU*f*t);
function make(id,name,category,description,rate,root,length,fn,loop=false){
 let seed=Array.from(id).reduce((s,c)=>Math.imul(s,31)+c.charCodeAt(0),6832)>>>0;
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 const values=new Float64Array(length),pcm=new Int8Array(length+(length&1));let peak=.001;
 for(let i=0;i<length;i++){let value=fn(i/rate,i,noise);if(!loop)value*=Math.min(1,i/Math.max(2,rate*.0006),(length-1-i)/Math.max(2,rate*.006));values[i]=value;peak=Math.max(peak,Math.abs(value));}
 for(let i=0;i<length;i++)pcm[i]=Math.round(values[i]/peak*116);
 return {id,name,category,description,rate,root,pcm,loop};
}
const cycle=(id,name,description,fn)=>make(id,name,'Bässe',description,8372,36,128,(t,i)=>fn(i/128*TAU),true);
export const EXTRA_SAMPLES=[
 make('deep-kick','07 · Deep kick','Drums','Tiefer Sinusbauch mit langem Ausklang.',11025,48,6200,(t,i,n)=>Math.sin(TAU*(43*t+105*(1-Math.exp(-t*38))/38))*Math.exp(-t*8)+n()*.08*Math.exp(-t*180)),
 make('hard-kick','08 · Circuit kick','Drums','Kurzer, angezerrter Anschlag.',11025,48,3200,(t,i,n)=>Math.tanh(2.6*Math.sin(TAU*(54*t+135*(1-Math.exp(-t*48))/48)))*Math.exp(-t*19)+n()*.15*Math.exp(-t*130)),
 make('clap','09 · Hand circuit','Drums','Drei Rauschimpulse und eine kleine Fahne.',11025,48,3000,(t,i,n)=>{let e=0;for(const start of [0,.011,.023])if(t>=start)e+=Math.exp(-(t-start)*190);if(t>.028)e+=.45*Math.exp(-(t-.028)*24);return n()*e;}),
 make('rim','10 · Wooden rim','Drums','Trockener, holziger Klick.',11025,48,1200,t=>(sin(730,t)+.5*sin(1190,t)+.25*sin(1810,t))*Math.exp(-t*68)),
 make('tom','11 · Round tom','Drums','Gestimmter Trommelschlag mit fallender Tonhöhe.',11025,48,4000,(t,i,n)=>Math.sin(TAU*(105*t+50*(1-Math.exp(-t*25))/25))*Math.exp(-t*13)+n()*.08*Math.exp(-t*50)),
 make('open-hat','12 · Open metal','Drums','Offene, körnige Hi-Hat.',16000,48,4200,(t,i,n)=>(n()*.6+sin(3260,t)*.15+sin(4751,t)*.12)*Math.exp(-t*14)),
 make('shaker','13 · Sand shaker','Drums','Leiser Schüttelimpuls mit weichem Anstieg.',11025,48,1800,(t,i,n)=>n()*Math.min(1,t*150)*Math.exp(-t*32)),
 make('cowbell','14 · Pixel cowbell','Drums','Zwei metallische Rechtecke.',16000,48,3200,t=>(Math.tanh(sin(540,t)*5)+Math.tanh(sin(800,t)*5)*.65)*Math.exp(-t*18)),
 cycle('sub','15 · Sine cellar','Ein runder, nahtloser Subbass.',p=>Math.sin(p)+.07*Math.sin(2*p)),
 cycle('acid','16 · Acid wire','Obertonreicher Bass zum Filtern.',p=>Math.sin(p)-.45*Math.sin(2*p)+.27*Math.sin(3*p)-.16*Math.sin(4*p)+.1*Math.sin(5*p)),
 cycle('hollow-bass','17 · Hollow bass','Hohle Rechteckfarbe mit ungeraden Obertönen.',p=>Math.sin(p)+.3*Math.sin(3*p)+.15*Math.sin(5*p)+.07*Math.sin(7*p)),
 make('epiano','18 · Felt electric','Keys','Weicher FM-Tastenklang mit Glockenanschlag.',11025,60,14000,t=>(Math.sin(TAU*C4*t+1.8*sin(C4,t)*Math.exp(-t*7))*.8+sin(C4*2,t)*.14*Math.exp(-t*8))*Math.exp(-t*3)),
 make('organ','19 · Pocket organ','Keys','Nahtloser Orgelzyklus mit drei Registern.',8372,60,32,(t,i)=>{const p=i/32*TAU;return Math.sin(p)+.4*Math.sin(2*p)+.24*Math.sin(4*p);},true),
 make('mallet','20 · Soft marimba','Keys','Holziger Anschlag, kurze gläserne Obertöne.',11025,60,8000,t=>(sin(C4,t)*.8*Math.exp(-t*5)+sin(C4*4,t)*.35*Math.exp(-t*24)+sin(C4*10,t)*.08*Math.exp(-t*60))),
 make('pluck','21 · Nylon pixel','Keys','Gezupfte Saite aus abklingenden Harmonischen.',11025,60,7000,t=>{let v=0;for(let h=1;h<=10;h++)v+=sin(C4*h,t)/h*Math.exp(-t*(4+h*1.5));return v;}),
 make('music-box','22 · Tiny music box','Keys','Heller, leicht unharmonischer Glockenton.',16000,72,10000,t=>(sin(C4*2,t)*Math.exp(-t*4)+.36*sin(C4*5.512,t)*Math.exp(-t*10)+.12*sin(C4*10.808,t)*Math.exp(-t*18))),
 make('warm-pad','23 · Amber cloud','Flächen','Langsamer, leicht schwebender Synthklang.',11025,60,18000,t=>{let v=0;for(let h=1;h<=5;h++)v+=(sin(C4*h*.998,t)+sin(C4*h*1.002,t))/(h*3);return v*Math.min(1,t/ .18)*Math.exp(-t*1.2)*Math.min(1,(18000/11025-t)/.3);}),
 make('choir','24 · Vowel machine','Flächen','Synthetisches Ah aus formantgewichteten Obertönen.',11025,60,16000,t=>{let v=0;for(let h=1;h<=12;h++){const f=C4*h,a=.8*Math.exp(-(((f-780)/220)**2))+.45*Math.exp(-(((f-1200)/290)**2))+.3*Math.exp(-(((f-2500)/350)**2));v+=a*sin(f,t);}return v*Math.min(1,t/.1)*Math.exp(-t*1.3)*Math.min(1,(16000/11025-t)/.25);}),
 make('zap','25 · Rubber zap','Effekte','Federnder Lasertropfen.',16000,60,4000,t=>Math.sin(TAU*(110*t+1200*(1-Math.exp(-t*22))/22))*Math.exp(-t*16)),
 make('laser','26 · Terminal laser','Effekte','Scharfer, schneller Frequenzsturz.',16000,60,3000,t=>Math.tanh(Math.sin(TAU*(180*t+2600*(1-Math.exp(-t*35))/35))*3)*Math.exp(-t*24)),
 make('riser','27 · Disk spin-up','Effekte','Ansteigendes Rauschen mit Tonspur.',11025,60,10000,(t,i,n)=>{const u=i/10000;return (n()*.4+sin(220+900*t,t)*.24)*u*u;}),
 make('arcade','28 · Bonus pixels','Effekte','Kurze aufsteigende Spielhallenfigur.',11025,60,6000,t=>{const f=C4*[1,1.25,1.5,2][Math.min(3,Math.floor(t/.12))];return (sin(f,t)+.25*sin(f*3,t))*Math.exp(-(t%.12)*20);}),
 make('bell-pad','29 · Blue fifth','Flächen','Schwebende Quinte mit sanftem Glockenkern.',8000,60,4500,t=>(sin(C4,t)*.55+sin(C4*1.5,t)*.3+sin(C4*2.001,t)*.15)*Math.min(1,t*30)*Math.exp(-t*4)),
 make('blip','30 · Cursor blip','Effekte','Ein kurzer, weicher Bestätigungston.',11025,72,1800,t=>(sin(C4*2,t)+sin(C4*4,t)*.15)*Math.exp(-t*30))
];
export const SAMPLE_CATEGORIES=['Drums','Bässe','Keys','Flächen','Effekte','Eigene'];
export function findSamples(samples,query='',category='Alle'){
 const words=query.trim().toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
 return samples.filter(s=>(category==='Alle'||s.category===category)&&words.every(w=>`${s.name} ${s.description||''} ${s.category}`.toLocaleLowerCase('de').includes(w)));
}
