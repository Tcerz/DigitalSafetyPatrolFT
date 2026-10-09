import { z } from 'zod'
import { prisma } from '../config/database.js'
import { AppError } from '../common/AppError.js'
import { callService } from '../common/http.js'
import { pageParams, pageMeta, toId } from '../common/pagination.js'
import { listResult } from '../common/controller.js'

const LINK = { SafetyReport: (id) => `/reports/${id}`, CorrectiveAction: (id) => `/corrective-actions/${id}` }
const out = (n) => ({
  id: n.id, title: n.title, message: n.message, type: n.type, read: n.isRead, isRead: n.isRead, createdAt: n.createdAt,
  referenceType: n.referenceType, referenceId: n.referenceId, link: n.referenceType && n.referenceId ? LINK[n.referenceType]?.(n.referenceId) ?? null : null,
})

export async function list(u, q, onlyUnread = false) {
  const p = pageParams(q)
  const where = { userId: u.id, ...(onlyUnread || q.unread === 'true' ? { isRead: false } : {}) }
  const [total, rows] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.findMany({ where, orderBy: { id: 'desc' }, skip: p.skip, take: p.take }),
  ])
  return listResult(rows.map(out), pageMeta(p, total))
}
export async function markRead(u, id) {
  const r = await prisma.notification.updateMany({ where: { id: toId(id), userId: u.id }, data: { isRead: true } })
  if (!r.count) throw new AppError(404, 'Notifikasi tidak ditemukan.')
  return null
}
export const markAllRead = async (u) => { await prisma.notification.updateMany({ where: { userId: u.id, isRead: false }, data: { isRead: true } }); return null }

const notifyBody = z.object({
  userIds: z.array(z.number().int().positive()).optional(), depotId: z.number().int().positive().optional(),
  title: z.string().max(200), message: z.string().max(2000),
  type: z.enum(['REPORT_SUBMITTED', 'REPORT_VERIFIED', 'FINDING_CREATED', 'CORRECTIVE_ACTION_ASSIGNED', 'CORRECTIVE_ACTION_OVERDUE', 'REPORT_RESOLVED', 'SYSTEM']).default('SYSTEM'),
  referenceType: z.string().max(40).optional(), referenceId: z.number().int().optional(), dedupe: z.boolean().optional(),
})
// Dipanggil service lain. Target: userIds langsung, atau semua ADMIN pada depot (dicari lewat auth-service).
export async function create(req) {
  const b = notifyBody.parse(req.body)
  let ids = [...(b.userIds || [])]
  if (b.depotId) ids.push(...(await callService('auth', `/internal/admins?depotId=${b.depotId}`, { req })))
  ids = [...new Set(ids)]
  if (b.dedupe && ids.length) { // jangan kirim ulang notifikasi yang sama (mis. overdue)
    const done = await prisma.notification.findMany({ where: { userId: { in: ids }, type: b.type, referenceType: b.referenceType ?? null, referenceId: b.referenceId ?? null }, select: { userId: true } })
    const skip = new Set(done.map((d) => d.userId))
    ids = ids.filter((i) => !skip.has(i))
  }
  if (ids.length) await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, title: b.title, message: b.message, type: b.type, referenceType: b.referenceType ?? null, referenceId: b.referenceId ?? null })) })
  return { created: ids.length }
}
