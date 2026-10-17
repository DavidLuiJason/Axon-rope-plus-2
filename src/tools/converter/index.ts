export { CONVERTER_KINDS } from './kinds';
export type { ConverterKind, ConverterUnit } from './kinds';
export { convert } from './convert';
export type { ConvertOutcome } from './convert';
import { CONVERTER_KINDS } from './kinds';
import type { ConverterKind } from './kinds';
export function getKind(id:string):ConverterKind|undefined{return CONVERTER_KINDS.find(k=>k.id===id);}
