import bcrypt from 'bcryptjs'
import { prisma } from '../config/database.js'
import { AppError } from '../common/AppError.js'
import { callService, audit } from '../common/http.js'
import { depotScope } from '../common/scope.js'
import { pageParams, pageMeta, pick, toId } from '../common/pagination.js'
import { listResult } from '../common/controller.js'
import { userCreate, userUpdate } from '../validators/schemas.js'
import { userOut } from '../utils/serializers.js'

const ROLES = ['PETUGAS', 'ADMIN', 'SUPERADMIN']
async function load(u, id) {
  const row = await prisma.user.findFirst({ where: { id: toId(id, 'User tidak ditemukan.'), deletedAt: null, ...depotScope(u) } })
  if (!row) throw new AppError(404, 'User tidak ditemukan.')
  return row
}
// Depot dimiliki master-data-service: validasi + ambil namanya lewat API (bukan lewat database).
async function depotInfo(req, role, depotId) {
  if (role !== 'SUPERADMIN' && !depotId) throw new AppError(422, 'Depot wajib dipilih untuk role Petugas dan Admin.')
  if (!depotId) return { depotName: null }
  try {
    const d = await callService('master', `/internal/depots/${depotId}`, { req })
    return { depotName: d.name }
  } catch (e) {
    if (e.status === 404) throw new AppError(422, 'Depot tidak valid.')
    throw e
  }
}

export async function list(u, q) {
  const p = pageParams(q)
  const where = { deletedAt: null, ...depotScope(u) } // ADMIN hanya melihat user di depotnya
  if (pick(q.role, ROLES)) where.role = q.role
  if (u.role === 'SUPERADMIN' && (q.depotId || q.depot)) where.depotId = Number(q.depotId || q.depot) || -1
  if (pick(q.status, ['ACTIVE', 'INACTIVE'])) where.status = q.status
  if (q.search?.trim()) where.OR = ['name', 'username', 'email'].map((f) => ({ [f]: { contains: q.search.trim() } }))
  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { id: 'asc' }, skip: p.skip, take: p.take }),
  ])
  return listResult(rows.map(userOut), pageMeta(p, total))
}
export const get = async (u, id) => userOut(await load(u, id))

export async function create(req) {
  const { password, ...data } = userCreate.parse(req.body)
  const { depotName } = await depotInfo(req, data.role, data.depotId)
  const row = await prisma.user.create({ data: { ...data, depotId: data.depotId ?? null, depotName, passwordHash: await bcrypt.hash(password, 10) } })
  audit(req, 'CREATE_USER', 'User', row.id, `${req.user.name} membuat user ${row.username}`)
  return userOut(row)
}
export async function update(req) {
  const old = await load(req.user, req.params.id)
  const { password, ...data } = userUpdate.parse(req.body)
  const role = data.role ?? old.role, depotId = data.depotId !== undefined ? data.depotId : old.depotId
  const info = await depotInfo(req, role, depotId)
  if (old.id === req.user.id && (data.status === 'INACTIVE' || (data.role && data.role !== old.role))) throw new AppError(422, 'Anda tidak dapat menonaktifkan atau mengubah role akun sendiri.')
  const row = await prisma.user.update({ where: { id: old.id }, data: { ...data, depotName: info.depotName, ...(password && { passwordHash: await bcrypt.hash(password, 10) }) } })
  audit(req, 'UPDATE_USER', 'User', row.id, `${req.user.name} memperbarui user ${row.username}${password ? ' (password direset)' : ''}`)
  return userOut(row)
}
export async function remove(req) {
  const old = await load(req.user, req.params.id)
  if (old.id === req.user.id) throw new AppError(422, 'Anda tidak dapat menghapus akun sendiri.')
  await prisma.user.update({ where: { id: old.id }, data: { deletedAt: new Date(), status: 'INACTIVE' } })
  audit(req, 'DELETE_USER', 'User', old.id, `${req.user.name} menghapus user ${old.username}`)
  return null
}
