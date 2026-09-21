import { createHmac, timingSafeEqual } from 'node:crypto';

export interface MaxUser {
  id: number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  language_code?: string | null;
  photo_url?: string | null;
}

export type InitDataResult =
  | { ok: true; user: MaxUser; authDate: number; startParam?: string }
  | { ok: false; reason: 'malformed' | 'no_hash' | 'bad_signature' | 'bad_auth_date' | 'expired' | 'no_user' };

export interface ValidateOptions {
  maxAgeSeconds: number;
  /** Unix-время в секундах; для тестов. */
  now?: number;
}

/**
 * Проверка подписи initData по алгоритму MAX (dev.max.ru/docs/webapps/validation):
 *   secret_key = HMAC_SHA256(key="WebAppData", msg=BOT_TOKEN)
 *   hash       = hex(HMAC_SHA256(key=secret_key, msg=launch_params))
 * launch_params — пары key=value (значения URL-декодированы), без hash, отсортированы по ключу, через \n.
 * `initData` — это значение window.WebApp.initData, присланное клиентом как есть.
 */
export function validateInitData(initData: string, botToken: string, opts: ValidateOptions): InitDataResult {
  if (!initData || initData.length > 8192) return { ok: false, reason: 'malformed' };

  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const part of initData.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) return { ok: false, reason: 'malformed' };
    const key = part.slice(0, eq);
    if (seen.has(key)) return { ok: false, reason: 'malformed' }; // каждый параметр — ровно один раз
    seen.add(key);
    let value: string;
    try {
      value = decodeURIComponent(part.slice(eq + 1));
    } catch {
      return { ok: false, reason: 'malformed' };
    }
    pairs.push([key, value]);
  }

  const hashPair = pairs.find(([k]) => k === 'hash');
  if (!hashPair || !/^[0-9a-f]{64}$/i.test(hashPair[1])) return { ok: false, reason: 'no_hash' };

  const launchParams = pairs
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secretKey).update(launchParams).digest();
  const actual = Buffer.from(hashPair[1], 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  const map = new Map(pairs);
  const authDate = Number(map.get('auth_date'));
  if (!Number.isInteger(authDate) || authDate <= 0) return { ok: false, reason: 'bad_auth_date' };
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (now - authDate > opts.maxAgeSeconds) return { ok: false, reason: 'expired' };

  let user: MaxUser;
  try {
    user = JSON.parse(map.get('user') ?? '');
  } catch {
    return { ok: false, reason: 'no_user' };
  }
  if (!user || !Number.isSafeInteger(user.id) || typeof user.first_name !== 'string') {
    return { ok: false, reason: 'no_user' };
  }

  return { ok: true, user, authDate, startParam: map.get('start_param') };
}
