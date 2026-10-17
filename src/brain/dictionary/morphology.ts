/**
 * Word-form rules (DICT-C2): given a written form such as "running" or "mice",
 * list the base words it could come from. The dictionary then keeps only the
 * candidates that really exist with the right part of speech.
 */
import { IRREGULAR_FORMS } from './irregulars';

export interface Candidate {
  base: string;
  pos: 'n' | 'v' | 'a' | 'r';
  via: 'irregular' | 'rule';
  rule: string;
}

const MIN_STEM = 3;
const VOWELS = 'aeiou';

interface Suffix { suffix: string; replace: string; pos: Candidate['pos'] }

const SUFFIX_RULES: Suffix[] = [
  // nouns
  { suffix: 'ses', replace: 's', pos: 'n' },
  { suffix: 'xes', replace: 'x', pos: 'n' },
  { suffix: 'zes', replace: 'z', pos: 'n' },
  { suffix: 'ches', replace: 'ch', pos: 'n' },
  { suffix: 'shes', replace: 'sh', pos: 'n' },
  { suffix: 'ies', replace: 'y', pos: 'n' },
  { suffix: 'ves', replace: 'f', pos: 'n' },
  { suffix: 'ves', replace: 'fe', pos: 'n' },
  { suffix: 'men', replace: 'man', pos: 'n' },
  { suffix: 's', replace: '', pos: 'n' },
  // verbs
  { suffix: 'ies', replace: 'y', pos: 'v' },
  { suffix: 'es', replace: 'e', pos: 'v' },
  { suffix: 'es', replace: '', pos: 'v' },
  { suffix: 's', replace: '', pos: 'v' },
  { suffix: 'ied', replace: 'y', pos: 'v' },
  { suffix: 'ed', replace: 'e', pos: 'v' },
  { suffix: 'ed', replace: '', pos: 'v' },
  { suffix: 'ing', replace: 'e', pos: 'v' },
  { suffix: 'ing', replace: '', pos: 'v' },
  { suffix: 'ying', replace: 'ie', pos: 'v' },
  { suffix: 'cked', replace: 'c', pos: 'v' },
  { suffix: 'cking', replace: 'c', pos: 'v' },
  // adjectives
  { suffix: 'er', replace: '', pos: 'a' },
  { suffix: 'est', replace: '', pos: 'a' },
  { suffix: 'er', replace: 'e', pos: 'a' },
  { suffix: 'est', replace: 'e', pos: 'a' },
  { suffix: 'ier', replace: 'y', pos: 'a' },
  { suffix: 'iest', replace: 'y', pos: 'a' },
];

function isConsonant(c: string): boolean {
  return c >= 'a' && c <= 'z' && !VOWELS.includes(c);
}

/** Candidate base forms of one lowercase word (no spaces). Irregular forms come first. */
export function lemmaCandidates(word: string): Candidate[] {
  const w = word.toLowerCase();
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const push = (c: Candidate) => {
    if (c.base === w) return;
    const k = `${c.base}|${c.pos}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(c);
  };
  for (const x of IRREGULAR_FORMS.get(w) ?? []) push({ base: x.base, pos: x.pos, via: 'irregular', rule: x.rule });
  for (const r of SUFFIX_RULES) {
    if (!w.endsWith(r.suffix)) continue;
    const stem = w.slice(0, w.length - r.suffix.length);
    const base = stem + r.replace;
    if (stem.length < 2 || base.length < MIN_STEM) continue;
    push({ base, pos: r.pos, via: 'rule', rule: `-${r.suffix} -> -${r.replace || '(none)'}` });
    // doubled final consonant: running -> runn -> run, bigger -> bigg -> big
    const ending = ['ed', 'ing', 'er', 'est'].includes(r.suffix) && r.replace === '';
    if (ending && stem.length >= 3) {
      const a = stem[stem.length - 1] ?? '';
      const b = stem[stem.length - 2] ?? '';
      if (a === b && isConsonant(a)) {
        push({ base: stem.slice(0, -1), pos: r.pos, via: 'rule', rule: `-${r.suffix} with doubled ${a}` });
      }
    }
  }
  return out;
}
