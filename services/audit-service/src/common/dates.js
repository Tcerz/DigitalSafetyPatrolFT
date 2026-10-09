import { AppError } from './AppError.js'

const pad = (n) => String(n).padStart(2, '0')
// "Hari ini" menurut zona waktu server (set TZ), dinyatakan sebagai tanggal UTC 00:00 agar cocok dengan kolom DATE.
export const todayDate = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) }
export const addDays = (d, n) => new Date(d.getTime() + n * 86400000)
export const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
export const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
export function parseDate(s) {
  if (s instanceof Date) return s
  const d = new Date(`${String(s).slice(0, 10)}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(s)) || Number.isNaN(d.getTime())) throw new AppError(422, 'Format tanggal harus YYYY-MM-DD.')
  return d
}
// Rentang tanggal dari query: from/to (atau startDate/endDate) atau range 7d | 30d | 6m
export function dateRange(q) {
  const from = q.from || q.startDate, to = q.to || q.endDate
  if (from || to) return { gte: from ? parseDate(from) : undefined, lte: to ? parseDate(to) : undefined }
  const t = todayDate()
  if (q.range === '7d') return { gte: addDays(t, -6), lte: t }
  if (q.range === '30d') return { gte: addDays(t, -29), lte: t }
  if (q.range === '6m') return { gte: new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 5, 1)), lte: t }
  return {}
}
