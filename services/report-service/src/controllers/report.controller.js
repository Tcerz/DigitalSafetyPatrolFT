import { handle } from '../common/controller.js'
import { asyncHandler } from '../common/asyncHandler.js'
import * as r from '../services/report.service.js'
import * as a from '../services/activity.service.js'
import * as e from '../services/evidence.service.js'
import * as f from '../services/finding.service.js'
import * as c from '../services/corrective.service.js'
import * as st from '../services/statistics.service.js'
import { streamReportPdf } from '../services/pdf.service.js'

export const list = handle((req) => r.list(req.user, req.query))
export const detail = handle((req) => r.getDetail(req.user, req.params.id))
export const create = handle(r.create, { status: 201, message: 'Laporan berhasil dibuat' })
export const update = handle(r.update, { message: 'Laporan berhasil diperbarui' })
export const remove = handle(r.remove, { message: 'Laporan berhasil dihapus' })
export const changeStatus = handle(r.changeStatus, { message: 'Status laporan berhasil diperbarui' })
export const pdf = asyncHandler(streamReportPdf)

export const activities = handle((req) => a.list(req.user, req.params.id))
export const addActivity = handle(a.create, { status: 201, message: 'Aktivitas berhasil disimpan' })
export const updateActivity = handle(a.update, { message: 'Aktivitas berhasil diperbarui' })
export const removeActivity = handle(a.remove, { message: 'Aktivitas berhasil dihapus' })

export const photos = handle(e.list)
export const uploadPhoto = handle(e.upload, { status: 201, message: 'Foto berhasil diunggah' })
export const removePhoto = handle(e.remove, { message: 'Foto berhasil dihapus' })

export const findings = {
  list: handle((req) => f.list(req.user, req.query)), get: handle((req) => f.get(req.user, req.params.id)),
  create: handle(f.create, { status: 201, message: 'Finding berhasil dibuat' }), update: handle(f.update, { message: 'Finding berhasil diperbarui' }),
  remove: handle(f.remove, { message: 'Finding berhasil dihapus' }),
}
export const corrective = {
  list: handle((req) => c.list(req.user, req.query)), get: handle((req) => c.get(req.user, req.params.id)),
  create: handle(c.create, { status: 201, message: 'Corrective action berhasil dibuat' }), update: handle(c.update, { message: 'Corrective action berhasil diperbarui' }),
  updateStatus: handle(c.updateStatus, { message: 'Status berhasil diperbarui' }), remove: handle(c.remove, { message: 'Corrective action berhasil dihapus' }),
}
export const stats = {
  summary: handle((req) => st.summary(req.user, req.query, req)), activity: handle((req) => st.activity(req.user, req.query)),
  trend: handle((req) => st.trend(req.user, req.query)), tanks: handle((req) => st.tanks(req.user, req.query)),
  personnel: handle((req) => st.personnel(req.user, req.query)), products: handle((req) => st.products(req.user, req.query)),
}
