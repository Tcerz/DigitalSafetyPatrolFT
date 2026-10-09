import bcrypt from 'bcryptjs'
import { prisma } from '../config/database.js'
import { AppError } from '../utils/AppError.js'
import { ROLES } from '../constants/index.js'
import { userCreate, userUpdate } from '../validators/schemas.js'
import { depotScope } from '../utils/scope.js'
import { userOut } from '../utils/serializers.js'
import { pageParams, pageMeta, pick, toId } from '../utils/pagination.js'
import { audit } from '../utils/audit.js'
import { listResult } from '../utils/controller.js'

const INC = { depot: { select: { name: true } } }
async function load(u, id) {
  const row = await prisma.user.findFirst({ where: { id: toId(id, 'User tidak ditemukan.'), deletedAt: null, ...depotScope(u) }, include: INC })
  if (!row) throw new AppError(404, 'User tidak ditemukan.')
  return row
}
async function checkDepot(role, depotId) {
  if (role !== 'SUPERADMIN' && !depotId) throw new AppError(422, 'Depot wajib dipilih untuk role Petugas dan Admin.')
  if (depotId && !(await prisma.depot.findFirst({ where: { id: depotId, deletedAt: null }, select: { id: true } }))) throw new AppError(422, 'Depot tidak valid.')
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
    prisma.user.findMany({ where, include: INC, orderBy: { id: 'asc' }, skip: p.skip, take: p.take }),
  ])
  return listResult(rows.map(userOut), pageMeta(p, total))
}
export const get = async (u, id) => userOut(await load(u, id))

export async function create(req) {
  const { password, ...data } = userCreate.parse(req.body)
  await checkDepot(data.role, data.depotId)
  const row = await prisma.$transaction(async (tx) => {
    const r = await tx.user.create({ data: { ...data, depotId: data.depotId ?? null, passwordHash: await bcrypt.hash(password, 10) }, include: INC })
    await audit(tx, req, 'CREATE_USER', 'User', r.id, `${req.user.name} membuat user ${r.username}`)
    return r
  })
  return userOut(row)
}
export async function update(req) {
  const old = await load(req.user, req.params.id)
  const { password, ...data } = userUpdate.parse(req.body)
  const role = data.role ?? old.role, depotId = data.depotId !== undefined ? data.depotId : old.depotId
  await checkDepot(role, depotId)
  if (old.id === req.user.id && (data.status === 'INACTIVE' || (data.role && data.role !== old.role))) throw new AppError(422, 'Anda tidak dapat menonaktifkan atau mengubah role akun sendiri.')
  const row = await prisma.$transaction(async (tx) => {
    const r = await tx.user.update({ where: { id: old.id }, data: { ...data, ...(password && { passwordHash: await bcrypt.hash(password, 10) }) }, include: INC })
    await audit(tx, req, 'UPDATE_USER', 'User', r.id, `${req.user.name} memperbarui user ${r.username}${password ? ' (password direset)' : ''}`)
    return r
  })
  return userOut(row)
}
export async function remove(req) {
  const old = await load(req.user, req.params.id)
  if (old.id === req.user.id) throw new AppError(422, 'Anda tidak dapat menghapus akun sendiri.')
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: old.id }, data: { deletedAt: new Date(), status: 'INACTIVE' } })
    await audit(tx, req, 'DELETE_USER', 'User', old.id, `${req.user.name} menghapus user ${old.username}`)
  })
  return null
}
