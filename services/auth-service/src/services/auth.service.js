import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/database.js'
import { env } from '../common/env.js'
import { AppError } from '../common/AppError.js'
import { audit } from '../common/http.js'
import { loginBody, passwordBody } from '../validators/schemas.js'
import { userOut } from '../utils/serializers.js'

const DUMMY = bcrypt.hashSync('dummy-password', 10) // samakan waktu respon saat user tidak ada

export async function login(req) {
  const { username, password } = loginBody.parse(req.body)
  const user = await prisma.user.findFirst({ where: { OR: [{ username }, { email: username.toLowerCase() }], deletedAt: null } })
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY)
  if (!user || !ok || user.status !== 'ACTIVE') throw new AppError(401, 'Username atau password tidak valid.')
  // Token membawa identitas + role + depot; service lain memverifikasinya sendiri.
  const token = jwt.sign({ sub: user.id, name: user.name, role: user.role, depotId: user.depotId, depotName: user.depotName }, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
  audit({ id: req.id, ip: req.ip, user: { id: user.id, name: user.name } }, 'LOGIN', 'User', user.id, `${user.name} login`)
  return { token, user: userOut(user) }
}

export async function me(req) {
  const user = await prisma.user.findFirst({ where: { id: req.user.id, deletedAt: null, status: 'ACTIVE' } })
  if (!user) throw new AppError(401, 'Sesi tidak valid atau sudah berakhir.')
  return userOut(user)
}
export const logout = async (req) => { audit(req, 'LOGOUT', 'User', req.user.id, `${req.user.name} logout`); return null }

export async function changePassword(req) {
  const { currentPassword, newPassword } = passwordBody.parse(req.body)
  const user = await prisma.user.findFirst({ where: { id: req.user.id, deletedAt: null } })
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError(422, 'Password saat ini salah.')
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } })
  audit(req, 'UPDATE_USER', 'User', user.id, `${user.name} mengubah password`)
  return null
}
