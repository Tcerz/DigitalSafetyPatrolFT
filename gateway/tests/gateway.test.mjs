// Tes otomatis untuk tahap CI (dijalankan: npm test di folder gateway).
// Tidak membutuhkan service lain: menguji health, versi, penjaga token, dan penutupan endpoint internal.
import test from 'node:test'
import assert from 'node:assert/strict'

Object.assign(process.env, {
  JWT_SECRET: 'ci-test-secret-1234567890', INTERNAL_KEY: 'ci-internal-key-1234567890', PORT: '0',
  APP_VERSION: '9.9.9', GIT_COMMIT: 'abc1234', BUILD_TIME: '2026-10-09T00:00:00Z',
})
const { default: app } = await import('../src/app.js')
const server = app.listen(0)
const base = `http://127.0.0.1:${server.address().port}`
test.after(() => { server.close(); setTimeout(() => process.exit(0), 100).unref() })

test('GET /health -> gateway sehat', async () => {
  const r = await fetch(`${base}/health`)
  assert.equal(r.status, 200)
  assert.equal((await r.json()).status, 'healthy')
})
test('GET /api/version -> membawa versi, commit, dan waktu build', async () => {
  const r = await fetch(`${base}/api/version`)
  const j = await r.json()
  assert.equal(r.status, 200)
  assert.equal(j.data.version, '9.9.9')
  assert.equal(j.data.commit, 'abc1234')
  assert.equal(j.data.builtAt, '2026-10-09T00:00:00Z')
})
test('GET /api/health -> tetap 200 walau layanan lain belum ada', async () => {
  const r = await fetch(`${base}/api/health`)
  const j = await r.json()
  assert.equal(r.status, 200)
  assert.equal(j.data.gateway, 'healthy')
  assert.ok(j.data.services.report)
})
test('GET /api/reports tanpa token -> 401', async () => {
  assert.equal((await fetch(`${base}/api/reports`)).status, 401)
})
test('/internal/* tidak pernah diteruskan -> 404', async () => {
  assert.equal((await fetch(`${base}/internal/audit`, { headers: { 'x-internal-key': process.env.INTERNAL_KEY } })).status, 404)
})
