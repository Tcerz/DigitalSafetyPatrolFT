// Tes integrasi alur PRD §102. Jalankan setelah API + MySQL aktif dan seed terisi:
//   BASE_URL=http://localhost:3000 SEED_PASSWORD=Password123! npm test
import test from 'node:test'
import assert from 'node:assert/strict'

const BASE = (process.env.BASE_URL || 'http://localhost:3000') + '/api'
const PASSWORD = process.env.SEED_PASSWORD || 'Password123!'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const api = async (method, path, { token, body, form } = {}) => {
  const res = await fetch(BASE + path, { method, headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) }, body: form || (body && JSON.stringify(body)) })
  const ct = res.headers.get('content-type') || ''
  return { status: res.status, json: ct.includes('json') ? await res.json() : null, ct }
}
const login = async (username) => (await api('POST', '/auth/login', { body: { username, password: PASSWORD } })).json.data.token
const act = (extra = {}) => ({ kondisi: 'AMAN', personnelId: P[0], ...extra })
let P, PROD, TANK, petugas, admin, superadmin, reportId, findingId, caId

test('login & otorisasi dasar', async () => {
  assert.equal((await api('POST', '/auth/login', { body: { username: 'admin', password: 'salah' } })).status, 401)
  ;[petugas, admin, superadmin] = await Promise.all(['petugas', 'admin', 'superadmin'].map(login))
  assert.equal((await api('GET', '/users', { token: petugas })).status, 403)
  assert.equal((await api('GET', '/audit-logs', { token: admin })).status, 403)
  assert.equal((await api('GET', '/audit-logs', { token: superadmin })).status, 200)
})
test('master data tersedia', async () => {
  P = (await api('GET', '/personnel?limit=50', { token: petugas })).json.data.map((x) => x.id)
  PROD = (await api('GET', '/products', { token: petugas })).json.data[0].id
  TANK = (await api('GET', '/tanks', { token: petugas })).json.data[0].id
  assert.ok(P.length && PROD && TANK)
})
test('UNSAFE tanpa finding ditolak (422)', async () => {
  const r = await api('POST', '/reports', { token: petugas, body: { tanggal: '2026-10-03', jamPatrol: '09:00', picPatrolId: P[0], loading: act({ kondisi: 'TIDAK_AMAN', finding: '' }) } })
  assert.equal(r.status, 422)
})
test('buat laporan draft lengkap + foto', async () => {
  const body = {
    tanggal: '2026-10-03', jamPatrol: '09:00', picPatrolId: P[0],
    loading: act({ kondisi: 'TIDAK_AMAN', productId: PROD, jetty1: 'J1', finding: 'Selang bocor di manifold' }),
    discharge: act({ productId: PROD }), penyaluran: act({ jamMulai: '08:00', jamSelesai: '09:00' }),
    storage: act({ tankIds: [TANK], statusTangki: 'AKTIF_IDLE' }),
  }
  const r = await api('POST', '/reports', { token: petugas, body })
  assert.equal(r.status, 201)
  reportId = r.json.data.id
  assert.match(r.json.data.reportNumber, /^SP-20261003-\d{4}$/)
  assert.equal(r.json.data.status, 'DRAFT')
  assert.equal(r.json.data.findings.length, 1)
  const form = new FormData(); form.append('file', new Blob([PNG], { type: 'image/png' }), 'a.png'); form.append('category', 'Finding')
  assert.equal((await api('POST', `/reports/${reportId}/photos`, { token: petugas, form })).status, 201)
})
test('admin tidak melihat draft; petugas submit', async () => {
  assert.equal((await api('GET', `/reports/${reportId}`, { token: admin })).status, 404)
  const s = await api('PUT', `/reports/${reportId}/status`, { token: petugas, body: { status: 'SUBMITTED' } })
  assert.equal(s.status, 200)
  assert.equal((await api('PUT', `/reports/${reportId}/status`, { token: petugas, body: { status: 'VERIFIED' } })).status, 403)
})
test('admin verifikasi, finding, corrective action', async () => {
  assert.equal((await api('PUT', `/reports/${reportId}/status`, { token: admin, body: { status: 'VERIFIED' } })).status, 200)
  findingId = (await api('GET', `/reports/${reportId}`, { token: admin })).json.data.findings[0].id
  const t = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  const c = await api('POST', '/corrective-actions', { token: admin, body: { reportId, findingId, action: 'Ganti selang', picId: P[0], targetDate: t } })
  assert.equal(c.status, 201)
  caId = c.json.data.id
  assert.equal((await api('GET', `/reports/${reportId}`, { token: admin })).json.data.status, 'IN_PROGRESS')
  assert.equal((await api('PUT', `/reports/${reportId}/status`, { token: admin, body: { status: 'RESOLVED' } })).status, 422) // CA belum selesai
})
test('selesaikan corrective action lalu tutup laporan', async () => {
  for (const status of ['IN_PROGRESS', 'RESOLVED']) assert.equal((await api('PUT', `/corrective-actions/${caId}/status`, { token: admin, body: { status } })).status, 200)
  for (const status of ['RESOLVED', 'CLOSED']) assert.equal((await api('PUT', `/reports/${reportId}/status`, { token: admin, body: { status } })).status, 200)
  assert.equal((await api('DELETE', `/reports/${reportId}`, { token: superadmin })).status, 403) // CLOSED tidak dapat dihapus
})
test('statistik, notifikasi, PDF, audit', async () => {
  const s = (await api('GET', '/statistics/summary', { token: admin })).json.data
  assert.ok(s.totalPatrol >= 1 && s.unsafe >= 1)
  assert.equal((await api('GET', '/statistics/trend?range=7d', { token: admin })).json.data.length, 7)
  assert.ok((await api('GET', '/notifications', { token: petugas })).json.pagination.total >= 1)
  const pdf = await api('GET', `/reports/${reportId}/pdf`, { token: admin })
  assert.equal(pdf.status, 200); assert.match(pdf.ct, /pdf/)
  const logs = (await api('GET', '/audit-logs?action=VERIFY_REPORT', { token: superadmin })).json.data
  assert.ok(logs.length >= 1)
})
