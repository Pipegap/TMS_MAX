import type { Request, RequestHandler, Response } from 'express';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { pool } from '../db/pool.js';
import { validateInitData } from '../auth/initData.js';

export interface AuthContext {
  userId: number;    
  maxUserId: string;  
  firstName: string;
  startParam?: string;
}

const SCHEME = 'MaxWebApp ';


export const requireAuth: RequestHandler = async (req: Request, res: Response, next) => {
  let maxUserId: string;
  let firstName: string;
  let startParam: string | undefined;

  const devUser = req.header('x-dev-user-id');
  if (config.devAuthBypass && devUser && /^\d{1,15}$/.test(devUser)) {
    maxUserId = devUser;
    firstName = 'Dev';
  } else {
    const header = req.header('authorization') ?? '';
    if (!header.startsWith(SCHEME)) {
      throw new AppError(401, 'unauthorized', 'Откройте сервис из MAX');
    }
    if (!config.botToken) {
      console.error('[auth] MAX_BOT_TOKEN не задан — проверить initData невозможно');
      throw new AppError(503, 'auth_unavailable', 'Сервис временно недоступен');
    }
    const result = validateInitData(header.slice(SCHEME.length), config.botToken, {
      maxAgeSeconds: config.initDataMaxAgeSeconds,
    });
    if (!result.ok) {
      const message =
        result.reason === 'expired'
          ? 'Сессия устарела. Закройте и снова откройте мини-приложение'
          : 'Не удалось подтвердить пользователя. Откройте сервис из MAX';
      throw new AppError(401, `unauthorized_${result.reason}`, message);
    }
    maxUserId = String(result.user.id);
    firstName = result.user.first_name;
    startParam = result.startParam;
  }

  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO users (max_user_id, first_name) VALUES ($1, $2)
     ON CONFLICT (max_user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_seen_at = now()
     RETURNING id`,
    [maxUserId, firstName],
  );
  const row = rows[0];
  if (!row) throw new AppError(500, 'internal_error', 'Не удалось создать пользователя');
  res.locals.auth = { userId: row.id, maxUserId, firstName, startParam } satisfies AuthContext;
  next();
};

export const getAuth = (res: Response): AuthContext => res.locals.auth as AuthContext;
