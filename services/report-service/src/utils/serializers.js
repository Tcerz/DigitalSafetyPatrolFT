import { COND_OUT, CA_OUT } from '../constants.js'
import { fmtDate } from '../common/dates.js'

export const fileUrl = (p) => (p ? `/uploads/${p}` : null)
export const photoOut = (e) => ({
  id: e.id, url: fileUrl(e.filePath), category: e.category, fileName: e.fileName,
  findingId: e.findingId, correctiveActionId: e.correctiveActionId, createdAt: e.createdAt,
})
export const kondisiOf = (activities = []) => (activities.some((a) => a.condition === 'UNSAFE') ? 'TIDAK_AMAN' : 'AMAN')

// Nama diambil dari salinan (snapshot) di report_db -> tidak perlu memanggil service lain untuk menampilkan laporan.
export const reportListOut = (r) => ({
  id: r.id, reportNumber: r.reportNumber, tanggal: fmtDate(r.patrolDate), jamPatrol: r.patrolTime,
  depotId: r.depotId, depotName: r.depotName, picName: r.picPatrolName ?? null, createdByName: r.createdByName,
  kondisi: kondisiOf(r.activities), priority: r.priority, status: r.status,
})
export const activityOut = (a, finding) => ({
  id: a.id, kondisi: COND_OUT[a.condition], personnelId: a.personnelId, personnelName: a.personnelName ?? null,
  productId: a.productId, productName: a.productName ?? null, jetty1: a.jetty1, jetty2: a.jetty2,
  jamMulai: a.startTime, jamSelesai: a.endTime,
  tankIds: (a.tanks || []).map((t) => t.tankId), tankNames: (a.tanks || []).map((t) => t.tankNumber),
  statusTangki: a.tankStatus, catatan: a.notes, finding: finding?.description ?? '',
})
export const correctiveOut = (c, extra = {}) => ({
  id: c.id, findingId: c.findingId, action: c.description, picId: c.assignedToId, picName: c.assignedToName ?? null,
  targetDate: fmtDate(c.targetDate), status: CA_OUT[c.status], rawStatus: c.status, notes: c.notes, completedAt: c.completedAt, ...extra,
})
