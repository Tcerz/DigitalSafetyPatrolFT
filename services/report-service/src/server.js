import app from './app.js'
import { env } from './common/env.js'
import { log } from './common/logger.js'
import { prisma } from './config/database.js'
import { notifyOverdue } from './services/corrective.service.js'

const server = app.listen(env.port, () => log.info(`${env.service} berjalan di port ${env.port}`))

// Pemantauan overdue: saat start dan setiap jam (dedupe dilakukan notification-service).
const runOverdue = () => notifyOverdue().catch((e) => log.warn('overdue job gagal', { error: e.message }))
setTimeout(runOverdue, 20_000)
const timer = setInterval(runOverdue, 60 * 60 * 1000)

const stop = async () => { clearInterval(timer); server.close(); await prisma.$disconnect(); process.exit(0) }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
