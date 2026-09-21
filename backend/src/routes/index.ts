import { Router } from 'express';
import { pool } from '../db/pool.js';
import { getMeasureById, listActiveMeasures } from '../db/measuresRepo.js';
import { dictionaries, profileSchema } from '../domain/dictionaries.js';
import { matchMeasures, type Measure } from '../domain/matching.js';
import { AppError } from '../errors.js';
import { getAuth, requireAuth } from '../middleware/auth.js';

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

// --- профиль ---
api.get('/profile', requireAuth, async (_req, res) => {
  const { userId } = getAuth(res);
  const { rows } = await pool.query(
    `SELECT region_id AS "regionId", business_form AS "businessForm", stage, industry, employees, needs
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
  const { userId } = getAuth(res);
  const profile = profileSchema.parse(req.body);

  await pool.query(
    `INSERT INTO business_profiles (user_id, region_id, business_form, stage, industry, employees, needs, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())
     ON CONFLICT (user_id) DO UPDATE SET
       region_id=EXCLUDED.region_id, business_form=EXCLUDED.business_form, stage=EXCLUDED.stage,
       industry=EXCLUDED.industry, employees=EXCLUDED.employees, needs=EXCLUDED.needs, updated_at=now()`,
    [userId, profile.regionId, profile.businessForm, profile.stage, profile.industry, profile.employees, profile.needs],
  );

  const items = matchMeasures(profile, await listActiveMeasures());

  await pool.query(
    'INSERT INTO match_runs (user_id, profile_snapshot, result_ids) VALUES ($1, $2::jsonb, $3)',
    [userId, JSON.stringify(profile), items.map((i) => i.measure.id)],
  );

  res.json({
    profile,
    total: items.length,
    items: items.map((i) => ({ ...summarize(i.measure), score: i.score, reasons: i.reasons })),
  });
});

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
