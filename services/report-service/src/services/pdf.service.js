import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import { UPLOAD_ROOT } from '../utils/upload.js'
import { audit } from '../common/http.js'
import { fmtDate } from '../common/dates.js'
import * as reports from './report.service.js'

const L = (s) => String(s ?? '-').replace(/_/g, ' ')

export async function streamReportPdf(req, res) {
  const r = await reports.getDetail(req.user, req.params.id) // sekaligus memeriksa hak akses
  audit(req, 'EXPORT_REPORT', 'SafetyReport', r.id, `${req.user.name} mengekspor PDF laporan ${r.reportNumber}`)
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Safety Patrol ${r.reportNumber}` } })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${r.reportNumber}.pdf"`)
  doc.pipe(res)
  const h = (t) => { if (doc.y > 700) doc.addPage(); doc.moveDown(0.8).fontSize(13).fillColor('#121c28').text(t).moveDown(0.2).fillColor('#000').fontSize(10) }
  const kv = (k, v) => doc.font('Helvetica-Bold').text(`${k}: `, { continued: true }).font('Helvetica').text(String(v ?? '-'))

  doc.fontSize(18).font('Helvetica-Bold').text('DIGITAL SAFETY PATROL', { align: 'center' })
  doc.fontSize(11).font('Helvetica').text('Laporan Safety Patrol', { align: 'center' }).moveDown()
  doc.fontSize(10)
  kv('Nomor Laporan', r.reportNumber); kv('Depot', r.depotName); kv('Tanggal', `${fmtDate(r.tanggal)} ${r.jamPatrol}`)
  kv('PIC Patrol', r.picName); kv('Dibuat oleh', r.createdByName); kv('Kondisi', L(r.kondisi)); kv('Prioritas', r.priority); kv('Status', L(r.status))

  const SEC = [['loading', 'Loading'], ['discharge', 'Discharge'], ['penyaluran', 'Penyaluran'], ['storage', 'Storage / Penimbunan']]
  for (const [k, title] of SEC) {
    h(title)
    const a = r[k]
    if (!a) { doc.text('Tidak ada data.'); continue }
    kv('Kondisi', L(a.kondisi)); kv('Personel', a.personnelName)
    if (k === 'loading' || k === 'discharge') { kv('Jetty 1', a.jetty1); kv('Jetty 2', a.jetty2); kv('Produk', a.productName) }
    if (k === 'penyaluran') { kv('Jam Mulai', a.jamMulai); kv('Jam Selesai', a.jamSelesai) }
    if (k === 'storage') { kv('Tangki', a.tankNames.join(', ')); kv('Status Tangki', L(a.statusTangki)) }
    kv('Catatan', a.catatan)
    if (a.finding) kv('Temuan', a.finding)
  }

  h('Finding & Corrective Action')
  if (!r.findings.length) doc.text('Tidak ada finding.')
  r.findings.forEach((f, i) => {
    doc.font('Helvetica-Bold').text(`#${i + 1} ${f.title} [${f.priority}] - ${L(f.status)}`).font('Helvetica').text(f.description)
    if (f.recommendation) doc.text(`Rekomendasi: ${f.recommendation}`)
    if (f.correctiveAction) { const c = f.correctiveAction; doc.text(`Corrective Action: ${c.action} | PIC: ${c.picName} | Target: ${c.targetDate} | Status: ${L(c.status)}`) }
    doc.moveDown(0.4)
  })

  h('Dokumentasi Foto')
  const imgs = r.photos.filter((p) => /\.(jpe?g|png)$/i.test(p.url))
  if (!r.photos.length) doc.text('Tidak ada foto.')
  for (const p of imgs) {
    const file = path.join(UPLOAD_ROOT, path.basename(p.url))
    if (!fs.existsSync(file)) continue
    if (doc.y > 560) doc.addPage()
    try { doc.image(file, { fit: [300, 200] }); doc.text(L(p.category)).moveDown(0.5) } catch { doc.text(`(foto ${L(p.category)} tidak dapat ditampilkan)`) }
  }
  if (r.photos.length > imgs.length) doc.text(`${r.photos.length - imgs.length} foto berformat WEBP tidak disertakan di PDF.`)

  h('Riwayat Status')
  r.statusHistory.forEach((s) => doc.text(`${new Date(s.createdAt).toLocaleString('id-ID')} - ${L(s.status)} oleh ${s.byName ?? '-'}${s.note ? ` (${s.note})` : ''}`))
  doc.end()
}
