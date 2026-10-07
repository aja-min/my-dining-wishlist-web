import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshGoogleToken, SHEETS_SCOPE } from '../lib/refresh-google-token';
const base = { accessToken:'old', accessExpires:0, refreshToken:'refresh', email:'person@example.com', sheetsGranted:true };
const reply = (data: unknown, status=200) => (async () => new Response(JSON.stringify(data), { status })) as typeof fetch;
test('valid access token does not call Google', async () => {
 const token={...base,accessExpires:1000000};assert.equal(await refreshGoogleToken(token,'id','secret',async()=>{throw Error('must not fetch')},0),token);
});
test('refresh retains identity and refresh token, updates expiry and scope',async()=>{
 const token=await refreshGoogleToken(base,'id','secret',reply({access_token:'new',expires_in:3600,scope:SHEETS_SCOPE}),100);
 assert.equal(token.accessToken,'new');assert.equal(token.refreshToken,'refresh');assert.equal(token.accessExpires,3600100);assert.equal(token.email,base.email);assert.equal(token.authError,undefined);
 const rotated=await refreshGoogleToken(base,'id','secret',reply({access_token:'new',expires_in:3600,refresh_token:'rotated',scope:'openid'}));assert.equal(rotated.refreshToken,'rotated');assert.equal(rotated.sheetsGranted,false);
});
test('missing/revoked refresh requires reconnection; network failure remains retryable',async()=>{
 assert.equal((await refreshGoogleToken({...base,refreshToken:undefined},'id','secret')).authError,'ReconnectRequired');
 const revoked=await refreshGoogleToken(base,'id','secret',reply({error:'invalid_grant'},400));assert.equal(revoked.authError,'ReconnectRequired');assert.equal(revoked.accessToken,undefined);
 const failed=await refreshGoogleToken(base,'id','secret',reply({error:'unavailable'},503));assert.equal(failed.authError,'RefreshFailed');assert.equal(failed.refreshToken,'refresh');
});
