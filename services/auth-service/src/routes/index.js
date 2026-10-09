import { Router } from 'express'
import { authenticate, authorize, internalOnly } from '../common/auth.middleware.js'
import * as c from '../controllers/auth.controller.js'

const ADM = ['ADMIN', 'SUPERADMIN'], SA = ['SUPERADMIN']
const r = Router()

r.post('/api/auth/login', c.login)

// Internal (hanya antar-service, butuh X-Internal-Key)
r.get('/internal/admins', internalOnly, c.admins)
r.get('/internal/stats', internalOnly, c.stats)

r.use('/api', authenticate)
r.get('/api/auth/me', c.me)
r.post('/api/auth/logout', c.logout)
r.put('/api/auth/password', c.changePassword)

// Users: ADMIN hanya dapat melihat user di depotnya; kelola penuh hanya SUPERADMIN
r.get('/api/users', authorize(...ADM), c.list)
r.get('/api/users/:id', authorize(...ADM), c.get)
r.post('/api/users', authorize(...SA), c.create)
r.put('/api/users/:id', authorize(...SA), c.update)
r.delete('/api/users/:id', authorize(...SA), c.remove)
export default r
