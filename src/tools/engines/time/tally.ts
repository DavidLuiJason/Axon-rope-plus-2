import type { EngineResult } from './timer';

export interface TallyCounter { name: string; value: number; step: number; min?: number; max?: number; }
export interface TallyState { counters: Record<string, TallyCounter>; history: TallyState[]; }
const fail = <T>(error: string): EngineResult<T> => ({ ok: false, error });
const success = <T>(value: T): EngineResult<T> => ({ ok: true, value });
const HISTORY_LIMIT = 100;
export function createTally(): TallyState { return { counters: {}, history: [] }; }
export function addCounter(state: TallyState, name: string, step = 1, min?: number, max?: number): EngineResult<TallyState> {
  if (!validState(state)) return fail('invalid-state');
  if (typeof name !== 'string' || name.trim().length === 0) return fail('invalid-name');
  const key = name.trim();
  if (Object.prototype.hasOwnProperty.call(state.counters,key)) return fail('counter-exists');
  if (!Number.isSafeInteger(step) || step === 0) return fail('invalid-step');
  if ((min !== undefined && !Number.isSafeInteger(min)) || (max !== undefined && !Number.isSafeInteger(max)) || (min !== undefined && max !== undefined && min > max)) return fail('invalid-bounds');
  const initial = clamp(0,min,max);
  return success(commit(state,{...state.counters,[key]:{name:key,value:initial,step,...(min===undefined?{}:{min}),...(max===undefined?{}:{max})}}));
}
export function changeTally(state: TallyState, name: string, direction: 1 | -1): EngineResult<TallyState> {
  if (!validState(state)) return fail('invalid-state');
  const counter = Object.prototype.hasOwnProperty.call(state.counters, name) ? state.counters[name] : undefined;
  if (!counter) return fail('counter-not-found');
  if (direction !== 1 && direction !== -1) return fail('invalid-direction');
  return setTallyValue(state,name,counter.value + counter.step * direction);
}
export function setTallyValue(state: TallyState, name: string, value: number): EngineResult<TallyState> {
  if (!validState(state)) return fail('invalid-state');
  const counter = Object.prototype.hasOwnProperty.call(state.counters, name) ? state.counters[name] : undefined;
  if (!counter) return fail('counter-not-found');
  if (!Number.isSafeInteger(value)) return fail('invalid-value');
  return success(commit(state,{...state.counters,[name]:{...counter,value:clamp(value,counter.min,counter.max)}}));
}
export function resetTally(state: TallyState, name?: string): EngineResult<TallyState> {
  if (!validState(state)) return fail('invalid-state');
  if (name !== undefined && !Object.prototype.hasOwnProperty.call(state.counters, name)) return fail('counter-not-found');
  const next = {...state.counters};
  for (const [key,c] of Object.entries(next)) if (name === undefined || key === name) next[key] = {...c,value:clamp(0,c.min,c.max)};
  return success(commit(state,next));
}
export function undoTally(state: TallyState): EngineResult<TallyState> {
  if (!validState(state)) return fail('invalid-state');
  if (state.history.length === 0) return fail('nothing-to-undo');
  const previous = state.history[state.history.length-1];
  return success({counters:cloneCounters(previous.counters),history:state.history.slice(0,-1).map((h)=>({counters:cloneCounters(h.counters),history:[]}))});
}
function commit(state: TallyState,counters: Record<string,TallyCounter>): TallyState {
  const snapshot: TallyState = { counters: cloneCounters(state.counters), history: [] };
  return { counters: cloneCounters(counters), history: [...state.history.map((h)=>({counters:cloneCounters(h.counters),history:[]})),snapshot].slice(-HISTORY_LIMIT) };
}
function clamp(value:number,min?:number,max?:number):number { return Math.min(max===undefined?Number.POSITIVE_INFINITY:max,Math.max(min===undefined?Number.NEGATIVE_INFINITY:min,value)); }
function cloneCounters(counters:Record<string,TallyCounter>):Record<string,TallyCounter> { return Object.fromEntries(Object.entries(counters).map(([k,v])=>[k,{...v}])); }
function validState(s:TallyState):boolean {
  return !!s && typeof s.counters==='object' && s.counters!==null && Array.isArray(s.history)
    && Object.entries(s.counters).every(([k,c])=>typeof k==='string'&&c&&c.name===k&&Number.isSafeInteger(c.value)&&Number.isSafeInteger(c.step)&&c.step!==0
      && (c.min===undefined||Number.isSafeInteger(c.min))&&(c.max===undefined||Number.isSafeInteger(c.max))&&(c.min===undefined||c.max===undefined||c.min<=c.max));
}
