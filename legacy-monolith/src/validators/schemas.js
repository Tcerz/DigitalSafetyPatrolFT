import { z } from 'zod'
import { PRIORITIES, ROLES, TANK_STATUSES, ACTIVITY_TYPES } from '../constants/index.js'

const blank = (v) => (v === '' || v === undefined ? null : v)
export const idField = z.preprocess(blank, z.coerce.number().int().positive().nullable())
export const str = (max = 255) => z.preprocess(blank, z.string().trim().max(max).nullable())
export const reqStr = (max = 255) => z.string({ required_error: 'Field ini wajib diisi.' }).trim().min(1, 'Field ini wajib diisi.').max(max)
const time = z.preprocess(blank, z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format jam harus HH:MM.').transform((s) => s.slice(0, 5)).nullable())
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Format tanggal harus YYYY-MM-DD.').transform((s) => s.slice(0, 10))
const status = z.enum(['ACTIVE', 'INACTIVE'])

export const loginBody = z.object({ username: reqStr(160), password: z.string().min(1, 'Password wajib diisi.').max(200) })
export const passwordBody = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8, 'Password baru minimal 8 karakter.').max(100) })

const activity = z.object({
  kondisi: z.enum(['AMAN', 'TIDAK_AMAN', 'SAFE', 'UNSAFE']).default('AMAN'),
  personnelId: idField.optional(), productId: idField.optional(),
  jetty1: str(50).optional(), jetty2: str(50).optional(), jamMulai: time.optional(), jamSelesai: time.optional(),
  tankIds: z.array(z.coerce.number().int().positive()).default([]),
  statusTangki: z.preprocess(blank, z.enum(TANK_STATUSES).nullable()).optional(),
  catatan: str(4000).optional(), finding: str(4000).optional(),
  findingPriority: z.enum(PRIORITIES).optional(),
})
export const activityBody = activity
export const reportBody = z.object({
  tanggal: dateStr.optional(), patrolDate: dateStr.optional(), jamPatrol: time.optional(), patrolTime: time.optional(),
  depotId: idField.optional(), picPatrolId: idField.optional(),
  loading: activity.optional(), discharge: activity.optional(), penyaluran: activity.optional(), storage: activity.optional(),
  activities: z.array(activity.extend({ activityType: z.enum(ACTIVITY_TYPES) })).optional(),
})
export const statusBody = z.object({ status: z.string().min(1, 'Status wajib diisi.'), note: str(1000).optional() })

export const findingBody = z.object({
  reportId: z.coerce.number().int().positive(), activityId: idField.optional(), title: reqStr(200), description: reqStr(4000),
  location: str(200).optional(), priority: z.enum(PRIORITIES).default('MEDIUM'), recommendation: str(4000).optional(),
})
export const findingUpdate = findingBody.omit({ reportId: true }).partial().extend({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional() })

export const caCreate = z.object({
  reportId: idField.optional(), findingId: z.coerce.number().int().positive(), action: reqStr(4000),
  picId: z.coerce.number().int().positive({ message: 'PIC wajib dipilih.' }), targetDate: dateStr,
})
export const caUpdate = z.object({
  action: reqStr(4000).optional(), picId: z.coerce.number().int().positive().optional(), targetDate: dateStr.optional(),
  notes: str(4000).optional(), status: z.string().optional(),
})

export const userCreate = z.object({
  name: reqStr(120), username: z.string().trim().regex(/^[a-zA-Z0-9._-]{3,60}$/, 'Username 3-60 karakter (huruf, angka, . _ -).'),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.').max(160), role: z.enum(ROLES),
  depotId: idField.optional(), status: status.default('ACTIVE'), password: z.string().min(8, 'Password minimal 8 karakter.').max(100),
})
export const userUpdate = userCreate.partial().extend({ password: z.string().min(8, 'Password minimal 8 karakter.').max(100).optional() })

export const MASTER = {
  depot: z.object({ code: reqStr(30), name: reqStr(150), location: str(255).optional(), description: str(2000).optional(), status: status.default('ACTIVE') }),
  product: z.object({ code: reqStr(30), name: reqStr(100), description: str(2000).optional(), status: status.default('ACTIVE') }),
  tank: z.object({ tankNumber: reqStr(40), depotId: z.coerce.number().int().positive({ message: 'Depot wajib dipilih.' }), productId: idField.optional(), capacity: z.preprocess(blank, z.coerce.number().nonnegative().nullable()).optional(), status: status.default('ACTIVE') }),
  personnel: z.object({ name: reqStr(120), employeeNumber: str(40).optional(), position: str(100).optional(), depotId: z.coerce.number().int().positive({ message: 'Depot wajib dipilih.' }), status: status.default('ACTIVE') }),
}
