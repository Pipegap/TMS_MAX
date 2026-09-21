import {
  BUSINESS_FORMS, EMPLOYEES, INDUSTRIES, NEEDS, REGIONS, STAGES, labelOf,
} from './dictionaries.js';

export interface Profile {
  regionId: string;
  businessForm: string;
  stage: string;
  industry: string;
  employees: string;
  needs: string[];
}

export interface Measure {
  id: number;
  slug: string;
  title: string;
  type: string;
  provider: string;
  level: 'federal' | 'regional';
  summary: string;
  amountText: string | null;
  conditions: string[];
  documents: string[];
  applyUrl: string | null;
  sourceUrl: string | null;
  verifiedAt: string | null; // YYYY-MM-DD
  deadlineAt: string | null; // YYYY-MM-DD
  isRolling: boolean;
  isDemo: boolean;
  regions: string[];
  forms: string[];
  stages: string[];
  industries: string[];
  employees: string[];
  needs: string[];
}

export interface MatchItem {
  measure: Measure;
  score: number;
  reasons: string[];
}

export interface MatchOptions {
  /** YYYY-MM-DD; по умолчанию сегодня (UTC). Меры с прошедшим дедлайном исключаются. */
  today?: string;
  limit?: number;
}

/** Правило: пустой список ограничений у меры = «подходит всем». */
const allows = (restriction: string[], value: string) =>
  restriction.length === 0 || restriction.includes(value);

/**
 * Подбор в два шага (без LLM, объяснимо):
 * 1) жёсткие фильтры: регион, форма, стадия, отрасль, численность, дедлайн, пересечение по целям;
 * 2) скоринг: совпавшие цели весят больше всего, «узкие» (адресные) меры — выше «для всех».
 * Каждая мера возвращается с причинами — почему она подошла.
 */
export function matchMeasures(
  profile: Profile,
  measures: Measure[],
  options: MatchOptions = {},
): MatchItem[] {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const limit = options.limit ?? 5;
  const result: MatchItem[] = [];

  for (const m of measures) {
    if (m.deadlineAt && m.deadlineAt < today) continue;
    if (!allows(m.regions, profile.regionId)) continue;
    if (!allows(m.forms, profile.businessForm)) continue;
    if (!allows(m.stages, profile.stage)) continue;
    if (!allows(m.industries, profile.industry)) continue;
    if (!allows(m.employees, profile.employees)) continue;

    const needOverlap = m.needs.filter((n) => profile.needs.includes(n));
    if (profile.needs.length > 0 && m.needs.length > 0 && needOverlap.length === 0) continue;

    const reasons: string[] = [];
    let score = needOverlap.length * 3;

    if (needOverlap.length > 0) {
      reasons.push(`Соответствует цели: ${needOverlap.map((n) => labelOf(NEEDS, n)).join(', ')}`);
    }
    if (m.regions.length > 0) {
      score += 2;
      reasons.push(`Действует в регионе: ${labelOf(REGIONS, profile.regionId)}`);
    }
    if (m.forms.length > 0) {
      score += 1;
      reasons.push(`Для формы бизнеса: ${labelOf(BUSINESS_FORMS, profile.businessForm)}`);
    }
    if (m.stages.length > 0) {
      score += 1;
      reasons.push(`Стадия бизнеса: ${labelOf(STAGES, profile.stage)}`);
    }
    if (m.industries.length > 0) {
      score += 1;
      reasons.push(`Отрасль: ${labelOf(INDUSTRIES, profile.industry)}`);
    }
    if (m.employees.length > 0) {
      score += 1;
      reasons.push(`Численность: ${labelOf(EMPLOYEES, profile.employees)}`);
    }
    if (reasons.length === 0) reasons.push('Доступна без ограничений по региону, форме и стадии');

    result.push({ measure: m, score, reasons });
  }

  result.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.measure.deadlineAt ?? '9999-12-31';
    const db = b.measure.deadlineAt ?? '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    return a.measure.title.localeCompare(b.measure.title, 'ru');
  });

  return result.slice(0, limit);
}
