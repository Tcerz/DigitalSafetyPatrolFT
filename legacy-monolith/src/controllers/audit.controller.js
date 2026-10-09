import { handle } from '../utils/controller.js'
import * as s from '../services/audit.service.js'
export const list = handle((req) => s.list(req.query))
