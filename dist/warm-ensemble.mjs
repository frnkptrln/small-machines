import {freshEnsemble,DECKS} from './ensemble-score.mjs';
import {freshWarm} from './warm.mjs';

export const ENSEMBLE_DECKS=[...DECKS,'warm'];
export function warmScene(scene){
 const s=structuredClone(scene);
 if(!s.warm){s.warm=freshWarm();s.warm.patterns=Array.from({length:8},()=>Array(16).fill(null));s.levels.warm=0;for(const bar of s.patterns)bar.warm=Array(16).fill(null);}
 return s;
}
export function upgradeEnsemble(set){
 const s=structuredClone(set);
 if(s.version===1){s.version=2;s.levels.warm=1;s.mutes.warm=false;s.scenes=s.scenes.map(warmScene);}
 return s;
}
export function freshWarmEnsemble(){
 const s=upgradeEnsemble(freshEnsemble());s.name='Licht im Hinterhof · fünf Fenster';
 const gains=[.45,.32,.28,.26,.55,.32,.44,.38];
 s.scenes.forEach((scene,index)=>{
  scene.warm=freshWarm();scene.warm.name='Das fünfte Fenster';scene.warm.bpm=s.bpm;
  scene.warm.params={...scene.warm.params,cutoff:[900,1200,1700,1300,700,2100,1800,650][index],attack:800,release:1800,chorus:62,volume:70};
  scene.levels.warm=gains[index];
  scene.patterns.forEach((p,bar)=>{p.warm=Array(16).fill(null);const root=[50,46,53,48][Math.floor(bar/2)%4],third=bar<2?3:4;
   if(bar%2===0)p.warm[0]={notes:[root,root+7,root+12+third,root+19],velocity:.7,length:30};
  });
  scene.warm.patterns=scene.patterns.map(p=>structuredClone(p.warm));
 });return s;
}
