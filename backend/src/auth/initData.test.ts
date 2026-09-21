import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateInitData } from './initData.js';

const BOT_TOKEN = 'test-bot-token-123';
const NOW = 1_771_409_800;

// Независимая реализация подписи — копия логики из документации MAX (webcrypto, localeCompare).
async function referenceSign(params: Array<[string, string]>, botToken: string): Promise<string> {
  const enc = new TextEncoder();
  const launchParams = [...params]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const key = (secret: BufferSource) =>
    crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: { name: 'SHA-256' } }, false, ['sign']);
  const secret = await crypto.subtle.sign('HMAC', await key(enc.encode('WebAppData')), enc.encode(botToken));
  const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(launchParams));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const user = { id: 67890, first_name: 'Max', last_name: 'User', username: null, language_code: 'ru', photo_url: null };

async function buildInitData(overrides: Record<string, string> = {}, order: 'asc' | 'shuffled' = 'shuffled') {
  const params: Array<[string, string]> = [
    ['chat', JSON.stringify({ id: 12345, type: 'DIALOG' })],
    ['ip', '192.168.0.1'],
    ['user', JSON.stringify(user)],
    ['query_id', '4c0ab423-342b-4e45-aea4-2747dbc500cd'],
    ['auth_date', String(NOW - 60)],
    ['start_param', 'measure_5'],
  ].map(([k, v]) => [k as string, overrides[k as string] ?? (v as string)]);
  const hash = await referenceSign(params, BOT_TOKEN);
  const all: Array<[string, string]> = [...params, ['hash', hash]];
  if (order === 'asc') all.sort((a, b) => a[0].localeCompare(b[0]));
  return all.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

const opts = { maxAgeSeconds: 86_400, now: NOW };

test('принимает корректно подписанные данные (порядок параметров не важен)', async () => {
  for (const order of ['shuffled', 'asc'] as const) {
    const res = validateInitData(await buildInitData({}, order), BOT_TOKEN, opts);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.user.id, 67890);
      assert.equal(res.user.first_name, 'Max');
      assert.equal(res.startParam, 'measure_5');
    }
  }
});

test('отклоняет данные с чужим токеном бота', async () => {
  const res = validateInitData(await buildInitData(), 'another-token', opts);
  assert.deepEqual(res, { ok: false, reason: 'bad_signature' });
});

test('отклоняет подмену user_id', async () => {
  const data = await buildInitData();
  const tampered = data.replace(encodeURIComponent('"id":67890'), encodeURIComponent('"id":11111'));
  assert.notEqual(tampered, data);
  const res = validateInitData(tampered, BOT_TOKEN, opts);
  assert.deepEqual(res, { ok: false, reason: 'bad_signature' });
});

test('отклоняет просроченные данные', async () => {
  const res = validateInitData(await buildInitData(), BOT_TOKEN, { maxAgeSeconds: 30, now: NOW });
  assert.deepEqual(res, { ok: false, reason: 'expired' });
});

test('отклоняет мусор, дубли параметров и отсутствие hash', async () => {
  assert.equal(validateInitData('', BOT_TOKEN, opts).ok, false);
  assert.equal(validateInitData('abc', BOT_TOKEN, opts).ok, false);
  assert.deepEqual(validateInitData('a=1&a=2', BOT_TOKEN, opts), { ok: false, reason: 'malformed' });
  assert.deepEqual(validateInitData('a=1&b=2', BOT_TOKEN, opts), { ok: false, reason: 'no_hash' });
  const dup = (await buildInitData()) + '&hash=' + '0'.repeat(64);
  assert.deepEqual(validateInitData(dup, BOT_TOKEN, opts), { ok: false, reason: 'malformed' });
  assert.deepEqual(validateInitData('a=%E0%A4%A', BOT_TOKEN, opts), { ok: false, reason: 'malformed' });
});
