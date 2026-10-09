import express from 'express'
import helmet from 'helmet'
import { requestId, accessLog } from './common/logger.js'
import { notFound, errorHandler } from './common/error.middleware.js'
import { prisma } from './config/database.js'
import routes from './routes/index.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)
app.use(requestId)
app.use(accessLog)
app.use(helmet())
app.use(express.json({ limit: '1mb' }))
app.get('/health', async (req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ service: 'auth-service', status: 'healthy' }) }
  catch { res.status(503).json({ service: 'auth-service', status: 'unhealthy', reason: 'database tidak tersedia' }) }
})
app.use(routes)
app.use(notFound)
app.use(errorHandler)
export default app
