import { handle } from '../utils/controller.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import * as r from '../services/report.service.js'
import * as a from '../services/activity.service.js'
import * as e from '../services/evidence.service.js'
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
