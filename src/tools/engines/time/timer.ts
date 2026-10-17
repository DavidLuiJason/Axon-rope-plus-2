export type EngineResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';
export interface TimerState {
  status: TimerStatus;
  durationMs: number;
  remainingMs: number;
  startedAt: number | null;
  deadlineAt: number | null;
  pausedAt: number | null;
}

const fail = <T>(error: string): EngineResult<T> => ({ ok: false, error });
const success = <T>(value: T): EngineResult<T> => ({ ok: true, value });
const validClock = (now: number) => Number.isSafeInteger(now) && now >= 0;
const validDuration = (duration: number) => Number.isSafeInteger(duration) && duration >= 0;

export function createTimer(): TimerState {
  return { status: 'idle', durationMs: 0, remainingMs: 0, startedAt: null, deadlineAt: null, pausedAt: null };
}

export function startTimer(durationMs: number, now: number): EngineResult<TimerState> {
  if (!validDuration(durationMs)) return fail('invalid-duration');
  if (!validClock(now)) return fail('invalid-clock');
  if (!Number.isSafeInteger(now + durationMs)) return fail('invalid-duration');
  return success(durationMs === 0
    ? { status: 'finished', durationMs, remainingMs: 0, startedAt: now, deadlineAt: now, pausedAt: null }
    : { status: 'running', durationMs, remainingMs: durationMs, startedAt: now, deadlineAt: now + durationMs, pausedAt: null });
}

export function tickTimer(state: TimerState, now: number): EngineResult<{ state: TimerState; remainingMs: number }> {
  if (!validClock(now)) return fail('invalid-clock');
  if (!isTimerState(state)) return fail('invalid-state');
  if (state.status !== 'running') return success({ state: { ...state }, remainingMs: state.remainingMs });
  const remainingMs = Math.min(state.durationMs, Math.max(0, state.deadlineAt! - now));
  const next: TimerState = remainingMs === 0
    ? { ...state, status: 'finished', remainingMs: 0, deadlineAt: now, pausedAt: null }
    : { ...state, remainingMs };
  return success({ state: next, remainingMs });
}

export function pauseTimer(state: TimerState, now: number): EngineResult<TimerState> {
  const ticked = tickTimer(state, now);
  if (!ticked.ok) return ticked;
  if (state.status !== 'running') return fail('not-running');
  if (ticked.value.state.status === 'finished') return fail('finished');
  return success({ ...ticked.value.state, status: 'paused', remainingMs: ticked.value.remainingMs, deadlineAt: null, pausedAt: now });
}

export function resumeTimer(state: TimerState, now: number): EngineResult<TimerState> {
  if (!validClock(now)) return fail('invalid-clock');
  if (!isTimerState(state)) return fail('invalid-state');
  if (state.status !== 'paused') return fail('not-paused');
  if (state.remainingMs <= 0) return success({ ...state, status: 'finished', deadlineAt: now, pausedAt: null });
  return success({ ...state, status: 'running', startedAt: now, deadlineAt: now + state.remainingMs, pausedAt: null });
}

export function resetTimer(): TimerState { return createTimer(); }

export function formatTimerHms(milliseconds: number): string {
  const total = safeSeconds(milliseconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
}
export function formatTimerMs(milliseconds: number): string {
  const total = safeSeconds(milliseconds);
  return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
}
function safeSeconds(ms: number): number { return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0; }
function pad2(value: number): string { return String(value).padStart(2, '0'); }
function isTimerState(value: TimerState): boolean {
  return !!value && ['idle','running','paused','finished'].includes(value.status)
    && validDuration(value.durationMs) && validDuration(value.remainingMs)
    && (value.status !== 'running' || value.deadlineAt !== null)
    && (value.startedAt === null || validClock(value.startedAt))
    && (value.deadlineAt === null || validClock(value.deadlineAt))
    && (value.pausedAt === null || validClock(value.pausedAt));
}
