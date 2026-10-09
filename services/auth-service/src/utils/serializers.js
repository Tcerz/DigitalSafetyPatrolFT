export const userOut = (u) => ({
  id: u.id, name: u.name, username: u.username, email: u.email, role: u.role,
  depotId: u.depotId, depotName: u.depotName ?? null, status: u.status, createdAt: u.createdAt,
})
