import {ACID_PRESETS,PARAMS,freshAcid,validateAcid} from './acid.mjs';
const $=id=>document.getElementById(id),storageKey='small-machines-acid-v1';
let project=freshAcid(),ctx,node,analyser,initializing,playing=false,recording=false,chunks=[],lastStep=-1,exporting=false;
const status=(message,error=false)=>{$('acid-status').textContent=message;$('acid-status').dataset.error=String(error);};
try{const stored=localStorage.getItem(storageKey);if(stored)project=validateAcid(JSON.parse(stored));}catch{status('Das gespeicherte Pattern konnte nicht geladen werden. Säureblumen ist bereit.',true);}
const send=data=>node?.port.postMessage(data);
function save(){try{localStorage.setItem(storageKey,JSON.stringify(project));$('acid-save-state').textContent='Pattern auf diesem Gerät gespeichert.';}catch{$('acid-save-state').textContent='Browser-Speicher nicht verfügbar. Bitte Pattern herunterladen.';}}
function changed(){save();send({type:'project',project});}
const notes=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const noteName=n=>notes[n%12]+(Math.floor(n/12)-1);
const controlSpec=[['cutoff','CUTOFF','Filter öffnen','Hz'],['resonance','RESONANZ','Die Kante im Klang','%'],['env','ENV MOD','Bewegung im Filter','%'],['decay','DECAY','Filter klingt ab','ms'],['accent','ACCENT','Stärke der Betonung','%'],['glide','SLIDE','Zeit zwischen Noten','ms'],['echo','ECHO','Platz im Raum','%'],['volume','LEVEL','Ausgangslautstärke','%']];
for(const [key,label,hint,unit]of controlSpec){const box=document.createElement('div');box.className='acid-control';const id='acid-'+key;box.innerHTML=`<label for="${id}">${label}<output id="${id}-value"></output></label><input id="${id}" type="range"><p>${hint}</p>`;const input=box.querySelector('input'),[min,max]=PARAMS[key];input.min=key==='cutoff'?0:min;input.max=key==='cutoff'?1000:max;input.step=1;input.addEventListener('input',()=>{project.params[key]=key==='cutoff'?Math.round(min*(max/min)**(Number(input.value)/1000)):Number(input.value);$(id+'-value').textContent=project.params[key]+unit;save();send({type:'param',key,value:project.params[key]});});$('acid-controls').append(box);}
const stepEls=[];
for(let i=0;i<16;i++){
 const card=document.createElement('div');card.className='acid-step';const head=document.createElement('div');head.className='acid-step-head';head.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span><i class="acid-led"></i>`;card.append(head);
 const select=document.createElement('select');select.setAttribute('aria-label',`Note für Schritt ${i+1}`);select.add(new Option('— Pause',''));for(let n=24;n<=72;n++)select.add(new Option(noteName(n),String(n)));select.onchange=()=>{project.steps[i].note=select.value===''?null:Number(select.value);card.classList.toggle('rest',select.value==='');changed();};card.append(select);
 const row=document.createElement('div');row.className='acid-step-buttons';for(const [key,label,desc]of [['accent','A','Accent'],['slide','S','Slide zur nächsten Note']]){const b=document.createElement('button');b.textContent=label;b.dataset.key=key;b.title=desc;b.setAttribute('aria-label',`${desc}, Schritt ${i+1}`);b.onclick=()=>{project.steps[i][key]=!project.steps[i][key];paintStep(i);changed();};row.append(b);}card.append(row);$('acid-steps').append(card);stepEls.push(card);
}
function paintStep(i){const c=stepEls[i],s=project.steps[i];c.querySelector('select').value=s.note===null?'':String(s.note);c.classList.toggle('rest',s.note===null);for(const b of c.querySelectorAll('button')){const active=s[b.dataset.key];b.setAttribute('aria-pressed',String(active));b.classList.toggle('slide-on',active&&b.dataset.key==='slide');}}
for(let i=0;i<ACID_PRESETS.length;i++)$('acid-preset').add(new Option(ACID_PRESETS[i].name,String(i)));$('acid-preset').add(new Option('Dein Pattern','custom'));
function paint(){
 $('acid-name').value=project.name;$('acid-display-name').textContent=project.name.toUpperCase();$('acid-bpm').value=project.bpm;$('acid-wave').value=project.wave;$('acid-gate').value=project.params.gate;$('acid-gate-value').textContent=project.params.gate+'%';
 $('acid-preset').value=String(ACID_PRESETS.findIndex(p=>JSON.stringify({...freshAcid(ACID_PRESETS.indexOf(p))})===JSON.stringify(project)));if(!$('acid-preset').value)$('acid-preset').value='custom';
 for(const [key,,,unit]of controlSpec){const [min,max]=PARAMS[key];$('acid-'+key).value=key==='cutoff'?Math.log(project.params[key]/min)/Math.log(max/min)*1000:project.params[key];$('acid-'+key+'-value').textContent=project.params[key]+unit;}
 for(let i=0;i<16;i++)paintStep(i);
}
function clearPosition(){for(const c of stepEls)c.classList.remove('is-current');lastStep=-1;$('acid-position').textContent='BEREIT';}
function paintTransport(){$('acid-play').textContent=playing?'Ⅱ Pattern anhalten':'▶ '+(ctx?'Spielen':'Einschalten & spielen');$('acid-record').setAttribute('aria-pressed',String(recording));$('acid-record').textContent=recording?'■ TAKE BEENDEN':'● REC';}
async function audio(){
 if(initializing)return initializing;if(ctx&&node){await ctx.resume();return;}
 initializing=(async()=>{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Dieser Browser unterstützt Web Audio nicht.');ctx=new Audio();await ctx.resume();if(!ctx.audioWorklet)throw Error('AudioWorklet fehlt. Bitte einen aktuellen Browser verwenden.');await ctx.audioWorklet.addModule('./acid-worklet.mjs');node=new AudioWorkletNode(ctx,'small-acid',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});analyser=ctx.createAnalyser();analyser.fftSize=512;node.connect(analyser);analyser.connect(ctx.destination);send({type:'project',project});node.port.onmessage=receive;node.onprocessorerror=()=>{playing=false;recording=false;node.disconnect();node=null;void ctx.close();ctx=null;paintTransport();status('Audio wurde unterbrochen. Bitte erneut einschalten.',true);};ctx.onstatechange=()=>{$('acid-audio-state').textContent=ctx?.state==='running'?`${Math.round(ctx.sampleRate/100)/10} kHz / AUDIO AN`:'AUDIO PAUSIERT';};$('acid-audio-state').textContent=`${Math.round(ctx.sampleRate/100)/10} kHz / AUDIO AN`;draw();})();
 try{await initializing;}catch(e){node?.disconnect();node=null;if(ctx)await ctx.close();ctx=null;throw e;}finally{initializing=null;}
}
async function toggle(){try{await audio();playing=!playing;send({type:playing?'play':'stop'});if(!playing)clearPosition();paintTransport();}catch(e){status(e.message,true);}}
$('acid-play').onclick=toggle;
$('acid-stop').onclick=()=>{playing=false;send({type:'stop'});clearPosition();paintTransport();status(recording?'Das Pattern stoppt, der Take läuft weiter. REC beendet ihn.':'Gestoppt. Der Klang darf ausklingen.');};
$('acid-panic').onclick=()=>{playing=false;send({type:'panic'});clearPosition();paintTransport();status('Sofort stumm.');};
$('acid-record').onclick=async()=>{try{if(recording){send({type:'recordStop'});return;}await audio();chunks=[];recording=true;send({type:'record'});if(!playing){playing=true;send({type:'play'});}paintTransport();status('Aufnahme läuft — auch deine Reglerbewegungen werden festgehalten.');}catch(e){recording=false;paintTransport();status(e.message,true);}};
function receive(e){const d=e.data;if(d.type==='state'){
 if(d.playing&&d.step!==lastStep){if(lastStep>=0)stepEls[lastStep].classList.remove('is-current');lastStep=d.step;stepEls[lastStep]?.classList.add('is-current');$('acid-position').textContent=`STEP ${String(d.step+1).padStart(2,'0')} / 16`;}
 $('acid-meter').value=d.peak;if(recording)$('acid-record').textContent=`■ ${Math.floor(d.seconds/60)}:${String(Math.floor(d.seconds%60)).padStart(2,'0')} / REC`;
 }else if(d.type==='chunk')chunks.push(d.chunk);
 else if(d.type==='recordDone'){recording=false;paintTransport();if(d.frames){const take=chunks;chunks=[];renderWav({type:'recording',chunks:take,rate:d.rate},'Take');}else status('Der Take war leer.');}
 else if(d.type==='error'){playing=false;recording=false;paintTransport();clearPosition();status(d.message,true);}}
let drawing=false;
function draw(){if(drawing)return;drawing=true;const canvas=$('acid-scope'),g=canvas.getContext('2d'),data=new Uint8Array(512);const frame=()=>{if(!ctx||!analyser){drawing=false;return;}const w=canvas.clientWidth,h=canvas.clientHeight,ratio=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}g.setTransform(ratio,0,0,ratio,0,0);g.clearRect(0,0,w,h);analyser.getByteTimeDomainData(data);g.strokeStyle='#40523c';g.lineWidth=1;g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();g.strokeStyle='#c4dfa7';g.lineWidth=1.5;g.beginPath();for(let i=0;i<data.length;i++){const x=i*w/(data.length-1),y=h/2+(data[i]-128)/128*h*.46;i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();requestAnimationFrame(frame);};frame();}
$('acid-bpm').onchange=()=>{const bpm=Number($('acid-bpm').value);project.bpm=Number.isFinite(bpm)?Math.round(Math.min(220,Math.max(40,bpm))):124;$('acid-bpm').value=project.bpm;changed();};
$('acid-wave').onchange=()=>{project.wave=$('acid-wave').value;changed();};
$('acid-name').oninput=()=>{project.name=$('acid-name').value;$('acid-display-name').textContent=project.name.toUpperCase();changed();};
$('acid-gate').oninput=()=>{project.params.gate=Number($('acid-gate').value);$('acid-gate-value').textContent=project.params.gate+'%';save();send({type:'param',key:'gate',value:project.params.gate});};
$('acid-preset').onchange=()=>{if($('acid-preset').value==='custom')return;project=freshAcid(Number($('acid-preset').value));send({type:'stop'});changed();clearPosition();if(playing)send({type:'play'});paint();status(project.name+' ist bereit.');};
$('acid-clear').onclick=()=>{project.steps=project.steps.map(()=>({note:null,accent:false,slide:false}));changed();paint();};
for(const [id,amount]of [['acid-down',-1],['acid-up',1]])$(id).onclick=()=>{const active=project.steps.filter(s=>s.note!==null);if(active.some(s=>s.note+amount<24||s.note+amount>72)){status('Tonumfang: C1 bis C5.');return;}for(const s of active)s.note+=amount;changed();paint();};
const safeName=()=>project.name.replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,65)||'ACID16';
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
$('acid-export-set').onclick=()=>download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),safeName()+'.json');
$('acid-import-set').onclick=()=>$('acid-file').click();
$('acid-file').onchange=async()=>{try{const f=$('acid-file').files[0];if(!f)return;if(f.size>100000)throw Error('Diese Pattern-Datei ist zu groß.');const p=validateAcid(JSON.parse(await f.text()));project=p;send({type:'stop'});changed();clearPosition();if(playing)send({type:'play'});paint();status('Pattern geladen.');}catch(e){status(e.message,true);}finally{$('acid-file').value='';}};
function renderWav(data,suffix){if(exporting){status('Der WAV-Export läuft bereits. Bitte danach erneut exportieren.',true);return;}exporting=true;$('acid-export-wav').disabled=true;$('acid-record').disabled=true;status('WAV wird vorbereitet …');const name=safeName()+'-'+suffix+'.wav';let worker;
 const finish=()=>{exporting=false;$('acid-export-wav').disabled=false;$('acid-record').disabled=false;worker?.terminate();};
 try{worker=new Worker('./acid-render-worker.mjs',{type:'module'});worker.onmessage=e=>{if(e.data.error)status(e.data.error,true);else{download(new Blob([e.data.wav],{type:'audio/wav'}),name);status(suffix+' als WAV heruntergeladen.');}finish();};worker.onerror=()=>{status('WAV konnte nicht exportiert werden.',true);finish();};worker.postMessage(data);}catch(e){status(e.message,true);finish();}}
$('acid-export-wav').onclick=()=>{if(recording){status('Bitte erst den Take beenden.');return;}renderWav({type:'pattern',project:structuredClone(project)},'8-Takte');};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('acid-panic').click();return;}if(e.code==='Space'&&!e.repeat&&!e.target.closest('input,select,textarea,button,a')){e.preventDefault();void toggle();}});
window.addEventListener('pagehide',()=>send({type:'panic'}));paint();paintTransport();
