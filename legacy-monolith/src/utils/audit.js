// client: prisma atau tx (di dalam $transaction). Jangan pernah menaruh password di description.
export const audit = (client, req, action, entity, entityId, description, userId) =>
  client.auditLog.create({
    data: { userId: userId ?? req.user?.id ?? null, action, entity, entityId: entityId ?? null, description, ipAddress: req.ip || null },
  })
