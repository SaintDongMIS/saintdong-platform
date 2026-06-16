import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWireDuplicateKey,
  matchWireRowsAgainstLog,
  type BankWireLogDuplicateEntry,
} from '../bankWireLogDuplicateMatch';

function logEntry(
  partial: Partial<BankWireLogDuplicateEntry> & Pick<BankWireLogDuplicateEntry, 'id'>
): BankWireLogDuplicateEntry {
  return {
    batchId: 'BF-1',
    batchType: 'manual_backfill',
    scheduledTxDate: '20260616',
    exportedAt: '2026-06-16T10:00:00.000Z',
    payeeName: '張三',
    payeeAccountDigits: '1234567890',
    amountCents: 10000,
    ...partial,
  };
}

test('buildWireDuplicateKey normalizes name spaces and account digits', () => {
  const a = buildWireDuplicateKey('張 三', '1234-567890', 10000);
  const b = buildWireDuplicateKey('張三', '1234567890', 10000);
  assert.equal(a, b);
});

test('matchWireRowsAgainstLog: strong tier within 7 days', () => {
  const matches = matchWireRowsAgainstLog(
    [
      {
        rowIndex: 0,
        payeeName: '張三',
        payeeAccountDigits: '1234567890',
        amountCents: 10000,
      },
    ],
    [logEntry({ id: '1' })],
    '20260620'
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.tier, 'strong');
  assert.equal(matches[0]!.rowIndex, 0);
});

test('matchWireRowsAgainstLog: weak tier when log date far apart', () => {
  const matches = matchWireRowsAgainstLog(
    [
      {
        rowIndex: 1,
        payeeName: '張三',
        payeeAccountDigits: '1234567890',
        amountCents: 10000,
      },
    ],
    [logEntry({ id: '2', scheduledTxDate: '20260101' })],
    '20260616'
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.tier, 'weak');
});

test('matchWireRowsAgainstLog: no match when amount differs', () => {
  const matches = matchWireRowsAgainstLog(
    [
      {
        rowIndex: 0,
        payeeName: '張三',
        payeeAccountDigits: '1234567890',
        amountCents: 20000,
      },
    ],
    [logEntry({ id: '3' })],
    '20260616'
  );
  assert.equal(matches.length, 0);
});
