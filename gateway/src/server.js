import app from './app.js'
import { env } from './common/env.js'
import { log } from './common/logger.js'
const server = app.listen(env.port, () => log.info(`API Gateway berjalan di port ${env.port}`))
process.on('SIGTERM', () => server.close(() => process.exit(0)))
