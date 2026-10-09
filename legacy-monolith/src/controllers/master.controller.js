import { handle } from '../utils/controller.js'
import * as s from '../services/master.service.js'
// Menghasilkan handler CRUD untuk satu jenis master data (depots | products | tanks | personnel).
export const masterController = (key) => {
  const c = s.masterConfig(key)
  return {
    list: handle((req) => s.list(c, req.user, req.query)),
    get: handle((req) => s.get(c, req.user, req.params.id)),
    create: handle((req) => s.create(c, req), { status: 201, message: 'Data berhasil dibuat' }),
    update: handle((req) => s.update(c, req), { message: 'Data berhasil diperbarui' }),
    remove: handle((req) => s.remove(c, req), { message: 'Data berhasil dihapus' }),
  }
}
