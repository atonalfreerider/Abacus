// Instrument the supplied SWF with a small ExternalInterface bridge.
// Original methods, drawing assets, frame rate, and animation bytecode are retained.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const source=process.argv[2] || 'public/ABACUS.swf';
const output=process.argv[3] || 'public/abacus-director.swf';
const swf=fs.readFileSync(source);
const data=swf.subarray(0,3).toString()==='CWS'?Buffer.concat([swf.subarray(0,8),zlib.inflateSync(swf.subarray(8))]):swf;
const u30=value=>{const bytes=[];do{let byte=value&127;value>>>=7;if(value)byte|=128;bytes.push(byte);}while(value);return Buffer.from(bytes);};
const cat=(...values)=>Buffer.concat(values.flat().map(value=>typeof value==='number'?Buffer.from([value]):value));
let offset=8+Math.ceil((5+4*(data[8]>>3))/8)+4;
const prefix=data.subarray(8,offset),tags=[];
while(offset<data.length){const header=data.readUInt16LE(offset);offset+=2;const type=header>>6;let length=header&63;if(length===63){length=data.readUInt32LE(offset);offset+=4;}tags.push({type,body:data.subarray(offset,offset+length)});offset+=length;}
const tag=tags.find(tag=>tag.type===82);
let abcStart=4;while(tag.body[abcStart++]);
const originalABC=tag.body.subarray(abcStart);

function instrument(bytes){
  let p=4;
  const byte=()=>bytes[p++];
  const read=()=>{let value=0,shift=0,c;do{c=byte();value|=(c&127)<<shift;shift+=7;}while(c&128);return value>>>0;};
  const section=fn=>{const start=p;const value=fn();return {value,raw:bytes.subarray(start,p)};};
  const skipPool=fn=>{const count=read();for(let i=1;i<count;i++)fn();};
  const numbers=section(()=>{skipPool(read);skipPool(read);skipPool(()=>p+=8);});
  const strings=[null],stringRaw=[null];
  for(let n=read(),i=1;i<n;i++){const start=p,len=read();strings.push(bytes.toString('utf8',p,p+len));p+=len;stringRaw.push(bytes.subarray(start,p));}
  const namespaces=[null],namespaceRaw=[null];
  for(let n=read(),i=1;i<n;i++){const start=p;namespaces.push({kind:byte(),name:read()});namespaceRaw.push(bytes.subarray(start,p));}
  const namespaceSets=section(()=>skipPool(()=>{for(let n=read();n>0;n--)read();}));
  const names=[null],nameRaw=[null];
  for(let n=read(),i=1;i<n;i++){
    const start=p,kind=byte();let value={kind};
    if([7,13].includes(kind))value={...value,space:read(),name:read()};
    else if([15,16].includes(kind))value.name=read();
    else if([9,14].includes(kind)){value.name=read();read();}
    else if([27,28].includes(kind))read();
    else if(kind===29){read();for(let n=read();n>0;n--)read();}
    else if(![17,18].includes(kind))throw Error('Unsupported multiname '+kind);
    names.push(value);nameRaw.push(bytes.subarray(start,p));
  }
  const methods=[];
  for(let n=read();n>0;n--){const start=p,count=read();read();for(let i=0;i<count;i++)read();read();const flags=byte();if(flags&8)for(let c=read();c>0;c--){read();byte();}if(flags&128)for(let i=0;i<count;i++)read();methods.push(bytes.subarray(start,p));}
  const qname=index=>{const name=names[index];return `${strings[namespaces[name.space]?.name]||''}:${strings[name.name]||''}`;};
  const owners={};
  const traits=owner=>{for(let n=read();n>0;n--){const name=qname(read()),attr=byte(),kind=attr&15;if(kind===0||kind===6){read();read();if(read())byte();}else if([1,2,3].includes(kind)){read();owners[read()]=owner+'.'+name;}else if(kind===4){read();read();}else if(kind===5){read();owners[read()]=owner+'.'+name;}else throw Error('Trait '+kind);if(attr&64)for(let c=read();c>0;c--)read();}};
  const declarations=section(()=>{
    for(let n=read();n>0;n--){read();const count=read();for(let i=0;i<count*2;i++)read();}
    const count=read(),classes=[];
    for(let i=0;i<count;i++){const name=qname(read());classes.push(name);read();if(byte()&8)read();for(let n=read();n>0;n--)read();owners[read()]=name+'.constructor';traits(name);}
    for(const name of classes){owners[read()]=name+'.static';traits(name);}
    for(let n=read();n>0;n--){owners[read()]='script';traits('script');}
  });
  const bodies=[];
  for(let n=read();n>0;n--){
    const method=read(),maxStack=read(),locals=read(),initScope=read(),maxScope=read(),length=read();
    const code=bytes.subarray(p,p+length);p+=length;
    const rest=section(()=>{for(let n=read();n>0;n--)for(let i=0;i<5;i++)read();traits('body');}).raw;
    bodies.push({method,maxStack,locals,initScope,maxScope,code,rest});
  }
  if(p!==bytes.length)throw Error('ABC reader did not consume the complete file.');
  const str=text=>{let index=strings.indexOf(text);if(index<0){index=strings.length;strings.push(text);const data=Buffer.from(text);stringRaw.push(cat(u30(data.length),data));}return index;};
  const namespace=text=>{const name=str(text);let index=namespaces.findIndex(ns=>ns?.kind===22&&ns.name===name);if(index<0){index=namespaces.length;namespaces.push({kind:22,name});namespaceRaw.push(cat(22,u30(name)));}return index;};
  const name=(text,space='')=>{const spaceIndex=namespace(space),string=str(text);let index=names.findIndex(n=>n?.kind===7&&n.space===spaceIndex&&n.name===string);if(index<0){index=names.length;names.push({kind:7,space:spaceIndex,name:string});nameRaw.push(cat(7,u30(spaceIndex),u30(string)));}return index;};
  const existing=text=>{const index=names.findIndex((_,i)=>i>0&&qname(i)===text);if(index<0)throw Error('Missing original name '+text);return index;};
  const ext=name('ExternalInterface','flash.external'),addCallback=name('addCallback');
  const classes={};for(const n of ['ABCalc','PolyNom','Constant','InputHandler','Update','Resizer','Operator','Solver','Addition','Multiplication'])classes[n]=existing('absrc:'+n);
  classes.TweenMax=existing('com.greensock:TweenMax');
  classes.TweenEvent=existing('com.greensock.events:TweenEvent');

  class ASM {
    constructor(){this.parts=[];this.labels={};this.fixes=[];this.length=0;}
    put(...values){const buffer=cat(...values);this.parts.push(buffer);this.length+=buffer.length;return this;}
    op(code,...values){return this.put(code,...values.map(u30));}
    label(text){this.labels[text]=this.length;return this.put(0x09);}
    jump(code,label){const offset=this.length;this.put(code,Buffer.alloc(3));this.fixes.push({offset,label});return this;}
    get(local){return local<4?this.put(0xd0+local):this.op(0x62,local);}
    set(local){return local<4?this.put(0xd4+local):this.op(0x63,local);}
    number(value){return this.op(0x25,value);}
    string(value){return this.op(0x2c,str(value));}
    lex(className){return this.op(0x60,classes[className]||name(className));}
    property(text){return this.op(0x66,name(text));}
    assign(text){return this.op(0x61,name(text));}
    call(text,count=0,voidResult=false){return this.op(voidResult?0x4f:0x46,name(text),count);}
    eq(){return this.lex('ABCalc').property('selectedEqu');}
    finish(){const result=Buffer.concat(this.parts);for(const fix of this.fixes){if(this.labels[fix.label]===undefined)throw Error('Undefined label '+fix.label);const delta=this.labels[fix.label]-fix.offset-4;result.writeIntLE(delta,fix.offset+1,3);}return result;}
  }
  const hook=bodies.find(body=>owners[body.method]==='absrc:ABMain.:ABMainInit');
  if(!hook || hook.code.at(-1)!==0x47)throw Error('Original initialization hook not found.');
  // SwitchSign inserts NewOp's container inside the existing sign container.
  // GetSign expects a PlusSign/MinusSign directly inside it. Keep the original
  // sign drawing/recoloring, then flatten that extra wrapper so repeated
  // crossings (especially negative -> positive) retain correct arithmetic.
  const switchSign=bodies.find(body=>owners[body.method]==='absrc:Operator.:SwitchSign');
  if(!switchSign || switchSign.code.at(-1)!==0x47)throw Error('Original sign hook not found.');
  const flatten=new ASM();
  flatten.get(1).number(0).call('getChildAt',1).set(2);
  flatten.get(2).number(0).call('getChildAt',1).number(0).call('getChildAt',1).set(4);
  flatten.get(2).number(0).call('removeChildAt',1,true);
  flatten.get(4).put(0x26).assign('visible');
  flatten.get(2).get(4).number(0).call('addChildAt',2,true).put(0x47);
  switchSign.code=cat(switchSign.code.subarray(0,-1),flatten.finish());
  const callbacks=[];
  function addFunction(callback,params,locals,make){
    const method=methods.length;
    methods.push(cat(u30(params),u30(0),Array.from({length:params},()=>u30(0)),u30(str(callback)),0));
    const a=new ASM();a.get(0).put(0x30);make(a);
    bodies.push({method,maxStack:40,locals,initScope:hook.initScope+1,maxScope:hook.initScope+2,code:a.finish(),rest:Buffer.from([0,0])});
    callbacks.push({callback,method});
  }
  addFunction('abacusClear',0,1,a=>a.lex('ABCalc').eq().property('parent').call('Clear',1,true).put(0x47));
  addFunction('abacusPing',0,1,a=>a.string('bridge-ready').put(0x48));
  addFunction('abacusStep',0,1,a=>a.lex('Solver').eq().call('PEMDAS',1).put(0x48));
  addFunction('abacusSpeed',1,2,a=>a.lex('Solver').get(1).assign('solveSpeed').put(0x47));
  addFunction('abacusState',0,11,a=>{
    a.eq().set(1).op(0x56,0).set(2).number(0).set(3);
    a.lex('PolyNom').get(1).call('GetEqualSign',1).set(4);
    a.get(1).get(4).call('getChildIndex',1).set(5);
    a.label('loop').get(3).get(1).property('numChildren').jump(0x18,'done');
    a.get(3).get(5).jump(0x13,'next');
    a.get(1).get(3).call('getChildAt',1).set(6);
    a.get(2);
    a.string('index').get(3).string('kind').lex('PolyNom').get(6).call('GetDegree',1);
    a.string('value').lex('PolyNom').get(6).call('CoeffVal',1);
    a.string('positive').lex('PolyNom').get(6).call('GetSign',1);
    a.string('x').get(6).property('x').string('y').get(6).property('y');
    a.string('width').lex('PolyNom').get(6).call('GetTermWidth',1);
    a.string('children').get(6).property('numChildren');
    a.op(0x55,8).call('push',1,true);
    a.label('next').op(0xc2,3).jump(0x10,'loop');
    a.label('done').lex('TweenMax').call('getAllTweens').set(7).number(0).set(8).number(0).set(9);
    a.label('tweens').get(8).get(7).property('length').jump(0x18,'counted');
    a.get(7).get(8).op(0x66,names.findIndex(n=>n?.kind===27)).set(10);
    a.get(10).property('_active').jump(0x12,'inactive');
    // Unsolved variable cards pulse forever in UpdateVariables. They do not
    // block a director step; all their original animation code still runs.
    a.get(10).property('timeline').property('vars').property('onComplete').lex('Update').property('UpdateVariables').jump(0x13,'inactive');
    a.op(0xc2,9);
    a.label('inactive').op(0xc2,8).jump(0x10,'tweens');
    a.label('counted').string('terms').get(2).string('equalIndex').get(5);
    a.string('hasEquals').get(4).number(0).call('getChildAt',1).property('visible');
    a.string('busy').get(9);
    a.string('dragging').lex('PolyNom').property('downMouse');
    a.string('bridgeVersion').string('1.0.0').op(0x55,6).put(0x48);
  });
  // Director moves reuse SwitchSign, UpdateEquation, and CenterScale from the SWF.
  addFunction('abacusMove',2,7,a=>{
    a.eq().set(3).get(3).get(1).call('getChildAt',1).set(4);
    a.lex('PolyNom').get(3).call('GetEqualSign',1).set(5);
    a.get(3).get(5).call('getChildIndex',1).set(6);
    a.get(1).get(6).put(0xad).get(2).number(0).put(0xad,0xab).jump(0x11,'end');
    a.lex('Operator').get(4).call('SwitchSign',1,true);
    a.get(3).get(4).get(2).number(0).jump(0x15,'left');
    a.get(3).property('numChildren').number(1).put(0xa1).jump(0x10,'place');
    a.label('left').number(0);
    a.label('place').call('setChildIndex',2,true);
    a.lex('Update').get(3).string('tween').call('UpdateEquation',2,true);
    a.lex('Resizer').get(3).call('CenterScale',1,true);
    a.label('end').put(0x47);
  });
  // The same Adder used by the SWF's drop handler drives merge, carry, and borrow.
  addFunction('abacusCombine',2,6,a=>{
    a.eq().get(1).call('getChildAt',1).set(3);
    a.eq().get(2).call('getChildAt',1).set(4);
    a.lex('PolyNom').get(3).call('CoeffVal',1).lex('PolyNom').get(4).call('CoeffVal',1).jump(0x18,'ordered');
    a.get(3).set(5).get(4).set(3).get(5).set(4);
    a.label('ordered').lex('Addition').get(3).get(4).string('1Step').call('Adder',3);
    a.lex('TweenEvent').property('COMPLETE').lex('Update').property('ResettleUpdate').call('addEventListener',2,true).put(0x47);
  });
  const registration=new ASM();
  registration.op(0x60,ext).property('available').jump(0x12,'end');
  registration.op(0x60,ext).string('abacusInput').lex('InputHandler').property('InputFunction').op(0x4f,addCallback,2);
  for(const callback of callbacks)registration.op(0x60,ext).string(callback.callback).op(0x40,callback.method).op(0x4f,addCallback,2);
  registration.label('end').put(0x47);
  hook.code=cat(hook.code.subarray(0,-1),registration.finish());hook.maxStack=Math.max(hook.maxStack,4);
  const encodePool=items=>cat(u30(items.length),items.slice(1));
  const encodedBodies=bodies.map(body=>cat(u30(body.method),u30(body.maxStack),u30(body.locals),u30(body.initScope),u30(body.maxScope),u30(body.code.length),body.code,body.rest));
  const result=cat(bytes.subarray(0,4),numbers.raw,encodePool(stringRaw),encodePool(namespaceRaw),namespaceSets.raw,encodePool(nameRaw),u30(methods.length),methods,declarations.raw,u30(bodies.length),encodedBodies);
  return {bytes:result,callbacks:['abacusInput',...callbacks.map(c=>c.callback)]};
}
const patched=instrument(originalABC);
tag.body=cat(tag.body.subarray(0,abcStart),patched.bytes);
const encodeTag=tag=>{const header=Buffer.alloc(6);header.writeUInt16LE(tag.type<<6|63);header.writeUInt32LE(tag.body.length,2);return cat(header,tag.body);};
const body=cat(prefix,tags.map(encodeTag));
const header=Buffer.from(swf.subarray(0,8));header.write('CWS');header.writeUInt32LE(body.length+8,4);
fs.writeFileSync(output,cat(header,zlib.deflateSync(body)));
fs.writeFileSync('public/ABACUS.swf',swf);
const report={source:source.split(/[\\/]/).at(-1),sourceSha256:crypto.createHash('sha256').update(swf).digest('hex'),output:output.split(/[\\/]/).at(-1),outputSha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex'),callbacks:patched.callbacks,originalDrawingTagsRetained:true,appendedHooks:['ABMain.ABMainInit: director callback registration','Operator.SwitchSign: flatten nested sign container; preserve original sign artwork and recoloring']};
fs.writeFileSync('public/swf-provenance.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
