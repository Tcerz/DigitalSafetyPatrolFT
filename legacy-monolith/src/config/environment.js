import 'dotenv/config'

const num = (v, d) => (v === undefined || v === '' ? d : Number(v))

export const env = {
  port: num(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  maxFileMb: num(process.env.MAX_FILE_SIZE_MB, 5),
  maxPhotos: num(process.env.MAX_PHOTOS_PER_REPORT, 10),
}

if (!env.jwtSecret || env.jwtSecret.length < 16) {
  throw new Error('JWT_SECRET wajib diisi (minimal 16 karakter). Lihat .env.example.')
}
