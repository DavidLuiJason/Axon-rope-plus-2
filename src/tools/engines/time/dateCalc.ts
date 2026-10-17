import type { EngineResult } from './timer';

export type DateParts = { year: number; month: number; day: number };
export type DateUnit = 'years' | 'months' | 'days';
export type CalendarDate = string;
export interface DateDifference { years: number; months: number; days: number; totalDays: number; }
const fail = <T>(error: string): EngineResult<T> => ({ ok: false, error });
const success = <T>(value: T): EngineResult<T> => ({ ok: true, value });
const DAY_MS = 86400000;

export function parseDate(text: string): EngineResult<DateParts> {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return fail('invalid-date');
  const year = Number(text.slice(0, 4)), month = Number(text.slice(5, 7)), day = Number(text.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return fail('invalid-date');
  return success({ year, month, day });
}
export function formatDate(date: DateParts): CalendarDate {
  if (!isDateParts(date)) return '';
  return `${String(date.year).padStart(4,'0')}-${String(date.month).padStart(2,'0')}-${String(date.day).padStart(2,'0')}`;
}
export function addDate(text: string, amount: number, unit: DateUnit): EngineResult<CalendarDate> {
  const parsed = parseDate(text);
  if (!parsed.ok) return parsed;
  if (!Number.isSafeInteger(amount)) return fail('invalid-amount');
  if (!['years','months','days'].includes(unit)) return fail('invalid-unit');
  const d = parsed.value;
  if (unit === 'days') {
    const ordinal = toOrdinal(d) + amount;
    const result = fromOrdinal(ordinal);
    return result ? success(formatDate(result)) : fail('date-out-of-range');
  }
  const deltaMonths = unit === 'years' ? amount * 12 : amount;
  if (!Number.isSafeInteger(deltaMonths)) return fail('date-out-of-range');
  const index = (d.year - 1) * 12 + (d.month - 1) + deltaMonths;
  const year = Math.floor(index / 12) + 1, month = ((index % 12) + 12) % 12 + 1;
  if (year < 1 || year > 9999) return fail('date-out-of-range');
  return success(formatDate({ year, month, day: Math.min(d.day, daysInMonth(year, month)) }));
}
export function differenceDates(fromText: string, toText: string): EngineResult<DateDifference> {
  const a = parseDate(fromText), b = parseDate(toText);
  if (!a.ok) return a;
  if (!b.ok) return b;
  const from = a.value, to = b.value, totalDays = toOrdinal(to) - toOrdinal(from);
  if (totalDays < 0) {
    const reversed = differencePositive(to, from, -totalDays);
    return success({ years: -reversed.years, months: -reversed.months, days: -reversed.days, totalDays });
  }
  return success(differencePositive(from, to, totalDays));
}
function differencePositive(a: DateParts, b: DateParts, totalDays: number): DateDifference {
  let monthsTotal = (b.year - a.year) * 12 + b.month - a.month;
  let anchor = addParts(a, monthsTotal);
  if (compare(anchor, b) > 0) { monthsTotal--; anchor = addParts(a, monthsTotal); }
  return { years: Math.floor(monthsTotal / 12), months: monthsTotal % 12, days: toOrdinal(b) - toOrdinal(anchor), totalDays };
}
function addParts(d: DateParts, months: number): DateParts {
  const index = (d.year - 1) * 12 + d.month - 1 + months;
  const year = Math.floor(index / 12) + 1, month = ((index % 12) + 12) % 12 + 1;
  return { year, month, day: Math.min(d.day, daysInMonth(year, month)) };
}
function compare(a: DateParts, b: DateParts): number { return a.year-b.year || a.month-b.month || a.day-b.day; }
export function weekday(text: string): EngineResult<number> {
  const parsed = parseDate(text); if (!parsed.ok) return parsed;
  // ISO weekday: Monday=1 through Sunday=7.
  return success(((toOrdinal(parsed.value) - 1) % 7) + 1);
}
export function dayOfYear(text: string): EngineResult<number> {
  const parsed = parseDate(text); if (!parsed.ok) return parsed;
  const d = parsed.value; return success(toOrdinal(d) - toOrdinal({ year: d.year, month: 1, day: 1 }) + 1);
}
export function isoWeekNumber(text: string): EngineResult<number> {
  const parsed = parseDate(text); if (!parsed.ok) return parsed;
  const d = parsed.value, ordinal = toOrdinal(d), wd = ((ordinal - 1) % 7) + 1;
  const thursday = fromOrdinal(ordinal + (4 - wd));
  if (!thursday) return fail('date-out-of-range');
  const jan4 = toOrdinal({ year: thursday.year, month: 1, day: 4 });
  const jan4wd = ((jan4 - 1) % 7) + 1;
  const week1Monday = jan4 - (jan4wd - 1);
  return success(Math.floor((ordinal - week1Monday) / 7) + 1);
}
// Counts both endpoints by default; includeStart:false excludes the earlier endpoint after swapping. Reverse ranges return a negative count.
export function countWeekdays(fromText: string, toText: string, options?: { includeStart?: boolean }): EngineResult<number> {
  const a = parseDate(fromText), b = parseDate(toText);
  if (!a.ok) return a; if (!b.ok) return b;
  let start = toOrdinal(a.value), end = toOrdinal(b.value), sign = 1;
  if (end < start) { const swap = start; start = end; end = swap; sign = -1; }
  const length = end - start + (options?.includeStart === false ? 0 : 1);
  if (options?.includeStart === false) start++;
  const fullWeeks = Math.floor(length / 7);
  let count = fullWeeks * 5;
  const remainder = length % 7;
  for (let offset = 0; offset < remainder; offset++) {
    const wd = (((start + offset) - 1) % 7) + 1;
    if (wd <= 5) count++;
  }
  return success(count * sign);
}
export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) return 0;
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4,6,9,11].includes(month) ? 30 : 31;
}
export function isLeapYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1 && year <= 9999 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
}
function isDateParts(d: DateParts): boolean { return !!d && Number.isInteger(d.year) && d.year >= 1 && d.year <= 9999 && Number.isInteger(d.month) && d.month >= 1 && d.month <= 12 && Number.isInteger(d.day) && d.day >= 1 && d.day <= daysInMonth(d.year,d.month); }
// Proleptic Gregorian ordinal: 0001-01-01 is ordinal 1.
function toOrdinal(d: DateParts): number {
  const y = d.year - 1;
  const beforeYear = 365*y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400);
  const monthDays = [0,31, isLeapYear(d.year)?29:28,31,30,31,30,31,31,30,31,30,31];
  let beforeMonth = 0; for (let m=1;m<d.month;m++) beforeMonth += monthDays[m];
  return beforeYear + beforeMonth + d.day;
}
function fromOrdinal(ordinal: number): DateParts | null {
  const max = toOrdinal({year:9999,month:12,day:31});
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > max) return null;
  let lo=1, hi=9999;
  while (lo < hi) { const mid=Math.floor((lo+hi+1)/2); if (toOrdinal({year:mid,month:1,day:1}) <= ordinal) lo=mid; else hi=mid-1; }
  let dayOfYear = ordinal - toOrdinal({year:lo,month:1,day:1}) + 1, month=1;
  while (dayOfYear > daysInMonth(lo,month)) { dayOfYear -= daysInMonth(lo,month); month++; }
  return {year:lo,month,day:dayOfYear};
}
