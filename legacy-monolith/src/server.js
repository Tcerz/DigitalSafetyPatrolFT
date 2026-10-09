import app from './app.js'
import { env } from './config/environment.js'
import { prisma } from './config/database.js'
import { notifyOverdue } from './services/corrective.service.js'

const server = app.listen(env.port, () => console.log(`Digital Safety Patrol API berjalan di port ${env.port} (${env.nodeEnv})`))

// Pemantauan overdue: saat start dan setiap jam.
const runOverdue = () => notifyOverdue().catch((e) => console.error('overdue job gagal:', e.message))
setTimeout(runOverdue, 10_000)
const timer = setInterval(runOverdue, 60 * 60 * 1000)

const stop = async () => { clearInterval(timer); server.close(); await prisma.$disconnect(); process.exit(0) }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
