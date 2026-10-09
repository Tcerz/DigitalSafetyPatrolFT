import { asyncHandler } from './asyncHandler.js'

// Service mengembalikan data biasa, atau listResult() untuk data berpagination.
export const listResult = (data, pagination) => ({ __list: true, data, pagination })

export const handle = (fn, { status = 200, message = 'OK' } = {}) =>
  asyncHandler(async (req, res) => {
    const r = await fn(req)
    if (r && r.__list) return res.status(status).json({ success: true, message, data: r.data, pagination: r.pagination })
    res.status(status).json({ success: true, message, data: r === undefined ? null : r })
  })
