import { prisma } from '../config/database.js'
import { AppError } from '../common/AppError.js'
import { audit } from '../common/http.js'
import { toId } from '../common/pagination.js'
import { ACTIVITY_TYPES, ACTIVITY_TITLE, COND_IN } from '../constants.js'
import { activityBody } from '../validators/schemas.js'
import { findReport, canEditReport } from '../utils/reportAccess.js'
import { activityOut } from '../utils/serializers.js'
import { recalcPriority } from '../utils/priority.js'
import { resolveRefs } from '../utils/refs.js'

const ACT_INCLUDE = { tanks: true }

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

// Simpan/ubah aktivitas dan sinkronkan finding-nya (satu finding per aktivitas UNSAFE).
// refs = hasil resolveRefs (nama personel/produk/tangki untuk snapshot).
export async function syncActivities(tx, reportId, acts, refs) {
  for (const type of ACTIVITY_TYPES) {
    const a = acts[type]
    if (!a) continue
    const condition = COND_IN[a.kondisi]
    const isJetty = type === 'LOADING' || type === 'DISCHARGE'
    const data = {
      condition, notes: a.catatan ?? null,
      personnelId: a.personnelId ?? null, personnelName: a.personnelId ? refs.personnel[a.personnelId] ?? null : null,
      productId: isJetty ? a.productId ?? null : null, productName: isJetty && a.productId ? refs.products[a.productId] ?? null : null,
      jetty1: isJetty ? a.jetty1 ?? null : null, jetty2: isJetty ? a.jetty2 ?? null : null,
      startTime: type === 'PENYALURAN' ? a.jamMulai ?? null : null, endTime: type === 'PENYALURAN' ? a.jamSelesai ?? null : null,
      tankStatus: type === 'STORAGE' ? a.statusTangki ?? null : null,
    }
    const found = await tx.patrolActivity.findUnique({ where: { reportId_activityType: { reportId, activityType: type } } })
    const act = found
      ? await tx.patrolActivity.update({ where: { id: found.id }, data })
      : await tx.patrolActivity.create({ data: { ...data, reportId, activityType: type } })
    if (type === 'STORAGE') {
      await tx.activityTank.deleteMany({ where: { activityId: act.id } })
      if (a.tankIds?.length) await tx.activityTank.createMany({ data: [...new Set(a.tankIds)].map((tankId) => ({ activityId: act.id, tankId, tankNumber: refs.tanks[tankId] ?? String(tankId) })) })
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
  const refs = await resolveRefs(req, report.depotId, null, { [type]: body }, report.depotName)
  await prisma.$transaction((tx) => syncActivities(tx, report.id, { [type]: body }, refs))
  audit(req, 'UPDATE_REPORT', 'SafetyReport', report.id, `${req.user.name} mengubah aktivitas ${ACTIVITY_TITLE[type]} pada laporan ${report.reportNumber}`)
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
  })
  audit(req, 'UPDATE_REPORT', 'SafetyReport', report.id, `${req.user.name} menghapus aktivitas ${ACTIVITY_TITLE[a.activityType]} dari laporan ${report.reportNumber}`)
  return null
}
