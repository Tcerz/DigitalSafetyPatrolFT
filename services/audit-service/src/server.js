import app from './app.js'
import { env } from './common/env.js'
import { log } from './common/logger.js'
import { prisma } from './config/database.js'
const server = app.listen(env.port, () => log.info(`${env.service} berjalan di port ${env.port}`))
const stop = async () => { server.close(); await prisma.$disconnect(); process.exit(0) }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
