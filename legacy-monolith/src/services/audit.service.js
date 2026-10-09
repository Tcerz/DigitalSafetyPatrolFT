import { prisma } from '../config/database.js'
import { pageParams, pageMeta } from '../utils/pagination.js'
import { parseDate, addDays } from '../utils/dates.js'
import { listResult } from '../utils/controller.js'

export async function list(q) {
  const p = pageParams(q)
  const where = {}
  if (q.user) where.user = /^\d+$/.test(q.user) ? { id: Number(q.user) } : { name: { contains: q.user } }
  if (q.action) where.action = { contains: q.action }
  if (q.entity) where.entity = { contains: q.entity }
  if (q.date) { const d = parseDate(q.date); where.createdAt = { gte: d, lt: addDays(d, 1) } }
  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, include: { user: { select: { name: true } } }, orderBy: { id: 'desc' }, skip: p.skip, take: p.take }),
  ])
  return listResult(rows.map((a) => ({ id: a.id, createdAt: a.createdAt, userId: a.userId, userName: a.user?.name ?? 'System', action: a.action, entity: a.entity, entityId: a.entityId, description: a.description, ipAddress: a.ipAddress })), pageMeta(p, total))
}
