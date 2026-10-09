import { z } from 'zod'
import { prisma } from '../config/database.js'
import { pageParams, pageMeta } from '../common/pagination.js'
import { parseDate, addDays } from '../common/dates.js'
import { listResult } from '../common/controller.js'

export async function list(q) {
  const p = pageParams(q)
  const where = {}
  if (q.user) where.OR = /^\d+$/.test(q.user) ? [{ userId: Number(q.user) }] : [{ userName: { contains: q.user } }]
  if (q.action) where.action = { contains: q.action }
  if (q.entity) where.entity = { contains: q.entity }
  if (q.date) { const d = parseDate(q.date); where.createdAt = { gte: d, lt: addDays(d, 1) } }
  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { id: 'desc' }, skip: p.skip, take: p.take }),
  ])
  return listResult(rows.map((a) => ({ id: a.id, createdAt: a.createdAt, userId: a.userId, userName: a.userName ?? 'System', action: a.action, entity: a.entity, entityId: a.entityId, description: a.description, ipAddress: a.ipAddress })), pageMeta(p, total))
}
const body = z.object({
  userId: z.number().int().nullable().optional(), userName: z.string().max(120).nullable().optional(), action: z.string().max(60), entity: z.string().max(60),
  entityId: z.number().int().nullable().optional(), description: z.string().max(4000), ipAddress: z.string().max(64).nullable().optional(),
})
export async function create(req) {
  const b = body.parse(req.body)
  await prisma.auditLog.create({ data: { userId: b.userId ?? null, userName: b.userName ?? null, action: b.action, entity: b.entity, entityId: b.entityId ?? null, description: b.description, ipAddress: b.ipAddress ?? null } })
  return null
}
