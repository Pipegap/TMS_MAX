import { Bot, Keyboard, type Context } from '@maxhub/max-bot-api';

const GREETING =
  'Привет! Я помогу найти меры поддержки, подходящие именно вашему бизнесу.\n\n' +
  'Ответьте на 6 коротких вопросов — покажу 2–5 подходящих мер с условиями, документами и сроками.';

export function createBot(token: string, botUsername?: string) {
  const bot = new Bot(token);

  const welcome = async (ctx: Context) => {
    if (!botUsername) {
      // Без username нельзя собрать кнопку открытия мини-приложения — не роняем бота, а честно сообщаем.
      await ctx.reply(`${GREETING}\n\n(Мини-приложение пока не настроено: задайте MAX_BOT_USERNAME.)`);
      return;
    }
    const keyboard = Keyboard.inlineKeyboard([[Keyboard.button.openApp('Подобрать меры поддержки', botUsername)]]);
    await ctx.reply(GREETING, { attachments: [keyboard] });
  };

  bot.on('bot_started', welcome);
  bot.command('start', welcome);

  bot.catch((err) => {
    console.error('[bot] ошибка обработчика:', err);
  });

  return bot;
}
