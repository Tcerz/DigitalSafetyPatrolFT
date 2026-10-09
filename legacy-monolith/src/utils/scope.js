// Pembatasan data berdasarkan role (authorization sisi backend, tidak mengandalkan frontend).
// PETUGAS: laporan miliknya. ADMIN: laporan depotnya (draft petugas tidak terlihat). SUPERADMIN: semua.
export const reportScope = (u) =>
  u.role === 'SUPERADMIN' ? {} : u.role === 'ADMIN' ? { depotId: u.depotId ?? -1, status: { not: 'DRAFT' } } : { createdById: u.id }
export const depotScope = (u) => (u.role === 'SUPERADMIN' ? {} : { depotId: u.depotId ?? -1 })
export const isAdminRole = (u) => u.role === 'ADMIN' || u.role === 'SUPERADMIN'
