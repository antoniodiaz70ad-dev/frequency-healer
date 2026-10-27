// Offline, read-only configuration inventory. No network, provisioning, tokens or secret values.
const flags = ['ATENEA_VOICE_ENABLED', 'ATENEA_STAGING_ENABLED', 'ATENEA_LIVE_ENABLED', 'ATENEA_LIVE_REVIEWED', 'ATENEA_REAPER_READY'];
const variables = ['ATENEA_VOICE_ORIGIN', 'ATENEA_LOGIN_PATH', 'ATENEA_AUTH_ISSUER', 'ATENEA_AUTH_AUDIENCE', 'ATENEA_AUTH_JWKS', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'ATENEA_REAPER_TOKEN', 'OPENAI_API_KEY'];
const configuration = Object.fromEntries(variables.map(name => [name, process.env[name]?.trim() ? 'configured-unverified' : 'missing']));
for (const name of ['ATENEA_VOICE_ORIGIN', 'ATENEA_AUTH_ISSUER', 'UPSTASH_REDIS_REST_URL']) {
  if (configuration[name] === 'missing') continue;
  try { const url = new URL(process.env[name]); if (url.protocol !== 'https:' || url.username || url.password || (name === 'ATENEA_VOICE_ORIGIN' && url.origin !== process.env[name])) configuration[name] = 'invalid'; }
  catch { configuration[name] = 'invalid'; }
}
if (configuration.ATENEA_AUTH_JWKS !== 'missing') {
  try { const jwks = JSON.parse(process.env.ATENEA_AUTH_JWKS); if (!Array.isArray(jwks.keys) || !jwks.keys.length || jwks.keys.some(key => key.kty !== 'RSA' || key.d || !key.n || !key.e)) configuration.ATENEA_AUTH_JWKS = 'invalid'; }
  catch { configuration.ATENEA_AUTH_JWKS = 'invalid'; }
}
if (configuration.ATENEA_REAPER_TOKEN !== 'missing' && process.env.ATENEA_REAPER_TOKEN.length < 32) configuration.ATENEA_REAPER_TOKEN = 'invalid';
if (configuration.ATENEA_LOGIN_PATH !== 'missing' && (!/^\/[A-Za-z0-9/_-]*$/.test(process.env.ATENEA_LOGIN_PATH) || process.env.ATENEA_LOGIN_PATH.startsWith('//'))) configuration.ATENEA_LOGIN_PATH = 'invalid';
console.log(JSON.stringify({ status: 'NO-GO', flags: Object.fromEntries(flags.map(name => [name, process.env[name] === 'true'])), configuration, identityProviderVerified: false, redisVerifiedInStaging: false, schedulerVerifiedInStaging: false, remoteAudioVerified: false, note: 'Configured does not mean usable or approved. No values are printed; nothing was changed.' }, null, 2));
