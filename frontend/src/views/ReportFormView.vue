<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { Check, X, Camera } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { reportService, depotService, productService, personnelService, tankService } from '@/services'
import { todayStr, nowTime, label } from '@/lib/util'
import DataState from '@/components/DataState.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'

const auth = useAuthStore(), ui = useUiStore(), route = useRoute(), router = useRouter()
const id = route.params.id, isEdit = !!id
const STEPS = ['General Information', 'Loading', 'Discharge', 'Penyaluran', 'Storage', 'Documentation', 'Review']
const ACT = ['loading', 'discharge', 'penyaluran', 'storage']
const TITLE = { loading: 'Loading', discharge: 'Discharge', penyaluran: 'Penyaluran', storage: 'Storage / Penimbunan' }
const CATS = ['Loading', 'Discharge', 'Penyaluran', 'Storage', 'Finding', 'Corrective Action', 'Other']
const TANK_STATUS = ['LOADING', 'DISCHARGE', 'PENYALURAN', 'AKTIF_IDLE', 'OFF']
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'], MAX_MB = 5, MAX_FILES = 10

const act = () => ({ kondisi: 'AMAN', personnelId: '', jetty1: '', jetty2: '', productId: '', catatan: '', finding: '' })
const blank = () => ({
  tanggal: todayStr(), jamPatrol: nowTime(), depotId: auth.user.depotId || '', picPatrolId: '',
  loading: act(), discharge: act(),
  penyaluran: { kondisi: 'AMAN', personnelId: '', jamMulai: '', jamSelesai: '', catatan: '', finding: '' },
  storage: { kondisi: 'AMAN', personnelId: '', tankIds: [], statusTangki: '', catatan: '', finding: '' },
})
const f = reactive(blank())
const step = ref(0), loading = ref(isEdit), loadErr = ref(''), saving = ref(false), confirmSubmit = ref(false)
const err = ref({}), dirty = ref(false), ready = ref(false)
const depots = ref([]), products = ref([]), people = ref([]), tanks = ref([])
const existing = ref([]), pending = ref([]), photoErr = ref('')

const key = computed(() => ACT[step.value - 1])
const a = computed(() => f[key.value])
const isUnsafe = (k) => f[k].kondisi === 'TIDAK_AMAN'
const needDepotSelect = !auth.user.depotId

function check(i) {
  const e = {}
  const R = (p, v) => { if (v === '' || v == null || (Array.isArray(v) && !v.length)) e[p] = 'Field ini wajib diisi.' }
  if (i === 0) { R('tanggal', f.tanggal); R('jamPatrol', f.jamPatrol); R('depotId', f.depotId); R('picPatrolId', f.picPatrolId) }
  if (i >= 1 && i <= 4) {
    const k = ACT[i - 1], x = f[k]
    R(`${k}.personnelId`, x.personnelId)
    if (k === 'loading' || k === 'discharge') R(`${k}.productId`, x.productId)
    if (k === 'penyaluran') { R('penyaluran.jamMulai', x.jamMulai); R('penyaluran.jamSelesai', x.jamSelesai) }
    if (k === 'storage') { R('storage.tankIds', x.tankIds); R('storage.statusTangki', x.statusTangki) }
    if (x.kondisi === 'TIDAK_AMAN') R(`${k}.finding`, x.finding?.trim())
  }
  return e
}
const stepOk = (i) => !Object.keys(check(i)).length
function next() {
  err.value = check(step.value)
  if (Object.keys(err.value).length) { ui.toast('Lengkapi field yang wajib diisi.', 'error'); return }
  step.value++
}
function goto(i) { if (i <= step.value || [...Array(i).keys()].every((j) => j === 5 || stepOk(j))) step.value = i; else ui.toast('Lengkapi langkah sebelumnya terlebih dahulu.', 'error') }

async function loadDeps() {
  if (!f.depotId) return
  try {
    const q = { depotId: f.depotId, limit: 200 }
    ;[people.value, tanks.value] = await Promise.all([personnelService.list(q).then((r) => r.data), tankService.list(q).then((r) => r.data)])
  } catch (e) { ui.toast(e.userMessage, 'error') }
}
watch(() => f.depotId, () => { if (ready.value) f.storage.tankIds = []; loadDeps() })
watch(f, () => { if (ready.value) dirty.value = true }, { deep: true })

function toggleTank(tid) {
  const l = f.storage.tankIds, i = l.indexOf(tid)
  i < 0 ? l.push(tid) : l.splice(i, 1)
}
function addFiles(ev) {
  photoErr.value = ''
  for (const file of ev.target.files) {
    if (!OK_TYPES.includes(file.type)) { photoErr.value = 'Format file tidak didukung.'; continue }
    if (file.size > MAX_MB * 1024 * 1024) { photoErr.value = 'Ukuran file terlalu besar.'; continue }
    if (existing.value.length + pending.value.length >= MAX_FILES) { photoErr.value = `Maksimal ${MAX_FILES} foto.`; break }
    pending.value.push({ file, url: URL.createObjectURL(file), category: 'Other', key: crypto.randomUUID() })
    dirty.value = true
  }
  ev.target.value = ''
}
function dropPending(p) { URL.revokeObjectURL(p.url); pending.value = pending.value.filter((x) => x !== p) }
async function dropExisting(p) {
  try { await reportService.deletePhoto(p.id); existing.value = existing.value.filter((x) => x.id !== p.id); ui.toast('Foto dihapus.') }
  catch (e) { ui.toast(e.userMessage, 'error') }
}

async function persist() {
  const res = isEdit ? await reportService.update(id, { ...f }) : await reportService.create({ ...f, status: 'DRAFT' })
  const rid = isEdit ? id : res.data.id
  for (const p of pending.value) await reportService.uploadPhoto(rid, p.file, p.category)
  pending.value.forEach((p) => URL.revokeObjectURL(p.url)); pending.value = []
  return rid
}
async function saveDraft() {
  if (saving.value) return
  err.value = check(0)
  if (Object.keys(err.value).length) { step.value = 0; ui.toast('Tanggal, jam, depot, dan PIC wajib diisi untuk menyimpan draft.', 'error'); return }
  for (let i = 1; i <= 4; i++) {
    const k = ACT[i - 1]
    if (isUnsafe(k) && !f[k].finding?.trim()) { err.value = { [`${k}.finding`]: 'Field ini wajib diisi.' }; step.value = i; ui.toast('Deskripsi temuan wajib diisi untuk kondisi Tidak Aman.', 'error'); return }
  }
  saving.value = true
  try { await persist(); dirty.value = false; ui.toast('Laporan berhasil disimpan.'); router.push('/reports') }
  catch (e) { ui.toast(e.userMessage || 'Gagal menyimpan laporan.', 'error') } finally { saving.value = false }
}
function askSubmit() {
  for (let i = 0; i <= 4; i++) { const e = check(i); if (Object.keys(e).length) { err.value = e; step.value = i; ui.toast('Masih ada data yang belum lengkap.', 'error'); return } }
  confirmSubmit.value = true
}
async function submit() {
  saving.value = true
  try { const rid = await persist(); await reportService.setStatus(rid, 'SUBMITTED'); dirty.value = false; confirmSubmit.value = false; ui.toast('Laporan berhasil dikirim.'); router.push(`/reports/${rid}`) }
  catch (e) { ui.toast(e.userMessage || 'Gagal mengirim laporan.', 'error'); confirmSubmit.value = false } finally { saving.value = false }
}

async function init() {
  loading.value = isEdit; loadErr.value = ''
  try {
    const [d, p] = await Promise.all([needDepotSelect ? depotService.list({ limit: 200 }) : { data: [] }, productService.list({ limit: 200 })])
    depots.value = d.data; products.value = p.data
    if (isEdit) {
      const r = (await reportService.get(id)).data
      const b = blank()
      Object.assign(f, { tanggal: r.tanggal?.slice(0, 10), jamPatrol: r.jamPatrol, depotId: r.depotId, picPatrolId: r.picPatrolId })
      ACT.forEach((k) => (f[k] = { ...b[k], ...r[k] }))
      existing.value = r.photos || []
    }
    await loadDeps()
  } catch (e) { loadErr.value = e.userMessage } finally { loading.value = false; setTimeout(() => (ready.value = true), 0) }
}
const warn = (e) => { if (dirty.value) { e.preventDefault(); e.returnValue = '' } }
onMounted(() => { init(); window.addEventListener('beforeunload', warn) })
onBeforeUnmount(() => window.removeEventListener('beforeunload', warn))
onBeforeRouteLeave(() => !dirty.value || confirm('Perubahan belum disimpan.\n\nApakah Anda yakin ingin meninggalkan halaman?'))
</script>

<template>
  <div class="page-head"><h1>{{ isEdit ? 'Edit Safety Patrol' : 'Buat Safety Patrol' }}</h1><span class="badge b-neutral">Draft — belum dikirim untuk verifikasi</span></div>
  <DataState :loading="loading" :error="loadErr" loading-text="Loading report..." @retry="init">
    <div class="steps"><button v-for="(s, i) in STEPS" :key="s" type="button" class="step" :class="{ cur: i === step, done: i < step }" @click="goto(i)">{{ i + 1 }}. {{ s }}</button></div>

    <div v-if="step === 0" class="card"><h2>General Information</h2>
      <div class="form-grid">
        <label class="f"><span>Tanggal Patrol <b class="req">*</b></span><input type="date" v-model="f.tanggal" /><span v-if="err.tanggal" class="err-t">{{ err.tanggal }}</span></label>
        <label class="f"><span>Jam Patrol <b class="req">*</b></span><input type="time" v-model="f.jamPatrol" /><span v-if="err.jamPatrol" class="err-t">{{ err.jamPatrol }}</span></label>
        <label class="f"><span>Depot <b class="req">*</b></span>
          <input v-if="!needDepotSelect" :value="auth.user.depotName" readonly />
          <select v-else v-model="f.depotId"><option value="">Pilih depot</option><option v-for="d in depots" :key="d.id" :value="d.id">{{ d.name }}</option></select>
          <span v-if="err.depotId" class="err-t">{{ err.depotId }}</span></label>
        <label class="f"><span>PIC Patrol <b class="req">*</b></span><select v-model="f.picPatrolId"><option value="">Select Personnel</option><option v-for="p in people" :key="p.id" :value="p.id">{{ p.name }}</option></select><span v-if="err.picPatrolId" class="err-t">{{ err.picPatrolId }}</span></label>
      </div>
    </div>

    <div v-else-if="step >= 1 && step <= 4" class="card"><h2>{{ TITLE[key] }}</h2>
      <label class="f"><span>Kondisi <b class="req">*</b></span>
        <div class="radios"><label v-for="c in ['AMAN', 'TIDAK_AMAN']" :key="c" :class="a.kondisi === c ? (c === 'AMAN' ? 'on-ok' : 'on-bad') : ''"><input type="radio" :value="c" v-model="a.kondisi" /> {{ label(c) }}</label></div></label>
      <div class="form-grid">
        <label class="f"><span>Personel <b class="req">*</b></span><select v-model="a.personnelId"><option value="">Select Personnel</option><option v-for="p in people" :key="p.id" :value="p.id">{{ p.name }}</option></select><span v-if="err[key + '.personnelId']" class="err-t">{{ err[key + '.personnelId'] }}</span></label>
        <template v-if="key === 'loading' || key === 'discharge'">
          <label class="f"><span>Jetty 1</span><input v-model="a.jetty1" /></label>
          <label class="f"><span>Jetty 2</span><input v-model="a.jetty2" /></label>
          <label class="f"><span>Produk <b class="req">*</b></span><select v-model="a.productId"><option value="">Select Product</option><option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option></select><span v-if="err[key + '.productId']" class="err-t">{{ err[key + '.productId'] }}</span></label>
        </template>
        <template v-if="key === 'penyaluran'">
          <label class="f"><span>Jam Mulai <b class="req">*</b></span><input type="time" v-model="a.jamMulai" /><span v-if="err['penyaluran.jamMulai']" class="err-t">{{ err['penyaluran.jamMulai'] }}</span></label>
          <label class="f"><span>Jam Selesai <b class="req">*</b></span><input type="time" v-model="a.jamSelesai" /><span v-if="err['penyaluran.jamSelesai']" class="err-t">{{ err['penyaluran.jamSelesai'] }}</span></label>
        </template>
        <template v-if="key === 'storage'">
          <label class="f"><span>Status Tangki <b class="req">*</b></span><select v-model="a.statusTangki"><option value="">Pilih status</option><option v-for="s in TANK_STATUS" :key="s" :value="s">{{ label(s) }}</option></select><span v-if="err['storage.statusTangki']" class="err-t">{{ err['storage.statusTangki'] }}</span></label>
        </template>
      </div>
      <div v-if="key === 'storage'" class="f"><b>Tangki <span class="req">*</span></b>
        <div v-if="!tanks.length"><small>Tidak ada tangki untuk depot ini.</small></div>
        <div class="chips" style="margin-top:6px"><button v-for="t in tanks" :key="t.id" type="button" class="chip" :class="{ on: a.tankIds.includes(t.id) }" :aria-pressed="a.tankIds.includes(t.id)" @click="toggleTank(t.id)">{{ t.tankNumber }}</button></div>
        <span v-if="err['storage.tankIds']" class="err-t">{{ err['storage.tankIds'] }}</span></div>
      <label class="f" style="margin-top:12px"><span>Catatan</span><textarea v-model="a.catatan" /></label>
      <label v-if="isUnsafe(key)" class="f"><span>Deskripsi Temuan <b class="req">*</b></span><textarea v-model="a.finding" /><span v-if="err[key + '.finding']" class="err-t">Field ini wajib diisi.</span></label>
    </div>

    <div v-else-if="step === 5" class="card"><h2>Upload Documentation</h2>
      <label class="btn primary" style="cursor:pointer"><Camera :size="15" /> + Add Photo<input type="file" accept="image/jpeg,image/png,image/webp" multiple style="display:none" @change="addFiles" /></label>
      <small style="margin-left:8px">JPG/PNG/WEBP, maks. {{ MAX_MB }} MB, maks. {{ MAX_FILES }} foto. Pada perangkat mobile dapat memilih kamera atau galeri.</small>
      <p v-if="photoErr" class="err-t" role="alert">{{ photoErr }}</p>
      <div class="photos" style="margin-top:12px">
        <div v-for="p in existing" :key="p.id" class="photo"><img :src="p.url" :alt="p.category" /><small>{{ p.category }}</small><br><button class="btn sm danger" @click="dropExisting(p)"><X :size="13" /> Remove</button></div>
        <div v-for="p in pending" :key="p.key" class="photo"><img :src="p.url" alt="Preview" />
          <select v-model="p.category" aria-label="Kategori foto"><option v-for="c in CATS" :key="c">{{ c }}</option></select>
          <button class="btn sm" style="margin-top:6px" @click="dropPending(p)"><X :size="13" /> Remove</button></div>
      </div>
      <div v-if="!existing.length && !pending.length" class="state">Belum ada foto dokumentasi.</div>
    </div>

    <div v-else class="card"><h2>Review</h2>
      <div v-for="(s, i) in STEPS.slice(0, 5)" :key="s" class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">
        <b>{{ s.toUpperCase() }}</b><span class="spacer" />
        <span v-if="stepOk(i)" class="badge b-success"><Check :size="13" /> Lengkap</span><span v-else class="badge b-danger"><X :size="13" /> Belum lengkap</span>
        <span v-if="i >= 1 && i <= 4 && isUnsafe(ACT[i - 1])" class="badge b-danger">Tidak Aman</span>
        <button class="btn sm" @click="step = i">Perbaiki</button>
      </div>
      <div class="row" style="padding:8px 0"><b>DOCUMENTATION</b><span class="spacer" /><span class="badge b-info">{{ existing.length + pending.length }} foto</span><button class="btn sm" @click="step = 5">Ubah</button></div>
    </div>

    <div class="row">
      <button class="btn" :disabled="step === 0" @click="step--">Kembali</button>
      <button v-if="step < 6" class="btn primary" @click="next">Lanjut</button>
      <span class="spacer" />
      <button class="btn" :disabled="saving" @click="saveDraft">{{ saving ? 'Saving...' : 'Save Draft' }}</button>
      <button v-if="step === 6" class="btn primary" :disabled="saving" @click="askSubmit">Submit Report</button>
    </div>
  </DataState>
  <ConfirmModal :open="confirmSubmit" title="Submit Report" message="Apakah Anda yakin ingin mengirim laporan?&#10;&#10;Setelah dikirim, laporan akan masuk ke proses verifikasi." confirm-text="Submit Report" :busy="saving" @ok="submit" @cancel="confirmSubmit = false" />
</template>
