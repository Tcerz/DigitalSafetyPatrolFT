import { z } from 'zod'

const blank = (v) => (v === '' || v === undefined ? null : v)
const idField = z.preprocess(blank, z.coerce.number().int().positive().nullable())
const str = (max = 255) => z.preprocess(blank, z.string().trim().max(max).nullable())
const reqStr = (max = 255) => z.string({ required_error: 'Field ini wajib diisi.' }).trim().min(1, 'Field ini wajib diisi.').max(max)
const status = z.enum(['ACTIVE', 'INACTIVE'])

export const MASTER = {
  depot: z.object({ code: reqStr(30), name: reqStr(150), location: str(255).optional(), description: str(2000).optional(), status: status.default('ACTIVE') }),
  product: z.object({ code: reqStr(30), name: reqStr(100), description: str(2000).optional(), status: status.default('ACTIVE') }),
  tank: z.object({ tankNumber: reqStr(40), depotId: z.coerce.number().int().positive({ message: 'Depot wajib dipilih.' }), productId: idField.optional(), capacity: z.preprocess(blank, z.coerce.number().nonnegative().nullable()).optional(), status: status.default('ACTIVE') }),
  personnel: z.object({ name: reqStr(120), employeeNumber: str(40).optional(), position: str(100).optional(), depotId: z.coerce.number().int().positive({ message: 'Depot wajib dipilih.' }), status: status.default('ACTIVE') }),
}
