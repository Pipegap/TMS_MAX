import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { pool } from './pool.js';
import {
  BUSINESS_FORMS, EMPLOYEES, INDUSTRIES, MEASURE_TYPES, NEEDS, REGIONS, STAGES, idsOf,
} from '../domain/dictionaries.js';

const SEED_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/measures.seed.json');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'формат даты YYYY-MM-DD').nullable();
const url = z.string().url().nullable();

// Строгая схема: опечатка в датасете (неверный id региона, битая дата) падает сразу с понятным сообщением.
const seedSchema = z.array(
  z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/, 'slug: только a-z, 0-9 и дефис'),
    title: z.string().min(3),
    type: z.enum(idsOf(MEASURE_TYPES)),
    provider: z.string().min(2),
    level: z.enum(['federal', 'regional']),
    summary: z.string().min(10),
    amount_text: z.string().nullable(),
    conditions: z.array(z.string()),
    documents: z.array(z.string()),
    apply_url: url,
    source_url: url,
    verified_at: date,
    deadline_at: date,
    is_rolling: z.boolean(),
    is_demo: z.boolean(),
    regions: z.array(z.enum(idsOf(REGIONS))),
    forms: z.array(z.enum(idsOf(BUSINESS_FORMS))),
    stages: z.array(z.enum(idsOf(STAGES))),
    industries: z.array(z.enum(idsOf(INDUSTRIES))),
    employees: z.array(z.enum(idsOf(EMPLOYEES))),
    needs: z.array(z.enum(idsOf(NEEDS))),
  }),
);

export async function seedMeasures(): Promise<number> {
  const parsed = seedSchema.safeParse(JSON.parse(await readFile(SEED_FILE, 'utf8')));
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Некорректный measures.seed.json — ${details}`);
  }
  const items = parsed.data;
  const slugs = items.map((i) => i.slug);
  if (new Set(slugs).size !== slugs.length) throw new Error('measures.seed.json: повторяющиеся slug');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const m of items) {
      await client.query(
        `INSERT INTO support_measures
           (slug, title, type, provider, level, summary, amount_text, conditions, documents,
            apply_url, source_url, verified_at, deadline_at, is_rolling, is_demo, is_active,
            regions, forms, stages, industries, employees, needs, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,true,
                 $16,$17,$18,$19,$20,$21, now())
         ON CONFLICT (slug) DO UPDATE SET
           title=EXCLUDED.title, type=EXCLUDED.type, provider=EXCLUDED.provider, level=EXCLUDED.level,
           summary=EXCLUDED.summary, amount_text=EXCLUDED.amount_text, conditions=EXCLUDED.conditions,
           documents=EXCLUDED.documents, apply_url=EXCLUDED.apply_url, source_url=EXCLUDED.source_url,
           verified_at=EXCLUDED.verified_at, deadline_at=EXCLUDED.deadline_at, is_rolling=EXCLUDED.is_rolling,
           is_demo=EXCLUDED.is_demo, is_active=true, regions=EXCLUDED.regions, forms=EXCLUDED.forms,
           stages=EXCLUDED.stages, industries=EXCLUDED.industries, employees=EXCLUDED.employees,
           needs=EXCLUDED.needs, updated_at=now()`,
        [
          m.slug, m.title, m.type, m.provider, m.level, m.summary, m.amount_text,
          JSON.stringify(m.conditions), JSON.stringify(m.documents),
          m.apply_url, m.source_url, m.verified_at, m.deadline_at, m.is_rolling, m.is_demo,
          m.regions, m.forms, m.stages, m.industries, m.employees, m.needs,
        ],
      );
    }
    await client.query(
      'UPDATE support_measures SET is_active = false WHERE slug <> ALL($1::text[]) AND is_active',
      [slugs],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return items.length;
}
