import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.length ? issue.path.join('.') : '_';
      fields[key] ??= issue.message;
    }
    res.status(400).json({ error: { code: 'validation_error', message: 'Проверьте заполненные поля', fields } });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'bad_json', message: 'Некорректный JSON в запросе' } });
    return;
  }
  console.error('[api] необработанная ошибка:', err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Что-то пошло не так. Попробуйте ещё раз' } });
};
