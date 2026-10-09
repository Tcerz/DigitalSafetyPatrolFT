import { prisma } from '../config/database.js'
import { env } from '../config/environment.js'
import { AppError } from '../utils/AppError.js'
import { CATEGORIES } from '../constants/index.js'
import { findReport } from '../utils/reportAccess.js'
import { photoOut } from '../utils/serializers.js'
import { toId } from '../utils/pagination.js'
import { audit } from '../utils/audit.js'
import { matchesSignature, removeFile } from '../middleware/upload.middleware.js'

// PETUGAS hanya pada draft miliknya; ADMIN/SUPERADMIN selama laporan belum CLOSED.
const canAttach = (u, r) => (u.role === 'PETUGAS' ? r.createdById === u.id && r.status === 'DRAFT' : r.status !== 'CLOSED')

export async function list(req) {
  const r = await findReport(req.user, req.params.id)
  return (await prisma.evidence.findMany({ where: { reportId: r.id }, orderBy: { id: 'asc' } })).map(photoOut)
}

export async function upload(req) {
  const f = req.file
  if (!f) throw new AppError(422, 'File wajib diunggah.')
  try {
    const u = req.user
    const r = await findReport(u, req.params.id)
    if (!canAttach(u, r)) throw new AppError(403, 'Foto tidak dapat ditambahkan pada laporan ini.')
    if ((await prisma.evidence.count({ where: { reportId: r.id } })) >= env.maxPhotos) throw new AppError(422, `Maksimal ${env.maxPhotos} foto per laporan.`)
    if (!matchesSignature(f.path)) throw new AppError(422, 'Format file tidak didukung.')
    const category = String(req.body.category || 'OTHER').trim().toUpperCase().replace(/\s+/g, '_')
    if (!CATEGORIES.includes(category)) throw new AppError(422, 'Kategori foto tidak valid.')
    const findingId = req.body.findingId ? toId(req.body.findingId) : null
    const caId = req.body.correctiveActionId ? toId(req.body.correctiveActionId) : null
    if (findingId && !(await prisma.finding.findFirst({ where: { id: findingId, reportId: r.id }, select: { id: true } }))) throw new AppError(422, 'Finding tidak sesuai laporan.')
    if (caId && !(await prisma.correctiveAction.findFirst({ where: { id: caId, finding: { reportId: r.id } }, select: { id: true } }))) throw new AppError(422, 'Corrective action tidak sesuai laporan.')
    return await prisma.$transaction(async (tx) => {
      const e = await tx.evidence.create({
        data: { reportId: r.id, findingId, correctiveActionId: caId, category, fileName: path0(f.originalname), filePath: f.filename, mimeType: f.mimetype, fileSize: f.size, uploadedById: u.id },
      })
      await audit(tx, req, 'UPLOAD_EVIDENCE', 'Evidence', e.id, `${u.name} mengunggah foto (${category}) pada laporan ${r.reportNumber}`)
      return photoOut(e)
    })
  } catch (e) {
    await removeFile(f.filename)
    throw e
  }
}
const path0 = (n) => String(n || 'foto').replace(/[\\/]/g, '_').slice(0, 200)

export async function remove(req) {
  const e = await prisma.evidence.findUnique({ where: { id: toId(req.params.id, 'Foto tidak ditemukan.') } })
  if (!e) throw new AppError(404, 'Foto tidak ditemukan.')
  const r = await findReport(req.user, e.reportId) // 404 bila bukan kewenangannya
  if (!canAttach(req.user, r)) throw new AppError(403, 'Foto tidak dapat dihapus pada laporan ini.')
  await prisma.$transaction(async (tx) => {
    await tx.evidence.delete({ where: { id: e.id } })
    await audit(tx, req, 'DELETE_EVIDENCE', 'Evidence', e.id, `${req.user.name} menghapus foto pada laporan ${r.reportNumber}`)
  })
  await removeFile(e.filePath)
  return null
}
