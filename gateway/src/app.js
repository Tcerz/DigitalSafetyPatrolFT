import http from 'node:http'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { env } from './common/env.js'
import { requestId, accessLog, log } from './common/logger.js'
import { Balancer } from './balancer.js'

// Daftar service tujuan: nama -> host:port di jaringan Docker
const U = (v) => new URL(v)
const SERVICES = {
  auth: U(env.urls.auth), master: U(env.urls.master), report: U(env.urls.report),
  notification: U(env.urls.notification), audit: U(env.urls.audit),
}
const bal = Object.fromEntries(Object.entries(SERVICES).map(([k, u]) => [k, new Balancer(k, u.hostname, u.port || 80)]))
const FRONTEND = (process.env.FRONTEND_URL || 'http://localhost:8080').split(',').map((s) => s.trim())

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(requestId)
app.use(accessLog)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: (o, cb) => cb(null, !o || FRONTEND.includes(o)), credentials: true }))

const fail = (res, status, message) => res.status(status).json({ success: false, message, errors: [] })

// --- Health: gateway + status tiap service (tetap 200 walau ada service yang mati)
app.get('/health', (req, res) => res.json({ service: 'api-gateway', status: 'healthy' }))
// Versi aplikasi: nilainya diisi pipeline CI/CD lewat build-arg (APP_VERSION, GIT_COMMIT, BUILD_TIME)
app.get('/api/version', (req, res) => res.json({
  success: true, message: 'OK',
  data: { service: 'api-gateway', version: process.env.APP_VERSION || 'dev', commit: process.env.GIT_COMMIT || 'local', builtAt: process.env.BUILD_TIME || null },
}))
app.get('/api/health', async (req, res) => {
  const out = {}
  await Promise.all(Object.entries(SERVICES).map(async ([name, u]) => {
    try { out[name] = (await fetch(`${u.origin}/health`, { signal: AbortSignal.timeout(2000) })).ok ? 'healthy' : 'unhealthy' }
    catch { out[name] = 'down' }
  }))
  const all = Object.values(out).every((s) => s === 'healthy')
  res.json({ success: true, message: all ? 'API is healthy' : 'API berjalan sebagian (degraded)', data: { gateway: 'healthy', services: out } })
})

// --- Rate limit khusus login (brute-force)
app.post('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => fail(res, 429, 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.'),
}))

// --- Gerbang autentikasi: token diperiksa di gateway sebelum diteruskan.
// (Setiap service tetap memeriksa token + role lagi.)
const PUBLIC = [/^\/api\/health$/, /^\/api\/auth\/login$/, /^\/uploads\//]
app.use((req, res, next) => {
  if (req.path.startsWith('/internal')) return fail(res, 404, 'Endpoint tidak ditemukan.') // internal tidak pernah di-expose
  if (req.method === 'OPTIONS' || !req.path.startsWith('/api/') || PUBLIC.some((r) => r.test(req.path))) return next()
  const h = req.headers.authorization || ''
  try { jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', env.jwtSecret); next() }
  catch { fail(res, 401, h ? 'Sesi tidak valid atau sudah berakhir.' : 'Autentikasi diperlukan.') }
})

// --- Routing ke service (path publik tetap sama seperti monolith -> frontend tidak perlu diubah)
const agent = new http.Agent({ keepAlive: false }) // koneksi baru per request -> pembagian beban merata
const proxy = (paths, svc, pathRewrite) => createProxyMiddleware({
  pathFilter: paths, target: SERVICES[svc].origin, router: () => bal[svc].target(), pathRewrite, agent,
  changeOrigin: false, proxyTimeout: 60000, timeout: 60000,
  on: {
    proxyReq: (proxyReq, req) => { proxyReq.removeHeader('x-internal-key'); proxyReq.setHeader('x-request-id', req.id) },
    error: (err, req, res) => {
      log.error('gagal meneruskan request', { requestId: req.id, target: svc, error: err.message })
      if (!res.headersSent) res.status(503).json({ success: false, message: 'Layanan sedang tidak tersedia. Coba lagi beberapa saat.', errors: [] })
    },
  },
})
app.use(proxy(['/api/auth', '/api/users'], 'auth'))
app.use(proxy(['/api/master-data'], 'master', { '^/api/master-data': '/api' })) // alias sesuai PRD
app.use(proxy(['/api/depots', '/api/products', '/api/tanks', '/api/personnel'], 'master'))
app.use(proxy(['/api/reports', '/api/activities', '/api/photos', '/api/findings', '/api/corrective-actions', '/api/statistics', '/uploads'], 'report'))
app.use(proxy(['/api/notifications'], 'notification'))
app.use(proxy(['/api/audit-logs'], 'audit'))

app.use((req, res) => fail(res, 404, 'Endpoint tidak ditemukan.'))
export default app
