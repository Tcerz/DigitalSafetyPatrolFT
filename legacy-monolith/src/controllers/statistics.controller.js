import { handle } from '../utils/controller.js'
import * as s from '../services/statistics.service.js'
const h = (fn) => handle((req) => fn(req.user, req.query))
export const summary = h(s.summary)
export const activity = h(s.activity)
export const trend = h(s.trend)
export const tanks = h(s.tanks)
export const personnel = h(s.personnel)
export const products = h(s.products)
