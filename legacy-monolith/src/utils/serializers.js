import { COND_OUT, CA_OUT } from '../constants/index.js'
import { fmtDate } from './dates.js'

export const userOut = (u) => ({
  id: u.id, name: u.name, username: u.username, email: u.email, role: u.role,
  depotId: u.depotId, depotName: u.depot?.name ?? null, status: u.status, createdAt: u.createdAt,
})
export const fileUrl = (p) => (p ? `/uploads/${p}` : null)
export const photoOut = (e) => ({
  id: e.id, url: fileUrl(e.filePath), category: e.category, fileName: e.fileName,
  findingId: e.findingId, correctiveActionId: e.correctiveActionId, createdAt: e.createdAt,
})
export const kondisiOf = (activities = []) => (activities.some((a) => a.condition === 'UNSAFE') ? 'TIDAK_AMAN' : 'AMAN')

export const reportListOut = (r) => ({
  id: r.id, reportNumber: r.reportNumber, tanggal: fmtDate(r.patrolDate), jamPatrol: r.patrolTime,
  depotId: r.depotId, depotName: r.depot?.name, picName: r.picPatrol?.name ?? null, createdByName: r.createdBy?.name,
  kondisi: kondisiOf(r.activities), priority: r.priority, status: r.status,
})

export const activityOut = (a, finding) => ({
  id: a.id, kondisi: COND_OUT[a.condition], personnelId: a.personnelId, personnelName: a.personnel?.name ?? null,
  productId: a.productId, productName: a.product?.name ?? null, jetty1: a.jetty1, jetty2: a.jetty2,
  jamMulai: a.startTime, jamSelesai: a.endTime,
  tankIds: (a.tanks || []).map((t) => t.tankId), tankNames: (a.tanks || []).map((t) => t.tank?.tankNumber),
  statusTangki: a.tankStatus, catatan: a.notes, finding: finding?.description ?? '',
})

export const correctiveOut = (c, extra = {}) => ({
  id: c.id, findingId: c.findingId, action: c.description, picId: c.assignedToId, picName: c.assignedTo?.name ?? null,
  targetDate: fmtDate(c.targetDate), status: CA_OUT[c.status], rawStatus: c.status, notes: c.notes, completedAt: c.completedAt, ...extra,
})
