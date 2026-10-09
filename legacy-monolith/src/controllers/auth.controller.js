import { handle } from '../utils/controller.js'
import * as s from '../services/auth.service.js'
export const login = handle(s.login, { message: 'Login berhasil' })
export const me = handle(s.me)
export const logout = handle(s.logout, { message: 'Logout berhasil' })
export const changePassword = handle(s.changePassword, { message: 'Password berhasil diubah' })
