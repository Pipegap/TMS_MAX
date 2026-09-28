import express from 'express'
import cors from 'cors'
import { api } from './routes/index.js'

function createApp() {
  const app = express()

  app.disable('x-powered-by')

  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://tms-maxfrontend.relaxdev.ru',
  ])

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true)
          return
        }

        callback(
          new Error(
            `CORS: origin ${origin} не разрешён`,
          ),
        )
      },
      credentials: true,
    }),
  )

  app.use(
    express.json({
      limit: '32kb',
    }),
  )

  app.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'tms-max-backend',
    })
  })

  app.use('/api', api)

  return app
}

export { createApp }