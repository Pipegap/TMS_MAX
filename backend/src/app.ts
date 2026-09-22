import express from 'express'
import cors from 'cors'
import { api } from './routes/index.js'

function createApp() {
  const app = express()

  app.disable('x-powered-by')

  app.use(
    cors({
      origin: 'http://localhost:5173',
    }),
  )

  app.use(express.json({ limit: '32kb' }))

  app.use('/api', api)

  return app
}

export { createApp }