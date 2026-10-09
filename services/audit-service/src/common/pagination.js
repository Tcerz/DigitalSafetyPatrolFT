import { AppError } from './AppError.js'

export function pageParams(q, def = 20, max = 200) {
  const page = Math.max(1, parseInt(q.page) || 1)
  const limit = Math.min(max, Math.max(1, parseInt(q.limit) || def))
  return { page, limit, skip: (page - 1) * limit, take: limit }
}
export const pageMeta = (p, total) => ({ page: p.page, limit: p.limit, total, totalPages: Math.max(1, Math.ceil(total / p.limit)) })
// Ambil nilai query hanya jika termasuk daftar yang diizinkan (cegah nilai enum tidak valid).
export const pick = (v, allowed) => (allowed.includes(v) ? v : undefined)
export const toId = (v, msg = 'Data tidak ditemukan.') => {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new AppError(404, msg)
  return n
}
