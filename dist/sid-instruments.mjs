// Voice patches only: patterns, tempo, code, shared filter and mute are preserved.
const instrument=(id,name,category,wave,pw,attack,decay,sustain,release)=>({id,name,category,voice:{wave,pw,attack,decay,sustain,release,ring:false,sync:false}});
export const SID_INSTRUMENTS=[
 instrument('round-sub','Round sub','Bässe',16,50,0,5,11,3),
 instrument('saw-bass','Saw cellar','Bässe',32,50,0,6,6,3),
 instrument('rubber-bass','Rubber pulse','Bässe',64,22,0,8,2,4),
 instrument('hollow-bass','Hollow square','Bässe',64,50,1,5,10,4),
 instrument('chip-lead','Arcade lead','Leads',64,12,0,4,8,3),
 instrument('warm-lead','Warm lead','Leads',32,50,2,6,9,5),
 instrument('glass-lead','Glass triangle','Leads',16,50,0,9,2,7),
 instrument('reed','Pixel reed','Leads',64,36,3,5,10,5),
 instrument('pluck','Tiny pluck','Keys',64,25,0,7,0,4),
 instrument('organ','Square organ','Keys',64,50,0,0,12,2),
 instrument('bell','Soft bell','Keys',16,50,0,10,0,8),
 instrument('soft-pad','Slow triangle','Flächen',16,50,9,8,9,10),
 instrument('saw-pad','Amber saw','Flächen',32,50,8,7,7,9),
 instrument('hat','Dust tick','Percussion',128,50,0,2,0,1),
 instrument('snare','Paper noise','Percussion',128,50,0,5,0,3),
 instrument('noise-swell','Noise tide','Effekte',128,50,9,8,5,9)
];
export const SID_CATEGORIES=[...new Set(SID_INSTRUMENTS.map(p=>p.category))];
export function identifyInstrument(voice){return SID_INSTRUMENTS.find(p=>Object.entries(p.voice).every(([key,value])=>voice[key]===value))?.id||'';}
export function applyInstrument(project,index,id){
 const preset=SID_INSTRUMENTS.find(p=>p.id===id);
 if(!preset||!Number.isInteger(index)||index<0||index>2)throw Error('Unbekanntes SID-Instrument.');
 Object.assign(project.voices[index],preset.voice);return preset;
}
