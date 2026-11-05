import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error The Node test runner requires the extension with strip-types.
import { formatEventCountdown } from './event-countdown.ts';

const NOW = new Date('2026-11-03T06:00:00.000Z').getTime();

test('formats a multi-day countdown with days, hours, and minutes', () => {
  assert.equal(formatEventCountdown('2026-12-04T10:12:00.000Z', NOW), '31d 4h 12m');
});

test('formats a sub-day countdown without a zero-day prefix', () => {
  assert.equal(formatEventCountdown('2026-11-03T10:12:00.000Z', NOW), '4h 12m');
});

test('formats a sub-hour countdown in minutes', () => {
  assert.equal(formatEventCountdown('2026-11-03T06:42:00.000Z', NOW), '42m');
});

test('rounds a positive partial minute up so the event is not shown as started early', () => {
  assert.equal(formatEventCountdown('2026-11-03T06:00:20.000Z', NOW), '1m');
});

test('labels an event at its exact start as started', () => {
  assert.equal(formatEventCountdown('2026-11-03T06:00:00.000Z', NOW), 'Started');
});

test('labels an expired event as started', () => {
  assert.equal(formatEventCountdown('2026-11-03T05:59:59.000Z', NOW), 'Started');
});

test('falls back safely for an invalid timestamp', () => {
  assert.equal(formatEventCountdown('not-a-date', NOW), 'Upcoming');
});
