import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { env } from './env.js'

// Log terstruktur (1 baris JSON) agar mudah dilacak: docker compose logs <service>
const write = (level, msg, extra = {}) =>
  console[level === 'error' ? 'error' : 'log'](JSON.stringify({ ts: new Date().toISOString(), level, service: env.service, msg, ...extra }))
export const log = {
  info: (msg, extra) => write('info', msg, extra),
  warn: (msg, extra) => write('warn', msg, extra),
  error: (msg, extra) => write('error', msg, extra),
}

// Request ID dibawa dari gateway ke semua service sehingga satu request dapat ditelusuri.
// X-Served-By menunjukkan container mana yang melayani (berguna saat demo scaling).
export function requestId(req, res, next) {
  req.id = String(req.headers['x-request-id'] || randomUUID())
  res.setHeader('X-Request-Id', req.id)
  res.setHeader('X-Served-By', `${env.service}@${os.hostname()}`)
  next()
}
export function accessLog(req, res, next) {
  const t = Date.now()
  res.on('finish', () => {
    if (req.path === '/health') return
    log.info('request', { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Date.now() - t })
  })
  next()
}
