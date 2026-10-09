import { prisma } from '../config/database.js'
import { AppError } from '../common/AppError.js'
import { audit, notify } from '../common/http.js'
import { reportScope } from '../common/scope.js'
import { pageParams, pageMeta, pick, toId } from '../common/pagination.js'
import { parseDate, todayDate } from '../common/dates.js'
import { listResult } from '../common/controller.js'
import { PRIORITIES, CA_IN, CA_OUT, CA_TRANSITIONS, CA_TO_FINDING, OPEN_CA } from '../constants.js'
import { caCreate, caUpdate } from '../validators/schemas.js'
import { correctiveOut, fileUrl } from '../utils/serializers.js'
import { resolveRefs } from '../utils/refs.js'

const INC = {
  evidences: { orderBy: { id: 'asc' }, take: 1 },
  finding: { include: { evidences: { orderBy: { id: 'asc' }, take: 1 }, report: { select: { id: true, reportNumber: true, depotId: true, depotName: true, createdById: true, status: true } } } },
}
const scopeWhere = (u) => ({ finding: { report: { deletedAt: null, AND: [reportScope(u)] } } })
const out = (c, extra = {}) => correctiveOut(c, {
  reportId: c.finding.reportId, reportNumber: c.finding.report.reportNumber, depotName: c.finding.report.depotName, findingTitle: c.finding.title,
  priority: c.finding.priority, beforePhotoUrl: fileUrl(c.finding.evidences[0]?.filePath), afterPhotoUrl: fileUrl(c.evidences[0]?.filePath), ...extra,
})
async function load(u, id) {
  const c = await prisma.correctiveAction.findFirst({ where: { id: toId(id, 'Corrective action tidak ditemukan.'), ...scopeWhere(u) }, include: INC })
  if (!c) throw new AppError(404, 'Corrective action tidak ditemukan.')
  return c
}
async function resolvePic(req, depotId, picId) {
  const refs = await resolveRefs(req, depotId, picId, {})
  if (!refs.personnel[picId]) throw new AppError(422, 'PIC tidak valid untuk depot ini.')
  return refs.personnel[picId]
}

export async function list(u, q) {
  const p = pageParams(q)
  const where = scopeWhere(u)
  if (u.role === 'SUPERADMIN' && q.depotId) where.finding.report.depotId = Number(q.depotId) || -1
  const st = CA_IN[q.status]
  if (st) where.status = st
  if (q.status === 'OVERDUE') { where.status = { in: OPEN_CA }; where.targetDate = { lt: todayDate() } }
  if (q.picId) where.assignedToId = Number(q.picId) || -1
  if (pick(q.priority, PRIORITIES)) where.finding.priority = q.priority
  if (q.targetDate) where.targetDate = parseDate(q.targetDate)
  const [total, rows] = await prisma.$transaction([
    prisma.correctiveAction.count({ where }),
    prisma.correctiveAction.findMany({ where, include: INC, orderBy: [{ targetDate: 'asc' }, { id: 'desc' }], skip: p.skip, take: p.take }),
  ])
  return listResult(rows.map((c) => out(c)), pageMeta(p, total))
}

export async function get(u, id) {
  const c = await load(u, id)
  const [history, repEv] = await Promise.all([
    prisma.statusHistory.findMany({ where: { entityType: 'CORRECTIVE_ACTION', entityId: c.id }, orderBy: { id: 'desc' } }),
    prisma.evidence.findMany({ where: { reportId: c.finding.reportId, findingId: null, correctiveActionId: null, category: { in: ['FINDING', 'CORRECTIVE_ACTION'] } }, orderBy: { id: 'asc' } }),
  ])
  const before = c.finding.evidences[0] || repEv.find((e) => e.category === 'FINDING')
  const after = c.evidences[0] || repEv.find((e) => e.category === 'CORRECTIVE_ACTION')
  return out(c, { beforePhotoUrl: fileUrl(before?.filePath), afterPhotoUrl: fileUrl(after?.filePath), history: history.map((h) => ({ status: CA_OUT[h.status] || h.status, note: h.note, byName: h.byName ?? null, createdAt: h.createdAt })) })
}

export async function create(req) {
  const u = req.user
  const b = caCreate.parse(req.body)
  const f = await prisma.finding.findFirst({ where: { id: b.findingId, report: { deletedAt: null, AND: [reportScope(u)] } }, include: { report: true } })
  if (!f) throw new AppError(404, 'Finding tidak ditemukan.')
  if (b.reportId && b.reportId !== f.reportId) throw new AppError(422, 'Finding tidak sesuai laporan.')
  if (!['VERIFIED', 'IN_PROGRESS'].includes(f.report.status)) throw new AppError(422, 'Laporan harus terverifikasi sebelum membuat corrective action.')
  const target = parseDate(b.targetDate)
  if (target < todayDate()) throw new AppError(422, 'Target date tidak boleh sebelum hari ini.')
  if (await prisma.correctiveAction.count({ where: { findingId: f.id, status: { in: ['OPEN', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'] } } })) throw new AppError(409, 'Finding ini sudah memiliki corrective action aktif.')
  const picName = await resolvePic(req, f.report.depotId, b.picId) // PIC divalidasi lewat master-data-service
  const id = await prisma.$transaction(async (tx) => {
    const c = await tx.correctiveAction.create({ data: { findingId: f.id, description: b.action, assignedToId: b.picId, assignedToName: picName, targetDate: target } })
    await tx.statusHistory.create({ data: { entityType: 'CORRECTIVE_ACTION', entityId: c.id, status: 'OPEN', byId: u.id, byName: u.name } })
    if (f.report.status === 'VERIFIED') {
      await tx.safetyReport.update({ where: { id: f.reportId }, data: { status: 'IN_PROGRESS' } })
      await tx.statusHistory.create({ data: { entityType: 'REPORT', entityId: f.reportId, status: 'IN_PROGRESS', note: 'Corrective action dibuat', byId: u.id, byName: u.name } })
    }
    return c.id
  })
  audit(req, 'CREATE_CORRECTIVE_ACTION', 'CorrectiveAction', id, `${u.name} membuat corrective action untuk laporan ${f.report.reportNumber}`)
  notify(req, { userIds: [f.report.createdById], title: 'Corrective action ditugaskan', message: `Corrective action dibuat untuk laporan ${f.report.reportNumber}.`, type: 'CORRECTIVE_ACTION_ASSIGNED', referenceType: 'CorrectiveAction', referenceId: id })
  return get(u, id)
}

async function applyStatus(tx, req, c, next, note) {
  if (next === c.status) return false
  if (!CA_TRANSITIONS[c.status].includes(next)) throw new AppError(422, `Perubahan status ${CA_OUT[c.status]} → ${CA_OUT[next]} tidak diizinkan.`)
  await tx.correctiveAction.update({ where: { id: c.id }, data: { status: next, completedAt: next === 'COMPLETED' ? new Date() : next === 'IN_PROGRESS' ? null : undefined } })
  await tx.finding.update({ where: { id: c.findingId }, data: { status: CA_TO_FINDING[next] } })
  await tx.statusHistory.create({ data: { entityType: 'CORRECTIVE_ACTION', entityId: c.id, status: next, note: note ?? null, byId: req.user.id, byName: req.user.name } })
  return true
}
const auditStatus = (req, c, next) => audit(req, 'UPDATE_CORRECTIVE_ACTION', 'CorrectiveAction', c.id, `${req.user.name} mengubah status corrective action (${c.finding.report.reportNumber}): ${CA_OUT[c.status]} → ${CA_OUT[next]}`)

export async function update(req) {
  const c = await load(req.user, req.params.id)
  const b = caUpdate.parse(req.body)
  const next = b.status ? CA_IN[b.status] : undefined
  if (b.status && !next) throw new AppError(422, 'Status tidak valid.')
  if (c.status === 'CLOSED') throw new AppError(422, 'Corrective action yang sudah ditutup tidak dapat diubah.')
  if (b.targetDate && parseDate(b.targetDate) < todayDate() && b.targetDate !== String(c.targetDate.toISOString()).slice(0, 10)) throw new AppError(422, 'Target date tidak boleh sebelum hari ini.')
  const picName = b.picId ? await resolvePic(req, c.finding.report.depotId, b.picId) : undefined
  let changed = false
  await prisma.$transaction(async (tx) => {
    await tx.correctiveAction.update({ where: { id: c.id }, data: { ...(b.action && { description: b.action }), ...(b.picId && { assignedToId: b.picId, assignedToName: picName }), ...(b.targetDate && { targetDate: parseDate(b.targetDate) }), ...(b.notes !== undefined && { notes: b.notes }) } })
    if (next) changed = await applyStatus(tx, req, c, next, b.notes)
  })
  if (changed) auditStatus(req, c, next)
  return get(req.user, c.id)
}
export async function updateStatus(req) {
  const next = CA_IN[req.body?.status]
  if (!next) throw new AppError(422, 'Status tidak valid.')
  const c = await load(req.user, req.params.id)
  const changed = await prisma.$transaction((tx) => applyStatus(tx, req, c, next, req.body.note))
  if (changed) auditStatus(req, c, next)
  return get(req.user, c.id)
}
export async function remove(req) {
  const c = await load(req.user, req.params.id)
  if (c.status !== 'OPEN') throw new AppError(409, 'Hanya corrective action berstatus OPEN yang dapat dihapus.')
  await prisma.correctiveAction.delete({ where: { id: c.id } })
  audit(req, 'DELETE_CORRECTIVE_ACTION', 'CorrectiveAction', c.id, `${req.user.name} menghapus corrective action (${c.finding.report.reportNumber})`)
  return null
}

// Pemantauan overdue: notifikasi dikirim sekali per corrective action (dedupe di notification-service,
// sehingga aman walau report-service dijalankan lebih dari satu instance).
export async function notifyOverdue() {
  const rows = await prisma.correctiveAction.findMany({
    where: { status: { in: OPEN_CA }, targetDate: { lt: todayDate() } },
    select: { id: true, finding: { select: { report: { select: { reportNumber: true, depotId: true } } } } },
  })
  for (const r of rows)
    notify({ id: 'overdue-job' }, { depotId: r.finding.report.depotId, dedupe: true, title: 'Corrective action overdue', message: `Corrective action laporan ${r.finding.report.reportNumber} melewati target date.`, type: 'CORRECTIVE_ACTION_OVERDUE', referenceType: 'CorrectiveAction', referenceId: r.id })
  return rows.length
}
