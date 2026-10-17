export type BaseConvertResult={ok:true;value:string;decimal:string}|{ok:false;error:'invalid-input'|'invalid-base'|'digit-out-of-range'|'too-long'};
export function convertBase(value:string,fromBase:number,toBase:number,options:{group?:number}={}):BaseConvertResult {
 if(typeof value!=='string'||value.length===0)return{ok:false,error:'invalid-input'};
 if(!Number.isInteger(fromBase)||!Number.isInteger(toBase)||fromBase<2||fromBase>36||toBase<2||toBase>36)return{ok:false,error:'invalid-base'};
 if(value.length>10000)return{ok:false,error:'too-long'};
 const raw=value.trim();if(!/^[+-]?[0-9a-z]+$/i.test(raw))return{ok:false,error:'invalid-input'};
 const neg=raw[0]==='-', digits=raw.replace(/^[+-]/,'').toUpperCase();
 let n=0n;
 for(const c of digits){const d=parseInt(c,36);if(d>=fromBase)return{ok:false,error:'digit-out-of-range'};n=n*BigInt(fromBase)+BigInt(d);}
 if(neg)n=-n;
 const sign=n<0n?'-':'', abs=n<0n?-n:n;
 let out=abs.toString(toBase).toUpperCase();
 const group=options.group;
 if(group!==undefined&&(!Number.isInteger(group)||group<1||group>32))return{ok:false,error:'invalid-input'};
 if(group){const chunks:string[]=[];for(let end=out.length;end>0;end-=group)chunks.unshift(out.slice(Math.max(0,end-group),end));out=chunks.join('_');}
 return{ok:true,value:sign+out,decimal:n.toString()};
}
