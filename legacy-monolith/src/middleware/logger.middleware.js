// Log: timestamp, method, endpoint, status, durasi. Body/header (password, token) tidak pernah dicatat.
export const requestLogger = (req, res, next) => {
  const t = Date.now()
  res.on('finish', () => {
    if (req.path === '/api/health') return
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - t}ms`)
  })
  next()
}
