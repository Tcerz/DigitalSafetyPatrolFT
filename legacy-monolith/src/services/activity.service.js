import { prisma } from '../config/database.js'
import { AppError } from '../utils/AppError.js'
import { ACTIVITY_TYPES, ACTIVITY_TITLE, COND_IN } from '../constants/index.js'
import { activityBody } from '../validators/schemas.js'
import { findReport, canEditReport } from '../utils/reportAccess.js'
import { activityOut } from '../utils/serializers.js'
import { recalcPriority } from '../utils/priority.js'
import { audit } from '../utils/audit.js'
import { toId } from '../utils/pagination.js'

const ACT_INCLUDE = { personnel: { select: { name: true } }, product: { select: { name: true } }, tanks: { include: { tank: { select: { tankNumber: true } } } } }

// Aturan bisnis (PRD §20, §64): kondisi UNSAFE wajib punya deskripsi finding.
export function validateActivities(acts) {
  const errors = []
  for (const type of ACTIVITY_TYPES) {
    const a = acts[type]
    if (a && COND_IN[a.kondisi] === 'UNSAFE' && !a.finding?.trim())
      errors.push({ field: `${type.toLowerCase()}.finding`, message: `Deskripsi temuan wajib diisi untuk kondisi Tidak Aman (${ACTIVITY_TITLE[type]}).` })
  }
  if (errors.length) throw new AppError(422, errors[0].message, errors)
}

// Pastikan personel, tangki, dan produk yang dirujuk valid dan sesuai depot.
export async function assertRefs(tx, depotId, picId, acts) {
  if (!(await tx.depot.findFirst({ where: { id: depotId, deletedAt: null, status: 'ACTIVE' }, select: { id: true } })))
    throw new AppError(422, 'Depot tidak valid.')
  const all = Object.values(acts)
  const uniq = (xs) => [...new Set(xs.filter(Boolean))]
  const people = uniq([picId, ...all.map((a) => a.personnelId)])
  const tanks = uniq(all.flatMap((a) => a.tankIds || []))
  const products = uniq(all.map((a) => a.productId))
  if (people.length && (await tx.personnel.count({ where: { id: { in: people }, depotId, deletedAt: null } })) !== people.length)
    throw new AppError(422, 'Personel tidak valid untuk depot ini.')
  if (tanks.length && (await tx.tank.count({ where: { id: { in: tanks }, depotId, deletedAt: null } })) !== tanks.length)
    throw new AppError(422, 'Tangki tidak valid untuk depot ini.')
  if (products.length && (await tx.product.count({ where: { id: { in: products }, deletedAt: null } })) !== products.length)
    throw new AppError(422, 'Produk tidak valid.')
}

// Simpan/ubah aktivitas dan sinkronkan finding-nya (satu finding per aktivitas UNSAFE).
export async function syncActivities(tx, reportId, acts) {
  for (const type of ACTIVITY_TYPES) {
    const a = acts[type]
    if (!a) continue
    const condition = COND_IN[a.kondisi]
    const data = {
      condition, notes: a.catatan ?? null, personnelId: a.personnelId ?? null,
      productId: type === 'LOADING' || type === 'DISCHARGE' ? a.productId ?? null : null,
      jetty1: type === 'LOADING' || type === 'DISCHARGE' ? a.jetty1 ?? null : null,
      jetty2: type === 'LOADING' || type === 'DISCHARGE' ? a.jetty2 ?? null : null,
      startTime: type === 'PENYALURAN' ? a.jamMulai ?? null : null, endTime: type === 'PENYALURAN' ? a.jamSelesai ?? null : null,
      tankStatus: type === 'STORAGE' ? a.statusTangki ?? null : null,
    }
    const found = await tx.patrolActivity.findUnique({ where: { reportId_activityType: { reportId, activityType: type } } })
    const act = found
      ? await tx.patrolActivity.update({ where: { id: found.id }, data })
      : await tx.patrolActivity.create({ data: { ...data, reportId, activityType: type } })
    if (type === 'STORAGE') {
      await tx.activityTank.deleteMany({ where: { activityId: act.id } })
      if (a.tankIds?.length) await tx.activityTank.createMany({ data: [...new Set(a.tankIds)].map((tankId) => ({ activityId: act.id, tankId })) })
    }
    const f = await tx.finding.findFirst({ where: { activityId: act.id } })
    if (condition === 'UNSAFE') {
      if (f) await tx.finding.update({ where: { id: f.id }, data: { description: a.finding, ...(a.findingPriority ? { priority: a.findingPriority } : {}) } })
      else await tx.finding.create({ data: { reportId, activityId: act.id, title: `Temuan ${ACTIVITY_TITLE[type]}`, description: a.finding, location: ACTIVITY_TITLE[type], priority: a.findingPriority || 'MEDIUM' } })
    } else if (f && !(await tx.correctiveAction.count({ where: { findingId: f.id } }))) {
      await tx.finding.delete({ where: { id: f.id } })
    }
  }
  await recalcPriority(tx, reportId)
}

async function loadActivity(u, id) {
  const a = await prisma.patrolActivity.findUnique({ where: { id: toId(id, 'Aktivitas tidak ditemukan.') }, include: ACT_INCLUDE })
  if (!a) throw new AppError(404, 'Aktivitas tidak ditemukan.')
  const report = await findReport(u, a.reportId)
  return { a, report }
}
const withFinding = async (client, a) => activityOut(a, await client.finding.findFirst({ where: { activityId: a.id } }))

export async function list(u, reportId) {
  const r = await findReport(u, reportId)
  const rows = await prisma.patrolActivity.findMany({ where: { reportId: r.id }, include: ACT_INCLUDE, orderBy: { id: 'asc' } })
  return Promise.all(rows.map(async (a) => ({ activityType: a.activityType, ...(await withFinding(prisma, a)) })))
}

async function save(req, report, type) {
  if (!canEditReport(req.user, report)) throw new AppError(403, 'Laporan tidak dapat diubah pada status ini.')
  const body = activityBody.parse(req.body)
  validateActivities({ [type]: body })
  await prisma.$transaction(async (tx) => {
    await assertRefs(tx, report.depotId, null, { [type]: body })
    await syncActivities(tx, report.id, { [type]: body })
    await audit(tx, req, 'UPDATE_REPORT', 'SafetyReport', report.id, `${req.user.name} mengubah aktivitas ${ACTIVITY_TITLE[type]} pada laporan ${report.reportNumber}`)
  })
  const a = await prisma.patrolActivity.findUnique({ where: { reportId_activityType: { reportId: report.id, activityType: type } }, include: ACT_INCLUDE })
  return { activityType: type, ...(await withFinding(prisma, a)) }
}
export async function create(req) {
  const type = String(req.body.activityType || '').toUpperCase()
  if (!ACTIVITY_TYPES.includes(type)) throw new AppError(422, 'activityType tidak valid.')
  return save(req, await findReport(req.user, req.params.id), type)
}
export async function update(req) {
  const { a, report } = await loadActivity(req.user, req.params.id)
  return save(req, report, a.activityType)
}
export async function remove(req) {
  const { a, report } = await loadActivity(req.user, req.params.id)
  if (!canEditReport(req.user, report)) throw new AppError(403, 'Laporan tidak dapat diubah pada status ini.')
  await prisma.$transaction(async (tx) => {
    const fs = await tx.finding.findMany({ where: { activityId: a.id }, include: { _count: { select: { correctiveActions: true } } } })
    for (const f of fs) if (!f._count.correctiveActions) await tx.finding.delete({ where: { id: f.id } })
    await tx.patrolActivity.delete({ where: { id: a.id } })
    await recalcPriority(tx, report.id)
    await audit(tx, req, 'UPDATE_REPORT', 'SafetyReport', report.id, `${req.user.name} menghapus aktivitas ${ACTIVITY_TITLE[a.activityType]} dari laporan ${report.reportNumber}`)
  })
  return null
}
