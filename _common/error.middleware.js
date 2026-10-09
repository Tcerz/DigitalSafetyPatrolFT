import { ZodError } from 'zod'
import { AppError } from './AppError.js'
import { log } from './logger.js'

export const notFound = (req, res, next) => next(new AppError(404, 'Endpoint tidak ditemukan.'))

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let status = err.status || 500, message = err.message, errors = err.errors || []
  if (err instanceof ZodError) {
    status = 422
    errors = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
    message = errors[0] ? `${errors[0].field ? errors[0].field + ': ' : ''}${errors[0].message}` : 'Data tidak valid.'
  } else if (err.code === 'P2002') { status = 409; message = 'Data sudah ada (kode, nomor, username, atau email duplikat).' }
  else if (err.code === 'P2025') { status = 404; message = 'Data tidak ditemukan.' }
  else if (err.code === 'P2003') { status = 409; message = 'Data masih terhubung dengan data lain.' }
  else if (err.type === 'entity.parse.failed') { status = 400; message = 'Format JSON tidak valid.' }
  if (status >= 500 && !(err instanceof AppError)) { // error tak terduga: sembunyikan detail dari client
    log.error('unhandled error', { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], error: err.stack || err.message })
    message = 'Terjadi kesalahan server.'
    errors = []
  }
  res.status(status).json({ success: false, message, errors })
}
