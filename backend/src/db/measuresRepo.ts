import { pool } from './pool.js';
import type { Measure } from '../domain/matching.js';

const COLUMNS = `
  id, slug, title, type, provider, level, summary, amount_text, conditions, documents,
  apply_url, source_url,
  to_char(verified_at, 'YYYY-MM-DD') AS verified_at,
  to_char(deadline_at, 'YYYY-MM-DD') AS deadline_at,
  is_rolling, is_demo, regions, forms, stages, industries, employees, needs`;

interface Row {
  id: number; slug: string; title: string; type: string; provider: string;
  level: 'federal' | 'regional'; summary: string; amount_text: string | null;
  conditions: string[]; documents: string[]; apply_url: string | null; source_url: string | null;
  verified_at: string | null; deadline_at: string | null; is_rolling: boolean; is_demo: boolean;
  regions: string[]; forms: string[]; stages: string[]; industries: string[];
  employees: string[]; needs: string[];
}

const toMeasure = (r: Row): Measure => ({
  id: r.id, slug: r.slug, title: r.title, type: r.type, provider: r.provider, level: r.level,
  summary: r.summary, amountText: r.amount_text, conditions: r.conditions, documents: r.documents,
  applyUrl: r.apply_url, sourceUrl: r.source_url, verifiedAt: r.verified_at, deadlineAt: r.deadline_at,
  isRolling: r.is_rolling, isDemo: r.is_demo, regions: r.regions, forms: r.forms, stages: r.stages,
  industries: r.industries, employees: r.employees, needs: r.needs,
});

export async function listActiveMeasures(): Promise<Measure[]> {
  const { rows } = await pool.query<Row>(`SELECT ${COLUMNS} FROM support_measures WHERE is_active`);
  return rows.map(toMeasure);
}

export async function getMeasureById(id: number): Promise<Measure | null> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM support_measures WHERE id = $1 AND is_active`,
    [id],
  );
  return rows[0] ? toMeasure(rows[0]) : null;
}
