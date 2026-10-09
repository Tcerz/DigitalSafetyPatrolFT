import dns from 'node:dns/promises'
import { log } from './common/logger.js'

// Load balancer sederhana (round-robin).
// Docker DNS mengembalikan SEMUA IP container untuk satu nama service. Setelah
// `docker compose up --scale report-service=3`, nama "report-service" -> 3 IP.
// Gateway memperbarui daftar IP tiap beberapa detik lalu membagi request bergiliran.
export class Balancer {
  constructor(name, host, port) {
    this.name = name; this.host = host; this.port = port; this.ips = []; this.i = 0
    this.refresh()
    setInterval(() => this.refresh(), 3000).unref()
  }
  async refresh() {
    try {
      const ips = (await dns.resolve4(this.host)).sort()
      if (ips.join() !== this.ips.join()) log.info('daftar instance berubah', { service: this.name, instances: ips })
      this.ips = ips
    } catch { /* pertahankan daftar lama; service mungkin sedang restart */ }
  }
  target() {
    if (!this.ips.length) return `http://${this.host}:${this.port}`
    return `http://${this.ips[this.i++ % this.ips.length]}:${this.port}`
  }
}
