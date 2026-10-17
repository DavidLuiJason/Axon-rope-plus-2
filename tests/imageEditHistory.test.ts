/**
 * Unit tests for image edit history helper.
 * Run: npx tsx tests/imageEditHistory.test.ts
 */

import {
  emptyHistory,
  applyOp,
  undo,
  redo,
  canUndo,
  canRedo,
  reset,
  outputSize,
  type EditOp,
} from '../src/tools/imageEdit/history';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

console.log('=== imageEditHistory tests ===');

// 1. Initial empty history
const h0 = emptyHistory();
assert(h0.ops.length === 0, 'emptyHistory ops is empty');
assert(h0.redo.length === 0, 'emptyHistory redo is empty');
assert(!canUndo(h0), 'emptyHistory cannot undo');
assert(!canRedo(h0), 'emptyHistory cannot redo');

// 2. Apply op
const opRotate: EditOp = { type: 'rotate', quarterTurns: 1 };
const h1 = applyOp(h0, opRotate);
assert(h1.ops.length === 1, 'applyOp adds op');
assert(h1.ops[0].type === 'rotate', 'op type is rotate');
assert(canUndo(h1), 'canUndo after applyOp');
assert(!canRedo(h1), 'cannot redo after applyOp');

// 3. Undo
const h2 = undo(h1);
assert(h2.ops.length === 0, 'undo removes last op');
assert(h2.redo.length === 1, 'undo adds to redo');
assert(canRedo(h2), 'canRedo after undo');
assert(!canUndo(h2), 'cannot undo when all undone');

// 4. Redo
const h3 = redo(h2);
assert(h3.ops.length === 1, 'redo restores op');
assert(h3.ops[0].type === 'rotate', 'restored op matches');
assert(h3.redo.length === 0, 'redo clears from redo stack');
assert(canUndo(h3), 'can undo after redo');

// 5. Redo cleared after a new op
const h4 = undo(h3);
assert(h4.redo.length === 1, 'h4 has redo available');
const opFlip: EditOp = { type: 'flip', axis: 'horizontal' };
const h5 = applyOp(h4, opFlip);
assert(h5.ops.length === 1, 'h5 has new op');
assert(h5.ops[0].type === 'flip', 'h5 op is flip');
assert(h5.redo.length === 0, 'redo stack is cleared after new op');
assert(!canRedo(h5), 'cannot redo after new op applied');

// 6. Reset
const h6 = applyOp(h5, opRotate);
assert(h6.ops.length === 2, 'h6 has 2 ops');
const h7 = reset(h6);
assert(h7.ops.length === 0, 'reset clears ops');
assert(h7.redo.length === 0, 'reset clears redo');
assert(!canUndo(h7), 'cannot undo after reset');

// 7. Output size after one and two rotations
const size0 = outputSize(1920, 1080, []);
assert(size0.width === 1920 && size0.height === 1080, 'outputSize initial is 1920x1080');

const size1 = outputSize(1920, 1080, [{ type: 'rotate', quarterTurns: 1 }]);
assert(size1.width === 1080 && size1.height === 1920, 'outputSize after 1 rotation is 1080x1920');

const size2 = outputSize(1920, 1080, [
  { type: 'rotate', quarterTurns: 1 },
  { type: 'rotate', quarterTurns: -1 },
]);
assert(size2.width === 1920 && size2.height === 1080, 'outputSize after 2 rotations is 1920x1080');

const sizeFlip = outputSize(1920, 1080, [{ type: 'flip', axis: 'vertical' }]);
assert(sizeFlip.width === 1920 && sizeFlip.height === 1080, 'outputSize after flip remains 1920x1080');

// 8. Immutability: input objects not mutated
const initialOps = [opRotate];
const hImmutable = { ops: initialOps, redo: [] };
const hAfterApply = applyOp(hImmutable, opFlip);
assert(hImmutable.ops.length === 1, 'applyOp did not mutate input ops');
const hAfterUndo = undo(hAfterApply);
assert(hAfterApply.ops.length === 2, 'undo did not mutate input ops');
assert(hAfterApply.redo.length === 0, 'undo did not mutate input redo');
const hAfterRedo = redo(hAfterUndo);
assert(hAfterUndo.redo.length === 1, 'redo did not mutate input redo');

console.log('=== all imageEditHistory tests passed ===');
