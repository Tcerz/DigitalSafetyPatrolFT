import { handle } from '../utils/controller.js'
import * as s from '../services/user.service.js'
export const list = handle((req) => s.list(req.user, req.query))
export const get = handle((req) => s.get(req.user, req.params.id))
export const create = handle(s.create, { status: 201, message: 'User berhasil dibuat' })
export const update = handle(s.update, { message: 'User berhasil diperbarui' })
export const remove = handle(s.remove, { message: 'User berhasil dihapus' })
