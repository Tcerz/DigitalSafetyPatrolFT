import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.middleware.js'
import { authorize } from '../middleware/role.middleware.js'
import { uploadSingle } from '../middleware/upload.middleware.js'
import { masterController } from '../controllers/master.controller.js'
import * as auth from '../controllers/auth.controller.js'
import * as rep from '../controllers/report.controller.js'
import * as fin from '../controllers/finding.controller.js'
import * as ca from '../controllers/corrective.controller.js'
import * as usr from '../controllers/user.controller.js'
import * as stat from '../controllers/statistics.controller.js'
import * as ntf from '../controllers/notification.controller.js'
import * as aud from '../controllers/audit.controller.js'
import { health } from '../controllers/health.controller.js'

const ALL = ['PETUGAS', 'ADMIN', 'SUPERADMIN'], ADM = ['ADMIN', 'SUPERADMIN'], SA = ['SUPERADMIN']
const r = Router()

r.get('/health', health)

// Rate limit khusus login (mengurangi brute-force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.', errors: [] }),
})
r.post('/auth/login', loginLimiter, auth.login)

r.use(authenticate) // seluruh endpoint di bawah wajib login

r.get('/auth/me', auth.me)
r.post('/auth/logout', auth.logout)
r.put('/auth/password', auth.changePassword)

// Reports
r.get('/reports', rep.list)
r.post('/reports', authorize('PETUGAS', 'SUPERADMIN'), rep.create)
r.get('/reports/:id', rep.detail)
r.put('/reports/:id', authorize('PETUGAS', 'SUPERADMIN'), rep.update)
r.delete('/reports/:id', authorize('PETUGAS', 'SUPERADMIN'), rep.remove)
r.put('/reports/:id/status', rep.changeStatus)
r.get('/reports/:id/pdf', rep.pdf)
r.get('/reports/:id/activities', rep.activities)
r.post('/reports/:id/activities', rep.addActivity)
r.put('/activities/:id', rep.updateActivity)
r.delete('/activities/:id', rep.removeActivity)
r.get('/reports/:id/photos', rep.photos)
r.post('/reports/:id/photos', uploadSingle, rep.uploadPhoto)
r.delete('/photos/:id', rep.removePhoto)

// Findings & corrective actions (ADMIN / SUPERADMIN; dibatasi per depot)
r.get('/findings', fin.list)
r.get('/findings/:id', fin.get)
r.post('/findings', authorize(...ADM), fin.create)
r.put('/findings/:id', authorize(...ADM), fin.update)
r.delete('/findings/:id', authorize(...ADM), fin.remove)
r.use('/corrective-actions', authorize(...ADM))
r.get('/corrective-actions', ca.list)
r.post('/corrective-actions', ca.create)
r.get('/corrective-actions/:id', ca.get)
r.put('/corrective-actions/:id', ca.update)
r.put('/corrective-actions/:id/status', ca.updateStatus)
r.delete('/corrective-actions/:id', ca.remove)

// Master data: baca untuk semua role (dibatasi depot), tulis hanya SUPERADMIN
for (const [path, key] of [['depots', 'depots'], ['products', 'products'], ['tanks', 'tanks'], ['personnel', 'personnel']]) {
  const c = masterController(key)
  r.get(`/${path}`, c.list)
  r.get(`/${path}/:id`, c.get)
  r.post(`/${path}`, authorize(...SA), c.create)
  r.put(`/${path}/:id`, authorize(...SA), c.update)
  r.delete(`/${path}/:id`, authorize(...SA), c.remove)
}

// Users: ADMIN hanya dapat melihat user di depotnya; kelola penuh hanya SUPERADMIN
r.get('/users', authorize(...ADM), usr.list)
r.get('/users/:id', authorize(...ADM), usr.get)
r.post('/users', authorize(...SA), usr.create)
r.put('/users/:id', authorize(...SA), usr.update)
r.delete('/users/:id', authorize(...SA), usr.remove)

// Statistics (ADMIN / SUPERADMIN) — PETUGAS memakai summary/activity/trend untuk dashboard miliknya
for (const k of ['summary', 'activity', 'trend']) r.get(`/statistics/${k}`, stat[k])
for (const k of ['tanks', 'personnel', 'products']) r.get(`/statistics/${k}`, authorize(...ADM), stat[k])

r.get('/notifications', ntf.list)
r.get('/notifications/unread', ntf.unread)
r.put('/notifications/read-all', ntf.markAllRead)
r.put('/notifications/:id/read', ntf.markRead)

r.get('/audit-logs', authorize(...SA), aud.list)

export default r
