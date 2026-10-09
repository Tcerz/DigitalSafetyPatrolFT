import { prisma } from '../config/database.js'
export async function health(req, res) {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ success: true, message: 'API is healthy' })
  } catch {
    res.status(503).json({ success: false, message: 'Database tidak tersedia.', errors: [] })
  }
}
