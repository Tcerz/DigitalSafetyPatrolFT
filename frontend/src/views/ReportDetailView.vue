<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Pencil, Trash2, FileDown, ShieldCheck, Wrench, RefreshCw, ArrowRight } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useReportStore } from '@/stores/report'
import { useUiStore } from '@/stores/ui'
import { reportService, correctiveActionService, personnelService } from '@/services'
import { fmtDate, fmtDateTime, STATUSES, label, download, todayStr } from '@/lib/util'
import DataState from '@/components/DataState.vue'
import Badge from '@/components/Badge.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'

const route = useRoute(), router = useRouter(), auth = useAuthStore(), st = useReportStore(), ui = useUiStore()
const id = route.params.id, role = auth.role
const modal = ref(''), busy = ref(false), newStatus = ref(''), note = ref(''), people = ref([])
const ca = ref({ findingId: null, action: '', picId: '', targetDate: todayStr() })
const SECS = [
  { k: 'loading', t: 'Loading', f: [['Kondisi', 'kondisi', 'cond'], ['Personel', 'personnelName'], ['Jetty 1', 'jetty1'], ['Jetty 2', 'jetty2'], ['Produk', 'productName'], ['Catatan', 'catatan']] },
  { k: 'discharge', t: 'Discharge', f: [['Kondisi', 'kondisi', 'cond'], ['Personel', 'personnelName'], ['Jetty 1', 'jetty1'], ['Jetty 2', 'jetty2'], ['Produk', 'productName'], ['Catatan', 'catatan']] },
  { k: 'penyaluran', t: 'Penyaluran', f: [['Kondisi', 'kondisi', 'cond'], ['Personel', 'personnelName'], ['Jam Mulai', 'jamMulai'], ['Jam Selesai', 'jamSelesai'], ['Catatan', 'catatan']] },
  { k: 'storage', t: 'Storage / Penimbunan', f: [['Kondisi', 'kondisi', 'cond'], ['Personel', 'personnelName'], ['Tangki', 'tankNames', 'list'], ['Status Tangki', 'statusTangki', 'lbl'], ['Catatan', 'catatan']] },
]
const r = computed(() => st.currentReport)
const idx = computed(() => STATUSES.indexOf(r.value?.status))
const findings = computed(() => r.value?.findings || [])
const isDraft = computed(() => r.value?.status === 'DRAFT')
const canEdit = computed(() => (role === 'PETUGAS' && isDraft.value) || role === 'SUPERADMIN')
const canDel = computed(() => (role === 'PETUGAS' && isDraft.value) || (role === 'SUPERADMIN' && r.value?.status !== 'CLOSED'))
const isAdm = role === 'ADMIN' || role === 'SUPERADMIN'
const canVerify = computed(() => isAdm && r.value?.status === 'SUBMITTED')
const canChange = computed(() => isAdm && idx.value > 0 && idx.value < STATUSES.length - 1)
const nextStatuses = computed(() => STATUSES.slice(idx.value + 1))

const val = (s, f) => { const v = r.value?.[s.k]?.[f[1]]; return f[2] === 'list' ? (v || []).join(', ') || '-' : f[2] === 'lbl' ? label(v) || '-' : v || '-' }
const load = () => st.fetchOne(id)
async function changeStatus(status) {
  busy.value = true
  try { await reportService.setStatus(id, status, note.value); ui.toast('Data berhasil diperbarui.'); modal.value = ''; note.value = ''; await load() }
  catch (e) { ui.toast(e.userMessage || 'Gagal mengubah status.', 'error') } finally { busy.value = false }
}
async function remove() {
  busy.value = true
  try { await reportService.remove(id); ui.toast('Laporan berhasil dihapus.'); router.push('/reports') }
  catch (e) { ui.toast(e.userMessage || 'Gagal menghapus laporan.', 'error'); busy.value = false }
}
async function pdf() {
  ui.toast('Generating report...')
  try { download(await reportService.pdf(id), `${r.value.reportNumber || 'laporan'}.pdf`); ui.toast('PDF generated successfully.') }
  catch (e) { ui.toast(e.userMessage || 'Gagal membuat PDF.', 'error') }
}
async function openCA(f) {
  ca.value = { findingId: f.id, action: '', picId: '', targetDate: todayStr() }
  modal.value = 'ca'
  try { people.value = (await personnelService.list({ depotId: r.value.depotId, limit: 200 })).data } catch { /* pilihan PIC kosong */ }
}
async function saveCA() {
  if (!ca.value.action.trim() || !ca.value.picId || !ca.value.targetDate) { ui.toast('Action, PIC, dan target wajib diisi.', 'error'); return }
  busy.value = true
  try { await correctiveActionService.create({ ...ca.value, reportId: id }); ui.toast('Corrective action berhasil dibuat.'); modal.value = ''; await load() }
  catch (e) { ui.toast(e.userMessage || 'Gagal menyimpan.', 'error') } finally { busy.value = false }
}
onMounted(load)
</script>
<template>
  <DataState :loading="st.loading && !r" :error="st.error" loading-text="Loading report..." @retry="load">
    <template v-if="r">
      <div class="card">
        <div class="page-head" style="margin:0">
          <div><small>Safety Patrol Report</small><h1>{{ r.reportNumber || 'Draft' }}</h1></div>
          <div class="row"><Badge :value="r.status" /><Badge :value="r.priority" kind="priority" /><Badge :value="r.kondisi" kind="condition" />
            <span v-if="findings.length" class="badge b-danger">⚠ {{ findings.length }} Unsafe Findings</span></div>
        </div>
        <dl class="dl" style="margin-top:12px"><dt>Depot</dt><dd>{{ r.depotName }}</dd><dt>Tanggal</dt><dd>{{ fmtDate(r.tanggal) }} {{ r.jamPatrol }}</dd><dt>PIC Patrol</dt><dd>{{ r.picName }}</dd><dt>Dibuat oleh</dt><dd>{{ r.createdByName }}</dd></dl>
        <div class="row" style="margin-top:12px">
          <button class="btn" @click="load"><RefreshCw :size="14" /> Refresh</button>
          <RouterLink v-if="canEdit" class="btn" :to="`/reports/${id}/edit`"><Pencil :size="14" /> Edit</RouterLink>
          <button v-if="canVerify" class="btn primary" @click="modal = 'verify'"><ShieldCheck :size="14" /> Verify</button>
          <button v-if="canChange" class="btn" @click="newStatus = nextStatuses[0]; modal = 'status'">Change Status</button>
          <button class="btn" @click="pdf"><FileDown :size="14" /> Export PDF</button>
          <button v-if="canDel" class="btn danger" @click="modal = 'del'"><Trash2 :size="14" /> Delete</button>
        </div>
        <p v-if="isDraft" class="badge b-neutral" style="margin-top:12px">Draft — belum dikirim untuk verifikasi.</p>
      </div>

      <div class="card"><h2>Status Workflow</h2>
        <ul class="tl"><li v-for="(s, i) in STATUSES" :key="s" :class="{ done: i < idx, cur: i === idx }">{{ label(s) }}</li></ul></div>

      <div class="card">
        <div v-for="s in SECS" :key="s.k" class="sec" :class="{ bad: r[s.k]?.kondisi === 'TIDAK_AMAN' }"><h2>{{ s.t }}</h2>
          <dl v-if="r[s.k]" class="dl"><template v-for="f in s.f" :key="f[1]"><dt>{{ f[0] }}</dt><dd><Badge v-if="f[2] === 'cond'" :value="r[s.k][f[1]]" kind="condition" /><template v-else>{{ val(s, f) }}</template></dd></template>
            <template v-if="r[s.k].finding"><dt>Temuan</dt><dd>{{ r[s.k].finding }}</dd></template></dl>
          <small v-else>Tidak ada data.</small></div>
      </div>

      <div class="card"><h2>Photos</h2>
        <div v-if="r.photos?.length" class="photos"><a v-for="p in r.photos" :key="p.id" :href="p.url" target="_blank" rel="noopener" class="photo"><img :src="p.url" :alt="p.category" /><small>{{ p.category }}</small></a></div>
        <small v-else>Tidak ada foto dokumentasi.</small></div>

      <div class="card"><h2>Finding</h2>
        <small v-if="!findings.length">No finding reported.</small>
        <div v-for="(f, i) in findings" :key="f.id" class="sec bad">
          <h3>Finding #{{ i + 1 }} <Badge :value="f.priority" kind="priority" /></h3>
          <dl class="dl"><dt>Title</dt><dd>{{ f.title }}</dd><dt>Description</dt><dd>{{ f.description }}</dd><dt>Location</dt><dd>{{ f.location || '-' }}</dd><dt>Recommendation</dt><dd>{{ f.recommendation || '-' }}</dd></dl>
          <template v-if="f.correctiveAction">
            <h3 style="margin-top:12px">Corrective Action</h3>
            <dl class="dl"><dt>Action</dt><dd>{{ f.correctiveAction.action }}</dd><dt>PIC</dt><dd>{{ f.correctiveAction.picName }}</dd><dt>Target</dt><dd>{{ fmtDate(f.correctiveAction.targetDate) }}</dd><dt>Status</dt><dd><Badge :value="f.correctiveAction.status" /></dd></dl>
            <div class="ba"><div><b>BEFORE</b><img v-if="f.photoUrl" :src="f.photoUrl" alt="Before" /><small v-else><br>Belum ada foto.</small></div><ArrowRight /><div><b>AFTER</b><img v-if="f.correctiveAction.afterPhotoUrl" :src="f.correctiveAction.afterPhotoUrl" alt="After" /><small v-else><br>Belum ada foto.</small></div></div>
            <RouterLink class="btn sm" :to="`/corrective-actions/${f.correctiveAction.id}`" style="margin-top:8px">Detail tindak lanjut</RouterLink>
          </template>
          <button v-else-if="isAdm" class="btn sm" @click="openCA(f)"><Wrench :size="13" /> Add Corrective Action</button>
        </div>
      </div>

      <div class="card"><h2>Status History</h2>
        <small v-if="!r.statusHistory?.length">Belum ada riwayat.</small>
        <div v-for="h in r.statusHistory" :key="h.id || h.createdAt" style="margin-bottom:10px"><b>{{ fmtDateTime(h.createdAt) }}</b><br>{{ label(h.status) }} by {{ h.byName }}<span v-if="h.note"><br><small>{{ h.note }}</small></span></div></div>
    </template>
  </DataState>

  <ConfirmModal :open="modal === 'del'" title="Delete Report?" :message="`Report ${r?.reportNumber || 'Draft'} will be deleted.`" confirm-text="Delete" danger :busy="busy" @ok="remove" @cancel="modal = ''" />
  <ConfirmModal :open="modal === 'verify'" title="Verify Report" message="Tandai laporan ini sebagai terverifikasi?" confirm-text="Verify" :busy="busy" @ok="changeStatus('VERIFIED')" @cancel="modal = ''" />
  <ConfirmModal :open="modal === 'status'" title="Change Status" confirm-text="Ubah Status" :busy="busy" @ok="changeStatus(newStatus)" @cancel="modal = ''">
    <label class="f"><span>Status baru</span><select v-model="newStatus"><option v-for="s in nextStatuses" :key="s" :value="s">{{ label(s) }}</option></select></label>
    <label class="f"><span>Catatan</span><textarea v-model="note" /></label>
  </ConfirmModal>
  <ConfirmModal :open="modal === 'ca'" title="Add Corrective Action" confirm-text="Simpan" :busy="busy" @ok="saveCA" @cancel="modal = ''">
    <label class="f"><span>Action *</span><textarea v-model="ca.action" /></label>
    <label class="f"><span>PIC *</span><select v-model="ca.picId"><option value="">Select Personnel</option><option v-for="p in people" :key="p.id" :value="p.id">{{ p.name }}</option></select></label>
    <label class="f"><span>Target Date *</span><input type="date" v-model="ca.targetDate" /></label>
  </ConfirmModal>
</template>
