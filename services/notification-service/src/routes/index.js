import { Router } from 'express'
import { authenticate, internalOnly } from '../common/auth.middleware.js'
import * as c from '../controllers/notification.controller.js'

const r = Router()
r.post('/internal/notify', internalOnly, c.create)
r.use('/api', authenticate)
r.get('/api/notifications', c.list)
r.get('/api/notifications/unread', c.unread)
r.put('/api/notifications/read-all', c.markAllRead)
r.put('/api/notifications/:id/read', c.markRead)
export default r
