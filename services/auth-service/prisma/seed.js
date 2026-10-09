// Seed user demo (idempotent). depotId 1 = depot "Fuel Terminal Sei Siak" yang dibuat seed master-data-service.
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PASSWORD = process.env.SEED_PASSWORD || 'Password123!' // HANYA untuk development
const DEPOT = { id: 1, name: 'Fuel Terminal Sei Siak' }

const passwordHash = await bcrypt.hash(PASSWORD, 10)
for (const [username, name, role, depot] of [
  ['superadmin', 'Super Admin', 'SUPERADMIN', null], ['admin', 'Admin Sei Siak', 'ADMIN', DEPOT], ['petugas', 'Petugas Sei Siak', 'PETUGAS', DEPOT],
]) {
  await prisma.user.upsert({
    where: { username }, update: {},
    create: { username, name, role, depotId: depot?.id ?? null, depotName: depot?.name ?? null, email: `${username}@safetypatrol.local`, passwordHash },
  })
}
console.log('Seed auth-service selesai (user: superadmin / admin / petugas).')
await prisma.$disconnect()
