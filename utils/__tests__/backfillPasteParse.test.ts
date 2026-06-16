import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseBackfillPasteText,
  BACKFILL_PASTE_EXAMPLE,
} from '../backfillPasteParse';

test('parseBackfillPasteText: example with header', () => {
  const r = parseBackfillPasteText(BACKFILL_PASTE_EXAMPLE);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0]!.payeeName, '上承人資管理顧問有限公司');
  assert.equal(r.rows[0]!.payeeBankCode7, '0041090');
});

test('parseBackfillPasteText: comma without header', () => {
  const r = parseBackfillPasteText(
    '張三,1000.50,1234567890,0130000,茶水費,'
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.rows[0]!.amountYuan, '1000.50');
  assert.equal(r.rows[0]!.payeeAccountDigits, '1234567890');
});

test('parseBackfillPasteText: empty fails', () => {
  const r = parseBackfillPasteText('   \n');
  assert.equal(r.ok, false);
});
