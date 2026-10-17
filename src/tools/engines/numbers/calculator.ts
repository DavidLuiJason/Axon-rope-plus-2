// Precedence: ^ (right-associative) binds tighter than unary +/-; unary binds tighter than *, /, % (remainder), then + and -.
export type CalculatorErrorCode = 'syntax' | 'division-by-zero' | 'domain' | 'too-long';
export type CalculatorResult = { ok: true; value: number; formatted: string } | { ok: false; error: CalculatorErrorCode; position?: number };
type Tok = { type: 'number'|'name'|'op'|'eof'; value: string; pos: number };
const MAX_EXPRESSION_LENGTH = 512;
const MAX_TOKENS = 256;
function tokenize(s: string): Tok[] {
  const out: Tok[] = []; let i=0;
  while(i<s.length) {
    if (/\s/u.test(s[i])) { i++; continue; }
    const start=i, c=s[i];
    if (/[0-9.]/.test(c)) {
      let dots=0; while(i<s.length && /[0-9.]/.test(s[i])) { if(s[i]==='.') dots++; i++; }
      const raw=s.slice(start,i);
      if(dots>1 || raw==='.') throw { error:'syntax', position:start };
      out.push({type:'number',value:raw,pos:start});
    } else if (/[a-zA-Z]/.test(c)) {
      i++; while(i<s.length && /[a-zA-Z]/.test(s[i])) i++;
      out.push({type:'name',value:s.slice(start,i).toLowerCase(),pos:start});
    } else if ('+-*/^%()'.includes(c)) { out.push({type:'op',value:c,pos:i++}); }
    else throw {error:'syntax',position:i};
    if(out.length>MAX_TOKENS) throw {error:'too-long',position:i};
  }
  out.push({type:'eof',value:'',pos:s.length}); return out;
}
// Decimal arithmetic uses reduced BigInt fractions for +, -, *, and /; transcendental functions cross through Number.
type V = { n: bigint; d: bigint };
const gcd=(a:bigint,b:bigint):bigint=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const t=a%b;a=b;b=t;}return a||1n;};
function rat(n:bigint,d=1n):V { if(d===0n) throw {error:'division-by-zero'}; if(d<0n){n=-n;d=-d;} const g=gcd(n,d); return {n:n/g,d:d/g}; }
function decimal(raw:string):V { const p=raw.split('.'); const d=10n**BigInt((p[1]||'').length); return rat(BigInt((p[0]||'0')+(p[1]||'')),d); }
const add=(a:V,b:V)=>rat(a.n*b.d+b.n*a.d,a.d*b.d);
const sub=(a:V,b:V)=>rat(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a:V,b:V)=>rat(a.n*b.n,a.d*b.d);
const div=(a:V,b:V)=>{if(b.n===0n)throw {error:'division-by-zero'};return rat(a.n*b.d,a.d*b.n);};
function fromNumber(n:number):V {
  if(!Number.isFinite(n)) throw {error:'domain'};
  const raw=Number(n.toPrecision(15)).toString();
  const [mantissa, exponent='0']=raw.toLowerCase().split('e');
  const v=decimal(mantissa.startsWith('-')?mantissa.slice(1):mantissa);
  const shift=Number(exponent);
  const result=shift>=0?rat(v.n*10n**BigInt(shift),v.d):rat(v.n,v.d*10n**BigInt(-shift));
  return mantissa.startsWith('-')?rat(-result.n,result.d):result;
}
function toNumber(a:V):number { return Number(a.n)/Number(a.d); }
function format(a:V):string { const n=a.n, d=a.d; if(d===1n)return n.toString(); const scaled=n*1000000000000000n/d; let s=(Number(scaled)/1e15).toString(); return s; }
export function evaluate(expression:string, options:{angle:'deg'|'rad'}={angle:'rad'}):CalculatorResult {
  if(typeof expression!=='string') return {ok:false,error:'syntax',position:0};
  if(expression.length>MAX_EXPRESSION_LENGTH) return {ok:false,error:'too-long',position:MAX_EXPRESSION_LENGTH};
  try {
    const ts=tokenize(expression); let i=0; const peek=()=>ts[i]; const take=()=>ts[i++];
    const funcs=['sqrt','abs','round','floor','ceil','sin','cos','tan','ln','log'];
    function primary():V {
      const t=take();
      if(t.type==='number') return decimal(t.value);
      if(t.type==='op'&&t.value==='('){const v=expr(0);if(peek().value!==')')throw{error:'syntax',position:peek().pos};take();return v;}
      if(t.type==='name'){
        if(t.value==='pi')return fromNumber(Math.PI); if(t.value==='e')return fromNumber(Math.E);
        if(!funcs.includes(t.value))throw{error:'syntax',position:t.pos};
        if(peek().value==='('){take();const v=expr(0);if(peek().value!==')')throw{error:'syntax',position:peek().pos};take();return fn(t.value,v,t.pos);}
        return fn(t.value,primary(),t.pos);
      }
      throw {error:'syntax',position:t.pos};
    }
    function atom():V {
      if(peek().value==='-'){take();const v=expr(3);return rat(-v.n,v.d);}
      if(peek().value==='+'){take();return expr(3);}
      return primary();
    }
    function fn(name:string,v:V,pos:number):V {
      const x=toNumber(v); let y:number;
      switch(name){
        case 'sqrt': if(x<0)throw{error:'domain',position:pos}; y=Math.sqrt(x);break;
        case 'abs': return rat(v.n<0n?-v.n:v.n,v.d);
        case 'round': return rat(BigInt(Math.round(x)));
        case 'floor': return rat(BigInt(Math.floor(x)));
        case 'ceil': return rat(BigInt(Math.ceil(x)));
        case 'sin': y=Math.sin(options.angle==='deg'?x*Math.PI/180:x);break;
        case 'cos': y=Math.cos(options.angle==='deg'?x*Math.PI/180:x);break;
        case 'tan': {const a=options.angle==='deg'?x*Math.PI/180:x;if(Math.abs(Math.cos(a))<1e-14)throw{error:'domain',position:pos};y=Math.tan(a);break;}
        case 'ln': if(x<=0)throw{error:'domain',position:pos};y=Math.log(x);break;
        case 'log': if(x<=0)throw{error:'domain',position:pos};y=Math.log10(x);break;
        default: throw{error:'syntax',position:pos};
      }
      if(name==='sin'||name==='cos'||name==='tan') {
        if(!Number.isFinite(y))throw{error:'domain',position:pos};
        y=Math.round(y*1e12)/1e12;
      }
      return fromNumber(y);
    }
    function expr(min:number):V {
      let left=atom();
      while(true){
        const t=peek(); if(t.type!=='op')break;
        const prec=t.value==='+'||t.value==='-'?1:t.value==='*'||t.value==='/'||t.value==='%'?2:t.value==='^'?3:0;
        if(prec<min||prec===0)break; take();
        const right=expr(prec+(t.value==='^'?0:1));
        if(t.value==='+')left=add(left,right);
        else if(t.value==='-')left=sub(left,right);
        else if(t.value==='*')left=mul(left,right);
        else if(t.value==='/')left=div(left,right);
        else if(t.value==='%'){if(right.n===0n)throw{error:'division-by-zero',position:t.pos};left=fromNumber(toNumber(left)%toNumber(right));}
        else {
          const a=toNumber(left),b=toNumber(right);
          if(a===0&&b<0)throw{error:'division-by-zero',position:t.pos};
          if(a<0&&!Number.isInteger(b))throw{error:'domain',position:t.pos};
          if(right.d===1n && right.n>=0n && right.n<=1024n && left.d===1n) {
            left=rat(left.n**right.n);
          } else left=fromNumber(Math.pow(a,b));
        }
      }
      return left;
    }
    const value=expr(0); if(peek().type!=='eof')throw{error:'syntax',position:peek().pos};
    const n=toNumber(value); if(!Number.isFinite(n))return {ok:false,error:'domain'};
    return {ok:true,value:n,formatted:format(value)};
  } catch(e) {
    const x=e as {error?:CalculatorErrorCode;position?:number};
    return {ok:false,error:x?.error||'syntax',...(Number.isInteger(x?.position)?{position:x.position}:{})};
  }
}
