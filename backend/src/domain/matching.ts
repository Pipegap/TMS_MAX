import {
  BUSINESS_FORMS,
  EMPLOYEES,
  INDUSTRIES,
  NEEDS,
  REGIONS,
  STAGES,
  labelOf,
} from './dictionaries.js'

export interface Profile {
  regionId: string
  businessForm: string
  stage: string

  okvedCode: string
  okvedName: string

  industry: string

  employees: string
  needs: string[]
}

export interface Measure {
  id: number
  slug: string
  title: string
  type: string
  provider: string
  level: 'federal' | 'regional'
  summary: string

  amountText: string | null

  conditions: string[]
  documents: string[]

  applyUrl: string | null
  sourceUrl: string | null

  verifiedAt: string | null
  deadlineAt: string | null

  isRolling: boolean
  isDemo: boolean

  regions: string[]
  forms: string[]
  stages: string[]
  industries: string[]
  employees: string[]
  needs: string[]
}

export interface MatchItem {
  measure: Measure
  score: number
  reasons: string[]
}

export interface MatchOptions {
  /**
   * YYYY-MM-DD.
   * По умолчанию используется сегодняшняя дата UTC.
   */
  today?: string

  /**
   * Максимальное количество результатов.
   */
  limit?: number
}

/**
 * Пустой список ограничений означает:
 * мера подходит всем.
 */
const allows = (
  restriction: string[],
  value: string,
): boolean => {
  return (
    restriction.length === 0 ||
    restriction.includes(value)
  )
}

/**
 * Подбор мер поддержки.
 *
 * Этап 1:
 * жёсткая фильтрация по:
 * - региону;
 * - форме бизнеса;
 * - стадии;
 * - отрасли;
 * - численности;
 * - сроку действия;
 * - целям пользователя.
 *
 * Этап 2:
 * рассчитывается score.
 *
 * ОКВЭД используется для определения industry,
 * но сам код ОКВЭД не используется как жёсткий фильтр,
 * пока в мерах поддержки нет отдельных ограничений
 * по конкретным кодам ОКВЭД.
 */
export function matchMeasures(
  profile: Profile,
  measures: Measure[],
  options: MatchOptions = {},
): MatchItem[] {
  const today =
    options.today ??
    new Date().toISOString().slice(0, 10)

  const limit = options.limit ?? 5

  const result: MatchItem[] = []

  for (const measure of measures) {
    /*
     * 1. Проверяем срок действия.
     */
    if (
      measure.deadlineAt &&
      measure.deadlineAt < today
    ) {
      continue
    }

    /*
     * 2. Регион.
     */
    if (
      !allows(
        measure.regions,
        profile.regionId,
      )
    ) {
      continue
    }

    /*
     * 3. Форма бизнеса.
     */
    if (
      !allows(
        measure.forms,
        profile.businessForm,
      )
    ) {
      continue
    }

    /*
     * 4. Стадия бизнеса.
     */
    if (
      !allows(
        measure.stages,
        profile.stage,
      )
    ) {
      continue
    }

    /*
     * 5. Отрасль.
     *
     * Она определяется автоматически из ОКВЭД.
     */
    if (
      !allows(
        measure.industries,
        profile.industry,
      )
    ) {
      continue
    }

    /*
     * 6. Количество сотрудников.
     */
    if (
      !allows(
        measure.employees,
        profile.employees,
      )
    ) {
      continue
    }

    /*
     * 7. Совпадение целей.
     */
    const needOverlap = measure.needs.filter(
      (need) =>
        profile.needs.includes(need),
    )

    /*
     * Если у меры есть конкретные цели,
     * но ни одна из них не совпала с целями пользователя,
     * такая мера исключается.
     *
     * Если needs у меры пустой —
     * она считается подходящей по цели всем.
     */
    if (
      profile.needs.length > 0 &&
      measure.needs.length > 0 &&
      needOverlap.length === 0
    ) {
      continue
    }

    /*
     * ================================
     * SCORE
     * ================================
     */

    const reasons: string[] = []

    /*
     * Совпадение целей имеет наибольший вес.
     */
    let score = needOverlap.length * 3

    if (needOverlap.length > 0) {
      reasons.push(
        `Соответствует цели: ${needOverlap
          .map((need) => labelOf(NEEDS, need))
          .join(', ')}`,
      )
    }

    if (measure.regions.length > 0) {
      score += 2

      reasons.push(
        `Действует в регионе: ${labelOf(
          REGIONS,
          profile.regionId,
        )}`,
      )
    }

    if (measure.forms.length > 0) {
      score += 1

      reasons.push(
        `Для формы бизнеса: ${labelOf(
          BUSINESS_FORMS,
          profile.businessForm,
        )}`,
      )
    }

    if (measure.stages.length > 0) {
      score += 1

      reasons.push(
        `Стадия бизнеса: ${labelOf(
          STAGES,
          profile.stage,
        )}`,
      )
    }

    if (measure.industries.length > 0) {
      score += 1

      reasons.push(
        `Отрасль: ${labelOf(
          INDUSTRIES,
          profile.industry,
        )}`,
      )
    }

    if (measure.employees.length > 0) {
      score += 1

      reasons.push(
        `Численность: ${labelOf(
          EMPLOYEES,
          profile.employees,
        )}`,
      )
    }

    if (reasons.length === 0) {
      reasons.push(
        'Доступна без ограничений по региону, форме и стадии',
      )
    }

    result.push({
      measure,
      score,
      reasons,
    })
  }

  /*
   * Сначала самые релевантные по score.
   *
   * При одинаковом score:
   * сначала меры с ближайшим дедлайном.
   *
   * Если дедлайн одинаковый —
   * сортируем по названию.
   */
  result.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }

    const deadlineA =
      a.measure.deadlineAt ?? '9999-12-31'

    const deadlineB =
      b.measure.deadlineAt ?? '9999-12-31'

    if (deadlineA !== deadlineB) {
      return deadlineA < deadlineB ? -1 : 1
    }

    return a.measure.title.localeCompare(
      b.measure.title,
      'ru',
    )
  })

  return result.slice(0, limit)
}