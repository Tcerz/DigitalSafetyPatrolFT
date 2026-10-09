import { prisma } from '../config/database.js'
import { AppError } from '../common/AppError.js'
import { reportScope } from '../common/scope.js'
import { toId } from '../common/pagination.js'

export async function findReport(user, id, include) {
  const r = await prisma.safetyReport.findFirst({
    where: { id: toId(id, 'Laporan tidak ditemukan.'), deletedAt: null, AND: [reportScope(user)] },
    ...(include ? { include } : {}),
  })
  if (!r) throw new AppError(404, 'Laporan tidak ditemukan.')
  return r
}
// PETUGAS: hanya draft miliknya. SUPERADMIN: selama belum CLOSED. ADMIN: tidak mengedit isi laporan.
export const canEditReport = (u, r) =>
  u.role === 'SUPERADMIN' ? r.status !== 'CLOSED' : u.role === 'PETUGAS' && r.createdById === u.id && r.status === 'DRAFT'
