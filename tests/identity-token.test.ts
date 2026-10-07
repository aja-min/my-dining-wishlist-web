import test from 'node:test';
import assert from 'node:assert/strict';
import { identityToken } from '../lib/identity-token';
test('migration removes obsolete OAuth credentials while retaining verified identity', () => {
 const old = { email:'person@example.com', sub:'google-id', emailVerified:true, accessToken:'secret', refreshToken:'secret', accessExpires:1, sheetsGranted:true, authError:'ReconnectRequired' };
 const next = identityToken(old);
 assert.deepEqual(next, { email:old.email, sub:old.sub, emailVerified:true });
 assert.equal(old.accessToken,'secret');
});
test('new sign-in replaces verification result and never inherits a verified state', () => {
 assert.equal(identityToken({ emailVerified:true }, false).emailVerified,false);
 assert.equal(identityToken({}, true).emailVerified,true);
 assert.equal(identityToken({}).emailVerified,undefined);
});
