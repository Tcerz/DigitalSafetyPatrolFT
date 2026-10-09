import { env } from './env.js'
import { AppError } from './AppError.js'
import { log } from './logger.js'

const NAMES = { auth: 'Auth', master: 'Master Data', report: 'Report', notification: 'Notification', audit: 'Audit' }

// Panggilan antar-service (REST). Ada timeout; GET dicoba ulang 1x; tidak ada retry tanpa batas.
// Mengembalikan isi "data" dari respons. Jika service tujuan mati -> AppError 503.
export async function callService(name, path, { method = 'GET', body, req, timeoutMs = env.timeoutMs } = {}) {
  const url = env.urls[name] + path
  const attempts = method === 'GET' ? 2 : 1
  let lastErr
  for (let i = 0; i < attempts; i++) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method, signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', 'X-Internal-Key': env.internalKey, 'X-Request-Id': req?.id || '' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await res.json().catch(() => null)
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
      if (!res.ok) throw new AppError(res.status === 404 ? 404 : 422, json?.message || 'Permintaan ke layanan lain ditolak.')
      return json && 'data' in json ? json.data : json
    } catch (e) {
      if (e instanceof AppError) throw e
      lastErr = e
    } finally { clearTimeout(timer) }
  }
  log.warn('service tidak tersedia', { requestId: req?.id, target: name, path, error: lastErr?.message })
  throw new AppError(503, `Layanan ${NAMES[name] || name} sedang tidak tersedia. Coba lagi beberapa saat.`)
}

// Kirim audit/notifikasi tanpa menunggu hasilnya (fire-and-forget):
// bila service tujuan mati, proses utama (mis. membuat laporan) tetap berhasil.
export function fireAndForget(name, path, body, req) {
  callService(name, path, { method: 'POST', body, req, timeoutMs: 2000 }).catch((e) => log.warn('event gagal dikirim', { requestId: req?.id, target: name, error: e.message }))
}
export const audit = (req, action, entity, entityId, description) =>
  fireAndForget('audit', '/internal/audit', { userId: req.user?.id ?? null, userName: req.user?.name ?? 'System', action, entity, entityId: entityId ?? null, description, ipAddress: req.ip || null }, req)
// target: { userIds: [...] } atau { depotId } (semua ADMIN pada depot tsb)
export const notify = (req, payload) => fireAndForget('notification', '/internal/notify', payload, req)
