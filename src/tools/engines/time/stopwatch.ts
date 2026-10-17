import type { EngineResult } from './timer';

export interface StopwatchLap { splitMs: number; totalMs: number; }
export interface StopwatchState {
  status: 'idle' | 'running' | 'paused';
  elapsedMs: number;
  startedAt: number | null;
  pausedAt: number | null;
  lastLapTotalMs: number;
  laps: StopwatchLap[];
}
const fail = <T>(error: string): EngineResult<T> => ({ ok: false, error });
const success = <T>(value: T): EngineResult<T> => ({ ok: true, value });
const validClock = (now: number) => Number.isSafeInteger(now) && now >= 0;
const validElapsed = (value: number) => Number.isSafeInteger(value) && value >= 0;

export function createStopwatch(): StopwatchState {
  return { status: 'idle', elapsedMs: 0, startedAt: null, pausedAt: null, lastLapTotalMs: 0, laps: [] };
}
export function startStopwatch(now: number): EngineResult<StopwatchState> {
  if (!validClock(now)) return fail('invalid-clock');
  return success({ ...createStopwatch(), status: 'running', startedAt: now });
}
export function tickStopwatch(state: StopwatchState, now: number): EngineResult<StopwatchState> {
  if (!validClock(now)) return fail('invalid-clock');
  if (!isStopwatchState(state)) return fail('invalid-state');
  if (state.status !== 'running') return success(clone(state));
  return success({ ...state, elapsedMs: state.elapsedMs + Math.max(0, now - state.startedAt!), startedAt: now });
}
export function pauseStopwatch(state: StopwatchState, now: number): EngineResult<StopwatchState> {
  if (!isStopwatchState(state)) return fail('invalid-state');
  if (state.status !== 'running') return fail('not-running');
  const current = tickStopwatch(state, now);
  if (!current.ok) return current;
  return success({ ...current.value, status: 'paused', pausedAt: now, startedAt: null });
}
export function resumeStopwatch(state: StopwatchState, now: number): EngineResult<StopwatchState> {
  if (!validClock(now)) return fail('invalid-clock');
  if (!isStopwatchState(state)) return fail('invalid-state');
  if (state.status !== 'paused') return fail('not-paused');
  return success({ ...state, status: 'running', startedAt: now, pausedAt: null });
}
export function lapStopwatch(state: StopwatchState, now: number): EngineResult<StopwatchState> {
  if (!isStopwatchState(state)) return fail('invalid-state');
  if (state.status !== 'running') return fail('not-running');
  const current = tickStopwatch(state, now);
  if (!current.ok) return current;
  const totalMs = current.value.elapsedMs;
  return success({ ...current.value, lastLapTotalMs: totalMs, laps: [...current.value.laps, { totalMs, splitMs: totalMs - state.lastLapTotalMs }] });
}
export function resetStopwatch(): StopwatchState { return createStopwatch(); }
function clone(state: StopwatchState): StopwatchState { return { ...state, laps: state.laps.map((lap) => ({ ...lap })) }; }
function isStopwatchState(s: StopwatchState): boolean {
  return !!s && ['idle','running','paused'].includes(s.status) && validElapsed(s.elapsedMs)
    && validElapsed(s.lastLapTotalMs) && Array.isArray(s.laps)
    && s.laps.every((lap) => lap && validElapsed(lap.splitMs) && validElapsed(lap.totalMs))
    && (s.startedAt === null || validClock(s.startedAt)) && (s.pausedAt === null || validClock(s.pausedAt));
}
