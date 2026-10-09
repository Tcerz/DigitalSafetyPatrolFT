import { handle } from '../common/controller.js'
import * as s from '../services/audit.service.js'
export const list = handle((req) => s.list(req.query))
export const create = handle(s.create, { status: 201 })
