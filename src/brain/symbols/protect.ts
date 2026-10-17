import { detectCodeRegions, type CodeRegion } from './codeRegions';
const PUA_START = 0xE000;
export interface MaskedCodeRegions { masked: string; restore: (text: string) => string; regions: CodeRegion[]; unsure: boolean; }
/** Replace detected code spans with private-use placeholders while parsing surrounding instructions. */
export function maskCodeRegions(text: string): MaskedCodeRegions {
  const detected = detectCodeRegions(text);
  if (/[\uE000-\uF8FF]/u.test(text) || detected.regions.length > 0x100 || !detected.regions.length) {
    return { masked:text, restore:(value:string)=>value, regions:[], unsure: detected.regions.length > 0x100 ? true : detected.unsure };
  }
  const placeholders: string[]=[];
  let masked='', cursor=0;
  detected.regions.forEach((region,i)=>{
    masked += text.slice(cursor,region.start);
    const token=String.fromCharCode(PUA_START+i);
    placeholders.push(region.text); masked+=token; cursor=region.end;
  });
  masked += text.slice(cursor);
  const restore=(value:string):string=>{
    let out=value;
    placeholders.forEach((original,i)=>{out=out.split(String.fromCharCode(PUA_START+i)).join(original);});
    return out;
  };
  return {masked,restore,regions:detected.regions,unsure:detected.unsure};
}
// Compatibility wrappers retained for existing callers.
export interface ProtectedText { text:string; original:string; regions:CodeRegion[]; unsure:boolean; masked:boolean; placeholders:string[]; }
export function protectCodeRegions(text:string):ProtectedText {
  const m=maskCodeRegions(text);
  return {text:m.masked,original:text,regions:m.regions,unsure:m.unsure,masked:m.masked!==text,placeholders:m.regions.map(r=>r.text)};
}
export function restoreProtectedText(text:string, protectedText:ProtectedText):string {
  if (!protectedText.masked) return text;
  let out=text;
  protectedText.placeholders.forEach((original,i)=>{out=out.split(String.fromCharCode(PUA_START+i)).join(original);});
  return out;
}
