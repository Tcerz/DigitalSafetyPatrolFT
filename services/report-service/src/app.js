import express from 'express'
import helmet from 'helmet'
import { requestId, accessLog } from './common/logger.js'
import { notFound, errorHandler } from './common/error.middleware.js'
import { prisma } from './config/database.js'
import { UPLOAD_ROOT } from './utils/upload.js'
import routes from './routes/index.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)
app.use(requestId)
app.use(accessLog)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(express.json({ limit: '1mb' }))
app.get('/health', async (req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ service: 'report-service', status: 'healthy' }) }
  catch { res.status(503).json({ service: 'report-service', status: 'unhealthy', reason: 'database tidak tersedia' }) }
})
// Foto disimpan di volume bersama (uploads_data) sehingga semua instance report-service dapat melayaninya.
app.use('/uploads', express.static(UPLOAD_ROOT, { index: false, dotfiles: 'deny', maxAge: '7d' }))
app.use(routes)
app.use(notFound)
app.use(errorHandler)
export default app
