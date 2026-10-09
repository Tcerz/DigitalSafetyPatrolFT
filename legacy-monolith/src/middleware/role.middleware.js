import { AppError } from '../utils/AppError.js'
export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(new AppError(403, 'Anda tidak memiliki akses.'))
