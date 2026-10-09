import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { env } from './config/environment.js'
import { UPLOAD_ROOT } from './middleware/upload.middleware.js'
import { requestLogger } from './middleware/logger.middleware.js'
import { notFound, errorHandler } from './middleware/error.middleware.js'
import routes from './routes/index.js'

const app = express()
app.set('trust proxy', 1)
// CORP cross-origin agar foto /uploads dapat dimuat frontend yang berbeda origin (dev).
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
// Hanya origin frontend yang dikonfigurasi (FRONTEND_URL) yang mendapat header CORS.
app.use(cors({ origin: (origin, cb) => cb(null, !origin || env.frontendUrl.includes(origin)), credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(requestLogger)
app.use('/uploads', express.static(UPLOAD_ROOT, { index: false, dotfiles: 'deny', maxAge: '7d' }))
app.use('/api', routes)
app.use(notFound)
app.use(errorHandler)
export default app
