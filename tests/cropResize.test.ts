/**
 * Unit tests for crop and resize arithmetic and the extended edit history sizes.
 * Run: npx tsx tests/cropResize.test.ts
 */
import { MAX_SIDE, MIN_CROP, CROP_SHAPES, clampCrop, cropForShape, resizeTo } from '../src/tools/imageEdit/cropResize';
import { outputSize, applyOp, undo, redo, emptyHistory } from '../src/tools/imageEdit/history';

let checks = 0;
function assert(cond: boolean, msg: string): void {
  checks += 1;
  if (!cond) { console.error('FAIL: ' + msg); process.exit(1); }
}
const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

// clampCrop
assert(same(clampCrop({ x: 10, y: 10, width: 50, height: 40 }, 100, 100), { x: 10, y: 10, width: 50, height: 40 }), 'inside stays');
assert(same(clampCrop({ x: 90, y: 90, width: 50, height: 50 }, 100, 100), { x: 50, y: 50, width: 50, height: 50 }), 'overflow slides back inside');
assert(same(clampCrop({ x: -5, y: -5, width: 20, height: 20 }, 100, 100), { x: 0, y: 0, width: 20, height: 20 }), 'negative origin to 0');
assert(same(clampCrop({ x: 0, y: 0, width: 500, height: 500 }, 100, 80), { x: 0, y: 0, width: 100, height: 80 }), 'too big shrinks to picture');
assert(clampCrop({ x: 0, y: 0, width: 1, height: 1 }, 100, 100).width === MIN_CROP, 'minimum width');
assert(clampCrop({ x: 0, y: 0, width: 1, height: 1 }, 100, 100).height === MIN_CROP, 'minimum height');
assert(clampCrop({ x: 0, y: 0, width: 1, height: 1 }, 4, 4).width === 4, 'tiny picture: minimum limited by picture');
assert(same(clampCrop({ x: 1.6, y: 2.4, width: 10.5, height: 10.4 }, 100, 100), { x: 2, y: 2, width: 11, height: 10 }), 'rounds to whole pixels');
assert(same(clampCrop({ x: NaN, y: NaN, width: NaN, height: NaN }, 100, 100), { x: 0, y: 0, width: MIN_CROP, height: MIN_CROP }), 'NaN is safe');

// cropForShape
assert(same(cropForShape(400, 300, null), { x: 0, y: 0, width: 400, height: 300 }), 'free is whole picture');
assert(same(cropForShape(400, 300, 1), { x: 50, y: 0, width: 300, height: 300 }), '1:1 on landscape');
assert(same(cropForShape(300, 400, 1), { x: 0, y: 50, width: 300, height: 300 }), '1:1 on portrait');
assert(same(cropForShape(400, 300, 4 / 3), { x: 0, y: 0, width: 400, height: 300 }), '4:3 on 4:3 is whole');
assert(same(cropForShape(1600, 900, 9 / 16), { x: 547, y: 0, width: 506, height: 900 }), '9:16 on 16:9: centred, whole pixels');
assert(same(cropForShape(1000, 1000, 16 / 9), { x: 0, y: 218, width: 1000, height: 563 }), '16:9 on square');
assert(same(cropForShape(100, 100, 0), { x: 0, y: 0, width: 100, height: 100 }), 'bad ratio is whole picture');
for (const shape of CROP_SHAPES) {
  const r = cropForShape(1234, 777, shape.ratio);
  assert(r.x >= 0 && r.y >= 0 && r.x + r.width <= 1234 && r.y + r.height <= 777, `shape ${shape.id} stays inside`);
  if (shape.ratio !== null) assert(Math.abs(r.width / r.height - shape.ratio) < 0.01, `shape ${shape.id} has its ratio`);
}
assert(CROP_SHAPES.length === 6 && CROP_SHAPES[0].id === 'free', 'six crop shapes, free first');

// resizeTo
assert(same(resizeTo(400, 300, { mode: 'percent', value: 50 }), { width: 200, height: 150, limited: false }), '50 percent');
assert(same(resizeTo(400, 300, { mode: 'percent', value: 25 }), { width: 100, height: 75, limited: false }), '25 percent');
assert(same(resizeTo(400, 300, { mode: 'width', value: 200 }), { width: 200, height: 150, limited: false }), 'by width keeps shape');
assert(same(resizeTo(400, 300, { mode: 'height', value: 150 }), { width: 200, height: 150, limited: false }), 'by height keeps shape');
assert(same(resizeTo(400, 300, { mode: 'exact', width: 123, height: 45 }), { width: 123, height: 45, limited: false }), 'exact does not keep shape');
assert(same(resizeTo(400, 300, { mode: 'width', value: 1000 }), { width: 1000, height: 750, limited: false }), 'enlarging is allowed below the limit');
assert(same(resizeTo(4000, 3000, { mode: 'percent', value: 200 }), { width: 4096, height: 3072, limited: true }), 'limit keeps shape');
assert(same(resizeTo(400, 300, { mode: 'exact', width: 8192, height: 2048 }), { width: 4096, height: 1024, limited: true }), 'exact over limit scales both');
assert(resizeTo(400, 300, { mode: 'percent', value: 0 }).width === 1, 'never below 1 pixel (width)');
assert(resizeTo(400, 300, { mode: 'percent', value: -10 }).height === 1, 'negative percent is safe');
assert(resizeTo(400, 300, { mode: 'exact', width: NaN, height: NaN }).width === 1, 'NaN is safe');
assert(resizeTo(0, 0, { mode: 'width', value: 100 }).height === 1, 'zero source is safe');
assert(MAX_SIDE === 4096, 'limit matches the editor load limit');

// history sizes with crop and resize
const base = emptyHistory();
const c = applyOp(base, { type: 'crop', x: 10, y: 20, width: 100, height: 50 });
assert(same(outputSize(400, 300, c.ops), { width: 100, height: 50 }), 'crop sets size');
const cr = applyOp(c, { type: 'rotate', quarterTurns: 1 });
assert(same(outputSize(400, 300, cr.ops), { width: 50, height: 100 }), 'rotate after crop swaps');
const crz = applyOp(cr, { type: 'resize', width: 25, height: 50 });
assert(same(outputSize(400, 300, crz.ops), { width: 25, height: 50 }), 'resize sets size');
const rot = applyOp(base, { type: 'rotate', quarterTurns: -1 });
const rotCrop = applyOp(rot, { type: 'crop', x: 0, y: 0, width: 30, height: 40 });
assert(same(outputSize(400, 300, rotCrop.ops), { width: 30, height: 40 }), 'crop after rotate sets size');
assert(same(outputSize(400, 300, applyOp(base, { type: 'flip', axis: 'horizontal' }).ops), { width: 400, height: 300 }), 'flip keeps size');
const u = undo(crz);
assert(same(outputSize(400, 300, u.ops), { width: 50, height: 100 }), 'undo resize returns previous size');
assert(same(outputSize(400, 300, redo(u).ops), { width: 25, height: 50 }), 'redo resize returns size');
assert(same(outputSize(400, 300, []), { width: 400, height: 300 }), 'no ops keeps size');

console.log(`=== all cropResize tests passed (${checks} checks) ===`);
