import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Локально читаем .env из backend/ или из корня репозитория. В Docker переменные приходят из compose.
loadEnv({ path: ['.env', '../.env'], quiet: true });

const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),

  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  DB_NAME: z.string().default('max_sme_support'),

  MAX_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  MAX_BOT_USERNAME: z.preprocess(emptyToUndefined, z.string().optional()),

  INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86400),
  DEV_AUTH_BYPASS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const env = schema.parse(process.env);

function buildDatabaseUrl(): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (!env.DB_PASSWORD) {
    throw new Error('Не задан DATABASE_URL или DB_PASSWORD (см. .env.example)');
  }
  const u = encodeURIComponent(env.DB_USER);
  const p = encodeURIComponent(env.DB_PASSWORD);
  return `postgresql://${u}:${p}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;
}

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  databaseUrl: buildDatabaseUrl(),
  botToken: env.MAX_BOT_TOKEN,
  botUsername: env.MAX_BOT_USERNAME,
  initDataMaxAgeSeconds: env.INIT_DATA_MAX_AGE_SECONDS,
  // В production обход авторизации невозможен, даже если флаг случайно включён.
  devAuthBypass: env.NODE_ENV !== 'production' && env.DEV_AUTH_BYPASS,
} as const;
