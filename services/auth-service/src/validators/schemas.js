import { z } from 'zod'

const blank = (v) => (v === '' || v === undefined ? null : v)
const idField = z.preprocess(blank, z.coerce.number().int().positive().nullable())
const reqStr = (max = 255) => z.string({ required_error: 'Field ini wajib diisi.' }).trim().min(1, 'Field ini wajib diisi.').max(max)

export const loginBody = z.object({ username: reqStr(160), password: z.string().min(1, 'Password wajib diisi.').max(200) })
export const passwordBody = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8, 'Password baru minimal 8 karakter.').max(100) })
export const userCreate = z.object({
  name: reqStr(120), username: z.string().trim().regex(/^[a-zA-Z0-9._-]{3,60}$/, 'Username 3-60 karakter (huruf, angka, . _ -).'),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.').max(160), role: z.enum(['PETUGAS', 'ADMIN', 'SUPERADMIN']),
  depotId: idField.optional(), status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'), password: z.string().min(8, 'Password minimal 8 karakter.').max(100),
})
export const userUpdate = userCreate.partial().extend({ password: z.string().min(8, 'Password minimal 8 karakter.').max(100).optional() })
