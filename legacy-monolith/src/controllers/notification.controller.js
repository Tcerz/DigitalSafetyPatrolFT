import { handle } from '../utils/controller.js'
import * as s from '../services/notification.service.js'
export const list = handle((req) => s.list(req.user, req.query))
export const unread = handle((req) => s.list(req.user, req.query, true))
export const markRead = handle((req) => s.markRead(req.user, req.params.id), { message: 'Notifikasi ditandai dibaca' })
export const markAllRead = handle((req) => s.markAllRead(req.user), { message: 'Semua notifikasi ditandai dibaca' })
