export const notify = (client, userIds, { title, message, type, referenceType, referenceId }) => {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return Promise.resolve()
  return client.notification.createMany({ data: ids.map((userId) => ({ userId, title, message, type, referenceType, referenceId })) })
}
export const depotAdminIds = async (client, depotId) =>
  (await client.user.findMany({ where: { depotId, role: 'ADMIN', status: 'ACTIVE', deletedAt: null }, select: { id: true } })).map((u) => u.id)
