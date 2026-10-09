import { prisma } from '../config/database.js'
import { callService } from '../common/http.js'
import { reportScope } from '../common/scope.js'
import { pick } from '../common/pagination.js'
import { dateRange, todayDate, addDays, parseDate } from '../common/dates.js'
import { REPORT_FLOW, PRIORITIES, ACTIVITY_TYPES, OPEN_CA } from '../constants.js'

// Semua angka dihitung lewat query agregasi di report_db (count / groupBy), bukan loop di Node.js.
// Nama depot/personel/produk/tangki memakai salinan (snapshot) di report_db.
function reportWhere(u, q) {
  const where = { deletedAt: null, AND: [reportScope(u)] }
  if (u.role === 'SUPERADMIN' && q.depotId) where.depotId = Number(q.depotId) || -1
  const { gte, lte } = dateRange(q)
  if (gte || lte) where.patrolDate = { ...(gte && { gte }), ...(lte && { lte }) }
  const st = pick(q.status, REPORT_FLOW), pr = pick(q.priority, PRIORITIES), act = pick(q.activityType || q.activity, ACTIVITY_TYPES)
  if (st) where.status = st
  if (pr) where.priority = pr
  if (act) where.AND.push({ activities: { some: { activityType: act } } })
  return where
}
const overdueWhere = (w) => ({ finding: { report: w }, status: { in: OPEN_CA }, targetDate: { lt: todayDate() } })
// Data milik service lain diambil lewat API; bila service itu mati, angkanya 0 (statistik tetap tampil).
const soft = (req, name, path, key) => callService(name, path, { req }).then((d) => d[key] ?? 0).catch(() => 0)

export async function summary(u, q, req) {
  const w = reportWhere(u, q)
  const unsafeW = { ...w, AND: [...w.AND, { activities: { some: { condition: 'UNSAFE' } } }] }
  const count = (status) => prisma.safetyReport.count({ where: { ...w, status } })
  const [total, draft, submitted, inProgress, resolved, unsafe, openFinding, overdue] = await Promise.all([
    prisma.safetyReport.count({ where: w }), count('DRAFT'), count('SUBMITTED'), count('IN_PROGRESS'), count({ in: ['RESOLVED', 'CLOSED'] }),
    prisma.safetyReport.count({ where: unsafeW }),
    prisma.finding.count({ where: { report: w, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.correctiveAction.count({ where: overdueWhere(w) }),
  ])
  const out = { totalPatrol: total, draft, submitted, needVerification: submitted, inProgress, resolved, safe: total - unsafe, unsafe, openFinding, overdue }
  if (u.role === 'SUPERADMIN') {
    const grp = (where) => prisma.safetyReport.groupBy({ by: ['depotId', 'depotName'], where, _count: { _all: true } })
    const [g, gu, gr, od, totalDepot, totalUser] = await Promise.all([
      grp(w), grp(unsafeW), grp({ ...w, status: { in: ['RESOLVED', 'CLOSED'] } }),
      prisma.correctiveAction.findMany({ where: overdueWhere(w), select: { finding: { select: { report: { select: { depotId: true } } } } } }),
      soft(req, 'master', '/internal/stats', 'totalDepot'), soft(req, 'auth', '/internal/stats', 'totalUser'),
    ])
    const m = (rows) => Object.fromEntries(rows.map((r) => [r.depotId, r._count._all]))
    const [b, c] = [m(gu), m(gr)]
    const odc = {}
    od.forEach((x) => { const id = x.finding.report.depotId; odc[id] = (odc[id] || 0) + 1 })
    out.totalDepot = totalDepot
    out.totalUser = totalUser
    out.depots = g.map((d) => ({ id: d.depotId, name: d.depotName, totalPatrol: d._count._all, unsafe: b[d.depotId] || 0, resolved: c[d.depotId] || 0, overdue: odc[d.depotId] || 0 }))
  }
  return out
}

export async function activity(u, q) {
  const rows = await prisma.patrolActivity.groupBy({ by: ['activityType'], where: { report: reportWhere(u, { ...q, activityType: undefined, activity: undefined }) }, _count: { _all: true } })
  const m = Object.fromEntries(rows.map((r) => [r.activityType, r._count._all]))
  return ACTIVITY_TYPES.map((t) => ({ activity: t, count: m[t] || 0 }))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export async function trend(u, q) {
  const w = reportWhere(u, { ...q, range: undefined, from: undefined, to: undefined, startDate: undefined, endDate: undefined })
  const t = todayDate()
  let from, to = t
  if (q.range === 'custom' && (q.from || q.startDate)) { from = parseDate(q.from || q.startDate); to = q.to || q.endDate ? parseDate(q.to || q.endDate) : t }
  else if (q.range === '7d') from = addDays(t, -6)
  else if (q.range === '6m') from = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 5, 1))
  else from = addDays(t, -29)
  const rows = await prisma.safetyReport.groupBy({ by: ['patrolDate'], where: { ...w, patrolDate: { gte: from, lte: to } }, _count: { _all: true } })
  const byDay = Object.fromEntries(rows.map((r) => [r.patrolDate.toISOString().slice(0, 10), r._count._all]))
  const days = Math.round((to - from) / 86400000) + 1
  if (q.range === '6m' || days > 62) { // kelompokkan per bulan
    const buckets = new Map()
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      const k = `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
      buckets.set(k, (buckets.get(k) || 0) + (byDay[d.toISOString().slice(0, 10)] || 0))
    }
    return [...buckets].map(([label, count]) => ({ label, count }))
  }
  return Array.from({ length: days }, (_, i) => { const d = addDays(from, i); const k = d.toISOString().slice(0, 10); return { label: `${k.slice(8)}/${k.slice(5, 7)}`, count: byDay[k] || 0 } })
}

export async function tanks(u, q) {
  const rows = await prisma.activityTank.groupBy({ by: ['tankId', 'tankNumber'], where: { activity: { report: reportWhere(u, q) } }, _count: { _all: true }, orderBy: { _count: { tankId: 'desc' } }, take: 10 })
  return rows.map((r) => ({ tank: r.tankNumber, count: r._count._all }))
}
export async function personnel(u, q) {
  const rows = await prisma.patrolActivity.groupBy({ by: ['personnelId', 'personnelName'], where: { personnelId: { not: null }, report: reportWhere(u, q) }, _count: { _all: true }, orderBy: { _count: { personnelId: 'desc' } }, take: 10 })
  return rows.map((r) => ({ name: r.personnelName, count: r._count._all }))
}
export async function products(u, q) {
  const rows = await prisma.patrolActivity.groupBy({ by: ['productId', 'productName'], where: { productId: { not: null }, report: reportWhere(u, q) }, _count: { _all: true }, orderBy: { _count: { productId: 'desc' } }, take: 10 })
  return rows.map((r) => ({ name: r.productName, count: r._count._all }))
}
