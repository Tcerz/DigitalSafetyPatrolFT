import jwt from 'jsonwebtoken'
import { env } from '../config/environment.js'
import { prisma } from '../config/database.js'
import { AppError } from '../utils/AppError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

// Role dan status selalu dibaca ulang dari database, bukan dari token / frontend.
export const authenticate = asyncHandler(async (req, res, next) => {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) throw new AppError(401, 'Autentikasi diperlukan.')
  let payload
  try { payload = jwt.verify(token, env.jwtSecret) } catch { throw new AppError(401, 'Sesi tidak valid atau sudah berakhir.') }
  const user = await prisma.user.findFirst({
    where: { id: Number(payload.sub), deletedAt: null, status: 'ACTIVE' },
    include: { depot: { select: { name: true } } },
  })
  if (!user) throw new AppError(401, 'Sesi tidak valid atau sudah berakhir.')
  req.user = user
  next()
})
