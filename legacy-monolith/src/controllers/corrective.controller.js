import { handle } from '../utils/controller.js'
import * as s from '../services/corrective.service.js'
export const list = handle((req) => s.list(req.user, req.query))
export const get = handle((req) => s.get(req.user, req.params.id))
export const create = handle(s.create, { status: 201, message: 'Corrective action berhasil dibuat' })
export const update = handle(s.update, { message: 'Corrective action berhasil diperbarui' })
export const updateStatus = handle(s.updateStatus, { message: 'Status berhasil diperbarui' })
export const remove = handle(s.remove, { message: 'Corrective action berhasil dihapus' })
