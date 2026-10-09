import { PRIORITIES } from '../constants.js'
// Prioritas laporan = prioritas tertinggi dari finding-nya (LOW jika tidak ada finding).
export async function recalcPriority(tx, reportId) {
  const fs = await tx.finding.findMany({ where: { reportId }, select: { priority: true } })
  const p = fs.length ? PRIORITIES[Math.max(...fs.map((f) => PRIORITIES.indexOf(f.priority)))] : 'LOW'
  await tx.safetyReport.update({ where: { id: reportId }, data: { priority: p } })
}
