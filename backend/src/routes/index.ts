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

api.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});


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


api.get('/profile', requireAuth, async (_req, res) => {
  const { userId } = getAuth(res);

  const { rows } = await pool.query(
    `
    SELECT
      region_id AS "regionId",
      business_form AS "businessForm",
      stage,
      okved_code AS "okvedCode",
      okved_name AS "okvedName",
      industry,
      employees,
      needs
    FROM business_profiles
    WHERE user_id = $1
    `,
    [userId],
  );

  res.json({ profile: rows[0] ?? null });
});


const summarize = (m: Measure) => ({
  id: m.id,
  title: m.title,
  type: m.type,
  provider: m.provider,
  level: m.level,
  summary: m.summary,
  amountText: m.amountText,
  deadlineAt: m.deadlineAt,
  isRolling: m.isRolling,
  isDemo: m.isDemo,
});

api.post('/match', requireAuth, async (req, res) => {
  const { userId } = getAuth(res);

  
  const input = profileSchema.parse(req.body);

  console.log('[match] input:', JSON.stringify(input, null, 2));

  
  const profile = {
    ...input,
    industry: industryFromOkved(input.okvedCode),
  };

  console.log('[match] profile:', JSON.stringify(profile, null, 2));

  
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
  );

  
  const measures = await listActiveMeasures();

  const items = matchMeasures(
    profile,
    measures,
  );

  
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
  );

  
  res.json({
    profile,

    total: items.length,

    items: items.map((item) => ({
      ...summarize(item.measure),
      score: item.score,
      reasons: item.reasons,
    })),
  });
});



api.get('/favorites', requireAuth, async (_req, res) => {
  const { userId } = getAuth(res);

  const { rows } = await pool.query(
    `
    SELECT
      sm.id,
      sm.title,
      sm.type,
      sm.provider,
      sm.level,
      sm.summary,
      sm.amount_text AS "amountText",
      sm.deadline_at AS "deadlineAt",
      sm.is_rolling AS "isRolling",
      sm.is_demo AS "isDemo"
    FROM favorites f
    INNER JOIN support_measures sm
      ON sm.id = f.measure_id
    WHERE f.user_id = $1
      AND sm.is_active = true
    ORDER BY f.created_at DESC
    `,
    [userId],
  );

  res.json({
    items: rows,
  });
});


api.post('/favorites/:measureId', requireAuth, async (req, res) => {
  const { userId } = getAuth(res);

  const measureId = Number(req.params.measureId);

  if (!Number.isInteger(measureId) || measureId <= 0) {
    throw new AppError(
      400,
      'bad_measure_id',
      'Некорректный идентификатор меры',
    );
  }

  const measure = await getMeasureById(measureId);

  if (!measure) {
    throw new AppError(
      404,
      'not_found',
      'Мера поддержки не найдена',
    );
  }

  await pool.query(
    `
    INSERT INTO favorites (
      user_id,
      measure_id
    )
    VALUES ($1, $2)
    ON CONFLICT (user_id, measure_id)
    DO NOTHING
    `,
    [userId, measureId],
  );

  res.json({
    success: true,
    measureId,
  });
});


api.delete('/favorites/:measureId', requireAuth, async (req, res) => {
  const { userId } = getAuth(res);

  const measureId = Number(req.params.measureId);

  if (!Number.isInteger(measureId) || measureId <= 0) {
    throw new AppError(
      400,
      'bad_measure_id',
      'Некорректный идентификатор меры',
    );
  }

  await pool.query(
    `
    DELETE FROM favorites
    WHERE user_id = $1
      AND measure_id = $2
    `,
    [userId, measureId],
  );

  res.json({
    success: true,
    measureId,
  });
});


api.get('/measures/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(
      400,
      'bad_id',
      'Некорректный идентификатор меры',
    );
  }

  const measure = await getMeasureById(id);

  if (!measure) {
    throw new AppError(
      404,
      'not_found',
      'Мера поддержки не найдена',
    );
  }

  const {
    slug: _slug,
    regions: _r,
    forms: _f,
    stages: _s,
    industries: _i,
    employees: _e,
    needs: _n,
    ...card
  } = measure;

  res.json(card);
});

api.use((_req, _res) => {
  throw new AppError(
    404,
    'not_found',
    'Метод API не найден',
  );
});