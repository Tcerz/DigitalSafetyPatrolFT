import 'dotenv/config'

const must = (k, min = 1) => {
  const v = process.env[k]
  if (!v || v.length < min) throw new Error(`${k} wajib diisi (minimal ${min} karakter). Lihat .env.example.`)
  return v
}

export const env = {
  service: process.env.SERVICE_NAME || 'service',
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: must('JWT_SECRET', 16),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  internalKey: must('INTERNAL_KEY', 16),
  // Alamat service lain di jaringan Docker (memakai NAMA SERVICE, bukan localhost)
  urls: {
    auth: process.env.AUTH_URL || 'http://auth-service:3001',
    master: process.env.MASTER_URL || 'http://master-data-service:3006',
    report: process.env.REPORT_URL || 'http://report-service:3003',
    notification: process.env.NOTIFICATION_URL || 'http://notification-service:3008',
    audit: process.env.AUDIT_URL || 'http://audit-service:3010',
  },
  timeoutMs: Number(process.env.SERVICE_TIMEOUT_MS || 3000),
}
