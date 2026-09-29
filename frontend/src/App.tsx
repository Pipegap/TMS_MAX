import { useEffect, useMemo, useState } from 'react'
import './App.css'

type MaxWebApp = {
  initData: string
  initDataUnsafe?: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
    }
  }
  platform?: string
  version?: string
  openLink?: (url: string) => void
}

declare global {
  interface Window {
    WebApp?: MaxWebApp
  }
}

type Dictionary = {
  regions: { id: string; label: string }[]
  businessForms: { id: string; label: string }[]
  stages: { id: string; label: string }[]
  industries: { id: string; label: string }[]
  employees: { id: string; label: string }[]
  needs: { id: string; label: string }[]
}

type OkvedItem = {
  code: string
  name: string
}

type Profile = {
  regionId: string
  businessForm: string
  stage: string
  okvedCode: string
  okvedName: string
  industry: string
  employees: string
  needs: string[]
}

type Measure = {
  id: number
  title: string
  type: string
  provider: string
  level: string
  summary: string
  amountText?: string | null
  deadlineAt?: string | null
  isRolling?: boolean
  isDemo?: boolean
  conditions?: string[]
  documents?: string[]
  applyUrl?: string | null
  sourceUrl?: string | null
  score?: number
  reasons?: string[]
}

type QuestionKey =
  | 'regionId'
  | 'businessForm'
  | 'stage'
  | 'okved'
  | 'employees'
  | 'needs'

type Question = {
  key: QuestionKey
  title: string
  description: string
  options: { id: string; label: string }[]
}

const DEV_USER_ID = '123456789'


const configuredApiUrl = import.meta.env.VITE_API_BASE_URL
  ?.trim()
  .replace(/\/+$/, '')

const API_BASE_URL = configuredApiUrl
  ? configuredApiUrl.endsWith('/api')
    ? configuredApiUrl
    : `${configuredApiUrl}/api`
  : import.meta.env.PROD
    ? 'https://tms-max.relaxdev.ru/api'
    : 'http://localhost:8000/api'

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/')
    ? path
    : `/${path}`

  return `${API_BASE_URL}${normalizedPath}`
}

function getAuthHeaders(): Record<string, string> {
  const initData = window.WebApp?.initData

  if (initData) {
    return {
      Authorization: `MaxWebApp ${initData}`,
    }
  }

  return {
    'x-dev-user-id': DEV_USER_ID,
  }
}

function formatDate(value?: string | null): string {
  if (!value) {
    return ''
  }

  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return value
  }

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
  )

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function cleanMeasureTitle(title: string): string {
  return title
    .replace(/^\s*\[ДЕМО\]\s*/i, '')
    .trim()
}

function formatMeasureType(type: string): string {
  const types: Record<string, string> = {
    grant: 'Грант',
    loan: 'Льготный заём',
    microfinance: 'Микрофинансирование',
    consultation: 'Консультация',
    education: 'Обучение',
    tax_benefit: 'Налоговая поддержка',
    subsidy: 'Субсидия',
    guarantee: 'Гарантийная поддержка',
    export: 'Поддержка экспорта',
    property: 'Имущественная поддержка',
    information: 'Информационная поддержка',
  }

  return types[type] ?? type
}

const emptyProfile: Profile = {
  regionId: '',
  businessForm: '',
  stage: '',
  okvedCode: '',
  okvedName: '',
  industry: '',
  employees: '',
  needs: [],
}

function App() {
  const [dictionaries, setDictionaries] =
    useState<Dictionary | null>(null)

  const [profile, setProfile] =
    useState<Profile>(emptyProfile)

  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)

  const [results, setResults] = useState<Measure[]>([])
  const [selectedMeasure, setSelectedMeasure] =
    useState<Measure | null>(null)

  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState('')

  const [favoriteIds, setFavoriteIds] =
    useState<number[]>([])

  const [favoriteMeasures, setFavoriteMeasures] =
    useState<Measure[]>([])

  const [favoriteLoading, setFavoriteLoading] =
    useState(false)

  const [favoritesOpen, setFavoritesOpen] =
    useState(false)

  const [okvedQuery, setOkvedQuery] = useState('')
  const [okvedResults, setOkvedResults] =
    useState<OkvedItem[]>([])
  const [okvedLoading, setOkvedLoading] =
    useState(false)

  const questions = useMemo<Question[]>(
    () => [
      {
        key: 'regionId',
        title: 'Где зарегистрирован ваш бизнес?',
        description:
          'Регион регистрации влияет на доступные меры поддержки.',
        options: dictionaries?.regions ?? [],
      },
      {
        key: 'businessForm',
        title: 'Как оформлен бизнес?',
        description:
          'Выберите организационно-правовую форму.',
        options: dictionaries?.businessForms ?? [],
      },
      {
        key: 'stage',
        title: 'На каком этапе находится бизнес?',
        description:
          'Это поможет подобрать программы для вашей текущей ситуации.',
        options: dictionaries?.stages ?? [],
      },
      {
        key: 'okved',
        title: 'Чем занимается ваш бизнес?',
        description:
          'Выберите основной вид деятельности по коду ОКВЭД.',
        options: [],
      },
      {
        key: 'employees',
        title: 'Сколько сотрудников работает в бизнесе?',
        description:
          'Количество сотрудников используется для отбора подходящих программ.',
        options: dictionaries?.employees ?? [],
      },
      {
        key: 'needs',
        title: 'Какая поддержка вам сейчас нужна?',
        description:
          'Можно выбрать одну или несколько задач, которые вы хотите решить.',
        options: dictionaries?.needs ?? [],
      },
    ],
    [dictionaries],
  )

  useEffect(() => {
    let cancelled = false

    const loadDictionaries = async () => {
      try {
        setLoading(true)
        setError('')

        const response = await fetch(
          apiUrl('/dictionaries'),
        )

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`,
          )
        }

        const data: Dictionary =
          await response.json()

        if (!cancelled) {
          setDictionaries(data)
        }
      } catch (requestError) {
        console.error(
          '[dictionaries]',
          requestError,
        )

        if (!cancelled) {
          setError(
            'Не удалось загрузить данные анкеты',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDictionaries()

    return () => {
      cancelled = true
    }
  }, [])

  const loadFavorites = async () => {
    try {
      const response = await fetch(
        apiUrl('/favorites'),
        {
          headers: getAuthHeaders(),
        },
      )

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`,
        )
      }

      const data: { items: Measure[] } =
        await response.json()

      setFavoriteMeasures(data.items)

      setFavoriteIds(
        data.items.map(
          (measure) => measure.id,
        ),
      )
    } catch (favoriteError) {
      console.error(
        '[favorites]',
        favoriteError,
      )
    }
  }

  useEffect(() => {
    void loadFavorites()
  }, [])

  const searchOkved = async (query: string) => {
    const value = query.trim()

    if (!value) {
      setOkvedResults([])
      setOkvedLoading(false)
      return
    }

    setOkvedLoading(true)

    try {
      const response = await fetch(
        apiUrl(
          `/okved?query=${encodeURIComponent(
            value,
          )}`,
        ),
      )

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`,
        )
      }

      const data: { items: OkvedItem[] } =
        await response.json()

      setOkvedResults(data.items)
    } catch (searchError) {
      console.error(
        '[okved]',
        searchError,
      )

      setOkvedResults([])
    } finally {
      setOkvedLoading(false)
    }
  }

  useEffect(() => {
    if (questions[step]?.key !== 'okved') {
      setOkvedResults([])
      return
    }

    const timer = window.setTimeout(() => {
      void searchOkved(okvedQuery)
    }, 300)

    return () => {
      window.clearTimeout(timer)
    }
  }, [okvedQuery, step, questions])

  const currentQuestion = questions[step]

  const currentValue =
    currentQuestion &&
    currentQuestion.key !== 'okved' &&
    currentQuestion.key !== 'needs'
      ? profile[currentQuestion.key]
      : ''

  const canContinue = currentQuestion
    ? currentQuestion.key === 'needs'
      ? profile.needs.length > 0
      : currentQuestion.key === 'okved'
        ? Boolean(profile.okvedCode)
        : Boolean(currentValue)
    : false

  const updateProfile = (
    key:
      | 'regionId'
      | 'businessForm'
      | 'stage'
      | 'employees',
    value: string,
  ) => {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const startMatching = () => {
    setStarted(true)
    setStep(0)
    setError('')
  }

  const nextStep = () => {
    if (!canContinue) {
      return
    }

    if (step < questions.length - 1) {
      setStep((current) => current + 1)
      return
    }

    void handleMatch()
  }

  const previousStep = () => {
    if (step > 0) {
      setStep((current) => current - 1)
    }
  }

  const handleMatch = async () => {
    setMatching(true)
    setError('')

    try {
      const response = await fetch(
        apiUrl('/match'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(profile),
        },
      )

      if (!response.ok) {
        const text = await response.text()

        console.error(
          '[match]',
          response.status,
          text,
        )

        throw new Error(
          `HTTP ${response.status}`,
        )
      }

      const data = await response.json()

      setResults(data.items ?? [])
      setSelectedMeasure(null)
      setStep(questions.length)
    } catch (matchError) {
      console.error(
        '[match]',
        matchError,
      )

      setError(
        'Не удалось подобрать меры поддержки. Попробуйте ещё раз.',
      )
    } finally {
      setMatching(false)
    }
  }

  const toggleFavorite = async (
    measureId: number,
  ) => {
    if (favoriteLoading) {
      return
    }

    const isFavorite =
      favoriteIds.includes(measureId)

    setFavoriteLoading(true)
    setError('')

    try {
      const response = await fetch(
        apiUrl(`/favorites/${measureId}`),
        {
          method: isFavorite
            ? 'DELETE'
            : 'POST',
          headers: getAuthHeaders(),
        },
      )

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`,
        )
      }

      await loadFavorites()
    } catch (favoriteError) {
      console.error(
        '[favorites]',
        favoriteError,
      )

      setError(
        'Не удалось изменить избранное. Попробуйте ещё раз.',
      )
    } finally {
      setFavoriteLoading(false)
    }
  }

  const openMeasure = async (
    measure: Measure,
  ) => {
    setDetailsLoading(true)
    setError('')

    try {
      const response = await fetch(
        apiUrl(`/measures/${measure.id}`),
        {
          headers: getAuthHeaders(),
        },
      )

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`,
        )
      }

      const details = await response.json()

      setSelectedMeasure({
        ...measure,
        ...details,
      })
    } catch (detailsError) {
      console.error(
        '[measure]',
        detailsError,
      )

      setError(
        'Не удалось загрузить информацию о мере поддержки.',
      )
    } finally {
      setDetailsLoading(false)
    }
  }

  const openApplyLink = () => {
    if (!selectedMeasure?.applyUrl) {
      setError(
        'Ссылка на оформление для этой меры пока не указана.',
      )
      return
    }

    const webApp = window.WebApp

    if (webApp?.openLink) {
      webApp.openLink(
        selectedMeasure.applyUrl,
      )
      return
    }

    window.open(
      selectedMeasure.applyUrl,
      '_blank',
      'noopener,noreferrer',
    )
  }

  const openSourceLink = () => {
    if (!selectedMeasure?.sourceUrl) {
      setError(
        'Официальный источник для этой меры пока не указан.',
      )
      return
    }

    const webApp = window.WebApp

    if (webApp?.openLink) {
      webApp.openLink(
        selectedMeasure.sourceUrl,
      )
      return
    }

    window.open(
      selectedMeasure.sourceUrl,
      '_blank',
      'noopener,noreferrer',
    )
  }

  const selectOkved = (
    item: OkvedItem,
  ) => {
    setProfile((current) => ({
      ...current,
      okvedCode: item.code,
      okvedName: item.name,
    }))

    setOkvedQuery('')
    setOkvedResults([])
  }

  const clearOkved = () => {
    setProfile((current) => ({
      ...current,
      okvedCode: '',
      okvedName: '',
    }))

    setOkvedQuery('')
    setOkvedResults([])
  }

  const restart = () => {
    setResults([])
    setSelectedMeasure(null)
    setStep(0)
    setStarted(true)

    setOkvedQuery('')
    setOkvedResults([])
    setOkvedLoading(false)

    setError('')
  }

  const progress = Math.round(
    ((Math.min(
      step,
      questions.length - 1,
    ) +
      1) /
      questions.length) *
      100,
  )

  if (loading) {
    return (
      <div className="app-shell">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Загружаем сервис</p>
        </div>
      </div>
    )
  }

  if (error && !dictionaries) {
    return (
      <div className="app-shell">
        <main className="error-screen">
          <div className="error-card">
            <span className="eyebrow">
              Ошибка
            </span>

            <h1>
              Не удалось загрузить сервис
            </h1>

            <p>{error}</p>

            <button
              className="primary-button"
              onClick={() =>
                window.location.reload()
              }
            >
              Попробовать снова
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (
    favoritesOpen &&
    !selectedMeasure
  ) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              М
            </div>

            <span>
              Меры поддержки
            </span>
          </div>
        </header>

        <main className="page results-page">
          <div className="results-heading">
            <div>
              <span className="eyebrow">
                Сохранённые меры
              </span>

              <h1>Избранное</h1>

              <p>
                Здесь будут меры поддержки,
                которые вы сохранили для
                дальнейшего просмотра.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() =>
                setFavoritesOpen(false)
              }
            >
              ← Назад
            </button>
          </div>

          {favoriteMeasures.length > 0 ? (
            <div className="results-list">
              {favoriteMeasures.map(
                (
                  measure,
                  index,
                ) => (
                  <article
                    className="measure-card"
                    key={measure.id}
                  >
                    <div className="measure-number">
                      {String(
                        index + 1,
                      ).padStart(2, '0')}
                    </div>

                    <div className="measure-content">
                      <div className="measure-top">
                        <span className="measure-type">
                          {formatMeasureType(
                            measure.type,
                          )}
                        </span>

                        {measure.amountText && (
                          <span className="measure-amount">
                            {
                              measure.amountText
                            }
                          </span>
                        )}
                      </div>

                      <h2>
                        {cleanMeasureTitle(
                          measure.title,
                        )}
                      </h2>

                      <p>
                        {measure.summary}
                      </p>

                      <button
                        className="measure-link"
                        onClick={() =>
                          void openMeasure(
                            measure,
                          )
                        }
                      >
                        Подробнее
                        <span>→</span>
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                ☆
              </div>

              <h2>
                В избранном пока ничего нет
              </h2>

              <p>
                Откройте подходящую меру
                поддержки и сохраните её,
                чтобы вернуться к ней позже.
              </p>

              <button
                className="primary-button"
                onClick={() =>
                  setFavoritesOpen(false)
                }
              >
                Вернуться к подбору
              </button>
            </div>
          )}
        </main>

        {detailsLoading && (
          <div className="modal-loader">
            <div className="loading-spinner" />
          </div>
        )}

        {error && (
          <div className="toast">
            {error}

            <button
              onClick={() => setError('')}
            >
              ×
            </button>
          </div>
        )}
      </div>
    )
  }

  if (selectedMeasure) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              М
            </div>

            <span>
              Меры поддержки
            </span>
          </div>
        </header>

        <main className="page detail-page">
          <button
            className="back-link"
            onClick={() =>
              setSelectedMeasure(null)
            }
          >
            ← Назад
          </button>

          <div className="detail-layout">
            <article className="detail-card">
              <div className="detail-header">
                <div>
                  <span className="eyebrow">
                    {formatMeasureType(
                      selectedMeasure.type,
                    )}
                  </span>

                  <h1>
                    {cleanMeasureTitle(
                      selectedMeasure.title,
                    )}
                  </h1>
                </div>

                {selectedMeasure.amountText && (
                  <div className="amount">
                    {
                      selectedMeasure.amountText
                    }
                  </div>
                )}
              </div>

              <p className="detail-summary">
                {selectedMeasure.summary}
              </p>

              {selectedMeasure.reasons &&
                selectedMeasure.reasons.length >
                  0 && (
                  <section className="detail-section">
                    <h2>
                      Почему подходит вам
                    </h2>

                    <div className="reason-list">
                      {selectedMeasure.reasons.map(
                        (reason) => (
                          <div
                            className="reason"
                            key={reason}
                          >
                            <span className="check">
                              -
                            </span>

                            <span>
                              {reason}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                )}

              {selectedMeasure.conditions &&
                selectedMeasure.conditions.length >
                  0 && (
                  <section className="detail-section">
                    <h2>
                      Основные условия
                    </h2>

                    <div className="detail-list">
                      {selectedMeasure.conditions.map(
                        (
                          condition,
                          index,
                        ) => (
                          <div
                            className="detail-list-item"
                            key={`${condition}-${index}`}
                          >
                            <span className="list-marker">
                              -
                            </span>

                            <span>
                              {condition}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                )}

              {selectedMeasure.documents &&
                selectedMeasure.documents.length >
                  0 && (
                  <section className="detail-section">
                    <h2>
                      Необходимые документы
                    </h2>

                    <div className="detail-list">
                      {selectedMeasure.documents.map(
                        (
                          document,
                          index,
                        ) => (
                          <div
                            className="detail-list-item"
                            key={`${document}-${index}`}
                          >
                            <span className="list-marker">
                              -
                            </span>

                            <span>
                              {document}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                )}

              <section className="detail-section">
                <h2>
                  Основная информация
                </h2>

                <div className="info-grid">
                  <div className="info-item">
                    <span>
                      Вид поддержки
                    </span>

                    <strong>
                      {formatMeasureType(
                        selectedMeasure.type,
                      )}
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>
                      Организация
                    </span>

                    <strong>
                      {
                        selectedMeasure.provider
                      }
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>
                      Уровень поддержки
                    </span>

                    <strong>
                      {selectedMeasure.level ===
                      'federal'
                        ? 'Федеральный'
                        : 'Региональный'}
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>
                      Срок
                    </span>

                    <strong>
                      {selectedMeasure.isRolling
                        ? 'Приём постоянно'
                        : selectedMeasure.deadlineAt
                          ? `До ${formatDate(
                              selectedMeasure.deadlineAt,
                            )}`
                          : 'Уточняется'}
                    </strong>
                  </div>
                </div>
              </section>

              <div className="detail-actions">
                <button
                  className="secondary-button"
                  onClick={() =>
                    void toggleFavorite(
                      selectedMeasure.id,
                    )
                  }
                  disabled={favoriteLoading}
                >
                  {favoriteIds.includes(
                    selectedMeasure.id,
                  )
                    ? '★ В избранном'
                    : '☆ В избранное'}
                </button>

                {selectedMeasure.applyUrl ? (
                  <button
                    className="primary-button"
                    onClick={openApplyLink}
                  >
                    Перейти к оформлению
                    <span>↗</span>
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    disabled
                  >
                    Ссылка на оформление
                    не указана
                  </button>
                )}

                {selectedMeasure.sourceUrl && (
                  <button
                    className="secondary-button"
                    onClick={openSourceLink}
                  >
                    Официальная информация
                    <span>↗</span>
                  </button>
                )}

                <button
                  className="secondary-button"
                  onClick={() =>
                    setSelectedMeasure(null)
                  }
                >
                  Вернуться к мерам
                </button>
              </div>
            </article>
          </div>
        </main>

        {error && (
          <div className="toast">
            {error}

            <button
              onClick={() => setError('')}
            >
              ×
            </button>
          </div>
        )}
      </div>
    )
  }

  if (step === questions.length) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              М
            </div>

            <span>
              Меры поддержки
            </span>
          </div>

          <button
            className="topbar-back"
            onClick={() =>
              setFavoritesOpen(true)
            }
          >
            Избранное

            {favoriteMeasures.length >
              0 && (
              <span>
                {favoriteMeasures.length}
              </span>
            )}
          </button>
        </header>

        <main className="page results-page">
          <div className="results-heading">
            <div>
              <span className="eyebrow">
                Результат подбора
              </span>

              <h1>
                {results.length > 0
                  ? 'Подходящие меры поддержки'
                  : 'Подходящих мер не найдено'}
              </h1>

              <p>
                {results.length > 0
                  ? `Для вашего бизнеса найдено ${
                      results.length
                    } ${
                      results.length === 1
                        ? 'подходящее решение'
                        : 'подходящих решений'
                    }.`
                  : 'Попробуйте изменить параметры анкеты — это может расширить список доступных программ.'}
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={restart}
            >
              Изменить параметры
            </button>
          </div>

          {results.length > 0 ? (
            <div className="results-list">
              {results.map(
                (
                  measure,
                  index,
                ) => (
                  <article
                    className="measure-card"
                    key={measure.id}
                  >
                    <div className="measure-number">
                      {String(
                        index + 1,
                      ).padStart(2, '0')}
                    </div>

                    <div className="measure-content">
                      <div className="measure-top">
                        <span className="measure-type">
                          {formatMeasureType(
                            measure.type,
                          )}
                        </span>

                        {measure.amountText && (
                          <span className="measure-amount">
                            {
                              measure.amountText
                            }
                          </span>
                        )}
                      </div>

                      <h2>
                        {cleanMeasureTitle(
                          measure.title,
                        )}
                      </h2>

                      <p>
                        {measure.summary}
                      </p>

                      {measure.reasons &&
                        measure.reasons.length >
                          0 && (
                          <div className="compact-reasons">
                            {measure.reasons
                              .slice(0, 3)
                              .map(
                                (
                                  reason,
                                ) => (
                                  <span
                                    key={
                                      reason
                                    }
                                  >
                                    {reason}
                                  </span>
                                ),
                              )}
                          </div>
                        )}

                      <button
                        className="measure-link"
                        onClick={() =>
                          void openMeasure(
                            measure,
                          )
                        }
                      >
                        Подробнее
                        <span>→</span>
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                ⌕
              </div>

              <h2>
                Попробуем найти другие
                варианты
              </h2>

              <p>
                Измените регион, цель или
                другие параметры бизнеса и
                повторите подбор.
              </p>

              <button
                className="primary-button"
                onClick={restart}
              >
                Изменить параметры
              </button>
            </div>
          )}
        </main>

        {detailsLoading && (
          <div className="modal-loader">
            <div className="loading-spinner" />
          </div>
        )}

        {error && (
          <div className="toast">
            {error}

            <button
              onClick={() => setError('')}
            >
              ×
            </button>
          </div>
        )}
      </div>
    )
  }

  if (!started) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              М
            </div>

            <span>
              Меры поддержки
            </span>
          </div>

          <button
            className="topbar-back"
            onClick={() =>
              setFavoritesOpen(true)
            }
          >
            Избранное

            {favoriteMeasures.length >
              0 && (
              <span>
                {favoriteMeasures.length}
              </span>
            )}
          </button>
        </header>

        <main className="page welcome-page">
          <section className="welcome-card">
            <div className="welcome-content">
              <span className="eyebrow">
                Подбор поддержки
              </span>

              <h1>
                Подберём меры поддержки
                <br />
                для вашего бизнеса
              </h1>

              <p className="welcome-description">
                Не знаете, какая поддержка
                вам подходит? Ответьте на
                несколько вопросов — сервис
                подберёт программы с учётом
                региона, формы бизнеса,
                отрасли и ваших целей.
              </p>

              <div className="welcome-features">
                <div className="welcome-feature">
                  <span className="welcome-feature-icon">
                    01
                  </span>

                  <div>
                    <strong>
                      Ответьте на вопросы
                    </strong>

                    <span>
                      Расскажите немного о
                      своём бизнесе
                    </span>
                  </div>
                </div>

                <div className="welcome-feature">
                  <span className="welcome-feature-icon">
                    02
                  </span>

                  <div>
                    <strong>
                      Получите подборку
                    </strong>

                    <span>
                      Мы найдём подходящие
                      программы
                    </span>
                  </div>
                </div>

                <div className="welcome-feature">
                  <span className="welcome-feature-icon">
                    03
                  </span>

                  <div>
                    <strong>
                      Изучите условия
                    </strong>

                    <span>
                      Посмотрите подробности
                      каждой меры
                    </span>
                  </div>
                </div>
              </div>

              <button
                className="primary-button welcome-button"
                onClick={startMatching}
              >
                Начать подбор
              </button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            М
          </div>

          <span>
            Меры поддержки
          </span>
        </div>

        <button
          className="topbar-back"
          onClick={() =>
            setFavoritesOpen(true)
          }
        >
          Избранное

          {favoriteMeasures.length >
            0 && (
            <span>
              {favoriteMeasures.length}
            </span>
          )}
        </button>
      </header>

      <main className="page questionnaire-page">
        <div className="questionnaire-header">
          <div>
            <span className="eyebrow">
              Подбор поддержки
            </span>

            <h1>
              Найдём подходящие меры
              <br />
              для вашего бизнеса
            </h1>

            <p>
              Ответьте на несколько вопросов.
              Мы подберём программы,
              соответствующие параметрам
              вашего бизнеса.
            </p>
          </div>
        </div>

        <div className="progress-block">
          <div className="progress-info">
            <span>
              Вопрос {step + 1} из{' '}
              {questions.length}
            </span>

            <span>{progress}%</span>
          </div>

          <div className="progress-track">
            <div
              className="progress-value"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>

        {currentQuestion && (
          <section className="question-card">
            <div className="question-card-header">
              <span className="question-number">
                {String(
                  step + 1,
                ).padStart(2, '0')}
              </span>

              <div>
                <h2>
                  {currentQuestion.title}
                </h2>

                <p>
                  {
                    currentQuestion.description
                  }
                </p>
              </div>
            </div>

            {currentQuestion.key ===
            'okved' ? (
              <div className="okved-selector">
                {profile.okvedCode ? (
                  <div className="okved-selected">
                    <div className="okved-selected-content">
                      <div className="okved-selected-code">
                        {profile.okvedCode}
                      </div>

                      <div className="okved-selected-name">
                        {profile.okvedName}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="okved-clear"
                      onClick={
                        clearOkved
                      }
                      aria-label="Изменить ОКВЭД"
                    >
                      Изменить
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="okved-search">
                      <input
                        type="text"
                        value={
                          okvedQuery
                        }
                        onChange={(
                          event,
                        ) =>
                          setOkvedQuery(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Введите название или код деятельности"
                        className="okved-input"
                        autoComplete="off"
                      />

                      {okvedLoading && (
                        <span className="okved-search-loading" />
                      )}
                    </div>

                    {!okvedQuery.trim() && (
                      <div className="okved-hint">
                        Например: розничная
                        торговля или{' '}
                        <strong>
                          47.11
                        </strong>
                      </div>
                    )}

                    {okvedQuery.trim() &&
                      !okvedLoading &&
                      okvedResults.length ===
                        0 && (
                        <div className="okved-empty">
                          По вашему
                          запросу ничего
                          не найдено.
                          <br />
                          Попробуйте
                          ввести другой
                          код или
                          название.
                        </div>
                      )}

                    {okvedResults.length >
                      0 && (
                      <div className="okved-results">
                        {okvedResults.map(
                          (item) => (
                            <button
                              key={
                                item.code
                              }
                              type="button"
                              className="okved-result"
                              onClick={() =>
                                selectOkved(
                                  item,
                                )
                              }
                            >
                              <span className="okved-code">
                                {
                                  item.code
                                }
                              </span>

                              <span className="okved-name">
                                {
                                  item.name
                                }
                              </span>
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="options">
                {currentQuestion.options.map(
                  (option) => {
                    const optionId =
                      String(option.id)

                    const optionLabel =
                      String(
                        option.label,
                      )

                    const selected =
                      currentQuestion.key ===
                      'needs'
                        ? profile.needs.includes(
                            optionId,
                          )
                        : currentValue ===
                          optionId

                    return (
                      <button
                        key={optionId}
                        type="button"
                        className={`option ${
                          selected
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => {
                          if (
                            currentQuestion.key ===
                            'needs'
                          ) {
                            setProfile(
                              (
                                current,
                              ) => ({
                                ...current,
                                needs:
                                  current.needs.includes(
                                    optionId,
                                  )
                                    ? current.needs.filter(
                                        (
                                          id,
                                        ) =>
                                          id !==
                                          optionId,
                                      )
                                    : [
                                        ...current.needs,
                                        optionId,
                                      ],
                              }),
                            )
                          } else if (
                            currentQuestion.key !==
                            'okved'
                          ) {
                            updateProfile(
                              currentQuestion.key,
                              optionId,
                            )
                          }
                        }}
                      >
                        <span>
                          {optionLabel}
                        </span>

                        <span className="option-check">
                          {selected && '✓'}
                        </span>
                      </button>
                    )
                  },
                )}
              </div>
            )}
          </section>
        )}

        <div className="question-actions">
          <button
            className="secondary-button"
            onClick={previousStep}
            disabled={step === 0}
          >
            ← Назад
          </button>

          <button
            className="primary-button"
            onClick={nextStep}
            disabled={
              !canContinue || matching
            }
          >
            {matching
              ? 'Подбираем...'
              : step ===
                  questions.length - 1
                ? 'Подобрать меры'
                : 'Продолжить'}

            {!matching && (
              <span>→</span>
            )}
          </button>
        </div>
      </main>

      {error && (
        <div className="toast">
          {error}

          <button
            onClick={() => setError('')}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

export default App