// Service layer: seluruh komunikasi dengan backend lewat file ini.
import { api } from '@/api'

const u = (p) => p.then((r) => r.data)
const crud = (b) => ({
  list: (q) => u(api.get(b, { params: q })),
  get: (id) => u(api.get(`${b}/${id}`)),
  create: (d) => u(api.post(b, d)),
  update: (id, d) => u(api.put(`${b}/${id}`, d)),
  remove: (id) => u(api.delete(`${b}/${id}`)),
})

export const authService = {
  login: (d) => u(api.post('/auth/login', d)),
  me: () => u(api.get('/auth/me')),
  logout: () => u(api.post('/auth/logout')),
  changePassword: (d) => u(api.put('/auth/password', d)),
}
export const reportService = {
  ...crud('/reports'),
  setStatus: (id, status, note) => u(api.put(`/reports/${id}/status`, { status, note })),
  photos: (id) => u(api.get(`/reports/${id}/photos`)),
  uploadPhoto: (id, file, category) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('category', category)
    return u(api.post(`/reports/${id}/photos`, fd))
  },
  deletePhoto: (id) => u(api.delete(`/photos/${id}`)),
  pdf: (id) => api.get(`/reports/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
}
export const userService = crud('/users')
export const depotService = crud('/depots')
export const productService = crud('/products')
export const tankService = crud('/tanks')
export const personnelService = crud('/personnel')
export const correctiveActionService = crud('/corrective-actions')
export const auditService = { list: (q) => u(api.get('/audit-logs', { params: q })) }
export const statisticsService = Object.fromEntries(
  ['summary', 'activity', 'trend', 'tanks', 'personnel', 'products'].map((k) => [k, (q) => u(api.get(`/statistics/${k}`, { params: q }))])
)
export const notificationService = {
  list: (q) => u(api.get('/notifications', { params: q })),
  markRead: (id) => u(api.put(`/notifications/${id}/read`)),
  markAllRead: () => u(api.put('/notifications/read-all')),
}
