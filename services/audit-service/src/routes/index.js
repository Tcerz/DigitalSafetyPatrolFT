import { Router } from 'express'
import { authenticate, authorize, internalOnly } from '../common/auth.middleware.js'
import * as c from '../controllers/audit.controller.js'

const r = Router()
r.post('/internal/audit', internalOnly, c.create)
r.get('/api/audit-logs', authenticate, authorize('SUPERADMIN'), c.list)
export default r
