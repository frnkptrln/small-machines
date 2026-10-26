import assert from 'node:assert/strict';
import test from 'node:test';
import {CPU6502,OPS} from '../dist/cpu.mjs';
import {assemble} from '../dist/assembler.mjs';
import {Machine,SID,PRESETS,freshProject,validateProject,CLOCK} from '../dist/machine.mjs';
const machine=(source)=>{const p=assemble(source),c=new CPU6502();for(const [a,v]of p.writes)c.mem[a]=v;c.pc=p.entry;return c;};

test('151 official opcodes; binary ADC/SBC exhaustively match independent integer arithmetic',()=>{
 assert.equal(OPS.filter(Boolean).length,151);const c=new CPU6502();
 for(let a=0;a<256;a++)for(let b=0;b<256;b++)for(let carry=0;carry<2;carry++){
  c.a=a;c.p=32|carry;c.adc(b);const sum=a+b+carry,r=sum&255,sa=a<128?a:a-256,sb=b<128?b:b-256,signed=sa+sb+carry;
  assert.equal(c.a,r);assert.equal(c.p&1,+(sum>255));assert.equal(!!(c.p&64),signed< -128||signed>127);assert.equal(!!(c.p&2),r===0);assert.equal(c.p&128,r&128);
  c.a=a;c.p=32|carry;c.sbc(b);const diff=a-b-(1-carry),dr=diff&255,sd=sa-sb-(1-carry);
  assert.equal(c.a,dr);assert.equal(c.p&1,+(diff>=0));assert.equal(!!(c.p&64),sd< -128||sd>127);assert.equal(!!(c.p&2),dr===0);assert.equal(c.p&128,dr&128);
 }
});
test('all valid BCD operands, carry and borrow',()=>{const c=new CPU6502(),bcd=n=>((Math.floor(n/10)<<4)|(n%10));for(let a=0;a<100;a++)for(let b=0;b<100;b++)for(let carry=0;carry<2;carry++){
 c.a=bcd(a);c.p=40|carry;c.adc(bcd(b));assert.equal(c.a,bcd((a+b+carry)%100));assert.equal(c.p&1,+(a+b+carry>=100));
 c.a=bcd(a);c.p=40|carry;c.sbc(bcd(b));const d=a-b-(1-carry);assert.equal(c.a,bcd((d+100)%100));assert.equal(c.p&1,+(d>=0));}
});
test('stack, subroutines, branches and indexed memory',()=>{const c=machine(`.org $1000
 LDX #$05
 LDA #$00
loop: CLC
 ADC #$03
 DEX
 BNE loop
 JSR double
 STA $2000
 JMP done
double: ASL A
 RTS
done: NOP`);for(let i=0;i<27;i++)c.step();assert.equal(c.mem[0x2000],30);assert.equal(c.sp,0xfd);});
test('JMP indirect page-wrap quirk, zero-page wrap, indexed page penalties',()=>{
 const c=new CPU6502();c.mem.set([0x6c,0xff,0x20],0x1000);c.mem[0x20ff]=0x34;c.mem[0x2000]=0x12;c.mem[0x2100]=0x99;assert.equal(c.step(),5);assert.equal(c.pc,0x1234);
 c.reset(0x1000);c.mem.set([0xa1,0xff],0x1000);c.mem[255]=0x45;c.mem[0]=0x23;c.mem[0x2345]=0x67;c.step();assert.equal(c.a,0x67);
 c.reset(0x1000);c.x=1;c.mem.set([0xbd,0xff,0x20],0x1000);c.mem[0x2100]=0x42;assert.equal(c.step(),5);assert.equal(c.a,0x42);
 c.reset(0x10fd);c.mem.set([0xd0,2],0x10fd);assert.equal(c.step(),4);assert.equal(c.pc,0x1101);
});
test('BRK/RTI and interrupt stack distinguish B flag and preserve return address',()=>{const c=new CPU6502();c.mem[0xfffe]=0;c.mem[0xffff]=0x30;c.mem[0x3000]=0x40;c.step();assert.equal(c.pc,0x3000);assert.equal(c.mem[0x1fb]&16,16);c.step();assert.equal(c.pc,0x1002);assert.equal(c.sp,0xfd);c.p&=~4;assert.equal(c.interrupt(),7);assert.equal(c.mem[0x1fb]&16,0);c.step();assert.equal(c.pc,0x1002);});
test('rotations, BIT, store, compare, logic and transfer flags',()=>{const c=machine(`LDA #$81
SEC
ROR A
ROL A
STA $40
BIT $40
LDX #$7F
INX
TXA
CMP #$80
EOR #$FF
AND #$0F
ORA #$80`);c.step();c.step();c.step();assert.equal(c.a,0xc0);c.step();assert.equal(c.a,0x81);c.step();c.step();assert.equal(c.p&0xc2,0x80);for(let i=0;i<7;i++)c.step();assert.equal(c.a,0x8f);});
test('assembler known bytes, low/high labels, directives and rejection',()=>{const p=assemble(`.org $1200
play: LDA #$42
STA $D400
LDX #$02
loop: DEX
BNE loop
.word play
.byte <play, >play`);assert.deepEqual(p.writes.map(x=>x[1]),[0xa9,0x42,0x8d,0,0xd4,0xa2,2,0xca,0xd0,0xfd,0,0x12,0,0x12]);assert.equal(p.entry,0x1200);assert.throws(()=>assemble('LDA #$100'));assert.throws(()=>assemble('BNE $4000'));assert.throws(()=>assemble('JMP nowhere'));assert.throws(()=>assemble('.org $FFFF\n.word $1234'));assert.throws(()=>assemble('.org $1000\n.byte 1\n.org $1000\n.byte 2'));});
test('official opcodes decode and terminate one instruction; illegal opcode traps',()=>{for(let code=0;code<256;code++){if(!OPS[code])continue;const c=new CPU6502();c.mem[0x1000]=code;assert.ok(c.step()>=2);}const c=new CPU6502();c.mem[0x1000]=2;assert.throws(()=>c.step(),/Opcode/);});
test('every preset generates finite bounded samples; empty pattern is silent',()=>{for(let index=0;index<PRESETS.length;index++){const m=new Machine(44100,freshProject(index));m.start();let peak=0,energy=0;for(let i=0;i<44100*3;i++){const x=m.sample();assert.ok(Number.isFinite(x)&&Math.abs(x)<=1);peak=Math.max(peak,Math.abs(x));energy+=x*x;}assert.equal(m.error,null);assert.ok(m.cpu.instructions>100);assert.equal(m.cpu.sp,0xfd);if(index<3){assert.ok(peak>.1);assert.ok(energy>1);}else assert.equal(energy,0);}});
test('SID oscillator tuning follows its 16-bit frequency register',()=>{const sid=new SID(48000),f=Math.round(440*16777216/CLOCK);sid.write(0,f&255);sid.write(1,f>>8);sid.write(5,0);sid.write(6,0xf0);sid.write(24,15);sid.write(4,17);let crossings=0,last=0;for(let i=0;i<48000;i++){const x=sid.sample();if(i>4800&&last<0&&x>=0)crossings++;last=x;}assert.ok(Math.abs(crossings/0.9-440)<2,`measured ${crossings/0.9} Hz`);});
test('CPU code determines SID writes; editing it changes sound; live filter updates use CPU',()=>{const m=new Machine(),p=freshProject();m.start();for(let i=0;i<4410;i++)m.sample();assert.ok(m.writes.some(w=>w.address>=0xd400));p.cutoff=350;m.setProject(p);assert.equal(m.sid.reg[21]+8*m.sid.reg[22],350);assert.ok(m.writes.some(w=>w.address===0xd416));const silent=freshProject();silent.source='.org $1000\nplay: LDA #0\nSTA $D418\nRTS';const s=new Machine(44100,silent);s.start();for(let i=0;i<4410;i++)assert.equal(s.sample(),0);});
test('manual notes, mute, release, deterministic render, invalid programs stop',()=>{const a=new Machine(),b=new Machine();a.noteOn(0,69);b.noteOn(0,69);for(let i=0;i<2000;i++)assert.equal(a.sample(),b.sample());a.noteOff(0);for(let i=0;i<44100*2;i++)a.sample();assert.equal(a.sid.voices[0].env,0);const p=freshProject();p.voices[0].mute=true;a.setProject(p);a.noteOn(0,69);assert.equal(a.sid.reg[4]&1,0);const inf=freshProject();inf.source='play: JMP play';const m=new Machine(44100,inf);m.start();m.sample();assert.match(m.error,/4096/);assert.equal(m.playing,false);});
test('debug step walks the same loaded code and project validation rejects bad input',()=>{const m=new Machine();let s=m.debugStep();assert.equal(s.cpu.x,24);assert.equal(s.cpu.pc,0x1002);s=m.debugStep();assert.equal(s.cpu.a,31);assert.equal(s.cpu.pc,0x1005);assert.throws(()=>validateProject({...freshProject(),bpm:NaN}));assert.throws(()=>validateProject({...freshProject(),name:null}));assert.throws(()=>validateProject({...freshProject(),patterns:[[200],[],[]]}));});
test('AudioWorklet integration: setup, audio blocks, project edits, stop, step and error',async()=>{globalThis.sampleRate=48000;let Processor;globalThis.AudioWorkletProcessor=class{constructor(){this.messages=[];this.port={postMessage:m=>this.messages.push(m)};}};globalThis.registerProcessor=(name,p)=>{assert.equal(name,'sid-65');Processor=p;};await import('../dist/worklet.mjs');const p=new Processor(),message=d=>p.port.onmessage({data:d});message({type:'project',project:freshProject(),reload:true});message({type:'play'});let energy=0;for(let n=0;n<200;n++){const out=new Float32Array(128);assert.equal(p.process([],[[out]]),true);for(const x of out)energy+=x*x;}assert.ok(energy>1);assert.ok(p.messages.some(m=>m.state?.playing));message({type:'stop'});assert.equal(p.machine.playing,false);message({type:'step'});assert.ok(p.machine.debugging);message({type:'load',source:'JMP missing'});assert.equal(p.messages.at(-1).type,'error');message({type:'panic'});assert.equal(p.machine.sid.voices[0].env,0);});
test('WAV worker returns valid PCM with nonzero signal and correct duration',async()=>{let result;globalThis.self={postMessage:d=>{result=d;}};await import('../dist/render-worker.mjs');self.onmessage({data:{project:freshProject(1)}});assert.ok(result.buffer);const v=new DataView(result.buffer),txt=(n,l)=>String.fromCharCode(...new Uint8Array(result.buffer,n,l));assert.equal(txt(0,4),'RIFF');assert.equal(txt(8,4),'WAVE');assert.equal(v.getUint32(24,true),44100);assert.equal(v.getUint32(40,true),result.buffer.byteLength-44);const expected=Math.round(64*60/128/4*44100)+44100*4;assert.equal((result.buffer.byteLength-44)/2,expected);let nonzero=false;for(let i=44;i<10000;i+=2)if(v.getInt16(i,true))nonzero=true;assert.ok(nonzero);});
