/** Role labels for punctuation; intentionally lexical and deterministic. */
export type SymbolRole = 'end_statement'|'end_question'|'end_exclaim'|'pause'|'clause_break'|'introduces'|'quote_open'|'quote_close'|'bracket_open'|'bracket_close'|'apostrophe'|'decimal'|'abbreviation'|'hyphen_in_word'|'dash_break'|'ellipsis'|'address'|'alternative'|'joiner';
export interface SymbolRoleResult { index: number; symbol: string; role: SymbolRole; }
const OPEN = new Set(['(', '[', '{']);
const CLOSE = new Set([')', ']', '}']);

export function roleForSymbol(text: string, index: number): SymbolRole {
  const c = text[index], before = text[index - 1] ?? '', after = text[index + 1] ?? '';
  if (c === '.' && text.slice(index, index + 3) === '...') return 'ellipsis';
  if (c === '.' && /\d/.test(before) && /\d/.test(after)) return 'decimal';
  if (c === '.' && /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e)\.$/i.test(text.slice(Math.max(0, index - 6), index + 1))) return 'abbreviation';
  if (c === '.' && /\b(?:https?|ftp):\/\//i.test(text.slice(Math.max(0, index - 10), index))) return 'address';
  if (c === '.' && /\w/.test(before) && /\w/.test(after) && /(?:\w+\.){1,}\w/.test(text.slice(Math.max(0,index-12), Math.min(text.length,index+12)))) return 'address';
  if (c === '.' ) return 'end_statement';
  if (c === '?') return 'end_question';
  if (c === '!') return 'end_exclaim';
  if (c === ';') return 'clause_break';
  if (c === ',' ) return 'pause';
  if (c === ':') return 'introduces';
  if (c === '(' || c === '[' || c === '{') return 'bracket_open';
  if (c === ')' || c === ']' || c === '}') return 'bracket_close';
  if (c === '"' || c === '“' || c === '‘' || c === '«') {
    if (c === '“' || c === '‘' || c === '«') return 'quote_open';
    const opens = (text.slice(0,index).match(/["“«]/g) ?? []).length;
    return opens % 2 === 0 ? 'quote_open' : 'quote_close';
  }
  if (c === '”' || c === '’' || c === '»') return c === '’' && /\p{L}/u.test(before) && /\p{L}/u.test(after) ? 'apostrophe' : 'quote_close';
  if (c === "'") {
    if (/\p{L}/u.test(before) && /\p{L}/u.test(after)) return 'apostrophe';
    const opens = (text.slice(0,index).match(/'/g) ?? []).length;
    return opens % 2 === 0 ? 'quote_open' : 'quote_close';
  }
  if (c === '’') return 'apostrophe';
  if (c === '-') return /\p{L}/u.test(before) && /\p{L}/u.test(after) ? 'hyphen_in_word' : 'dash_break';
  if (c === '—' || c === '–') return 'dash_break';
  if (c === '/') return 'alternative';
  if (c === '&' || c === '+') return 'joiner';
  return 'clause_break';
}

export function classifySymbolRoles(text: string): SymbolRoleResult[] {
  const result: SymbolRoleResult[] = [];
  for (let i = 0; i < text.length; i++) {
    if (/\p{P}/u.test(text[i]) || /[&+]/.test(text[i])) result.push({ index: i, symbol: text[i], role: roleForSymbol(text, i) });
  }
  return result;
}
