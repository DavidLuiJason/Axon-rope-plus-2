import { CONVERTER_KINDS, convert } from '../src/tools/converter';
let checks=0;
function assert(ok:boolean,message:string){checks++;if(!ok)throw new Error(`FAIL: ${message}`);}
for(const kind of CONVERTER_KINDS){
 const input=kind.entry==='text'?'255':'1';
 const a=convert({kind:kind.id,from:kind.defaultFrom,to:kind.defaultTo,input});
 assert(a.ok,`${kind.id} forwards`);
 if(a.ok){
  const b=convert({kind:kind.id,from:kind.defaultTo,to:kind.defaultFrom,input:a.value});
  assert(b.ok,`${kind.id} reverse`);
  if(b.ok)assert(kind.entry==='text'?b.value==='255':Math.abs(Number(b.value)-1)<1e-7,`${kind.id} round trip`);
  assert(!/NaN|Infinity/.test(a.value),`${kind.id} finite`);
  assert(JSON.stringify(a)===JSON.stringify(convert({kind:kind.id,from:kind.defaultFrom,to:kind.defaultTo,input})),`${kind.id} deterministic`);
 }
 const same=convert({kind:kind.id,from:kind.defaultFrom,to:kind.defaultFrom,input});
 assert(same.ok&&same.value===input,`${kind.id} identity`);
 assert(!convert({kind:kind.id,from:kind.defaultFrom,to:kind.defaultTo,input:' '}).ok,`${kind.id} empty`);
 for(const bad of ['abc','😀','١٢','1e999','9'.repeat(10001)]){
  const r=convert({kind:kind.id,from:kind.defaultFrom,to:kind.defaultTo,input:bad});
  assert(!r.ok,`${kind.id} rejects invalid input`);
 }
}
function value(kind:string,from:string,to:string,input:string){const r=convert({kind,from,to,input});assert(r.ok,`${kind} reference succeeds`);return r.ok?r.value:'';}
assert(value('length','km','m','1')==='1000','km to m');
assert(Math.abs(Number(value('length','km','mi','1'))-0.621371192)<1e-9,'km to mi');
assert(value('temperature','°C','°F','0')==='32','freezing F');
assert(value('temperature','°C','K','0')==='273.15','freezing K');
assert(value('number-base','10','16','255')==='ff','hex');
assert(value('number-base','10','2','255')==='11111111','binary');
assert(value('data','GB','GiB','1')!=='1','decimal and binary data differ');
assert(value('length','m','cm','0,5')==='50','decimal comma');
assert(!convert({kind:'temperature',from:'K',to:'°C',input:'-1'}).ok,'negative kelvin rejected');
assert(convert({kind:'temperature',from:'°C',to:'°F',input:'-10'}).ok,'negative Celsius allowed');
assert(!convert({kind:'missing',from:'a',to:'b',input:'1'}).ok,'unknown kind');
assert(!convert({kind:'length',from:'bad',to:'m',input:'1'}).ok,'unknown unit');
console.log(`toolsConverter: ${checks} checks passed`);
// Regression and mutation guards for the public adapter contract.
function outcome(kind:string,from:string,to:string,input:string){return convert({kind,from,to,input});}
function error(kind:string,from:string,to:string,input:string,expected:string){const r=outcome(kind,from,to,input);assert(!r.ok&&r.error===expected,`${kind} ${input} error ${expected}`);}
assert(value('length','km','m','0.3333333333333')==='333.3333333','ten significant digits');
assert(value('length','km','km','1.50')==='1.50','identity preserves decimal zeros');
assert(value('length','km','km','007')==='007','identity preserves leading zeros');
assert(value('length','km','m','1.50')==='1500','converted value normalized');
assert(value('length','m','cm','1,5')==='150','comma decimal');
for(const input of ['1,5.5','1.5,5','1,000','12,345','123,456','1,000,000'])error('length','km','m',input,'not-a-number');
for(const input of ['0,5','12,34','3,1415','0,500'])assert(outcome('length','m','cm',input).ok,`valid decimal comma ${input}`);
error('length','km','m','1e308','out-of-range');
error('number-base','10','16','zz','invalid-digit');
error('number-base','2','10','102','invalid-digit');
error('number-base','10','16','','empty');
assert(value('number-base','16','10','FF')==='255','uppercase hex');
const hexProof=outcome('number-base','16','10','FF');
assert(hexProof.ok&&hexProof.example==='FF (base 16) = 255 (base 10)','base proof exact');
const mileProof=outcome('length','km','mi','1');
assert(mileProof.ok&&mileProof.example==='1 km = 0.6213711922 mi','length proof exact');
error('length','missing','m','1','unknown-unit');
error('missing','km','m','1','unknown-kind');
const commons:Record<string,string[]>={length:['km','m','mi','ft','in'],mass:['kg','g','lb','oz','t'],temperature:['°C','°F','K'],volume:['L','mL','gal','cup','m³'],area:['m²','km²','ha','ac','ft²'],speed:['km/h','mph','m/s','kn'],time:['s','min','h','d','wk'],data:['bit','B','kB','MB','GB','KiB'],'number-base':['2','8','10','16']};
assert(new Set(CONVERTER_KINDS.map(k=>k.id)).size===CONVERTER_KINDS.length,'unique kinds');
for(const kind of CONVERTER_KINDS){
 assert(kind.defaultFrom!==kind.defaultTo,`${kind.id} distinct defaults`);
 assert(new Set(kind.units.map(u=>u.id)).size===kind.units.length,`${kind.id} unique units`);
 assert(kind.units.some(u=>u.id===kind.defaultFrom)&&kind.units.some(u=>u.id===kind.defaultTo),`${kind.id} defaults exist`);
 assert(JSON.stringify(kind.units.filter(u=>u.common).map(u=>u.id).sort())===JSON.stringify([...commons[kind.id]].sort()),`${kind.id} exact common units`);
 assert(outcome(kind.id,kind.defaultFrom,kind.defaultTo,kind.entry==='text'?'255':'1').ok,`${kind.id} defaults convert`);
}
console.log(`toolsConverter regression: ${checks} checks passed`);
