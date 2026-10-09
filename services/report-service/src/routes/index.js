import { Router } from 'express'
import { authenticate, authorize } from '../common/auth.middleware.js'
import { uploadSingle } from '../utils/upload.js'
import * as c from '../controllers/report.controller.js'

const ADM = ['ADMIN', 'SUPERADMIN']
const r = Router()
r.use('/api', authenticate) // setiap service memeriksa token sendiri

// Reports
r.get('/api/reports', c.list)
r.post('/api/reports', authorize('PETUGAS', 'SUPERADMIN'), c.create)
r.get('/api/reports/:id', c.detail)
r.put('/api/reports/:id', authorize('PETUGAS', 'SUPERADMIN'), c.update)
r.delete('/api/reports/:id', authorize('PETUGAS', 'SUPERADMIN'), c.remove)
r.put('/api/reports/:id/status', c.changeStatus)
r.get('/api/reports/:id/pdf', c.pdf)
r.get('/api/reports/:id/activities', c.activities)
r.post('/api/reports/:id/activities', c.addActivity)
r.put('/api/activities/:id', c.updateActivity)
r.delete('/api/activities/:id', c.removeActivity)
r.get('/api/reports/:id/photos', c.photos)
r.post('/api/reports/:id/photos', uploadSingle, c.uploadPhoto)
r.delete('/api/photos/:id', c.removePhoto)

// Findings & corrective actions (ADMIN / SUPERADMIN; dibatasi per depot)
r.get('/api/findings', c.findings.list)
r.get('/api/findings/:id', c.findings.get)
r.post('/api/findings', authorize(...ADM), c.findings.create)
r.put('/api/findings/:id', authorize(...ADM), c.findings.update)
r.delete('/api/findings/:id', authorize(...ADM), c.findings.remove)
r.use('/api/corrective-actions', authorize(...ADM))
r.get('/api/corrective-actions', c.corrective.list)
r.post('/api/corrective-actions', c.corrective.create)
r.get('/api/corrective-actions/:id', c.corrective.get)
r.put('/api/corrective-actions/:id', c.corrective.update)
r.put('/api/corrective-actions/:id/status', c.corrective.updateStatus)
r.delete('/api/corrective-actions/:id', c.corrective.remove)

// Statistics
for (const k of ['summary', 'activity', 'trend']) r.get(`/api/statistics/${k}`, c.stats[k])
for (const k of ['tanks', 'personnel', 'products']) r.get(`/api/statistics/${k}`, authorize(...ADM), c.stats[k])
export default r
