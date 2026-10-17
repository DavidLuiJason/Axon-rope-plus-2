import { detectCodeRegions } from './codeRegions';
import { roleForSymbol, type SymbolRole } from './symbolRoles';
export interface PunctuationMark { index:number; text:string; role:SymbolRole; start:number; end:number; confidence:number; }
export interface PunctuationRead { marks:PunctuationMark[]; count:number; confidence:'high'|'medium'|'low'; unsure:boolean; }
export function readPunctuation(text:string):PunctuationRead {
  const detected=detectCodeRegions(text);
  const hidden=new Uint8Array(text.length);
  for (const r of detected.regions) hidden.fill(1,r.start,r.end);
  const marks:PunctuationMark[]=[];
  const add=(start:number,value:string,role:SymbolRole,confidence:number)=>marks.push({index:start,text:value,role,start,end:start+value.length,confidence});
  for (let i=0;i<text.length;i++) {
    if (hidden[i]) { while(i+1<text.length && hidden[i+1]) i++; continue; }
    const rest=text.slice(i);
    const url=/^(?:https?:\/\/|www\.)[^\s<>"']+/i.exec(rest);
    if(url){const token=url[0].replace(/[.,!?;:]+$/,'');if(token){add(i,token,'address',0.98);i+=token.length-1;continue;}}
    const email=/^[\p{L}\p{N}._%+\-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u.exec(rest);
    if(email){add(i,email[0],'address',0.98);i+=email[0].length-1;continue;}
    const decimal=/^\d+\.\d+/.exec(rest);
    if(decimal){add(i,decimal[0],'decimal',0.99);i+=decimal[0].length-1;continue;}
    if(text.slice(i,i+3)==='...' && !hidden[i+1] && !hidden[i+2]){add(i,'...','ellipsis',0.99);i+=2;continue;}
    const c=text[i];
    if(/[\p{P}&+]/u.test(c)) add(i,c,roleForSymbol(text,i),0.95);
  }
  const confidence=detected.unsure?'low':detected.regions.length?'high':'medium';
  return {marks,count:marks.length,confidence,unsure:detected.unsure};
}
