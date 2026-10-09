import { prisma } from '../config/database.js'
import { AppError } from '../common/AppError.js'
import { audit, notify } from '../common/http.js'
import { reportScope, isAdminRole } from '../common/scope.js'
import { pageParams, pageMeta, pick } from '../common/pagination.js'
import { parseDate } from '../common/dates.js'
import { listResult } from '../common/controller.js'
import { REPORT_FLOW, PRIORITIES, ACTIVITY_TYPES, ACTIVITY_TITLE, COND_IN } from '../constants.js'
import { reportBody, statusBody } from '../validators/schemas.js'
import { findReport, canEditReport } from '../utils/reportAccess.js'
import { reportListOut, activityOut, photoOut, correctiveOut, fileUrl } from '../utils/serializers.js'
import { resolveRefs } from '../utils/refs.js'
import { validateActivities, syncActivities } from './activity.service.js'

const LIST_INCLUDE = { activities: { select: { condition: true } } }
const DETAIL_INCLUDE = {
  activities: { orderBy: { id: 'asc' }, include: { tanks: true } },
  findings: { orderBy: { id: 'asc' }, include: { evidences: { orderBy: { id: 'asc' } }, correctiveActions: { orderBy: { id: 'desc' }, include: { evidences: { orderBy: { id: 'asc' } } } } } },
  evidences: { orderBy: { id: 'asc' } },
}
const SORT = { createdAt: 'createdAt', tanggal: 'patrolDate', patrolDate: 'patrolDate', reportNumber: 'reportNumber', priority: 'priority', status: 'status' }

function normalize(b) {
  const acts = {}
  for (const k of ['loading', 'discharge', 'penyaluran', 'storage']) if (b[k]) acts[k.toUpperCase()] = b[k]
  for (const a of b.activities || []) acts[a.activityType] = a
  return { patrolDate: b.tanggal || b.patrolDate, patrolTime: b.jamPatrol || b.patrolTime, depotId: b.depotId, picPatrolId: b.picPatrolId, acts }
}

export async function list(user, q) {
  const p = pageParams(q)
  const AND = [reportScope(user)]
  const where = { deletedAt: null, AND }
  if (user.role === 'SUPERADMIN' && q.depotId) where.depotId = Number(q.depotId) || -1
  const status = pick(q.status, REPORT_FLOW), priority = pick(q.priority, PRIORITIES)
  if (status) where.status = status
  if (priority) where.priority = priority
  const pic = q.picId || q.picPatrolId, by = q.createdBy
  if (pic) where.picPatrolId = Number(pic) || -1
  if (by) where.createdById = Number(by) || -1
  if (q.tanggal) where.patrolDate = parseDate(q.tanggal)
  else if (q.startDate || q.endDate || q.from || q.to) {
    const s = q.startDate || q.from, e = q.endDate || q.to
    where.patrolDate = { ...(s && { gte: parseDate(s) }), ...(e && { lte: parseDate(e) }) }
  }
  const cond = COND_IN[q.condition]
  if (cond === 'UNSAFE') AND.push({ activities: { some: { condition: 'UNSAFE' } } })
  if (cond === 'SAFE') AND.push({ activities: { none: { condition: 'UNSAFE' } } })
  const act = pick(q.activityType || q.activity, ACTIVITY_TYPES)
  if (act) AND.push({ activities: { some: { activityType: act } } })
  if (q.search?.trim()) {
    const s = q.search.trim()
    AND.push({ OR: [{ reportNumber: { contains: s } }, { picPatrolName: { contains: s } }, { createdByName: { contains: s } }] })
  }
  const dir = (q.sortDir || q.sortOrder) === 'asc' ? 'asc' : 'desc'
  const orderBy = [{ [SORT[q.sortBy] || 'createdAt']: dir }, { id: 'desc' }]
  const [total, rows] = await prisma.$transaction([
    prisma.safetyReport.count({ where }),
    prisma.safetyReport.findMany({ where, include: LIST_INCLUDE, orderBy, skip: p.skip, take: p.take }),
  ])
  return listResult(rows.map(reportListOut), pageMeta(p, total))
}

function detailOut(r, history) {
  const byAct = Object.fromEntries(r.findings.filter((f) => f.activityId).map((f) => [f.activityId, f]))
  const repBefore = r.evidences.find((e) => e.category === 'FINDING' && !e.findingId)
  const repAfter = r.evidences.find((e) => e.category === 'CORRECTIVE_ACTION' && !e.correctiveActionId)
  const out = { ...reportListOut(r), picPatrolId: r.picPatrolId, submittedAt: r.submittedAt, verifiedAt: r.verifiedAt, closedAt: r.closedAt }
  for (const a of r.activities) out[a.activityType.toLowerCase()] = activityOut(a, byAct[a.id])
  out.photos = r.evidences.map(photoOut)
  out.findings = r.findings.map((f) => {
    const ca = f.correctiveActions[0]
    return {
      id: f.id, activityType: r.activities.find((a) => a.id === f.activityId)?.activityType ?? null, title: f.title, description: f.description,
      location: f.location, priority: f.priority, status: f.status, recommendation: f.recommendation,
      photoUrl: fileUrl((f.evidences[0] || repBefore)?.filePath),
      correctiveAction: ca ? correctiveOut(ca, { afterPhotoUrl: fileUrl((ca.evidences[0] || repAfter)?.filePath) }) : null,
    }
  })
  out.statusHistory = history.map((h) => ({ id: h.id, status: h.status, note: h.note, byName: h.byName ?? null, createdAt: h.createdAt }))
  return out
}

export async function getDetail(user, id) {
  const r = await findReport(user, id, DETAIL_INCLUDE)
  const history = await prisma.statusHistory.findMany({ where: { entityType: 'REPORT', entityId: r.id }, orderBy: { id: 'asc' } })
  return detailOut(r, history)
}

async function nextNumber(tx, dateStr) {
  const prefix = `SP-${dateStr.replaceAll('-', '')}-`
  const last = await tx.safetyReport.findFirst({ where: { reportNumber: { startsWith: prefix } }, orderBy: { reportNumber: 'desc' }, select: { reportNumber: true } })
  return prefix + String(last ? parseInt(last.reportNumber.slice(prefix.length), 10) + 1 : 1).padStart(4, '0')
}

export async function create(req) {
  const u = req.user
  if (u.role === 'ADMIN') throw new AppError(403, 'Admin tidak dapat membuat laporan patrol.')
  const n = normalize(reportBody.parse(req.body))
  const depotId = u.role === 'PETUGAS' ? u.depotId : n.depotId
  if (!depotId) throw new AppError(422, 'Depot wajib diisi.')
  if (!n.patrolDate) throw new AppError(422, 'Tanggal patrol wajib diisi.')
  if (!n.patrolTime) throw new AppError(422, 'Jam patrol wajib diisi.')
  validateActivities(n.acts)
  const patrolDate = parseDate(n.patrolDate)
  const refs = await resolveRefs(req, depotId, n.picPatrolId, n.acts) // validasi + nama dari master-data-service
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await prisma.$transaction(async (tx) => {
        const reportNumber = await nextNumber(tx, n.patrolDate)
        const rep = await tx.safetyReport.create({
          data: { reportNumber, depotId, depotName: refs.depotName, createdById: u.id, createdByName: u.name, picPatrolId: n.picPatrolId ?? null, picPatrolName: n.picPatrolId ? refs.personnel[n.picPatrolId] : null, patrolDate, patrolTime: n.patrolTime },
        })
        await syncActivities(tx, rep.id, n.acts, refs)
        await tx.statusHistory.create({ data: { entityType: 'REPORT', entityId: rep.id, status: 'DRAFT', byId: u.id, byName: u.name } })
        return rep
      })
      audit(req, 'CREATE_REPORT', 'SafetyReport', r.id, `${u.name} membuat laporan ${r.reportNumber}`)
      return getDetail(u, r.id)
    } catch (e) {
      if (e.code === 'P2002' && attempt < 2) continue // bentrok nomor laporan -> coba nomor berikutnya
      throw e
    }
  }
}

export async function update(req) {
  const u = req.user
  const r = await findReport(u, req.params.id)
  if (!canEditReport(u, r)) throw new AppError(403, 'Laporan tidak dapat diubah pada status ini.')
  const n = normalize(reportBody.parse(req.body))
  validateActivities(n.acts)
  const refs = await resolveRefs(req, r.depotId, n.picPatrolId, n.acts, r.depotName)
  await prisma.$transaction(async (tx) => {
    await tx.safetyReport.update({
      where: { id: r.id },
      data: {
        ...(n.patrolDate && { patrolDate: parseDate(n.patrolDate) }), ...(n.patrolTime && { patrolTime: n.patrolTime }),
        ...(n.picPatrolId !== undefined && { picPatrolId: n.picPatrolId, picPatrolName: n.picPatrolId ? refs.personnel[n.picPatrolId] : null }),
      },
    })
    await syncActivities(tx, r.id, n.acts, refs)
  })
  audit(req, 'UPDATE_REPORT', 'SafetyReport', r.id, `${u.name} memperbarui laporan ${r.reportNumber}`)
  return getDetail(u, r.id)
}

export async function remove(req) {
  const u = req.user
  const r = await findReport(u, req.params.id)
  if (!canEditReport(u, r)) throw new AppError(403, 'Laporan pada status ini tidak dapat dihapus.')
  await prisma.safetyReport.update({ where: { id: r.id }, data: { deletedAt: new Date() } }) // soft delete
  audit(req, 'DELETE_REPORT', 'SafetyReport', r.id, `${u.name} menghapus laporan ${r.reportNumber}`)
  return null
}

function checkSubmittable(r) {
  const errors = []
  const add = (field, message) => errors.push({ field, message })
  if (!r.picPatrolId) add('picPatrolId', 'PIC Patrol wajib diisi.')
  for (const type of ACTIVITY_TYPES) {
    const t = ACTIVITY_TITLE[type], a = r.activities.find((x) => x.activityType === type)
    if (!a) { add(type, `Aktivitas ${t} belum diisi.`); continue }
    if (!a.personnelId) add(type, `Personel ${t} wajib diisi.`)
    if ((type === 'LOADING' || type === 'DISCHARGE') && !a.productId) add(type, `Produk ${t} wajib diisi.`)
    if (type === 'PENYALURAN' && (!a.startTime || !a.endTime)) add(type, 'Jam mulai dan jam selesai Penyaluran wajib diisi.')
    if (type === 'STORAGE' && (!a.tanks.length || !a.tankStatus)) add(type, 'Tangki dan status tangki Storage wajib diisi.')
    if (a.condition === 'UNSAFE' && !r.findings.some((f) => f.activityId === a.id)) add(type, `Finding ${t} wajib tersedia.`)
  }
  if (errors.length) throw new AppError(422, errors[0].message, errors)
}

const ACTION = { SUBMITTED: 'SUBMIT_REPORT', VERIFIED: 'VERIFY_REPORT' }

export async function changeStatus(req) {
  const u = req.user
  const { status: to, note } = statusBody.parse(req.body)
  if (!REPORT_FLOW.includes(to)) throw new AppError(422, 'Status tidak valid.')
  const r = await findReport(u, req.params.id, { activities: { include: { tanks: true } }, findings: { include: { correctiveActions: true } } })
  const from = r.status
  const allowed = REPORT_FLOW.indexOf(to) === REPORT_FLOW.indexOf(from) + 1 || (from === 'VERIFIED' && to === 'CLOSED' && !r.findings.length)
  if (!allowed) throw new AppError(422, `Perubahan status ${from} → ${to} tidak diizinkan.`)
  const ownDraft = from === 'DRAFT' && (u.role === 'SUPERADMIN' || (u.role === 'PETUGAS' && r.createdById === u.id))
  if (!ownDraft && !(from !== 'DRAFT' && isAdminRole(u))) throw new AppError(403, 'Anda tidak berwenang mengubah status ini.')
  if (to === 'SUBMITTED') checkSubmittable(r)
  if (to === 'RESOLVED' && r.findings.length && !r.findings.every((f) => f.correctiveActions.some((c) => ['COMPLETED', 'CLOSED'].includes(c.status))))
    throw new AppError(422, 'Semua temuan harus memiliki corrective action yang selesai sebelum laporan diselesaikan.')

  await prisma.$transaction(async (tx) => {
    const now = new Date()
    await tx.safetyReport.update({ where: { id: r.id }, data: { status: to, ...(to === 'SUBMITTED' && { submittedAt: now }), ...(to === 'VERIFIED' && { verifiedAt: now }), ...(to === 'CLOSED' && { closedAt: now }) } })
    await tx.statusHistory.create({ data: { entityType: 'REPORT', entityId: r.id, status: to, note: note ?? null, byId: u.id, byName: u.name } })
  })
  // Efek samping dikirim SETELAH commit dan tanpa menunggu (audit/notifikasi mati != laporan gagal).
  audit(req, ACTION[to] || 'CHANGE_STATUS', 'SafetyReport', r.id, `${u.name} mengubah status laporan ${r.reportNumber}: ${from} → ${to}`)
  const ref = { referenceType: 'SafetyReport', referenceId: r.id }
  if (to === 'SUBMITTED') {
    notify(req, { depotId: r.depotId, title: 'Laporan menunggu verifikasi', message: `Laporan ${r.reportNumber} menunggu verifikasi.`, type: 'REPORT_SUBMITTED', ...ref })
    if (r.findings.length) notify(req, { depotId: r.depotId, title: 'Temuan baru', message: `Laporan ${r.reportNumber} memiliki ${r.findings.length} temuan tidak aman.`, type: 'FINDING_CREATED', ...ref })
    notify(req, { userIds: [r.createdById], title: 'Laporan terkirim', message: `Laporan ${r.reportNumber} berhasil disubmit.`, type: 'SYSTEM', ...ref })
  }
  if (to === 'VERIFIED') notify(req, { userIds: [r.createdById], title: 'Laporan terverifikasi', message: `Laporan ${r.reportNumber} telah diverifikasi.`, type: 'REPORT_VERIFIED', ...ref })
  if (to === 'RESOLVED') notify(req, { userIds: [r.createdById], title: 'Laporan selesai', message: `Laporan ${r.reportNumber} telah diselesaikan.`, type: 'REPORT_RESOLVED', ...ref })
  return getDetail(u, r.id)
}
