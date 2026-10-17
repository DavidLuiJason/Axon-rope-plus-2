/**
 * Irregular word forms (DICT-C2). Written by hand and checked by tests against the real dictionary:
 * every base word listed here must exist there with the stated part of speech.
 */

/** base | past forms | past participle forms (comma separated). Regular -s and -ing forms come from the rules. */
const VERB_LINES = `
arise|arose|arisen
awake|awoke,awaked|awoken,awaked
bear|bore|borne,born
beat|beat|beaten
become|became|become
begin|began|begun
bend|bent|bent
bet|bet|bet
bind|bound|bound
bite|bit|bitten
bleed|bled|bled
blow|blew|blown
break|broke|broken
breed|bred|bred
bring|brought|brought
build|built|built
burn|burnt,burned|burnt,burned
burst|burst|burst
buy|bought|bought
cast|cast|cast
catch|caught|caught
choose|chose|chosen
cling|clung|clung
come|came|come
cost|cost|cost
creep|crept|crept
cut|cut|cut
deal|dealt|dealt
dig|dug|dug
dive|dove,dived|dived
draw|drew|drawn
dream|dreamt,dreamed|dreamt,dreamed
drink|drank|drunk
drive|drove|driven
eat|ate|eaten
fall|fell|fallen
feed|fed|fed
feel|felt|felt
fight|fought|fought
find|found|found
flee|fled|fled
fling|flung|flung
fly|flew|flown
forbid|forbade,forbad|forbidden
forget|forgot|forgotten,forgot
forgive|forgave|forgiven
freeze|froze|frozen
get|got|gotten,got
give|gave|given
grind|ground|ground
grow|grew|grown
hang|hung,hanged|hung,hanged
hear|heard|heard
hide|hid|hidden
hit|hit|hit
hold|held|held
hurt|hurt|hurt
keep|kept|kept
kneel|knelt,kneeled|knelt,kneeled
know|knew|known
lay|laid|laid
lead|led|led
lean|leant,leaned|leant,leaned
leap|leapt,leaped|leapt,leaped
learn|learnt,learned|learnt,learned
leave|left|left
lend|lent|lent
let|let|let
lie|lay|lain
light|lit,lighted|lit,lighted
lose|lost|lost
make|made|made
mean|meant|meant
meet|met|met
mistake|mistook|mistaken
overcome|overcame|overcome
overhear|overheard|overheard
override|overrode|overridden
oversee|oversaw|overseen
overtake|overtook|overtaken
overthrow|overthrew|overthrown
partake|partook|partaken
pay|paid|paid
put|put|put
quit|quit|quit
read|read|read
rebuild|rebuilt|rebuilt
redo|redid|redone
retell|retold|retold
rethink|rethought|rethought
rewrite|rewrote|rewritten
ride|rode|ridden
ring|rang|rung
rise|rose|risen
run|ran|run
say|said|said
see|saw|seen
seek|sought|sought
sell|sold|sold
send|sent|sent
set|set|set
sew|sewed|sewn,sewed
shake|shook|shaken
shed|shed|shed
shine|shone,shined|shone,shined
shoot|shot|shot
show|showed|shown,showed
shrink|shrank,shrunk|shrunk,shrunken
shut|shut|shut
sing|sang|sung
sink|sank,sunk|sunk,sunken
sit|sat|sat
slay|slew|slain
sleep|slept|slept
slide|slid|slid
sling|slung|slung
smell|smelt,smelled|smelt,smelled
speak|spoke|spoken
speed|sped,speeded|sped,speeded
spend|spent|spent
spin|spun|spun
spit|spat,spit|spat,spit
split|split|split
spread|spread|spread
spring|sprang,sprung|sprung
stand|stood|stood
steal|stole|stolen
stick|stuck|stuck
sting|stung|stung
stink|stank,stunk|stunk
stride|strode|stridden
strike|struck|struck,stricken
string|strung|strung
strive|strove,strived|striven,strived
swear|swore|sworn
sweep|swept|swept
swell|swelled|swollen,swelled
swim|swam|swum
swing|swung|swung
take|took|taken
teach|taught|taught
tear|tore|torn
tell|told|told
think|thought|thought
throw|threw|thrown
thrust|thrust|thrust
tread|trod|trodden,trod
undergo|underwent|undergone
understand|understood|understood
undertake|undertook|undertaken
undo|undid|undone
unwind|unwound|unwound
uphold|upheld|upheld
upset|upset|upset
wake|woke,waked|woken,waked
wear|wore|worn
weave|wove,weaved|woven,weaved
weep|wept|wept
win|won|won
wind|wound|wound
withdraw|withdrew|withdrawn
withhold|withheld|withheld
withstand|withstood|withstood
wring|wrung|wrung
write|wrote|written
`;

/** Verbs whose present forms are also irregular: base -> all non-base forms. */
const VERB_EXTRA: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  have: ['has', 'had', 'having'],
  do: ['does', 'did', 'done', 'doing'],
  go: ['goes', 'went', 'gone', 'going'],
};

/** plural -> singular */
const NOUN_LINES = `
mice|mouse
men|man
women|woman
children|child
feet|foot
teeth|tooth
geese|goose
lice|louse
oxen|ox
people|person
criteria|criterion
phenomena|phenomenon
analyses|analysis
bases|basis
crises|crisis
theses|thesis
hypotheses|hypothesis
diagnoses|diagnosis
axes|axis
indices|index
appendices|appendix
matrices|matrix
vertices|vertex
cacti|cactus
fungi|fungus
nuclei|nucleus
radii|radius
stimuli|stimulus
syllabi|syllabus
alumni|alumnus
bacteria|bacterium
media|medium
curricula|curriculum
memoranda|memorandum
millennia|millennium
strata|stratum
larvae|larva
antennae|antenna
formulae|formula
vertebrae|vertebra
leaves|leaf
knives|knife
wives|wife
lives|life
loaves|loaf
shelves|shelf
wolves|wolf
halves|half
calves|calf
elves|elf
selves|self
thieves|thief
scarves|scarf
hooves|hoof
dwarves|dwarf
wharves|wharf
`;

/** form | base | part of speech */
const OTHER_LINES = `
better|good|a
best|good|a
worse|bad|a
worst|bad|a
farther|far|a
farthest|far|a
further|far|a
furthest|far|a
elder|old|a
eldest|old|a
less|little|a
least|little|a
more|much|a
most|much|a
better|well|r
best|well|r
worse|badly|r
worst|badly|r
`;

export interface IrregularForm {
  base: string;
  pos: 'n' | 'v' | 'a' | 'r';
  rule: string;
}

function build(): Map<string, IrregularForm[]> {
  const map = new Map<string, IrregularForm[]>();
  const add = (form: string, base: string, pos: IrregularForm['pos'], rule: string) => {
    if (form === base) return;
    const list = map.get(form) ?? [];
    if (!list.some((x) => x.base === base && x.pos === pos)) list.push({ base, pos, rule });
    map.set(form, list);
  };
  for (const line of VERB_LINES.trim().split('\n')) {
    const [base, past, pp] = line.split('|');
    for (const f of (past ?? '').split(',')) add(f, base ?? '', 'v', 'irregular past');
    for (const f of (pp ?? '').split(',')) add(f, base ?? '', 'v', 'irregular participle');
  }
  for (const [base, forms] of Object.entries(VERB_EXTRA)) for (const f of forms) add(f, base, 'v', 'irregular verb');
  for (const line of NOUN_LINES.trim().split('\n')) {
    const [plural, singular] = line.split('|');
    add(plural ?? '', singular ?? '', 'n', 'irregular plural');
  }
  for (const line of OTHER_LINES.trim().split('\n')) {
    const [form, base, pos] = line.split('|');
    add(form ?? '', base ?? '', (pos ?? 'a') as IrregularForm['pos'], 'irregular comparison');
  }
  return map;
}

export const IRREGULAR_FORMS: ReadonlyMap<string, IrregularForm[]> = build();

/** Every base word with the part of speech it is expected to have, for the self-check in tests. */
export function irregularBases(): { base: string; pos: IrregularForm['pos'] }[] {
  const seen = new Set<string>();
  const out: { base: string; pos: IrregularForm['pos'] }[] = [];
  for (const list of IRREGULAR_FORMS.values()) {
    for (const x of list) {
      const k = `${x.base}|${x.pos}`;
      if (!seen.has(k)) { seen.add(k); out.push({ base: x.base, pos: x.pos }); }
    }
  }
  return out;
}
