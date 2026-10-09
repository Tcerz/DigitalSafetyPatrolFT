import jwt from 'jsonwebtoken'
import { env } from './env.js'
import { AppError } from './AppError.js'

// Setiap service memverifikasi sendiri token JWT (tidak percaya begitu saja pada gateway).
// Klaim token: sub (id), name, role, depotId, depotName.
export function authenticate(req, res, next) {
  const h = req.headers.authorization || ''
  if (!h.startsWith('Bearer ')) return next(new AppError(401, 'Autentikasi diperlukan.'))
  try {
    const p = jwt.verify(h.slice(7), env.jwtSecret)
    req.user = { id: Number(p.sub), name: p.name, role: p.role, depotId: p.depotId ?? null, depotName: p.depotName ?? null }
    next()
  } catch {
    next(new AppError(401, 'Sesi tidak valid atau sudah berakhir.'))
  }
}
export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(new AppError(403, 'Anda tidak memiliki akses.'))

// Endpoint /internal/* hanya untuk komunikasi antar-service (tidak pernah diteruskan gateway).
export function internalOnly(req, res, next) {
  if (req.headers['x-internal-key'] !== env.internalKey) return next(new AppError(403, 'Akses internal ditolak.'))
  next()
}
