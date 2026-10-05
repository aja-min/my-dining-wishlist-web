import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedAccounts } from '../lib/allowed-accounts';
test('multiple accounts resolve to the same author with exact matching', () => {
  const accounts = allowedAccounts('naoto@example.com', ' First@example.com, second@example.com,first@example.com ');
  assert.equal(accounts.valid, true);
  assert.equal(accounts.displayName('FIRST@example.com'), 'あずさ');
  assert.equal(accounts.displayName('second@example.com'), 'あずさ');
  assert.equal(accounts.displayName('naoto@example.com'), 'なおと');
  assert.equal(accounts.displayName('other@example.com'), null);
  assert.equal(accounts.displayName('first@example.com.evil'), null);
  assert.equal(accounts.displayName(null), null);
});
test('missing, malformed, or overlapping allowlists fail closed', () => {
  for (const [naoto, azusa] of [['', 'a@example.com'], ['n@example.com', ''], ['n@example.com', 'bad'], ['n@example.com', 'a@example.com,N@example.com']]) {
    const accounts = allowedAccounts(naoto, azusa);
    assert.equal(accounts.valid, false);
    assert.equal(accounts.displayName('a@example.com'), null);
  }
});
