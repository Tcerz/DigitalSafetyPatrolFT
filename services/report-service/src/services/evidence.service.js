import { prisma } from '../config/database.js'
import { uploadConfig } from '../utils/uploadConfig.js'
import { AppError } from '../common/AppError.js'
import { audit } from '../common/http.js'
import { toId } from '../common/pagination.js'
import { CATEGORIES } from '../constants.js'
import { findReport } from '../utils/reportAccess.js'
import { photoOut } from '../utils/serializers.js'
import { matchesSignature, removeFile } from '../utils/upload.js'

// PETUGAS hanya pada draft miliknya; ADMIN/SUPERADMIN selama laporan belum CLOSED.
const canAttach = (u, r) => (u.role === 'PETUGAS' ? r.createdById === u.id && r.status === 'DRAFT' : r.status !== 'CLOSED')
const safeName = (n) => String(n || 'foto').replace(/[\\/]/g, '_').slice(0, 200)

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
    if ((await prisma.evidence.count({ where: { reportId: r.id } })) >= uploadConfig.maxPhotos) throw new AppError(422, `Maksimal ${uploadConfig.maxPhotos} foto per laporan.`)
    if (!matchesSignature(f.path)) throw new AppError(422, 'Format file tidak didukung.')
    const category = String(req.body.category || 'OTHER').trim().toUpperCase().replace(/\s+/g, '_')
    if (!CATEGORIES.includes(category)) throw new AppError(422, 'Kategori foto tidak valid.')
    const findingId = req.body.findingId ? toId(req.body.findingId) : null
    const caId = req.body.correctiveActionId ? toId(req.body.correctiveActionId) : null
    if (findingId && !(await prisma.finding.findFirst({ where: { id: findingId, reportId: r.id }, select: { id: true } }))) throw new AppError(422, 'Finding tidak sesuai laporan.')
    if (caId && !(await prisma.correctiveAction.findFirst({ where: { id: caId, finding: { reportId: r.id } }, select: { id: true } }))) throw new AppError(422, 'Corrective action tidak sesuai laporan.')
    const e = await prisma.evidence.create({
      data: { reportId: r.id, findingId, correctiveActionId: caId, category, fileName: safeName(f.originalname), filePath: f.filename, mimeType: f.mimetype, fileSize: f.size, uploadedById: u.id },
    })
    audit(req, 'UPLOAD_EVIDENCE', 'Evidence', e.id, `${u.name} mengunggah foto (${category}) pada laporan ${r.reportNumber}`)
    return photoOut(e)
  } catch (e) {
    await removeFile(f.filename)
    throw e
  }
}

export async function remove(req) {
  const e = await prisma.evidence.findUnique({ where: { id: toId(req.params.id, 'Foto tidak ditemukan.') } })
  if (!e) throw new AppError(404, 'Foto tidak ditemukan.')
  const r = await findReport(req.user, e.reportId) // 404 bila bukan kewenangannya
  if (!canAttach(req.user, r)) throw new AppError(403, 'Foto tidak dapat dihapus pada laporan ini.')
  await prisma.evidence.delete({ where: { id: e.id } })
  await removeFile(e.filePath)
  audit(req, 'DELETE_EVIDENCE', 'Evidence', e.id, `${req.user.name} menghapus foto pada laporan ${r.reportNumber}`)
  return null
}
