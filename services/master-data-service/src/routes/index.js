import { Router } from 'express'
import { authenticate, authorize, internalOnly } from '../common/auth.middleware.js'
import { masterController, internal } from '../controllers/master.controller.js'

const SA = ['SUPERADMIN']
const r = Router()

// Internal (hanya antar-service)
r.post('/internal/resolve', internalOnly, internal.resolve)
r.get('/internal/depots/:id', internalOnly, internal.depot)
r.get('/internal/stats', internalOnly, internal.stats)

r.use('/api', authenticate)
// Baca: semua role (dibatasi depot). Tulis: hanya SUPERADMIN.
for (const key of ['depots', 'products', 'tanks', 'personnel']) {
  const c = masterController(key)
  r.get(`/api/${key}`, c.list)
  r.get(`/api/${key}/:id`, c.get)
  r.post(`/api/${key}`, authorize(...SA), c.create)
  r.put(`/api/${key}/:id`, authorize(...SA), c.update)
  r.delete(`/api/${key}/:id`, authorize(...SA), c.remove)
}
export default r
