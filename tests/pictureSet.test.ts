/**
 * Unit tests for the Image Editor picture set.
 * Run: npx tsx tests/pictureSet.test.ts
 */
import {
  MAX_PICTURES, emptySet, addPictures, selectPicture, removePictures, replacePicture,
  setHistory, movePicture, activeEntry, hasPicture, roomLeft, type PictureSet,
} from '../src/tools/imageEdit/pictureSet';
import { applyOp, emptyHistory } from '../src/tools/imageEdit/history';

let checks = 0;
function assert(cond: boolean, msg: string): void {
  checks += 1;
  if (!cond) { console.error('FAIL: ' + msg); process.exit(1); }
}
const ids = (s: PictureSet) => s.items.map((p) => p.id).join(',');

// empty
const e = emptySet();
assert(!hasPicture(e) && activeEntry(e) === null && e.activeId === null, 'empty set has nothing');
assert(roomLeft(e) === MAX_PICTURES, 'empty set has full room');

// add: first becomes active, ids never reused
const a1 = addPictures(e, ['a.png', 'b.jpg', 'c.webp']);
assert(ids(a1.set) === 'p1,p2,p3', 'ids are p1..p3');
assert(a1.set.activeId === 'p3', 'first batch: last added is active');
assert(a1.addedIds.join(',') === 'p1,p2,p3' && a1.refused === 0, 'added ids reported');
const a2 = addPictures(a1.set, ['d.png']);
assert(a2.set.activeId === 'p3', 'later add keeps active');
const a3 = addPictures(a1.set, ['d.png'], true);
assert(a3.set.activeId === 'p4', 'activateNew makes new one active');
assert(e.items.length === 0 && a1.set.items.length === 3, 'add does not mutate input');

// limit
const many = addPictures(emptySet(), Array.from({ length: 11 }, (_, i) => `f${i}.png`));
assert(many.set.items.length === MAX_PICTURES, 'limit is MAX_PICTURES');
assert(many.refused === 11 - MAX_PICTURES && many.addedIds.length === MAX_PICTURES, 'surplus refused and counted');
assert(roomLeft(many.set) === 0, 'no room left');
const full = addPictures(many.set, ['x.png']);
assert(full.refused === 1 && full.addedIds.length === 0 && full.set.items.length === MAX_PICTURES, 'full set refuses');
assert(addPictures(e, []).set.activeId === null, 'adding nothing keeps empty');

// select
assert(selectPicture(a1.set, 'p1').activeId === 'p1', 'select works');
assert(selectPicture(a1.set, 'zzz') === a1.set, 'select unknown changes nothing');

// remove one: active moves to neighbour at same place
let s = selectPicture(a1.set, 'p2');
let r = removePictures(s, ['p2']);
assert(ids(r) === 'p1,p3' && r.activeId === 'p3', 'remove active middle: next one becomes active');
r = removePictures(selectPicture(a1.set, 'p3'), ['p3']);
assert(ids(r) === 'p1,p2' && r.activeId === 'p2', 'remove active last: previous becomes active');
r = removePictures(selectPicture(a1.set, 'p1'), ['p1']);
assert(r.activeId === 'p2', 'remove active first: next becomes active');
r = removePictures(selectPicture(a1.set, 'p3'), ['p1']);
assert(ids(r) === 'p2,p3' && r.activeId === 'p3', 'remove non-active keeps active');
// remove several
r = removePictures(selectPicture(a1.set, 'p2'), ['p1', 'p2']);
assert(ids(r) === 'p3' && r.activeId === 'p3', 'remove several including active');
r = removePictures(a1.set, ['p1', 'p2', 'p3']);
assert(r.items.length === 0 && r.activeId === null && !hasPicture(r), 'remove all empties the set');
assert(r.nextSeq === a1.set.nextSeq, 'ids never reused after remove');
assert(removePictures(a1.set, ['nope']) === a1.set, 'remove unknown changes nothing');
assert(removePictures(a1.set, []) === a1.set, 'remove none changes nothing');
// remove several where survivors sit before active
const five = addPictures(emptySet(), ['1', '2', '3', '4', '5']).set; // active p5
r = removePictures(selectPicture(five, 'p3'), ['p2', 'p3']);
assert(ids(r) === 'p1,p4,p5' && r.activeId === 'p4', 'survivors before shift index correctly');
// add after remove gives a new id
const re = addPictures(removePictures(a1.set, ['p3']), ['z.png']);
assert(ids(re.set) === 'p1,p2,p4', 'new id after removal is p4, not p3');

// replace
let h = applyOp(emptyHistory(), { type: 'rotate', quarterTurns: 1 });
let withHist = setHistory(a1.set, 'p2', h);
assert(withHist.items[1].history.ops.length === 1, 'setHistory stores history');
assert(a1.set.items[1].history.ops.length === 0, 'setHistory does not mutate input');
assert(setHistory(a1.set, 'zzz', h) === a1.set, 'setHistory unknown changes nothing');
const rep = replacePicture(withHist, 'p2', 'new.png');
assert(rep.items[1].id === 'p2' && rep.items[1].name === 'new.png', 'replace keeps id and place, changes name');
assert(rep.items[1].history.ops.length === 0 && rep.items[1].history.redo.length === 0, 'replace clears history');
assert(rep.items[0].name === 'a.png' && rep.items[2].name === 'c.webp', 'replace leaves others alone');
assert(replacePicture(a1.set, 'zzz', 'q') === a1.set, 'replace unknown changes nothing');

// move
const mv = movePicture(a1.set, 'p1', 2);
assert(ids(mv) === 'p2,p3,p1', 'move to end');
assert(ids(movePicture(a1.set, 'p3', 0)) === 'p3,p1,p2', 'move to start');
assert(ids(movePicture(a1.set, 'p1', 99)) === 'p2,p3,p1', 'move clamps high');
assert(ids(movePicture(a1.set, 'p3', -5)) === 'p3,p1,p2', 'move clamps low');
assert(movePicture(a1.set, 'p2', 1) === a1.set, 'move to same place changes nothing');
assert(movePicture(a1.set, 'zzz', 0) === a1.set, 'move unknown changes nothing');
assert(mv.activeId === a1.set.activeId, 'move keeps active');

// activeEntry
assert(activeEntry(selectPicture(a1.set, 'p1'))?.name === 'a.png', 'activeEntry returns the active picture');

console.log(`=== all pictureSet tests passed (${checks} checks) ===`);
