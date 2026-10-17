export type PercentageMode='percent-of'|'what-percent'|'change'|'adjust'|'percent-of-what';
export type PercentageResult={ok:true;value:number;formatted:string}|{ok:false;error:'invalid-value'|'division-by-zero'|'invalid-mode'};
// Inputs are parsed as decimal strings and kept as reduced BigInt fractions until output.
type R={n:bigint;d:bigint};
function gcd(a:bigint,b:bigint):bigint{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const t=a%b;a=b;b=t;}return a||1n;}
function rat(n:bigint,d:bigint):R{if(d===0n)throw new Error('division-by-zero');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return{n:n/g,d:d/g};}
function parse(x:number|string):R {
 const s=String(x).trim();if(!/^[+-]?\d+(?:\.\d+)?$/.test(s)||s.length>100)return (()=>{throw new Error('invalid-value')})();
 const neg=s.startsWith('-'),clean=s.replace(/^[+-]/,'');const [a,b='']=clean.split('.');const n=BigInt(a+b);return rat(neg?-n:n,10n**BigInt(b.length));
}
const mul=(a:R,b:R)=>rat(a.n*b.n,a.d*b.d);
const div=(a:R,b:R)=>{if(b.n===0n)throw new Error('division-by-zero');return rat(a.n*b.d,a.d*b.n);};
const sub=(a:R,b:R)=>rat(a.n*b.d-b.n*a.d,a.d*b.d);
const add=(a:R,b:R)=>rat(a.n*b.d+b.n*a.d,a.d*b.d);
function output(r:R):PercentageResult {const v=Number(r.n)/Number(r.d);if(!Number.isFinite(v))return{ok:false,error:'invalid-value'};const scaled=r.n*1000000000000n/r.d;const formatted=(Number(scaled)/1e12).toString();return{ok:true,value:v,formatted};}
export function percentage(mode:PercentageMode,values:Record<string,number|string>):PercentageResult {
 try{
  let r:R;
  switch(mode){
   case 'percent-of':r=div(mul(parse(values.x),parse(values.y)),parse('100'));break;
   case 'what-percent':r=mul(div(parse(values.x),parse(values.y)),parse('100'));break;
   case 'change':{const a=parse(values.a),b=parse(values.b);if(a.n===0n)return{ok:false,error:'division-by-zero'};r=mul(div(sub(b,a),a),parse('100'));break;}
   case 'adjust':{const x=parse(values.x),y=parse(values.y);r=add(y,div(mul(y,x),parse('100')));break;}
   case 'percent-of-what':r=div(mul(parse(values.y),parse('100')),parse(values.x));break;
   default:return{ok:false,error:'invalid-mode'};
  }
  return output(r);
 }catch(e){return{ok:false,error:(e as Error).message==='division-by-zero'?'division-by-zero':'invalid-value'};}
}
