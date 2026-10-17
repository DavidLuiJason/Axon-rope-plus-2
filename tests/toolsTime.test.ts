import { createTimer, startTimer, tickTimer, pauseTimer, resumeTimer, resetTimer, formatTimerHms, formatTimerMs } from '../src/tools/engines/time/timer';
import { createStopwatch, startStopwatch, tickStopwatch, pauseStopwatch, resumeStopwatch, lapStopwatch, resetStopwatch } from '../src/tools/engines/time/stopwatch';
import { parseDate, formatDate, addDate, differenceDates, weekday, dayOfYear, isoWeekNumber, countWeekdays, isLeapYear } from '../src/tools/engines/time/dateCalc';
import { createTally, addCounter, changeTally, setTallyValue, resetTally, undoTally } from '../src/tools/engines/time/tally';

let checks = 0;
function assert(condition: boolean, message: string) {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  OK: ${message}`);
}
function value<T>(result: { ok: true; value: T } | { ok: false; error: string }, message: string): T {
  assert(result.ok, message);
  if (!result.ok) throw new Error(`unexpected result: ${result.error}`);
  return result.value;
}
function error(result: { ok: true } | { ok: false; error: string }, expected: string, message: string) {
  assert(!result.ok && result.error === expected, message);
}

console.log('-- timer');
let timer = value(startTimer(10_000, 1_000), 'timer starts');
assert(timer.status === 'running' && timer.remainingMs === 10_000, 'start stores duration');
let tick = value(tickTimer(timer, 4_500), 'timer ticks');
assert(tick.remainingMs === 6_500, 'remaining time comes from deadline minus clock');
timer = value(pauseTimer(tick.state, 5_000), 'timer pauses');
assert(timer.status === 'paused' && timer.remainingMs === 6_000, 'pause freezes remaining duration');
timer = value(resumeTimer(timer, 9_000_000), 'timer resumes after long sleep');
tick = value(tickTimer(timer, 9_003_000), 'resumed timer ticks');
assert(tick.remainingMs === 3_000, 'paused duration is not counted after resume');
tick = value(tickTimer(tick.state, 9_006_000), 'timer finishes');
assert(tick.state.status === 'finished' && tick.remainingMs === 0, 'timer finishes at deadline');
error(pauseTimer(tick.state, 9_007_000), 'not-running', 'cannot pause finished timer');
error(startTimer(-1, 0), 'invalid-duration', 'negative duration rejected');
error(startTimer(Number.MAX_SAFE_INTEGER + 1, 0), 'invalid-duration', 'unsafe duration rejected');
error(startTimer(100, -1), 'invalid-clock', 'negative clock rejected');
error(startTimer(100, 1.5), 'invalid-clock', 'fractional clock rejected');
error(startTimer(Number.MAX_SAFE_INTEGER, 1), 'invalid-duration', 'deadline overflow rejected');
assert(resetTimer().status === 'idle', 'reset returns idle state');
assert(formatTimerHms(3_723_000) === '1:02:03', 'h:mm:ss formatter');
assert(formatTimerHms(0) === '0:00:00', 'h:mm:ss zero');
assert(formatTimerMs(125_000) === '2:05', 'mm:ss formatter');
assert(formatTimerMs(3_600_000) === '60:00', 'mm:ss does not wrap hours');
assert(formatTimerMs(-100) === '0:00', 'negative formatter input is safe');

console.log('-- stopwatch');
let sw = value(startStopwatch(1_000), 'stopwatch starts');
sw = value(tickStopwatch(sw, 3_000), 'stopwatch first tick');
assert(sw.elapsedMs === 2_000, 'first elapsed interval');
sw = value(tickStopwatch(sw, 4_000), 'stopwatch second tick');
assert(sw.elapsedMs === 3_000, 'repeated ticks do not double-count');
sw = value(lapStopwatch(sw, 5_500), 'first lap');
assert(sw.laps[0].totalMs === 4_500 && sw.laps[0].splitMs === 4_500, 'first lap split and total');
sw = value(lapStopwatch(sw, 7_000), 'second lap');
assert(sw.laps[1].totalMs === 6_000 && sw.laps[1].splitMs === 1_500, 'later lap split and total');
sw = value(pauseStopwatch(sw, 8_000), 'stopwatch pauses');
assert(sw.status === 'paused' && sw.elapsedMs === 7_000, 'pause captures elapsed time');
sw = value(resumeStopwatch(sw, 100_000), 'stopwatch resumes after long pause');
sw = value(tickStopwatch(sw, 101_000), 'stopwatch ticks after resume');
assert(sw.elapsedMs === 8_000, 'long paused interval is excluded');
error(lapStopwatch(sw, -1), 'invalid-clock', 'lap rejects invalid clock');
error(resumeStopwatch(sw, 102_000), 'not-paused', 'cannot resume running stopwatch');
assert(resetStopwatch().laps.length === 0, 'reset clears laps');
error(startStopwatch(Number.NaN), 'invalid-clock', 'invalid stopwatch start clock rejected');

console.log('-- date calculator');
assert(value(parseDate('2024-02-29'), 'leap date parses').day === 29, 'leap day accepted');
error(parseDate('2023-02-29'), 'invalid-date', 'non-leap 29 February rejected');
error(parseDate('2024-2-09'), 'invalid-date', 'non-padded date rejected');
error(parseDate('0000-01-01'), 'invalid-date', 'year zero rejected');
assert(isLeapYear(2000) && !isLeapYear(1900) && isLeapYear(2024) && !isLeapYear(2023), 'Gregorian leap-year rules');
assert(value(addDate('2024-01-31', 1, 'months'), 'month addition').valueOf() === '2024-02-29', 'month addition clamps leap February');
assert(value(addDate('2023-01-31', 1, 'months'), 'month clamp').valueOf() === '2023-02-28', 'month addition clamps non-leap February');
assert(value(addDate('2023-12-31', 1, 'days'), 'year-end addition') === '2024-01-01', 'day addition crosses year end');
assert(value(addDate('2024-03-01', -1, 'days'), 'negative day addition') === '2024-02-29', 'negative day addition crosses leap day');
assert(value(addDate('2024-02-29', 1, 'years'), 'year addition').valueOf() === '2025-02-28', 'year addition clamps leap day');
error(addDate('9999-12-31', 1, 'days'), 'date-out-of-range', 'date overflow rejected');
error(addDate('2024-01-01', 1.5, 'days'), 'invalid-amount', 'fractional amount rejected');
error(addDate('2024-01-01', 1, 'centuries' as 'days'), 'invalid-unit', 'unknown unit rejected');
assert(formatDate({year:2024,month:2,day:9}) === '2024-02-09', 'date formatting is padded');
assert(value(weekday('2024-01-01'), 'weekday').valueOf() === 1, 'known Monday is ISO weekday 1');
assert(value(weekday('2024-01-07'), 'Sunday weekday') === 7, 'known Sunday is ISO weekday 7');
assert(value(dayOfYear('2024-12-31'), 'day of year') === 366, 'leap-year day-of-year is 366');
assert(value(dayOfYear('2023-12-31'), 'ordinary day of year') === 365, 'ordinary day-of-year is 365');
assert(value(isoWeekNumber('2021-01-01'), 'ISO week known value') === 53, '2021-01-01 is ISO week 53');
assert(value(isoWeekNumber('2021-01-04'), 'ISO week boundary') === 1, '2021-01-04 is ISO week 1');
let diff = value(differenceDates('2020-01-31','2021-03-02'), 'positive date difference');
assert(diff.years === 1 && diff.months === 1 && diff.days === 2 && diff.totalDays === 396, 'difference returns calendar components and total days');
diff = value(differenceDates('2024-03-01','2024-02-28'), 'negative date difference');
assert(diff.years === 0 && diff.months === 0 && diff.days === -2 && diff.totalDays === -2, 'negative difference is signed');
assert(value(countWeekdays('2024-01-05','2024-01-08'), 'weekday count') === 2, 'weekday count includes both endpoints');
assert(value(countWeekdays('2024-01-08','2024-01-05'), 'reverse weekday count') === -2, 'reverse weekday count is signed');
assert(value(countWeekdays('2024-01-06','2024-01-07'), 'weekend count') === 0, 'weekend days are not counted');
error(differenceDates('bad','2024-01-01'), 'invalid-date', 'bad difference input rejected');
assert(value(countWeekdays('0001-01-01','9999-12-31'), 'full calendar weekday count') > 2_000_000, 'weekday count handles the full supported calendar range');
assert(value(parseDate('2024-12-31'), 'determinism parse one').year === value(parseDate('2024-12-31'), 'determinism parse two').year, 'date parsing is deterministic and timezone-independent');

console.log('-- tally');
let tally = createTally();
tally = value(addCounter(tally,'Apples 🍎',2,0,10), 'unicode counter created');
assert(tally.counters['Apples 🍎'].value === 0 && tally.counters['Apples 🍎'].step === 2, 'counter has value and step');
tally = value(changeTally(tally,'Apples 🍎',1), 'counter increments');
assert(tally.counters['Apples 🍎'].value === 2, 'increment applies step');
tally = value(changeTally(tally,'Apples 🍎',-1), 'counter decrements');
assert(tally.counters['Apples 🍎'].value === 0, 'decrement applies step');
tally = value(changeTally(tally,'Apples 🍎',-1), 'counter clamps at minimum');
assert(tally.counters['Apples 🍎'].value === 0, 'minimum bound is enforced');
tally = value(setTallyValue(tally,'Apples 🍎',99), 'set value');
assert(tally.counters['Apples 🍎'].value === 10, 'maximum bound is enforced');
tally = value(addCounter(tally,'مراجعة',1), 'Unicode named counter created');
tally = value(changeTally(tally,'مراجعة',1), 'second counter changes');
assert(tally.counters['مراجعة'].value === 1 && tally.counters['Apples 🍎'].value === 10, 'named counters are independent');
tally = value(undoTally(tally), 'undo second counter action');
assert(tally.counters['مراجعة'].value === 0, 'undo restores previous values');
tally = value(resetTally(tally,'Apples 🍎'), 'reset one counter');
assert(tally.counters['Apples 🍎'].value === 0 && tally.counters['مراجعة'].value === 0, 'single reset preserves other counters');
tally = value(resetTally(tally), 'reset all counters');
assert(tally.counters['مراجعة'].value === 0, 'all-counter reset works');
error(addCounter(tally,'   '), 'invalid-name', 'empty counter name rejected');
error(addCounter(tally,'مراجعة'), 'counter-exists', 'duplicate counter rejected');
error(addCounter(tally,'bad',0), 'invalid-step', 'zero step rejected');
error(setTallyValue(tally,'missing',1), 'counter-not-found', 'unknown counter rejected');
error(setTallyValue(tally,'مراجعة',1.2), 'invalid-value', 'fractional value rejected');
error(undoTally(createTally()), 'nothing-to-undo', 'empty undo history reported');
let many = createTally();
many = value(addCounter(many,'count'), 'counter for history limit created');
for (let i=0;i<105;i++) many = value(changeTally(many,'count',1), `history action ${i+1}`);
assert(many.history.length === 100 && many.counters.count.value === 105, 'undo history is limited to last 100 actions');
for (let i=0;i<100;i++) many = value(undoTally(many), `undo retained action ${i+1}`);
assert(many.counters.count.value === 5 && many.history.length === 0, 'exactly the last 100 actions can be undone');
assert(value(addCounter(createTally(),'🚀'), 'emoji counter').counters['🚀'].value === 0, 'emoji counter names remain intact');


console.log('-- time defect regressions');
for (const [a,b,y,m,d,total] of [
  ['2000-02-29','2024-02-28',23,11,30,8765],
  ['2024-02-29','2029-06-30',5,4,1,1948],
  ['2048-02-29','2055-07-31',7,5,2,2709],
  ['2000-02-29','2011-02-18',10,11,20,4007],
  ['2024-01-31','2024-03-01',0,1,1,30],
  ['2024-01-31','2024-02-29',0,1,0,29],
  ['2023-03-15','2024-03-15',1,0,0,366],
] as const) {
  const got = value(differenceDates(a,b), `date example ${a} ${b}`);
  assert(got.years===y && got.months===m && got.days===d, `date components ${a} ${b}`);
  const utc = (t:string) => { const [yy,mm,dd]=t.split('-').map(Number); const date=new Date(0); date.setUTCFullYear(yy,mm-1,dd); return date.getTime()/86400000; };
  assert(got.totalDays === utc(b)-utc(a), `independent total days ${a} ${b}`);
  const reversed = value(differenceDates(b,a), `reversed ${a} ${b}`);
  assert(reversed.years===-y && reversed.months===-m && reversed.days===-d && reversed.totalDays===-got.totalDays, `negative components ${a} ${b}`);
}
for (const [a,b,expected] of [
  ['2024-01-01','2024-01-05',5], ['2024-01-01','2024-01-08',6],
  ['2024-01-06','2024-01-07',0], ['2024-01-01','2024-01-01',1],
  ['2024-01-06','2024-01-06',0], ['2024-01-01','2024-12-31',262],
  ['2024-01-05','2024-01-01',-5],
] as const) assert(value(countWeekdays(a,b),`weekdays ${a} ${b}`)===expected,`inclusive weekdays ${a} ${b}`);
assert(value(countWeekdays('2024-01-01','2024-01-05',{includeStart:false}),'exclude start')===4,'exclude start old behavior');
const clockBack = value(startTimer(60000,5000),'clock-back timer created');
assert(value(tickTimer(clockBack,1000),'clock-back tick').remainingMs===60000,'clock back clamps to duration');
error(tickTimer({...clockBack,deadlineAt:null},1000),'invalid-state','running without deadline rejected');
for (const name of ['constructor','toString','__proto__']) {
  const blank = createTally();
  error(changeTally(blank,name,1),'counter-not-found',`missing inherited change ${name}`);
  error(setTallyValue(blank,name,5),'counter-not-found',`missing inherited set ${name}`);
  error(resetTally(blank,name),'counter-not-found',`missing inherited reset ${name}`);
  let special=value(addCounter(blank,name),`add special ${name}`);
  assert(special.counters[name].name===name,`special name retained ${name}`);
  special=value(changeTally(special,name,1),`change special ${name}`);
  special=value(setTallyValue(special,name,5),`set special ${name}`);
  special=value(resetTally(special,name),`reset special ${name}`);
  special=value(undoTally(special),`undo special ${name}`);
  assert(special.counters[name].value===5,`undo restored special ${name}`);
  const invalid = {counters:{[name]:{...special.counters[name],name:'different'}},history:[]};
  error(changeTally(invalid,name,1),'invalid-state',`mismatched key rejected ${name}`);
}
// Fixed-seed property test: independent UTC day arithmetic and weekday loop.
let seed=0x5eeda11;
function random32():number { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed; }
function utcDay(t:string):number { const [y,m,d]=t.split('-').map(Number); const date=new Date(0); date.setUTCFullYear(y,m-1,d); return date.getTime()/86400000; }
function dateAt(day:number):string { const d=new Date(day*86400000); return `${String(d.getUTCFullYear()).padStart(4,'0')}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`; }
for (let i=0;i<5200;i++) {
  let year=2000+4*(random32()%1500);
  if (!isLeapYear(year)) year+=4;
  const from=i%3===0 ? `${year}-02-29` : dateAt(utcDay('1600-01-01')+(random32()%2900000));
  const to=dateAt(utcDay(from)+(random32()%Math.min(4001,Math.floor(utcDay('9999-12-31')-utcDay(from))+1)));
  const diff=value(differenceDates(from,to),`property diff ${i}`);
  assert(diff.months>=0 && diff.months<=11 && diff.years>=0,`property components ${i}`);
  const anchor=value(addDate(from,diff.years*12+diff.months,'months'),`property month anchor ${i}`);
  assert(value(addDate(anchor,diff.days,'days'),`property day anchor ${i}`)===to,`property roundtrip ${i}`);
  assert(diff.totalDays===utcDay(to)-utcDay(from),`property total ${i}`);
  let weekdays=0;
  for(let day=utcDay(from);day<=utcDay(to);day++) { const wd=new Date(day*86400000).getUTCDay(); if(wd!==0 && wd!==6) weekdays++; }
  assert(value(countWeekdays(from,to),`property weekdays ${i}`)===weekdays,`property weekday loop ${i}`);
}

console.log(`=== toolsTime tests complete: ${checks} checks ===`);
