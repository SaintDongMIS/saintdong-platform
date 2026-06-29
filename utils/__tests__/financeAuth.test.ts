import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFinanceSessionToken,
  isFinanceProtectedApiPath,
  parseFinanceSessionToken,
  verifyFinanceCredentials,
} from '../../server/utils/financeAuth';

describe('financeAuth', () => {
  const secret = 'test-secret-key';

  it('matches protected api paths', () => {
    assert.equal(isFinanceProtectedApiPath('/api/finance/reports'), true);
    assert.equal(isFinanceProtectedApiPath('/api/bank-convert/analyze'), true);
    assert.equal(isFinanceProtectedApiPath('/api/upload/finance'), true);
    assert.equal(isFinanceProtectedApiPath('/api/auth/finance/login'), false);
    assert.equal(isFinanceProtectedApiPath('/api/upload/road-construction'), false);
  });

  it('verifies allowed users and shared password', () => {
    const testPassword = 'test-finance-password';
    assert.equal(verifyFinanceCredentials('Jim', testPassword, testPassword), true);
    assert.equal(verifyFinanceCredentials('Sam', testPassword, testPassword), true);
    assert.equal(verifyFinanceCredentials('Finance', testPassword, testPassword), true);
    assert.equal(verifyFinanceCredentials('Admin', testPassword, testPassword), false);
    assert.equal(verifyFinanceCredentials('Jim', 'wrong', testPassword), false);
  });

  it('creates and parses session token', () => {
    const now = Date.parse('2026-06-30T12:00:00.000Z');
    const token = createFinanceSessionToken('Jim', secret, now);
    assert.equal(parseFinanceSessionToken(token, secret, now + 1000), 'Jim');
    assert.equal(parseFinanceSessionToken(token, secret, now + 8 * 60 * 60 * 1000 + 1), null);
    assert.equal(parseFinanceSessionToken(token, 'wrong-secret', now + 1000), null);
  });
});
