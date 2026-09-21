import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchMeasures, type Measure, type Profile } from './matching.js';

const base = {
  type: 'grant', provider: 'Тест', level: 'federal' as const, summary: 'x', amountText: null,
  conditions: [], documents: [], applyUrl: null, sourceUrl: null, verifiedAt: null,
  deadlineAt: null, isRolling: true, isDemo: true,
  regions: [], forms: [], stages: [], industries: [], employees: [], needs: [],
};
const m = (id: number, over: Partial<Measure>): Measure => ({ ...base, id, slug: `m${id}`, title: `Мера ${id}`, ...over });

const A = m(1, { regions: ['16'], forms: ['ip', 'self_employed'], stages: ['idea', 'lt1'], needs: ['money_start'] });
const B = m(2, { forms: ['ip', 'ooo'], stages: ['lt1', 'y1_3', 'gt3'], needs: ['equipment', 'money_growth'] });
const C = m(3, { needs: ['education'] });
const D = m(4, { needs: ['money_start'], deadlineAt: '2020-01-01' });
const E = m(5, { needs: ['money_start'], industries: ['agro'] });
const all = [A, B, C, D, E];

const profile: Profile = {
  regionId: '16', businessForm: 'ip', stage: 'lt1', industry: 'trade', employees: 'none', needs: ['money_start'],
};
const today = '2026-09-21';

test('возвращает только подходящие: фильтры по цели, дедлайну и отрасли', () => {
  const res = matchMeasures(profile, all, { today });
  assert.deepEqual(res.map((r) => r.measure.id), [1]);
  assert.ok(res[0]!.reasons.some((r) => r.includes('Республика Татарстан')));
  assert.ok(res[0]!.reasons.some((r) => r.includes('Деньги на запуск')));
});

test('региональная мера не показывается жителю другого региона', () => {
  assert.deepEqual(matchMeasures({ ...profile, regionId: '77' }, all, { today }), []);
});

test('несколько целей: адресная мера выше «для всех»', () => {
  const res = matchMeasures({ ...profile, needs: ['money_start', 'equipment'] }, all, { today });
  assert.deepEqual(res.map((r) => r.measure.id), [1, 2]);
  assert.ok(res[0]!.score > res[1]!.score);
});

test('отрасль совпала — мера с ограничением по отрасли проходит', () => {
  const res = matchMeasures({ ...profile, industry: 'agro' }, all, { today });
  assert.ok(res.some((r) => r.measure.id === 5));
});

test('мера без ограничений получает понятную причину, limit работает', () => {
  const res = matchMeasures({ ...profile, needs: ['education'] }, [C], { today });
  assert.equal(res.length, 1);
  assert.ok(res[0]!.reasons.length > 0);
  const many = Array.from({ length: 10 }, (_, i) => m(100 + i, { needs: ['education'] }));
  assert.equal(matchMeasures({ ...profile, needs: ['education'] }, many, { today, limit: 3 }).length, 3);
});
