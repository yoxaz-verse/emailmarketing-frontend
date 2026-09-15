import test from 'node:test';
import assert from 'node:assert/strict';
import { formatKolkata, kolkataDateTimeToUtc, kolkataFields } from './kolkataTime';

test('Kolkata wall time converts to the same UTC instant in every browser timezone', () => {
  const instant = kolkataDateTimeToUtc('2026-09-15', '03:15');
  assert.equal(instant?.toISOString(), '2026-09-14T21:45:00.000Z');
  assert.deepEqual(kolkataFields(instant!), {
    date: '2026-09-15', time: '03:15', hour: 3, day: 15, month: 9, year: 2026,
  });
  assert.match(formatKolkata(instant!, { dateStyle: 'medium', timeStyle: 'short' }), /15 Sept 2026.*3:15/i);
});

test('invalid wall dates and times are rejected', () => {
  assert.equal(kolkataDateTimeToUtc('2026-02-30', '03:15'), null);
  assert.equal(kolkataDateTimeToUtc('2026-09-15', '24:00'), null);
});
