import { prisma } from '../config/database.js'
import { AppError } from '../utils/AppError.js'
import { PRIORITIES } from '../constants/index.js'
import { findingBody, findingUpdate } from '../validators/schemas.js'
import { findReport } from '../utils/reportAccess.js'
import { reportScope } from '../utils/scope.js'
import { pageParams, pageMeta, pick, toId } from '../utils/pagination.js'
import { recalcPriority } from '../utils/priority.js'
import { audit } from '../utils/audit.js'
import { listResult } from '../utils/controller.js'

const INC = { report: { select: { reportNumber: true, depot: { select: { name: true } } } }, activity: { select: { activityType: true } } }
const out = (f) => ({
  id: f.id, reportId: f.reportId, reportNumber: f.report?.reportNumber, depotName: f.report?.depot?.name, activityType: f.activity?.activityType ?? null,
  title: f.title, description: f.description, location: f.location, priority: f.priority, status: f.status, recommendation: f.recommendation, createdAt: f.createdAt,
})
async function load(u, id) {
  const f = await prisma.finding.findFirst({ where: { id: toId(id, 'Finding tidak ditemukan.'), report: { deletedAt: null, AND: [reportScope(u)] } }, include: INC })
  if (!f) throw new AppError(404, 'Finding tidak ditemukan.')
  return f
}

export async function list(u, q) {
  const p = pageParams(q)
  const rep = { deletedAt: null, AND: [reportScope(u)] }
  if (u.role === 'SUPERADMIN' && (q.depotId || q.depot)) rep.depotId = Number(q.depotId || q.depot) || -1
  const where = { report: rep }
  if (pick(q.status, ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])) where.status = q.status
  if (pick(q.priority, PRIORITIES)) where.priority = q.priority
  if (q.reportId || q.report) where.reportId = Number(q.reportId || q.report) || -1
  if (q.assignedTo) where.correctiveActions = { some: { assignedToId: Number(q.assignedTo) || -1 } }
  const [total, rows] = await prisma.$transaction([
    prisma.finding.count({ where }),
    prisma.finding.findMany({ where, include: INC, orderBy: { id: 'desc' }, skip: p.skip, take: p.take }),
  ])
  return listResult(rows.map(out), pageMeta(p, total))
}
export const get = async (u, id) => out(await load(u, id))

export async function create(req) {
  const b = findingBody.parse(req.body)
  const r = await findReport(req.user, b.reportId)
  if (r.status === 'CLOSED') throw new AppError(422, 'Laporan sudah ditutup.')
  if (b.activityId && !(await prisma.patrolActivity.findFirst({ where: { id: b.activityId, reportId: r.id }, select: { id: true } }))) throw new AppError(422, 'Aktivitas tidak sesuai laporan.')
  const id = await prisma.$transaction(async (tx) => {
    const f = await tx.finding.create({ data: { ...b, activityId: b.activityId ?? null, location: b.location ?? null, recommendation: b.recommendation ?? null } })
    await recalcPriority(tx, r.id)
    await audit(tx, req, 'CREATE_FINDING', 'Finding', f.id, `${req.user.name} menambahkan finding pada laporan ${r.reportNumber}`)
    return f.id
  })
  return get(req.user, id)
}
export async function update(req) {
  const f = await load(req.user, req.params.id)
  const b = findingUpdate.parse(req.body)
  await prisma.$transaction(async (tx) => {
    await tx.finding.update({ where: { id: f.id }, data: b })
    await recalcPriority(tx, f.reportId)
    await audit(tx, req, 'UPDATE_FINDING', 'Finding', f.id, `${req.user.name} memperbarui finding pada laporan ${f.report.reportNumber}`)
  })
  return get(req.user, f.id)
}
export async function remove(req) {
  const f = await load(req.user, req.params.id)
  if (await prisma.correctiveAction.count({ where: { findingId: f.id } })) throw new AppError(409, 'Finding masih memiliki corrective action.')
  await prisma.$transaction(async (tx) => {
    await tx.finding.delete({ where: { id: f.id } })
    await recalcPriority(tx, f.reportId)
    await audit(tx, req, 'DELETE_FINDING', 'Finding', f.id, `${req.user.name} menghapus finding pada laporan ${f.report.reportNumber}`)
  })
  return null
}
