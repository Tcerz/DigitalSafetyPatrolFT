import { userService, depotService, productService, tankService, personnelService, auditService } from '@/services'

const ROLES = ['PETUGAS', 'ADMIN', 'SUPERADMIN'].map((v) => ({ value: v, label: v }))
const STATUS = ['ACTIVE', 'INACTIVE'].map((v) => ({ value: v, label: v }))

// Konfigurasi halaman master data (satu komponen CrudView dipakai bersama).
export const CRUDS = {
  users: {
    title: 'Users', path: 'users', service: userService,
    cols: [['name', 'Name'], ['email', 'Email'], ['role', 'Role'], ['depotName', 'Depot'], ['status', 'Status']],
    fields: [
      { k: 'name', l: 'Name', req: 1 }, { k: 'username', l: 'Username', req: 1 },
      { k: 'email', l: 'Email', type: 'email', req: 1 },
      { k: 'role', l: 'Role', type: 'select', opts: ROLES, req: 1 },
      { k: 'depotId', l: 'Depot', type: 'select', lookup: 'depots' },
      { k: 'status', l: 'Status', type: 'select', opts: STATUS, req: 1 },
      { k: 'password', l: 'Password', type: 'password', createOnly: 1 },
    ],
  },
  depots: {
    title: 'Depots', path: 'depots', service: depotService,
    cols: [['name', 'Depot Name'], ['code', 'Code'], ['location', 'Location'], ['status', 'Status']],
    fields: [{ k: 'name', l: 'Depot Name', req: 1 }, { k: 'code', l: 'Code', req: 1 }, { k: 'location', l: 'Location' }, { k: 'status', l: 'Status', type: 'select', opts: STATUS, req: 1 }],
  },
  products: {
    title: 'Products', path: 'master-data/products', service: productService,
    cols: [['name', 'Product'], ['code', 'Code'], ['status', 'Status']],
    fields: [{ k: 'name', l: 'Product', req: 1 }, { k: 'code', l: 'Code', req: 1 }, { k: 'status', l: 'Status', type: 'select', opts: STATUS, req: 1 }],
  },
  tanks: {
    title: 'Tanks', path: 'master-data/tanks', service: tankService,
    cols: [['tankNumber', 'Tank Number'], ['depotName', 'Depot'], ['productName', 'Product'], ['capacity', 'Capacity'], ['status', 'Status']],
    fields: [
      { k: 'tankNumber', l: 'Tank Number', req: 1 }, { k: 'depotId', l: 'Depot', type: 'select', lookup: 'depots', req: 1 },
      { k: 'productId', l: 'Product', type: 'select', lookup: 'products' }, { k: 'capacity', l: 'Capacity', type: 'number' },
      { k: 'status', l: 'Status', type: 'select', opts: STATUS, req: 1 },
    ],
  },
  personnel: {
    title: 'Personnel', path: 'master-data/personnel', service: personnelService,
    cols: [['name', 'Name'], ['position', 'Position'], ['depotName', 'Depot'], ['status', 'Status']],
    fields: [{ k: 'name', l: 'Name', req: 1 }, { k: 'position', l: 'Position' }, { k: 'depotId', l: 'Depot', type: 'select', lookup: 'depots', req: 1 }, { k: 'status', l: 'Status', type: 'select', opts: STATUS, req: 1 }],
  },
  audit: {
    title: 'Audit Log', path: 'audit-logs', service: auditService, readonly: true,
    cols: [['createdAt', 'Time', 'dt'], ['userName', 'User'], ['action', 'Action'], ['entity', 'Entity'], ['description', 'Description']],
    filters: [{ k: 'user', l: 'User' }, { k: 'action', l: 'Action' }, { k: 'entity', l: 'Entity' }, { k: 'date', l: 'Date', type: 'date' }],
  },
}
export const LOOKUPS = { depots: depotService, products: productService, tanks: tankService, personnel: personnelService }
