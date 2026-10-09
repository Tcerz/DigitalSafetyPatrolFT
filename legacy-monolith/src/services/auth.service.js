import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/database.js'
import { env } from '../config/environment.js'
import { AppError } from '../utils/AppError.js'
import { loginBody, passwordBody } from '../validators/schemas.js'
import { userOut } from '../utils/serializers.js'
import { audit } from '../utils/audit.js'

const DUMMY = bcrypt.hashSync('dummy-password', 10) // samakan waktu respon saat user tidak ada

export async function login(req) {
  const { username, password } = loginBody.parse(req.body)
  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username.toLowerCase() }], deletedAt: null },
    include: { depot: { select: { name: true } } },
  })
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY)
  if (!user || !ok || user.status !== 'ACTIVE') throw new AppError(401, 'Username atau password tidak valid.')
  await audit(prisma, req, 'LOGIN', 'User', user.id, `${user.name} login`, user.id)
  const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
  return { token, user: userOut(user) }
}
export const me = async (req) => userOut(req.user)
// Token stateless: logout dicatat di audit, token dibuang oleh client dan kedaluwarsa sesuai JWT_EXPIRES_IN.
export const logout = async (req) => { await audit(prisma, req, 'LOGOUT', 'User', req.user.id, `${req.user.name} logout`); return null }
export async function changePassword(req) {
  const { currentPassword, newPassword } = passwordBody.parse(req.body)
  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) throw new AppError(422, 'Password saat ini salah.')
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } })
    await audit(tx, req, 'UPDATE_USER', 'User', req.user.id, `${req.user.name} mengubah password`)
  })
  return null
}
