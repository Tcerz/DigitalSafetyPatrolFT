import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { env } from '../config/environment.js'
import { AppError } from '../utils/AppError.js'

export const UPLOAD_ROOT = path.resolve(env.uploadDir)
fs.mkdirSync(UPLOAD_ROOT, { recursive: true })

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
// Nama file dibuat ulang oleh server (UUID); nama asli pengguna tidak pernah dipakai sebagai path.
const storage = multer.diskStorage({
  destination: UPLOAD_ROOT,
  filename: (req, file, cb) => cb(null, `${randomUUID()}${EXT[file.mimetype] || ''}`),
})
const upload = multer({
  storage,
  limits: { fileSize: env.maxFileMb * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(new AppError(422, 'Format file tidak didukung.'))),
})

export const uploadSingle = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError(422, 'Ukuran file terlalu besar.'))
    if (err instanceof multer.MulterError) return next(new AppError(422, 'Upload file tidak valid.'))
    next(err)
  })

// Cek signature file (cegah file yang hanya menyamar sebagai gambar).
export function matchesSignature(file) {
  const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(12); fs.readSync(fd, b, 0, 12, 0); fs.closeSync(fd)
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  const png = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const webp = b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'
  return jpg || png || webp
}
export const removeFile = (name) => fs.promises.unlink(path.join(UPLOAD_ROOT, path.basename(name))).catch(() => {})
