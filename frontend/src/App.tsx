import { useCallback, useEffect, useState } from 'react'
import './App.css'

type Option = {
  code: string
  name: string
}

type Dictionaries = {
  regions: Option[]
  legalForms: Option[]
  businessStages: Option[]
  employeeRanges: Option[]
  equipment: Option[]
}

type Profile = {
  region: string
  legalForm: string
  businessStage: string
  okvedCode: string
  okvedName: string
  employees: string
  equipment: string
}

type Measure = {
  id: number
  name: string
  shortDescription: string
  description?: string
  provider?: string
  region?: string
  legalForms?: string[]
  businessStages?: string[]
  employeeRanges?: string[]
  equipment?: string[]
  okvedCodes?: string[]
  tags?: string[]
  isDemo?: boolean
}

type MatchResponse = {
  measures: Measure[]
}

type OkvedItem = {
  code: string
  name: string
  level?: number
  isLeaf?: boolean
}

type MaxWebApp = {
  initData?: string
  ready?: () => void
  expand?: () => void
  close?: () => void
}

declare global {
  interface Window {
    WebApp?: MaxWebApp
  }
}

/*
 * ВАЖНО:
 * Backend расположен отдельно от frontend.
 * Все API-запросы должны идти через:
 *
 * https://tms-max.relaxdev.ru/api/...
 *
 * Поэтому /api добавляется здесь принудительно.
 */
const RAW_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://tms-max.relaxdev.ru'
    : 'http://localhost:8000')

const API_BASE_URL = RAW_API_BASE_URL
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}/api${normalizedPath}`
}

function getInitData(): string {
  return window.WebApp?.initData ?? ''
}

function getAuthHeaders(): Record<string, string> {
  const initData = getInitData()

  return initData
    ? {
        Authorization: `Bearer ${initData}`,
      }
    : {}
}

async function fetchJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

function App() {
  const [dictionaries, setDictionaries] = useState<Dictionaries | null>(null)
  const [profile, setProfile] = useState<Profile>({
    region: '',
    legalForm: '',
    businessStage: '',
    okvedCode: '',
    okvedName: '',
    employees: '',
    equipment: '',
  })

  const [okvedQuery, setOkvedQuery] = useState('')
  const [okvedResults, setOkvedResults] = useState<OkvedItem[]>([])
  const [showOkvedResults, setShowOkvedResults] = useState(false)

  const [measures, setMeasures] = useState<Measure[]>([])
  const [favorites, setFavorites] = useState<number[]>([])
  const [selectedMeasure, setSelectedMeasure] = useState<Measure | null>(null)

  const [loadingDictionaries, setLoadingDictionaries] = useState(true)
  const [loadingFavorites, setLoadingFavorites] = useState(false)
  const [loadingMatch, setLoadingMatch] = useState(false)
  const [loadingOkved, setLoadingOkved] = useState(false)

  const [error, setError] = useState('')
  const [matchDone, setMatchDone] = useState(false)



  /*
   * Инициализация MAX Mini App
   */
  useEffect(() => {
    try {
      window.WebApp?.ready?.()
      window.WebApp?.expand?.()
    } catch {
      // Работа в обычном браузере допустима.
    }
  }, [])

  /*
   * Загружаем справочники.
   *
   * ВАЖНО:
   * URL получается:
   * https://tms-max.relaxdev.ru/api/dictionaries
   */
  useEffect(() => {
    let cancelled = false

    async function loadDictionaries() {
      try {
        setLoadingDictionaries(true)
        setError('')

        const data = await fetchJson<Dictionaries>(
          apiUrl('/dictionaries'),
        )

        if (!cancelled) {
          setDictionaries(data)
        }
      } catch (err) {
        console.error('[dictionaries] Error:', err)

        if (!cancelled) {
          setError('Не удалось загрузить данные сервиса')
        }
      } finally {
        if (!cancelled) {
          setLoadingDictionaries(false)
        }
      }
    }

    void loadDictionaries()

    return () => {
      cancelled = true
    }
  }, [])

  /*
   * Загружаем избранное.
   *
   * URL:
   * https://tms-max.relaxdev.ru/api/favorites
   */
  const loadFavorites = useCallback(async () => {
    try {
      setLoadingFavorites(true)

      const data = await fetchJson<
        number[] | { ids?: number[]; favorites?: number[] }
      >(apiUrl('/favorites'), {
        headers: getAuthHeaders(),
      })

      if (Array.isArray(data)) {
        setFavorites(data)
      } else {
        setFavorites(data.ids ?? data.favorites ?? [])
      }
    } catch (err) {
      console.error('[favorites] Error:', err)

      /*
       * Если приложение открыто не внутри MAX,
       * backend может не принять initData.
       * В таком случае не ломаем интерфейс.
       */
      setFavorites([])
    } finally {
      setLoadingFavorites(false)
    }
  }, [])

  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  /*
   * Поиск ОКВЭД
   */
  useEffect(() => {
    const query = okvedQuery.trim()

    if (query.length < 2) {
      setOkvedResults([])
      setShowOkvedResults(false)
      return
    }

    let cancelled = false

    const timer = window.setTimeout(async () => {
      try {
        setLoadingOkved(true)

        const data = await fetchJson<
          OkvedItem[] | { items?: OkvedItem[]; results?: OkvedItem[] }
        >(
          apiUrl(`/okved?q=${encodeURIComponent(query)}`),
        )

        if (cancelled) {
          return
        }

        const items = Array.isArray(data)
          ? data
          : data.items ?? data.results ?? []

        setOkvedResults(items)
        setShowOkvedResults(true)
      } catch (err) {
        console.error('[okved] Error:', err)

        if (!cancelled) {
          setOkvedResults([])
          setShowOkvedResults(false)
        }
      } finally {
        if (!cancelled) {
          setLoadingOkved(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [okvedQuery])

  function updateProfile<K extends keyof Profile>(
    key: K,
    value: Profile[K],
  ) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function selectOkved(item: OkvedItem) {
    setProfile((current) => ({
      ...current,
      okvedCode: item.code,
      okvedName: item.name,
    }))

    setOkvedQuery(`${item.code} — ${item.name}`)
    setShowOkvedResults(false)
  }

  function clearOkved() {
    setProfile((current) => ({
      ...current,
      okvedCode: '',
      okvedName: '',
    }))

    setOkvedQuery('')
    setOkvedResults([])
    setShowOkvedResults(false)
  }

  /*
   * Подбор мер поддержки.
   *
   * URL:
   * https://tms-max.relaxdev.ru/api/match
   */
  async function handleMatch() {
    try {
      setLoadingMatch(true)
      setError('')
      setMatchDone(false)

      const payload = {
        region: profile.region || undefined,
        legalForm: profile.legalForm || undefined,
        businessStage: profile.businessStage || undefined,
        okvedCode: profile.okvedCode || undefined,
        employees: profile.employees || undefined,
        equipment: profile.equipment || undefined,
      }

      const data = await fetchJson<MatchResponse | Measure[]>(
        apiUrl('/match'),
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      const result = Array.isArray(data)
        ? data
        : data.measures ?? []

      setMeasures(result)
      setMatchDone(true)
    } catch (err) {
      console.error('[match] Error:', err)
      setError('Не удалось подобрать меры поддержки')
      setMeasures([])
    } finally {
      setLoadingMatch(false)
    }
  }

  /*
   * Добавление / удаление из избранного.
   *
   * URL:
   * https://tms-max.relaxdev.ru/api/favorites/:id
   */
  async function toggleFavorite(measureId: number) {
    const isFavorite = favorites.includes(measureId)

    try {
      const response = await fetch(
        apiUrl(`/favorites/${measureId}`),
        {
          method: isFavorite ? 'DELETE' : 'POST',
          headers: getAuthHeaders(),
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      setFavorites((current) =>
        isFavorite
          ? current.filter((id) => id !== measureId)
          : [...current, measureId],
      )
    } catch (err) {
      console.error('[favorites] Error:', err)
      setError('Не удалось изменить избранное')
    }
  }

  /*
   * Детальная информация о мере.
   *
   * URL:
   * https://tms-max.relaxdev.ru/api/measures/:id
   */
  async function openMeasure(measure: Measure) {
    try {
      const detailed = await fetchJson<Measure>(
        apiUrl(`/measures/${measure.id}`),
        {
          headers: getAuthHeaders(),
        },
      )

      setSelectedMeasure(detailed)
    } catch (err) {
      console.error('[measure] Error:', err)

      /*
       * Если detail endpoint недоступен,
       * всё равно показываем данные из результата подбора.
       */
      setSelectedMeasure(measure)
    }
  }

  function resetForm() {
    setProfile({
      region: '',
      legalForm: '',
      businessStage: '',
      okvedCode: '',
      okvedName: '',
      employees: '',
      equipment: '',
    })

    setOkvedQuery('')
    setOkvedResults([])
    setShowOkvedResults(false)
    setMeasures([])
    setMatchDone(false)
    setError('')
  }

  if (loadingDictionaries) {
    return (
      <main className="app">
        <div className="loading">
          <div className="spinner" />
          <p>Загружаем сервис...</p>
        </div>
      </main>
    )
  }

  const regions = dictionaries?.regions ?? []
  const legalForms = dictionaries?.legalForms ?? []
  const businessStages = dictionaries?.businessStages ?? []
  const employeeRanges = dictionaries?.employeeRanges ?? []
  const equipment = dictionaries?.equipment ?? []

  return (
    <main className="app">
      <header className="header">
        <div>
          <div className="eyebrow">MAX × МЕРЫ ПОДДЕРЖКИ</div>
          <h1>Поддержка для бизнеса</h1>
          <p className="subtitle">
            Заполните короткую анкету — сервис подберёт подходящие меры
            поддержки для вашего бизнеса.
          </p>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <div className="section-number">01</div>
            <h2>О вашем бизнесе</h2>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Регион</span>
            <select
              value={profile.region}
              onChange={(event) =>
                updateProfile('region', event.target.value)
              }
            >
              <option value="">Выберите регион</option>
              {regions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Организационно-правовая форма</span>
            <select
              value={profile.legalForm}
              onChange={(event) =>
                updateProfile('legalForm', event.target.value)
              }
            >
              <option value="">Выберите форму</option>
              {legalForms.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Стадия бизнеса</span>
            <select
              value={profile.businessStage}
              onChange={(event) =>
                updateProfile('businessStage', event.target.value)
              }
            >
              <option value="">Выберите стадию</option>
              {businessStages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <div className="field okved-field">
            <span>Основной ОКВЭД</span>

            <div className="okved-input-wrapper">
              <input
                type="text"
                value={okvedQuery}
                placeholder="Введите код или название"
                onChange={(event) => {
                  setOkvedQuery(event.target.value)
                  if (profile.okvedCode) {
                    setProfile((current) => ({
                      ...current,
                      okvedCode: '',
                      okvedName: '',
                    }))
                  }
                }}
                onFocus={() => {
                  if (okvedResults.length > 0) {
                    setShowOkvedResults(true)
                  }
                }}
              />

              {profile.okvedCode && (
                <button
                  type="button"
                  className="clear-button"
                  onClick={clearOkved}
                  aria-label="Очистить ОКВЭД"
                >
                  ×
                </button>
              )}

              {showOkvedResults && (
                <div className="okved-results">
                  {loadingOkved && (
                    <div className="okved-loading">
                      Ищем...
                    </div>
                  )}

                  {!loadingOkved &&
                    okvedResults.length === 0 && (
                      <div className="okved-empty">
                        Ничего не найдено
                      </div>
                    )}

                  {!loadingOkved &&
                    okvedResults.map((item) => (
                      <button
                        type="button"
                        className="okved-result"
                        key={item.code}
                        onClick={() => selectOkved(item)}
                      >
                        <strong>{item.code}</strong>
                        <span>{item.name}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {profile.okvedCode && (
              <small className="selected-okved">
                Выбран: {profile.okvedCode} — {profile.okvedName}
              </small>
            )}
          </div>

          <label className="field">
            <span>Количество сотрудников</span>
            <select
              value={profile.employees}
              onChange={(event) =>
                updateProfile('employees', event.target.value)
              }
            >
              <option value="">Выберите диапазон</option>
              {employeeRanges.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Нужно оборудование?</span>
            <select
              value={profile.equipment}
              onChange={(event) =>
                updateProfile('equipment', event.target.value)
              }
            >
              <option value="">Выберите вариант</option>
              {equipment.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="actions">
          <button
            type="button"
            className="primary-button"
            onClick={handleMatch}
            disabled={loadingMatch}
          >
            {loadingMatch ? 'Подбираем...' : 'Подобрать меры поддержки'}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={resetForm}
          >
            Очистить
          </button>
        </div>
      </section>

      {matchDone && (
        <section className="results-section">
          <div className="results-header">
            <div>
              <div className="section-number">02</div>
              <h2>Подходящие меры</h2>
              <p>
                Найдено: {measures.length}
              </p>
            </div>
          </div>

          {measures.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">—</div>
              <h3>Подходящих мер пока не найдено</h3>
              <p>
                Попробуйте изменить параметры анкеты и выполнить
                подбор ещё раз.
              </p>
            </div>
          ) : (
            <div className="measures-grid">
              {measures.map((measure) => {
                const isFavorite = favorites.includes(measure.id)

                return (
                  <article
                    className="measure-card"
                    key={measure.id}
                  >
                    <div className="measure-top">
                      <span className="measure-id">
                        МЕРА #{measure.id}
                      </span>

                      <button
                        type="button"
                        className={`favorite-button ${
                          isFavorite ? 'active' : ''
                        }`}
                        onClick={() =>
                          void toggleFavorite(measure.id)
                        }
                        disabled={loadingFavorites}
                        aria-label={
                          isFavorite
                            ? 'Удалить из избранного'
                            : 'Добавить в избранное'
                        }
                      >
                        {isFavorite ? '★' : '☆'}
                      </button>
                    </div>

                    <h3>{measure.name}</h3>

                    {measure.shortDescription && (
                      <p className="measure-description">
                        {measure.shortDescription}
                      </p>
                    )}

                    {measure.provider && (
                      <div className="measure-meta">
                        <span>Организатор</span>
                        <strong>{measure.provider}</strong>
                      </div>
                    )}

                    {measure.isDemo && (
                      <div className="demo-label">
                        Демо-данные для прототипа
                      </div>
                    )}

                    <button
                      type="button"
                      className="details-button"
                      onClick={() =>
                        void openMeasure(measure)
                      }
                    >
                      Подробнее
                      <span>→</span>
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {selectedMeasure && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedMeasure(null)}
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setSelectedMeasure(null)}
              aria-label="Закрыть"
            >
              ×
            </button>

            <div className="modal-label">
              МЕРА #{selectedMeasure.id}
            </div>

            <h2>{selectedMeasure.name}</h2>

            {selectedMeasure.shortDescription && (
              <p className="modal-description">
                {selectedMeasure.shortDescription}
              </p>
            )}

            {selectedMeasure.description && (
              <div className="modal-block">
                <h3>Описание</h3>
                <p>{selectedMeasure.description}</p>
              </div>
            )}

            {selectedMeasure.provider && (
              <div className="modal-block">
                <h3>Организатор</h3>
                <p>{selectedMeasure.provider}</p>
              </div>
            )}

            {selectedMeasure.region && (
              <div className="modal-block">
                <h3>Регион</h3>
                <p>{selectedMeasure.region}</p>
              </div>
            )}

            {selectedMeasure.tags &&
              selectedMeasure.tags.length > 0 && (
                <div className="tags">
                  {selectedMeasure.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}

            {selectedMeasure.isDemo && (
              <div className="demo-label modal-demo">
                Данные подготовлены для демонстрации прототипа
              </div>
            )}

            <button
              type="button"
              className="primary-button modal-button"
              onClick={() =>
                void toggleFavorite(selectedMeasure.id)
              }
            >
              {favorites.includes(selectedMeasure.id)
                ? 'Удалить из избранного'
                : 'Добавить в избранное'}
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        <span>MAX × МЕРЫ ПОДДЕРЖКИ</span>
        <span>Прототип</span>
      </footer>
    </main>
  )
}

export default App