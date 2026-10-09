// Seed data demo/development (idempotent: aman dijalankan berulang, tidak menimpa data yang sudah ada).
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PASSWORD = process.env.SEED_PASSWORD || 'Password123!' // HANYA untuk development, ganti di production.

async function main() {
  const depot = await prisma.depot.upsert({
    where: { code: 'SSK' }, update: {},
    create: { code: 'SSK', name: 'Fuel Terminal Sei Siak', location: 'Pekanbaru, Riau' },
  })
  const products = {}
  for (const [code, name] of [['PLT', 'Pertalite'], ['PMX', 'Pertamax'], ['SLR', 'Solar']])
    products[code] = await prisma.product.upsert({ where: { code }, update: {}, create: { code, name } })
  for (const [tankNumber, code, capacity] of [['T-101', 'PLT', 5000], ['T-102', 'PMX', 4000], ['T-103', 'SLR', 6000]])
    await prisma.tank.upsert({
      where: { depotId_tankNumber: { depotId: depot.id, tankNumber } }, update: {},
      create: { tankNumber, depotId: depot.id, productId: products[code].id, capacity },
    })
  for (const [employeeNumber, name, position] of [['EMP-001', 'Ahmad', 'Operator'], ['EMP-002', 'Budi', 'Operator'], ['EMP-003', 'Citra', 'Supervisor'], ['EMP-004', 'Dedi', 'Teknisi']])
    await prisma.personnel.upsert({ where: { employeeNumber }, update: {}, create: { employeeNumber, name, position, depotId: depot.id } })
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  for (const [username, name, role, depotId] of [['superadmin', 'Super Admin', 'SUPERADMIN', null], ['admin', 'Admin Sei Siak', 'ADMIN', depot.id], ['petugas', 'Petugas Sei Siak', 'PETUGAS', depot.id]])
    await prisma.user.upsert({ where: { username }, update: {}, create: { username, name, role, depotId, email: `${username}@safetypatrol.local`, passwordHash } })
  console.log('Seed selesai. User demo: superadmin / admin / petugas (password dari SEED_PASSWORD).')
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
