import {validateEnsemble,validateScene} from './ensemble.mjs';
import {upgradeEnsemble,warmScene} from './warm-ensemble.mjs';

function validateIndex(index){
 if(!Number.isInteger(index)||index<0||index>7)throw Error('Bitte eine der acht Szenen auswählen.');
}

// Edits return independent data so the caller can retain an undo snapshot.
export function renameSet(data,name){
 validateEnsemble(data);
 if(typeof name!=='string')throw Error('Bitte einen Setnamen eingeben.');
 const title=name.trim();
 if(!title||title.length>100)throw Error('Der Setname muss 1 bis 100 Zeichen enthalten.');
 const next=structuredClone(data);
 next.name=title;
 return validateEnsemble(next);
}

export function copyScene(data,index){
 validateEnsemble(data);
 validateIndex(index);
 return structuredClone(data.scenes[index]);
}

export function pasteScene(data,index,scene){
 validateEnsemble(data);
 validateIndex(index);
 validateScene(scene);
 const next=upgradeEnsemble(data);
 // Old quartet scenes acquire an empty WARM lane when pasted into a quintet.
 next.scenes[index]=warmScene(scene);
 return validateEnsemble(next);
}
