export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null))
const loc = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
export const todayStr = () => loc().toISOString().slice(0, 10)
export const nowTime = () => loc().toISOString().slice(11, 16)
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-')
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'
export const label = (s) => String(s ?? '').replace(/_/g, ' ')
export const STATUSES = ['DRAFT', 'SUBMITTED', 'VERIFIED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
export const ACTIVITIES = ['LOADING', 'DISCHARGE', 'PENYALURAN', 'STORAGE']
export const isOverdue = (c) => c.targetDate && c.targetDate.slice(0, 10) < todayStr() && !['RESOLVED', 'CLOSED'].includes(c.status)
export function download(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export const opt = (o) => ({ value: o.id, label: o.name || o.tankNumber || o.code || String(o.id) })
