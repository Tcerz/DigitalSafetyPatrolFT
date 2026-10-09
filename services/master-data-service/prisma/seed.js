// Seed master data demo (idempotent). ID dibuat tetap (depot id=1) karena auth-service merujuk depot 1.
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const depot = await prisma.depot.upsert({
  where: { code: 'SSK' }, update: {},
  create: { id: 1, code: 'SSK', name: 'Fuel Terminal Sei Siak', location: 'Pekanbaru, Riau' },
})
const products = {}
for (const [id, code, name] of [[1, 'PLT', 'Pertalite'], [2, 'PMX', 'Pertamax'], [3, 'SLR', 'Solar']])
  products[code] = await prisma.product.upsert({ where: { code }, update: {}, create: { id, code, name } })
for (const [tankNumber, code, capacity] of [['T-101', 'PLT', 5000], ['T-102', 'PMX', 4000], ['T-103', 'SLR', 6000]])
  await prisma.tank.upsert({ where: { depotId_tankNumber: { depotId: depot.id, tankNumber } }, update: {}, create: { tankNumber, depotId: depot.id, productId: products[code].id, capacity } })
for (const [employeeNumber, name, position] of [['EMP-001', 'Ahmad', 'Operator'], ['EMP-002', 'Budi', 'Operator'], ['EMP-003', 'Citra', 'Supervisor'], ['EMP-004', 'Dedi', 'Teknisi']])
  await prisma.personnel.upsert({ where: { employeeNumber }, update: {}, create: { employeeNumber, name, position, depotId: depot.id } })
console.log('Seed master-data-service selesai.')
await prisma.$disconnect()
