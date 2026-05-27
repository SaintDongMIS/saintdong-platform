import test from 'node:test';
import assert from 'node:assert/strict';

import { getScheduledTransDateYmd } from '../bankWireScheduledTransDate';

test('bank scheduled trans date: 1-14 => 15', () => {
  const now = new Date('2026-05-14T23:59:59+08:00');
  assert.equal(getScheduledTransDateYmd(now), '20260515');
});

test('bank scheduled trans date: 15 00:00 => month end', () => {
  const now = new Date('2026-05-15T00:00:00+08:00');
  assert.equal(getScheduledTransDateYmd(now), '20260531');
});

test('bank scheduled trans date: month end stays end', () => {
  const now = new Date('2026-05-31T23:59:59+08:00');
  assert.equal(getScheduledTransDateYmd(now), '20260531');
});

test('bank scheduled trans date: next month uses 15/last day rule', () => {
  const now = new Date('2026-06-01T00:00:00+08:00');
  assert.equal(getScheduledTransDateYmd(now), '20260615');
});

test('bank scheduled trans date: leap year February uses Feb 29', () => {
  const now = new Date('2024-02-20T12:00:00+08:00');
  assert.equal(getScheduledTransDateYmd(now), '20240229');
});

test('bank scheduled trans date: non-leap year February uses Feb 28', () => {
  const now = new Date('2023-02-20T12:00:00+08:00');
  assert.equal(getScheduledTransDateYmd(now), '20230228');
});

