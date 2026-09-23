import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Dictionary = {
  regions: { id: string; label: string }[]
  businessForms: { id: string; label: string }[]
  stages: { id: string; label: string }[]
  industries: { id: string; label: string }[]
  employees: { id: string; label: string }[]
  needs: { id: string; label: string }[]
}

type Profile = {
  regionId: string
  businessForm: string
  stage: string
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
  score?: number
  reasons?: string[]
}

const DEV_USER_ID = '123456789'

const emptyProfile: Profile = {
  regionId: '',
  businessForm: '',
  stage: '',
  industry: '',
  employees: '',
  needs: [],
}

function App() {
  const [dictionaries, setDictionaries] = useState<Dictionary | null>(null)
  const [profile, setProfile] = useState<Profile>(emptyProfile)

  const [step, setStep] = useState(0)
  const [results, setResults] = useState<Measure[]>([])
  const [selectedMeasure, setSelectedMeasure] = useState<Measure | null>(null)

  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState('')

  const questions = useMemo(
    () => [
      {
        key: 'regionId' as const,
        title: 'Где зарегистрирован ваш бизнес?',
        description: 'Регион регистрации влияет на доступные меры поддержки.',
        options: dictionaries?.regions ?? [],
      },
      {
        key: 'businessForm' as const,
        title: 'Как оформлен бизнес?',
        description: 'Выберите организационно-правовую форму.',
        options: dictionaries?.businessForms ?? [],
      },
      {
        key: 'stage' as const,
        title: 'На каком этапе находится бизнес?',
        description: 'Это поможет подобрать программы для вашей текущей ситуации.',
        options: dictionaries?.stages ?? [],
      },
      {
        key: 'industry' as const,
        title: 'Чем занимается ваш бизнес?',
        description: 'Укажите основное направление деятельности.',
        options: dictionaries?.industries ?? [],
      },
      {
        key: 'employees' as const,
        title: 'Сколько сотрудников работает в бизнесе?',
        description: 'Количество сотрудников используется для отбора подходящих программ.',
        options: dictionaries?.employees ?? [],
      },
      {
        key: 'needs' as const,
        title: 'Какая поддержка вам сейчас нужна?',
        description: 'Можно выбрать основную задачу, которую вы хотите решить.',
        options: dictionaries?.needs ?? [],
      },
    ],
    [dictionaries],
  )

  useEffect(() => {
    fetch('/api/dictionaries')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Не удалось загрузить справочники')
        }

        return response.json()
      })
      .then((data) => setDictionaries(data))
      .catch(() => setError('Не удалось загрузить данные анкеты'))
      .finally(() => setLoading(false))
  }, [])

  const currentQuestion = questions[step]

  const currentValue = currentQuestion
    ? profile[currentQuestion.key]
    : ''

  const canContinue = currentQuestion
    ? currentQuestion.key === 'needs'
      ? profile.needs.length > 0
      : Boolean(profile[currentQuestion.key])
    : false

  const updateProfile = (key: keyof Profile, value: string) => {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const nextStep = () => {
    if (!canContinue) return

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
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-user-id': DEV_USER_ID,
        },
        body: JSON.stringify(profile),
      })

      if (!response.ok) {
        throw new Error('Не удалось выполнить подбор')
      }

      const data = await response.json()

      setResults(data.items ?? [])
      setSelectedMeasure(null)
      setStep(questions.length)
    } catch {
      setError('Не удалось подобрать меры поддержки. Попробуйте ещё раз.')
    } finally {
      setMatching(false)
    }
  }

  const openMeasure = async (measure: Measure) => {
    setDetailsLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/measures/${measure.id}`, {
        headers: {
          'x-dev-user-id': DEV_USER_ID,
        },
      })

      if (!response.ok) {
        throw new Error('Не удалось загрузить карточку')
      }

      const details = await response.json()

      setSelectedMeasure({
        ...measure,
        ...details,
      })
    } catch {
      setError('Не удалось загрузить информацию о мере поддержки.')
    } finally {
      setDetailsLoading(false)
    }
  }

  const restart = () => {
    setProfile(emptyProfile)
    setResults([])
    setSelectedMeasure(null)
    setStep(0)
    setError('')
  }

  const progress = Math.round(
    ((Math.min(step, questions.length - 1) + 1) / questions.length) * 100,
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
            <span className="eyebrow">Ошибка</span>
            <h1>Не удалось загрузить сервис</h1>
            <p>{error}</p>
            <button className="primary-button" onClick={() => window.location.reload()}>
              Попробовать снова
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (selectedMeasure) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">М</div>
            <span>Меры поддержки</span>
          </div>
        </header>

        <main className="page detail-page">
          <button className="back-link" onClick={() => setSelectedMeasure(null)}>
            ← Назад к результатам
          </button>

          <div className="detail-layout">
            <article className="detail-card">
              <div className="detail-header">
                <div>
                  <span className="eyebrow">{selectedMeasure.type}</span>
                  <h1>{selectedMeasure.title}</h1>
                </div>

                {selectedMeasure.amountText && (
                  <div className="amount">
                    {selectedMeasure.amountText}
                  </div>
                )}
              </div>

              <p className="detail-summary">
                {selectedMeasure.summary}
              </p>

              {selectedMeasure.reasons && selectedMeasure.reasons.length > 0 && (
                <section className="detail-section">
                  <h2>Почему подходит вам</h2>

                  <div className="reason-list">
                    {selectedMeasure.reasons.map((reason) => (
                      <div className="reason" key={reason}>
                        <span className="check">✓</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="detail-section">
                <h2>Основные условия</h2>

                <div className="info-grid">
                  <div className="info-item">
                    <span>Организация</span>
                    <strong>{selectedMeasure.provider}</strong>
                  </div>

                  <div className="info-item">
                    <span>Уровень поддержки</span>
                    <strong>
                      {selectedMeasure.level === 'federal'
                        ? 'Федеральный'
                        : 'Региональный'}
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>Срок</span>
                    <strong>
                      {selectedMeasure.isRolling
                        ? 'Приём постоянно'
                        : selectedMeasure.deadlineAt
                          ? `До ${selectedMeasure.deadlineAt}`
                          : 'Уточняется'}
                    </strong>
                  </div>
                </div>
              </section>

              <div className="detail-actions">
                <button className="primary-button">
                  Перейти к оформлению
                  <span>↗</span>
                </button>

                <button
                  className="secondary-button"
                  onClick={() => setSelectedMeasure(null)}
                >
                  Вернуться к мерам
                </button>
              </div>
            </article>
          </div>
        </main>
      </div>
    )
  }

  if (step === questions.length) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">М</div>
            <span>Меры поддержки</span>
          </div>
        </header>

        <main className="page results-page">
          <div className="results-heading">
            <div>
              <span className="eyebrow">Результат подбора</span>
              <h1>
                {results.length > 0
                  ? 'Подходящие меры поддержки'
                  : 'Подходящих мер не найдено'}
              </h1>

              <p>
                {results.length > 0
                  ? `Для вашего бизнеса найдено ${results.length} ${results.length === 1 ? 'подходящее решение' : 'подходящих решений'}.`
                  : 'Попробуйте изменить параметры анкеты — это может расширить список доступных программ.'}
              </p>
            </div>

            <button className="secondary-button" onClick={restart}>
              Изменить параметры
            </button>
          </div>

          {results.length > 0 ? (
            <div className="results-list">
              {results.map((measure, index) => (
                <article className="measure-card" key={measure.id}>
                  <div className="measure-number">
                    {String(index + 1).padStart(2, '0')}
                  </div>

                  <div className="measure-content">
                    <div className="measure-top">
                      <span className="measure-type">{measure.type}</span>

                      {measure.amountText && (
                        <span className="measure-amount">
                          {measure.amountText}
                        </span>
                      )}
                    </div>

                    <h2>{measure.title}</h2>

                    <p>{measure.summary}</p>

                    {measure.reasons && measure.reasons.length > 0 && (
                      <div className="compact-reasons">
                        {measure.reasons.slice(0, 3).map((reason) => (
                          <span key={reason}>
                            ✓ {reason}
                          </span>
                        ))}
                      </div>
                    )}

                    <button
                      className="measure-link"
                      onClick={() => void openMeasure(measure)}
                    >
                      Подробнее
                      <span>→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">⌕</div>
              <h2>Попробуем найти другие варианты</h2>
              <p>
                Измените регион, цель или другие параметры бизнеса и повторите
                подбор.
              </p>
              <button className="primary-button" onClick={restart}>
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
            <button onClick={() => setError('')}>×</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">М</div>
          <span>Меры поддержки</span>
        </div>

        <span className="topbar-caption">Для предпринимателей</span>
      </header>

      <main className="page questionnaire-page">
        <div className="questionnaire-header">
          <div>
            <span className="eyebrow">Подбор поддержки</span>
            <h1>Найдём подходящие меры для вашего бизнеса</h1>
            <p>
              Ответьте на несколько вопросов. Мы подберём программы,
              соответствующие параметрам вашего бизнеса.
            </p>
          </div>
        </div>

        <div className="progress-block">
          <div className="progress-info">
            <span>Вопрос {step + 1} из {questions.length}</span>
            <span>{progress}%</span>
          </div>

          <div className="progress-track">
            <div
              className="progress-value"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {currentQuestion && (
          <section className="question-card">
            <div className="question-card-header">
              <span className="question-number">
                {String(step + 1).padStart(2, '0')}
              </span>

              <div>
                <h2>{currentQuestion.title}</h2>
                <p>{currentQuestion.description}</p>
              </div>
            </div>

            <div className="options">
              {currentQuestion.options.map((option) => {
                const optionId = String(option.id)
                const optionLabel = String(option.label)

                const selected =
                  currentQuestion.key === 'needs'
                    ? profile.needs.includes(optionId)
                    : currentValue === optionId

                return (
                  <button
                    key={optionId}
                    type="button"
                    className={`option ${selected ? 'selected' : ''}`}
                    onClick={() => {
                      if (currentQuestion.key === 'needs') {
                        setProfile((current) => ({
                          ...current,
                          needs: current.needs.includes(optionId)
                            ? current.needs.filter((id) => id !== optionId)
                            : [...current.needs, optionId],
                        }))
                      } else {
                        updateProfile(currentQuestion.key, optionId)
                      }
                    }}
                  >
                    <span>{optionLabel}</span>

                    <span className="option-check">
                      {selected && '✓'}
                    </span>
                  </button>
                )
              })}
            </div>
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
            disabled={!canContinue || matching}
          >
            {matching
              ? 'Подбираем...'
              : step === questions.length - 1
                ? 'Подобрать меры'
                : 'Продолжить'}
            {!matching && <span>→</span>}
          </button>
        </div>
      </main>

      {error && (
        <div className="toast">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
    </div>
  )
}

export default App