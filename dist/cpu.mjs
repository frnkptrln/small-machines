// Instruction-level NMOS 6502. Official opcodes; no undocumented opcodes or bus-cycle simulation.
export const hex=(n,w=2)=>(n>>>0).toString(16).toUpperCase().padStart(w,'0');
export const OPS=Array(256).fill(null);
const rows=[
'00 BRK imp 7;01 ORA izx 6;05 ORA zp 3;06 ASL zp 5;08 PHP imp 3;09 ORA imm 2;0A ASL acc 2;0D ORA abs 4;0E ASL abs 6',
'10 BPL rel 2;11 ORA izy 5+;15 ORA zpx 4;16 ASL zpx 6;18 CLC imp 2;19 ORA aby 4+;1D ORA abx 4+;1E ASL abx 7',
'20 JSR abs 6;21 AND izx 6;24 BIT zp 3;25 AND zp 3;26 ROL zp 5;28 PLP imp 4;29 AND imm 2;2A ROL acc 2;2C BIT abs 4;2D AND abs 4;2E ROL abs 6',
'30 BMI rel 2;31 AND izy 5+;35 AND zpx 4;36 ROL zpx 6;38 SEC imp 2;39 AND aby 4+;3D AND abx 4+;3E ROL abx 7',
'40 RTI imp 6;41 EOR izx 6;45 EOR zp 3;46 LSR zp 5;48 PHA imp 3;49 EOR imm 2;4A LSR acc 2;4C JMP abs 3;4D EOR abs 4;4E LSR abs 6',
'50 BVC rel 2;51 EOR izy 5+;55 EOR zpx 4;56 LSR zpx 6;58 CLI imp 2;59 EOR aby 4+;5D EOR abx 4+;5E LSR abx 7',
'60 RTS imp 6;61 ADC izx 6;65 ADC zp 3;66 ROR zp 5;68 PLA imp 4;69 ADC imm 2;6A ROR acc 2;6C JMP ind 5;6D ADC abs 4;6E ROR abs 6',
'70 BVS rel 2;71 ADC izy 5+;75 ADC zpx 4;76 ROR zpx 6;78 SEI imp 2;79 ADC aby 4+;7D ADC abx 4+;7E ROR abx 7',
'81 STA izx 6;84 STY zp 3;85 STA zp 3;86 STX zp 3;88 DEY imp 2;8A TXA imp 2;8C STY abs 4;8D STA abs 4;8E STX abs 4',
'90 BCC rel 2;91 STA izy 6;94 STY zpx 4;95 STA zpx 4;96 STX zpy 4;98 TYA imp 2;99 STA aby 5;9A TXS imp 2;9D STA abx 5',
'A0 LDY imm 2;A1 LDA izx 6;A2 LDX imm 2;A4 LDY zp 3;A5 LDA zp 3;A6 LDX zp 3;A8 TAY imp 2;A9 LDA imm 2;AA TAX imp 2;AC LDY abs 4;AD LDA abs 4;AE LDX abs 4',
'B0 BCS rel 2;B1 LDA izy 5+;B4 LDY zpx 4;B5 LDA zpx 4;B6 LDX zpy 4;B8 CLV imp 2;B9 LDA aby 4+;BA TSX imp 2;BC LDY abx 4+;BD LDA abx 4+;BE LDX aby 4+',
'C0 CPY imm 2;C1 CMP izx 6;C4 CPY zp 3;C5 CMP zp 3;C6 DEC zp 5;C8 INY imp 2;C9 CMP imm 2;CA DEX imp 2;CC CPY abs 4;CD CMP abs 4;CE DEC abs 6',
'D0 BNE rel 2;D1 CMP izy 5+;D5 CMP zpx 4;D6 DEC zpx 6;D8 CLD imp 2;D9 CMP aby 4+;DD CMP abx 4+;DE DEC abx 7',
'E0 CPX imm 2;E1 SBC izx 6;E4 CPX zp 3;E5 SBC zp 3;E6 INC zp 5;E8 INX imp 2;E9 SBC imm 2;EA NOP imp 2;EC CPX abs 4;ED SBC abs 4;EE INC abs 6',
'F0 BEQ rel 2;F1 SBC izy 5+;F5 SBC zpx 4;F6 INC zpx 6;F8 SED imp 2;F9 SBC aby 4+;FD SBC abx 4+;FE INC abx 7'];
export const sizes={imp:1,acc:1,imm:2,zp:2,zpx:2,zpy:2,izx:2,izy:2,rel:2,abs:3,abx:3,aby:3,ind:3};
for(const row of rows) for(const def of row.split(';')){const [op,name,mode,cy]=def.split(' ');OPS[parseInt(op,16)]={name,mode,cycles:parseInt(cy),page:cy.includes('+'),size:sizes[mode]};}
export class CPU6502 {
 constructor(memory=new Uint8Array(65536),onWrite=null){this.mem=memory;this.onWrite=onWrite;this.reset(0x1000);}
 reset(pc){this.a=this.x=this.y=0;this.sp=0xfd;this.p=0x24;this.pc=pc??this.word(0xfffc);this.cycles=0;this.instructions=0;this.lastPC=this.pc;}
 read(a){return this.mem[a&65535];} write(a,v){a&=65535;v&=255;this.mem[a]=v;this.onWrite?.(a,v);}
 word(a){return this.read(a)|(this.read(a+1)<<8);} fetch(){let v=this.read(this.pc);this.pc=(this.pc+1)&65535;return v;}
 fetchWord(){return this.fetch()|(this.fetch()<<8);} push(v){this.write(0x100|this.sp,v);this.sp=(this.sp-1)&255;} pop(){this.sp=(this.sp+1)&255;return this.read(0x100|this.sp);}
 flag(mask,val){this.p=(this.p&~mask)|(val?mask:0);} nz(v){v&=255;this.p=(this.p&0x7d)|(v===0?2:0)|(v&128);return v;}
 compare(a,b){this.flag(1,a>=b);this.nz(a-b);}
 adc(v){const a=this.a,c=this.p&1,bin=a+v+c;this.flag(2,(bin&255)===0);
  if(this.p&8){let lo=(a&15)+(v&15)+c;if(lo>=10)lo=((lo+6)&15)+16;let sum=(a&240)+(v&240)+lo;this.flag(128,sum&128);this.flag(64,(~(a^v)&(a^sum)&128)!==0);if(sum>=160)sum+=96;this.flag(1,sum>255);this.a=sum&255;}
  else {this.flag(64,(~(a^v)&(a^bin)&128)!==0);this.flag(1,bin>255);this.a=this.nz(bin);}}
 sbc(v){const a=this.a,b=1-(this.p&1),diff=a-v-b;this.flag(64,((a^v)&(a^diff)&128)!==0);this.flag(1,diff>=0);this.nz(diff);
  if(this.p&8){let lo=(a&15)-(v&15)-b,hi=(a>>4)-(v>>4);if(lo<0){lo-=6;hi--;}if(hi<0)hi-=6;this.a=((hi<<4)|(lo&15))&255;}else this.a=diff&255;}
 interrupt(nmi=false){if(!nmi&&(this.p&4))return 0;this.push(this.pc>>8);this.push(this.pc);this.push((this.p|32)&~16);this.p|=4;this.pc=this.word(nmi?0xfffa:0xfffe);this.cycles+=7;return 7;}
 step(){this.lastPC=this.pc;const opcode=this.fetch(),o=OPS[opcode];if(!o)throw Error(`Nicht unterstützter Opcode $${hex(opcode)} bei $${hex(this.lastPC,4)}`);
  let addr=0,base=0,c=o.cycles;const m=o.mode;
  if(m==='imm'){addr=this.pc;this.pc=(this.pc+1)&65535;}
  else if(m==='zp')addr=this.fetch();else if(m==='zpx')addr=(this.fetch()+this.x)&255;else if(m==='zpy')addr=(this.fetch()+this.y)&255;
  else if(m==='abs')addr=this.fetchWord();else if(m==='abx'||m==='aby'){base=this.fetchWord();addr=(base+(m==='abx'?this.x:this.y))&65535;}
  else if(m==='izx'){base=(this.fetch()+this.x)&255;addr=this.read(base)|(this.read((base+1)&255)<<8);}
  else if(m==='izy'){let z=this.fetch();base=this.read(z)|(this.read((z+1)&255)<<8);addr=(base+this.y)&65535;}
  else if(m==='ind'){base=this.fetchWord();addr=this.read(base)|(this.read((base&0xff00)|((base+1)&255))<<8);}
  else if(m==='rel'){let d=this.fetch();addr=(this.pc+(d<128?d:d-256))&65535;}
  if(o.page&&((addr^base)&0xff00))c++;
  const read=()=>m==='acc'?this.a:this.read(addr),write=v=>{if(m==='acc')this.a=v&255;else this.write(addr,v);};let v;
  switch(o.name){
   case 'LDA':this.a=this.nz(read());break;case 'LDX':this.x=this.nz(read());break;case 'LDY':this.y=this.nz(read());break;
   case 'STA':write(this.a);break;case 'STX':write(this.x);break;case 'STY':write(this.y);break;
   case 'ADC':this.adc(read());break;case 'SBC':this.sbc(read());break;case 'AND':this.a=this.nz(this.a&read());break;case 'ORA':this.a=this.nz(this.a|read());break;case 'EOR':this.a=this.nz(this.a^read());break;
   case 'CMP':this.compare(this.a,read());break;case 'CPX':this.compare(this.x,read());break;case 'CPY':this.compare(this.y,read());break;
   case 'BIT':v=read();this.p=(this.p&0x3d)|(v&0xc0)|((this.a&v)?0:2);break;
   case 'ASL':v=read();this.flag(1,v&128);write(this.nz(v<<1));break;case 'LSR':v=read();this.flag(1,v&1);write(this.nz(v>>1));break;
   case 'ROL':v=(read()<<1)|(this.p&1);this.flag(1,v&256);write(this.nz(v));break;case 'ROR':v=read();{let old=this.p&1;this.flag(1,v&1);write(this.nz((v>>1)|(old<<7)));}break;
   case 'INC':write(this.nz(read()+1));break;case 'DEC':write(this.nz(read()-1));break;
   case 'INX':this.x=this.nz(this.x+1);break;case 'INY':this.y=this.nz(this.y+1);break;case 'DEX':this.x=this.nz(this.x-1);break;case 'DEY':this.y=this.nz(this.y-1);break;
   case 'TAX':this.x=this.nz(this.a);break;case 'TAY':this.y=this.nz(this.a);break;case 'TXA':this.a=this.nz(this.x);break;case 'TYA':this.a=this.nz(this.y);break;case 'TSX':this.x=this.nz(this.sp);break;case 'TXS':this.sp=this.x;break;
   case 'PHA':this.push(this.a);break;case 'PLA':this.a=this.nz(this.pop());break;case 'PHP':this.push(this.p|0x30);break;case 'PLP':this.p=(this.pop()&~16)|32;break;
   case 'CLC':this.p&=~1;break;case 'SEC':this.p|=1;break;case 'CLI':this.p&=~4;break;case 'SEI':this.p|=4;break;case 'CLD':this.p&=~8;break;case 'SED':this.p|=8;break;case 'CLV':this.p&=~64;break;
   case 'JMP':this.pc=addr;break;case 'JSR':v=(this.pc-1)&65535;this.push(v>>8);this.push(v);this.pc=addr;break;case 'RTS':this.pc=(this.pop()|(this.pop()<<8))+1;this.pc&=65535;break;
   case 'RTI':this.p=(this.pop()&~16)|32;this.pc=this.pop()|(this.pop()<<8);break;
   case 'BRK':this.pc=(this.pc+1)&65535;this.push(this.pc>>8);this.push(this.pc);this.push(this.p|0x30);this.p|=4;this.pc=this.word(0xfffe);break;
   case 'BPL':case 'BMI':case 'BVC':case 'BVS':case 'BCC':case 'BCS':case 'BNE':case 'BEQ':{const mask={BPL:128,BMI:128,BVC:64,BVS:64,BCC:1,BCS:1,BNE:2,BEQ:2}[o.name],yes=['BMI','BVS','BCS','BEQ'].includes(o.name);if(Boolean(this.p&mask)===yes){c+=1+Boolean((this.pc^addr)&0xff00);this.pc=addr;}break;}
  }
  this.cycles+=c;this.instructions++;return c;
 }
 snapshot(){return {a:this.a,x:this.x,y:this.y,sp:this.sp,p:this.p,pc:this.pc,lastPC:this.lastPC,cycles:this.cycles,instructions:this.instructions};}
}
export function disassemble(mem,pc,count=8){let out=[];for(let i=0;i<count;i++){let o=OPS[mem[pc]],start=pc;if(!o){out.push({address:pc,text:'.byte $'+hex(mem[pc]),bytes:hex(mem[pc])});pc=(pc+1)&65535;continue;}let b=mem[(pc+1)&65535],w=b|(mem[(pc+2)&65535]<<8),v='$'+hex(o.size===3?w:b,o.size===3?4:2);const operands={imp:'',acc:'A',imm:'#'+v,zp:v,zpx:v+',X',zpy:v+',Y',abs:v,abx:v+',X',aby:v+',Y',izx:'('+v+',X)',izy:'('+v+'),Y',ind:'('+v+')',rel:'$'+hex((pc+2+(b<128?b:b-256))&65535,4)};out.push({address:start,text:o.name+' '+operands[o.mode],bytes:Array.from({length:o.size},(_,j)=>hex(mem[(pc+j)&65535])).join(' ')});pc=(pc+o.size)&65535;}return out;}
