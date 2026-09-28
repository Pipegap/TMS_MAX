import { config } from './config.js'
import { createApp } from './app.js'
import { createBot } from './bot/index.js'
import { pool } from './db/pool.js'
import { runMigrations } from './db/migrate.js'
import { seedMeasures } from './db/seed.js'
import { importOkved } from './db/importOkved.js'

const sleep = (ms: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms),
  )

async function startBotWithRetry(
  bot: ReturnType<typeof createBot>,
  isStopping: () => boolean,
) {
  for (
    let attempt = 1;
    !isStopping();
    attempt++
  ) {
    try {
      await bot.start()
      return
    } catch (error) {
      const delay = Math.min(
        30_000,
        2_000 * attempt,
      )

      console.error(
        `[bot] запуск не удался (попытка ${attempt}), повтор через ${delay / 1000} с:`,
        (error as Error).message,
      )

      await sleep(delay)
    }
  }
}

async function ensureOkved() {
  const result = await pool.query<{
    count: string
  }>(
    `
      SELECT COUNT(*)::text AS count
      FROM okved
    `,
  )

  const count = Number(
    result.rows[0]?.count ?? 0,
  )

  if (count > 0) {
    console.log(
      `[okved] данные уже загружены: ${count} записей`,
    )

    return
  }

  console.log(
    '[okved] таблица пуста — запускаю импорт из CSV',
  )

  const imported = await importOkved()

  console.log(
    `[okved] автоматический импорт завершён: ${imported.total} записей, ${imported.leaves} конечных кодов`,
  )
}

async function main() {
  let stopping = false

  await runMigrations()
  await ensureOkved()

  const seeded = await seedMeasures()

  console.log(
    `[db] меры поддержки загружены из seed: ${seeded}`,
  )

  if (config.devAuthBypass) {
    console.warn(
      '[auth] ВНИМАНИЕ: включён DEV_AUTH_BYPASS (только для разработки)',
    )
  }

  const server = createApp().listen(
    config.port,
    '0.0.0.0',
    () => {
      console.log(
        `[api] слушает порт ${config.port} на 0.0.0.0`,
      )
    },
  )

  let bot:
    | ReturnType<typeof createBot>
    | undefined

  if (config.botToken) {
    bot = createBot(
      config.botToken,
      config.botUsername,
    )

    void startBotWithRetry(
      bot,
      () => stopping,
    )
  } else {
    console.warn(
      '[bot] MAX_BOT_TOKEN не задан — бот и проверка initData отключены',
    )
  }

  const shutdown = async (
    signal: string,
  ) => {
    console.log(
      `[app] ${signal}: останавливаюсь`,
    )

    stopping = true

    bot?.stopPolling()

    server.close()

    await pool.end()

    process.exit(0)
  }

  process.on('SIGTERM', () =>
    void shutdown('SIGTERM'),
  )

  process.on('SIGINT', () =>
    void shutdown('SIGINT'),
  )
}

main().catch((error) => {
  console.error(
    '[app] фатальная ошибка при старте:',
    error,
  )

  process.exit(1)
})