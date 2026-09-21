import { config } from './config.js';
import { createApp } from './app.js';
import { createBot } from './bot/index.js';
import { pool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { seedMeasures } from './db/seed.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Если MAX недоступен на старте, бот не остаётся мёртвым: повторяем с растущей паузой (до 30 с). */
async function startBotWithRetry(bot: ReturnType<typeof createBot>, isStopping: () => boolean) {
  for (let attempt = 1; !isStopping(); attempt++) {
    try {
      await bot.start();
      return;
    } catch (err) {
      const delay = Math.min(30_000, 2_000 * attempt);
      console.error(`[bot] запуск не удался (попытка ${attempt}), повтор через ${delay / 1000} с:`, (err as Error).message);
      await sleep(delay);
    }
  }
}

async function main() {
  let stopping = false;
  await runMigrations();
  const seeded = await seedMeasures();
  console.log(`[db] меры поддержки загружены из seed: ${seeded}`);

  if (config.devAuthBypass) console.warn('[auth] ВНИМАНИЕ: включён DEV_AUTH_BYPASS (только для разработки)');

  const server = createApp().listen(config.port, () => {
    console.log(`[api] слушает порт ${config.port}`);
  });

  let bot: ReturnType<typeof createBot> | undefined;
  if (config.botToken) {
    bot = createBot(config.botToken, config.botUsername);
    void startBotWithRetry(bot, () => stopping);
  } else {
    console.warn('[bot] MAX_BOT_TOKEN не задан — бот и проверка initData отключены');
  }

  const shutdown = async (signal: string) => {
    console.log(`[app] ${signal}: останавливаюсь`);
    stopping = true;
    bot?.stopPolling();
    server.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[app] фатальная ошибка при старте:', err);
  process.exit(1);
});
