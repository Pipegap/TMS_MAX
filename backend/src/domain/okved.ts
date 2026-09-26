import { INDUSTRIES } from './dictionaries.js'

type IndustryId =
  (typeof INDUSTRIES)[number]['id']

/**
 * Определяет укрупнённую отрасль
 * по коду ОКВЭД.
 *
 * Это не заменяет официальный классификатор,
 * а используется только для демонстрационного
 * подбора мер поддержки.
 */
export function industryFromOkved(
  code: string,
): IndustryId {
  const normalized = code
    .trim()
    .replace(',', '.')

  /*
   * Получаем первые две цифры.
   *
   * Например:
   * 26.20.43 → 26
   * 47.11 → 47
   * 62.01 → 62
   */
  const section = Number(
    normalized.slice(0, 2),
  )

  /*
   * Сельское хозяйство,
   * лесное хозяйство,
   * рыболовство.
   */
  if (
    section >= 1 &&
    section <= 3
  ) {
    return 'agro'
  }

  /*
   * Производство.
   */
  if (
    section >= 10 &&
    section <= 33
  ) {
    return 'production'
  }

  /*
   * Строительство.
   */
  if (
    section >= 41 &&
    section <= 43
  ) {
    return 'construction'
  }

  /*
   * Оптовая и розничная торговля.
   */
  if (
    section >= 45 &&
    section <= 47
  ) {
    return 'trade'
  }

  /*
   * Общепит.
   */
  if (section === 56) {
    return 'food'
  }

  /*
   * Гостиницы и туристическая деятельность.
   *
   * 55 — размещение
   * 79 — туристические агентства
   */
  if (
    section === 55 ||
    section === 79
  ) {
    return 'tourism'
  }

  /*
   * IT и деятельность в области информации.
   *
   * 58 — издательская деятельность
   * 62 — разработка ПО
   * 63 — информационные услуги
   */
  if (
    section === 58 ||
    section === 62 ||
    section === 63
  ) {
    return 'it'
  }

  /*
   * Если код не попал в одну из
   * специализированных категорий,
   * считаем его услугами.
   *
   * Это лучше, чем возвращать "other",
   * потому что большое количество
   * сервисных мер рассчитано именно
   * на предпринимателей сферы услуг.
   */
  return 'services'
}