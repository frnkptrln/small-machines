// Scores and patches contain plain objects, arrays and primitive values.
// AudioWorkletGlobalScope does not always provide the structuredClone API.
export function cloneData(value){
 if(typeof globalThis.structuredClone==='function')return globalThis.structuredClone(value);
 const seen=new Map();
 function copy(item){
  if(typeof item==='function'||typeof item==='symbol')throw new TypeError('Nur einfache Projektdaten können kopiert werden.');
  if(item===null||typeof item!=='object')return item;
  if(seen.has(item))return seen.get(item);
  const prototype=Object.getPrototypeOf(item),array=Array.isArray(item);
  if(!array&&prototype!==Object.prototype&&prototype!==null)throw new TypeError('Nur einfache Projektdaten können kopiert werden.');
  const result=array?new Array(item.length):{};
  seen.set(item,result);
  for(const [key,entry]of Object.entries(item)){
   // Defining own properties also preserves a literal "__proto__" data key.
   Object.defineProperty(result,key,{value:copy(entry),writable:true,enumerable:true,configurable:true});
  }
  return result;
 }
 return copy(value);
}
