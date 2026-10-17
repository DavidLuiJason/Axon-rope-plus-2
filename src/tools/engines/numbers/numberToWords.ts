export type NumberWordsResult={ok:true;words:string}|{ok:false;error:'invalid-input'|'too-large'|'too-long'|'invalid-ordinal'};
const small=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
const scales=['','thousand','million','billion','trillion','quadrillion','quintillion'];
function underThousand(n:number):string {
 const parts:string[]=[];if(n>=100){parts.push(small[Math.floor(n/100)]+' hundred');n%=100;}
 if(n>=20){parts.push(tens[Math.floor(n/10)]+(n%10?'-'+small[n%10]:''));}else if(n>0||parts.length===0)parts.push(small[n]);
 return parts.join(' ');
}
function cardinal(n:bigint):string {
 if(n===0n)return 'zero';const parts:string[]=[];let group=0;
 while(n>0n){const chunk=Number(n%1000n);if(chunk)parts.unshift(underThousand(chunk)+(scales[group]?' '+scales[group]:''));n/=1000n;group++;}
 return parts.join(' ');
}
const ordinalMap:Record<string,string>={'zero':'zeroth','one':'first','two':'second','three':'third','four':'fourth','five':'fifth','six':'sixth','seven':'seventh','eight':'eighth','nine':'ninth','ten':'tenth','eleven':'eleventh','twelve':'twelfth','thirteen':'thirteenth','fourteen':'fourteenth','fifteen':'fifteenth','sixteen':'sixteenth','seventeen':'seventeenth','eighteen':'eighteenth','nineteen':'nineteenth','twenty':'twentieth','thirty':'thirtieth','forty':'fortieth','fifty':'fiftieth','sixty':'sixtieth','seventy':'seventieth','eighty':'eightieth','ninety':'ninetieth','hundred':'hundredth','thousand':'thousandth','million':'millionth','billion':'billionth','trillion':'trillionth','quadrillion':'quadrillionth','quintillion':'quintillionth'};
function ordinalize(s:string):string {
 const parts=s.split(' ');let i=parts.length-1;
 if(parts[i].includes('-')){const p=parts[i].split('-');p[p.length-1]=ordinalMap[p[p.length-1]]||p[p.length-1]+'th';parts[i]=p.join('-');}
 else parts[i]=ordinalMap[parts[i]]||parts[i]+'th';
 return parts.join(' ');
}
export function numberToWords(input:string|bigint,options:{ordinal?:boolean}={}):NumberWordsResult {
 if(typeof input!=='string'&&typeof input!=='bigint')return{ok:false,error:'invalid-input'};
 const s=String(input).trim();if(s.length>128)return{ok:false,error:'too-long'};
 if(!/^[+-]?\d+(?:\.\d+)?$/.test(s))return{ok:false,error:'invalid-input'};
 const [whole,frac]=s.replace(/^[+-]/,'').split('.');
 const n=BigInt(whole);if(n>999999999999999999999n)return{ok:false,error:'too-large'};
 if(options.ordinal&&frac!==undefined)return{ok:false,error:'invalid-ordinal'};
 let result=(s.startsWith('-')&& (n!==0n||/[1-9]/.test(frac||''))?'negative ':'')+cardinal(n);
 if(options.ordinal){const negative=result.startsWith('negative ');result=ordinalize(negative?result.slice(9):result);if(negative)result='negative '+result;}
 if(frac!==undefined)result+=' point '+frac.split('').map(c=>small[Number(c)]).join(' ');
 return{ok:true,words:result};
}
