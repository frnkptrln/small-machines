import {OPS,sizes,hex} from './cpu.mjs';
const lookup=new Map();OPS.forEach((o,i)=>{if(o)lookup.set(o.name+'/'+o.mode,i);});
// Deliberately small, non-evaluating assembler: labels, constants, .org/.byte/.word and all official addressing modes.
export function assemble(source){
 if(typeof source!=='string'||source.length>30000)throw Error('Programm zu groß (max. 30.000 Zeichen).');
 const labels=Object.create(null),lines=source.split(/\r?\n/),records=[];let pc=0x1000,origin=null;
 const value=(s,loose=false)=>{s=s.trim().toUpperCase();let part=s.match(/^([<>]?)(\$[\dA-F]+|%[01]+|\d+|[A-Z_]\w*)(?:\s*([+-])\s*(\$[\dA-F]+|\d+))?$/);if(!part)throw Error('Ungültiger Ausdruck: '+s);let raw=part[2],n=raw[0]==='$'?parseInt(raw.slice(1),16):raw[0]==='%'?parseInt(raw.slice(1),2):/^\d+$/.test(raw)?Number(raw):labels[raw];if(n===undefined){if(loose)return 65535;throw Error('Unbekanntes Label: '+raw);}if(part[3])n+=(part[3]==='+'?1:-1)*(part[4][0]==='$'?parseInt(part[4].slice(1),16):Number(part[4]));return part[1]==='<'?n&255:part[1]==='>'?(n>>8)&255:n;};
 for(let ln=0;ln<lines.length;ln++){try{let s=lines[ln].split(';')[0].trim().toUpperCase();if(!s)continue;let label=s.match(/^([A-Z_]\w*):/);if(label){if(labels[label[1]]!==undefined)throw Error('Doppeltes Label');labels[label[1]]=pc;s=s.slice(label[0].length).trim();if(!s)continue;}let eq=s.match(/^([A-Z_]\w*)\s*=\s*(.+)$/);if(eq){if(labels[eq[1]]!==undefined)throw Error('Doppelter Name');labels[eq[1]]=value(eq[2]);continue;}
 let [_,name,arg='']=s.match(/^(\.?\w+)\s*(.*)$/)||[];if(!name)throw Error('Syntaxfehler');
 if(name==='.ORG'){pc=value(arg);if(pc<0||pc>65535)throw Error('Adresse außerhalb des Speichers');continue;}
 if(origin===null)origin=pc;
 if(name==='.BYTE'||name==='.WORD'){const args=arg.split(',');records.push({pc,name,args,line:ln+1});pc+=args.length*(name==='.WORD'?2:1);}
 else {let mode='imp',expr=arg,m;if(!arg)mode='imp';else if(arg==='A')mode='acc';else if(arg[0]==='#'){mode='imm';expr=arg.slice(1);}else if(/^B(CC|CS|EQ|MI|NE|PL|VC|VS)$/.test(name))mode='rel';else if((m=arg.match(/^\((.+),\s*X\)$/))){mode='izx';expr=m[1];}else if((m=arg.match(/^\((.+)\),\s*Y$/))){mode='izy';expr=m[1];}else if((m=arg.match(/^\((.+)\)$/))){mode='ind';expr=m[1];}else {m=arg.match(/^(.+?)(?:,\s*([XY]))?$/);expr=m[1];let idx=m[2]?.toLowerCase()||'';let short=idx?'zp'+idx:'zp',long=idx==='x'?'abx':idx==='y'?'aby':'abs';mode=value(expr,true)<=255&&lookup.has(name+'/'+short)?short:long;}
 const opcode=lookup.get(name+'/'+mode);if(opcode===undefined)throw Error('Unbekannter Befehl / Adressmodus: '+s);records.push({pc,opcode,mode,expr,line:ln+1});pc+=sizes[mode];}
 if(pc>65536)throw Error('Programm überschreitet 64 KB');
 }catch(e){throw Error(`Zeile ${ln+1}: ${e.message}`);}}
 const writes=[],listing=[];const occupied=new Set();
 const put=(addr,v)=>{if(occupied.has(addr))throw Error('Überlappende .org-Bereiche');occupied.add(addr);writes.push([addr,v&255]);};
 for(const r of records){try{let p=r.pc,bytes=[];const emit=v=>{bytes.push(v&255);put(p++,v);};if(r.args){for(const a of r.args){let n=value(a);if(n<0||n>(r.name==='.WORD'?65535:255))throw Error('Wert außerhalb des Wertebereichs');emit(n);if(r.name==='.WORD')emit(n>>8);}}else{emit(r.opcode);if(sizes[r.mode]>1){let n=value(r.expr);if(r.mode==='rel'){n=n-(r.pc+2);if(n< -128||n>127)throw Error('Sprungziel zu weit entfernt');}else if(n<0||n>(sizes[r.mode]===2?255:65535))throw Error('Wert außerhalb des Wertebereichs');emit(n);if(sizes[r.mode]===3)emit(n>>8);}}listing.push({address:r.pc,bytes:bytes.map(x=>hex(x)).join(' '),line:r.line});}catch(e){throw Error(`Zeile ${r.line}: ${e.message}`);}}
 if(!writes.length)throw Error('Leeres Programm');return {origin,entry:labels.PLAY??origin,labels,writes,listing};
}
