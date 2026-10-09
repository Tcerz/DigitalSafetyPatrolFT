import { handle } from '../common/controller.js'
import * as s from '../services/auth.service.js'
import * as u from '../services/user.service.js'
import { prisma } from '../config/database.js'

export const login = handle(s.login, { message: 'Login berhasil' })
export const me = handle(s.me)
export const logout = handle(s.logout, { message: 'Logout berhasil' })
export const changePassword = handle(s.changePassword, { message: 'Password berhasil diubah' })

export const list = handle((req) => u.list(req.user, req.query))
export const get = handle((req) => u.get(req.user, req.params.id))
export const create = handle(u.create, { status: 201, message: 'User berhasil dibuat' })
export const update = handle(u.update, { message: 'User berhasil diperbarui' })
export const remove = handle(u.remove, { message: 'User berhasil dihapus' })

// Endpoint internal (dipanggil service lain)
export const admins = handle(async (req) => {
  const depotId = Number(req.query.depotId)
  const rows = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null, depotId }, select: { id: true } })
  return rows.map((r) => r.id)
})
export const stats = handle(async () => ({ totalUser: await prisma.user.count({ where: { deletedAt: null } }) }))
