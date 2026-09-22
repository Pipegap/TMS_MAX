import { useEffect, useState } from 'react'
import './App.css'

type DictionaryItem = {
  id: string | number
  label: string
}

type Dictionaries = {
  regions: DictionaryItem[]
  businessForms: DictionaryItem[]
  stages: DictionaryItem[]
  industries: DictionaryItem[]
  employees: DictionaryItem[]
  needs: DictionaryItem[]
}

function App() {
  const [dictionaries, setDictionaries] = useState<Dictionaries | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('http://localhost:8000/api/dictionaries')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        return response.json()
      })
      .then((data: Dictionaries) => {
        setDictionaries(data)
      })
      .catch((err: Error) => {
        setError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <main>Загрузка...</main>
  }

  if (error) {
    return (
      <main>
        <h1>MSP Helper</h1>

        <h2>❌ Ошибка подключения</h2>

        <p>{error}</p>
      </main>
    )
  }

  if (!dictionaries) {
    return (
      <main>
        <h1>MSP Helper</h1>

        <p>Данные не получены.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>MSP Helper</h1>

      <h2>✅ Frontend → Backend работает</h2>

      <p>
        Backend успешно вернул данные из PostgreSQL.
      </p>

      <hr />

      <h3>Данные API</h3>

      <p>Регионов: {dictionaries.regions.length}</p>

      <p>Форм бизнеса: {dictionaries.businessForms.length}</p>

      <p>Стадий бизнеса: {dictionaries.stages.length}</p>

      <p>Отраслей: {dictionaries.industries.length}</p>

      <p>Вариантов сотрудников: {dictionaries.employees.length}</p>

      <p>Целей: {dictionaries.needs.length}</p>

      <h3>Регионы</h3>

      <ul>
        {dictionaries.regions.map((region) => (
          <li key={region.id}>
            {region.label}
          </li>
        ))}
      </ul>
    </main>
  )
}

export default App