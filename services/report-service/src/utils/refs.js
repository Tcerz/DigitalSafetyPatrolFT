import { AppError } from '../common/AppError.js'
import { callService } from '../common/http.js'

// Validasi referensi ke master-data-service SEKALIGUS mengambil namanya (untuk disimpan sebagai snapshot).
// Report-service tidak membaca database master data; ia bertanya lewat API.
// Jika master-data-service mati -> 503 (membuat/mengubah laporan memang butuh data master).
export async function resolveRefs(req, depotId, picId, acts = {}, knownDepotName = null) {
  const all = Object.values(acts)
  const uniq = (xs) => [...new Set(xs.filter(Boolean))]
  const people = uniq([picId, ...all.map((a) => a.personnelId)])
  const tanks = uniq(all.flatMap((a) => a.tankIds || []))
  const products = uniq(all.map((a) => a.productId))
  if (knownDepotName && !people.length && !tanks.length && !products.length)
    return { depotName: knownDepotName, personnel: {}, tanks: {}, products: {} } // tidak ada yang perlu dicek
  const r = await callService('master', '/internal/resolve', { method: 'POST', body: { depotId, personnelIds: people, tankIds: tanks, productIds: products }, req })
  if (!r.depot) throw new AppError(422, 'Depot tidak valid.')
  if (r.personnel.length !== people.length) throw new AppError(422, 'Personel tidak valid untuk depot ini.')
  if (r.tanks.length !== tanks.length) throw new AppError(422, 'Tangki tidak valid untuk depot ini.')
  if (r.products.length !== products.length) throw new AppError(422, 'Produk tidak valid.')
  return {
    depotName: r.depot.name,
    personnel: Object.fromEntries(r.personnel.map((p) => [p.id, p.name])),
    tanks: Object.fromEntries(r.tanks.map((t) => [t.id, t.tankNumber])),
    products: Object.fromEntries(r.products.map((p) => [p.id, p.name])),
  }
}
