import { prisma } from '../config/database.js'
import { AppError } from '../utils/AppError.js'
import { MASTER } from '../validators/schemas.js'
import { depotScope } from '../utils/scope.js'
import { pageParams, pageMeta, toId } from '../utils/pagination.js'
import { audit } from '../utils/audit.js'
import { listResult } from '../utils/controller.js'

const dec = (x) => (x == null ? null : Number(x))
// Konfigurasi master data: depot, product, tank, personnel (soft delete via deletedAt).
const CFG = {
  depots: { model: 'depot', label: 'Depot', schema: MASTER.depot, search: ['name', 'code', 'location'], scope: (u) => (u.role === 'SUPERADMIN' ? {} : { id: u.depotId ?? -1 }), ser: (d) => ({ id: d.id, code: d.code, name: d.name, location: d.location, description: d.description, status: d.status }) },
  products: { model: 'product', label: 'Product', schema: MASTER.product, search: ['name', 'code'], scope: () => ({}), ser: (p) => ({ id: p.id, code: p.code, name: p.name, description: p.description, status: p.status }) },
  tanks: { model: 'tank', label: 'Tank', schema: MASTER.tank, search: ['tankNumber'], scope: depotScope, include: { depot: { select: { name: true } }, product: { select: { name: true } } },
    ser: (t) => ({ id: t.id, tankNumber: t.tankNumber, name: t.tankNumber, depotId: t.depotId, depotName: t.depot?.name, productId: t.productId, productName: t.product?.name ?? null, capacity: dec(t.capacity), status: t.status }) },
  personnel: { model: 'personnel', label: 'Personnel', schema: MASTER.personnel, search: ['name', 'employeeNumber', 'position'], scope: depotScope, include: { depot: { select: { name: true } } },
    ser: (p) => ({ id: p.id, name: p.name, employeeNumber: p.employeeNumber, position: p.position, depotId: p.depotId, depotName: p.depot?.name, status: p.status }) },
}
export const masterConfig = (key) => CFG[key]

export async function list(c, u, q) {
  const p = pageParams(q)
  const where = { deletedAt: null, ...c.scope(u) }
  if (u.role !== 'SUPERADMIN') where.status = 'ACTIVE' // lookup untuk non-superadmin hanya data aktif
  else if (['ACTIVE', 'INACTIVE'].includes(q.status)) where.status = q.status
  if (u.role === 'SUPERADMIN' && q.depotId && c.model !== 'depot' && c.model !== 'product') where.depotId = Number(q.depotId) || -1
  if (c.model === 'tank' && q.productId) where.productId = Number(q.productId) || -1
  if (q.search?.trim()) where.OR = c.search.map((f) => ({ [f]: { contains: q.search.trim() } }))
  const [total, rows] = await prisma.$transaction([
    prisma[c.model].count({ where }),
    prisma[c.model].findMany({ where, include: c.include, orderBy: { id: 'asc' }, skip: p.skip, take: p.take }),
  ])
  return listResult(rows.map(c.ser), pageMeta(p, total))
}
async function load(c, u, id) {
  const row = await prisma[c.model].findFirst({ where: { id: toId(id, `${c.label} tidak ditemukan.`), deletedAt: null, ...c.scope(u) }, include: c.include })
  if (!row) throw new AppError(404, `${c.label} tidak ditemukan.`)
  return row
}
export const get = async (c, u, id) => c.ser(await load(c, u, id))

async function checkRefs(data) {
  if (data.depotId && !(await prisma.depot.findFirst({ where: { id: data.depotId, deletedAt: null }, select: { id: true } }))) throw new AppError(422, 'Depot tidak valid.')
  if (data.productId && !(await prisma.product.findFirst({ where: { id: data.productId, deletedAt: null }, select: { id: true } }))) throw new AppError(422, 'Produk tidak valid.')
}
export async function create(c, req) {
  const data = c.schema.parse(req.body)
  await checkRefs(data)
  const row = await prisma.$transaction(async (tx) => {
    const r = await tx[c.model].create({ data, include: c.include })
    await audit(tx, req, `CREATE_${c.model.toUpperCase()}`, c.label, r.id, `${req.user.name} membuat ${c.label} #${r.id}`)
    return r
  })
  return c.ser(row)
}
export async function update(c, req) {
  const old = await load(c, req.user, req.params.id)
  const data = c.schema.partial().parse(req.body)
  await checkRefs(data)
  const row = await prisma.$transaction(async (tx) => {
    const r = await tx[c.model].update({ where: { id: old.id }, data, include: c.include })
    await audit(tx, req, `UPDATE_${c.model.toUpperCase()}`, c.label, r.id, `${req.user.name} memperbarui ${c.label} #${r.id}`)
    return r
  })
  return c.ser(row)
}
export async function remove(c, req) {
  const old = await load(c, req.user, req.params.id)
  await prisma.$transaction(async (tx) => {
    await tx[c.model].update({ where: { id: old.id }, data: { deletedAt: new Date(), status: 'INACTIVE' } })
    await audit(tx, req, `DELETE_${c.model.toUpperCase()}`, c.label, old.id, `${req.user.name} menghapus ${c.label} #${old.id}`)
  })
  return null
}
