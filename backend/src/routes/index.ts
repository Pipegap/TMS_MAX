import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { getMeasureById, listActiveMeasures } from '../db/measuresRepo.js';
import { dictionaries, profileSchema } from '../domain/dictionaries.js';
import { matchMeasures, type Measure } from '../domain/matching.js';
import { AppError } from '../errors.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { industryFromOkved } from '../domain/okved.js';

export const api = Router();

// --- служебное (без авторизации) ---
api.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

// Справочники для анкеты: фронт берёт варианты ответов отсюда, а не хардкодит.
api.get('/dictionaries', (_req, res) => {
  res.json(dictionaries);
});

api.get('/okved', async (req, res) => {
  const query = z
    .string()
    .trim()
    .max(100)
    .parse(typeof req.query.query === 'string' ? req.query.query : '');

  if (!query) {
    return res.json({ items: [] });
  }

  const search = `%${query}%`;

  const { rows } = await pool.query<{
    code: string;
    name: string;
  }>(
    `
    SELECT
      code,
      name
    FROM okved
    WHERE is_leaf = true
      AND (
        code ILIKE $1
        OR name ILIKE $1
      )
    ORDER BY
      CASE
        WHEN code ILIKE $2 THEN 0
        WHEN name ILIKE $2 THEN 1
        ELSE 2
      END,
      code
    LIMIT 20
    `,
    [search, `${query}%`],
  );

  res.json({ items: rows });
});

// --- профиль ---
api.get('/profile', requireAuth, async (_req, res) => {
  const { userId } = getAuth(res);
  const { rows } = await pool.query(
    `SELECT region_id AS "regionId", business_form AS "businessForm", stage, okved_code as "okvedCode", okved_name as "okvedName", industry, employees, needs
       FROM business_profiles WHERE user_id = $1`,
    [userId],
  );
  res.json({ profile: rows[0] ?? null });
});

// --- подбор: сохраняет профиль, считает совпадения, пишет историю ---
const summarize = (m: Measure) => ({
  id: m.id, title: m.title, type: m.type, provider: m.provider, level: m.level,
  summary: m.summary, amountText: m.amountText, deadlineAt: m.deadlineAt,
  isRolling: m.isRolling, isDemo: m.isDemo,
});

api.post('/match', requireAuth, async (req, res) => {
  const { userId } = getAuth(res)

  /*
   * Получаем данные анкеты.
   *
   * industry здесь может отсутствовать —
   * отрасль определяем ниже автоматически
   * по выбранному ОКВЭД.
   */
  const input = profileSchema.parse(req.body)
  console.log('[match] input:', JSON.stringify(input, null, 2))
  

  /*
   * Определяем отрасль по ОКВЭД.
   *
   * Например:
   *
   * 26.20.43 → production
   * 47.11    → trade
   * 62.01    → it
   * 56.10    → food
   */
  const profile = {
    ...input,
    industry: industryFromOkved(
      input.okvedCode,
    ),
  }

  console.log('[match] profile:', JSON.stringify(profile, null, 2))
  /*
   * Сохраняем профиль пользователя.
   */
  await pool.query(
    `
      INSERT INTO business_profiles (
        user_id,
        region_id,
        business_form,
        stage,
        okved_code,
        okved_name,
        industry,
        employees,
        needs,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        now()
      )

      ON CONFLICT (user_id)
      DO UPDATE SET
        region_id = EXCLUDED.region_id,
        business_form = EXCLUDED.business_form,
        stage = EXCLUDED.stage,
        okved_code = EXCLUDED.okved_code,
        okved_name = EXCLUDED.okved_name,
        industry = EXCLUDED.industry,
        employees = EXCLUDED.employees,
        needs = EXCLUDED.needs,
        updated_at = now()
    `,
    [
      userId,
      profile.regionId,
      profile.businessForm,
      profile.stage,
      profile.okvedCode,
      profile.okvedName,
      profile.industry,
      profile.employees,
      profile.needs,
    ],
  )

  /*
   * Загружаем активные меры поддержки
   * и запускаем существующий алгоритм подбора.
   */
  const measures = await listActiveMeasures()

  const items = matchMeasures(
    profile,
    measures,
  )

  /*
   * Сохраняем результат подбора.
   */
  await pool.query(
    `
      INSERT INTO match_runs (
        user_id,
        profile_snapshot,
        result_ids
      )
      VALUES (
        $1,
        $2::jsonb,
        $3
      )
    `,
    [
      userId,
      JSON.stringify(profile),
      items.map(
        (item) => item.measure.id,
      ),
    ],
  )

  /*
   * Возвращаем результат фронтенду.
   */
  res.json({
    profile,

    total: items.length,

    items: items.map((item) => ({
      ...summarize(item.measure),
      score: item.score,
      reasons: item.reasons,
    })),
  })
})

// --- карточка меры ---
api.get('/measures/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'bad_id', 'Некорректный идентификатор меры');
  const measure = await getMeasureById(id);
  if (!measure) throw new AppError(404, 'not_found', 'Мера поддержки не найдена');
  const { slug: _slug, regions: _r, forms: _f, stages: _s, industries: _i, employees: _e, needs: _n, ...card } = measure;
  res.json(card);
});

api.use((_req, _res) => {
  throw new AppError(404, 'not_found', 'Метод API не найден');
});
