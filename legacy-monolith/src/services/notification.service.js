import { prisma } from '../config/database.js'
import { AppError } from '../utils/AppError.js'
import { pageParams, pageMeta, toId } from '../utils/pagination.js'
import { listResult } from '../utils/controller.js'

const LINK = { SafetyReport: (id) => `/reports/${id}`, CorrectiveAction: (id) => `/corrective-actions/${id}` }
const out = (n) => ({
  id: n.id, title: n.title, message: n.message, type: n.type, read: n.isRead, isRead: n.isRead, createdAt: n.createdAt,
  referenceType: n.referenceType, referenceId: n.referenceId, link: n.referenceType && n.referenceId ? LINK[n.referenceType]?.(n.referenceId) ?? null : null,
})
export async function list(u, q, onlyUnread = false) {
  const p = pageParams(q)
  const where = { userId: u.id, ...(onlyUnread || q.unread === 'true' || q.unread === true ? { isRead: false } : {}) }
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
